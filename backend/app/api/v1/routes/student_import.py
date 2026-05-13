"""
app/api/v1/routes/student_import.py

Endpoints for previewing and committing student CSV/Excel imports.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.db.models import User
from app.services.student_import_service import (
    parse_student_csv,
    validate_rows,
    commit_import,
)

router = APIRouter(prefix="/import/students", tags=["student-import"])

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
    return content


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Parse and validate a student CSV without committing. Returns preview data."""
    content = await _read_and_validate_file(file)

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

    parsed = parse_student_csv(content)
    rows = parsed["rows"]

    org_id = getattr(current_user, "active_organisation_id", None)
    validated = validate_rows(rows, db, current_user.id, org_id)

    result = commit_import(validated, db, current_user.id, org_id)

    return result
