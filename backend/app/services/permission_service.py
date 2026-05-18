"""
app/services/permission_service.py

Group-based cohort permission system.
Teachers belong to groups; groups have per-cohort permission rows.
Merging picks the most-permissive level across all groups a user belongs to.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import CohortPermission, TeacherGroup, TeacherGroupMember, User
from app.db.models_v2 import CohortMembership, StudentCohort


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TOOL_FIELDS = (
    "programme_choices",
    "grades",
    "plan_generation",
    "submissions",
    "reports",
    "cohort_management",
    "data_import",
    "account_assignment",
)

_ACCESS_RANK = {"none": 0, "read_only": 1, "read_write": 2}

ROLE_DEFAULTS: dict[str, dict] = {
    "admin": {"visible": True, **{f: "read_write" for f in TOOL_FIELDS}},
    "counsellor": {
        "visible": True,
        "programme_choices": "read_write",
        "grades": "read_write",
        "plan_generation": "read_write",
        "submissions": "read_write",
        "reports": "read_only",
        "cohort_management": "none",
        "data_import": "none",
        "account_assignment": "none",
    },
    "student": {
        "visible": True,
        "programme_choices": "read_only",
        "grades": "read_only",
        "plan_generation": "none",
        "submissions": "read_write",
        "reports": "none",
        "cohort_management": "none",
        "data_import": "none",
        "account_assignment": "none",
    },
}


# ---------------------------------------------------------------------------
# Merge logic
# ---------------------------------------------------------------------------

def merge_permissions(perms: list[dict]) -> dict:
    """Merge multiple permission dicts — most permissive wins.

    Empty list → invisible + all none.
    """
    if not perms:
        return {"visible": False, **{f: "none" for f in TOOL_FIELDS}}

    result: dict = {"visible": False}
    for f in TOOL_FIELDS:
        result[f] = "none"

    for p in perms:
        if p.get("visible"):
            result["visible"] = True
        for f in TOOL_FIELDS:
            current_rank = _ACCESS_RANK.get(result[f], 0)
            incoming_rank = _ACCESS_RANK.get(p.get(f, "none"), 0)
            if incoming_rank > current_rank:
                result[f] = p[f]

    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_user_group_ids(user_id: UUID, db: Session) -> list[UUID]:
    """Return IDs of all TeacherGroups the user belongs to."""
    rows = (
        db.query(TeacherGroupMember.group_id)
        .filter(TeacherGroupMember.user_id == user_id)
        .all()
    )
    return [r[0] for r in rows]


def _get_cohort_permissions_for_groups(
    group_ids: list[UUID], cohort_id: UUID, db: Session
) -> list[dict]:
    """Return permission dicts for given groups on a specific cohort."""
    if not group_ids:
        return []
    rows = (
        db.query(CohortPermission)
        .filter(
            CohortPermission.group_id.in_(group_ids),
            CohortPermission.cohort_id == cohort_id,
        )
        .all()
    )
    result = []
    for row in rows:
        d = {"visible": row.visible}
        for f in TOOL_FIELDS:
            d[f] = getattr(row, f)
        result.append(d)
    return result


def _perm_row_to_dict(row: CohortPermission) -> dict:
    """Convert a CohortPermission ORM row to a plain dict."""
    d = {"visible": row.visible}
    for f in TOOL_FIELDS:
        d[f] = getattr(row, f)
    return d


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def check_feature_permission(
    user: User, db: Session, student_id: UUID, feature: str
) -> str:
    """Return the access level ('none', 'read_only', 'read_write') for a
    specific feature on a student, considering all the user's groups.

    Admin always gets read_write.
    If user has no groups or student has no cohorts, fall back to role defaults.
    """
    if user.role == "admin":
        return "read_write"

    # Find which cohorts the student belongs to
    cohort_ids = [
        r[0]
        for r in db.query(CohortMembership.cohort_id)
        .filter(CohortMembership.student_id == student_id)
        .all()
    ]

    if not cohort_ids:
        # Student not in any cohort — use role defaults
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    group_ids = _get_user_group_ids(user.id, db)
    if not group_ids:
        # User not in any group — use role defaults (existing behavior)
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    # Collect permissions across all cohorts the student is in
    all_perms: list[dict] = []
    for cid in cohort_ids:
        all_perms.extend(_get_cohort_permissions_for_groups(group_ids, cid, db))

    if not all_perms:
        defaults = ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"])
        return defaults.get(feature, "none")

    merged = merge_permissions(all_perms)
    return merged.get(feature, "none")


def get_visible_student_ids(
    user: User, db: Session
) -> Optional[set[UUID]]:
    """Return set of student IDs the user can see, or None if all visible.

    Admin → None (see all).
    No groups → None (see all — preserves existing behavior).
    Otherwise → union of students in visible cohorts.
    """
    if user.role == "admin":
        return None

    group_ids = _get_user_group_ids(user.id, db)
    if not group_ids:
        return None  # No groups assigned — see all (existing behavior)

    # Find cohorts where any of the user's groups has visible=True
    visible_cohort_ids = [
        r[0]
        for r in db.query(CohortPermission.cohort_id)
        .filter(
            CohortPermission.group_id.in_(group_ids),
            CohortPermission.visible == True,  # noqa: E712
        )
        .distinct()
        .all()
    ]

    if not visible_cohort_ids:
        return set()  # Groups exist but none have visible cohorts

    student_ids = [
        r[0]
        for r in db.query(CohortMembership.student_id)
        .filter(CohortMembership.cohort_id.in_(visible_cohort_ids))
        .all()
    ]
    return set(student_ids)


def resolve_user_permissions(
    user: User, db: Session
) -> list[dict]:
    """Return full permission matrix for all org cohorts.

    Admin → all cohorts with read_write on everything.
    Others → merge per cohort from user's groups.
    """
    # Get user's org from membership
    from app.db.models import OrganisationMembership

    org_membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if not org_membership:
        return []

    org_id = org_membership.organisation_id

    # All cohorts in the org
    cohorts = (
        db.query(StudentCohort)
        .filter(StudentCohort.organisation_id == org_id)
        .all()
    )

    if user.role == "admin":
        admin_perms = ROLE_DEFAULTS["admin"]
        return [
            {"cohort_id": str(c.id), "cohort_name": c.name, **admin_perms}
            for c in cohorts
        ]

    group_ids = _get_user_group_ids(user.id, db)

    results = []
    for cohort in cohorts:
        if group_ids:
            perm_rows = _get_cohort_permissions_for_groups(group_ids, cohort.id, db)
            merged = merge_permissions(perm_rows)
        else:
            # No groups — use role defaults
            merged = dict(ROLE_DEFAULTS.get(user.role, ROLE_DEFAULTS["counsellor"]))
        results.append({
            "cohort_id": str(cohort.id),
            "cohort_name": cohort.name,
            **merged,
        })

    return results
