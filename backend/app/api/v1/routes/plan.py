"""
app/api/v1/routes/plan.py

Academic plan generation async endpoints.
REQ-078
"""

from __future__ import annotations

import logging
import os

import nh3
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, Student, User
from app.db.models_v2 import AcademicPlan, PlanGenerationJob, PlanHistory, StudentSchoolTarget, Subject
from app.db.session import SessionLocal, get_db
from app.schemas.v2.plan import PlanGenerateRequest, PlanHistoryItem, PlanHistoryResponse, PlanJobResponse, PlanResponse, PlanStatusResponse
from app.schemas.v2.plan_chat import PlanChatRequest, PlanChatResponse
from app.schemas.v2.plan_edit import EditSectionRequest, SetTemplateRequest
from app.services import student_service
from app.services.student_data_builder import build_school_dict, build_student_data, build_student_dict_for_plan
from app.modules.school_choice.services.matchmaker_v2 import run_matching
from app.modules.school_choice.services.plan_generator import _build_action_items, generate_html_plan
from app.modules.school_choice.services.plan_chat_service import handle_chat as plan_chat_handle

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/students", tags=["plan-v2"])

_TIMEOUT_SECONDS = int(os.environ.get("PLAN_GENERATION_TIMEOUT_SECONDS", "30"))


# ---------------------------------------------------------------------------
# Background plan generation task
# ---------------------------------------------------------------------------

def _run_ai_enhancement(student, student_data: dict, match_results: list) -> dict | None:
    """
    Optional AI enhancement: generate personalized rationales and action items.
    Returns parsed JSON dict or None if AI is unavailable or fails.
    Non-blocking — errors are logged and swallowed.
    """
    try:
        from app.core.ai_service import call_ai
        from app.core.config import settings as _cfg
        if not _cfg.AI_API_KEY:
            return None

        eligible_for_ai = [r for r in match_results if r.eligibility_pass][:5]
        schools_summary = "\n".join([
            f"- {r.school_name} (major: {getattr(r, 'major_name', None) or 'General'}): "
            f"{r.fit_score:.0%} overall match"
            for r in eligible_for_ai
        ])
        activities_text = ", ".join(student_data["extra_curricular_activities"][:5]) or "None listed"
        awards_text = ", ".join(student_data["award_titles"][:5]) or "None listed"
        grades_text = ", ".join(f"{k}: {v}" for k, v in student_data["grades_by_code"].items())
        interests_text = ", ".join(str(i) for i in student_data["interests"]) if student_data["interests"] else "None listed"
        personal_stmt = getattr(student, "personal_statement", "") or ""

        # SECURITY: Do NOT send student real name or identifiable info to
        # third-party AI provider. Use anonymised label. The real name is
        # only used locally in the generated HTML plan.
        ai_prompt = f"""You are an experienced Hong Kong secondary school academic counselor. Generate personalized rationales and action items.

STUDENT PROFILE:
- Student: Year {getattr(student, 'year_of_study', '?')} HKDSE candidate
- HKDSE Grades: {grades_text}
- Best-5 Aggregate: {student_data['best5_aggregate']}
- IELTS: {student_data['ielts_score'] or 'Not taken'}
- Interests: {interests_text}
- Activities: {activities_text}
- Awards: {awards_text}
- Personal Statement Summary: {personal_stmt[:200] if personal_stmt else 'Not written yet'}
- Strengths/Weaknesses: {student.strengths_weaknesses or 'Not specified'}

MATCHED SCHOOLS (from scoring algorithm):
{schools_summary}

Respond with ONLY valid JSON — no markdown, no explanation:
{{
  "school_rationales": {{
    "<school_name>": "<2-3 sentences in plain language citing the student's actual grades and interests. Do NOT use internal metric names or decimal scores. Say 'strong match' not 'fit_score=0.72'.>"
  }},
  "action_items": [
    {{"task": "<specific task for THIS student>", "priority": "High|Medium|Low", "deadline": "<Month YYYY>", "reason": "<why>"}}
  ],
  "overall_assessment": "<3-4 sentences in plain language about university prospects, strengths, and what to focus on>"
}}

Rules:
- Write for a student and parents — no jargon, no internal metric names, no raw decimals.
- Every rationale MUST cite at least one specific grade from the student profile.
- Action items must have month-specific deadlines based on HK application calendar.
- Keep it concise: max 3 action items, max 5 school rationales."""

        ai_response = call_ai([
            {"role": "system", "content": "You are a Hong Kong academic counselor. Respond with valid JSON only. Be concise."},
            {"role": "user", "content": ai_prompt},
        ], max_tokens=1500, temperature=0.3)

        import re as _re
        cleaned = ai_response.strip()
        if cleaned.startswith("```"):
            cleaned = _re.sub(r"^```[a-z]*\n?", "", cleaned)
            cleaned = _re.sub(r"\n?```$", "", cleaned.strip())

        import json as _json
        ai_commentary = _json.loads(cleaned)
        logger.info("AI plan enhancement: 1 LLM call for %d school rationales", len(ai_commentary.get("school_rationales", {})))

        # Apply AI rationales to match results
        if "school_rationales" in ai_commentary:
            for r in match_results:
                if r.school_name in ai_commentary["school_rationales"]:
                    r.rationale = ai_commentary["school_rationales"][r.school_name]

        return ai_commentary

    except Exception as exc:
        logger.warning("AI plan enhancement failed (non-blocking): %s", exc)
        return None


def _build_recommended_list(match_results: list, existing_targets: list) -> list[dict]:
    """Build the recommended schools JSON list from match results."""
    eligible = [r for r in match_results if r.eligibility_pass][:5]
    target_major_map = {
        str(t.school_id): t.intended_majors
        for t in existing_targets
        if t.intended_majors
    }
    return [
        {
            "school_id": r.school_id,
            "school_name": r.school_name,
            "rationale": r.rationale,
            "fit_score": r.fit_score,
            "final_score": r.final_score,
            "intended_majors": target_major_map.get(r.school_id),
            "component_scores": r.component_scores,
            "eligibility_pass": True,
            "failing_criteria": [],
            "shap_explanation": r.shap_explanation,
            "major_name": getattr(r, "major_name", None),
            "major_jupas_code": getattr(r, "major_jupas_code", None),
        }
        for r in eligible
    ]


def _persist_plan(
    db: Session, student_id: UUID, html_content: str,
    recommended: list, action_items: list, subject_grades: list,
    best5: int, existing_targets: list,
) -> AcademicPlan:
    """Upsert AcademicPlan and save history snapshot."""
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if plan:
        plan.version = (plan.version or 1) + 1
        plan.html_content = html_content
        plan.recommended_schools = recommended
        plan.action_items = action_items
        plan.generated_at = datetime.now(timezone.utc)
    else:
        plan = AcademicPlan(
            student_id=student_id,
            html_content=html_content,
            recommended_schools=recommended,
            action_items=action_items,
            generated_at=datetime.now(timezone.utc),
            version=1,
        )
        db.add(plan)

    snapshot = {
        "subject_grades": subject_grades,
        "best5_aggregate": best5,
        "target_schools": [
            {"school_id": str(t.school_id), "student_rank": t.student_rank}
            for t in existing_targets
        ],
    }
    version_num = plan.version if plan else 1
    history_label = f"Plan v{version_num} — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    db.add(PlanHistory(
        student_id=student_id,
        version=version_num,
        plan_label=history_label,
        html_content=html_content,
        recommended_schools=recommended,
        action_items=action_items,
        snapshot_data=snapshot,
        generated_at=datetime.now(timezone.utc),
    ))
    return plan


def _generate_plan_task(job_id: UUID, student_id: UUID, plan_type: str = "UNIVERSITY") -> None:
    """
    Background task: build student data, run matching, generate HTML, save plan.
    Marks job DONE or FAILED.
    """
    db: Session = SessionLocal()
    try:
        # Mark running
        job = db.query(PlanGenerationJob).filter(PlanGenerationJob.id == job_id).first()
        if not job:
            return
        job.status = "RUNNING"
        db.commit()

        # Load student
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise RuntimeError("Student not found")

        # Step 1: Build student data (single canonical source)
        student_data = build_student_data(student, db)
        student_dict = build_student_dict_for_plan(student, student_data)

        # Step 2: Run matching against all schools
        all_schools = db.query(School).all()
        school_dicts = [build_school_dict(s) for s in all_schools]

        existing_targets = (
            db.query(StudentSchoolTarget)
            .filter(StudentSchoolTarget.student_id == student_id)
            .all()
        )
        target_dicts = [
            {"school_id": str(t.school_id), "student_rank": t.student_rank}
            for t in existing_targets
        ]
        match_results = run_matching(student_data, school_dicts, target_dicts)

        # Step 3: AI enhancement (non-blocking)
        ai_commentary = _run_ai_enhancement(student, student_data, match_results)

        # Step 4: Generate HTML
        action_items = _build_action_items(student_dict, match_results)
        if ai_commentary and "action_items" in ai_commentary:
            action_items = ai_commentary["action_items"]

        html_content = generate_html_plan(
            student_dict, match_results, action_items, plan_type=plan_type,
            ai_assessment=ai_commentary.get("overall_assessment") if ai_commentary else None,
        )

        # Step 5: Build recommended list and persist
        recommended = _build_recommended_list(match_results, existing_targets)
        _persist_plan(
            db, student_id, html_content, recommended, action_items,
            student_data["subject_grades_detail"], student_data["best5_aggregate"],
            existing_targets,
        )

        job.status = "DONE"
        job.updated_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:
        logger.error("Plan generation failed for job %s: %s", job_id, exc, exc_info=True)
        try:
            job = db.query(PlanGenerationJob).filter(PlanGenerationJob.id == job_id).first()
            if job:
                job.status = "FAILED"
                job.error_message = str(exc)[:500]
                job.updated_at = datetime.now(timezone.utc)
                db.commit()
        except Exception as inner_exc:
            logger.error("Failed to mark job %s as FAILED: %s", job_id, inner_exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# POST /students/{student_id}/plan
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/plan",
    response_model=PlanJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_plan(
    student_id: UUID,
    background_tasks: BackgroundTasks,
    body: PlanGenerateRequest = PlanGenerateRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enqueue plan generation as a background task.
    Accepts optional JSON body with plan_type: "UNIVERSITY" (default) or "HIGH_SCHOOL".
    Returns {job_id, status: 'PENDING'}. REQ-078
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    job = PlanGenerationJob(
        student_id=student_id,
        status="PENDING",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_generate_plan_task, job.id, student_id, body.plan_type)

    return PlanJobResponse(job_id=job.id, status=job.status, created_at=job.created_at)


# ---------------------------------------------------------------------------
# GET /students/{student_id}/plan/status
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/plan/status",
    response_model=PlanStatusResponse,
    status_code=status.HTTP_200_OK,
)
def get_plan_status(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the latest PlanGenerationJob status for a student. REQ-078"""
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    job = (
        db.query(PlanGenerationJob)
        .filter(PlanGenerationJob.student_id == student_id)
        .order_by(PlanGenerationJob.created_at.desc())
        .first()
    )
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No plan generation job found for this student",
        )
    return job


# ---------------------------------------------------------------------------
# GET /students/{student_id}/plan
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/plan",
    response_model=PlanResponse,
    status_code=status.HTTP_200_OK,
)
def get_plan(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the latest AcademicPlan for a student.
    Returns HTML if html_content is present (Content-Type: text/html),
    otherwise returns JSON with plan metadata. REQ-078
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    plan = (
        db.query(AcademicPlan)
        .filter(AcademicPlan.student_id == student_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No academic plan found for this student. Generate one first.",
        )

    return PlanResponse.model_validate(plan)


# ---------------------------------------------------------------------------
# GET /students/{student_id}/plans/history
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/plans/history",
    response_model=PlanHistoryResponse,
    status_code=status.HTTP_200_OK,
)
def list_plan_history(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all historical plan snapshots for a student, newest first."""
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    history = (
        db.query(PlanHistory)
        .filter(PlanHistory.student_id == student_id)
        .order_by(PlanHistory.created_at.desc())
        .all()
    )
    items = [PlanHistoryItem.model_validate(h) for h in history]
    return PlanHistoryResponse(plans=items, total=len(items))


@router.delete(
    "/{student_id}/plans/history/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_plan_history(
    student_id: UUID,
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a saved plan from history."""
    from fastapi import HTTPException as _HTTPException
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    entry = (
        db.query(PlanHistory)
        .filter(PlanHistory.id == plan_id, PlanHistory.student_id == student_id)
        .first()
    )
    if not entry:
        raise _HTTPException(status_code=404, detail="Plan not found")
    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# POST /students/{student_id}/plan/chat  (Point 16)
# ---------------------------------------------------------------------------

@router.post("/{student_id}/plan/chat", response_model=PlanChatResponse)
def plan_chat(
    student_id: UUID,
    body: PlanChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Counsellor AI chat: send a natural-language instruction to edit the plan.
    Requires AI_API_KEY env var; returns 503 if not configured.
    Rate-limited to 20 requests per counsellor per plan per day.
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this student")
    return plan_chat_handle(db, plan, body.message, current_user.id)


# ---------------------------------------------------------------------------
# PATCH /students/{student_id}/plan/template  (Point 17)
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/plan/template", response_model=PlanResponse)
def set_plan_template(
    student_id: UUID,
    body: SetTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change the visual template for the plan and regenerate HTML.
    template_id: 'professional' | 'modern' | 'minimal'
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this student")

    plan.template_id = body.template_id

    # Rebuild student dict for regeneration
    student_for_regen, match_results_for_regen = _load_student_and_results(db, student_id, plan)

    html_content = generate_html_plan(
        student_for_regen,
        match_results_for_regen,
        plan.action_items or [],
        plan_type="UNIVERSITY",
        template_id=plan.template_id,
        overrides=plan.overrides or {},
    )
    plan.html_content = html_content
    plan.version = (plan.version or 1) + 1
    plan.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


# ---------------------------------------------------------------------------
# PATCH /students/{student_id}/plan/section  (Point 17)
# ---------------------------------------------------------------------------

@router.patch("/{student_id}/plan/section", response_model=PlanResponse)
def edit_plan_section(
    student_id: UUID,
    body: EditSectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upsert a custom HTML override for a named section key, then regenerate.
    section_key examples: 'student_summary', 'school_0_rationale', 'action_plan_notes'
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this student")

    overrides: dict = dict(plan.overrides or {})
    safe_html = nh3.clean(body.html_content)
    overrides[body.section_key] = safe_html
    plan.overrides = overrides

    student_for_regen, match_results_for_regen = _load_student_and_results(db, student_id, plan)

    html_content = generate_html_plan(
        student_for_regen,
        match_results_for_regen,
        plan.action_items or [],
        plan_type="UNIVERSITY",
        template_id=plan.template_id or "professional",
        overrides=plan.overrides,
    )
    plan.html_content = html_content
    plan.version = (plan.version or 1) + 1
    plan.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


# ---------------------------------------------------------------------------
# DELETE /students/{student_id}/plan/section/{section_key}  (Point 17)
# ---------------------------------------------------------------------------

@router.delete("/{student_id}/plan/section/{section_key}", response_model=PlanResponse)
def reset_plan_section(
    student_id: UUID,
    section_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a section override, reverting that section to auto-generated content,
    then regenerate the plan HTML.
    """
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this student")

    overrides: dict = dict(plan.overrides or {})
    overrides.pop(section_key, None)
    plan.overrides = overrides

    student_for_regen, match_results_for_regen = _load_student_and_results(db, student_id, plan)

    html_content = generate_html_plan(
        student_for_regen,
        match_results_for_regen,
        plan.action_items or [],
        plan_type="UNIVERSITY",
        template_id=plan.template_id or "professional",
        overrides=plan.overrides,
    )
    plan.html_content = html_content
    plan.version = (plan.version or 1) + 1
    plan.generated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(plan)
    return PlanResponse.model_validate(plan)


# ---------------------------------------------------------------------------
# Internal helper: load student data for HTML regeneration
# ---------------------------------------------------------------------------

def _load_student_and_results(db: Session, student_id: UUID, plan: AcademicPlan):
    """
    Build a student dict and match_results list for HTML regeneration.
    Falls back to minimal data if student is missing.
    """
    student_for_regen: dict = {
        "name": "",
        "subject_grades": [],
        "ielts_score": None,
        "extra_curricular": [],
        "awards": [],
    }
    match_results_for_regen = plan.recommended_schools or []

    try:
        student_orm = db.query(Student).filter(Student.id == student_id).first()
        if student_orm:
            student_data = build_student_data(student_orm, db)
            student_for_regen = build_student_dict_for_plan(student_orm, student_data)
    except Exception as exc:
        logger.warning("Failed to load student data for regeneration: %s", exc)

    return student_for_regen, match_results_for_regen


# ---------------------------------------------------------------------------
# GET /students/{student_id}/plan/export-pdf
# ---------------------------------------------------------------------------

@router.get("/{student_id}/plan/export-pdf")
def export_plan_pdf(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export current plan as PDF."""
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan or not plan.html_content:
        raise HTTPException(status_code=404, detail="No plan found")

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=plan.html_content).write_pdf()
        student = db.query(Student).filter(Student.id == student_id).first()
        filename = f"plan-{(student.name or 'student').replace(' ', '_')}-v{plan.version or 1}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception:
        # Fallback: return HTML for browser print-to-PDF
        return Response(content=plan.html_content, media_type="text/html")


# ---------------------------------------------------------------------------
# GET /students/{student_id}/plans/history/{plan_id}/export-pdf
# ---------------------------------------------------------------------------

@router.get("/{student_id}/plans/history/{plan_id}/export-pdf")
def export_plan_history_pdf(
    student_id: UUID,
    plan_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export a historical plan version as PDF."""
    plan = db.query(PlanHistory).filter(
        PlanHistory.id == plan_id,
        PlanHistory.student_id == student_id,
    ).first()
    if not plan or not plan.html_content:
        raise HTTPException(status_code=404, detail="Plan version not found")

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=plan.html_content).write_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="plan-v{plan.version or 0}.pdf"'},
        )
    except Exception:
        return Response(content=plan.html_content, media_type="text/html")
