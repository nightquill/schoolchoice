"""
tests/conftest.py

Pytest configuration: in-memory SQLite test database and TestClient fixture.
Overrides the get_db dependency for isolation.
"""

import os

# Set environment variables before any app imports so Settings can load them.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base
import app.db.models_v2  # noqa: F401 — register v2 models with Base.metadata
from app.db.session import get_db
from app.main import app

# ---------------------------------------------------------------------------
# SQLite in-memory engine
# ---------------------------------------------------------------------------
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


# SQLite does not enforce CHECK constraints by default; enable them.
@event.listens_for(test_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


# ---------------------------------------------------------------------------
# Create all tables once per test session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


# ---------------------------------------------------------------------------
# Override get_db dependency to use the test database
# ---------------------------------------------------------------------------
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ---------------------------------------------------------------------------
# TestClient fixture
# ---------------------------------------------------------------------------
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# DB session fixture for direct DB access in tests
# ---------------------------------------------------------------------------
@pytest.fixture
def db():
    """Yield a DB session for direct database access in tests."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Helper: create a test user, override get_current_user to return it
# ---------------------------------------------------------------------------
@pytest.fixture
def auth_headers(client, db):
    """
    Register a user via the API, then override get_current_user to bypass
    the SQLite UUID type mismatch issue when querying by UUID string.
    Returns Authorization headers with a valid JWT token.
    """
    import uuid as _uuid
    from app.db.models import User
    from app.core.security import get_password_hash, create_access_token
    from app.core.dependencies import get_current_user
    from datetime import timedelta

    email = "test@example.com"
    password = "testpassword123"

    # Create or get user directly in the DB
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(
            id=_uuid.uuid4(),
            email=email,
            hashed_password=get_password_hash(password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user = existing

    # Override get_current_user to return this user directly (bypasses UUID query)
    def _override_get_current_user():
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user

    # Create a real JWT for completeness
    token = create_access_token(data={"sub": str(user.id)})

    yield {"Authorization": f"Bearer {token}"}

    # Restore original get_current_user
    del app.dependency_overrides[get_current_user]
