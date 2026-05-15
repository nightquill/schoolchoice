"""
app/api/v1/routes/teacher_groups.py

Admin-only CRUD for teacher groups, members, and cohort permissions.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.db.models import CohortPermission, TeacherGroup, TeacherGroupMember, User
from app.db.models_v2 import StudentCohort
from app.db.session import get_db
from app.services.permission_service import TOOL_FIELDS

router = APIRouter(prefix="/admin/teacher-groups", tags=["teacher-groups"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


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
# Helpers
# ---------------------------------------------------------------------------

def _get_group_or_404(group_id: UUID, db: Session, user: User) -> TeacherGroup:
    """Fetch group scoped to user's org, raise 404 if missing."""
    from app.db.models import OrganisationMembership
    org_membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    org_id = org_membership.organisation_id if org_membership else None
    group = db.query(TeacherGroup).filter(TeacherGroup.id == group_id).first()
    if not group or (org_id and group.organisation_id != org_id):
        raise HTTPException(status_code=404, detail="Teacher group not found")
    return group


# ---------------------------------------------------------------------------
# Group CRUD
# ---------------------------------------------------------------------------

@router.get("", status_code=status.HTTP_200_OK)
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all teacher groups with member counts."""
    from app.db.models import OrganisationMembership
    user = db.merge(current_user)
    org_membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if not org_membership:
        return {"groups": []}
    groups = (
        db.query(TeacherGroup)
        .filter(TeacherGroup.organisation_id == org_membership.organisation_id)
        .order_by(TeacherGroup.name)
        .all()
    )
    result = []
    for g in groups:
        member_count = (
            db.query(TeacherGroupMember)
            .filter(TeacherGroupMember.group_id == g.id)
            .count()
        )
        result.append({
            "id": str(g.id),
            "name": g.name,
            "description": g.description,
            "member_count": member_count,
            "created_at": g.created_at,
            "updated_at": g.updated_at,
        })
    return {"groups": result}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a teacher group."""
    from app.db.models import OrganisationMembership
    user = db.merge(current_user)
    org_membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if not org_membership:
        raise HTTPException(status_code=400, detail="User has no organisation")
    group = TeacherGroup(
        organisation_id=org_membership.organisation_id,
        name=payload.name,
        description=payload.description,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "member_count": 0,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


@router.put("/{group_id}", status_code=status.HTTP_200_OK)
def update_group(
    group_id: UUID,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update a teacher group."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)
    if payload.name is not None:
        group.name = payload.name
    if payload.description is not None:
        group.description = payload.description
    db.commit()
    db.refresh(group)
    member_count = (
        db.query(TeacherGroupMember)
        .filter(TeacherGroupMember.group_id == group.id)
        .count()
    )
    return {
        "id": str(group.id),
        "name": group.name,
        "description": group.description,
        "member_count": member_count,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


@router.delete("/{group_id}", status_code=status.HTTP_200_OK)
def delete_group(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Delete a teacher group (cascade deletes members + permissions)."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)
    db.delete(group)
    db.commit()
    return {"message": "Group deleted"}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

@router.get("/{group_id}/members", status_code=status.HTTP_200_OK)
def list_members(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List members of a teacher group."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)
    members = (
        db.query(TeacherGroupMember)
        .filter(TeacherGroupMember.group_id == group.id)
        .all()
    )
    result = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        result.append({
            "id": str(m.id),
            "user_id": str(m.user_id),
            "email": u.email if u else None,
            "display_name": u.display_name if u else None,
            "role": u.role if u else None,
        })
    return {"members": result}


@router.post("/{group_id}/members", status_code=status.HTTP_201_CREATED)
def add_members(
    group_id: UUID,
    payload: MembersAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Add users to a teacher group."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)
    added = []
    for uid_str in payload.user_ids:
        try:
            uid = UUID(uid_str)
        except (ValueError, AttributeError):
            continue
        # Check user exists
        target_user = db.query(User).filter(User.id == uid).first()
        if not target_user:
            continue
        # Skip if already a member
        existing = (
            db.query(TeacherGroupMember)
            .filter(
                TeacherGroupMember.group_id == group.id,
                TeacherGroupMember.user_id == uid,
            )
            .first()
        )
        if existing:
            continue
        member = TeacherGroupMember(group_id=group.id, user_id=uid)
        db.add(member)
        added.append(uid_str)
    db.commit()
    return {"added": added, "count": len(added)}


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Remove a user from a teacher group."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)
    member = (
        db.query(TeacherGroupMember)
        .filter(
            TeacherGroupMember.group_id == group.id,
            TeacherGroupMember.user_id == user_id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in group")
    db.delete(member)
    db.commit()
    return {"message": "Member removed"}


# ---------------------------------------------------------------------------
# Cohort permissions
# ---------------------------------------------------------------------------

@router.get("/{group_id}/permissions", status_code=status.HTTP_200_OK)
def get_group_permissions(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get cohort permissions for a group — returns all org cohorts with current settings."""
    from app.db.models import OrganisationMembership
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)

    org_membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if not org_membership:
        return []

    cohorts = (
        db.query(StudentCohort)
        .filter(StudentCohort.organisation_id == org_membership.organisation_id)
        .order_by(StudentCohort.name)
        .all()
    )

    # Existing permissions for this group
    existing = {
        p.cohort_id: p
        for p in db.query(CohortPermission)
        .filter(CohortPermission.group_id == group.id)
        .all()
    }

    result = []
    for c in cohorts:
        perm = existing.get(c.id)
        entry = {
            "cohort_id": str(c.id),
            "cohort_name": c.name,
            "visible": perm.visible if perm else True,
        }
        for f in TOOL_FIELDS:
            entry[f] = getattr(perm, f) if perm else "read_write"
        result.append(entry)
    return {"permissions": result}


@router.put("/{group_id}/permissions", status_code=status.HTTP_200_OK)
def update_group_permissions(
    group_id: UUID,
    payload: PermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Bulk upsert cohort permissions for a group."""
    user = db.merge(current_user)
    group = _get_group_or_404(group_id, db, user)

    for perm_data in payload.permissions:
        cohort_id = UUID(perm_data.cohort_id)
        existing = (
            db.query(CohortPermission)
            .filter(
                CohortPermission.group_id == group.id,
                CohortPermission.cohort_id == cohort_id,
            )
            .first()
        )
        if existing:
            existing.visible = perm_data.visible
            for f in TOOL_FIELDS:
                setattr(existing, f, getattr(perm_data, f))
        else:
            new_perm = CohortPermission(
                group_id=group.id,
                cohort_id=cohort_id,
                visible=perm_data.visible,
            )
            for f in TOOL_FIELDS:
                setattr(new_perm, f, getattr(perm_data, f))
            db.add(new_perm)

    db.commit()
    return {"updated": len(payload.permissions)}
