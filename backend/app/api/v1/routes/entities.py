"""
app/api/v1/routes/entities.py

Entity registry endpoints — list all registered entities and return their
YAML config as JSON for frontend schema-driven rendering (PLAT-03 D-06, D-08).

Extended with import/export endpoints (DATA-04, DATA-06, DATA-07, DATA-08):
  - POST /{name}/import/parse         — parse uploaded CSV/Excel file
  - POST /{name}/import/parse-sheet   — parse specific Excel sheet
  - POST /{name}/import/validate      — validate mapped rows
  - POST /{name}/import/commit        — commit valid rows to DB
  - GET  /{name}/export               — export entity as CSV download
  - GET  /{name}/export/errors        — download error rows as CSV
  - GET  /plan-export/{plan_id}       — download plan HTML file
"""

from __future__ import annotations

import csv
import io
import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query as QueryParam, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.platform.entity_registry import registry
from app.services.import_service import (
    auto_map_columns,
    find_duplicates,
    generate_error_csv,
    parse_csv,
    parse_excel,
    parse_excel_sheet,
    validate_rows,
)

router = APIRouter(prefix="/entities", tags=["entities"])

_10MB = 10 * 1024 * 1024


# ---------------------------------------------------------------------------
# Request body models
# ---------------------------------------------------------------------------


class ImportValidateRequest(BaseModel):
    mapping: dict
    rows: list[dict]


class ImportCommitRequest(BaseModel):
    valid_rows: list[dict]
    mapping: dict
    duplicate_decisions: dict = {}  # row_index -> "skip"|"overwrite"|"new"


# ---------------------------------------------------------------------------
# Existing endpoints (unchanged)
# ---------------------------------------------------------------------------


@router.get("", status_code=200)
def list_entities(current_user: User = Depends(get_current_user)):
    """Return list of all registered entity names and metadata (D-08)."""
    return [
        {
            "name": c.name,
            "table": c.table,
            "auto_crud": getattr(c, "auto_crud", True),
        }
        for c in registry.all_configs()
    ]


@router.get("/{name}/schema", status_code=200)
def get_entity_schema(name: str, current_user: User = Depends(get_current_user)):
    """Return entity config as JSON for frontend schema-driven rendering (D-06)."""
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    return {
        "name": config.name,
        "table": config.table,
        "fields": [
            {
                "name": f.name,
                "type": f.type,
                "required": f.required,
                "choices": getattr(f, "choices", None),
                "max_length": getattr(f, "max_length", None),
            }
            for f in config.fields
        ],
    }


# ---------------------------------------------------------------------------
# Plan HTML export — placed before /{name}/... routes to avoid path conflict
# ---------------------------------------------------------------------------


@router.get("/plan-export/{plan_id}")
def export_plan_html(
    plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a student plan as a self-contained HTML file (DATA-06)."""
    from app.db.models_v2 import AcademicPlan
    plan = db.query(AcademicPlan).filter(AcademicPlan.id == plan_id).first()
    if not plan or not plan.html_content:
        raise HTTPException(status_code=404, detail="Plan not found or no HTML content")
    return Response(
        content=plan.html_content,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="plan-{plan_id}.html"'},
    )


# ---------------------------------------------------------------------------
# Import endpoints
# ---------------------------------------------------------------------------


@router.post("/{name}/import/parse", status_code=200)
async def import_parse(
    name: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse an uploaded CSV or Excel file and return columns + preview + auto-mapping.

    - Max file size: 10 MB (T-04-07 DoS mitigation)
    - Auth required (T-04-08)
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    content = await file.read()
    if len(content) > _10MB:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    filename = file.filename or ""
    if filename.lower().endswith((".xlsx", ".xls")):
        result = parse_excel(content)
    else:
        result = parse_csv(content)

    # If multiple sheets, return early with sheet list for user to pick
    if result.get("sheets"):
        return {"sheets": result["sheets"]}

    entity_field_names = [f.name for f in config.fields]
    auto_mapping = auto_map_columns(result["columns"] or [], entity_field_names)

    return {
        "columns": result["columns"],
        "preview_rows": result["preview_rows"],
        "total_rows": result["total_rows"],
        "auto_mapping": auto_mapping,
    }


@router.post("/{name}/import/parse-sheet", status_code=200)
async def import_parse_sheet(
    name: str,
    sheet_name: str = QueryParam(..., description="Excel sheet name to parse"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Parse a specific sheet from an uploaded Excel file.

    Auth required (T-04-08).
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    content = await file.read()
    if len(content) > _10MB:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    result = parse_excel_sheet(content, sheet_name)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    entity_field_names = [f.name for f in config.fields]
    auto_mapping = auto_map_columns(result["columns"] or [], entity_field_names)

    return {
        "columns": result["columns"],
        "preview_rows": result["preview_rows"],
        "total_rows": result["total_rows"],
        "auto_mapping": auto_mapping,
    }


@router.post("/{name}/import/validate", status_code=200)
def import_validate(
    name: str,
    body: ImportValidateRequest,
    current_user: User = Depends(get_current_user),
):
    """Validate mapped rows against entity field rules.

    Returns counts and split valid/error/duplicate row lists.
    Auth required (T-04-08).
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    valid_rows, error_rows = validate_rows(body.rows, body.mapping, config.fields)
    duplicate_rows = find_duplicates(valid_rows)

    # Count warnings (duplicates that are still valid, just flagged)
    return {
        "valid_count": len(valid_rows),
        "error_count": len(error_rows),
        "warning_count": len(duplicate_rows),
        "valid_rows": valid_rows,
        "error_rows": error_rows,
        "duplicate_rows": duplicate_rows,
    }


@router.post("/{name}/import/commit", status_code=200)
def import_commit(
    name: str,
    body: ImportCommitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Commit validated rows into the database.

    Respects duplicate_decisions: "skip", "overwrite", or "new".
    Re-validates rows internally — never trusts client-claimed "valid" status (T-04-10).
    Auth required (T-04-08).
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    model_cls = registry.get_model(name)
    if not model_cls:
        raise HTTPException(
            status_code=422,
            detail=f"Entity '{name}' has no auto-managed model — manual import not supported",
        )

    # Re-validate before committing (T-04-10 mitigation: never trust client "valid" claim)
    valid_rows, error_rows = validate_rows(body.valid_rows, body.mapping, config.fields)
    if error_rows:
        raise HTTPException(
            status_code=422,
            detail=f"{len(error_rows)} rows failed re-validation before commit",
        )

    imported_count = 0
    skipped_count = 0

    for i, row in enumerate(valid_rows):
        # Remove internal metadata keys before inserting
        clean_row = {k: v for k, v in row.items() if not k.startswith("_")}

        decision = body.duplicate_decisions.get(str(i), "new")

        if decision == "skip":
            skipped_count += 1
            continue
        elif decision == "overwrite":
            # Attempt update by looking up existing row with matching fields
            existing = None
            if clean_row.get("id"):
                existing = db.query(model_cls).filter(model_cls.id == clean_row["id"]).first()
            if existing:
                for k, v in clean_row.items():
                    if hasattr(existing, k) and k != "id":
                        setattr(existing, k, v)
                imported_count += 1
            else:
                # No existing row found — insert as new
                obj = model_cls(**{k: v for k, v in clean_row.items() if hasattr(model_cls, k)})
                db.add(obj)
                imported_count += 1
        else:
            # "new" — always insert
            obj = model_cls(**{k: v for k, v in clean_row.items() if hasattr(model_cls, k)})
            db.add(obj)
            imported_count += 1

    db.commit()
    return {"imported_count": imported_count, "skipped_count": skipped_count}


# ---------------------------------------------------------------------------
# Export endpoints
# ---------------------------------------------------------------------------


@router.get("/{name}/export/errors")
def export_error_csv(
    name: str,
    error_rows: Optional[str] = QueryParam(None, description="JSON-encoded error rows array"),
    current_user: User = Depends(get_current_user),
):
    """Download failed import rows as a CSV file with error_reason column.

    Auth required (T-04-08).
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    rows: list = []
    if error_rows:
        try:
            rows = json.loads(error_rows)
        except (ValueError, TypeError):
            rows = []

    csv_content = generate_error_csv(rows)
    today = date.today().isoformat()
    filename = f"{name}-import-errors-{today}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{name}/export")
def export_entity_csv(
    name: str,
    q: Optional[str] = QueryParam(None, description="Text search filter"),
    filters: Optional[str] = QueryParam(None, description="JSON-encoded field filters"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all (or filtered) entity rows as a CSV download.

    Applies the same q= and filters= logic as the auto-CRUD list endpoint.
    Returns StreamingResponse with text/csv and Content-Disposition header.
    Auth required (T-04-08, T-04-09).
    """
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")

    model_cls = registry.get_model(name)
    if not model_cls:
        raise HTTPException(
            status_code=422,
            detail=f"Entity '{name}' has no auto-managed model — export not supported",
        )

    from sqlalchemy import or_
    query = db.query(model_cls)

    # Apply text search (same logic as crud_generator, T-04-05 mitigation)
    if q:
        ilike_clauses = []
        for f in config.fields:
            if f.type in ("string", "text", "enum") and hasattr(model_cls, f.name):
                ilike_clauses.append(getattr(model_cls, f.name).ilike(f"%{q}%"))
        if ilike_clauses:
            query = query.filter(or_(*ilike_clauses))

    # Apply field filters (T-04-06 mitigation: hasattr check, parameterized via ORM)
    if filters:
        try:
            filter_dict = json.loads(filters)
        except (ValueError, TypeError):
            filter_dict = {}
        for key, value in filter_dict.items():
            if value in (None, "", {}):
                continue
            if "__gte" in key:
                field_name = key.replace("__gte", "")
                if hasattr(model_cls, field_name):
                    query = query.filter(getattr(model_cls, field_name) >= value)
            elif "__lte" in key:
                field_name = key.replace("__lte", "")
                if hasattr(model_cls, field_name):
                    query = query.filter(getattr(model_cls, field_name) <= value)
            elif hasattr(model_cls, key):
                query = query.filter(getattr(model_cls, key) == value)

    rows = query.all()

    # Build CSV in memory using a generator for streaming
    field_names = ["id"] + [f.name for f in config.fields]

    def generate_csv():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=field_names, extrasaction="ignore")
        writer.writeheader()
        yield output.getvalue()
        for row in rows:
            output = io.StringIO()
            row_dict = {col: getattr(row, col, "") for col in field_names}
            writer = csv.DictWriter(output, fieldnames=field_names, extrasaction="ignore")
            writer.writerow(row_dict)
            yield output.getvalue()

    today = date.today().isoformat()
    filename = f"{name}-export-{today}.csv"
    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
