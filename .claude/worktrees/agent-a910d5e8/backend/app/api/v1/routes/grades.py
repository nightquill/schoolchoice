"""
app/api/v1/routes/grades.py

StudentSubjectGrade CRUD endpoints.
REQ-068
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.models_v2 import StudentSubjectGrade, Subject
from app.db.session import get_db
from app.schemas.v2.grades import (
    SubjectGradeCreate,
    SubjectGradeListResponse,
    SubjectGradeResponse,
    SubjectGradeUpdate,
)
from app.services import student_service
from app.services.hkdse_service import compute_predicted_grade

router = APIRouter(prefix="/students", tags=["grades-v2"])


def _get_student_grades(db: Session, student_id: UUID) -> list[StudentSubjectGrade]:
    """Return all grade records for a student."""
    return (
        db.query(StudentSubjectGrade)
        .filter(StudentSubjectGrade.student_id == student_id)
        .all()
    )


def _grade_to_dict(db: Session, grade: StudentSubjectGrade) -> dict:
    """Convert a grade ORM record to a response dict including subject name/code."""
    subject = db.query(Subject).filter(Subject.id == grade.subject_id).first()
    return {
        "id": grade.id,
        "student_id": grade.student_id,
        "subject_id": grade.subject_id,
        "subject_name": subject.name if subject else None,
        "subject_code": subject.code if subject else None,
        "year_of_exam": grade.year_of_exam,
        "sitting": grade.sitting,
        "raw_grade": grade.raw_grade,
        "predicted_grade": grade.predicted_grade,
        "transcript_uploaded": grade.transcript_uploaded,
        "notes": grade.notes,
        "created_at": grade.created_at,
        "updated_at": grade.updated_at,
    }


def _recompute_predicted(
    db: Session,
    student_id: UUID,
    subject_id: UUID,
    student: object,
) -> None:
    """
    Recompute predicted_grade for all non-OFFICIAL grades for a given subject.
    REQ-066
    """
    # Gather all non-official sittings for this subject
    sittings = (
        db.query(StudentSubjectGrade)
        .filter(
            StudentSubjectGrade.student_id == student_id,
            StudentSubjectGrade.subject_id == subject_id,
        )
        .all()
    )

    # Resolve subject code for teacher evaluation lookup
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    subject_code = subject.code if subject else None

    # Extract teacher rating if available
    teacher_rating = None
    teacher_evals = getattr(student, "teacher_evaluation") or []
    if teacher_evals and subject_code:
        for ev in teacher_evals:
            if isinstance(ev, dict) and ev.get("subject_code") == subject_code:
                teacher_rating = ev.get("rating")
                break

    # Build sittings list for hkdse_service
    sittings_data = [
        {
            "sitting_type": s.sitting,
            "raw_grade": s.raw_grade or "U",
            "year_of_exam": s.year_of_exam,
        }
        for s in sittings
    ]

    predicted = compute_predicted_grade(sittings_data, teacher_rating)

    # Update all non-OFFICIAL records with the computed predicted grade
    for s in sittings:
        if s.sitting != "OFFICIAL":
            s.predicted_grade = predicted
        else:
            s.predicted_grade = None

    db.flush()


# ---------------------------------------------------------------------------
# GET /students/{student_id}/grades
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/grades",
    response_model=SubjectGradeListResponse,
    status_code=status.HTTP_200_OK,
)
def list_grades(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all grade records for a student. REQ-068"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    grades = _get_student_grades(db, student_id)
    grade_dicts = [_grade_to_dict(db, g) for g in grades]
    return SubjectGradeListResponse(grades=grade_dicts, total=len(grade_dicts))


# ---------------------------------------------------------------------------
# POST /students/{student_id}/grades
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/grades",
    response_model=SubjectGradeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_grade(
    student_id: UUID,
    payload: SubjectGradeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a grade record and recompute predicted_grade. REQ-068"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    # Resolve subject_name → subject_id when subject_id not provided
    if payload.subject_id is None and payload.subject_name:
        subject = (
            db.query(Subject)
            .filter(Subject.name == payload.subject_name)
            .first()
        )
        if not subject:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Subject '{payload.subject_name}' not found",
            )
        payload = payload.model_copy(update={"subject_id": subject.id})
    elif payload.subject_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either subject_id or subject_name must be provided",
        )

    # Verify subject exists
    subject = db.query(Subject).filter(Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    grade = StudentSubjectGrade(
        student_id=student_id,
        subject_id=payload.subject_id,
        year_of_exam=payload.year_of_exam,
        sitting=payload.sitting,
        raw_grade=payload.raw_grade,
        notes=payload.notes,
    )
    db.add(grade)
    db.flush()

    # Recompute predicted grade if not OFFICIAL
    if payload.sitting != "OFFICIAL":
        _recompute_predicted(db, student_id, payload.subject_id, student)

    db.commit()
    db.refresh(grade)
    return _grade_to_dict(db, grade)


# ---------------------------------------------------------------------------
# PUT /students/{student_id}/grades/{grade_id}
# ---------------------------------------------------------------------------

@router.put(
    "/{student_id}/grades/{grade_id}",
    response_model=SubjectGradeResponse,
    status_code=status.HTTP_200_OK,
)
def update_grade(
    student_id: UUID,
    grade_id: UUID,
    payload: SubjectGradeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a grade record and recompute predicted_grade. REQ-068"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    grade = (
        db.query(StudentSubjectGrade)
        .filter(
            StudentSubjectGrade.id == grade_id,
            StudentSubjectGrade.student_id == student_id,
        )
        .first()
    )
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade record not found")

    if payload.year_of_exam is not None:
        grade.year_of_exam = payload.year_of_exam
    if payload.sitting is not None:
        grade.sitting = payload.sitting
    if payload.raw_grade is not None:
        grade.raw_grade = payload.raw_grade
    if payload.notes is not None:
        grade.notes = payload.notes

    db.flush()

    if grade.sitting != "OFFICIAL":
        _recompute_predicted(db, student_id, grade.subject_id, student)

    db.commit()
    db.refresh(grade)
    return _grade_to_dict(db, grade)


# ---------------------------------------------------------------------------
# DELETE /students/{student_id}/grades/{grade_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{student_id}/grades/{grade_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_grade(
    student_id: UUID,
    grade_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a grade record. REQ-068"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    grade = (
        db.query(StudentSubjectGrade)
        .filter(
            StudentSubjectGrade.id == grade_id,
            StudentSubjectGrade.student_id == student_id,
        )
        .first()
    )
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade record not found")

    db.delete(grade)
    db.commit()
