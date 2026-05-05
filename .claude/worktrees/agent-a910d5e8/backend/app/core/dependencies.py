"""
app/core/dependencies.py

FastAPI dependency: extract and validate JWT Bearer token, return User ORM object.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import verify_token
from app.db.session import get_db
from app.db.models import User

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract the JWT from the Authorization: Bearer header, validate it,
    and return the corresponding User ORM object.

    Raises HTTP 401 if the token is absent, malformed, expired, or the
    user no longer exists in the database.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise _unauthorized

    try:
        payload = verify_token(credentials.credentials)
    except JWTError:
        raise _unauthorized

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise _unauthorized

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _unauthorized

    return user
