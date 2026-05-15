"""
app/api/v1/routes/admin.py

Admin endpoints — data refresh trigger.
REQ-080
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_current_user, require_role
from app.core.security import get_password_hash
from app.db.models import CohortPermission, OrganisationMembership, User
from app.db.session import get_db
from app.modules.school_choice.models.models import StudentCohort
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
    Re-execute seed_schools.sql to refresh school data from canonical source.
    Uses the same _run_sql_file / engine pattern as main.py startup seeding.
    """
    from pathlib import Path
    from app.db.session import engine
    from app.main import _run_sql_file

    _last_refresh["status"] = "running"
    try:
        seed_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "seed"
        schools_sql_path = seed_dir / "seed_schools.sql"
        if schools_sql_path.exists():
            with engine.connect() as conn:
                _run_sql_file(conn, schools_sql_path)
        _last_refresh["status"] = "complete"
    except Exception as exc:
        _last_refresh["status"] = f"failed: {exc}"


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


@router.get("/users")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List all active users (paginated). Admin only."""
    query = db.query(User).filter(User.is_active == True)  # noqa: E712
    total = query.count()
    users = query.offset(skip).limit(limit).all()
    return {"items": [UserAdminResponse.model_validate(u).model_dump() for u in users], "total": total}


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

    if payload.organisation_id:
        from app.db.models import OrganisationMembership, Organisation

        org = db.query(Organisation).filter(Organisation.id == payload.organisation_id).first()
        if org:
            membership = OrganisationMembership(
                organisation_id=payload.organisation_id,
                user_id=user.id,
                role="member",
            )
            db.add(membership)
            db.commit()

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
    if payload.can_manage_cohorts is not None:
        user.can_manage_cohorts = payload.can_manage_cohorts
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


# ---------------------------------------------------------------------------
# POST /admin/users/{user_id}/reset-password — generate new random password
# ---------------------------------------------------------------------------

@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Reset a user's password to a new random value. Admin only. Returns the new password once."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    import secrets, string
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    new_password = "".join(secrets.choice(alphabet) for _ in range(8))

    user.hashed_password = get_password_hash(new_password)
    user.must_change_password = True
    db.commit()

    return {
        "user_id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "new_password": new_password,
    }


# ---------------------------------------------------------------------------
# POST /admin/data-refresh/preview
# ---------------------------------------------------------------------------

@router.post("/data-refresh/preview", status_code=200)
def preview_data_refresh(
    file: UploadFile = File(...),
    entity_type: str = Query(..., description="schools | subjects"),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Preview diff between uploaded CSV and existing records before publishing."""
    import csv
    import io

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    new_rows = list(reader)

    if entity_type == "schools":
        from app.modules.school_choice.models.models import School
        existing = {s.name: s for s in db.query(School).all()}
        key_field = "name"
    elif entity_type == "subjects":
        from app.modules.school_choice.models.models import Subject
        existing = {s.code: s for s in db.query(Subject).all()}
        key_field = "code"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown entity_type: {entity_type}")

    added, updated, unchanged = [], [], 0
    for row in new_rows:
        key = row.get(key_field, "").strip()
        if not key:
            continue
        if key in existing:
            changes = {}
            for col, val in row.items():
                if hasattr(existing[key], col):
                    old_val = str(getattr(existing[key], col) or "")
                    if old_val != val:
                        changes[col] = {"old": old_val, "new": val}
            if changes:
                updated.append({"key": key, "changes": changes})
            else:
                unchanged += 1
        else:
            added.append({"key": key, "fields": dict(row)})

    return {
        "entity_type": entity_type,
        "total_rows": len(new_rows),
        "added": len(added),
        "updated": len(updated),
        "unchanged": unchanged,
        "added_preview": added[:20],
        "updated_preview": updated[:20],
    }


# ---------------------------------------------------------------------------
# Cohort permission management (SEC-03)
# ---------------------------------------------------------------------------


@router.get("/cohorts/{cohort_id}/permissions")
def list_cohort_permissions(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List users with their permission level for a cohort. Admin only."""
    cohort = db.query(StudentCohort).filter(StudentCohort.id == cohort_id).first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")

    perms = (
        db.query(CohortPermission, User)
        .join(User, CohortPermission.user_id == User.id)
        .filter(CohortPermission.cohort_id == cohort_id)
        .all()
    )

    return {
        "permissions": [
            {
                "user_id": str(u.id),
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "permission": cp.permission,
            }
            for cp, u in perms
        ]
    }


@router.put("/cohorts/{cohort_id}/permissions")
def set_cohort_permission(
    cohort_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Set or update a user's permission on a cohort. Admin only."""
    user_id_str = payload.get("user_id")
    permission = payload.get("permission")

    if not user_id_str or permission not in ("read_write", "read_only"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Required: user_id (UUID) and permission ('read_write' | 'read_only')",
        )

    try:
        target_user_id = UUID(str(user_id_str))
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user_id")

    cohort = db.query(StudentCohort).filter(StudentCohort.id == cohort_id).first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")

    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = (
        db.query(CohortPermission)
        .filter(CohortPermission.user_id == target_user_id, CohortPermission.cohort_id == cohort_id)
        .first()
    )

    if existing:
        existing.permission = permission
    else:
        cp = CohortPermission(user_id=target_user_id, cohort_id=cohort_id, permission=permission)
        db.add(cp)

    db.commit()

    return {"user_id": str(target_user_id), "cohort_id": str(cohort_id), "permission": permission}


@router.delete("/cohorts/{cohort_id}/permissions/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_cohort_permission(
    cohort_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Remove a user's cohort-specific permission override. Admin only."""
    cp = (
        db.query(CohortPermission)
        .filter(CohortPermission.user_id == user_id, CohortPermission.cohort_id == cohort_id)
        .first()
    )
    if not cp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission override not found")

    db.delete(cp)
    db.commit()


@router.get("/users-with-permissions")
def list_users_with_permissions(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List all counsellor/admin users with org-level permission and cohort overrides. Admin only."""
    users = (
        db.query(User)
        .filter(User.is_active == True, User.role.in_(["admin", "counsellor"]))  # noqa: E712
        .all()
    )

    result = []
    for u in users:
        # Get org-level permission from membership
        membership = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == u.id).first()
        org_permission = membership.permission if membership else "read_write"

        # Get cohort-level overrides
        cohort_perms = (
            db.query(CohortPermission, StudentCohort)
            .join(StudentCohort, CohortPermission.cohort_id == StudentCohort.id)
            .filter(CohortPermission.user_id == u.id)
            .all()
        )

        result.append({
            "id": str(u.id),
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "org_permission": org_permission,
            "cohort_permissions": [
                {
                    "cohort_id": str(sc.id),
                    "cohort_name": sc.name,
                    "permission": cp.permission,
                }
                for cp, sc in cohort_perms
            ],
        })

    return {"users": result}


# ---------------------------------------------------------------------------
# Submission rate limit setting
# ---------------------------------------------------------------------------

@router.get("/settings/submission-rate-limit")
def get_submission_rate_limit(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get the current submission rate limit per student per 24h."""
    from app.db.models import Organisation, OrganisationMembership
    import json as _json

    membership = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == current_user.id).first()
    if not membership:
        return {"rate_limit": 3}
    org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
    if not org or not org.metadata_:
        return {"rate_limit": 3}
    try:
        meta = _json.loads(org.metadata_) if isinstance(org.metadata_, str) else {}
        return {"rate_limit": meta.get("submission_rate_limit", 3)}
    except (ValueError, TypeError):
        return {"rate_limit": 3}


@router.put("/settings/submission-rate-limit")
def set_submission_rate_limit(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Set submission rate limit per student per 24h. Admin only."""
    from app.db.models import Organisation, OrganisationMembership
    import json as _json

    limit = payload.get("rate_limit")
    if not isinstance(limit, int) or limit < 1 or limit > 100:
        raise HTTPException(status_code=422, detail="rate_limit must be an integer between 1 and 100")

    membership = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == current_user.id).first()
    if not membership:
        raise HTTPException(status_code=404, detail="No organisation found")

    org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    try:
        meta = _json.loads(org.metadata_) if org.metadata_ and isinstance(org.metadata_, str) else {}
    except (ValueError, TypeError):
        meta = {}

    meta["submission_rate_limit"] = limit
    org.metadata_ = _json.dumps(meta)
    db.commit()

    return {"rate_limit": limit}


# ---------------------------------------------------------------------------
# Plan detail level setting
# ---------------------------------------------------------------------------

@router.get("/settings/plan-detail-level")
def get_plan_detail_level(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from app.db.models import Organisation, OrganisationMembership
    import json as _json

    org_id = getattr(current_user, "active_organisation_id", None)
    if not org_id:
        return {"level": "A"}
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        return {"level": "A"}
    try:
        meta = _json.loads(org.metadata_) if isinstance(org.metadata_, str) else (org.metadata_ or {})
        return {"level": meta.get("plan_detail_level", "A")}
    except (ValueError, TypeError):
        return {"level": "A"}


@router.put("/settings/plan-detail-level")
def set_plan_detail_level(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    from app.db.models import Organisation, OrganisationMembership
    import json as _json

    level = payload.get("level", "A")
    if level not in ("A", "B", "C"):
        raise HTTPException(status_code=400, detail="level must be A, B, or C")
    org_id = getattr(current_user, "active_organisation_id", None)
    if not org_id:
        raise HTTPException(status_code=400, detail="No active organisation")
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    try:
        meta = _json.loads(org.metadata_) if isinstance(org.metadata_, str) else (org.metadata_ or {})
    except (ValueError, TypeError):
        meta = {}
    meta["plan_detail_level"] = level
    org.metadata_ = _json.dumps(meta)
    db.commit()
    return {"level": level}
