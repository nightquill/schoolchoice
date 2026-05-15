"""
app/core/dependencies.py

FastAPI dependency: extract and validate JWT Bearer token, return User ORM object.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

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

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise _unauthorized

    try:
        user_id = UUID(user_id_str)
    except (ValueError, AttributeError):
        raise _unauthorized

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _unauthorized

    # Attach org context from JWT claim
    org_id_str = payload.get("org_id")
    if org_id_str:
        try:
            user.active_organisation_id = UUID(org_id_str)
        except (ValueError, AttributeError):
            user.active_organisation_id = None
    else:
        user.active_organisation_id = None

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


def get_current_student(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate JWT and return User with role='student'. Raises 401/403."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token")
    user = _resolve_user_from_token(credentials.credentials, db)
    if user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    if not user.student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No student record linked")
    return user


def check_write_permission(
    user: User,
    db: Session,
    student_id: Optional[UUID] = None,
) -> bool:
    """Check if user has write permission for a student.
    Uses the group-based permission system.
    """
    if user.role == "admin":
        return True
    if student_id is None:
        return True
    from app.services.permission_service import check_feature_permission
    perm = check_feature_permission(user, db, student_id=student_id, feature="grades")
    return perm == "read_write"


def require_write_permission(student_id_param: str = "student_id"):
    """FastAPI dependency factory: raises 403 if user lacks write permission for the student."""
    def _check(
        request: "Request",
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from fastapi import Request
        sid = request.path_params.get(student_id_param)
        if sid:
            try:
                sid = UUID(sid)
            except (ValueError, AttributeError):
                sid = None
        if not check_write_permission(current_user, db, student_id=sid):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You have read-only access. Write permission required for this student.",
            )
        return current_user
    return _check


def require_feature_permission(feature: str, level: str = "read_write"):
    """Factory: dependency that checks cohort-based feature permission for a student."""
    def _check(
        request: "Request",
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from fastapi import Request
        from app.services.permission_service import check_feature_permission as _check_perm
        sid = request.path_params.get("student_id")
        if sid:
            try:
                sid = UUID(sid)
            except (ValueError, AttributeError):
                sid = None
        if sid is None:
            return current_user
        perm = _check_perm(current_user, db, student_id=sid, feature=feature)
        if perm == "none":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"No access to {feature} for this student.")
        if level == "read_write" and perm == "read_only":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Read-only access to {feature} for this student.")
        return current_user
    return _check


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
