"""
tests/test_organisation_routes.py

Tests for organisation CRUD admin endpoints.
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
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import uuid as _uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, get_password_hash
from app.db.models import Base, User
from app.db.session import get_db
from app.main import app as fastapi_app
import app.db.models_v2  # noqa: F401 — register v2 models with Base.metadata


# ---------------------------------------------------------------------------
# Module-scoped SQLite in-memory engine with FK enforcement
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


@pytest.fixture(scope="module")
def Session(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="module")
def admin_user(Session):
    """Create an admin user in the test DB."""
    session = Session()
    user = User(
        id=_uuid.uuid4(),
        email=f"org-admin-{_uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("adminpass123"),
        role="admin",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    session.close()
    return user


@pytest.fixture()
def db(Session):
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(Session, admin_user):
    """TestClient with dependency overrides for get_db and get_current_user."""
    def _override_get_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def _override_get_current_user():
        return admin_user

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(fastapi_app) as c:
        yield c

    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

_created_org_id: str | None = None


def test_create_organisation(client):
    """POST /organisations returns 201 with name, slug, is_active."""
    global _created_org_id
    resp = client.post(
        "/api/v1/organisations",
        json={"name": "Acme School"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Acme School"
    assert data["slug"] == "acme-school"
    assert data["is_active"] is True
    _created_org_id = data["id"]


def test_list_organisations(client):
    """GET /organisations returns at least 1 org."""
    resp = client.get("/api/v1/organisations")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


def test_get_organisation(client):
    """GET /organisations/{id} returns correct org."""
    global _created_org_id
    assert _created_org_id is not None, "test_create_organisation must run first"
    resp = client.get(f"/api/v1/organisations/{_created_org_id}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == _created_org_id
    assert data["name"] == "Acme School"
    assert data["slug"] == "acme-school"
    assert data["is_active"] is True


def test_add_member_to_organisation(client, admin_user):
    """POST /organisations/{id}/members returns 201."""
    global _created_org_id
    assert _created_org_id is not None
    resp = client.post(
        f"/api/v1/organisations/{_created_org_id}/members",
        json={"user_id": str(admin_user.id), "role": "admin"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["user_id"] == str(admin_user.id)
    assert data["role"] == "admin"


def test_list_members(client):
    """GET /organisations/{id}/members returns at least 1 member."""
    global _created_org_id
    assert _created_org_id is not None
    resp = client.get(f"/api/v1/organisations/{_created_org_id}/members")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


def test_duplicate_slug_rejected(client):
    """POST with same slug returns 409."""
    # First create should work
    resp1 = client.post(
        "/api/v1/organisations",
        json={"name": "Unique Org", "slug": "unique-org-dup-test"},
    )
    assert resp1.status_code == 201, resp1.text

    # Second with same slug should fail
    resp2 = client.post(
        "/api/v1/organisations",
        json={"name": "Another Org", "slug": "unique-org-dup-test"},
    )
    assert resp2.status_code == 409, resp2.text
