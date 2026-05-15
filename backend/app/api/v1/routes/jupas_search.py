"""JUPAS programme search — used by student choice autocomplete."""
from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.db.models import User
from app.modules.school_choice.models.models import JupasProgramme, School, Student
from app.services.student_data_builder import build_student_data
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme
from app.modules.school_choice.data.jupas_calendar import get_all_milestones, get_next_milestone

logger = logging.getLogger(__name__)

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
                "non_grade_requirements": p.non_grade_requirements,
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
            "non_grade_requirements": p.non_grade_requirements,
        }
        for p in programmes
    ]


@router.get("/{jupas_code}/students")
def get_programme_students(
    jupas_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score all org students against a specific JUPAS programme."""
    programme = db.query(JupasProgramme).filter(
        JupasProgramme.jupas_code == jupas_code.upper()
    ).first()
    if not programme:
        raise HTTPException(status_code=404, detail="Programme not found")

    org_id = getattr(current_user, "active_organisation_id", None)
    students = (
        db.query(Student)
        .filter(Student.organisation_id == org_id)
        .all()
    )

    # Build latest-year admission stats
    raw_stats = programme.admission_stats or {}
    if raw_stats:
        latest_year = max(raw_stats.keys())
        latest_stats = raw_stats[latest_year]
    else:
        latest_stats = {}

    prog_dict = {
        "jupas_code": programme.jupas_code,
        "name": programme.name,
        "scoring_formula": programme.scoring_formula or {},
        "minimum_requirements": programme.minimum_requirements or {},
        "admission_stats": raw_stats,
    }

    scored_students = []
    for student in students:
        try:
            student_data = build_student_data(student, db)
            grades_by_code = student_data.get("grades_by_code", {})
            if not grades_by_code:
                scored_students.append({
                    "student_id": str(student.id),
                    "student_name": student.name,
                    "class_name": student.class_name,
                    "match_score": None,
                    "weighted_score": None,
                    "eligible": None,
                    "risk_level": None,
                })
                continue
            result = score_student_for_programme(grades_by_code, prog_dict)
            scored_students.append({
                "student_id": str(student.id),
                "student_name": student.name,
                "class_name": student.class_name,
                "match_score": result.get("admission_probability"),
                "weighted_score": result.get("weighted_score"),
                "eligible": result.get("eligible"),
                "risk_level": result.get("risk_level"),
            })
        except Exception as exc:
            logger.warning("Scoring failed for student %s / programme %s: %s", student.id, jupas_code, exc)
            scored_students.append({
                "student_id": str(student.id),
                "student_name": student.name,
                "class_name": student.class_name,
                "match_score": None,
                "weighted_score": None,
                "eligible": None,
                "risk_level": None,
            })

    # Sort: scored students descending, None last
    scored_students.sort(
        key=lambda s: (s["match_score"] is None, -(s["match_score"] or 0))
    )

    return {
        "programme": {
            "jupas_code": programme.jupas_code,
            "name": programme.name,
            "faculty": programme.faculty,
            "institution_code": programme.institution_code,
            "admission_stats": latest_stats,
            "minimum_requirements": programme.minimum_requirements or {},
            "non_grade_requirements": programme.non_grade_requirements,
        },
        "students": scored_students,
        "total": len(scored_students),
    }


@router.get("/{jupas_code}/deadlines")
def get_programme_deadlines(
    jupas_code: str,
    db: Session = Depends(get_db),
):
    """Return merged JUPAS milestones + programme-specific deadlines."""
    programme = db.query(JupasProgramme).filter(
        JupasProgramme.jupas_code == jupas_code.upper()
    ).first()
    if not programme:
        raise HTTPException(status_code=404, detail="Programme not found")

    from datetime import date
    today = date.today().isoformat()

    return {
        "jupas_code": programme.jupas_code,
        "programme_name": programme.name,
        "milestones": get_all_milestones(),
        "next_milestone": get_next_milestone(today),
        "programme_deadlines": programme.deadlines or {},
    }
