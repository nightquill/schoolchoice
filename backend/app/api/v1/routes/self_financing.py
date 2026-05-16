"""Self-financing programme API — completely separate from JUPAS.

Lists institutions, programmes, and scores students against sub-degree programmes.
"""
from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.models import Student
from app.services.student_data_builder import build_student_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sf", tags=["self-financing"])


# ---------------------------------------------------------------------------
# Helpers (raw SQL — models may not be registered with Base yet)
# ---------------------------------------------------------------------------

def _row_to_dict(row, keys):
    return dict(zip(keys, row))


# ---------------------------------------------------------------------------
# 1. GET /sf/institutions — list all self-financing institutions
# ---------------------------------------------------------------------------

@router.get("/institutions")
def list_institutions(q: str = None, db: Session = Depends(get_db)):
    sql = (
        "SELECT id, code, name, name_zh, parent_university, location, website, tier, articulation_rate, notes "
        "FROM sf_institutions"
    )
    params = {}
    if q:
        sql += " WHERE (name LIKE :q OR name_zh LIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY tier, name"
    rows = db.execute(text(sql), params).fetchall()
    keys = ["id", "code", "name", "name_zh", "parent_university", "location", "website", "tier", "articulation_rate", "notes"]
    return {
        "institutions": [_row_to_dict(r, keys) for r in rows],
        "total": len(rows),
    }


# ---------------------------------------------------------------------------
# 2. GET /sf/institutions/{code} — single institution with all programmes
# ---------------------------------------------------------------------------

@router.get("/institutions/{code}")
def get_institution(code: str, db: Session = Depends(get_db)):
    inst = db.execute(text(
        "SELECT id, code, name, name_zh, parent_university, location, website, tier, articulation_rate, notes "
        "FROM sf_institutions WHERE code = :code"
    ), {"code": code.upper()}).fetchone()
    if not inst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Institution not found")

    inst_keys = ["id", "code", "name", "name_zh", "parent_university", "location", "website", "tier", "articulation_rate", "notes"]
    inst_dict = _row_to_dict(inst, inst_keys)

    progs = db.execute(text(
        "SELECT id, programme_code, name, name_zh, level, faculty, "
        "admission_score_mean, admission_score_lq, admission_score_uq, admission_score_highest, "
        "admission_year, data_source "
        "FROM sf_programmes WHERE institution_id = :iid ORDER BY level, name"
    ), {"iid": inst[0]}).fetchall()

    prog_keys = ["id", "programme_code", "name", "name_zh", "level", "faculty",
                 "admission_score_mean", "admission_score_lq", "admission_score_uq", "admission_score_highest",
                 "admission_year", "data_source"]

    return {
        "institution": inst_dict,
        "programmes": [_row_to_dict(p, prog_keys) for p in progs],
        "total": len(progs),
    }


# ---------------------------------------------------------------------------
# 3. GET /sf/programmes — list all self-financing programmes (flat)
# ---------------------------------------------------------------------------

@router.get("/programmes")
def list_programmes(
    level: str = None,  # filter: associate_degree, higher_diploma, etc.
    institution: str = None,  # filter by institution code
    q: str = None,  # search by programme or institution name (en/zh)
    db: Session = Depends(get_db),
):
    sql = """
        SELECT p.id, p.programme_code, p.name, p.name_zh, p.level, p.faculty,
               p.admission_score_mean, p.admission_score_lq, p.admission_score_uq, p.admission_score_highest,
               p.admission_year, i.code as institution_code, i.name as institution_name, i.name_zh as institution_name_zh
        FROM sf_programmes p
        JOIN sf_institutions i ON p.institution_id = i.id
        WHERE 1=1
    """
    params = {}
    if level:
        sql += " AND p.level = :level"
        params["level"] = level
    if institution:
        sql += " AND i.code = :inst"
        params["inst"] = institution.upper()
    if q:
        sql += " AND (p.name LIKE :q OR p.name_zh LIKE :q OR i.name LIKE :q OR i.name_zh LIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY i.name, p.level, p.name"

    rows = db.execute(text(sql), params).fetchall()
    keys = ["id", "programme_code", "name", "name_zh", "level", "faculty",
            "admission_score_mean", "admission_score_lq", "admission_score_uq", "admission_score_highest",
            "admission_year", "institution_code", "institution_name", "institution_name_zh"]

    return {
        "programmes": [_row_to_dict(r, keys) for r in rows],
        "total": len(rows),
    }


# ---------------------------------------------------------------------------
# 4. GET /sf/programmes/{prog_id}/students — score org students against a SF programme
# ---------------------------------------------------------------------------

@router.get("/programmes/{prog_id}/students")
def score_students_for_programme(
    prog_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score all org students against a self-financing programme using best-5 DSE scores."""
    prog = db.execute(text(
        "SELECT p.id, p.name, p.level, p.faculty, p.admission_score_mean, p.admission_score_lq, "
        "p.admission_score_uq, p.admission_score_highest, p.admission_year, p.minimum_requirements, "
        "i.code as institution_code, i.name as institution_name "
        "FROM sf_programmes p JOIN sf_institutions i ON p.institution_id = i.id "
        "WHERE p.id = :pid"
    ), {"pid": prog_id}).fetchone()

    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programme not found")

    prog_keys = ["id", "name", "level", "faculty", "admission_score_mean", "admission_score_lq",
                 "admission_score_uq", "admission_score_highest", "admission_year", "minimum_requirements",
                 "institution_code", "institution_name"]
    prog_dict = _row_to_dict(prog, prog_keys)

    # Get org students
    org_id = getattr(user, "active_organisation_id", None)
    q = db.query(Student)
    if org_id:
        q = q.filter(Student.organisation_id == org_id)
    students = q.all()

    mean_score = prog_dict["admission_score_mean"]
    lq = prog_dict["admission_score_lq"]

    scored = []
    for student in students:
        data = build_student_data(student, db)
        best5 = data.get("best5_aggregate")
        if best5 is None:
            scored.append({
                "student_id": str(student.id),
                "student_name": student.name or "Unnamed",
                "class_name": student.class_name,
                "best5_score": None,
                "match_score": None,
                "eligible": None,
            })
            continue

        # Probability model for sub-degree:
        # When LQ/UQ available: 4-band model
        # When only mean available: estimate bands from mean ± typical spread
        uq = prog_dict["admission_score_uq"]
        if mean_score:
            effective_lq = lq if lq else mean_score - 2.0
            effective_uq = uq if uq else mean_score + 2.0
            if best5 >= effective_uq:
                match = min(0.95, 0.90 + (best5 - effective_uq) * 0.02)
            elif best5 >= mean_score:
                frac = (best5 - mean_score) / max(effective_uq - mean_score, 1)
                match = 0.60 + frac * 0.30
            elif best5 >= effective_lq:
                frac = (best5 - effective_lq) / max(mean_score - effective_lq, 1)
                match = 0.30 + frac * 0.30
            else:
                match = max(0.05, 0.30 * (best5 / max(effective_lq, 1)))
        else:
            match = None

        # Eligibility: best-5 >= 10 (five 2s) is the floor for sub-degree
        eligible = best5 >= 10 if best5 is not None else None

        scored.append({
            "student_id": str(student.id),
            "student_name": student.name or "Unnamed",
            "class_name": student.class_name,
            "best5_score": best5,
            "match_score": round(match, 2) if match is not None else None,
            "eligible": eligible,
        })

    scored.sort(key=lambda s: s["match_score"] if s["match_score"] is not None else -1, reverse=True)

    return {
        "programme": prog_dict,
        "students": scored,
        "total": len(scored),
    }
