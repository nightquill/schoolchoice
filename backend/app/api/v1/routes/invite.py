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
from app.services.permission_service import check_feature_permission
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


class AssignAccountRequest(BaseModel):
    username: str | None = None


class BulkAssignRequest(BaseModel):
    student_ids: list[str]


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


def _check_account_assignment(user: User, db: Session, student_id):
    """Check that the user has account_assignment permission for a student."""
    if user.role == "admin":
        return
    from uuid import UUID
    perm = check_feature_permission(user, db, student_id=UUID(str(student_id)), feature="account_assignment")
    if perm != "read_write":
        raise HTTPException(status_code=403, detail="You do not have permission to assign accounts for this student.")


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.post("/admin/students/invite")
def bulk_invite_students(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk invite students — generate invite tokens and URLs."""
    org_id = _get_org_id(current_user, db)
    invites = []
    errors = []

    for sid in payload.student_ids:
        try:
            _check_account_assignment(current_user, db, sid)
        except HTTPException:
            errors.append({"student_id": sid, "error": "No account assignment permission for this student"})
            continue

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
    current_user: User = Depends(get_current_user),
):
    """Invite a single student — optionally set email from body."""
    org_id = _get_org_id(current_user, db)
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    _check_account_assignment(current_user, db, student_id)

    if payload.email:
        student.email = payload.email
        import re
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', student.email):
            raise HTTPException(status_code=400, detail="Invalid email format")

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
    current_user: User = Depends(get_current_user),
):
    """Regenerate invite token for a student (invalidates previous)."""
    org_id = _get_org_id(current_user, db)
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    _check_account_assignment(current_user, db, student_id)

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


@router.post("/admin/students/{student_id}/assign-account")
def assign_student_account(
    student_id: str,
    payload: AssignAccountRequest = AssignAccountRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a login account for a student with auto-generated credentials."""
    _check_account_assignment(current_user, db, student_id)
    from app.services.account_assignment_service import assign_account
    try:
        result = assign_account(student_id, db, current_user, payload.username)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.post("/admin/students/assign-accounts")
def bulk_assign_accounts(
    payload: BulkAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk create login accounts for multiple students."""
    from app.services.account_assignment_service import assign_account
    results = []
    errors = []
    for sid in payload.student_ids:
        try:
            _check_account_assignment(current_user, db, sid)
            result = assign_account(sid, db, current_user)
            results.append(result)
        except (ValueError, HTTPException) as e:
            detail = str(e) if isinstance(e, ValueError) else e.detail
            errors.append({"student_id": sid, "error": detail})
    return {"results": results, "errors": errors}


class SendCredentialsRequest(BaseModel):
    email: str
    login_id: str
    password: str
    student_name: str | None = None


@router.post("/admin/send-credentials")
def send_credentials_email_endpoint(
    payload: SendCredentialsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send account credentials to a student or teacher via email (Resend)."""
    # Get org name for email context
    org_name = None
    org_id = _get_org_id(current_user, db)
    if org_id:
        from app.db.models import Organisation
        org = db.query(Organisation).filter(Organisation.id == org_id).first()
        if org:
            org_name = org.name

    from app.services.email_service import send_credentials_email
    result = send_credentials_email(
        to_email=payload.email,
        student_name=payload.student_name or payload.email.split("@")[0],
        login_id=payload.login_id,
        password=payload.password,
        org_name=org_name,
    )
    if not result.get("sent"):
        raise HTTPException(status_code=422, detail=result.get("error", "Failed to send email"))
    return result


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
