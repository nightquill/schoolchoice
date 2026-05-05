"""
app/api/v1/routes/schools.py

School record CRUD endpoints — all protected.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.school import SchoolCreate, SchoolListItem, SchoolResponse, SchoolUpdate
from app.services import school_service

router = APIRouter(prefix="/schools", tags=["schools"])


# REQ-026, REQ-030
@router.get("", response_model=list[SchoolListItem], status_code=status.HTTP_200_OK)
def list_schools(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all schools in the system. REQ-026, REQ-030"""
    return school_service.get_schools(db)


# REQ-026, REQ-030
@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
def create_school(
    payload: SchoolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new school record to the system. REQ-026, REQ-030"""
    return school_service.create_school(db, data=payload)


# REQ-026, REQ-030
@router.get("/{school_id}", response_model=SchoolResponse, status_code=status.HTTP_200_OK)
def get_school(
    school_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a school record by ID. REQ-026, REQ-030"""
    return school_service.get_school(db, school_id=school_id)


# REQ-026, REQ-030
@router.put("/{school_id}", response_model=SchoolResponse, status_code=status.HTTP_200_OK)
def update_school(
    school_id: UUID,
    payload: SchoolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full update of a school record. REQ-026, REQ-030"""
    return school_service.update_school(db, school_id=school_id, data=payload)


# REQ-026, REQ-030
@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_school(
    school_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a school record. REQ-026, REQ-030"""
    school_service.delete_school(db, school_id=school_id)
