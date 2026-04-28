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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_or_query_token),
) -> StreamingResponse:
    """
    Stream AI-generated consultant output via SSE.

    Uses GET (not POST) because EventSource is GET-only (RESEARCH.md A1).
    Accepts auth token from query param for EventSource compatibility.
    """
    # Rate limit check
    _check_consultant_rate_limit(db, entity_id, current_user.id)

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
        autoescape=False,  # We use explicit html_escape filter
    )
    env.filters["html_escape"] = html.escape

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

    # Convert validated output to dict for template rendering and DB storage
    output_dict = validated.model_dump()

    # Render HTML via Jinja2 template
    html_content = _render_plan_html(task_def, output_dict)

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

    # Rate limit
    _check_consultant_rate_limit(db, body.entity_id, current_user.id)

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
