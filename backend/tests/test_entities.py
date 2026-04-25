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
