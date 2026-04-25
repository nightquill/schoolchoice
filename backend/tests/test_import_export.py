"""
tests/test_import_export.py

Tests for import service (DATA-01, DATA-02, DATA-03) and export endpoints (DATA-04, DATA-06).
Export endpoint tests are stubs for Plan 02 to fill in.
"""
import pytest
from app.services.import_service import (
    auto_map_columns,
    normalize,
    parse_csv,
    validate_rows,
    generate_error_csv,
)
from app.platform.yaml_loader import EntityConfig, FieldConfig


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_config():
    return EntityConfig(
        name="contact",
        table="contacts",
        fields=[
            FieldConfig(name="name", type="string", required=True),
            FieldConfig(name="email", type="string", required=True),
            FieldConfig(name="age", type="int", required=False),
        ],
    )


# ---------------------------------------------------------------------------
# normalize() tests
# ---------------------------------------------------------------------------

def test_normalize():
    """Spaces become underscores; hyphens become underscores; result is lowercase."""
    assert normalize("Student Name") == "student_name"
    assert normalize("First-Name") == "first_name"
    assert normalize("EMAIL") == "email"
    assert normalize("postal_code") == "postal_code"


# ---------------------------------------------------------------------------
# auto_map_columns() tests
# ---------------------------------------------------------------------------

def test_auto_map_exact_match():
    """Exact matches (ratio == 1.0) should always map correctly."""
    result = auto_map_columns(["name", "email"], ["name", "email"])
    assert result["name"] == "name"
    assert result["email"] == "email"


def test_auto_map_similar_match():
    """Similar but not identical names should map if ratio >= 0.6."""
    result = auto_map_columns(["E-mail"], ["email"])
    # "e_mail" vs "email" should score >= 0.6
    assert result["E-mail"] == "email"


def test_auto_map_no_match():
    """Completely dissimilar column should map to None."""
    result = auto_map_columns(["xyz123"], ["name"])
    assert result["xyz123"] is None


def test_auto_map_no_double_assignment():
    """Each entity field can only be assigned once (greedy first-best matching)."""
    result = auto_map_columns(["name", "name_copy"], ["name", "email"])
    # "name" should win "name" field; "name_copy" should not steal it
    assigned = [v for v in result.values() if v is not None]
    # No entity field appears more than once
    assert len(assigned) == len(set(assigned))


# ---------------------------------------------------------------------------
# parse_csv() tests
# ---------------------------------------------------------------------------

def test_parse_csv_basic(sample_config):
    """Basic CSV with matching headers: columns, preview, all_rows populated."""
    content = b"name,email\nAlice,alice@test.com\nBob,bob@test.com"
    result = parse_csv(content, sample_config)
    assert result["format"] == "csv"
    assert result["sheets"] is None
    assert result["columns"] == ["name", "email"]
    assert len(result["preview_rows"]) == 2
    assert len(result["all_rows"]) == 2
    # Both fields should be auto-mapped (exact match)
    mapping = result["auto_mapping"]
    assert mapping.get("name") == "name"
    assert mapping.get("email") == "email"


def test_parse_csv_bom(sample_config):
    """CSV with BOM prefix: first column name should not include BOM bytes."""
    content = b"\xef\xbb\xbfname,email\nAlice,a@b.com"
    result = parse_csv(content, sample_config)
    assert result["columns"][0] == "name", (
        f"Expected 'name' (BOM stripped), got '{result['columns'][0]}'"
    )


def test_parse_csv_preview_limit(sample_config):
    """Preview rows are capped at 5 even when more rows exist."""
    lines = ["name,email"] + [f"User{i},user{i}@test.com" for i in range(10)]
    content = "\n".join(lines).encode("utf-8")
    result = parse_csv(content, sample_config)
    assert len(result["preview_rows"]) == 5
    assert len(result["all_rows"]) == 10


# ---------------------------------------------------------------------------
# validate_rows() tests
# ---------------------------------------------------------------------------

def test_validate_rows_valid(sample_config):
    """All rows with required fields present should pass validation."""
    rows = [
        {"name": "Alice", "email": "alice@test.com"},
        {"name": "Bob", "email": "bob@test.com"},
    ]
    mapping = {"name": "name", "email": "email"}
    valid, errors = validate_rows(rows, mapping, sample_config)
    assert len(valid) == 2
    assert len(errors) == 0


def test_validate_rows_with_errors(sample_config):
    """Row missing a required field should appear in error_rows with error_reason."""
    rows = [
        {"name": "Alice", "email": "alice@test.com"},
        {"name": ""},  # email is required but missing from row and mapping
    ]
    # Only map name field — email not in mapping, so it won't be set
    mapping = {"name": "name"}
    valid, errors = validate_rows(rows, mapping, sample_config)
    # First row is valid (email not required by this mapping, but let's use full mapping)
    # With only name in mapping, email field is absent -> Pydantic raises for required email
    # Both rows lack email
    assert len(errors) > 0
    for err in errors:
        assert "error_reason" in err
        assert "row_index" in err


def test_validate_rows_error_has_row_index(sample_config):
    """Error rows should have row_index starting at 2 (row 1 is header)."""
    rows = [{"name": ""}]  # missing required email
    mapping = {"name": "name"}
    _, errors = validate_rows(rows, mapping, sample_config)
    assert len(errors) == 1
    assert errors[0]["row_index"] == 2  # first data row = row index 2


# ---------------------------------------------------------------------------
# generate_error_csv() tests
# ---------------------------------------------------------------------------

def test_generate_error_csv(sample_config):
    """Error CSV output should contain error_reason column and be valid CSV."""
    error_rows = [
        {
            "row_index": 2,
            "data": {"name": "BadRow", "email": ""},
            "error_reason": "email field required",
        }
    ]
    output = generate_error_csv(error_rows, sample_config)
    assert isinstance(output, str)
    assert "error_reason" in output
    assert "email field required" in output
    # Should be parseable CSV
    import csv, io
    reader = csv.DictReader(io.StringIO(output))
    rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["error_reason"] == "email field required"


def test_generate_error_csv_empty(sample_config):
    """Empty error_rows should produce a header-only CSV."""
    output = generate_error_csv([], sample_config)
    assert "error_reason" in output
    import csv, io
    reader = csv.DictReader(io.StringIO(output))
    rows = list(reader)
    assert len(rows) == 0


# ---------------------------------------------------------------------------
# Export endpoint stubs (Plan 02 will implement these)
# ---------------------------------------------------------------------------

def test_export_csv_stub():
    """Placeholder: export CSV endpoint tested in Plan 02."""
    # DATA-04: GET /api/v1/export/{entity}/csv
    pass


def test_export_html_stub():
    """Placeholder: export HTML endpoint tested in Plan 02."""
    # DATA-06: GET /api/v1/export/{entity}/html
    pass
