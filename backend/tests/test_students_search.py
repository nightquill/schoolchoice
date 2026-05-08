"""Test student list search parameter."""


def test_student_list_search_returns_200(client, auth_headers):
    """GET /api/v1/students?q=test returns 200 with items array."""
    response = client.get("/api/v1/students?q=test", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_student_list_search_unauthenticated(client):
    """GET /api/v1/students?q=test without auth returns 401."""
    response = client.get("/api/v1/students?q=test")
    assert response.status_code == 401
