"""
app/services/invite_service.py

Token-based invite and password-reset workflows.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash, create_access_token


class InviteError(Exception):
    pass


# ---------------------------------------------------------------------------
# Invite tokens
# ---------------------------------------------------------------------------


def generate_invite_token(
    student_id: str,
    email: str,
    org_id: str,
    expires_hours: int = 48,
) -> str:
    """Create a signed JWT for a student invite link."""
    now = datetime.now(timezone.utc)
    if expires_hours <= 0:
        exp = now - timedelta(seconds=1)
    else:
        exp = now + timedelta(hours=expires_hours)
    payload = {
        "type": "invite",
        "student_id": student_id,
        "email": email,
        "org_id": org_id,
        "jti": str(uuid.uuid4()),
        "exp": exp,
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def validate_invite_token(token: str) -> Dict[str, Any]:
    """Decode and validate an invite JWT. Returns the payload dict."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        raise InviteError("Token has expired.")
    except JWTError:
        raise InviteError("Invalid token.")

    if payload.get("type") != "invite":
        raise InviteError("Invalid token type — expected invite.")
    return payload


def accept_invite(token: str, password: str, db: Session) -> Dict[str, Any]:
    """
    Validate an invite token and create a student user account.

    Returns an access-token dict for immediate auto-login.
    """
    from app.db.models import User, OrganisationMembership
    from app.modules.school_choice.models.models import Student

    payload = validate_invite_token(token)

    student_id = payload["student_id"]
    email = payload["email"]
    org_id = payload.get("org_id")
    jti = payload["jti"]

    # Look up the student record
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise InviteError("Student record not found.")

    # JTI must match (guards against reused / superseded tokens)
    if student.invite_token_jti != jti:
        raise InviteError("This invite link is no longer valid.")

    # Must not have already accepted
    if student.invite_accepted_at is not None:
        raise InviteError("This invite has already been accepted.")

    # Email must not be taken
    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise InviteError("An account with this email already exists.")

    # Create the user
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role="student",
        student_id=student_id,
        must_change_password=False,
    )
    db.add(user)
    db.flush()  # get user.id

    # Org membership
    if org_id:
        membership = OrganisationMembership(
            organisation_id=org_id,
            user_id=user.id,
            role="member",
        )
        db.add(membership)

    # Clear invite token, stamp accepted time
    student.invite_token_jti = None
    student.invite_accepted_at = datetime.now(timezone.utc)

    # Link student → user
    student.user_id = user.id

    db.commit()

    # Generate access token for auto-login
    token_data: Dict[str, Any] = {"sub": str(user.id)}
    if org_id:
        token_data["org_id"] = org_id
    token_data["student_id"] = student_id

    access_token = create_access_token(
        data=token_data,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "must_change_password": False,
    }


# ---------------------------------------------------------------------------
# Password-reset tokens
# ---------------------------------------------------------------------------


def generate_reset_token(
    user_id: str,
    email: str,
    expires_hours: int = 24,
) -> str:
    """Create a signed JWT for a password-reset link."""
    now = datetime.now(timezone.utc)
    payload = {
        "type": "reset",
        "user_id": user_id,
        "email": email,
        "jti": str(uuid.uuid4()),
        "exp": now + timedelta(hours=expires_hours),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def validate_reset_token(token: str) -> Dict[str, Any]:
    """Decode and validate a password-reset JWT."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        raise InviteError("Token has expired.")
    except JWTError:
        raise InviteError("Invalid token.")

    if payload.get("type") != "reset":
        raise InviteError("Invalid token type — expected reset.")
    return payload


def reset_password(token: str, new_password: str, db: Session) -> Dict[str, str]:
    """
    Validate a reset token and update the user's password.
    """
    from app.db.models import User

    payload = validate_reset_token(token)

    user_id = payload["user_id"]
    jti = payload["jti"]

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise InviteError("User not found.")

    if user.reset_token_jti != jti:
        raise InviteError("This reset link is no longer valid.")

    user.hashed_password = get_password_hash(new_password)
    user.reset_token_jti = None
    user.must_change_password = False
    db.commit()

    return {"message": "Password updated successfully."}
