"""
app/services/import_service.py

CSV and Excel import service: parse, auto-map, validate, and find duplicates.
Used by entities.py import endpoints.
"""
import csv
import io
import json
from typing import Optional

# ---------------------------------------------------------------------------
# Parse helpers
# ---------------------------------------------------------------------------


def parse_csv(content: bytes) -> dict:
    """Parse raw CSV bytes into columns + preview rows (first 10).

    Returns:
        {
            "columns": ["col1", "col2", ...],
            "preview_rows": [{"col1": "val", ...}, ...],
            "total_rows": N,
            "sheets": None,
        }
    """
    text = content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))
    columns = reader.fieldnames or []
    rows = []
    total = 0
    for row in reader:
        if total < 10:
            rows.append(dict(row))
        total += 1
    return {
        "columns": list(columns),
        "preview_rows": rows,
        "total_rows": total,
        "sheets": None,
    }


def parse_excel(content: bytes) -> dict:
    """Parse raw Excel bytes. Returns sheet list if multiple sheets, else
    acts like parse_csv returning columns + preview for the first sheet.

    Falls back gracefully if openpyxl is unavailable.
    """
    try:
        import openpyxl
    except ImportError:
        return {
            "columns": [],
            "preview_rows": [],
            "total_rows": 0,
            "sheets": None,
            "error": "openpyxl not installed — Excel import unavailable",
        }

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_names = wb.sheetnames
    if len(sheet_names) > 1:
        wb.close()
        return {
            "columns": None,
            "preview_rows": None,
            "total_rows": None,
            "sheets": sheet_names,
        }
    # Single sheet — parse it
    result = parse_excel_sheet(content, sheet_names[0])
    wb.close()
    return result


def parse_excel_sheet(content: bytes, sheet_name: str) -> dict:
    """Parse a specific sheet from Excel bytes into columns + preview rows.

    Returns same shape as parse_csv but with sheets=None.
    """
    try:
        import openpyxl
    except ImportError:
        return {
            "columns": [],
            "preview_rows": [],
            "total_rows": 0,
            "sheets": None,
            "error": "openpyxl not installed",
        }

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    if sheet_name not in wb.sheetnames:
        wb.close()
        return {
            "columns": [],
            "preview_rows": [],
            "total_rows": 0,
            "sheets": None,
            "error": f"Sheet '{sheet_name}' not found",
        }
    ws = wb[sheet_name]
    rows_iter = ws.iter_rows(values_only=True)
    header_row = next(rows_iter, None)
    if header_row is None:
        wb.close()
        return {
            "columns": [],
            "preview_rows": [],
            "total_rows": 0,
            "sheets": None,
        }
    columns = [str(c) if c is not None else "" for c in header_row]
    preview = []
    total = 0
    for row in rows_iter:
        if total < 10:
            preview.append(dict(zip(columns, [str(v) if v is not None else "" for v in row])))
        total += 1
    wb.close()
    return {
        "columns": columns,
        "preview_rows": preview,
        "total_rows": total,
        "sheets": None,
    }


# ---------------------------------------------------------------------------
# Auto-mapping
# ---------------------------------------------------------------------------


def auto_map_columns(file_columns: list[str], entity_fields: list[str]) -> dict:
    """Attempt to automatically map file columns to entity field names.

    Strategy: exact match first, then case-insensitive, then normalized
    (remove spaces/underscores, lowercase).

    Returns:
        {"file_col": "entity_field" | None, ...}
    """
    mapping = {}
    entity_lower = {f.lower(): f for f in entity_fields}
    entity_norm = {f.lower().replace("_", "").replace(" ", ""): f for f in entity_fields}

    for col in file_columns:
        if col in entity_fields:
            mapping[col] = col
        elif col.lower() in entity_lower:
            mapping[col] = entity_lower[col.lower()]
        else:
            norm = col.lower().replace("_", "").replace(" ", "")
            mapping[col] = entity_norm.get(norm)

    return mapping


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_rows(
    rows: list[dict],
    mapping: dict,
    entity_fields: Optional[list] = None,
) -> tuple[list[dict], list[dict]]:
    """Validate mapped rows against basic rules.

    - Applies column mapping: produces dicts keyed by entity field names.
    - Checks required fields are non-empty.

    Args:
        rows: Raw rows from parse (keyed by file column names).
        mapping: {"file_col": "entity_field" | None}.
        entity_fields: List of FieldConfig objects (optional, for required checks).

    Returns:
        (valid_rows, error_rows)
        error_rows include an 'error_reason' key describing validation failure.
    """
    required_fields = set()
    if entity_fields:
        for f in entity_fields:
            if getattr(f, "required", False):
                required_fields.add(f.name)

    valid_rows = []
    error_rows = []

    for i, row in enumerate(rows):
        # Apply mapping
        mapped: dict = {}
        for file_col, entity_field in mapping.items():
            if entity_field is not None:
                mapped[entity_field] = row.get(file_col, "")

        # Required field check
        missing = [f for f in required_fields if not mapped.get(f)]
        if missing:
            error_row = dict(mapped)
            error_row["_source_row"] = i + 2  # 1-based + header offset
            error_row["error_reason"] = f"Missing required fields: {', '.join(missing)}"
            error_rows.append(error_row)
        else:
            mapped["_source_row"] = i + 2
            valid_rows.append(mapped)

    return valid_rows, error_rows


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------


def find_duplicates(valid_rows: list[dict], key_fields: Optional[list[str]] = None) -> list[dict]:
    """Find duplicate rows based on key fields.

    If key_fields is None or empty, uses all non-metadata fields.
    Duplicate rows are returned with a 'duplicate_reason' key.
    """
    if not valid_rows:
        return []

    if not key_fields:
        # Use all fields except internal metadata
        key_fields = [k for k in valid_rows[0].keys() if not k.startswith("_")]

    seen: dict = {}
    duplicates = []

    for row in valid_rows:
        key = tuple(str(row.get(f, "")) for f in key_fields)
        if key in seen:
            dup = dict(row)
            dup["duplicate_reason"] = f"Duplicate of row {seen[key]}"
            duplicates.append(dup)
        else:
            seen[key] = row.get("_source_row", "?")

    return duplicates


# ---------------------------------------------------------------------------
# Error CSV generation
# ---------------------------------------------------------------------------


def generate_error_csv(error_rows: list[dict]) -> str:
    """Generate a CSV string from error rows (includes error_reason column).

    Returns:
        CSV string with all fields from error_rows plus error_reason column.
    """
    if not error_rows:
        return "error_reason\n(no errors)\n"

    # Collect all column names; ensure error_reason is last
    all_keys = []
    for row in error_rows:
        for k in row:
            if k not in all_keys and k != "error_reason":
                all_keys.append(k)
    all_keys.append("error_reason")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=all_keys, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(error_rows)
    return output.getvalue()
