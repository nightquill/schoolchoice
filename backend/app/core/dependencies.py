"""
app/core/dependencies.py

FastAPI dependency: extract and validate JWT Bearer token, return User ORM object.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import verify_token
from app.db.session import get_db
from app.db.models import User

_bearer_scheme = HTTPBearer(auto_error=False)


def _resolve_user_from_token(token_str: str, db: Session) -> User:
    """
    Validate a JWT string and return the corresponding User ORM object.
    Raises HTTP 401 if the token is invalid or the user does not exist.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(token_str)
    except JWTError:
        raise _unauthorized

    user_id: Optional[str] = payload.get("sub")
    if user_id is None:
        raise _unauthorized

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _unauthorized

    return user


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
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _resolve_user_from_token(credentials.credentials, db)


def get_current_user_or_query_token(
    token: Optional[str] = Query(None, alias="token"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Accept auth token from either Authorization header (standard) or query
    parameter (for EventSource GET-only limitation on SSE endpoints).

    Priority: Authorization header > query param.
    Raises HTTP 401 if neither is provided or the token is invalid.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if authorization:
        # Extract Bearer token from Authorization header
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return _resolve_user_from_token(parts[1], db)
        raise _unauthorized
    elif token:
        return _resolve_user_from_token(token, db)
    else:
        raise _unauthorized


def require_role(role: str):
    """Factory: returns a FastAPI dependency that enforces a specific role.

    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_role("admin"))])
    Or as a positional dependency returning the user:
        current_user: User = Depends(require_role("admin"))
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if getattr(current_user, "role", "counsellor") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return current_user
    return _check
