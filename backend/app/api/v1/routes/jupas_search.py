"""JUPAS programme search — used by student choice autocomplete."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.modules.school_choice.models.models import JupasProgramme, School

router = APIRouter(prefix="/jupas", tags=["jupas"])

@router.get("/search")
def search_programmes(
    q: str = Query(..., min_length=1, description="Search by JUPAS code or programme name"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search JUPAS programmes by code or name. No auth required."""
    query = db.query(JupasProgramme).join(School, JupasProgramme.school_id == School.id)
    if q.upper().startswith("JS"):
        query = query.filter(JupasProgramme.jupas_code.ilike(f"{q}%"))
    else:
        query = query.filter(JupasProgramme.name.ilike(f"%{q}%"))
    programmes = query.limit(limit).all()
    return [
        {"jupas_code": p.jupas_code, "name": p.name, "school_id": str(p.school_id),
         "school_name": p.school.name if p.school else None, "faculty": p.faculty}
        for p in programmes
    ]
