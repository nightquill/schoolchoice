"""Plan release — counselor releases plan to student."""
from __future__ import annotations
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.models import AcademicPlan

router = APIRouter(prefix="/students/{student_id}/plan", tags=["plan-release"])


class ReleaseRequest(BaseModel):
    note: str = ""


@router.post("/release")
def release_plan(student_id: UUID, body: ReleaseRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan or not plan.html_content:
        raise HTTPException(status_code=404, detail="No plan to release")
    plan.released_at = datetime.now(timezone.utc)
    plan.release_note = body.note or None
    db.commit()
    return {"released_at": plan.released_at.isoformat(), "version": plan.version}


@router.get("/release-status")
def get_release_status(student_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan:
        return {"released": False}
    return {
        "released": plan.released_at is not None,
        "released_at": plan.released_at.isoformat() if plan.released_at else None,
        "release_note": plan.release_note,
        "version": plan.version,
    }
