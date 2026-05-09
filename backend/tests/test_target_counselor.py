"""Tests for counselor agency on targets (Decision #11)."""


def test_patch_target_pin(client, auth_headers):
    """PATCH /api/v1/targets/{id} with is_pinned=true returns 200."""
    student = client.post("/api/v1/students", json={
        "name": "Test Pin Student", "target_region": "local"
    }, headers=auth_headers).json()
    schools = client.get("/api/v1/schools", headers=auth_headers).json()
    if isinstance(schools, dict):
        schools = schools.get("items", [])
    if not schools:
        return  # skip if no schools
    school_id = str(schools[0]["id"])
    target = client.post(f"/api/v1/students/{student['id']}/targets", json={
        "school_id": school_id
    }, headers=auth_headers).json()
    resp = client.patch(f"/api/v1/targets/{target['id']}", json={
        "is_pinned": True,
        "counselor_notes": "Strong fit despite low score"
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_pinned"] is True
    assert data["counselor_notes"] == "Strong fit despite low score"


def test_patch_target_dismiss(client, auth_headers):
    """PATCH /api/v1/targets/{id} with is_dismissed=true returns 200."""
    student = client.post("/api/v1/students", json={
        "name": "Test Dismiss Student", "target_region": "local"
    }, headers=auth_headers).json()
    schools = client.get("/api/v1/schools", headers=auth_headers).json()
    if isinstance(schools, dict):
        schools = schools.get("items", [])
    if not schools:
        return  # skip if no schools
    school_id = str(schools[0]["id"])
    target = client.post(f"/api/v1/students/{student['id']}/targets", json={
        "school_id": school_id
    }, headers=auth_headers).json()
    resp = client.patch(f"/api/v1/targets/{target['id']}", json={
        "is_dismissed": True
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_dismissed"] is True


def test_patch_target_not_found(client, auth_headers):
    """PATCH /api/v1/targets/{id} with non-existent ID returns 404."""
    resp = client.patch(
        "/api/v1/targets/00000000-0000-0000-0000-000000000001",
        json={"is_pinned": True},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_patch_target_unauthenticated(client):
    """PATCH /api/v1/targets/{id} without auth returns 401."""
    resp = client.patch(
        "/api/v1/targets/00000000-0000-0000-0000-000000000001",
        json={"is_pinned": True},
    )
    assert resp.status_code == 401
