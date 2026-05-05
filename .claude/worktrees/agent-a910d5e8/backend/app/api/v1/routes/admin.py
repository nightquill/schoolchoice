"""
app/api/v1/routes/admin.py

Admin endpoints — data refresh trigger.
REQ-080
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db

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
