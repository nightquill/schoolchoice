"""
app/services/student_service.py

Student profile CRUD business logic.
REQ-012, REQ-013, REQ-014, REQ-015, REQ-025, REQ-028, REQ-032, REQ-033
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Student
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.student_data_builder import build_student_data, build_student_dict_for_plan


def get_students(
    db: Session, user_id: UUID, *, organisation_id: UUID | None = None,
    q: str | None = None, unaccounted: bool = False,
) -> list[Student]:
    """
    Return all student profiles owned by the given counselor.
    When *organisation_id* is set, scope by organisation instead of user.
    When *q* is provided, filter by student name (case-insensitive).
    When *unaccounted* is True, filter to students with no active linked User account.
    REQ-015, REQ-032
    """
    if organisation_id is not None:
        query = db.query(Student).filter(Student.organisation_id == organisation_id)
    else:
        query = db.query(Student).filter(Student.user_id == user_id)
    if q:
        query = query.filter(Student.name.ilike(f"%{q}%"))
    if unaccounted:
        from sqlalchemy import select
        from app.db.models import User as UserModel
        linked_ids_subq = db.query(UserModel.student_id).filter(
            UserModel.student_id.isnot(None),
            UserModel.is_active.is_(True),
        ).subquery()
        query = query.filter(~Student.id.in_(select(linked_ids_subq)))
    return query.all()


def get_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> Student:
    """
    Return a single student profile by ID, enforcing ownership.
    When *organisation_id* is set, check org-level access first.
    Raises HTTP 404 if not found, HTTP 403 if access denied.
    REQ-014, REQ-033
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this ID",
        )
    # Org-level access check takes precedence when available
    if organisation_id is not None:
        if student.organisation_id is None or str(student.organisation_id) != str(organisation_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student does not belong to the active organisation",
            )
        return student
    # Fallback: user-level ownership check
    if str(student.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user does not own this student record",
        )
    return student


def create_student(
    db: Session, user_id: UUID, data: StudentCreate, *, organisation_id: UUID | None = None
) -> Student:
    """
    Create a new student profile owned by user_id.
    When *organisation_id* is set, the student is also associated with the org.
    REQ-012, REQ-025, REQ-028, REQ-033
    """
    # Prevent duplicate candidate_number within org
    cand = getattr(data, "candidate_number", None)
    if cand:
        dup_filter = [Student.candidate_number == cand]
        if organisation_id:
            dup_filter.append(Student.organisation_id == organisation_id)
        else:
            dup_filter.append(Student.organisation_id.is_(None))
        dup = db.query(Student).filter(*dup_filter).first()
        if dup:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=409,
                detail=f"A student with candidate number '{cand}' already exists.",
            )

    student = Student(
        user_id=user_id,
        organisation_id=organisation_id,
        name=data.name,
        candidate_number=cand,
        grades=data.grades,
        interests=data.interests,
        strengths_weaknesses=data.strengths_weaknesses,
        target_region=data.target_region,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


def update_student(
    db: Session, student_id: UUID, user_id: UUID, data: StudentUpdate,
    *, organisation_id: UUID | None = None,
) -> Student:
    """
    Full update (replace all editable fields) of a student profile.
    Raises HTTP 404 or HTTP 403 as appropriate.
    REQ-013, REQ-033
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    student.name = data.name
    student.grades = data.grades
    student.interests = data.interests
    student.strengths_weaknesses = data.strengths_weaknesses
    student.target_region = data.target_region
    db.commit()
    db.refresh(student)
    return student


def get_student_match_data(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> dict:
    """
    Return the student's data in the format expected by the matching engine.
    Enforces ownership, then delegates to the canonical builder.
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    return build_student_data(student, db)


def get_student_plan_data(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> tuple:
    """
    Return (student_orm, student_data, student_dict) for plan generation.
    Enforces ownership, builds both match data and plan-formatted dict.
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    student_data = build_student_data(student, db)
    student_dict = build_student_dict_for_plan(student, student_data)
    return student, student_data, student_dict


def delete_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> None:
    """
    Permanently delete a student profile and all associated data.
    Raises HTTP 404 or HTTP 403 as appropriate.
    REQ-025, REQ-028
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    db.delete(student)
    db.commit()
