"""Grade builds — hypothetical grade sets with live JUPAS scoring."""
from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.grade_builds import GradeBuild
from app.modules.school_choice.models.models import Student, StudentSchoolTarget, JupasProgramme
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

router = APIRouter(prefix="/students/{student_id}/grade-builds", tags=["grade-builds"])


class GradeBuildCreate(BaseModel):
    name: str
    grades: dict[str, str] = {}


class GradeBuildUpdate(BaseModel):
    name: str | None = None
    grades: dict[str, str] | None = None


@router.get("")
def list_builds(student_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    builds = db.query(GradeBuild).filter(GradeBuild.student_id == student_id).order_by(GradeBuild.created_at).all()
    return {"builds": [{"id": str(b.id), "name": b.name, "grades": b.grades, "created_at": b.created_at.isoformat() if b.created_at else None} for b in builds]}


@router.post("")
def create_build(student_id: UUID, body: GradeBuildCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.query(GradeBuild).filter(GradeBuild.student_id == student_id).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 grade builds per student")
    build = GradeBuild(student_id=student_id, name=body.name, grades=body.grades or {})
    db.add(build)
    db.commit()
    db.refresh(build)
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.put("/{build_id}")
def update_build(student_id: UUID, build_id: UUID, body: GradeBuildUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if body.name is not None:
        build.name = body.name
    if body.grades is not None:
        build.grades = body.grades
    db.commit()
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.delete("/{build_id}")
def delete_build(student_id: UUID, build_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    db.delete(build)
    db.commit()
    return {"deleted": True}


@router.post("/{build_id}/scores")
def score_build(student_id: UUID, build_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Score all student targets against this build's hypothetical grades."""
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")

    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student_id).all()
    results = []
    for t in targets:
        if not t.jupas_code:
            continue
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == t.jupas_code).first()
        if not prog:
            continue
        prog_dict = {
            "jupas_code": prog.jupas_code,
            "name": prog.name,
            "scoring_formula": prog.scoring_formula or {},
            "minimum_requirements": prog.minimum_requirements or {},
            "admission_stats": prog.admission_stats or {},
        }
        try:
            score = score_student_for_programme(build.grades, prog_dict)
            results.append({
                "jupas_code": prog.jupas_code,
                "programme_name": prog.name,
                "match_score": score.get("admission_probability"),
                "eligible": score.get("eligible"),
                "risk_level": score.get("risk_level"),
            })
        except Exception:
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": None, "eligible": None, "risk_level": None})

    return {"build_id": str(build.id), "build_name": build.name, "scores": results}
