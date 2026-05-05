"""
app/services/auth_service.py

Authentication business logic: registration, login, token issuance.
REQ-010, REQ-011, REQ-024, REQ-031
"""
from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.models import User


def authenticate_user(db: Session, email: str, password: str) -> tuple[User | None, str | None]:
    """
    Verify email + password combination.
    Returns (user, None) on success.
    Returns (None, "email_not_found") if email is not registered.
    Returns (None, "wrong_password") if password is incorrect.
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        return None, "email_not_found"
    if not verify_password(password, user.hashed_password):
        return None, "wrong_password"
    return user, None


def register_user(db: Session, email: str, password: str) -> User:
    """
    Create a new counselor account.
    Raises HTTP 409 if the email is already registered.
    """
    hashed = get_password_hash(password)
    user = User(email=email, hashed_password=hashed)
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists",
        )
    return user


def login_for_access_token(db: Session, email: str, password: str) -> dict:
    """
    Authenticate and issue a JWT access token.
    Returns dict with access_token, token_type, expires_in.
    Raises HTTP 401 on invalid credentials.
    """
    user, error_code = authenticate_user(db, email, password)
    if user is None:
        if error_code == "email_not_found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No account found with this email address. Please register.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=expires_delta,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
