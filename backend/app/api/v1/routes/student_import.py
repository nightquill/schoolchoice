"""
app/api/v1/routes/student_import.py

Endpoints for previewing and committing student CSV/Excel imports.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.db.models import User, OrganisationMembership
from app.db.models_v2 import StudentCohort
from app.services.permission_service import (
    _get_user_group_ids,
    _get_cohort_permissions_for_groups,
    merge_permissions,
)
from app.services.student_import_service import (
    parse_student_csv,
    validate_file,
    ImportFileError,
    validate_rows,
    commit_import,
)

router = APIRouter(prefix="/import/students", tags=["student-import"])

_ACCESS_RANK = {"none": 0, "read_only": 1, "read_write": 2}


def _check_import_permission(user: User, db: Session, level: str = "read_write"):
    """Check that the user has data_import permission at the required level.

    Admin always passes. Non-admin users need at least one org cohort
    where their group grants data_import >= level.
    """
    if user.role == "admin":
        return

    group_ids = _get_user_group_ids(user.id, db)
    if not group_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No group membership — cannot import")

    # Find all cohorts in the user's org
    org_id = getattr(user, "active_organisation_id", None)
    if not org_id:
        membership = db.query(OrganisationMembership).filter(
            OrganisationMembership.user_id == user.id
        ).first()
        if membership:
            org_id = membership.organisation_id

    if not org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No organisation context")

    cohorts = db.query(StudentCohort).filter(StudentCohort.organisation_id == org_id).all()
    required_rank = _ACCESS_RANK.get(level, 2)

    for cohort in cohorts:
        perm_rows = _get_cohort_permissions_for_groups(group_ids, cohort.id, db)
        if perm_rows:
            merged = merge_permissions(perm_rows)
            if _ACCESS_RANK.get(merged.get("data_import", "none"), 0) >= required_rank:
                return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have data import permission for any cohort",
    )

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _read_and_validate_file(file: UploadFile) -> bytes:
    """Read uploaded file bytes with size and emptiness checks."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )
    # File format validation (magic bytes, corruption, row count)
    try:
        validate_file(content, file.filename or "upload.csv")
    except ImportFileError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return content


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse and validate a student CSV without committing. Returns preview data."""
    content = await _read_and_validate_file(file)
    _check_import_permission(current_user, db, "read_only")

    parsed = parse_student_csv(content)
    rows = parsed["rows"]

    org_id = getattr(current_user, "active_organisation_id", None)
    validated = validate_rows(rows, db, current_user.id, org_id)

    # Build summary with create/update/error counts
    create_count = sum(1 for r in validated if r["status"] == "create")
    update_count = sum(1 for r in validated if r["status"] == "update")
    error_count = sum(1 for r in validated if r["status"] == "error")

    # Count distinct grades across all rows
    grade_count = sum(len(r.get("grades", {})) for r in validated)

    summary = {
        "total": len(validated),
        "create": create_count,
        "update": update_count,
        "error": error_count,
        "grade_count": grade_count,
    }

    return {
        "rows": validated,
        "subject_columns": parsed["subject_columns"],
        "unmapped_columns": parsed.get("unmapped_columns", []),
        "grade_conversions": parsed.get("grade_conversions", []),
        "summary": summary,
    }


@router.post("/commit")
async def commit_student_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse, validate, and commit a student CSV import."""
    content = await _read_and_validate_file(file)
    _check_import_permission(current_user, db, "read_write")

    parsed = parse_student_csv(content)
    rows = parsed["rows"]

    org_id = getattr(current_user, "active_organisation_id", None)
    validated = validate_rows(rows, db, current_user.id, org_id)

    result = commit_import(validated, db, current_user.id, org_id)

    return result
