"""
tests/test_entities.py

Tests for GET /api/v1/entities and GET /api/v1/entities/{name}/schema.
"""


def test_list_entities_unauthenticated(client):
    """Unauthenticated request returns 401."""
    response = client.get("/api/v1/entities")
    assert response.status_code == 401


def test_list_entities_authenticated(client, auth_headers):
    """Authenticated request returns list of entity configs."""
    response = client.get("/api/v1/entities", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # At least student entity should be registered
    names = [e["name"] for e in data]
    assert "student" in names
    # Each entry has required keys
    for entry in data:
        assert "name" in entry
        assert "table" in entry
        assert "auto_crud" in entry


def test_get_entity_schema_valid(client, auth_headers):
    """Valid entity name returns schema with fields array."""
    response = client.get("/api/v1/entities/student/schema", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "student"
    assert "fields" in data
    assert isinstance(data["fields"], list)
    assert len(data["fields"]) > 0
    # Each field has required keys
    for field in data["fields"]:
        assert "name" in field
        assert "type" in field
        assert "required" in field


def test_get_entity_schema_not_found(client, auth_headers):
    """Unknown entity name returns 404."""
    response = client.get("/api/v1/entities/nonexistent/schema", headers=auth_headers)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_csv_bytes(header: str, *rows: str) -> bytes:
    """Build minimal CSV bytes for upload tests."""
    lines = [header] + list(rows)
    return "\n".join(lines).encode("utf-8")


_test_entity_mounted = False


def _register_test_entity_if_needed():
    """Register a minimal auto_crud test entity so export/search tests have a real model.

    Also ensures the backing table exists in the in-memory test DB and mounts
    the auto-CRUD router into the test app so list/search/filter endpoints are reachable.
    """
    global _test_entity_mounted

    from app.platform.entity_registry import registry
    from app.platform.yaml_loader import EntityConfig, FieldConfig
    from app.db.models import Base

    config = registry.get_config("testitem")
    if config is None:
        config = EntityConfig(
            name="testitem",
            table="testitems_integration",
            fields=[
                FieldConfig(name="label", type="string", required=True, max_length=255),
                FieldConfig(name="status", type="enum", choices=["active", "inactive"]),
            ],
            auto_crud=True,
        )
        model_cls = registry.register(config)
    else:
        model_cls = registry.get_model("testitem")

    # Ensure the table exists in the test engine (may not have been created at session start)
    from tests.conftest import test_engine  # type: ignore[import]
    Base.metadata.create_all(bind=test_engine)

    # Mount the auto-CRUD router once so list/search/filter endpoints are reachable
    if not _test_entity_mounted and model_cls is not None:
        from app.platform.crud_generator import build_crud_router
        from app.main import app as _app
        crud_router = build_crud_router(config, model_cls)
        _app.include_router(crud_router, prefix="/api/v1")
        _test_entity_mounted = True

    return "testitem"


# ---------------------------------------------------------------------------
# Import parse tests
# ---------------------------------------------------------------------------


def test_import_parse_csv(client, auth_headers):
    """POST CSV file returns columns, preview_rows, auto_mapping (DATA-04)."""
    csv_bytes = _make_csv_bytes("name,target_region,notes", "Alice,local,some notes")
    response = client.post(
        "/api/v1/entities/student/import/parse",
        headers=auth_headers,
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "columns" in data
    assert "preview_rows" in data
    assert "auto_mapping" in data
    assert "name" in data["columns"]


def test_import_parse_unauthenticated(client):
    """POST without auth headers returns 401 (T-04-08)."""
    csv_bytes = _make_csv_bytes("name,notes", "Alice,note")
    response = client.post(
        "/api/v1/entities/student/import/parse",
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 401


def test_import_parse_unknown_entity(client, auth_headers):
    """POST to unknown entity returns 404."""
    csv_bytes = _make_csv_bytes("name", "Alice")
    response = client.post(
        "/api/v1/entities/nonexistent/import/parse",
        headers=auth_headers,
        files={"file": ("data.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 404


def test_import_parse_file_too_large(client, auth_headers):
    """POST file > 10 MB returns 413 (T-04-07 DoS mitigation)."""
    # Build a CSV that is just over 10 MB
    large_content = b"name\n" + b"x" * (10 * 1024 * 1024 + 1)
    response = client.post(
        "/api/v1/entities/student/import/parse",
        headers=auth_headers,
        files={"file": ("big.csv", large_content, "text/csv")},
    )
    assert response.status_code == 413


# ---------------------------------------------------------------------------
# Export CSV tests
# ---------------------------------------------------------------------------


def test_export_csv(client, auth_headers):
    """GET /{name}/export returns 200 text/csv with correct Content-Disposition (DATA-04)."""
    _register_test_entity_if_needed()
    response = client.get(
        "/api/v1/entities/testitem/export",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    disposition = response.headers.get("content-disposition", "")
    assert ".csv" in disposition


def test_export_csv_unauthenticated(client):
    """GET /{name}/export without auth returns 401 (T-04-08)."""
    _register_test_entity_if_needed()
    response = client.get("/api/v1/entities/testitem/export")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Search and filter tests (auto-CRUD list endpoint)
# ---------------------------------------------------------------------------


def test_entity_list_search(client, auth_headers):
    """GET list endpoint with ?q= returns 200 and a list (DATA-07)."""
    _register_test_entity_if_needed()
    response = client.get(
        "/api/v1/testitems_integration?q=test",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_entity_list_filter(client, auth_headers):
    """GET list endpoint with ?filters= returns 200 and a list (DATA-08)."""
    import json as _json
    _register_test_entity_if_needed()
    filters = _json.dumps({"status": "active"})
    response = client.get(
        f"/api/v1/testitems_integration?filters={filters}",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)
