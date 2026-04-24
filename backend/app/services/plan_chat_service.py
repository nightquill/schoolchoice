"""
app/services/plan_chat_service.py

Counsellor AI chat service — applies natural-language edits to an academic plan
via Gemini 2.5 Flash, returning an updated plan and a summary reply.

Rate limit: 20 requests per counsellor per plan per rolling 24-hour window.
Requires GEMINI_API_KEY environment variable.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models_v2 import AcademicPlan
from app.schemas.v2.plan_chat import PlanChatResponse
from app.services.plan_generator import generate_html_plan

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an academic advisor assistant helping a counsellor edit a student's academic plan.
You will receive the current plan data as JSON and the counsellor's instruction.
You must respond with ONLY a valid JSON object specifying the exact changes to make.
The patch object may contain any of these keys:
  - "student_summary": new text for the student summary section
  - "recommended_schools[N].rationale": new rationale text for school at index N
  - "recommended_schools[N].fit_score": new float fit score for school at index N (0.0-1.0)
  - "recommended_schools[N].rank": new integer rank (reordering)
  - "action_items[N].task": updated task description
  - "action_items[N].priority": "High" | "Medium" | "Low"
  - "action_items[N].deadline": new deadline string
  - "action_items": full replacement array if items are added/removed
Respond with ONLY the JSON object. No explanation, no markdown, no code fences."""


# ---------------------------------------------------------------------------
# Rate limiting helper
# ---------------------------------------------------------------------------

def _check_and_increment_rate_limit(db: Session, plan: AcademicPlan, counsellor_id: Any) -> None:
    """
    Check rolling 24-hour rate limit (20 requests per counsellor per plan).
    Uses a window_start timestamp to implement a true rolling window rather than
    a calendar-day reset. Raises HTTP 429 if exceeded; otherwise increments counter in DB.
    """
    key = f"{counsellor_id}:{plan.id}"
    counts: dict = dict(plan.chat_request_counts or {})
    entry = counts.get(key, {"count": 0, "window_start": None})

    now = datetime.now(timezone.utc)
    window_start_str = entry.get("window_start")

    if window_start_str:
        window_start = datetime.fromisoformat(window_start_str)
        if now - window_start > timedelta(hours=24):
            # Reset window — more than 24 hours have passed
            entry = {"count": 0, "window_start": now.isoformat()}
    else:
        entry["window_start"] = now.isoformat()

    if entry["count"] >= 20:
        raise HTTPException(
            status_code=429,
            detail="Daily AI chat limit (20 requests) reached for this plan.",
        )

    entry["count"] += 1
    counts[key] = entry
    plan.chat_request_counts = counts


# ---------------------------------------------------------------------------
# Patch application
# ---------------------------------------------------------------------------

_INDEXED_KEY_RE = re.compile(r"^(recommended_schools|action_items)\[(\d+)\]\.(.+)$")


def _apply_patch(plan: AcademicPlan, patch: dict) -> None:
    """
    Apply a patch dict returned by Gemini to the AcademicPlan record.
    Mutates plan.recommended_schools and plan.action_items in-place.
    """
    recommended_schools: list = list(plan.recommended_schools or [])
    action_items: list = list(plan.action_items or [])

    for key, value in patch.items():
        # Full replacement of action_items
        if key == "action_items":
            if isinstance(value, list):
                action_items = value
            continue

        # student_summary (stored in overrides for section override support)
        if key == "student_summary":
            overrides: dict = dict(plan.overrides or {})
            overrides["student_summary"] = str(value)
            plan.overrides = overrides
            continue

        # Indexed key patterns: recommended_schools[N].field or action_items[N].field
        m = _INDEXED_KEY_RE.match(key)
        if m:
            collection_name, idx_str, field = m.group(1), m.group(2), m.group(3)
            idx = int(idx_str)
            if collection_name == "recommended_schools":
                if 0 <= idx < len(recommended_schools):
                    item = dict(recommended_schools[idx])
                    item[field] = value
                    recommended_schools[idx] = item
            elif collection_name == "action_items":
                if 0 <= idx < len(action_items):
                    item = dict(action_items[idx])
                    item[field] = value
                    action_items[idx] = item
            continue

    plan.recommended_schools = recommended_schools
    plan.action_items = action_items


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------

def handle_chat(
    db: Session,
    plan: AcademicPlan,
    message: str,
    counsellor_id: Any,
) -> PlanChatResponse:
    """
    Process one counsellor chat message:
    1. Check GEMINI_API_KEY
    2. Enforce rate limit
    3. Call Gemini with plan context + instruction
    4. Apply returned patch to plan
    5. Regenerate HTML
    6. Persist to DB
    7. Return PlanChatResponse
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI chat is not available: GEMINI_API_KEY is not configured.",
        )

    # Rate limit check (mutates plan.chat_request_counts but does not commit yet)
    _check_and_increment_rate_limit(db, plan, counsellor_id)

    # Build compact context for Gemini
    context = {
        "recommended_schools": plan.recommended_schools or [],
        "action_items": plan.action_items or [],
    }
    context_json = json.dumps(context, ensure_ascii=False, separators=(",", ":"))

    # Call Gemini
    import google.generativeai as genai  # type: ignore[import]

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(
        f"{SYSTEM_PROMPT}\n\nCurrent plan data:\n{context_json}\n\nCounsellor instruction: {message}"
    )
    raw_text: str = response.text.strip()

    # Strip markdown code fences if Gemini wraps in them despite instructions
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
        raw_text = re.sub(r"\n?```$", "", raw_text.strip())

    try:
        patch = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON: {exc}",
        )

    # Apply patch to plan
    _apply_patch(plan, patch)

    # Increment version
    plan.version = (plan.version or 1) + 1
    plan.updated_at = datetime.now(timezone.utc)

    # Regenerate HTML — build a minimal student dict from plan data for re-render
    # We need a student dict; the plan stores recommended_schools but not raw student grades.
    # We regenerate using the stored recommended_schools as match_results (dict form).
    match_results_for_regen = plan.recommended_schools or []
    student_for_regen: dict = {"name": "", "subject_grades": [], "ielts_score": None, "extra_curricular": [], "awards": []}

    # Try to load actual student data from DB for richer regeneration
    try:
        from app.db.models import Student
        from app.db.models_v2 import Subject, StudentSubjectGrade
        from app.services.hkdse_service import grade_to_int

        student_orm = db.query(Student).filter(Student.id == plan.student_id).first()
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
    except Exception:
        pass  # Fall back to minimal dict

    html_content = generate_html_plan(
        student_for_regen,
        match_results_for_regen,
        plan.action_items or [],
        plan_type="UNIVERSITY",
        template_id=plan.template_id or "professional",
        overrides=plan.overrides or {},
    )
    plan.html_content = html_content
    plan.generated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(plan)

    # Build a friendly reply summarising what changed
    changed_keys = list(patch.keys())
    if changed_keys:
        reply = f"Done. Updated: {', '.join(changed_keys)}."
    else:
        reply = "No changes were identified in your instruction. Please try again with more specific instructions."

    return PlanChatResponse(
        plan_id=str(plan.id),
        version=plan.version,
        html_content=plan.html_content,
        message=reply,
    )
