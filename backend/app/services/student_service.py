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


def get_students(db: Session, user_id: UUID) -> list[Student]:
    """
    Return all student profiles owned by the given counselor.
    REQ-015, REQ-032
    """
    return db.query(Student).filter(Student.user_id == user_id).all()


def get_student(db: Session, student_id: UUID, user_id: UUID) -> Student:
    """
    Return a single student profile by ID, enforcing ownership.
    Raises HTTP 404 if not found, HTTP 403 if owned by a different counselor.
    REQ-014, REQ-033
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this ID",
        )
    if str(student.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user does not own this student record",
        )
    return student


def create_student(db: Session, user_id: UUID, data: StudentCreate) -> Student:
    """
    Create a new student profile owned by user_id.
    REQ-012, REQ-025, REQ-028, REQ-033
    """
    student = Student(
        user_id=user_id,
        name=data.name,
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
    db: Session, student_id: UUID, user_id: UUID, data: StudentUpdate
) -> Student:
    """
    Full update (replace all editable fields) of a student profile.
    Raises HTTP 404 or HTTP 403 as appropriate.
    REQ-013, REQ-033
    """
    student = get_student(db, student_id, user_id)
    student.name = data.name
    student.grades = data.grades
    student.interests = data.interests
    student.strengths_weaknesses = data.strengths_weaknesses
    student.target_region = data.target_region
    db.commit()
    db.refresh(student)
    return student


def get_student_match_data(db: Session, student_id: UUID, user_id: UUID) -> dict:
    """
    Return the student's data in the format expected by the matching engine.
    Enforces ownership, then delegates to the canonical builder.
    """
    student = get_student(db, student_id, user_id)
    return build_student_data(student, db)


def get_student_plan_data(db: Session, student_id: UUID, user_id: UUID) -> tuple:
    """
    Return (student_orm, student_data, student_dict) for plan generation.
    Enforces ownership, builds both match data and plan-formatted dict.
    """
    student = get_student(db, student_id, user_id)
    student_data = build_student_data(student, db)
    student_dict = build_student_dict_for_plan(student, student_data)
    return student, student_data, student_dict


def delete_student(db: Session, student_id: UUID, user_id: UUID) -> None:
    """
    Permanently delete a student profile and all associated data.
    Raises HTTP 404 or HTTP 403 as appropriate.
    REQ-025, REQ-028
    """
    student = get_student(db, student_id, user_id)
    db.delete(student)
    db.commit()
