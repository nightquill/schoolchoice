"""
tests/test_auth.py

Pytest tests for authentication endpoints.
REQ-010, REQ-011, REQ-024, REQ-031
"""

import pytest


# ---------------------------------------------------------------------------
# test_register_success
# REQ-010, REQ-024
# ---------------------------------------------------------------------------
def test_register_success(client):
    """Registering with a valid email and password returns 201 with user data."""
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "newuser@example.com", "password": "securepass1"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert "created_at" in data
    # hashed_password must never appear in the response
    assert "hashed_password" not in data
    assert "password" not in data


# ---------------------------------------------------------------------------
# test_register_duplicate_email
# REQ-010, REQ-024
# ---------------------------------------------------------------------------
def test_register_duplicate_email(client):
    """Registering with an already-used email returns 409 Conflict."""
    payload = {"email": "duplicate@example.com", "password": "password123"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


# ---------------------------------------------------------------------------
# test_login_success
# REQ-010, REQ-031
# ---------------------------------------------------------------------------
def test_login_success(client):
    """Logging in with correct credentials returns 200 with access_token."""
    payload = {"email": "loginuser@example.com", "password": "password123"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "expires_in" in data
    assert isinstance(data["expires_in"], int)


# ---------------------------------------------------------------------------
# test_login_wrong_password
# REQ-010, REQ-031
# ---------------------------------------------------------------------------
def test_login_wrong_password(client):
    """Logging in with the wrong password returns 401 Unauthorized."""
    payload = {"email": "wrongpass@example.com", "password": "correctpass1"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect password" in response.json()["detail"]


# ---------------------------------------------------------------------------
# test_login_email_not_found
# REQ-010, REQ-031
# ---------------------------------------------------------------------------
def test_login_email_not_found(client):
    """Logging in with an unregistered email returns 404 Not Found."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "notregistered@example.com", "password": "somepassword"},
    )
    assert response.status_code == 404
    assert "No account found" in response.json()["detail"]


# ---------------------------------------------------------------------------
# test_protected_route_without_token
# REQ-010, REQ-011
# ---------------------------------------------------------------------------
def test_protected_route_without_token(client):
    """Accessing a protected route without a token returns 401 Unauthorized."""
    response = client.get("/api/v1/students")
    assert response.status_code == 401
