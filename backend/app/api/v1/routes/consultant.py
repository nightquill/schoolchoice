"""
app/api/v1/routes/consultant.py

Consultant task API endpoints: SSE stream, save with validation, and status.
Uses TaskEngine for YAML-driven task execution with call_ai_stream() for live
streaming and Jinja2 HTML rendering on save.
"""
from __future__ import annotations

import html
import json
import logging
import uuid as _uuid_mod
from datetime import datetime, timedelta, timezone
from typing import Any

import jsonschema
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session

from app.core.ai_service import call_ai_stream
from app.core.dependencies import get_current_user, get_current_user_or_query_token
from app.db.models import User
from app.db.session import get_db
from app.platform.task_engine import TaskEngine
from app.db.models_v2 import AcademicPlan
from app.modules.school_choice.services import plan_chat_service
from app.platform.schemas.consultant_output import (
    ConsultantChatRequest,
    ConsultantPlanOutput,
    ConsultantSaveRequest,
    ConsultantTaskResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consultant", tags=["consultant"])

# ---------------------------------------------------------------------------
# Rate limiting helper
# ---------------------------------------------------------------------------

_RATE_LIMIT_MAX = 20
_RATE_LIMIT_WINDOW_HOURS = 24


def _to_uuid(val: str) -> _uuid_mod.UUID:
    """Convert a string to UUID, raising 400 if invalid."""
    try:
        return _uuid_mod.UUID(val)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail=f"Invalid entity_id: {val}")


def _verify_student_ownership(db: Session, entity_id: str, user: User) -> None:
    """
    Verify the current user owns the student identified by entity_id.
    Raises HTTP 403 if the student does not belong to the user.
    Organisation-aware: if the user has an active_organisation_id, also
    accept students belonging to that organisation.
    """
    from app.modules.school_choice.models.models import Student

    student = db.query(Student).filter(Student.id == _to_uuid(entity_id)).first()
    if not student:
        raise HTTPException(status_code=403, detail="Access denied")

    org_id = getattr(user, "active_organisation_id", None)
    if org_id and getattr(student, "organisation_id", None) == org_id:
        return  # Organisation-scoped access granted

    if student.user_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")


def _check_consultant_rate_limit(db: Session, entity_id: str, user_id: Any) -> None:
    """
    Enforce a rolling 24-hour rate limit of 20 requests per entity per user.
    Uses a simple in-memory-like pattern stored on the AcademicPlan row
    (chat_request_counts JSON column).

    Raises HTTPException(429) if the limit is exceeded.
    """

    plan = db.query(AcademicPlan).filter(
        AcademicPlan.student_id == _to_uuid(entity_id)
    ).first()
    if not plan:
        # No plan row yet -- no rate limit to enforce
        return

    key = f"consultant:{user_id}:{entity_id}"
    counts: dict = dict(plan.chat_request_counts or {})
    entry = counts.get(key, {"count": 0, "window_start": None})

    now = datetime.now(timezone.utc)
    window_start_str = entry.get("window_start")

    if window_start_str:
        window_start = datetime.fromisoformat(window_start_str)
        if now - window_start > timedelta(hours=_RATE_LIMIT_WINDOW_HOURS):
            # Reset window
            entry = {"count": 0, "window_start": now.isoformat()}
    else:
        entry["window_start"] = now.isoformat()

    if entry["count"] >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=429,
            detail="Daily limit of 20 AI chat requests reached for this plan.",
        )

    entry["count"] += 1
    counts[key] = entry
    plan.chat_request_counts = counts
    db.commit()


# ---------------------------------------------------------------------------
# Endpoint 1: SSE stream
# ---------------------------------------------------------------------------

@router.get("/tasks/{task_id}/stream")
async def stream_consultant_task(
    task_id: str,
    entity_id: str = Query(...),
    force: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_or_query_token),
) -> StreamingResponse:
    """
    Stream AI-generated consultant output via SSE.

    Uses GET (not POST) because EventSource is GET-only (RESEARCH.md A1).
    Accepts auth token from query param for EventSource compatibility.

    LLM call discipline:
    - If a plan already exists and student data has not changed since it was
      generated, return 409 Conflict instead of making a redundant LLM call.
    - Pass ?force=true to override and regenerate anyway.
    """
    # Ownership check
    _verify_student_ownership(db, entity_id, current_user)

    # Graduated student guard
    from app.modules.school_choice.models.models import Student
    student_check = db.query(Student).filter(Student.id == _to_uuid(entity_id)).first()
    if student_check and getattr(student_check, "is_graduated", False):
        raise HTTPException(
            status_code=400,
            detail="Cannot generate a plan for a graduated student.",
        )

    # Rate limit check
    _check_consultant_rate_limit(db, entity_id, current_user.id)

    # ── Staleness guard: skip LLM call if plan is still current ──
    if not force:
        existing_plan = db.query(AcademicPlan).filter(
            AcademicPlan.student_id == _to_uuid(entity_id)
        ).first()
        if existing_plan and existing_plan.html_content and existing_plan.generated_at:
            # Compute a fingerprint of the student's current grade data
            from app.services.student_data_builder import build_student_data
            from app.modules.school_choice.models.models import Student
            import hashlib

            student = db.query(Student).filter(Student.id == _to_uuid(entity_id)).first()
            if student:
                student_data = build_student_data(student, db)
                # Hash the grade + interest data to detect changes
                fingerprint_src = json.dumps({
                    "grades": student_data.get("grades_by_code", {}),
                    "best5": student_data.get("best5_aggregate", 0),
                    "interests": student_data.get("interests", []),
                    "ielts": student_data.get("ielts_score"),
                    "electives": student_data.get("elective_codes", []),
                }, sort_keys=True)
                current_fingerprint = hashlib.sha256(fingerprint_src.encode()).hexdigest()[:16]

                # Check if plan was generated with the same fingerprint
                plan_meta = existing_plan.overrides or {}
                stored_fingerprint = plan_meta.get("_data_fingerprint")

                if stored_fingerprint == current_fingerprint:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Plan is already up to date — student data has not changed since "
                            f"last generation (v{existing_plan.version}). "
                            "Use ?force=true to regenerate, or use the AI chat to modify the existing plan."
                        ),
                    )

    # Load task definition
    engine = TaskEngine()
    try:
        task_def = engine.load_task(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Build messages (resolves data slots, renders templates)
    try:
        messages = engine.build_messages(task_def, entity_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return StreamingResponse(
        call_ai_stream(
            messages,
            max_tokens=task_def.max_tokens,
            temperature=task_def.temperature,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Endpoint 2: Status
# ---------------------------------------------------------------------------

@router.get("/tasks/{task_id}/status")
def get_consultant_task_status(
    task_id: str,
    entity_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Return the current plan state for the given entity.
    """
    # Ownership check
    _verify_student_ownership(db, entity_id, current_user)

    plan = db.query(AcademicPlan).filter(
        AcademicPlan.student_id == _to_uuid(entity_id)
    ).first()

    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this entity.")

    return {
        "id": str(plan.id),
        "version": plan.version,
        "generated_at": plan.generated_at.isoformat() if plan.generated_at else None,
        "has_content": plan.html_content is not None,
        "template_id": plan.template_id,
    }


# ---------------------------------------------------------------------------
# HTML rendering helper
# ---------------------------------------------------------------------------

def _render_plan_html(
    task_def: Any,
    validated_output: dict,
    template_name: str | None = None,
) -> str:
    """
    Render consultant plan output as HTML using the Jinja2 template
    specified by the task definition.
    """
    from pathlib import Path

    backend_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    template_dirs = [
        str(backend_root / "app" / "platform" / "templates"),
        str(backend_root / "app" / "modules" / "school_choice" / "templates"),
    ]

    env = Environment(
        loader=FileSystemLoader(template_dirs),
        autoescape=True,
    )
    # Keep html_escape filter for backward compat; with autoescape=True it's
    # redundant on normal variables but harmless.
    # Wrap html.escape to handle None values gracefully (AI output often has null fields).
    env.filters["html_escape"] = lambda s: html.escape(str(s)) if s is not None else ""

    tpl_name = template_name or task_def.jinja2_template
    template = env.get_template(tpl_name)

    return template.render(**validated_output)


# ---------------------------------------------------------------------------
# Endpoint 3: Save
# ---------------------------------------------------------------------------

@router.post("/tasks/{task_id}/save", status_code=status.HTTP_200_OK)
def save_consultant_task(
    task_id: str,
    body: ConsultantSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConsultantTaskResponse:
    """
    Validate AI output, apply confidence guardrail, render HTML, persist to DB.
    """
    # Ownership check
    _verify_student_ownership(db, body.entity_id, current_user)

    # Parse raw JSON from frontend SSE buffer
    try:
        parsed_json = json.loads(body.ai_output_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid JSON in ai_output_json: {exc}",
        )

    # Load task definition for schema validation
    engine = TaskEngine()
    try:
        task_def = engine.load_task(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Validate against task output_schema via jsonschema
    try:
        jsonschema.validate(instance=parsed_json, schema=task_def.output_schema)
    except jsonschema.ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"AI output failed schema validation: {exc.message}",
        )

    # Validate via Pydantic for semantic checks
    try:
        validated = ConsultantPlanOutput(**parsed_json)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"AI output failed semantic validation: {exc}",
        )

    # Confidence guardrail: downgrade AI tier if higher than code-computed tier
    _apply_confidence_guardrail(validated, body.entity_id, db)

    # Convert validated output to dict for DB storage
    output_dict = validated.model_dump()

    # Render HTML via plan_generator (rich layout with charts, Gantt, gap tables)
    # instead of the simpler Jinja2 template — single rendering pipeline for all plans.
    from app.modules.school_choice.models.models import Student
    from app.db.models_v2 import Subject, StudentSubjectGrade
    from app.modules.school_choice.services.hkdse_service import grade_to_int
    from app.modules.school_choice.services.plan_generator import generate_html_plan

    student = db.query(Student).filter(Student.id == _to_uuid(body.entity_id)).first()
    student_dict = {"name": "Student", "subject_grades": [], "ielts_score": None, "extra_curricular": [], "awards": []}
    if student:
        grade_records = getattr(student, "subject_grades") or []
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
        student_dict = {
            "name": student.name,
            "year_of_study": getattr(student, "year_of_study", None),
            "subject_grades": subject_grades_for_plan,
            "ielts_score": getattr(student, "ielts_score", None),
            "extra_curricular": getattr(student, "extra_curricular", None) or [],
            "awards": getattr(student, "awards", None) or [],
        }

    # Map AI recommended_schools to match_result-like dicts for plan_generator
    ai_schools = output_dict.get("recommended_schools") or []
    match_results_for_render = []
    for s in ai_schools:
        match_results_for_render.append({
            "school_name": s.get("school_name", ""),
            "fit_score": s.get("fit_score", 0.0),
            "eligibility_pass": True,
            "rationale": s.get("rationale", ""),
            "failing_criteria": [],
            "component_scores": {},
            "shap_explanation": None,
            "required_subjects": [],
            "intended_majors": [],
            "major_name": None,
            "major_jupas_code": s.get("jupas_code"),
        })

    # Map AI action_plan to action_items format
    ai_actions = output_dict.get("action_plan") or []
    action_items_for_render = []
    for a in ai_actions:
        action_items_for_render.append({
            "task": a.get("task", ""),
            "deadline": a.get("deadline") or "General",
            "priority": a.get("priority", "Medium"),
            "related_school": "General",
        })

    # Also map action_items from per-school action_items
    for s in ai_schools:
        school_name = s.get("school_name", "")
        for action in (s.get("action_items") or []):
            action_items_for_render.append({
                "task": action,
                "deadline": "",
                "priority": "Medium",
                "related_school": school_name,
            })

    html_content = generate_html_plan(
        student_dict,
        match_results_for_render,
        action_items_for_render,
        plan_type="UNIVERSITY",
        ai_assessment=output_dict.get("student_summary"),
        skill_gaps=output_dict.get("skill_gaps"),
        counselor_notes=output_dict.get("counselor_notes"),
    )

    # Load or create AcademicPlan row
    plan = db.query(AcademicPlan).filter(
        AcademicPlan.student_id == _to_uuid(body.entity_id)
    ).first()

    if not plan:
        plan = AcademicPlan(
            id=_uuid_mod.uuid4(),
            student_id=_to_uuid(body.entity_id),
            version=1,
        )
        db.add(plan)
    else:
        plan.version = (plan.version or 1) + 1

    plan.html_content = html_content
    plan.recommended_schools = output_dict.get("recommended_schools")
    plan.action_items = output_dict.get("action_plan")
    plan.generated_at = datetime.now(timezone.utc)
    plan.updated_at = datetime.now(timezone.utc)

    # Store data fingerprint so the staleness guard can detect unchanged data
    import hashlib
    from app.services.student_data_builder import build_student_data
    from app.modules.school_choice.models.models import Student

    student = db.query(Student).filter(Student.id == _to_uuid(body.entity_id)).first()
    if student:
        student_data = build_student_data(student, db)
        fingerprint_src = json.dumps({
            "grades": student_data.get("grades_by_code", {}),
            "best5": student_data.get("best5_aggregate", 0),
            "interests": student_data.get("interests", []),
            "ielts": student_data.get("ielts_score"),
            "electives": student_data.get("elective_codes", []),
        }, sort_keys=True)
        current_fp = hashlib.sha256(fingerprint_src.encode()).hexdigest()[:16]
        overrides = dict(plan.overrides or {})
        overrides["_data_fingerprint"] = current_fp
        plan.overrides = overrides

    # Also write to PlanHistory so the Plans tab shows it
    from app.db.models_v2 import PlanHistory
    history_label = f"Plan v{plan.version} — {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    history_entry = PlanHistory(
        student_id=_to_uuid(body.entity_id),
        version=plan.version,
        plan_label=history_label,
        html_content=html_content,
        recommended_schools=output_dict.get("recommended_schools"),
        action_items=output_dict.get("action_plan"),
        snapshot_data={
            "student_summary": output_dict.get("student_summary", ""),
            "skill_gaps": output_dict.get("skill_gaps", []),
        },
        generated_at=datetime.now(timezone.utc),
    )
    db.add(history_entry)

    db.commit()
    db.refresh(plan)

    return ConsultantTaskResponse(
        id=str(plan.id),
        version=plan.version,
        html_content=plan.html_content,
        recommended_schools=plan.recommended_schools,
        action_items=plan.action_items,
    )


# ---------------------------------------------------------------------------
# Endpoint 4: Chat (modify existing plan via AI)
# ---------------------------------------------------------------------------


@router.post("/tasks/{task_id}/chat")
def consultant_chat(
    task_id: str,
    body: ConsultantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Accept a natural-language message to modify an existing consultant plan.
    Delegates to plan_chat_service.handle_chat() which calls AI, applies patch,
    regenerates HTML, and persists. Returns {message, plan_id, version, html_content}.
    """
    # Validate entity_id is a real UUID
    entity_uuid = _to_uuid(body.entity_id)

    # Ownership check
    _verify_student_ownership(db, body.entity_id, current_user)

    # Rate limit is handled inside plan_chat_service.handle_chat() --
    # do NOT duplicate it here (was double-counting: 1 request = 2 slots).

    # Load existing plan
    plan = db.query(AcademicPlan).filter(
        AcademicPlan.student_id == entity_uuid
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No plan found for this entity.")

    # Delegate to existing plan_chat_service
    result = plan_chat_service.handle_chat(db, plan, body.message, current_user.id)

    return {
        "message": result.message,
        "plan_id": result.plan_id,
        "version": result.version,
        "html_content": result.html_content,
    }


def _apply_confidence_guardrail(
    validated: ConsultantPlanOutput,
    entity_id: str,
    db: Session,
) -> None:
    """
    Compare AI-returned confidence_tier against code-computed tier via
    compute_data_completeness(). Downgrade AI tier if inflated. Never upgrade.
    """
    try:
        from app.modules.school_choice.services.matchmaker_v2 import compute_data_completeness

        # Build minimal student data dict for completeness check
        from app.modules.school_choice.models.models import Student, StudentSubjectGrade, Subject

        student = db.query(Student).filter(Student.id == entity_id).first()
        if not student:
            return  # Cannot compute -- skip guardrail

        grade_records = getattr(student, "subject_grades", None) or []
        grades_by_code = {}
        for g in grade_records:
            subj = db.query(Subject).filter(Subject.id == g.subject_id).first()
            if subj:
                grades_by_code[subj.code] = g.raw_grade or g.predicted_grade

        completeness = compute_data_completeness({"grades_by_code": grades_by_code})

        # Determine code-computed tier
        if completeness > 0.7:
            code_tier = "HIGH"
        elif completeness > 0.4:
            code_tier = "MEDIUM"
        else:
            code_tier = "LOW"

        tier_rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

        for school in validated.recommended_schools:
            ai_rank = tier_rank.get(school.confidence_tier, 0)
            code_rank = tier_rank.get(code_tier, 0)
            if ai_rank > code_rank:
                logger.info(
                    "Confidence guardrail: downgrading %s from %s to %s",
                    school.school_name,
                    school.confidence_tier,
                    code_tier,
                )
                school.confidence_tier = code_tier
    except (ImportError, AttributeError) as exc:
        logger.warning("Confidence guardrail skipped (expected): %s", exc)
    except Exception as exc:
        logger.error("Confidence guardrail unexpected failure: %s", exc, exc_info=True)
        raise
