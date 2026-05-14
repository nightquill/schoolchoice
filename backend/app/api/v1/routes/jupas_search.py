"""JUPAS programme search — used by student choice autocomplete."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.school_choice.models.models import JupasProgramme, School

router = APIRouter(prefix="/jupas", tags=["jupas"])

@router.get("/all")
def list_all_programmes(
    db: Session = Depends(get_db),
):
    """Return all JUPAS programmes with school info. Used for client-side filtering."""
    programmes = (
        db.query(JupasProgramme)
        .join(School, JupasProgramme.school_id == School.id)
        .order_by(JupasProgramme.jupas_code)
        .all()
    )
    return {
        "programmes": [
            {
                "jupas_code": p.jupas_code,
                "name": p.name,
                "school_id": str(p.school_id),
                "school_name": p.school.name if p.school else None,
                "faculty": p.faculty,
                "admission_stats": p.admission_stats,
            }
            for p in programmes
        ],
        "schools": sorted(set(p.school.name for p in programmes if p.school)),
    }


@router.get("/search")
def search_programmes(
    q: str = Query(..., min_length=1, description="Search by JUPAS code, programme name, or school name"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search JUPAS programmes by code, name, or school. No auth required."""
    query = db.query(JupasProgramme).join(School, JupasProgramme.school_id == School.id)

    if q.upper().startswith("JS"):
        # JUPAS code search — prefix match
        query = query.filter(JupasProgramme.jupas_code.ilike(f"{q}%"))
    else:
        # Search across programme name, school name, faculty, and institution code
        pattern = f"%{q}%"
        query = query.filter(
            or_(
                JupasProgramme.name.ilike(pattern),
                School.name.ilike(pattern),
                JupasProgramme.faculty.ilike(pattern),
                JupasProgramme.institution_code.ilike(pattern),
            )
        )

    programmes = query.order_by(JupasProgramme.jupas_code).limit(limit).all()
    return [
        {
            "jupas_code": p.jupas_code,
            "name": p.name,
            "school_id": str(p.school_id),
            "school_name": p.school.name if p.school else None,
            "faculty": p.faculty,
        }
        for p in programmes
    ]
