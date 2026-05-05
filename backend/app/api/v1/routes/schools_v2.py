"""
app/api/v1/routes/schools_v2.py

School directory and profile endpoints (v2 expanded).
REQ-070, REQ-071
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, User
from app.db.session import get_db
from app.schemas.v2.schools_v2 import SchoolCreateRequest, SchoolV2Response

router = APIRouter(prefix="/schools", tags=["schools-v2"])


# ---------------------------------------------------------------------------
# GET /schools — search and filter
# Returns {"items": [...], "total": N} for correct pagination
# ---------------------------------------------------------------------------

@router.get("", status_code=status.HTTP_200_OK)
def search_schools(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    min_score: Optional[int] = Query(None),
    max_score: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Search and filter the school directory. Returns paginated results with total count."""
    query = db.query(School)

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            School.name.ilike(pattern) | School.name_zh.ilike(pattern)
        )
    if type:
        query = query.filter(School.type == type)
    if location:
        query = query.filter(School.location.ilike(f"%{location}%"))
    if min_score is not None:
        query = query.filter(School.minimum_entry_score >= min_score)
    if max_score is not None:
        query = query.filter(School.minimum_entry_score <= max_score)

    total = query.count()
    # Sort canonical schools first (is_custom=False), then alphabetically
    schools = query.order_by(School.is_custom.asc(), School.name).offset(offset).limit(limit).all()
    return {
        "items": [SchoolV2Response.model_validate(s) for s in schools],
        "total": total,
    }


# ---------------------------------------------------------------------------
# POST /schools — create a custom school
# ---------------------------------------------------------------------------

@router.post("", response_model=SchoolV2Response, status_code=status.HTTP_201_CREATED)
def create_custom_school(
    payload: SchoolCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a custom school entry."""
    school = School(
        name=payload.name,
        name_zh=payload.name_zh,
        type=payload.type,
        location=payload.location,
        description=payload.description,
        website=payload.website,
        minimum_entry_score=payload.minimum_entry_score,
        notable_programs=payload.notable_programs or [],
        required_subjects=payload.required_subjects or [],
        language_requirements=payload.language_requirements or {},
        notes=payload.notes,
        is_custom=True,
        major_requirements=payload.major_requirements,
        key_strengths=payload.key_strengths or [],
        min_academic_requirements=payload.min_academic_requirements or {},
    )
    db.add(school)
    db.commit()
    db.refresh(school)
    return SchoolV2Response.model_validate(school)


# ---------------------------------------------------------------------------
# GET /schools/{id} — full school profile
# ---------------------------------------------------------------------------

@router.get("/{school_id}", response_model=SchoolV2Response, status_code=status.HTTP_200_OK)
def get_school(
    school_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full school record including all v2 fields."""
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")
    return school


# ---------------------------------------------------------------------------
# DELETE /schools/{id} — delete a custom school only
# ---------------------------------------------------------------------------

@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_school(
    school_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a custom school. Canonical (seeded) schools cannot be deleted."""
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")
    if not getattr(school, "is_custom", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only custom schools can be deleted. Canonical schools are read-only.",
        )
    # Remove any student targets referencing this school before deletion.
    # student_school_targets.school_id is NOT NULL so SQLAlchemy cannot null it out;
    # we must delete the rows explicitly first.
    from app.db.models_v2 import StudentSchoolTarget
    db.query(StudentSchoolTarget).filter(StudentSchoolTarget.school_id == school_id).delete(synchronize_session=False)
    db.delete(school)
    db.commit()
