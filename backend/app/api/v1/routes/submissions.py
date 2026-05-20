"""
Counsellor Submission Review API — list, detail, approve, revise, reject.

Endpoints for counsellors to review student JUPAS choice submissions,
score them against programmes, and convert approved choices into targets.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import OrganisationMembership, User
from app.db.session import get_db
from app.modules.school_choice.models.models import (
    JupasProgramme,
    Student,
    StudentSchoolTarget,
)
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submissions", tags=["submissions"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class FlaggedChoice(BaseModel):
    rank: int
    note: str = ""


class ReviseRequest(BaseModel):
    notes: str
    flagged_choices: list[FlaggedChoice] = []


class RejectRequest(BaseModel):
    reason: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BAND_MAP = {
    range(1, 4): "A",   # rank 1-3
    range(4, 7): "B",   # rank 4-6
    range(7, 11): "C",  # rank 7-10
    range(11, 15): "D", # rank 11-14
    range(15, 26): "E", # rank 15-25
}

_BAND_CONFIDENCE = {"A": 5, "B": 4, "C": 3, "D": 2, "E": 1}


def _rank_to_band(rank: int) -> str:
    for r, band in _BAND_MAP.items():
        if rank in r:
            return band
    return "E"


def _resolve_org_id(db: Session, user: User):
    """Resolve the user's active organisation ID."""
    org_id = getattr(user, "active_organisation_id", None)
    if not org_id:
        mem = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == user.id).first()
        org_id = mem.organisation_id if mem else None
    return org_id


def _get_submission_or_404(db: Session, submission_id: UUID, user: User | None = None) -> StudentChoiceSubmission:
    sub = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.id == submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    # Org isolation: verify the submission's student belongs to user's org
    if user:
        org_id = _resolve_org_id(db, user)
        if org_id:
            student = db.query(Student).filter(
                Student.id == sub.student_id, Student.organisation_id == org_id
            ).first()
            if not student:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return sub


def _build_student_grades(student: Student, db: Session) -> dict[str, str]:
    """Build {subject_code: grade} dict for JUPAS scoring. Uses best grade per subject."""
    from app.services.student_data_builder import build_student_data
    data = build_student_data(student, db)
    return data.get("grades_by_code", {})


# ---------------------------------------------------------------------------
# 1. GET /submissions — list pending submissions for counsellor's org
# ---------------------------------------------------------------------------

@router.get("")
def list_submissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = getattr(user, "active_organisation_id", None)

    query = (
        db.query(StudentChoiceSubmission, Student)
        .join(Student, StudentChoiceSubmission.student_id == Student.id)
        .filter(StudentChoiceSubmission.status == "pending")
    )
    if org_id:
        query = query.filter(Student.organisation_id == org_id)

    rows = query.order_by(StudentChoiceSubmission.submitted_at.desc()).all()

    submissions = []
    for sub, student in rows:
        choices = sub.choices if sub.choices else []
        submissions.append({
            "id": str(sub.id),
            "student_id": str(sub.student_id),
            "student_name": student.name,
            "class_name": student.class_name,
            "status": sub.status,
            "choice_count": len(choices),
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        })

    return {"submissions": submissions, "total": len(submissions)}


# ---------------------------------------------------------------------------
# 1b. GET /submissions/student/{student_id} — all submissions for a student
# ---------------------------------------------------------------------------

@router.get("/student/{student_id}")
def list_student_submissions(
    student_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All submissions for a specific student (teacher view). Newest first."""
    # --- Org isolation: verify student belongs to user's org ---
    org_id = getattr(user, "active_organisation_id", None)
    if not org_id:
        mem = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == user.id).first()
        org_id = mem.organisation_id if mem else None
    if org_id:
        student = db.query(Student).filter(Student.id == student_id, Student.organisation_id == org_id).first()
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    subs = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .all()
    )
    return {
        "submissions": [
            {
                "id": str(s.id),
                "status": s.status,
                "choices": s.choices,
                "counsellor_notes": s.counsellor_notes,
                "flagged_choices": s.flagged_choices,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ]
    }


# ---------------------------------------------------------------------------
# 2. GET /submissions/{submission_id} — detail with match scores
# ---------------------------------------------------------------------------

@router.get("/{submission_id}")
def get_submission_detail(
    submission_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(db, submission_id, user)
    student = db.query(Student).filter(Student.id == sub.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student_grades = _build_student_grades(student, db)
    choices_raw = sub.choices if sub.choices else []

    choices_out: list[dict[str, Any]] = []
    for choice in choices_raw:
        rank = choice.get("rank", 0)
        jupas_code = choice.get("jupas_code", "")
        programme_name = choice.get("programme_name", "")
        notes = choice.get("notes", "")
        band = _rank_to_band(rank)

        match_score = None
        risk_level = None

        programme = db.query(JupasProgramme).filter(
            JupasProgramme.jupas_code == jupas_code
        ).first()

        if programme and student_grades:
            prog_dict = {
                "jupas_code": programme.jupas_code,
                "name": programme.name,
                "scoring_formula": programme.scoring_formula or {},
                "minimum_requirements": programme.minimum_requirements or {},
                "admission_stats": programme.admission_stats or {},
            }
            try:
                result = score_student_for_programme(student_grades, prog_dict)
                match_score = result.get("admission_probability")
                risk_level = result.get("risk_level", "unknown")
            except Exception:
                logger.warning("Scoring failed for %s / %s", jupas_code, student.id, exc_info=True)

        if programme and not programme_name:
            programme_name = programme.name

        choices_out.append({
            "rank": rank,
            "band": band,
            "jupas_code": jupas_code,
            "programme_name": programme_name,
            "match_score": match_score,
            "risk_level": risk_level,
            "notes": notes,
        })

    return {
        "id": str(sub.id),
        "student_id": str(sub.student_id),
        "student_name": student.name,
        "class_name": student.class_name,
        "status": sub.status,
        "choices": choices_out,
        "counsellor_notes": sub.counsellor_notes,
        "flagged_choices": sub.flagged_choices,
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
    }


# ---------------------------------------------------------------------------
# 3. POST /submissions/{submission_id}/approve — approve + create targets
# ---------------------------------------------------------------------------

@router.post("/{submission_id}/approve")
def approve_submission(
    submission_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(db, submission_id, user)

    if sub.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve submission with status '{sub.status}'",
        )

    student = db.query(Student).filter(Student.id == sub.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    student_grades = _build_student_grades(student, db)
    choices = sub.choices if sub.choices else []
    targets_created = 0

    for choice in choices:
        rank = choice.get("rank", 0)
        jupas_code = choice.get("jupas_code", "")
        programme_name = choice.get("programme_name", "")
        band = _rank_to_band(rank)
        confidence = _BAND_CONFIDENCE.get(band, 3)

        programme = db.query(JupasProgramme).filter(
            JupasProgramme.jupas_code == jupas_code
        ).first()

        if not programme:
            logger.warning("Programme %s not found, skipping target creation", jupas_code)
            continue

        if not programme_name:
            programme_name = programme.name

        school_id = programme.school_id
        if not school_id:
            logger.warning("Programme %s has no school_id, skipping", jupas_code)
            continue

        # Run JUPAS scoring
        match_score_val = None
        eligibility = None
        at_risk = False
        prog_dict = {
            "jupas_code": programme.jupas_code,
            "name": programme.name,
            "scoring_formula": programme.scoring_formula or {},
            "minimum_requirements": programme.minimum_requirements or {},
            "admission_stats": programme.admission_stats or {},
        }
        if student_grades:
            try:
                result = score_student_for_programme(student_grades, prog_dict)
                match_score_val = result.get("admission_probability")
                eligibility = result.get("eligible", True)
                at_risk = result.get("risk_level") == "at_risk"
            except Exception:
                logger.warning("Scoring failed for %s during approve", jupas_code, exc_info=True)

        # Upsert by (student_id, jupas_code)
        existing = db.query(StudentSchoolTarget).filter(
            StudentSchoolTarget.student_id == student.id,
            StudentSchoolTarget.jupas_code == jupas_code,
        ).first()

        if existing:
            existing.school_id = school_id
            existing.student_rank = rank
            existing.programme_name = programme_name
            existing.preference_confidence = confidence
            existing.intended_majors = [programme_name]
            existing.match_score = match_score_val
            existing.eligibility_pass = eligibility
            existing.at_risk = at_risk
            existing.status = "CONSIDERING"
        else:
            target = StudentSchoolTarget(
                student_id=student.id,
                school_id=school_id,
                jupas_code=jupas_code,
                programme_name=programme_name,
                student_rank=rank,
                preference_confidence=confidence,
                intended_majors=[programme_name],
                match_score=match_score_val,
                eligibility_pass=eligibility,
                at_risk=at_risk,
                status="CONSIDERING",
            )
            db.add(target)

        targets_created += 1

    sub.status = "approved"
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = user.id

    db.commit()

    return {"status": "approved", "targets_created": targets_created}


# ---------------------------------------------------------------------------
# 4. POST /submissions/{submission_id}/revise — send back with notes
# ---------------------------------------------------------------------------

@router.post("/{submission_id}/revise")
def revise_submission(
    submission_id: UUID,
    body: ReviseRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(db, submission_id, user)

    if sub.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revise submission with status '{sub.status}'",
        )

    sub.status = "revision_requested"
    sub.counsellor_notes = body.notes
    sub.flagged_choices = [fc.model_dump() for fc in body.flagged_choices] if body.flagged_choices else None
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = user.id

    db.commit()

    return {"status": "revision_requested"}


# ---------------------------------------------------------------------------
# 5. POST /submissions/{submission_id}/reject — reject with reason
# ---------------------------------------------------------------------------

@router.post("/{submission_id}/reject")
def reject_submission(
    submission_id: UUID,
    body: RejectRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_submission_or_404(db, submission_id, user)

    if sub.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject submission with status '{sub.status}'",
        )

    sub.status = "rejected"
    sub.counsellor_notes = body.reason
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = user.id

    db.commit()

    return {"status": "rejected"}
