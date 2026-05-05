"""
app/services/school_service.py

School record CRUD business logic.
REQ-026, REQ-030
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import School
from app.schemas.school import SchoolCreate, SchoolUpdate


def get_schools(db: Session) -> list[School]:
    """Return all school records in the system. REQ-026, REQ-030"""
    return db.query(School).all()


def get_school(db: Session, school_id: UUID) -> School:
    """
    Return a single school by ID.
    Raises HTTP 404 if not found.
    REQ-026, REQ-030
    """
    school = db.query(School).filter(School.id == school_id).first()
    if school is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No school found with this ID",
        )
    return school


def create_school(db: Session, data: SchoolCreate) -> School:
    """
    Create a new school record.
    Raises HTTP 409 if a school with this name already exists.
    REQ-026, REQ-030
    """
    school = School(
        name=data.name,
        location=data.location,
        min_academic_requirements=data.min_academic_requirements,
        key_strengths=data.key_strengths,
        notes=data.notes,
    )
    db.add(school)
    try:
        db.commit()
        db.refresh(school)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A school with this name already exists",
        )
    return school


def update_school(db: Session, school_id: UUID, data: SchoolUpdate) -> School:
    """
    Full update (replace all editable fields) of a school record.
    Raises HTTP 404 if not found.
    REQ-026, REQ-030
    """
    school = get_school(db, school_id)
    school.name = data.name
    school.location = data.location
    school.min_academic_requirements = data.min_academic_requirements
    school.key_strengths = data.key_strengths
    school.notes = data.notes
    db.commit()
    db.refresh(school)
    return school


def delete_school(db: Session, school_id: UUID) -> None:
    """
    Permanently delete a school record.
    Raises HTTP 404 if not found.
    REQ-026, REQ-030
    """
    school = get_school(db, school_id)
    db.delete(school)
    db.commit()
