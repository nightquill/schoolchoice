"""
tests/test_admin_users.py

Tests for admin user management endpoints (SEC-01, SEC-02).
Verifies RBAC enforcement: counsellor gets 403, admin gets 200/201/204,
self-delete is blocked, duplicate email returns 409.
"""
from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import uuid as _uuid

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, get_password_hash
from app.db.models import User
from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    """Create an admin user in the test DB."""
    email = "admin-test@example.com"
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(
            id=_uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash("adminpass123"),
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return existing


@pytest.fixture
def counsellor_user(db):
    """Create a counsellor user in the test DB."""
    email = "counsellor-test@example.com"
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(
            id=_uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash("counsellorpass123"),
            role="counsellor",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    return existing


@pytest.fixture
def admin_auth_headers(client, admin_user):
    """Override get_current_user to return admin, yield auth headers."""
    def _override():
        return admin_user

    app.dependency_overrides[get_current_user] = _override
    token = create_access_token(data={"sub": str(admin_user.id)})
    yield {"Authorization": f"Bearer {token}"}
    del app.dependency_overrides[get_current_user]


@pytest.fixture
def counsellor_auth_headers(client, counsellor_user):
    """Override get_current_user to return counsellor, yield auth headers."""
    def _override():
        return counsellor_user

    app.dependency_overrides[get_current_user] = _override
    token = create_access_token(data={"sub": str(counsellor_user.id)})
    yield {"Authorization": f"Bearer {token}"}
    del app.dependency_overrides[get_current_user]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAdminUsersEndpoints:
    """Tests for /api/v1/admin/users endpoints."""

    def test_list_users_unauthenticated(self, client):
        """GET /admin/users without auth returns 401 or 403."""
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code in (401, 403)

    def test_list_users_as_counsellor_returns_403(self, client, counsellor_auth_headers):
        """Counsellor role must be rejected with 403."""
        resp = client.get("/api/v1/admin/users", headers=counsellor_auth_headers)
        assert resp.status_code == 403

    def test_list_users_as_admin_returns_200(self, client, admin_auth_headers):
        """Admin role gets a 200 with a list of users."""
        resp = client.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_user(self, client, admin_auth_headers):
        """POST /admin/users with valid payload returns 201."""
        resp = client.post(
            "/api/v1/admin/users",
            json={
                "email": f"newuser-{_uuid.uuid4().hex[:8]}@example.com",
                "password": "pass123",
                "role": "counsellor",
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["role"] == "counsellor"
        assert "id" in data

    def test_create_user_duplicate_email_returns_409(
        self, client, admin_auth_headers, db
    ):
        """Duplicate email on create returns 409."""
        email = f"dup-{_uuid.uuid4().hex[:8]}@example.com"
        # Create user directly
        user = User(
            id=_uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash("p"),
            role="counsellor",
        )
        db.add(user)
        db.commit()

        resp = client.post(
            "/api/v1/admin/users",
            json={"email": email, "password": "pass123"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 409

    def test_create_user_invalid_role_returns_422(self, client, admin_auth_headers):
        """Invalid role value returns 422 (Pydantic validation)."""
        resp = client.post(
            "/api/v1/admin/users",
            json={
                "email": "invalid-role@example.com",
                "password": "pass123",
                "role": "superadmin",
            },
            headers=admin_auth_headers,
        )
        assert resp.status_code == 422

    def test_update_user_role(self, client, admin_auth_headers, db):
        """PATCH /admin/users/{id} updates role correctly."""
        user = User(
            id=_uuid.uuid4(),
            email=f"update-{_uuid.uuid4().hex[:8]}@example.com",
            hashed_password=get_password_hash("p"),
            role="counsellor",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        resp = client.patch(
            f"/api/v1/admin/users/{user.id}",
            json={"role": "admin"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_delete_user(self, client, admin_auth_headers, db):
        """DELETE /admin/users/{id} soft-deletes with 204."""
        user = User(
            id=_uuid.uuid4(),
            email=f"delete-{_uuid.uuid4().hex[:8]}@example.com",
            hashed_password=get_password_hash("p"),
            role="counsellor",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        resp = client.delete(
            f"/api/v1/admin/users/{user.id}",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 204

        # Verify soft-delete
        db.refresh(user)
        assert user.is_active is False

    def test_self_delete_blocked(self, client, admin_auth_headers, admin_user):
        """Admin cannot delete their own account — returns 403."""
        resp = client.delete(
            f"/api/v1/admin/users/{admin_user.id}",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 403
        assert "cannot delete your own account" in resp.json()["detail"].lower()

    def test_delete_nonexistent_returns_404(self, client, admin_auth_headers):
        """DELETE on a non-existent UUID returns 404."""
        fake_id = str(_uuid.uuid4())
        resp = client.delete(
            f"/api/v1/admin/users/{fake_id}",
            headers=admin_auth_headers,
        )
        assert resp.status_code == 404

    def test_create_user_as_counsellor_returns_403(self, client, counsellor_auth_headers):
        """Counsellor cannot create users."""
        resp = client.post(
            "/api/v1/admin/users",
            json={"email": "x@x.com", "password": "p"},
            headers=counsellor_auth_headers,
        )
        assert resp.status_code == 403
