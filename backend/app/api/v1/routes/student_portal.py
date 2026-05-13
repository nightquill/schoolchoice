"""
Student Portal API — student-facing endpoints for grades, choices, submission, and match scores.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_student
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.models import (
    JupasProgramme,
    Student,
    StudentSubjectGrade,
    Subject,
)
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/student", tags=["student-portal"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ChoiceItem(BaseModel):
    rank: int
    jupas_code: str
    programme_name: str
    school_name: str | None = None
    notes: str | None = None


class ChoicesPayload(BaseModel):
    choices: list[ChoiceItem]


# ---------------------------------------------------------------------------
# 1. GET /student/grades
# ---------------------------------------------------------------------------

@router.get("/grades")
def get_student_grades(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Return read-only grades for the authenticated student."""
    rows = (
        db.query(StudentSubjectGrade, Subject)
        .join(Subject, StudentSubjectGrade.subject_id == Subject.id)
        .filter(StudentSubjectGrade.student_id == user.student_id)
        .all()
    )
    grades = []
    for grade, subject in rows:
        grades.append({
            "subject_code": subject.code,
            "subject_name": subject.name,
            "sitting": grade.sitting,
            "year_of_exam": grade.year_of_exam,
            "raw_grade": grade.raw_grade,
            "predicted_grade": grade.predicted_grade,
        })
    return {"grades": grades}


# ---------------------------------------------------------------------------
# 2. GET /student/choices
# ---------------------------------------------------------------------------

@router.get("/choices")
def get_student_choices(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Return current draft/pending/revision_requested submission."""
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == user.student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission:
        return {"submission": None}
    return {
        "submission": {
            "id": str(submission.id),
            "status": submission.status,
            "choices": submission.choices,
            "counsellor_notes": submission.counsellor_notes,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "reviewed_at": submission.reviewed_at.isoformat() if submission.reviewed_at else None,
        }
    }


# ---------------------------------------------------------------------------
# 3. PUT /student/choices
# ---------------------------------------------------------------------------

@router.put("/choices")
def save_student_choices(
    payload: ChoicesPayload,
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Save choices as draft or revision. Blocks if submission is pending."""
    choices = payload.choices

    # Validate: max 25 choices
    if len(choices) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 choices allowed")

    # Validate: no duplicate jupas_codes
    codes = [c.jupas_code for c in choices]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=400, detail="Duplicate jupas_codes not allowed")

    # Validate: all jupas_codes exist
    existing_codes = {
        row[0]
        for row in db.query(JupasProgramme.jupas_code)
        .filter(JupasProgramme.jupas_code.in_(codes))
        .all()
    }
    missing = set(codes) - existing_codes
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown jupas_codes: {sorted(missing)}",
        )

    # Find existing editable submission
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )

    # Block if there is a pending submission
    pending = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(
            status_code=409,
            detail="Cannot edit choices while a submission is pending review",
        )

    choices_json = [c.model_dump() for c in choices]

    if submission:
        submission.choices = choices_json
        submission.updated_at = datetime.now(timezone.utc)
    else:
        submission = StudentChoiceSubmission(
            student_id=user.student_id,
            status="draft",
            choices=choices_json,
        )
        db.add(submission)

    db.commit()
    db.refresh(submission)

    return {
        "id": str(submission.id),
        "status": submission.status,
        "choices": submission.choices,
    }


# ---------------------------------------------------------------------------
# 4. POST /student/choices/submit
# ---------------------------------------------------------------------------

@router.post("/choices/submit")
def submit_choices(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Submit draft/revision_requested submission for counsellor approval."""
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="No draft or revision-requested submission found")

    if not submission.choices:
        raise HTTPException(status_code=400, detail="Cannot submit empty choices")

    submission.status = "pending"
    submission.submitted_at = datetime.now(timezone.utc)
    submission.counsellor_notes = None  # Clear previous notes on resubmit
    submission.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)

    return {"id": str(submission.id), "status": "pending"}


# ---------------------------------------------------------------------------
# 5. GET /student/choices/match
# ---------------------------------------------------------------------------

@router.get("/choices/match")
def get_match_scores(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Real-time match scores for each choice in the current submission."""
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == user.student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission or not submission.choices:
        return {"scores": []}

    # Build student grades dict: subject_code -> grade string
    grade_rows = (
        db.query(StudentSubjectGrade, Subject)
        .join(Subject, StudentSubjectGrade.subject_id == Subject.id)
        .filter(StudentSubjectGrade.student_id == user.student_id)
        .all()
    )
    student_grades: dict[str, str] = {}
    for grade, subject in grade_rows:
        raw = grade.raw_grade or grade.predicted_grade
        if raw:
            student_grades[subject.code] = raw

    has_grades = len(student_grades) > 0

    scores: list[dict[str, Any]] = []
    for choice in submission.choices:
        jupas_code = choice.get("jupas_code") if isinstance(choice, dict) else getattr(choice, "jupas_code", None)
        if not jupas_code:
            continue

        if not has_grades:
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": "No grade data",
            })
            continue

        programme = (
            db.query(JupasProgramme)
            .filter(JupasProgramme.jupas_code == jupas_code)
            .first()
        )
        if not programme:
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": f"Programme {jupas_code} not found",
            })
            continue

        programme_dict = {
            "jupas_code": programme.jupas_code,
            "name": programme.name,
            "scoring_formula": programme.scoring_formula or {},
            "minimum_requirements": programme.minimum_requirements or {},
            "admission_stats": programme.admission_stats or {},
        }

        try:
            result = score_student_for_programme(student_grades, programme_dict)
            scores.append({
                "jupas_code": jupas_code,
                "match_score": result.get("admission_probability"),
                "eligible": result.get("eligible", result.get("meets_requirements")),
                "risk_level": result.get("risk_level"),
            })
        except Exception as exc:
            logger.warning("Scoring failed for %s: %s", jupas_code, exc)
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": "Scoring error",
            })

    return {"scores": scores}
