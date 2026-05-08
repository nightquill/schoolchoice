"""
tests/test_organisation.py

Unit tests for Organisation and OrganisationMembership ORM models.
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
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, Organisation, OrganisationMembership, User
from app.modules.school_choice.models.models import Student, StudentCohort
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


@pytest.fixture()
def db(Session):
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_create_organisation(db):
    """Create an Organisation and verify all fields persist correctly."""
    org = Organisation(
        id=uuid.uuid4(),
        name="Test School",
        slug="test-school",
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    assert org.name == "Test School"
    assert org.slug == "test-school"
    assert org.is_active is True
    assert org.created_at is not None
    assert org.updated_at is not None


def test_create_membership(db):
    """Create a User + Organisation + Membership and verify fields."""
    user = User(
        id=uuid.uuid4(),
        email=f"member-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    org = Organisation(
        id=uuid.uuid4(),
        name="Membership Org",
        slug=f"membership-org-{uuid.uuid4().hex[:8]}",
    )
    db.add_all([user, org])
    db.flush()

    membership = OrganisationMembership(
        id=uuid.uuid4(),
        organisation_id=org.id,
        user_id=user.id,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    assert membership.role == "admin"
    assert membership.organisation_id == org.id
    assert membership.user_id == user.id
    assert membership.created_at is not None
    # Check relationships
    assert membership.organisation.name == "Membership Org"
    assert membership.user.email.startswith("member-")


def test_organisation_slug_unique(db):
    """Duplicate slug raises IntegrityError."""
    slug = f"unique-slug-{uuid.uuid4().hex[:8]}"
    org1 = Organisation(id=uuid.uuid4(), name="Org A", slug=slug)
    db.add(org1)
    db.commit()

    org2 = Organisation(id=uuid.uuid4(), name="Org B", slug=slug)
    db.add(org2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_membership_unique_per_user_org(db):
    """Duplicate (organisation_id, user_id) raises IntegrityError."""
    user = User(
        id=uuid.uuid4(),
        email=f"dup-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    org = Organisation(
        id=uuid.uuid4(),
        name="Dup Org",
        slug=f"dup-org-{uuid.uuid4().hex[:8]}",
    )
    db.add_all([user, org])
    db.flush()

    m1 = OrganisationMembership(
        id=uuid.uuid4(), organisation_id=org.id, user_id=user.id, role="member",
    )
    db.add(m1)
    db.commit()

    m2 = OrganisationMembership(
        id=uuid.uuid4(), organisation_id=org.id, user_id=user.id, role="admin",
    )
    db.add(m2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_membership_role_constraint(db):
    """Invalid role value raises IntegrityError (CHECK constraint)."""
    user = User(
        id=uuid.uuid4(),
        email=f"bad-role-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    org = Organisation(
        id=uuid.uuid4(),
        name="Role Org",
        slug=f"role-org-{uuid.uuid4().hex[:8]}",
    )
    db.add_all([user, org])
    db.flush()

    m = OrganisationMembership(
        id=uuid.uuid4(), organisation_id=org.id, user_id=user.id, role="superadmin",
    )
    db.add(m)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_student_has_organisation_id(db):
    """Student must have an organisation_id FK."""
    org = Organisation(
        id=uuid.uuid4(),
        name="Student Org",
        slug=f"student-org-{uuid.uuid4().hex[:8]}",
    )
    user = User(
        id=uuid.uuid4(),
        email=f"student-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    db.add_all([org, user])
    db.flush()

    student = Student(
        user_id=user.id,
        organisation_id=org.id,
        name="Test Student",
        grades={},
        interests=[],
        strengths_weaknesses="",
        target_region="local",
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    assert student.organisation_id == org.id


def test_jwt_contains_org_id():
    """JWT access token must include org_id claim."""
    from app.core.security import create_access_token, verify_token
    token = create_access_token(data={
        "sub": str(uuid.uuid4()),
        "org_id": str(uuid.uuid4()),
    })
    payload = verify_token(token)
    assert "org_id" in payload
    assert payload["org_id"] is not None


def test_cohort_has_organisation_id(db):
    """StudentCohort must have an organisation_id FK."""
    org = Organisation(
        id=uuid.uuid4(),
        name="Cohort Org",
        slug=f"cohort-org-{uuid.uuid4().hex[:8]}",
    )
    user = User(
        id=uuid.uuid4(),
        email=f"cohort-test-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="fakehash",
    )
    db.add_all([org, user])
    db.flush()

    cohort = StudentCohort(
        user_id=user.id,
        organisation_id=org.id,
        name="5A 2026",
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    assert cohort.organisation_id == org.id
