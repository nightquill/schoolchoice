"""
app/api/v1/routes/subjects.py

Subjects lookup endpoint — returns all available HKDSE subjects.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.models_v2 import Subject
from app.db.session import get_db

router = APIRouter(prefix="/grades", tags=["subjects"])


@router.get("/subjects", response_model=list[dict], status_code=200)
def list_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all available HKDSE subjects for the grade entry form."""
    subjects = db.query(Subject).order_by(Subject.category, Subject.name).all()
    return [
        {
            "id": str(s.id),
            "code": s.code,
            "name": s.name,
            "category": s.category,
            "is_compulsory": s.is_compulsory,
        }
        for s in subjects
    ]
