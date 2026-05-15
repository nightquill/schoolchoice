# Cohort-Based Feature Permissions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add teacher groups with cohort-level, per-tool permission controls. Admin manages permissions by group. Teacher UI reflects permissions (hidden/read-only/full).

**Architecture:** New TeacherGroup + TeacherGroupMember models. Modify CohortPermission to link to groups (not users) with per-tool columns. New permission_service.py resolves effective permissions by merging across groups (most permissive wins). Frontend caches permissions via GET /account/permissions and uses a usePermission hook.

**Tech Stack:** Python/FastAPI, SQLAlchemy, React, TanStack Query

**Spec:** `docs/superpowers/specs/2026-05-15-cohort-permissions-design.md`

---

## File Structure

| File | Role |
|------|------|
| `backend/app/db/models.py` | Modify: add TeacherGroup, TeacherGroupMember, rebuild CohortPermission |
| `backend/app/services/permission_service.py` | Create: permission resolution logic |
| `backend/app/api/v1/routes/teacher_groups.py` | Create: group CRUD + member + permission endpoints |
| `backend/app/api/v1/routes/account.py` | Modify: add GET /account/permissions |
| `backend/app/api/v1/routes/students.py` | Modify: filter by visibility |
| `backend/app/core/dependencies.py` | Modify: update check_write_permission, add require_feature_permission |
| `backend/app/main.py` | Modify: register teacher_groups router |
| `backend/tests/test_permissions.py` | Create: permission resolution tests |
| `apps/web/src/api/teacherGroups.js` | Create: API client |
| `apps/web/src/hooks/usePermission.js` | Create: permission hook |
| `apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx` | Create: group management page |
| `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` | Create: permission grid |
| `apps/web/src/App.jsx` | Modify: add route |

---

### Task 1: Data models — TeacherGroup, TeacherGroupMember, CohortPermission rebuild

**Files:**
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Add TeacherGroup and TeacherGroupMember models**

In `backend/app/db/models.py`, before the existing `CohortPermission` class (around line 325), add:

```python
# ---------------------------------------------------------------------------
# teacher_groups — groups of teachers for permission management
# ---------------------------------------------------------------------------


class TeacherGroup(Base):
    """A named group of teachers. Permissions are assigned to groups, not individual users."""

    __tablename__ = "teacher_groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    organisation_id = Column(UUID(as_uuid=True), ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)

    members = relationship("TeacherGroupMember", back_populates="group", cascade="all, delete-orphan")
    permissions = relationship("CohortPermission", back_populates="group", cascade="all, delete-orphan")


class TeacherGroupMember(Base):
    """Links a user to a teacher group."""

    __tablename__ = "teacher_group_members"

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_tgm_group_user"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    group_id = Column(UUID(as_uuid=True), ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    group = relationship("TeacherGroup", back_populates="members")
```

- [ ] **Step 2: Replace CohortPermission with group-based version**

Replace the entire existing `CohortPermission` class with:

```python
# ---------------------------------------------------------------------------
# cohort_permissions — per-cohort, per-tool access for teacher groups
# ---------------------------------------------------------------------------

TOOL_ACCESS_LEVELS = ("none", "read_only", "read_write")


class CohortPermission(Base):
    """Per-cohort permission for a teacher group. Controls visibility and per-tool access levels."""

    __tablename__ = "cohort_permissions"

    __table_args__ = (
        UniqueConstraint("group_id", "cohort_id", name="uq_cohort_perm_group_cohort"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    group_id = Column(UUID(as_uuid=True), ForeignKey("teacher_groups.id", ondelete="CASCADE"), nullable=False)
    cohort_id = Column(UUID(as_uuid=True), ForeignKey("student_cohorts.id", ondelete="CASCADE"), nullable=False)

    visible = Column(Boolean, nullable=False, default=True, server_default="true",
                     comment="Can users in this group see students in this cohort?")

    # Per-tool access: none | read_only | read_write
    programme_choices = Column(String(10), nullable=False, default="read_write", server_default="'read_write'")
    grades = Column(String(10), nullable=False, default="read_write", server_default="'read_write'")
    plan_generation = Column(String(10), nullable=False, default="read_write", server_default="'read_write'")
    submissions = Column(String(10), nullable=False, default="read_write", server_default="'read_write'")
    reports = Column(String(10), nullable=False, default="read_only", server_default="'read_only'")
    cohort_management = Column(String(10), nullable=False, default="none", server_default="'none'")

    group = relationship("TeacherGroup", back_populates="permissions")
```

- [ ] **Step 3: Create tables in DB**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "
from app.db.session import engine
from sqlalchemy import text, inspect
insp = inspect(engine)
tables = insp.get_table_names()
with engine.connect() as conn:
    # Drop old cohort_permissions (minimal data, will be re-set by admin)
    if 'cohort_permissions' in tables:
        conn.execute(text('DROP TABLE IF EXISTS cohort_permissions'))
        print('Dropped old cohort_permissions')

    # Create new tables
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS teacher_groups (
            id VARCHAR(36) PRIMARY KEY,
            organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    '''))
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS teacher_group_members (
            id VARCHAR(36) PRIMARY KEY,
            group_id VARCHAR(36) NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id)
        )
    '''))
    conn.execute(text('''
        CREATE TABLE IF NOT EXISTS cohort_permissions (
            id VARCHAR(36) PRIMARY KEY,
            group_id VARCHAR(36) NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
            cohort_id VARCHAR(36) NOT NULL REFERENCES student_cohorts(id) ON DELETE CASCADE,
            visible BOOLEAN NOT NULL DEFAULT 1,
            programme_choices VARCHAR(10) NOT NULL DEFAULT 'read_write',
            grades VARCHAR(10) NOT NULL DEFAULT 'read_write',
            plan_generation VARCHAR(10) NOT NULL DEFAULT 'read_write',
            submissions VARCHAR(10) NOT NULL DEFAULT 'read_write',
            reports VARCHAR(10) NOT NULL DEFAULT 'read_only',
            cohort_management VARCHAR(10) NOT NULL DEFAULT 'none',
            UNIQUE(group_id, cohort_id)
        )
    '''))
    conn.commit()
    print('Created teacher_groups, teacher_group_members, cohort_permissions')
"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat: add TeacherGroup, TeacherGroupMember, rebuild CohortPermission with per-tool columns"
```

---

### Task 2: Permission service — resolution logic

**Files:**
- Create: `backend/app/services/permission_service.py`
- Create: `backend/tests/test_permissions.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_permissions.py`:

```python
"""Tests for permission resolution logic."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import pytest
from app.services.permission_service import (
    merge_permissions,
    TOOL_FIELDS,
    ROLE_DEFAULTS,
)


class TestMergePermissions:
    """Test the most-permissive-wins merge logic."""

    def test_single_permission(self):
        perms = [{"visible": True, "grades": "read_only", "submissions": "none"}]
        result = merge_permissions(perms)
        assert result["visible"] is True
        assert result["grades"] == "read_only"
        assert result["submissions"] == "none"

    def test_most_permissive_wins(self):
        perms = [
            {"visible": True, "grades": "read_only", "submissions": "none", "programme_choices": "read_write"},
            {"visible": True, "grades": "read_write", "submissions": "read_only", "programme_choices": "none"},
        ]
        result = merge_permissions(perms)
        assert result["grades"] == "read_write"
        assert result["submissions"] == "read_only"
        assert result["programme_choices"] == "read_write"

    def test_visible_true_wins(self):
        perms = [
            {"visible": False, "grades": "none"},
            {"visible": True, "grades": "read_only"},
        ]
        result = merge_permissions(perms)
        assert result["visible"] is True

    def test_empty_returns_defaults(self):
        result = merge_permissions([])
        assert result["visible"] is False
        for f in TOOL_FIELDS:
            assert result[f] == "none"

    def test_invisible_overrides_tools_in_single_perm(self):
        """A single permission with visible=False: tools should report as-is (backend enforces visibility separately)."""
        perms = [{"visible": False, "grades": "read_write"}]
        result = merge_permissions(perms)
        assert result["visible"] is False
        assert result["grades"] == "read_write"  # stored value; backend checks visibility first


class TestRoleDefaults:
    def test_admin_defaults(self):
        d = ROLE_DEFAULTS["admin"]
        assert d["visible"] is True
        for f in TOOL_FIELDS:
            assert d[f] == "read_write"

    def test_counsellor_defaults(self):
        d = ROLE_DEFAULTS["counsellor"]
        assert d["visible"] is True
        assert d["grades"] == "read_write"
        assert d["cohort_management"] == "none"

    def test_student_defaults(self):
        d = ROLE_DEFAULTS["student"]
        assert d["visible"] is True
        assert d["grades"] == "read_only"
        assert d["plan_generation"] == "none"
```

- [ ] **Step 2: Implement permission service**

Create `backend/app/services/permission_service.py`:

```python
"""
app/services/permission_service.py

Resolves effective permissions for a user by merging across teacher groups.
Most permissive wins when multiple groups grant different access to the same cohort.
"""
from __future__ import annotations

from uuid import UUID
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import (
    User, CohortPermission, TeacherGroup, TeacherGroupMember,
)
from app.db.models_v2 import CohortMembership, StudentCohort


# The fixed tool fields on CohortPermission
TOOL_FIELDS = (
    "programme_choices", "grades", "plan_generation",
    "submissions", "reports", "cohort_management",
)

_ACCESS_RANK = {"none": 0, "read_only": 1, "read_write": 2}

# Role defaults when no CohortPermission exists
ROLE_DEFAULTS = {
    "admin": {
        "visible": True,
        **{f: "read_write" for f in TOOL_FIELDS},
    },
    "counsellor": {
        "visible": True,
        "programme_choices": "read_write",
        "grades": "read_write",
        "plan_generation": "read_write",
        "submissions": "read_write",
        "reports": "read_only",
        "cohort_management": "none",
    },
    "student": {
        "visible": True,
        "programme_choices": "read_only",
        "grades": "read_only",
        "plan_generation": "none",
        "submissions": "read_write",
        "reports": "none",
        "cohort_management": "none",
    },
}


def merge_permissions(perms: list[dict]) -> dict:
    """Merge multiple CohortPermission dicts. Most permissive wins.

    Args:
        perms: List of dicts with 'visible' (bool) and tool fields (str).

    Returns:
        Merged dict with the most permissive value for each field.
    """
    if not perms:
        return {"visible": False, **{f: "none" for f in TOOL_FIELDS}}

    merged = {"visible": False}
    for f in TOOL_FIELDS:
        merged[f] = "none"

    for p in perms:
        if p.get("visible", False):
            merged["visible"] = True
        for f in TOOL_FIELDS:
            current_rank = _ACCESS_RANK.get(merged[f], 0)
            new_rank = _ACCESS_RANK.get(p.get(f, "none"), 0)
            if new_rank > current_rank:
                merged[f] = p[f]

    return merged


def _get_user_group_ids(user_id: UUID, db: Session) -> list[UUID]:
    """Get all teacher group IDs the user belongs to."""
    rows = db.query(TeacherGroupMember.group_id).filter(
        TeacherGroupMember.user_id == user_id,
    ).all()
    return [r[0] for r in rows]


def _get_cohort_permissions_for_groups(
    group_ids: list[UUID], cohort_id: UUID, db: Session,
) -> list[dict]:
    """Get all CohortPermission rows for the given groups and cohort."""
    if not group_ids:
        return []
    rows = db.query(CohortPermission).filter(
        CohortPermission.group_id.in_(group_ids),
        CohortPermission.cohort_id == cohort_id,
    ).all()
    return [
        {
            "visible": r.visible,
            **{f: getattr(r, f) for f in TOOL_FIELDS},
        }
        for r in rows
    ]


def check_feature_permission(
    user: User, db: Session, student_id: UUID, feature: str,
) -> str:
    """Check a user's effective permission for a feature on a specific student.

    Returns 'read_write', 'read_only', or 'none'.
    Admin always returns 'read_write'.
    """
    if user.role == "admin":
        return "read_write"

    # Find cohorts this student belongs to
    cohort_ids = [
        cm.cohort_id for cm in db.query(CohortMembership.cohort_id).filter(
            CohortMembership.student_id == student_id,
        ).all()
    ]

    if not cohort_ids:
        # Student not in any cohort — use role defaults
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    group_ids = _get_user_group_ids(user.id, db)

    if not group_ids:
        # User not in any group — use role defaults
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    # Merge across all cohorts the student is in
    all_perms = []
    for cid in cohort_ids:
        all_perms.extend(_get_cohort_permissions_for_groups(group_ids, cid, db))

    if not all_perms:
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    merged = merge_permissions(all_perms)

    # If not visible, all tools are none
    if not merged["visible"]:
        return "none"

    return merged.get(feature, "none")


def get_visible_student_ids(user: User, db: Session) -> Optional[set[UUID]]:
    """Get the set of student IDs visible to this user.

    Returns None for admin (= no filter, see everything).
    Returns a set of student IDs for other roles.
    """
    if user.role == "admin":
        return None  # No filter

    group_ids = _get_user_group_ids(user.id, db)

    if not group_ids:
        return None  # No groups = role default = see all in org (existing behavior)

    # Find cohorts where any of user's groups have visible=True
    visible_cohort_ids = [
        r.cohort_id for r in db.query(CohortPermission.cohort_id).filter(
            CohortPermission.group_id.in_(group_ids),
            CohortPermission.visible.is_(True),
        ).all()
    ]

    if not visible_cohort_ids:
        return set()  # In groups but no visible cohorts

    # Get student IDs in those cohorts
    student_ids = {
        cm.student_id for cm in db.query(CohortMembership.student_id).filter(
            CohortMembership.cohort_id.in_(visible_cohort_ids),
        ).all()
    }

    return student_ids


def resolve_user_permissions(user: User, db: Session) -> list[dict]:
    """Resolve the full cohort permission matrix for a user.

    Returns list of {cohort_id, cohort_name, visible, <tool_fields>...}
    Admin gets all cohorts with read_write.
    """
    org_id = getattr(user, "active_organisation_id", None)

    # Get all cohorts in org
    cohorts = db.query(StudentCohort).filter(
        StudentCohort.organisation_id == org_id,
    ).all() if org_id else []

    if user.role == "admin":
        return [
            {
                "cohort_id": str(c.id),
                "cohort_name": c.name,
                "visible": True,
                **{f: "read_write" for f in TOOL_FIELDS},
            }
            for c in cohorts
        ]

    group_ids = _get_user_group_ids(user.id, db)
    defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])

    result = []
    for c in cohorts:
        if group_ids:
            perms = _get_cohort_permissions_for_groups(group_ids, c.id, db)
            if perms:
                merged = merge_permissions(perms)
            else:
                merged = dict(defaults)
        else:
            merged = dict(defaults)

        result.append({
            "cohort_id": str(c.id),
            "cohort_name": c.name,
            **merged,
        })

    return result
```

- [ ] **Step 3: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_permissions.py -v`
Expected: All 8 tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/permission_service.py backend/tests/test_permissions.py
git commit -m "feat: add permission service — merge logic, feature check, visibility"
```

---

### Task 3: Teacher group API routes

**Files:**
- Create: `backend/app/api/v1/routes/teacher_groups.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create teacher group routes**

Create `backend/app/api/v1/routes/teacher_groups.py`:

```python
"""
app/api/v1/routes/teacher_groups.py

Teacher group CRUD, member management, and cohort permission management.
All endpoints admin-only.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.db.models import (
    CohortPermission, TeacherGroup, TeacherGroupMember, User,
)
from app.db.models_v2 import StudentCohort
from app.db.session import get_db
from app.services.permission_service import TOOL_FIELDS

router = APIRouter(prefix="/admin/teacher-groups", tags=["teacher-groups"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GroupCreate(BaseModel):
    name: str
    description: str | None = None

class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class MembersAdd(BaseModel):
    user_ids: list[str]

class CohortPermissionSet(BaseModel):
    cohort_id: str
    visible: bool = True
    programme_choices: str = "read_write"
    grades: str = "read_write"
    plan_generation: str = "read_write"
    submissions: str = "read_write"
    reports: str = "read_only"
    cohort_management: str = "none"

class PermissionsUpdate(BaseModel):
    permissions: list[CohortPermissionSet]


# ---------------------------------------------------------------------------
# Group CRUD
# ---------------------------------------------------------------------------

@router.get("")
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all teacher groups with member counts."""
    org_id = getattr(current_user, "active_organisation_id", None)
    groups = db.query(TeacherGroup).filter(
        TeacherGroup.organisation_id == org_id,
    ).order_by(TeacherGroup.name).all()

    return {
        "groups": [
            {
                "id": str(g.id),
                "name": g.name,
                "description": g.description,
                "member_count": len(g.members),
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in groups
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group(
    body: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new teacher group."""
    org_id = getattr(current_user, "active_organisation_id", None)
    group = TeacherGroup(
        organisation_id=org_id,
        name=body.name,
        description=body.description,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {"id": str(group.id), "name": group.name, "description": group.description}


@router.put("/{group_id}")
def update_group(
    group_id: UUID,
    body: GroupUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Update a teacher group."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.name is not None:
        group.name = body.name
    if body.description is not None:
        group.description = body.description
    db.commit()
    return {"id": str(group.id), "name": group.name, "description": group.description}


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Delete a teacher group. Cascades members and permissions."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------

@router.get("/{group_id}/members")
def list_members(
    group_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List members of a teacher group."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    members = []
    for m in group.members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            members.append({
                "user_id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "role": user.role,
            })
    return {"members": members}


@router.post("/{group_id}/members")
def add_members(
    group_id: UUID,
    body: MembersAdd,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Add users to a teacher group."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    added = 0
    already = 0
    for uid in body.user_ids:
        existing = db.query(TeacherGroupMember).filter(
            TeacherGroupMember.group_id == group_id,
            TeacherGroupMember.user_id == uid,
        ).first()
        if existing:
            already += 1
            continue
        db.add(TeacherGroupMember(group_id=group_id, user_id=uid))
        added += 1
    db.commit()
    return {"added": added, "already_member": already}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Remove a user from a teacher group."""
    mem = db.query(TeacherGroupMember).filter(
        TeacherGroupMember.group_id == group_id,
        TeacherGroupMember.user_id == user_id,
    ).first()
    if mem:
        db.delete(mem)
        db.commit()


# ---------------------------------------------------------------------------
# Cohort permissions
# ---------------------------------------------------------------------------

@router.get("/{group_id}/permissions")
def get_permissions(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get cohort permissions for a teacher group. Returns all org cohorts with current settings."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    org_id = getattr(current_user, "active_organisation_id", None)
    cohorts = db.query(StudentCohort).filter(
        StudentCohort.organisation_id == org_id,
    ).order_by(StudentCohort.name).all()

    # Get existing permissions for this group
    existing = {
        p.cohort_id: p
        for p in db.query(CohortPermission).filter(
            CohortPermission.group_id == group_id,
        ).all()
    }

    result = []
    for c in cohorts:
        p = existing.get(c.id)
        result.append({
            "cohort_id": str(c.id),
            "cohort_name": c.name,
            "visible": p.visible if p else True,
            **{f: getattr(p, f) if p else "read_write" for f in TOOL_FIELDS},
        })

    return {"permissions": result}


@router.put("/{group_id}/permissions")
def set_permissions(
    group_id: UUID,
    body: PermissionsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Bulk set cohort permissions for a teacher group."""
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    updated = 0
    for item in body.permissions:
        existing = db.query(CohortPermission).filter(
            CohortPermission.group_id == group_id,
            CohortPermission.cohort_id == item.cohort_id,
        ).first()

        if existing:
            existing.visible = item.visible
            for f in TOOL_FIELDS:
                setattr(existing, f, getattr(item, f))
        else:
            perm = CohortPermission(
                group_id=group_id,
                cohort_id=item.cohort_id,
                visible=item.visible,
                **{f: getattr(item, f) for f in TOOL_FIELDS},
            )
            db.add(perm)
        updated += 1

    db.commit()
    return {"updated": updated}
```

- [ ] **Step 2: Register router in main.py**

Add import after existing router imports:
```python
from app.api.v1.routes.teacher_groups import router as teacher_groups_router
```

Add include after existing router includes:
```python
app.include_router(teacher_groups_router, prefix="/api/v1")
```

- [ ] **Step 3: Verify backend starts**

```bash
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "from app.main import app; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/teacher_groups.py backend/app/main.py
git commit -m "feat: add teacher group API routes — CRUD, members, permissions"
```

---

### Task 4: Add GET /account/permissions and update student visibility

**Files:**
- Modify: `backend/app/api/v1/routes/account.py`
- Modify: `backend/app/api/v1/routes/students.py`

- [ ] **Step 1: Add permissions endpoint to account.py**

Add to `backend/app/api/v1/routes/account.py` after the delete_account endpoint:

```python
# ---------------------------------------------------------------------------
# GET /account/permissions — resolved cohort permissions for current user
# ---------------------------------------------------------------------------

@router.get("/permissions")
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the resolved cohort permission matrix for the current user."""
    from app.services.permission_service import resolve_user_permissions
    user = db.merge(current_user)
    perms = resolve_user_permissions(user, db)
    return {"cohorts": perms}
```

- [ ] **Step 2: Add visibility filter to student list**

In `backend/app/api/v1/routes/students.py`, in the `list_students` function, after getting `all_students` and before the pagination slice, add visibility filtering:

```python
    # Apply visibility filter based on teacher group permissions
    from app.services.permission_service import get_visible_student_ids
    visible_ids = get_visible_student_ids(current_user, db)
    if visible_ids is not None:
        all_students = [s for s in all_students if s.id in visible_ids]
    total = len(all_students)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/account.py backend/app/api/v1/routes/students.py
git commit -m "feat: add GET /account/permissions and visibility filter on student list"
```

---

### Task 5: Update dependencies.py — require_feature_permission

**Files:**
- Modify: `backend/app/core/dependencies.py`

- [ ] **Step 1: Add require_feature_permission factory**

Add after the existing `require_write_permission` function in `backend/app/core/dependencies.py`:

```python
def require_feature_permission(feature: str, level: str = "read_write"):
    """Factory: returns a dependency that checks cohort-based feature permission.

    Usage:
        @router.post("/students/{student_id}/grades",
                      dependencies=[Depends(require_feature_permission("grades"))])
    """
    def _check(
        request: "Request",
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from fastapi import Request
        from app.services.permission_service import check_feature_permission as _check_perm

        # Extract student_id from path params
        sid = request.path_params.get("student_id")
        if sid:
            try:
                sid = UUID(sid)
            except (ValueError, AttributeError):
                sid = None

        if sid is None:
            # No student context — allow (list endpoints handle visibility separately)
            return current_user

        perm = _check_perm(current_user, db, student_id=sid, feature=feature)

        if perm == "none":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have access to {feature} for this student.",
            )
        if level == "read_write" and perm == "read_only":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have read-only access to {feature} for this student.",
            )

        return current_user
    return _check
```

- [ ] **Step 2: Update check_write_permission to use group-based system**

Replace the existing `check_write_permission` function body to route through the new permission service:

```python
def check_write_permission(
    user: User,
    db: Session,
    student_id: Optional[UUID] = None,
) -> bool:
    """Check if user has write permission for a student.

    Uses the new group-based permission system. Falls back to True for admin.
    """
    if user.role == "admin":
        return True

    if student_id is None:
        return True  # No student context, allow (visibility handles list filtering)

    from app.services.permission_service import check_feature_permission
    # Check grades as the general "write" proxy
    perm = check_feature_permission(user, db, student_id=student_id, feature="grades")
    return perm == "read_write"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/dependencies.py
git commit -m "feat: add require_feature_permission dependency and update write permission check"
```

---

### Task 6: Frontend — API client, permission hook, admin pages

**Files:**
- Create: `apps/web/src/api/teacherGroups.js`
- Create: `apps/web/src/hooks/usePermission.js`
- Create: `apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx`
- Create: `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`
- Modify: `apps/web/src/App.jsx`

- [ ] **Step 1: Create API client**

Create `apps/web/src/api/teacherGroups.js`:

```javascript
import { get, post, put, del } from './helpers';

export const getTeacherGroups = () => get('/api/v1/admin/teacher-groups');
export const createTeacherGroup = (data) => post('/api/v1/admin/teacher-groups', data);
export const updateTeacherGroup = (id, data) => put(`/api/v1/admin/teacher-groups/${id}`, data);
export const deleteTeacherGroup = (id) => del(`/api/v1/admin/teacher-groups/${id}`);

export const getGroupMembers = (id) => get(`/api/v1/admin/teacher-groups/${id}/members`);
export const addGroupMembers = (id, userIds) => post(`/api/v1/admin/teacher-groups/${id}/members`, { user_ids: userIds });
export const removeGroupMember = (groupId, userId) => del(`/api/v1/admin/teacher-groups/${groupId}/members/${userId}`);

export const getGroupPermissions = (id) => get(`/api/v1/admin/teacher-groups/${id}/permissions`);
export const setGroupPermissions = (id, permissions) => put(`/api/v1/admin/teacher-groups/${id}/permissions`, { permissions });

export const getMyPermissions = () => get('/api/v1/account/permissions');
```

- [ ] **Step 2: Create permission hook**

Create `apps/web/src/hooks/usePermission.js`:

```javascript
import { useQuery } from '@tanstack/react-query';
import { getMyPermissions } from '../api/teacherGroups';

/**
 * Hook to get the current user's resolved permissions.
 * Returns the full permission matrix cached for the session.
 */
export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: getMyPermissions,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
  return { permissions: data?.cohorts ?? [], isLoading };
}

/**
 * Hook to check permission for a specific cohort + feature.
 * Returns 'none' | 'read_only' | 'read_write'.
 *
 * If cohortId is null, returns the most permissive across all cohorts.
 */
export function usePermission(cohortId, feature) {
  const { permissions, isLoading } = usePermissions();

  if (isLoading) return 'read_write'; // Optimistic while loading

  if (!cohortId) {
    // Most permissive across all cohorts
    const rank = { none: 0, read_only: 1, read_write: 2 };
    let best = 'none';
    for (const p of permissions) {
      if (!p.visible) continue;
      const val = p[feature] || 'none';
      if ((rank[val] || 0) > (rank[best] || 0)) best = val;
    }
    return best;
  }

  const perm = permissions.find(p => p.cohort_id === cohortId);
  if (!perm || !perm.visible) return 'none';
  return perm[feature] || 'none';
}

/**
 * Check if a cohort is visible to the current user.
 */
export function useCohortVisible(cohortId) {
  const { permissions } = usePermissions();
  if (!cohortId) return true;
  const perm = permissions.find(p => p.cohort_id === cohortId);
  return perm ? perm.visible : true;
}
```

- [ ] **Step 3: Create AdminTeacherGroups page**

Create `apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx`:

```jsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { toast } from 'sonner';
import { getAccount } from '@schoolchoice/ui/api/account';
import {
  getTeacherGroups, createTeacherGroup, deleteTeacherGroup,
  getGroupMembers, addGroupMembers, removeGroupMember,
} from '../../api/teacherGroups';
import GroupPermissions from './GroupPermissions';

export default function AdminTeacherGroups() {
  const qc = useQueryClient();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const groupsQuery = useQuery({ queryKey: ['teacher-groups'], queryFn: getTeacherGroups });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newName, setNewName] = useState('');
  const [addEmail, setAddEmail] = useState('');

  const groups = groupsQuery.data?.groups ?? [];
  const membersQuery = useQuery({
    queryKey: ['teacher-group-members', selectedGroup],
    queryFn: () => getGroupMembers(selectedGroup),
    enabled: !!selectedGroup,
  });
  const members = membersQuery.data?.members ?? [];

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTeacherGroup({ name: newName.trim() });
      setNewName('');
      qc.invalidateQueries({ queryKey: ['teacher-groups'] });
      toast.success('Group created');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this group? Members will lose their permissions.')) return;
    try {
      await deleteTeacherGroup(id);
      if (selectedGroup === id) setSelectedGroup(null);
      qc.invalidateQueries({ queryKey: ['teacher-groups'] });
      toast.success('Group deleted');
    } catch (e) { toast.error('Failed to delete'); }
  };

  const handleAddMember = async () => {
    // Admin enters user ID or email — for simplicity, pass as user_id
    // In a real UI this would be a user picker. For now, prompt for user ID.
    const uid = addEmail.trim();
    if (!uid) return;
    try {
      await addGroupMembers(selectedGroup, [uid]);
      setAddEmail('');
      qc.invalidateQueries({ queryKey: ['teacher-group-members', selectedGroup] });
      toast.success('Member added');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  const handleRemoveMember = async (uid) => {
    try {
      await removeGroupMember(selectedGroup, uid);
      qc.invalidateQueries({ queryKey: ['teacher-group-members', selectedGroup] });
      toast.success('Removed');
    } catch (e) { toast.error('Failed'); }
  };

  const cardStyle = {
    background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-background)', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data} />
      <main id="main-content" className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          Teacher Groups & Permissions
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
          {/* Left: Group list */}
          <div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-3)' }}>Groups</h3>
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => setSelectedGroup(g.id)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderRadius: 'var(--border-radius-sm)',
                    background: selectedGroup === g.id ? 'var(--color-primary-50, #eff6ff)' : 'transparent',
                    marginBottom: '2px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>{g.name}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{g.member_count} members</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(g.id); }}
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer', border: 'none', background: 'none' }}>
                    x
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New group name" style={{ flex: 1, fontSize: 'var(--font-size-sm)' }} />
                <Button onClick={handleCreate} style={{ fontSize: 'var(--font-size-sm)' }}>Add</Button>
              </div>
            </div>
          </div>

          {/* Right: Selected group details */}
          <div>
            {selectedGroup ? (
              <>
                {/* Members */}
                <div style={cardStyle}>
                  <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-3)' }}>Members</h3>
                  {members.map(m => (
                    <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 'var(--font-size-sm)' }}>
                      <span>{m.display_name || m.email} <span style={{ color: 'var(--color-text-secondary)' }}>({m.role})</span></span>
                      <button onClick={() => handleRemoveMember(m.user_id)} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', cursor: 'pointer', border: 'none', background: 'none' }}>Remove</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                    <Input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="User ID to add" style={{ flex: 1, fontSize: 'var(--font-size-sm)' }} />
                    <Button onClick={handleAddMember} style={{ fontSize: 'var(--font-size-sm)' }}>Add</Button>
                  </div>
                </div>

                {/* Permissions grid */}
                <GroupPermissions groupId={selectedGroup} />
              </>
            ) : (
              <div style={cardStyle}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Select a group to manage members and permissions.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create GroupPermissions grid component**

Create `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@schoolchoice/ui/primitives/button';
import { toast } from 'sonner';
import { getGroupPermissions, setGroupPermissions } from '../../api/teacherGroups';

const TOOLS = [
  { key: 'programme_choices', label: 'Programmes' },
  { key: 'grades', label: 'Grades' },
  { key: 'plan_generation', label: 'Plans' },
  { key: 'submissions', label: 'Submissions' },
  { key: 'reports', label: 'Reports' },
  { key: 'cohort_management', label: 'Cohort Mgmt' },
];

const ACCESS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'read_only', label: 'View' },
  { value: 'read_write', label: 'Edit' },
];

export default function GroupPermissions({ groupId }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['group-permissions', groupId],
    queryFn: () => getGroupPermissions(groupId),
    enabled: !!groupId,
  });
  const [local, setLocal] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.permissions) setLocal(data.permissions.map(p => ({ ...p })));
  }, [data]);

  const update = (idx, field, value) => {
    setLocal(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setGroupPermissions(groupId, local);
      qc.invalidateQueries({ queryKey: ['group-permissions', groupId] });
      qc.invalidateQueries({ queryKey: ['my-permissions'] });
      toast.success('Permissions saved');
    } catch (e) { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Loading...</p>;

  const thStyle = {
    padding: '6px 8px', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
    color: 'var(--color-text-secondary)', textAlign: 'center', borderBottom: '1px solid var(--color-border)',
  };
  const tdStyle = { padding: '4px 4px', textAlign: 'center', borderBottom: '1px solid var(--color-border)' };
  const selectStyle = {
    fontSize: 'var(--font-size-xs)', padding: '2px 4px', border: '1px solid var(--color-border)',
    borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)',
  };

  return (
    <div style={{
      background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
      borderRadius: 'var(--border-radius-md)', padding: 'var(--space-4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>Cohort Permissions</h3>
        <Button onClick={handleSave} disabled={saving} style={{ fontSize: 'var(--font-size-sm)' }}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>Cohort</th>
              <th style={thStyle}>Visible</th>
              {TOOLS.map(t => <th key={t.key} style={thStyle}>{t.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {local.map((p, i) => (
              <tr key={p.cohort_id}>
                <td style={{ ...tdStyle, textAlign: 'left', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                  {p.cohort_name}
                </td>
                <td style={tdStyle}>
                  <input
                    type="checkbox" checked={p.visible}
                    onChange={e => update(i, 'visible', e.target.checked)}
                  />
                </td>
                {TOOLS.map(t => (
                  <td key={t.key} style={tdStyle}>
                    <select
                      value={p[t.key]} onChange={e => update(i, t.key, e.target.value)}
                      style={{ ...selectStyle, opacity: p.visible ? 1 : 0.4 }}
                      disabled={!p.visible}
                    >
                      {ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add route in App.jsx**

Add import:
```javascript
import AdminTeacherGroups from './pages/AdminTeacherGroups/AdminTeacherGroups';
```

Add route (admin, protected):
```jsx
<Route path="/admin/teacher-groups" element={<ProtectedRoute><AdminTeacherGroups /></ProtectedRoute>} />
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/teacherGroups.js apps/web/src/hooks/usePermission.js \
  apps/web/src/pages/AdminTeacherGroups/ apps/web/src/App.jsx
git commit -m "feat: add teacher group admin UI, permission grid, usePermission hook"
```

---

### Task 7: E2E verification — admin sets permissions, teacher sees changes

**Files:** None (verification only)

- [ ] **Step 1: Restart backend and create test data**

```bash
kill $(lsof -ti:8000) 2>/dev/null; sleep 1
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3
```

- [ ] **Step 2: Run E2E test script**

```bash
BASE="http://localhost:8000/api/v1"
PASS=0; FAIL=0
check() { if echo "$3" | grep -q "$2"; then echo "  PASS: $1"; PASS=$((PASS+1)); else echo "  FAIL: $1 (got: $(echo $3 | head -c 200))"; FAIL=$((FAIL+1)); fi; }

# Admin login
TOKEN=$(curl -sf -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
AUTH="Authorization: Bearer $TOKEN"

echo "=== 1. Create teacher group ==="
GRP=$(curl -sf -X POST "$BASE/admin/teacher-groups" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Form 5 Teachers","description":"Test group"}')
check "create group" "Form 5 Teachers" "$GRP"
GRP_ID=$(echo "$GRP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "=== 2. List groups ==="
GROUPS=$(curl -sf "$BASE/admin/teacher-groups" -H "$AUTH")
check "list groups" "Form 5 Teachers" "$GROUPS"

echo "=== 3. Add member ==="
# Get a counsellor/teacher user ID (not admin)
# For now, use admin's own ID for testing
ADMIN_ID=$(curl -sf "$BASE/account" -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
ADD=$(curl -sf -X POST "$BASE/admin/teacher-groups/$GRP_ID/members" -H "$AUTH" -H "Content-Type: application/json" -d "{\"user_ids\":[\"$ADMIN_ID\"]}")
check "add member" "added" "$ADD"

echo "=== 4. List members ==="
MEM=$(curl -sf "$BASE/admin/teacher-groups/$GRP_ID/members" -H "$AUTH")
check "list members" "verify@test.com" "$MEM"

echo "=== 5. Get permissions (defaults) ==="
PERMS=$(curl -sf "$BASE/admin/teacher-groups/$GRP_ID/permissions" -H "$AUTH")
check "get permissions" "permissions" "$PERMS"
check "has cohorts" "cohort_name" "$PERMS"

echo "=== 6. Set permissions (restrict grades to read_only for first cohort) ==="
FIRST_COHORT=$(echo "$PERMS" | python3 -c "import sys,json; p=json.load(sys.stdin)['permissions']; print(p[0]['cohort_id'] if p else 'NONE')")
SET=$(curl -sf -X PUT "$BASE/admin/teacher-groups/$GRP_ID/permissions" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"permissions\":[{\"cohort_id\":\"$FIRST_COHORT\",\"visible\":true,\"programme_choices\":\"read_write\",\"grades\":\"read_only\",\"plan_generation\":\"none\",\"submissions\":\"read_write\",\"reports\":\"read_only\",\"cohort_management\":\"none\"}]}")
check "set permissions" "updated" "$SET"

echo "=== 7. Verify permissions changed ==="
PERMS2=$(curl -sf "$BASE/admin/teacher-groups/$GRP_ID/permissions" -H "$AUTH")
check "grades now read_only" "read_only" "$(echo $PERMS2 | python3 -c "import sys,json; p=json.load(sys.stdin)['permissions']; print([x for x in p if x['cohort_id']=='$FIRST_COHORT'][0]['grades'])")"

echo "=== 8. GET /account/permissions (resolved) ==="
MY_PERMS=$(curl -sf "$BASE/account/permissions" -H "$AUTH")
check "my permissions has cohorts" "cohorts" "$MY_PERMS"
check "my permissions has visible" "visible" "$MY_PERMS"

echo "=== 9. Set cohort invisible ==="
SET2=$(curl -sf -X PUT "$BASE/admin/teacher-groups/$GRP_ID/permissions" -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"permissions\":[{\"cohort_id\":\"$FIRST_COHORT\",\"visible\":false,\"programme_choices\":\"none\",\"grades\":\"none\",\"plan_generation\":\"none\",\"submissions\":\"none\",\"reports\":\"none\",\"cohort_management\":\"none\"}]}")
check "set invisible" "updated" "$SET2"

echo "=== 10. Verify invisible ==="
PERMS3=$(curl -sf "$BASE/admin/teacher-groups/$GRP_ID/permissions" -H "$AUTH")
VISIBLE=$(echo "$PERMS3" | python3 -c "import sys,json; p=json.load(sys.stdin)['permissions']; print([x for x in p if x['cohort_id']=='$FIRST_COHORT'][0]['visible'])")
check "cohort now invisible" "False" "$VISIBLE"

echo "=== 11. Cleanup — delete group ==="
curl -sf -X DELETE "$BASE/admin/teacher-groups/$GRP_ID" -H "$AUTH"
GROUPS2=$(curl -sf "$BASE/admin/teacher-groups" -H "$AUTH")
check "group deleted" "[]" "$(echo $GROUPS2 | python3 -c "import sys,json; print(json.load(sys.stdin)['groups'])")"

echo "=== 12. Run unit tests ==="
cd /Users/bsg/Downloads/schoolchoice/backend
TESTS=$(/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m pytest tests/test_permissions.py -v --tb=short 2>&1 | tail -3)
check "unit tests pass" "passed" "$TESTS"

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
```

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete cohort-based permission system — models, service, routes, admin UI, E2E verified"
```
