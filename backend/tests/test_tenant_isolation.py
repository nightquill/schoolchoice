"""
tests/test_tenant_isolation.py

Cross-tenant isolation integration tests.
Verify that users in Organisation A cannot read, update, or delete
data belonging to Organisation B.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, Organisation, OrganisationMembership, User
from app.modules.school_choice.models.models import Student
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user
from app.db.session import get_db
import app.db.models_v2  # noqa: F401 — register v2 models with Base.metadata
from app.main import app as fastapi_app


# ---------------------------------------------------------------------------
# Module-scoped fixtures
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
def seed_data(Session):
    """Create two orgs, two users (one per org), and one student per org."""
    session = Session()

    org_a = Organisation(id=uuid.uuid4(), name="Org A", slug="org-a")
    org_b = Organisation(id=uuid.uuid4(), name="Org B", slug="org-b")
    session.add_all([org_a, org_b])
    session.flush()

    user_a = User(
        id=uuid.uuid4(),
        email="user-a@example.com",
        hashed_password=get_password_hash("password-a"),
    )
    user_b = User(
        id=uuid.uuid4(),
        email="user-b@example.com",
        hashed_password=get_password_hash("password-b"),
    )
    session.add_all([user_a, user_b])
    session.flush()

    mem_a = OrganisationMembership(
        id=uuid.uuid4(), organisation_id=org_a.id, user_id=user_a.id, role="admin",
    )
    mem_b = OrganisationMembership(
        id=uuid.uuid4(), organisation_id=org_b.id, user_id=user_b.id, role="admin",
    )
    session.add_all([mem_a, mem_b])
    session.flush()

    student_a = Student(
        user_id=user_a.id,
        organisation_id=org_a.id,
        name="Alice (Org A)",
        grades={},
        interests=[],
        strengths_weaknesses="",
        target_region="local",
    )
    student_b = Student(
        user_id=user_b.id,
        organisation_id=org_b.id,
        name="Bob (Org B)",
        grades={},
        interests=[],
        strengths_weaknesses="",
        target_region="local",
    )
    session.add_all([student_a, student_b])
    session.commit()

    data = {
        "org_a": org_a,
        "org_b": org_b,
        "user_a": user_a,
        "user_b": user_b,
        "student_a": student_a,
        "student_b": student_b,
    }
    yield data
    session.close()


# ---------------------------------------------------------------------------
# Helper: create an authenticated TestClient for a given user + org
# ---------------------------------------------------------------------------

def _make_client(Session, user, org_id):
    """Create a TestClient authenticated as user in org_id."""
    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        user.active_organisation_id = org_id
        return user

    fastapi_app.dependency_overrides[get_db] = override_db
    fastapi_app.dependency_overrides[get_current_user] = override_user
    return TestClient(fastapi_app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_user_a_sees_only_org_a_students(Session, seed_data):
    """User A lists students, sees only Org A students."""
    d = seed_data
    client = _make_client(Session, d["user_a"], d["org_a"].id)
    resp = client.get("/api/v1/students")
    assert resp.status_code == 200
    body = resp.json()
    names = [item["name"] for item in body["items"]]
    assert "Alice (Org A)" in names
    assert "Bob (Org B)" not in names
    assert body["total"] >= 1


def test_user_b_sees_only_org_b_students(Session, seed_data):
    """User B lists students, sees only Org B students."""
    d = seed_data
    client = _make_client(Session, d["user_b"], d["org_b"].id)
    resp = client.get("/api/v1/students")
    assert resp.status_code == 200
    body = resp.json()
    names = [item["name"] for item in body["items"]]
    assert "Bob (Org B)" in names
    assert "Alice (Org A)" not in names
    assert body["total"] >= 1


def test_user_a_cannot_read_org_b_student(Session, seed_data):
    """User A GETs Org B student by ID, gets 403."""
    d = seed_data
    client = _make_client(Session, d["user_a"], d["org_a"].id)
    resp = client.get(f"/api/v1/students/{d['student_b'].id}")
    assert resp.status_code == 403


def test_user_a_cannot_update_org_b_student(Session, seed_data):
    """User A PUTs Org B student, gets 403."""
    d = seed_data
    client = _make_client(Session, d["user_a"], d["org_a"].id)
    resp = client.put(
        f"/api/v1/students/{d['student_b'].id}",
        json={
            "name": "Hacked Name",
            "grades": {},
            "interests": [],
            "strengths_weaknesses": "",
            "target_region": "local",
        },
    )
    assert resp.status_code == 403


def test_user_a_cannot_delete_org_b_student(Session, seed_data):
    """User A DELETEs Org B student, gets 403."""
    d = seed_data
    client = _make_client(Session, d["user_a"], d["org_a"].id)
    resp = client.delete(f"/api/v1/students/{d['student_b'].id}")
    assert resp.status_code == 403


def test_created_student_inherits_org(Session, seed_data):
    """User A creates a student; it gets Org A's organisation_id. User B cannot see it."""
    d = seed_data
    client_a = _make_client(Session, d["user_a"], d["org_a"].id)
    resp = client_a.post(
        "/api/v1/students",
        json={
            "name": "Charlie (created by A)",
            "grades": {},
            "interests": [],
            "strengths_weaknesses": "",
            "target_region": "local",
        },
    )
    assert resp.status_code == 201
    created = resp.json()
    created_id = created["id"]

    # Verify Org A can see it in their list
    list_resp = client_a.get("/api/v1/students")
    assert list_resp.status_code == 200
    names_a = [item["name"] for item in list_resp.json()["items"]]
    assert "Charlie (created by A)" in names_a

    # User B cannot see it
    client_b = _make_client(Session, d["user_b"], d["org_b"].id)
    list_resp_b = client_b.get("/api/v1/students")
    assert list_resp_b.status_code == 200
    names_b = [item["name"] for item in list_resp_b.json()["items"]]
    assert "Charlie (created by A)" not in names_b

    # User B cannot read it directly
    resp_b = client_b.get(f"/api/v1/students/{created_id}")
    assert resp_b.status_code == 403
