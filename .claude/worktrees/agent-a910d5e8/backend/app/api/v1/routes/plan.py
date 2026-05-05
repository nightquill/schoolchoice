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
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, User
from app.db.models_v2 import AcademicPlan, PlanGenerationJob, PlanHistory, StudentSchoolTarget, Subject
from app.db.session import SessionLocal, get_db
from app.schemas.v2.plan import PlanGenerateRequest, PlanHistoryItem, PlanHistoryResponse, PlanJobResponse, PlanResponse, PlanStatusResponse
from app.schemas.v2.plan_chat import PlanChatRequest, PlanChatResponse
from app.schemas.v2.plan_edit import EditSectionRequest, SetTemplateRequest
from app.services import student_service, plan_chat_service
from app.services.hkdse_service import grade_to_int
from app.services.matchmaker_v2 import run_matching
from app.services.plan_generator import _build_action_items, generate_html_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/students", tags=["plan-v2"])

_TIMEOUT_SECONDS = int(os.environ.get("PLAN_GENERATION_TIMEOUT_SECONDS", "30"))


# ---------------------------------------------------------------------------
# Background plan generation task
# ---------------------------------------------------------------------------

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
        from app.db.models import Student
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise RuntimeError("Student not found")

        # Build grade dicts with subject name
        grade_records = getattr(student, "subject_grades") or []
        grade_dicts_for_agg = []
        subject_grades_for_plan = []
        grades_by_code: dict[str, str] = {}
        elective_codes: list[str] = []

        for g in grade_records:
            subj = db.query(Subject).filter(Subject.id == g.subject_id).first()
            if not subj:
                continue
            raw = g.raw_grade or g.predicted_grade or "U"
            numeric = grade_to_int(raw)
            grades_by_code[subj.code] = raw
            grade_dicts_for_agg.append({
                "subject_code": subj.code,
                "numeric_value": numeric,
                "is_compulsory": subj.is_compulsory,
                "category": subj.category,
            })
            if not subj.is_compulsory and subj.category != "APPLIED_LEARNING":
                elective_codes.append(subj.code)
            subject_grades_for_plan.append({
                "subject_code": subj.code,
                "subject_name": subj.name,
                "sitting": g.sitting,
                "raw_grade": g.raw_grade,
                "predicted_grade": g.predicted_grade,
                "year_of_exam": g.year_of_exam,
                "is_compulsory": subj.is_compulsory,
                "category": subj.category,
            })

        # Build student dict for plan generator
        student_dict = {
            "name": student.name,
            "year_of_study": getattr(student, "year_of_study", None),
            "subject_grades": subject_grades_for_plan,
            "ielts_score": getattr(student, "ielts_score", None),
            "extra_curricular": getattr(student, "extra_curricular", None) or [],
            "awards": getattr(student, "awards", None) or [],
        }

        # Build IELTS overall
        ielts_raw = getattr(student, "ielts_score", None)
        ielts_overall = None
        if isinstance(ielts_raw, dict):
            ielts_overall = ielts_raw.get("overall")
        elif ielts_raw is not None:
            try:
                ielts_overall = float(ielts_raw)
            except (TypeError, ValueError):
                pass

        # Extra-curricular activities
        extra = getattr(student, "extra_curricular") or []
        extra_activities: list[str] = []
        for ec in extra:
            if isinstance(ec, dict):
                extra_activities.append(ec.get("activity") or "")
            else:
                extra_activities.append(str(ec))

        awards_raw = getattr(student, "awards") or []
        award_titles: list[str] = []
        for aw in awards_raw:
            if isinstance(aw, dict):
                award_titles.append(aw.get("title") or "")

        from app.services.hkdse_service import compute_best5_aggregate
        best5 = compute_best5_aggregate(grade_dicts_for_agg)

        student_data = {
            "best5_aggregate": best5,
            "grades_by_code": grades_by_code,
            "ielts_score": ielts_overall,
            "elective_codes": elective_codes,
            "extra_curricular_activities": extra_activities,
            "award_titles": award_titles,
        }

        # Run matching against all schools
        all_schools = db.query(School).all()
        school_dicts = [
            {
                "id": str(s.id),
                "name": s.name or "",
                "minimum_entry_score": getattr(s, "minimum_entry_score", None),
                "average_admitted_score": (
                    float(s.average_admitted_score)
                    if getattr(s, "average_admitted_score", None) is not None
                    else None
                ),
                "required_subjects": getattr(s, "required_subjects", None) or [],
                "language_requirements": getattr(s, "language_requirements", None) or {},
                "notable_programs": getattr(s, "notable_programs", None) or [],
            }
            for s in all_schools
        ]

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

        # Generate HTML
        action_items = _build_action_items(student_dict, match_results)
        html_content = generate_html_plan(student_dict, match_results, action_items, plan_type=plan_type)

        # Build recommended schools list (top 5 eligible)
        eligible = [r for r in match_results if r.eligibility_pass][:5]

        # Build a map of school_id → intended_majors from existing targets
        target_major_map = {
            str(t.school_id): t.intended_majors
            for t in existing_targets
            if t.intended_majors
        }

        recommended = [
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

        # Upsert AcademicPlan
        plan = (
            db.query(AcademicPlan)
            .filter(AcademicPlan.student_id == student_id)
            .first()
        )
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

        # Save plan history snapshot
        snapshot = {
            "subject_grades": subject_grades_for_plan,
            "best5_aggregate": best5,
            "target_schools": [
                {"school_id": str(t.school_id), "student_rank": t.student_rank}
                for t in existing_targets
            ],
        }
        version_num = plan.version if plan else 1
        history_label = f"Plan v{version_num} — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        history_entry = PlanHistory(
            student_id=student_id,
            version=version_num,
            plan_label=history_label,
            html_content=html_content,
            recommended_schools=recommended,
            action_items=action_items,
            snapshot_data=snapshot,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(history_entry)

        job.status = "DONE"
        job.updated_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:
        try:
            job = db.query(PlanGenerationJob).filter(PlanGenerationJob.id == job_id).first()
            if job:
                job.status = "FAILED"
                job.error_message = str(exc)
                job.updated_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this student")
    return plan_chat_service.handle_chat(db, plan, body.message, current_user.id)


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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
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
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
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
    from app.db.models import Student
    from app.services.hkdse_service import grade_to_int

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
            grade_records = getattr(student_orm, "subject_grades") or []
            subject_grades_for_plan = []
            for g in grade_records:
                subj = db.query(Subject).filter(Subject.id == g.subject_id).first()
                if not subj:
                    continue
                subject_grades_for_plan.append({
                    "subject_code": subj.code,
                    "subject_name": subj.name,
                    "sitting": g.sitting,
                    "raw_grade": g.raw_grade,
                    "predicted_grade": g.predicted_grade,
                    "year_of_exam": g.year_of_exam,
                    "is_compulsory": subj.is_compulsory,
                    "category": subj.category,
                })
            student_for_regen = {
                "name": student_orm.name,
                "year_of_study": getattr(student_orm, "year_of_study", None),
                "subject_grades": subject_grades_for_plan,
                "ielts_score": getattr(student_orm, "ielts_score", None),
                "extra_curricular": getattr(student_orm, "extra_curricular", None) or [],
                "awards": getattr(student_orm, "awards", None) or [],
            }
    except Exception as exc:
        logger.warning("Failed to load student data for regeneration: %s", exc)

    return student_for_regen, match_results_for_regen
