# Organisation Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add platform-level `Organisation` and `OrganisationMembership` models, migrate all data scoping from `user_id` to `organisation_id`, and enforce cross-tenant data isolation with comprehensive tests.

**Architecture:** New `Organisation` table owns students, cohorts, and other domain data. Users belong to organisations via `OrganisationMembership` join table with roles (`owner`, `admin`, `member`). JWT tokens include `org_id` claim. All queries filter by `organisation_id` instead of `user_id`. Students get a `counselor_id` FK as an assignment (not ownership). Frontend fetches org context on login and scopes all views accordingly.

**Tech Stack:** SQLAlchemy (existing ORM), FastAPI dependencies, Pydantic schemas, pytest + TestClient, React Context (frontend)

---

### Task 1: Organisation and OrganisationMembership ORM Models

**Files:**
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Write the failing test**

Create a test that imports and instantiates the new models.

```python
# backend/tests/test_organisation.py

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
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, Organisation, OrganisationMembership, User


@pytest.fixture(scope="module")
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_organisation(db):
    org = Organisation(name="Test School", slug="test-school")
    db.add(org)
    db.commit()
    db.refresh(org)

    assert org.id is not None
    assert org.name == "Test School"
    assert org.slug == "test-school"
    assert org.is_active is True


def test_create_membership(db):
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user = User(
        id=uuid.uuid4(),
        email="member@test.com",
        hashed_password="fakehash",
    )
    db.add(user)
    db.commit()

    membership = OrganisationMembership(
        organisation_id=org.id,
        user_id=user.id,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    assert membership.id is not None
    assert membership.role == "admin"
    assert membership.organisation_id == org.id
    assert membership.user_id == user.id


def test_organisation_slug_unique(db):
    from sqlalchemy.exc import IntegrityError
    org2 = Organisation(name="Another School", slug="test-school")
    db.add(org2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_membership_unique_per_user_org(db):
    from sqlalchemy.exc import IntegrityError
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user = db.query(User).filter(User.email == "member@test.com").first()
    dup = OrganisationMembership(
        organisation_id=org.id,
        user_id=user.id,
        role="member",
    )
    db.add(dup)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_membership_role_constraint(db):
    """Only owner, admin, member roles allowed."""
    from sqlalchemy.exc import IntegrityError
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user2 = User(
        id=uuid.uuid4(),
        email="badrole@test.com",
        hashed_password="fakehash",
    )
    db.add(user2)
    db.commit()

    bad = OrganisationMembership(
        organisation_id=org.id,
        user_id=user2.id,
        role="superuser",
    )
    db.add(bad)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py -v`
Expected: FAIL with `ImportError: cannot import name 'Organisation' from 'app.db.models'`

- [ ] **Step 3: Write the Organisation and OrganisationMembership models**

Add to `backend/app/db/models.py`, after the `User` class and before the re-export section:

```python
# ---------------------------------------------------------------------------
# organisations — platform-level multi-tenancy
# ---------------------------------------------------------------------------


class Organisation(Base):
    """
    An organisation (school, company, etc.) that owns data.
    Platform-level: domain modules extend with profile tables.
    """

    __tablename__ = "organisations"

    __table_args__ = (
        UniqueConstraint("slug", name="uq_organisations_slug"),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    name = Column(
        String(255),
        nullable=False,
        comment="Display name of the organisation",
    )
    slug = Column(
        String(255),
        nullable=False,
        comment="URL-safe unique identifier e.g. 'st-pauls-college'",
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        comment="Soft-delete flag",
    )
    metadata_ = Column(
        "metadata",
        Text,
        nullable=True,
        comment="JSON string for domain-specific extension data",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        default=_utcnow,
        comment="Set at INSERT and UPDATE",
    )

    # Relationships
    memberships = relationship(
        "OrganisationMembership",
        back_populates="organisation",
        cascade="all, delete-orphan",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<Organisation id={self.id!s} name={self.name!r} slug={self.slug!r}>"


class OrganisationMembership(Base):
    """
    Join table: User belongs to Organisation with a role.
    Roles: owner (billing/delete org), admin (manage users/settings), member (use the app).
    """

    __tablename__ = "organisation_memberships"

    __table_args__ = (
        UniqueConstraint(
            "organisation_id", "user_id",
            name="uq_org_membership_org_user",
        ),
        CheckConstraint(
            "role IN ('owner', 'admin', 'member')",
            name="ck_org_membership_role",
        ),
    )

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
        comment="Primary key",
    )
    organisation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE", name="fk_orgmem_org_id"),
        nullable=False,
        index=True,
        comment="FK to organisations.id",
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE", name="fk_orgmem_user_id"),
        nullable=False,
        index=True,
        comment="FK to users.id",
    )
    role = Column(
        String(20),
        nullable=False,
        default="member",
        server_default="'member'",
        comment="Enum: owner | admin | member",
    )
    created_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        comment="Set at INSERT",
    )

    # Relationships
    organisation = relationship("Organisation", back_populates="memberships")
    user = relationship("User", back_populates="org_memberships")

    def __repr__(self) -> str:
        return (
            f"<OrganisationMembership org={self.organisation_id!s} "
            f"user={self.user_id!s} role={self.role!r}>"
        )
```

Also add `org_memberships` relationship to the `User` class:

```python
    # In User class, after the students relationship:
    org_memberships = relationship(
        "OrganisationMembership",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="select",
    )
```

Also add `CheckConstraint` to the imports at the top of the file (it's not currently imported):

```python
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    CHAR,
)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/db/models.py backend/tests/test_organisation.py
git commit -m "feat: add Organisation and OrganisationMembership platform models

Multi-tenancy foundation — organisations own data, users belong to
organisations via membership with role-based access (owner/admin/member)."
```

---

### Task 2: Add organisation_id to Student and StudentCohort

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py`
- Modify: `backend/tests/test_organisation.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_organisation.py`:

```python
from app.modules.school_choice.models.models import Student, StudentCohort


def test_student_has_organisation_id(db):
    """Student must have an organisation_id FK."""
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user = db.query(User).filter(User.email == "member@test.com").first()

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


def test_cohort_has_organisation_id(db):
    """StudentCohort must have an organisation_id FK."""
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user = db.query(User).filter(User.email == "member@test.com").first()

    cohort = StudentCohort(
        user_id=user.id,
        organisation_id=org.id,
        name="5A 2026",
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)

    assert cohort.organisation_id == org.id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py::test_student_has_organisation_id tests/test_organisation.py::test_cohort_has_organisation_id -v`
Expected: FAIL — `TypeError` on unknown column `organisation_id`

- [ ] **Step 3: Add organisation_id to Student and StudentCohort**

In `backend/app/modules/school_choice/models/models.py`:

Add to the `Student` class, after the `user_id` column:

```python
    organisation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE", name="fk_students_org_id"),
        nullable=True,  # nullable during migration; will be NOT NULL after backfill
        index=True,
        comment="Owning organisation — FK to organisations.id",
    )
```

Add to the `Student` class relationships:

```python
    organisation = relationship("Organisation", backref="students", lazy="select")
```

Add to the `StudentCohort` class, after the `user_id` column:

```python
    organisation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organisations.id", ondelete="CASCADE", name="fk_cohorts_org_id"),
        nullable=True,  # nullable during migration; will be NOT NULL after backfill
        index=True,
        comment="Owning organisation — FK to organisations.id",
    )
```

Add `Organisation` to the imports from `app.db.models`:

```python
from app.db.models import Base, _utcnow, User, Organisation  # noqa: F401
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py -v`
Expected: All 7 tests PASS

- [ ] **Step 5: Run existing tests to check for regressions**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All existing tests still pass (organisation_id is nullable, so no existing code breaks)

- [ ] **Step 6: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/modules/school_choice/models/models.py backend/tests/test_organisation.py
git commit -m "feat: add organisation_id FK to Student and StudentCohort

Nullable for now to avoid breaking existing data. Will be made NOT NULL
after migration backfill in a later task."
```

---

### Task 3: Organisation-aware auth dependency

**Files:**
- Modify: `backend/app/core/dependencies.py`
- Modify: `backend/app/core/security.py`
- Modify: `backend/app/services/auth_service.py`
- Create: `backend/app/schemas/organisation.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_organisation.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py::test_jwt_contains_org_id -v`
Expected: PASS — JWT already supports arbitrary claims. This confirms the mechanism works.

- [ ] **Step 3: Write the test for org-aware get_current_user**

Append to `backend/tests/test_organisation.py`:

```python
def test_get_current_user_returns_org_context(db):
    """get_current_user should attach active_organisation_id to user."""
    from app.core.security import create_access_token
    from fastapi.testclient import TestClient
    from app.main import app
    from app.db.session import get_db
    from app.core.dependencies import get_current_user

    # Setup: org + user + membership
    org = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    user = db.query(User).filter(User.email == "member@test.com").first()

    # Create token with org_id
    token = create_access_token(data={
        "sub": str(user.id),
        "org_id": str(org.id),
    })

    # We verify the token payload contains org_id — the dependency will use it
    from app.core.security import verify_token
    payload = verify_token(token)
    assert payload["org_id"] == str(org.id)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py::test_get_current_user_returns_org_context -v`
Expected: PASS

- [ ] **Step 5: Create organisation schemas**

```python
# backend/app/schemas/organisation.py

"""Pydantic schemas for Organisation resources."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator
import re


class OrganisationCreate(BaseModel):
    """Request body for creating an organisation."""
    name: str
    slug: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Organisation name must not be empty")
        return v.strip()

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens")
        return v


class OrganisationResponse(BaseModel):
    """Response body for organisation endpoints."""
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganisationMemberResponse(BaseModel):
    """A member within an organisation."""
    user_id: UUID
    email: str
    display_name: Optional[str] = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 6: Update auth_service.py to include org_id in JWT**

In `backend/app/services/auth_service.py`, update `login_for_access_token`:

```python
def login_for_access_token(db: Session, email: str, password: str) -> dict:
    """
    Authenticate and issue a JWT access token.
    Returns dict with access_token, token_type, expires_in.
    Raises HTTP 401 on invalid credentials.
    """
    from app.db.models import OrganisationMembership

    user, error_code = authenticate_user(db, email, password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find active organisation membership (use first org if multiple)
    membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    org_id = str(membership.organisation_id) if membership else None

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {"sub": str(user.id)}
    if org_id:
        token_data["org_id"] = org_id

    access_token = create_access_token(
        data=token_data,
        expires_delta=expires_delta,
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
```

- [ ] **Step 7: Update dependencies.py to attach org context to user**

In `backend/app/core/dependencies.py`, update `_resolve_user_from_token`:

```python
def _resolve_user_from_token(token_str: str, db: Session) -> User:
    """
    Validate a JWT string and return the corresponding User ORM object.
    Attaches active_organisation_id as a runtime attribute.
    Raises HTTP 401 if the token is invalid or the user does not exist.
    """
    _unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(token_str)
    except JWTError:
        raise _unauthorized

    user_id_str: Optional[str] = payload.get("sub")
    if user_id_str is None:
        raise _unauthorized

    try:
        user_id = UUID(user_id_str)
    except (ValueError, AttributeError):
        raise _unauthorized

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise _unauthorized

    # Attach org context from JWT claim
    org_id_str = payload.get("org_id")
    if org_id_str:
        try:
            user.active_organisation_id = UUID(org_id_str)
        except (ValueError, AttributeError):
            user.active_organisation_id = None
    else:
        user.active_organisation_id = None

    return user
```

- [ ] **Step 8: Run all tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass. Existing code unaffected because `active_organisation_id` is a runtime attribute — no DB query changes yet.

- [ ] **Step 9: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/core/dependencies.py backend/app/services/auth_service.py backend/app/schemas/organisation.py backend/tests/test_organisation.py
git commit -m "feat: org-aware JWT and auth dependency

JWT now includes org_id claim. get_current_user attaches
active_organisation_id to the User object as runtime attribute."
```

---

### Task 4: Organisation CRUD admin endpoints

**Files:**
- Create: `backend/app/api/v1/routes/organisations.py`
- Modify: `backend/app/api/v1/routes/__init__.py` (or `backend/app/main.py` — wherever routers are registered)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_organisation_routes.py

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
from app.main import app
from app.db.models import Base, User, Organisation, OrganisationMembership
from app.core.security import get_password_hash, create_access_token
from app.core.dependencies import get_current_user
from app.db.session import get_db

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture(scope="module")
def engine():
    e = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    @event.listens_for(e, "connect")
    def pragma(conn, _):
        conn.cursor().execute("PRAGMA foreign_keys=ON")
    import app.db.models_v2  # noqa: F401 — register v2 models
    Base.metadata.create_all(bind=e)
    return e


@pytest.fixture(scope="module")
def db(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="module")
def admin_user(db):
    user = User(
        id=uuid.uuid4(),
        email="orgadmin@test.com",
        hashed_password=get_password_hash("testpassword123"),
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="module")
def client(engine, admin_user):
    Session = sessionmaker(bind=engine)

    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        admin_user.active_organisation_id = None
        return admin_user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user

    with TestClient(app) as c:
        yield c

    del app.dependency_overrides[get_db]
    del app.dependency_overrides[get_current_user]


def test_create_organisation(client):
    resp = client.post("/api/v1/organisations", json={
        "name": "St Paul's College",
        "slug": "st-pauls-college",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "St Paul's College"
    assert data["slug"] == "st-pauls-college"
    assert data["is_active"] is True


def test_list_organisations(client):
    resp = client.get("/api/v1/organisations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(o["slug"] == "st-pauls-college" for o in data["items"])


def test_get_organisation(client):
    # Get the org ID from list
    orgs = client.get("/api/v1/organisations").json()["items"]
    org_id = orgs[0]["id"]

    resp = client.get(f"/api/v1/organisations/{org_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == org_id


def test_add_member_to_organisation(client, admin_user):
    orgs = client.get("/api/v1/organisations").json()["items"]
    org_id = orgs[0]["id"]

    resp = client.post(f"/api/v1/organisations/{org_id}/members", json={
        "user_id": str(admin_user.id),
        "role": "owner",
    })
    assert resp.status_code == 201


def test_list_members(client):
    orgs = client.get("/api/v1/organisations").json()["items"]
    org_id = orgs[0]["id"]

    resp = client.get(f"/api/v1/organisations/{org_id}/members")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["members"]) >= 1


def test_duplicate_slug_rejected(client):
    resp = client.post("/api/v1/organisations", json={
        "name": "Different Name",
        "slug": "st-pauls-college",
    })
    assert resp.status_code == 409
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation_routes.py -v`
Expected: FAIL — 404 because routes don't exist yet

- [ ] **Step 3: Write the organisation routes**

```python
# backend/app/api/v1/routes/organisations.py

"""
Organisation management endpoints. Admin only.
"""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.db.models import Organisation, OrganisationMembership, User
from app.db.session import get_db
from app.schemas.organisation import (
    OrganisationCreate,
    OrganisationMemberResponse,
    OrganisationResponse,
)

router = APIRouter(prefix="/organisations", tags=["organisations"])


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from a name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "org"


# ---------------------------------------------------------------------------
# POST /organisations — create an organisation
# ---------------------------------------------------------------------------

@router.post("", response_model=OrganisationResponse, status_code=status.HTTP_201_CREATED)
def create_organisation(
    payload: OrganisationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new organisation. Admin only."""
    slug = payload.slug or _slugify(payload.name)

    org = Organisation(name=payload.name, slug=slug)
    db.add(org)
    try:
        db.commit()
        db.refresh(org)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organisation with slug '{slug}' already exists",
        )
    return org


# ---------------------------------------------------------------------------
# GET /organisations — list all organisations
# ---------------------------------------------------------------------------

@router.get("", status_code=status.HTTP_200_OK)
def list_organisations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List all active organisations. Admin only."""
    query = db.query(Organisation).filter(Organisation.is_active == True)  # noqa: E712
    total = query.count()
    orgs = query.offset(skip).limit(limit).all()
    return {
        "items": [OrganisationResponse.model_validate(o).model_dump() for o in orgs],
        "total": total,
    }


# ---------------------------------------------------------------------------
# GET /organisations/{org_id} — get organisation detail
# ---------------------------------------------------------------------------

@router.get("/{org_id}", response_model=OrganisationResponse)
def get_organisation(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Get organisation by ID. Admin only."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")
    return org


# ---------------------------------------------------------------------------
# POST /organisations/{org_id}/members — add a member
# ---------------------------------------------------------------------------

from pydantic import BaseModel


class AddMemberRequest(BaseModel):
    user_id: UUID
    role: str = "member"


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    org_id: UUID,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Add a user to an organisation. Admin only."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    membership = OrganisationMembership(
        organisation_id=org_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    db.add(membership)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User is already a member")
    return {"status": "added"}


# ---------------------------------------------------------------------------
# GET /organisations/{org_id}/members — list members
# ---------------------------------------------------------------------------

@router.get("/{org_id}/members")
def list_members(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """List members of an organisation. Admin only."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organisation not found")

    memberships = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.organisation_id == org_id)
        .all()
    )
    members = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            members.append({
                "user_id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "role": m.role,
                "created_at": m.created_at,
            })
    return {"members": members}
```

- [ ] **Step 4: Register the router in main.py**

Find where routers are included in `backend/app/main.py` and add:

```python
from app.api.v1.routes.organisations import router as organisations_router
app.include_router(organisations_router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation_routes.py -v`
Expected: All 6 tests PASS

- [ ] **Step 6: Run full test suite for regressions**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/api/v1/routes/organisations.py backend/app/main.py backend/tests/test_organisation_routes.py
git commit -m "feat: add Organisation CRUD endpoints (admin only)

Create/list/get organisations, add/list members. All admin-gated."
```

---

### Task 5: Migrate query scoping from user_id to organisation_id

**Files:**
- Modify: `backend/app/services/student_service.py`
- Modify: `backend/app/api/v1/routes/students.py`
- Modify: `backend/app/api/v1/routes/cohorts.py`
- Modify: `backend/tests/test_organisation.py`

This is the core change. All student/cohort queries switch from `WHERE user_id = X` to `WHERE organisation_id = X`. The `user_id` on Student becomes `counselor_id` — an assignment, not an ownership boundary.

- [ ] **Step 1: Write the failing isolation test**

Append to `backend/tests/test_organisation.py`:

```python
def test_cross_org_student_isolation(db):
    """A user in Org A must not see students in Org B."""
    # Create Org B
    org_b = Organisation(name="Other School", slug="other-school")
    db.add(org_b)
    db.commit()
    db.refresh(org_b)

    # Create user in Org B
    user_b = User(
        id=uuid.uuid4(),
        email="teacher_b@test.com",
        hashed_password="fakehash",
    )
    db.add(user_b)
    db.commit()

    mem_b = OrganisationMembership(
        organisation_id=org_b.id, user_id=user_b.id, role="member",
    )
    db.add(mem_b)
    db.commit()

    # Create a student in Org B
    student_b = Student(
        user_id=user_b.id,
        organisation_id=org_b.id,
        name="Student In Org B",
        grades={},
        interests=[],
        strengths_weaknesses="",
        target_region="local",
    )
    db.add(student_b)
    db.commit()

    # Query with Org A's ID — should NOT see Org B's student
    org_a = db.query(Organisation).filter(Organisation.slug == "test-school").first()
    org_a_students = (
        db.query(Student)
        .filter(Student.organisation_id == org_a.id)
        .all()
    )
    org_a_student_names = [s.name for s in org_a_students]
    assert "Student In Org B" not in org_a_student_names

    # Query with Org B's ID — should see only Org B's student
    org_b_students = (
        db.query(Student)
        .filter(Student.organisation_id == org_b.id)
        .all()
    )
    assert len(org_b_students) == 1
    assert org_b_students[0].name == "Student In Org B"
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation.py::test_cross_org_student_isolation -v`
Expected: PASS — this test validates the DB-level isolation works with the new column.

- [ ] **Step 3: Update student_service.py to scope by organisation_id**

Replace the `get_students` function:

```python
def get_students(db: Session, user_id: UUID, organisation_id: UUID = None) -> list[Student]:
    """
    Return all student profiles visible to the user.
    If organisation_id is set, scopes to that org. Otherwise falls back to user_id.
    """
    if organisation_id:
        return db.query(Student).filter(Student.organisation_id == organisation_id).all()
    return db.query(Student).filter(Student.user_id == user_id).all()
```

Replace the `get_student` function:

```python
def get_student(db: Session, student_id: UUID, user_id: UUID, organisation_id: UUID = None) -> Student:
    """
    Return a single student profile by ID, enforcing org membership or ownership.
    Raises HTTP 404 if not found, HTTP 403 if not in user's org.
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this ID",
        )
    # Check org-level access first, fall back to user ownership
    if organisation_id:
        if student.organisation_id and str(student.organisation_id) != str(organisation_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student does not belong to your organisation",
            )
    elif str(student.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user does not own this student record",
        )
    return student
```

Replace `create_student`:

```python
def create_student(db: Session, user_id: UUID, data: StudentCreate, organisation_id: UUID = None) -> Student:
    """
    Create a new student profile. Assigned to user and org.
    """
    student = Student(
        user_id=user_id,
        organisation_id=organisation_id,
        name=data.name,
        grades=data.grades,
        interests=data.interests,
        strengths_weaknesses=data.strengths_weaknesses,
        target_region=data.target_region,
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return student
```

Update all other functions (`update_student`, `get_student_match_data`, `get_student_plan_data`, `delete_student`) to accept and pass `organisation_id`:

```python
def update_student(
    db: Session, student_id: UUID, user_id: UUID, data: StudentUpdate, organisation_id: UUID = None
) -> Student:
    student = get_student(db, student_id, user_id, organisation_id)
    student.name = data.name
    student.grades = data.grades
    student.interests = data.interests
    student.strengths_weaknesses = data.strengths_weaknesses
    student.target_region = data.target_region
    db.commit()
    db.refresh(student)
    return student


def get_student_match_data(db: Session, student_id: UUID, user_id: UUID, organisation_id: UUID = None) -> dict:
    student = get_student(db, student_id, user_id, organisation_id)
    return build_student_data(student, db)


def get_student_plan_data(db: Session, student_id: UUID, user_id: UUID, organisation_id: UUID = None) -> tuple:
    student = get_student(db, student_id, user_id, organisation_id)
    student_data = build_student_data(student, db)
    student_dict = build_student_dict_for_plan(student, student_data)
    return student, student_data, student_dict


def delete_student(db: Session, student_id: UUID, user_id: UUID, organisation_id: UUID = None) -> None:
    student = get_student(db, student_id, user_id, organisation_id)
    db.delete(student)
    db.commit()
```

- [ ] **Step 4: Update students.py routes to pass organisation_id**

Add a helper at the top of the routes file to extract org_id:

```python
def _org_id(user: User) -> UUID | None:
    """Extract active_organisation_id from user, if set."""
    return getattr(user, "active_organisation_id", None)
```

Update every route function to pass `organisation_id=_org_id(current_user)` to service calls. For example:

```python
@router.get("", status_code=status.HTTP_200_OK)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    all_students = student_service.get_students(
        db, user_id=current_user.id, organisation_id=_org_id(current_user)
    )
    # ... rest unchanged
```

Apply the same pattern to `create_student`, `get_student`, `update_student`, `update_student_profile`, `update_language_scores`, `get_teacher_evaluations`, `update_teacher_evaluations`, `update_extracurricular`, `update_awards`, `graduate_student`, `delete_student`.

For routes that call `student_service.get_student` directly (profile update, language scores, evaluations, etc.), add `organisation_id=_org_id(current_user)`:

```python
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=_org_id(current_user),
    )
```

- [ ] **Step 5: Update cohorts.py to scope by organisation_id**

Update `_get_cohort_or_404`:

```python
def _get_cohort_or_404(db: Session, cohort_id: UUID, user_id: UUID, organisation_id: UUID = None) -> StudentCohort:
    query = db.query(StudentCohort).filter(StudentCohort.id == cohort_id)
    if organisation_id:
        query = query.filter(StudentCohort.organisation_id == organisation_id)
    else:
        query = query.filter(StudentCohort.user_id == user_id)
    cohort = query.first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return cohort
```

Update `list_cohorts`:

```python
@router.get("", response_model=CohortListResponse, status_code=status.HTTP_200_OK)
def list_cohorts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = getattr(current_user, "active_organisation_id", None)
    query = db.query(StudentCohort)
    if org_id:
        query = query.filter(StudentCohort.organisation_id == org_id)
    else:
        query = query.filter(StudentCohort.user_id == current_user.id)
    cohorts = query.order_by(StudentCohort.created_at.desc()).all()
    return CohortListResponse(
        cohorts=[_cohort_to_response(c) for c in cohorts],
        total=len(cohorts),
    )
```

Update `create_cohort` to set `organisation_id`:

```python
    cohort = StudentCohort(
        user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
        name=payload.name,
        description=payload.description,
    )
```

Pass `organisation_id` through all remaining cohort route functions that call `_get_cohort_or_404`.

Update `search_students` to scope by org:

```python
    org_id = getattr(current_user, "active_organisation_id", None)
    if org_id:
        query = db.query(Student).filter(Student.organisation_id == org_id)
    else:
        query = db.query(Student).filter(Student.user_id == current_user.id)
```

- [ ] **Step 6: Run all tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass. Existing tests work because `active_organisation_id` is None when not set, triggering the `user_id` fallback path.

- [ ] **Step 7: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/services/student_service.py backend/app/api/v1/routes/students.py backend/app/api/v1/routes/cohorts.py backend/tests/test_organisation.py
git commit -m "feat: migrate query scoping from user_id to organisation_id

All student and cohort queries now scope by organisation_id when
available, falling back to user_id for backward compatibility.
Cross-tenant isolation enforced at service layer."
```

---

### Task 6: Update remaining routes to pass organisation context

**Files:**
- Modify: `backend/app/api/v1/routes/targets.py`
- Modify: `backend/app/api/v1/routes/plan.py`
- Modify: `backend/app/api/v1/routes/consultant.py`
- Modify: `backend/app/api/v1/routes/match.py`
- Modify: `backend/app/api/v1/routes/grades.py`
- Modify: `backend/app/api/v1/routes/analytics.py`
- Modify: `backend/app/api/v1/routes/transcripts.py`

Every route that calls `student_service.get_student()` or similar ownership-checked functions must pass `organisation_id`.

- [ ] **Step 1: Grep for all get_student calls across routes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && grep -rn "student_service.get_student\|get_student(" app/api/v1/routes/ --include="*.py"`

This gives the exact list of call sites to update.

- [ ] **Step 2: Update each file**

For each file, add the `_org_id` helper (or import a shared one) and pass `organisation_id=_org_id(current_user)` to every `student_service.get_student()`, `student_service.get_student_match_data()`, and `student_service.get_student_plan_data()` call.

The pattern is identical in every case:

```python
# Before:
student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)

# After:
student = student_service.get_student(
    db, student_id=student_id, user_id=current_user.id,
    organisation_id=getattr(current_user, "active_organisation_id", None),
)
```

Apply this to every route file listed above. Do not change any business logic — only thread the `organisation_id` parameter through.

- [ ] **Step 3: Run all tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/api/v1/routes/
git commit -m "feat: thread organisation_id through all remaining routes

All routes that access student data now pass organisation context
for org-scoped access control."
```

---

### Task 7: Cross-tenant isolation integration tests

**Files:**
- Create: `backend/tests/test_tenant_isolation.py`

These are the non-negotiable permission boundary tests.

- [ ] **Step 1: Write the full test file**

```python
# backend/tests/test_tenant_isolation.py

"""
Cross-tenant data isolation tests.

Verifies that users in Organisation A cannot read, update, or delete
data belonging to Organisation B. These tests are non-negotiable.
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

from app.db.models import Base, User, Organisation, OrganisationMembership
from app.modules.school_choice.models.models import Student, StudentCohort, CohortMembership
from app.core.security import get_password_hash
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.main import app
import app.db.models_v2  # noqa: F401


@pytest.fixture(scope="module")
def engine():
    e = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    @event.listens_for(e, "connect")
    def pragma(conn, _):
        conn.cursor().execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(bind=e)
    return e


@pytest.fixture(scope="module")
def Session(engine):
    return sessionmaker(bind=engine)


@pytest.fixture(scope="module")
def seed_data(Session):
    """Create two orgs, two users (one per org), and one student per org."""
    db = Session()

    org_a = Organisation(name="School A", slug="school-a")
    org_b = Organisation(name="School B", slug="school-b")
    db.add_all([org_a, org_b])
    db.commit()
    db.refresh(org_a)
    db.refresh(org_b)

    user_a = User(
        id=uuid.uuid4(), email="counselor_a@test.com",
        hashed_password=get_password_hash("password123"),
    )
    user_b = User(
        id=uuid.uuid4(), email="counselor_b@test.com",
        hashed_password=get_password_hash("password123"),
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    db.add(OrganisationMembership(organisation_id=org_a.id, user_id=user_a.id, role="member"))
    db.add(OrganisationMembership(organisation_id=org_b.id, user_id=user_b.id, role="member"))
    db.commit()

    student_a = Student(
        user_id=user_a.id, organisation_id=org_a.id,
        name="Alice (Org A)", grades={}, interests=[],
        strengths_weaknesses="", target_region="local",
    )
    student_b = Student(
        user_id=user_b.id, organisation_id=org_b.id,
        name="Bob (Org B)", grades={}, interests=[],
        strengths_weaknesses="", target_region="local",
    )
    db.add_all([student_a, student_b])
    db.commit()
    db.refresh(student_a)
    db.refresh(student_b)

    db.close()
    return {
        "org_a": org_a, "org_b": org_b,
        "user_a": user_a, "user_b": user_b,
        "student_a": student_a, "student_b": student_b,
    }


def _make_client(Session, user, org_id):
    """Create a TestClient authenticated as `user` in `org_id`."""
    def override_db():
        session = Session()
        try:
            yield session
        finally:
            session.close()

    def override_user():
        user.active_organisation_id = org_id
        return user

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    return TestClient(app)


# ---- ISOLATION TESTS ----


def test_user_a_sees_only_org_a_students(Session, seed_data):
    client = _make_client(Session, seed_data["user_a"], seed_data["org_a"].id)
    resp = client.get("/api/v1/students")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["items"]]
    assert "Alice (Org A)" in names
    assert "Bob (Org B)" not in names


def test_user_b_sees_only_org_b_students(Session, seed_data):
    client = _make_client(Session, seed_data["user_b"], seed_data["org_b"].id)
    resp = client.get("/api/v1/students")
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()["items"]]
    assert "Bob (Org B)" in names
    assert "Alice (Org A)" not in names


def test_user_a_cannot_read_org_b_student(Session, seed_data):
    client = _make_client(Session, seed_data["user_a"], seed_data["org_a"].id)
    resp = client.get(f"/api/v1/students/{seed_data['student_b'].id}")
    assert resp.status_code == 403


def test_user_a_cannot_update_org_b_student(Session, seed_data):
    client = _make_client(Session, seed_data["user_a"], seed_data["org_a"].id)
    resp = client.put(
        f"/api/v1/students/{seed_data['student_b'].id}",
        json={
            "name": "Hacked", "grades": {}, "interests": [],
            "strengths_weaknesses": "", "target_region": "local",
        },
    )
    assert resp.status_code == 403


def test_user_a_cannot_delete_org_b_student(Session, seed_data):
    client = _make_client(Session, seed_data["user_a"], seed_data["org_a"].id)
    resp = client.delete(f"/api/v1/students/{seed_data['student_b'].id}")
    assert resp.status_code == 403


def test_created_student_inherits_org(Session, seed_data):
    """When User A creates a student, it gets Org A's organisation_id."""
    client = _make_client(Session, seed_data["user_a"], seed_data["org_a"].id)
    resp = client.post("/api/v1/students", json={
        "name": "New Student A",
        "grades": {},
        "interests": [],
        "strengths_weaknesses": "",
        "target_region": "local",
    })
    assert resp.status_code == 201

    # Verify the student was created in Org A by listing
    list_resp = client.get("/api/v1/students")
    names = [s["name"] for s in list_resp.json()["items"]]
    assert "New Student A" in names

    # Verify User B can't see it
    client_b = _make_client(Session, seed_data["user_b"], seed_data["org_b"].id)
    list_resp_b = client_b.get("/api/v1/students")
    names_b = [s["name"] for s in list_resp_b.json()["items"]]
    assert "New Student A" not in names_b
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_tenant_isolation.py -v`
Expected: All 6 isolation tests PASS

- [ ] **Step 3: Run full suite**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/tests/test_tenant_isolation.py
git commit -m "test: add cross-tenant data isolation tests

Non-negotiable permission boundary tests verifying that users in
Org A cannot read/update/delete students in Org B, and that new
students inherit the creator's organisation_id."
```

---

### Task 8: Frontend organisation context

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `frontend/src/api/client.js` (or wherever API functions are defined)

- [ ] **Step 1: Update AuthContext to store org info**

After login, the JWT now contains `org_id`. The frontend should fetch org details and store them in context. The backend `/api/v1/account` endpoint should return org info (this requires a small backend change too).

Add to the account endpoint response: `organisation_id`, `organisation_name`, `org_role`.

Backend change — in `backend/app/api/v1/routes/account.py`, update the account response to include org data:

```python
# In the get_account endpoint, after fetching the user, also fetch their org membership:
from app.db.models import OrganisationMembership, Organisation

membership = (
    db.query(OrganisationMembership)
    .filter(OrganisationMembership.user_id == current_user.id)
    .first()
)
org_data = {}
if membership:
    org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
    if org:
        org_data = {
            "organisation_id": str(org.id),
            "organisation_name": org.name,
            "organisation_slug": org.slug,
            "org_role": membership.role,
        }

# Include org_data in the response dict
```

Frontend change — in `AuthContext.jsx`, the `user` object from the account endpoint will now include `organisation_id`, `organisation_name`, `org_role`. No special handling needed — they'll be available via `useAuth().user.organisation_name` etc.

- [ ] **Step 2: Update NavBar to show organisation name**

In the NavBar component, display `account.organisation_name` if available, next to or below the user's display name.

- [ ] **Step 3: Verify frontend still works**

Run: `cd /Users/bsg/Downloads/schoolchoice/frontend && npm run dev`
Check: Login page loads, dashboard loads, NavBar shows org name if user is in an org.

- [ ] **Step 4: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/api/v1/routes/account.py frontend/src/context/AuthContext.jsx frontend/src/components/NavBarV2/
git commit -m "feat: frontend org context — display organisation name in nav

Account endpoint now returns org membership data. NavBar shows
organisation name when user belongs to one."
```

---

### Task 9: Migration script for existing data

**Files:**
- Create: `backend/scripts/migrate_to_orgs.py`

- [ ] **Step 1: Write the migration script**

This script:
1. Creates a default organisation for each existing user (or groups users who should share an org)
2. Backfills `organisation_id` on all students and cohorts
3. Creates membership records

```python
# backend/scripts/migrate_to_orgs.py

"""
One-time migration: create default organisations and backfill organisation_id.

Usage:
    cd backend && python -m scripts.migrate_to_orgs

What it does:
1. For each user, creates an organisation named after their email domain
   (or a personal org if domain grouping isn't appropriate)
2. Sets organisation_id on all students and cohorts
3. Creates OrganisationMembership records

Safe to run multiple times — skips already-migrated records.
"""

import os
import sys

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import engine, SessionLocal
from app.db.models import Base, User, Organisation, OrganisationMembership
from app.modules.school_choice.models.models import Student, StudentCohort
import app.db.models_v2  # noqa: F401
import uuid
import re


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "org"


def migrate():
    db = SessionLocal()
    try:
        # Find all users without an org membership
        users_without_org = (
            db.query(User)
            .outerjoin(OrganisationMembership)
            .filter(OrganisationMembership.id.is_(None))
            .all()
        )

        if not users_without_org:
            print("All users already have organisations. Nothing to migrate.")
            return

        for user in users_without_org:
            # Create a personal org for each user
            org_name = f"{user.display_name or user.email}'s School"
            org_slug = slugify(org_name)

            # Ensure slug uniqueness
            existing = db.query(Organisation).filter(Organisation.slug == org_slug).first()
            if existing:
                org = existing
            else:
                org = Organisation(name=org_name, slug=org_slug)
                db.add(org)
                db.flush()

            # Create membership
            membership = OrganisationMembership(
                organisation_id=org.id,
                user_id=user.id,
                role="owner",
            )
            db.add(membership)

            # Backfill students
            students = db.query(Student).filter(
                Student.user_id == user.id,
                Student.organisation_id.is_(None),
            ).all()
            for s in students:
                s.organisation_id = org.id

            # Backfill cohorts
            cohorts = db.query(StudentCohort).filter(
                StudentCohort.user_id == user.id,
                StudentCohort.organisation_id.is_(None),
            ).all()
            for c in cohorts:
                c.organisation_id = org.id

            print(f"Migrated user {user.email}: {len(students)} students, {len(cohorts)} cohorts -> org '{org.name}'")

        db.commit()
        print("Migration complete.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
```

- [ ] **Step 2: Test the script locally**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m scripts.migrate_to_orgs`
Expected: Prints migration summary or "Nothing to migrate" if no data exists.

- [ ] **Step 3: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/scripts/migrate_to_orgs.py
git commit -m "feat: add data migration script for organisation backfill

Creates default orgs for existing users and backfills organisation_id
on students and cohorts. Idempotent — safe to run multiple times."
```

---

### Task 10: Update admin user management to be org-aware

**Files:**
- Modify: `backend/app/api/v1/routes/admin.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_organisation_routes.py`:

```python
def test_admin_create_user_with_org(client, db):
    """Admin creating a user should optionally assign them to an org."""
    orgs = client.get("/api/v1/organisations").json()["items"]
    org_id = orgs[0]["id"]

    resp = client.post("/api/v1/admin/users", json={
        "email": "newcounselor@test.com",
        "password": "password123",
        "role": "counsellor",
        "organisation_id": org_id,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newcounselor@test.com"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation_routes.py::test_admin_create_user_with_org -v`
Expected: FAIL or PASS depending on whether the field is ignored. The key is that the membership isn't created.

- [ ] **Step 3: Update admin create_user to accept organisation_id**

In `backend/app/api/v1/routes/admin.py`, update `create_user`:

```python
@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    response_model=UserAdminResponse,
)
def create_user(
    payload: UserCreateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Create a new user account, optionally assigning to an organisation. Admin only."""
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        display_name=payload.display_name,
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    # If organisation_id provided, create membership
    org_id = getattr(payload, "organisation_id", None)
    if org_id:
        from app.db.models import OrganisationMembership, Organisation
        org = db.query(Organisation).filter(Organisation.id == org_id).first()
        if org:
            membership = OrganisationMembership(
                organisation_id=org_id,
                user_id=user.id,
                role="member",
            )
            db.add(membership)
            db.commit()

    return user
```

Update the `UserCreateAdmin` schema to include optional `organisation_id`:

In `backend/app/schemas/v2/admin_users.py`, add:

```python
    organisation_id: Optional[UUID] = None
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_organisation_routes.py -v`
Expected: All tests PASS

- [ ] **Step 5: Run full suite**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest --tb=short -q`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
cd /Users/bsg/Downloads/schoolchoice
git add backend/app/api/v1/routes/admin.py backend/app/schemas/v2/admin_users.py backend/tests/test_organisation_routes.py
git commit -m "feat: admin user creation supports organisation assignment

Admin can now assign a user to an organisation at creation time.
Creates OrganisationMembership automatically."
```

---

## Summary

| Task | What it does | Dependencies |
|------|-------------|--------------|
| 1 | Organisation + Membership ORM models | None |
| 2 | Add organisation_id FK to Student + Cohort | Task 1 |
| 3 | Org-aware JWT + auth dependency | Task 1 |
| 4 | Organisation CRUD admin endpoints | Tasks 1, 3 |
| 5 | Migrate student/cohort query scoping | Tasks 2, 3 |
| 6 | Thread org context through all remaining routes | Task 5 |
| 7 | Cross-tenant isolation integration tests | Tasks 5, 6 |
| 8 | Frontend organisation context | Tasks 3, 4 |
| 9 | Migration script for existing data | Tasks 1, 2 |
| 10 | Admin user management org-aware | Tasks 1, 4 |

Tasks 1-3 are sequential. Tasks 4, 8, 9 can be parallelised after Task 3. Tasks 5-7 are sequential. Task 10 can be done after Task 4.
