"""
app/api/v1/routes/invite.py

Invite and password-reset API endpoints.
Admin endpoints for sending invites; public endpoints for accepting.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, require_role
from app.db.models import User, OrganisationMembership
from app.db.session import get_db
from app.modules.school_choice.models.models import Student
from app.services.invite_service import (
    InviteError,
    accept_invite,
    generate_invite_token,
    generate_reset_token,
    reset_password,
    validate_invite_token,
    validate_reset_token,
)

router = APIRouter(tags=["invite"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class InviteRequest(BaseModel):
    student_ids: list[str]


class SingleInviteRequest(BaseModel):
    email: str | None = None


class AcceptInviteRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FRONTEND_URL = "http://localhost:5173"


def _get_org_id(user: User, db: Session) -> str | None:
    """Get the user's organisation ID from JWT context or membership."""
    org_id = getattr(user, "active_organisation_id", None)
    if org_id:
        return str(org_id)
    membership = db.query(OrganisationMembership).filter(
        OrganisationMembership.user_id == user.id
    ).first()
    if membership:
        return str(membership.organisation_id)
    return None


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.post("/admin/students/invite")
def bulk_invite_students(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Bulk invite students — generate invite tokens and URLs."""
    org_id = _get_org_id(current_user, db)
    invites = []
    errors = []

    for sid in payload.student_ids:
        student = db.query(Student).filter(Student.id == sid).first()
        if not student:
            errors.append({"student_id": sid, "error": "Student not found"})
            continue
        if not student.email:
            errors.append({"student_id": sid, "error": "Student has no email address"})
            continue
        if student.invite_accepted_at is not None:
            errors.append({"student_id": sid, "error": "Invite already accepted"})
            continue

        token = generate_invite_token(
            student_id=str(student.id),
            email=student.email,
            org_id=org_id or "",
        )

        # Decode token to get JTI and expiry
        token_payload = validate_invite_token(token)
        student.invite_token_jti = token_payload["jti"]
        student.invite_sent_at = datetime.now(timezone.utc)

        invite_url = f"{FRONTEND_URL}/invite/{token}"
        invites.append({
            "student_id": str(student.id),
            "name": student.name,
            "email": student.email,
            "invite_url": invite_url,
            "expires_at": datetime.fromtimestamp(token_payload["exp"], tz=timezone.utc).isoformat(),
        })

    db.commit()
    return {"invites": invites, "errors": errors}


@router.post("/admin/students/{student_id}/invite")
def single_invite_student(
    student_id: str,
    payload: SingleInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Invite a single student — optionally set email from body."""
    org_id = _get_org_id(current_user, db)
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if payload.email:
        student.email = payload.email

    if not student.email:
        raise HTTPException(status_code=400, detail="Student has no email address")

    if student.invite_accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invite already accepted")

    token = generate_invite_token(
        student_id=str(student.id),
        email=student.email,
        org_id=org_id or "",
    )
    token_payload = validate_invite_token(token)
    student.invite_token_jti = token_payload["jti"]
    student.invite_sent_at = datetime.now(timezone.utc)
    db.commit()

    invite_url = f"{FRONTEND_URL}/invite/{token}"
    return {
        "invite_url": invite_url,
        "expires_at": datetime.fromtimestamp(token_payload["exp"], tz=timezone.utc).isoformat(),
        "email": student.email,
    }


@router.post("/admin/students/{student_id}/reinvite")
def reinvite_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Regenerate invite token for a student (invalidates previous)."""
    org_id = _get_org_id(current_user, db)
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.email:
        raise HTTPException(status_code=400, detail="Student has no email address")

    token = generate_invite_token(
        student_id=str(student.id),
        email=student.email,
        org_id=org_id or "",
    )
    token_payload = validate_invite_token(token)
    student.invite_token_jti = token_payload["jti"]
    student.invite_sent_at = datetime.now(timezone.utc)
    db.commit()

    invite_url = f"{FRONTEND_URL}/invite/{token}"
    return {
        "invite_url": invite_url,
        "expires_at": datetime.fromtimestamp(token_payload["exp"], tz=timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Public endpoints (no auth)
# ---------------------------------------------------------------------------


@router.get("/auth/invite/{token}")
def validate_invite(token: str, db: Session = Depends(get_db)):
    """Validate an invite token and return student info."""
    try:
        payload = validate_invite_token(token)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))

    student = db.query(Student).filter(Student.id == payload["student_id"]).first()
    if not student:
        raise HTTPException(status_code=400, detail="Student record not found")

    if student.invite_token_jti != payload["jti"]:
        raise HTTPException(status_code=400, detail="This invite link is no longer valid")

    if student.invite_accepted_at is not None:
        raise HTTPException(status_code=400, detail="This invite has already been accepted")

    # Get school name from organisation
    school_name = None
    if student.organisation_id:
        from app.db.models import Organisation
        org = db.query(Organisation).filter(Organisation.id == student.organisation_id).first()
        if org:
            school_name = org.name

    return {
        "valid": True,
        "student_name": student.name,
        "email": student.email,
        "school_name": school_name,
    }


@router.post("/auth/invite/{token}/accept")
def accept_invite_endpoint(
    token: str,
    payload: AcceptInviteRequest,
    db: Session = Depends(get_db),
):
    """Accept an invite and create a student user account."""
    try:
        result = accept_invite(token, payload.password, db)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.post("/auth/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Generate a password reset token. Does not reveal whether email exists."""
    user = db.query(User).filter(User.email == payload.email, User.is_active.is_(True)).first()

    # Always return success to not reveal email existence
    if not user:
        return {"message": "If an account with that email exists, a reset link has been generated."}

    token = generate_reset_token(
        user_id=str(user.id),
        email=user.email,
    )
    token_payload = validate_reset_token(token)
    user.reset_token_jti = token_payload["jti"]
    db.commit()

    reset_url = f"{FRONTEND_URL}/reset-password/{token}"
    return {
        "message": "If an account with that email exists, a reset link has been generated.",
        "reset_url": reset_url,
    }


@router.post("/auth/reset-password/{token}")
def reset_password_endpoint(
    token: str,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Reset password using a valid reset token."""
    try:
        result = reset_password(token, payload.password, db)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result
