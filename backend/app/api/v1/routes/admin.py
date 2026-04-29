"""
app/api/v1/routes/admin.py

Admin endpoints — data refresh trigger.
REQ-080
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_current_user, require_role
from app.core.security import get_password_hash
from app.db.models import User
from app.db.session import get_db
from app.schemas.v2.admin_users import (
    UserAdminResponse,
    UserCreateAdmin,
    UserUpdateAdmin,
)

router = APIRouter(prefix="/admin", tags=["admin-v2"])

# In-memory store for last refresh status (MVP — no persistent log table yet)
_last_refresh: dict = {
    "task_id": None,
    "triggered_at": None,
    "status": "idle",
}


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: enforce admin role. Returns user or raises 403."""
    role = getattr(current_user, "role", "counsellor")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


def _data_refresh_background() -> None:
    """
    Stub background task for data refresh.
    In production this would invoke the data agent script via subprocess.
    """
    _last_refresh["status"] = "running"
    # Simulate data agent invocation (MVP stub)
    import time
    time.sleep(0.1)
    _last_refresh["status"] = "complete"


# ---------------------------------------------------------------------------
# POST /admin/data-refresh
# ---------------------------------------------------------------------------

@router.post(
    "/data-refresh",
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_data_refresh(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """
    Trigger the data agent re-run as a background task.
    Admin only. REQ-080
    """
    task_id = str(uuid4())
    triggered_at = datetime.now(timezone.utc)

    _last_refresh["task_id"] = task_id
    _last_refresh["triggered_at"] = triggered_at.isoformat()
    _last_refresh["status"] = "pending"

    background_tasks.add_task(_data_refresh_background)

    return {
        "task_id": task_id,
        "triggered_at": triggered_at.isoformat(),
        "status": "pending",
    }


# ---------------------------------------------------------------------------
# GET /admin/data-refresh/status
# ---------------------------------------------------------------------------

@router.get(
    "/data-refresh/status",
    status_code=status.HTTP_200_OK,
)
def get_data_refresh_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Return last data refresh status. Admin only. REQ-080"""
    return {
        "task_id": _last_refresh.get("task_id"),
        "triggered_at": _last_refresh.get("triggered_at"),
        "status": _last_refresh.get("status", "idle"),
    }


# ---------------------------------------------------------------------------
# User management CRUD (SEC-01, SEC-02)
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List all active users. Admin only."""
    return db.query(User).filter(User.is_active == True).all()  # noqa: E712


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    response_model=UserAdminResponse,
)
def create_user(
    payload: UserCreateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Create a new user account. Admin only."""
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        display_name=payload.display_name,
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    return user


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Update a user's profile or role. Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.role is not None:
        user.role = payload.role
    if payload.password is not None:
        user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Soft-delete a user (set is_active=False). Admin only. Self-delete blocked."""
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    user.is_active = False
    db.commit()
