"""
admin_users.py — Create teachers during onboarding
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import get_password_hash
from app.db.models import (
    OrganisationMembership,
    TeacherGroup,
    TeacherGroupMember,
    User,
)
from app.db.session import get_db

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


class CreateTeacherRequest(BaseModel):
    display_name: str
    email: str
    password: str = "changeme123"


@router.post("/create-teacher", status_code=status.HTTP_201_CREATED)
def create_teacher(
    payload: CreateTeacherRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.merge(current_user)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    # Check email not taken
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already in use")

    # Get org from current user
    membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=400, detail="No organisation found")

    teacher = User(
        id=uuid.uuid4(),
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role="counsellor",
        display_name=payload.display_name,
        must_change_password=True,
    )
    db.add(teacher)
    db.flush()

    # Add org membership
    om = OrganisationMembership(
        user_id=teacher.id,
        organisation_id=membership.organisation_id,
        role="member",
    )
    db.add(om)

    # Add to default teacher group if one exists
    default_group = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.organisation_id == membership.organisation_id)
        .order_by(TeacherGroup.created_at)
        .first()
    )
    if default_group:
        gm = TeacherGroupMember(
            group_id=default_group.id,
            user_id=teacher.id,
        )
        db.add(gm)

    db.commit()

    return {
        "id": str(teacher.id),
        "email": teacher.email,
        "display_name": teacher.display_name,
    }
