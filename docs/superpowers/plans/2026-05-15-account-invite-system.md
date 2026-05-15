# Account & Invite System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake @student.local accounts with email-based invite system. Import creates data only. Admin invites students. Students set passwords via invite link. Unaccounted records can be merged into existing accounts.

**Architecture:** Invite tokens are signed JWTs (same `python-jose` already used for auth). One-time use enforced via `invite_token_jti` on the Student model. New `invite_service.py` handles token creation/validation/acceptance. New routes for invite management and password reset. Frontend gets invite acceptance page, unaccounted filter on student list, and merge modal.

**Tech Stack:** Python/FastAPI, python-jose (existing), SQLAlchemy, React, TanStack Query

**Spec:** `docs/superpowers/specs/2026-05-15-account-invite-system-design.md`

---

## File Structure

| File | Role |
|------|------|
| `backend/app/modules/school_choice/models/models.py` | Modify: add invite columns to Student |
| `backend/app/db/models.py` | Modify: add `reset_token_jti` to User |
| `backend/app/services/invite_service.py` | Create: token generation, validation, account creation |
| `backend/app/services/merge_service.py` | Create: merge unaccounted student into target |
| `backend/app/api/v1/routes/invite.py` | Create: invite + password reset endpoints |
| `backend/app/api/v1/routes/students.py` | Modify: add `unaccounted` filter |
| `backend/app/api/v1/routes/admin.py` | Modify: add merge + cleanup endpoints |
| `backend/app/main.py` | Modify: register invite router |
| `backend/tests/test_invite_service.py` | Create: invite service tests |
| `backend/tests/test_invite_routes.py` | Create: invite route tests |
| `apps/web/src/api/invite.js` | Create: invite API client |
| `apps/web/src/pages/InviteAccept/InviteAccept.jsx` | Create: invite acceptance page |
| `apps/web/src/pages/StudentListPage/StudentListPage.jsx` | Modify: unaccounted filter + invite buttons |
| `apps/web/src/App.jsx` | Modify: add invite route |

---

### Task 1: Add invite columns to Student and User models

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py`
- Modify: `backend/app/db/models.py`

- [ ] **Step 1: Add invite columns to Student model**

In `backend/app/modules/school_choice/models/models.py`, after the `preferred_language` column (around line 163), add:

```python
    invite_token_jti = Column(
        String(36), nullable=True,
        comment="Current invite token JTI — cleared on accept, set on invite/reinvite",
    )
    invite_sent_at = Column(
        TIMESTAMP(timezone=True), nullable=True,
        comment="When the last invite was generated",
    )
    invite_accepted_at = Column(
        TIMESTAMP(timezone=True), nullable=True,
        comment="When the student accepted invite and created account",
    )
```

- [ ] **Step 2: Add reset_token_jti to User model**

In `backend/app/db/models.py`, after the `can_manage_cohorts` column (around line 175), add:

```python
    reset_token_jti = Column(
        String(36), nullable=True,
        comment="Current password reset token JTI — cleared after use",
    )
```

- [ ] **Step 3: Run backend to create columns**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "
from app.db.session import engine
from sqlalchemy import text, inspect
# Check if columns exist, add if not
insp = inspect(engine)
student_cols = [c['name'] for c in insp.get_columns('students')]
user_cols = [c['name'] for c in insp.get_columns('users')]
with engine.connect() as conn:
    if 'invite_token_jti' not in student_cols:
        conn.execute(text('ALTER TABLE students ADD COLUMN invite_token_jti VARCHAR(36)'))
        conn.execute(text('ALTER TABLE students ADD COLUMN invite_sent_at TIMESTAMP'))
        conn.execute(text('ALTER TABLE students ADD COLUMN invite_accepted_at TIMESTAMP'))
        print('Added invite columns to students')
    if 'reset_token_jti' not in user_cols:
        conn.execute(text('ALTER TABLE users ADD COLUMN reset_token_jti VARCHAR(36)'))
        print('Added reset_token_jti to users')
    conn.commit()
print('Schema updated')
"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py backend/app/db/models.py
git commit -m "feat: add invite and reset token columns to Student and User models"
```

---

### Task 2: Create invite service — token generation and validation

**Files:**
- Create: `backend/app/services/invite_service.py`
- Create: `backend/tests/test_invite_service.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_invite_service.py`:

```python
"""Tests for the invite service: token generation, validation, account creation."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-invite-testing")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import uuid
import pytest
from datetime import datetime, timezone, timedelta

from app.services.invite_service import (
    generate_invite_token,
    validate_invite_token,
    accept_invite,
    generate_reset_token,
    validate_reset_token,
    InviteError,
)


class TestGenerateInviteToken:
    def test_generates_token_string(self):
        token = generate_invite_token(
            student_id=str(uuid.uuid4()),
            email="student@school.hk",
            org_id=str(uuid.uuid4()),
        )
        assert isinstance(token, str)
        assert len(token) > 20  # JWT is long

    def test_token_contains_expected_claims(self):
        sid = str(uuid.uuid4())
        email = "test@school.hk"
        oid = str(uuid.uuid4())
        token = generate_invite_token(student_id=sid, email=email, org_id=oid)
        payload = validate_invite_token(token)
        assert payload["student_id"] == sid
        assert payload["email"] == email
        assert payload["org_id"] == oid
        assert payload["type"] == "invite"
        assert "jti" in payload
        assert "exp" in payload


class TestValidateInviteToken:
    def test_valid_token_returns_payload(self):
        sid = str(uuid.uuid4())
        token = generate_invite_token(student_id=sid, email="a@b.com", org_id=str(uuid.uuid4()))
        payload = validate_invite_token(token)
        assert payload["student_id"] == sid

    def test_expired_token_raises(self):
        token = generate_invite_token(
            student_id=str(uuid.uuid4()),
            email="a@b.com",
            org_id=str(uuid.uuid4()),
            expires_hours=0,  # immediate expiry
        )
        with pytest.raises(InviteError, match="expired"):
            validate_invite_token(token)

    def test_tampered_token_raises(self):
        token = generate_invite_token(
            student_id=str(uuid.uuid4()),
            email="a@b.com",
            org_id=str(uuid.uuid4()),
        )
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(InviteError):
            validate_invite_token(tampered)

    def test_wrong_type_raises(self):
        token = generate_reset_token(user_id=str(uuid.uuid4()), email="a@b.com")
        with pytest.raises(InviteError, match="type"):
            validate_invite_token(token)


class TestGenerateResetToken:
    def test_generates_token(self):
        token = generate_reset_token(user_id=str(uuid.uuid4()), email="a@b.com")
        assert isinstance(token, str)

    def test_reset_token_has_correct_type(self):
        uid = str(uuid.uuid4())
        token = generate_reset_token(user_id=uid, email="a@b.com")
        payload = validate_reset_token(token)
        assert payload["type"] == "reset"
        assert payload["user_id"] == uid


class TestValidateResetToken:
    def test_valid_token(self):
        uid = str(uuid.uuid4())
        token = generate_reset_token(user_id=uid, email="a@b.com")
        payload = validate_reset_token(token)
        assert payload["user_id"] == uid

    def test_invite_token_rejected_as_reset(self):
        token = generate_invite_token(
            student_id=str(uuid.uuid4()), email="a@b.com", org_id=str(uuid.uuid4()),
        )
        with pytest.raises(InviteError, match="type"):
            validate_reset_token(token)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_invite_service.py -v`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement invite service**

Create `backend/app/services/invite_service.py`:

```python
"""
app/services/invite_service.py

Invite token generation, validation, and account creation for student onboarding.
Uses the same JWT infrastructure as auth (python-jose + app SECRET_KEY).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash, create_access_token
from app.db.models import User, OrganisationMembership


class InviteError(Exception):
    """Raised when invite/reset token operations fail."""
    pass


# ---------------------------------------------------------------------------
# Invite tokens (student onboarding)
# ---------------------------------------------------------------------------

def generate_invite_token(
    student_id: str,
    email: str,
    org_id: str,
    expires_hours: int = 48,
) -> str:
    """Generate a signed JWT invite token for a student."""
    jti = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = {
        "type": "invite",
        "student_id": student_id,
        "email": email,
        "org_id": org_id,
        "jti": jti,
        "exp": now + timedelta(hours=expires_hours),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def validate_invite_token(token: str) -> dict:
    """Validate and decode an invite token. Returns payload dict.
    Raises InviteError on invalid/expired/wrong-type tokens.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        if "expired" in str(e).lower():
            raise InviteError("This invite link has expired. Ask your counsellor for a new one.")
        raise InviteError(f"Invalid invite link: {e}")

    if payload.get("type") != "invite":
        raise InviteError("Invalid token type — expected invite token.")
    return payload


def accept_invite(
    token: str,
    password: str,
    db: Session,
) -> dict:
    """Accept an invite: validate token, create user account, link to student.

    Returns dict with access_token for auto-login.
    Raises InviteError on any failure.
    """
    payload = validate_invite_token(token)
    student_id = payload["student_id"]
    email = payload["email"]
    org_id = payload["org_id"]
    jti = payload["jti"]

    # Import Student model
    from app.modules.school_choice.models.models import Student

    # Verify student exists and token JTI matches
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise InviteError("Student record not found.")
    if student.invite_token_jti != jti:
        raise InviteError("This invite link has already been used or replaced.")
    if student.invite_accepted_at is not None:
        raise InviteError("This invite has already been accepted.")

    # Check email not already taken
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise InviteError(f"An account with email {email} already exists.")

    # Create user account
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role="student",
        student_id=student.id,
        display_name=student.name,
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.flush()

    # Add org membership
    if org_id:
        mem = OrganisationMembership(
            user_id=user.id,
            organisation_id=org_id,
            role="member",
        )
        db.add(mem)

    # Mark invite as accepted
    student.invite_token_jti = None
    student.invite_accepted_at = datetime.now(timezone.utc)
    db.commit()

    # Generate access token for auto-login
    token_data = {"sub": str(user.id)}
    if org_id:
        token_data["org_id"] = org_id
    token_data["student_id"] = student_id
    access_token = create_access_token(data=token_data)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "must_change_password": False,
    }


# ---------------------------------------------------------------------------
# Password reset tokens
# ---------------------------------------------------------------------------

def generate_reset_token(user_id: str, email: str, expires_hours: int = 24) -> str:
    """Generate a signed JWT reset token for a user."""
    jti = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload = {
        "type": "reset",
        "user_id": user_id,
        "email": email,
        "jti": jti,
        "exp": now + timedelta(hours=expires_hours),
        "iat": now,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def validate_reset_token(token: str) -> dict:
    """Validate and decode a reset token. Returns payload dict."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as e:
        if "expired" in str(e).lower():
            raise InviteError("This reset link has expired.")
        raise InviteError(f"Invalid reset link: {e}")

    if payload.get("type") != "reset":
        raise InviteError("Invalid token type — expected reset token.")
    return payload


def reset_password(token: str, new_password: str, db: Session) -> dict:
    """Reset a user's password using a valid reset token."""
    payload = validate_reset_token(token)
    user_id = payload["user_id"]
    jti = payload["jti"]

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise InviteError("User not found.")
    if user.reset_token_jti != jti:
        raise InviteError("This reset link has already been used or replaced.")

    user.hashed_password = get_password_hash(new_password)
    user.reset_token_jti = None
    user.must_change_password = False
    db.commit()

    return {"message": "Password updated successfully."}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python -m pytest tests/test_invite_service.py -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/invite_service.py backend/tests/test_invite_service.py
git commit -m "feat: add invite service — token generation, validation, account creation"
```

---

### Task 3: Create invite and password reset API routes

**Files:**
- Create: `backend/app/api/v1/routes/invite.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create invite routes**

Create `backend/app/api/v1/routes/invite.py`:

```python
"""
app/api/v1/routes/invite.py

Public invite acceptance + admin invite management + password reset endpoints.
"""
from __future__ import annotations

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.invite_service import (
    generate_invite_token,
    validate_invite_token,
    accept_invite,
    generate_reset_token,
    validate_reset_token,
    reset_password,
    InviteError,
)

router = APIRouter(tags=["invite"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    student_ids: list[str]

class SingleInviteRequest(BaseModel):
    email: str | None = None

class AcceptInviteRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


# ---------------------------------------------------------------------------
# Admin: bulk invite
# ---------------------------------------------------------------------------

@router.post("/admin/students/invite")
def bulk_invite_students(
    body: InviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate invite tokens for multiple students. Admin/counsellor only."""
    from app.modules.school_choice.models.models import Student

    org_id = str(getattr(current_user, "active_organisation_id", "") or "")
    invites = []
    errors = []

    for sid in body.student_ids:
        student = db.query(Student).filter(Student.id == sid).first()
        if not student:
            errors.append({"student_id": sid, "error": "Student not found"})
            continue
        if not student.email:
            errors.append({"student_id": sid, "error": f"No email set for {student.name}"})
            continue
        if student.invite_accepted_at:
            errors.append({"student_id": sid, "error": f"{student.name} already has an account"})
            continue

        token = generate_invite_token(
            student_id=str(student.id),
            email=student.email,
            org_id=org_id,
        )
        # Extract JTI from token for storage
        payload = validate_invite_token(token)
        student.invite_token_jti = payload["jti"]
        student.invite_sent_at = datetime.now(timezone.utc)

        invites.append({
            "student_id": str(student.id),
            "name": student.name,
            "email": student.email,
            "invite_url": f"/invite/{token}",
            "expires_at": payload["exp"],
        })

    db.commit()
    return {"invites": invites, "errors": errors}


# ---------------------------------------------------------------------------
# Admin: single invite
# ---------------------------------------------------------------------------

@router.post("/admin/students/{student_id}/invite")
def invite_single_student(
    student_id: UUID,
    body: SingleInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate invite for one student. Optionally set email."""
    from app.modules.school_choice.models.models import Student

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if body.email:
        student.email = body.email

    if not student.email:
        raise HTTPException(status_code=400, detail="Student has no email. Provide one in the request.")

    if student.invite_accepted_at:
        raise HTTPException(status_code=409, detail="Student already has an account.")

    org_id = str(getattr(current_user, "active_organisation_id", "") or "")
    token = generate_invite_token(
        student_id=str(student.id),
        email=student.email,
        org_id=org_id,
    )
    payload = validate_invite_token(token)
    student.invite_token_jti = payload["jti"]
    student.invite_sent_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "invite_url": f"/invite/{token}",
        "expires_at": payload["exp"],
        "email": student.email,
    }


# ---------------------------------------------------------------------------
# Admin: reinvite (regenerate token)
# ---------------------------------------------------------------------------

@router.post("/admin/students/{student_id}/reinvite")
def reinvite_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Regenerate invite for a student (invalidates previous token)."""
    from app.modules.school_choice.models.models import Student

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if not student.email:
        raise HTTPException(status_code=400, detail="Student has no email.")
    if student.invite_accepted_at:
        raise HTTPException(status_code=409, detail="Student already has an account.")

    org_id = str(getattr(current_user, "active_organisation_id", "") or "")
    token = generate_invite_token(
        student_id=str(student.id),
        email=student.email,
        org_id=org_id,
    )
    payload = validate_invite_token(token)
    student.invite_token_jti = payload["jti"]
    student.invite_sent_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "invite_url": f"/invite/{token}",
        "expires_at": payload["exp"],
    }


# ---------------------------------------------------------------------------
# Public: validate invite token
# ---------------------------------------------------------------------------

@router.get("/auth/invite/{token}")
def validate_invite(token: str, db: Session = Depends(get_db)):
    """Validate an invite token. Returns student info for the UI."""
    try:
        payload = validate_invite_token(token)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from app.modules.school_choice.models.models import Student
    student = db.query(Student).filter(Student.id == payload["student_id"]).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.invite_token_jti != payload["jti"]:
        raise HTTPException(status_code=400, detail="This invite link has been replaced.")
    if student.invite_accepted_at:
        raise HTTPException(status_code=400, detail="This invite has already been accepted.")

    from app.db.models import Organisation
    org = db.query(Organisation).filter(Organisation.id == payload.get("org_id")).first()

    return {
        "valid": True,
        "student_name": student.name,
        "email": payload["email"],
        "school_name": org.name if org else None,
    }


# ---------------------------------------------------------------------------
# Public: accept invite (create account)
# ---------------------------------------------------------------------------

@router.post("/auth/invite/{token}/accept")
def accept_invite_route(
    token: str,
    body: AcceptInviteRequest,
    db: Session = Depends(get_db),
):
    """Accept invite: set password, create account, auto-login."""
    try:
        result = accept_invite(token=token, password=body.password, db=db)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# ---------------------------------------------------------------------------
# Public: forgot password
# ---------------------------------------------------------------------------

@router.post("/auth/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Generate password reset token. Returns reset URL (email delivery later)."""
    user = db.query(User).filter(User.email == body.email, User.is_active.is_(True)).first()
    if not user:
        # Don't reveal whether email exists
        return {"message": "If an account exists with that email, a reset link has been generated."}

    token = generate_reset_token(user_id=str(user.id), email=user.email)
    payload = validate_reset_token(token)
    user.reset_token_jti = payload["jti"]
    db.commit()

    # For now: return the URL directly (admin distributes). Email delivery is future.
    return {
        "message": "If an account exists with that email, a reset link has been generated.",
        "reset_url": f"/reset-password/{token}",
    }


# ---------------------------------------------------------------------------
# Public: reset password
# ---------------------------------------------------------------------------

@router.post("/auth/reset-password/{token}")
def reset_password_route(
    token: str,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Reset password using a valid reset token."""
    try:
        result = reset_password(token=token, new_password=body.password, db=db)
    except InviteError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add import and include after the existing router registrations:

After the line `from app.api.v1.routes.self_financing import router as sf_router` add:
```python
from app.api.v1.routes.invite import router as invite_router
```

After the line `app.include_router(plan_release_router, prefix="/api/v1")` add:
```python
app.include_router(invite_router, prefix="/api/v1")
```

- [ ] **Step 3: Verify backend starts**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -c "from app.main import app; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/invite.py backend/app/main.py
git commit -m "feat: add invite and password reset API routes"
```

---

### Task 4: Add unaccounted filter to student list endpoint

**Files:**
- Modify: `backend/app/api/v1/routes/students.py`
- Modify: `backend/app/services/student_service.py`

- [ ] **Step 1: Add `unaccounted` query parameter to list_students**

In `backend/app/api/v1/routes/students.py`, update the `list_students` function signature to add the `unaccounted` param:

```python
@router.get("", status_code=status.HTTP_200_OK)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    q: str | None = Query(None, description="Text search across student name"),
    unaccounted: bool = Query(False, description="Filter to students without linked user accounts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Then pass it to the service:

```python
    all_students = student_service.get_students(
        db, user_id=current_user.id, organisation_id=_org_id(current_user),
        q=q, unaccounted=unaccounted,
    )
```

- [ ] **Step 2: Update get_students in student_service.py**

Read the current `get_students` function and add the `unaccounted` filter. The filter logic:

```python
def get_students(db, user_id, organisation_id=None, q=None, unaccounted=False):
    # ... existing query building ...

    if unaccounted:
        # Students with no User account pointing to them
        from app.db.models import User as UserModel
        linked_ids = db.query(UserModel.student_id).filter(
            UserModel.student_id.isnot(None),
            UserModel.is_active.is_(True),
        ).subquery()
        query = query.filter(~Student.id.in_(linked_ids))

    # ... rest of function ...
```

- [ ] **Step 3: Add `has_account` field to student list response**

In the `list_students` function, after building the student list items, add account status:

```python
    # Check which students have linked accounts
    from app.db.models import User as UserModel
    account_sids = set()
    if student_ids:
        acct_rows = db.execute(
            select(UserModel.student_id).where(
                UserModel.student_id.in_(student_ids),
                UserModel.is_active.is_(True),
            )
        ).fetchall()
        account_sids = {row[0] for row in acct_rows}
```

Then in the loop where you build result items, add:
```python
        item_dict = item.model_dump()
        item_dict["has_account"] = s.id in account_sids
        item_dict["invite_status"] = (
            "accepted" if s.invite_accepted_at
            else "invited" if s.invite_sent_at
            else "none"
        )
        result.append(item_dict)
```

- [ ] **Step 4: Test via API**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# All students
curl -s "http://localhost:8000/api/v1/students?limit=3" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json; d = json.load(sys.stdin)
for s in d['items'][:3]:
    print(f'{s[\"name\"]:20} has_account={s.get(\"has_account\")} invite={s.get(\"invite_status\")}')
"

# Unaccounted only
curl -s "http://localhost:8000/api/v1/students?unaccounted=true&limit=3" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json; d = json.load(sys.stdin)
print(f'Unaccounted: {d[\"total\"]}')
"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/students.py backend/app/services/student_service.py
git commit -m "feat: add unaccounted filter and account status to student list"
```

---

### Task 5: Add merge endpoint and cleanup endpoint

**Files:**
- Create: `backend/app/services/merge_service.py`
- Modify: `backend/app/api/v1/routes/admin.py`

- [ ] **Step 1: Create merge service**

Create `backend/app/services/merge_service.py`:

```python
"""
app/services/merge_service.py

Merge an unaccounted student record into an existing accounted student.
Transfers grades, targets, cohort memberships. Deletes the source record.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Student, User
from app.db.models_v2 import StudentSubjectGrade, StudentSchoolTarget, CohortMembership


class MergeError(Exception):
    pass


def merge_student(
    source_id: str,
    target_id: str,
    db: Session,
) -> dict:
    """Merge source (unaccounted) student into target (accounted) student.

    Transfers: grades, targets, cohort memberships.
    Profile fields: fills blanks on target only.
    Deletes source record after merge.
    """
    source = db.query(Student).filter(Student.id == source_id).first()
    if not source:
        raise MergeError("Source student not found.")

    target = db.query(Student).filter(Student.id == target_id).first()
    if not target:
        raise MergeError("Target student not found.")

    # Verify source is unaccounted
    source_user = db.query(User).filter(User.student_id == source.id, User.is_active.is_(True)).first()
    if source_user:
        raise MergeError("Source student already has an account. Only unaccounted students can be merged.")

    # Verify target has an account
    target_user = db.query(User).filter(User.student_id == target.id, User.is_active.is_(True)).first()
    if not target_user:
        raise MergeError("Target student has no account. Merge into an accounted student.")

    # Transfer grades
    grades = db.query(StudentSubjectGrade).filter(StudentSubjectGrade.student_id == source.id).all()
    for g in grades:
        g.student_id = target.id
    merged_grades = len(grades)

    # Transfer targets
    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == source.id).all()
    for t in targets:
        t.student_id = target.id
    merged_targets = len(targets)

    # Transfer cohort memberships (skip duplicates)
    memberships = db.query(CohortMembership).filter(CohortMembership.student_id == source.id).all()
    merged_cohorts = 0
    for m in memberships:
        existing = db.query(CohortMembership).filter(
            CohortMembership.student_id == target.id,
            CohortMembership.cohort_id == m.cohort_id,
        ).first()
        if existing:
            db.delete(m)
        else:
            m.student_id = target.id
            merged_cohorts += 1

    # Fill blank profile fields on target
    profile_fields = [
        "preferred_name", "date_of_birth", "gender", "address", "phone",
        "email", "class_name", "year_of_study", "candidate_number",
    ]
    for field in profile_fields:
        source_val = getattr(source, field, None)
        target_val = getattr(target, field, None)
        if source_val and not target_val:
            setattr(target, field, source_val)

    # Delete source
    db.delete(source)
    db.commit()

    return {
        "merged_grades": merged_grades,
        "merged_targets": merged_targets,
        "merged_cohorts": merged_cohorts,
        "message": f"Merged {source.name} into {target.name}. Source record deleted.",
    }
```

- [ ] **Step 2: Add merge and cleanup endpoints to admin.py**

In `backend/app/api/v1/routes/admin.py`, add after the `reset_user_password` endpoint:

```python
# ---------------------------------------------------------------------------
# POST /admin/students/{source_id}/merge/{target_id}
# ---------------------------------------------------------------------------

@router.post("/students/{source_id}/merge/{target_id}")
def merge_students(
    source_id: UUID,
    target_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Merge unaccounted student data into existing accounted student. Admin only."""
    from app.services.merge_service import merge_student, MergeError
    try:
        result = merge_student(str(source_id), str(target_id), db)
    except MergeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


# ---------------------------------------------------------------------------
# DELETE /admin/cleanup/fake-accounts — remove @student.local accounts
# ---------------------------------------------------------------------------

@router.delete("/cleanup/fake-accounts")
def cleanup_fake_accounts(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Remove legacy @student.local fake accounts. One-time cleanup. Admin only."""
    fake_users = db.query(User).filter(User.email.like("%@student.local")).all()
    count = len(fake_users)
    for u in fake_users:
        u.student_id = None  # unlink first so student data is preserved
    db.flush()
    for u in fake_users:
        db.delete(u)
    db.commit()
    return {"deleted": count, "message": f"Removed {count} @student.local accounts."}
```

- [ ] **Step 3: Test via API**

```bash
# Test cleanup
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X DELETE "http://localhost:8000/api/v1/admin/cleanup/fake-accounts" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: `{"deleted": 17, "message": "Removed 17 @student.local accounts."}`

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/merge_service.py backend/app/api/v1/routes/admin.py
git commit -m "feat: add student merge and fake account cleanup endpoints"
```

---

### Task 6: Frontend — invite API client and invite acceptance page

**Files:**
- Create: `apps/web/src/api/invite.js`
- Create: `apps/web/src/pages/InviteAccept/InviteAccept.jsx`
- Modify: `apps/web/src/App.jsx`

- [ ] **Step 1: Create invite API client**

Create `apps/web/src/api/invite.js`:

```javascript
import { get, post } from './helpers';

export const validateInvite = (token) =>
  get(`/api/v1/auth/invite/${token}`);

export const acceptInvite = (token, password) =>
  post(`/api/v1/auth/invite/${token}/accept`, { password });

export const bulkInviteStudents = (studentIds) =>
  post('/api/v1/admin/students/invite', { student_ids: studentIds });

export const inviteStudent = (studentId, email) =>
  post(`/api/v1/admin/students/${studentId}/invite`, { email });

export const reinviteStudent = (studentId) =>
  post(`/api/v1/admin/students/${studentId}/reinvite`);

export const forgotPassword = (email) =>
  post('/api/v1/auth/forgot-password', { email });

export const resetPassword = (token, password) =>
  post(`/api/v1/auth/reset-password/${token}`, { password });

export const mergeStudent = (sourceId, targetId) =>
  post(`/api/v1/admin/students/${sourceId}/merge/${targetId}`);

export const cleanupFakeAccounts = () =>
  fetch('/api/v1/admin/cleanup/fake-accounts', { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json());
```

- [ ] **Step 2: Create InviteAccept page**

Create `apps/web/src/pages/InviteAccept/InviteAccept.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { validateInvite, acceptInvite } from '../../api/invite';

const containerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-background)',
  fontFamily: 'var(--font-family-base)',
  padding: 'var(--space-4)',
};

const cardStyle = {
  background: 'var(--color-surface)',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--border-radius-lg)',
  padding: 'var(--space-8)',
  maxWidth: '420px',
  width: '100%',
};

const headingStyle = {
  fontSize: 'var(--font-size-xl)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-2)',
};

const subStyle = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
  marginBottom: 'var(--space-6)',
};

const labelStyle = {
  display: 'block',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-1)',
};

const errorStyle = {
  color: 'var(--color-error)',
  fontSize: 'var(--font-size-sm)',
  marginTop: 'var(--space-2)',
};

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    validateInvite(token)
      .then(data => { setInfo(data); setLoading(false); })
      .catch(err => {
        setError(err?.response?.data?.detail || 'Invalid or expired invite link.');
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await acceptInvite(token, password);
      localStorage.setItem('token', result.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Validating invite...</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={headingStyle}>Invite Link Invalid</h1>
          <p style={subStyle}>{error || 'This invite link is invalid or has expired.'}</p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            Contact your school counsellor to request a new invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Welcome, {info.student_name}</h1>
        <p style={subStyle}>
          {info.school_name ? `${info.school_name} — ` : ''}Set your password to access the school portal.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>Email</label>
            <Input value={info.email} disabled style={{ opacity: 0.7 }} />
          </div>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <label style={labelStyle}>Password</label>
            <Input
              type="password"
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={labelStyle}>Confirm Password</label>
            <Input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          {error && <p style={errorStyle}>{error}</p>}
          <Button
            type="submit"
            disabled={submitting || !password || !confirmPassword}
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.jsx**

In `apps/web/src/App.jsx`, add import:
```javascript
import InviteAccept from './pages/InviteAccept/InviteAccept';
```

Add route (public, no ProtectedRoute) alongside the login route:
```jsx
<Route path="/invite/:token" element={<InviteAccept />} />
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/invite.js apps/web/src/pages/InviteAccept/InviteAccept.jsx apps/web/src/App.jsx
git commit -m "feat: add invite acceptance page and invite API client"
```

---

### Task 7: Frontend — unaccounted filter and invite buttons on student list

**Files:**
- Modify: `apps/web/src/pages/StudentListPage/StudentListPage.jsx`

- [ ] **Step 1: Add unaccounted toggle and invite actions**

In `StudentListPage.jsx`:

Add state for the filter toggle:
```javascript
const [showUnaccounted, setShowUnaccounted] = useState(false);
```

Update the students query to pass the filter:
```javascript
const studentsQuery = useQuery({
    queryKey: ['students', debouncedSearch, showUnaccounted],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (showUnaccounted) params.unaccounted = true;
      return getStudents(params);
    },
  });
```

Add import for invite API:
```javascript
import { inviteStudent, bulkInviteStudents } from '../../api/invite';
```

Add the filter toggle in the search bar area (after the search input):
```jsx
<button
  onClick={() => setShowUnaccounted(!showUnaccounted)}
  style={{
    padding: '6px 12px',
    borderRadius: 'var(--border-radius-sm)',
    border: 'var(--border-width) solid var(--color-border)',
    background: showUnaccounted ? 'var(--color-primary)' : 'var(--color-surface)',
    color: showUnaccounted ? 'white' : 'var(--color-text-secondary)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
  }}
>
  {showUnaccounted ? 'Showing Unaccounted' : 'Unaccounted'}
</button>
```

In the student table, add an "Account" column header and cell showing status badges:
```jsx
// In header row:
<th style={thStyle}>Account</th>

// In student row:
<td style={tdStyle}>
  {s.has_account ? (
    <span style={{ ...badgeBase, background: '#dcfce7', color: '#166534' }}>Active</span>
  ) : s.invite_status === 'invited' ? (
    <span style={{ ...badgeBase, background: '#dbeafe', color: '#1e40af' }}>Invited</span>
  ) : (
    <span style={{ ...badgeBase, background: '#fef3c7', color: '#92400e' }}>No Account</span>
  )}
</td>
```

Add an invite button per row for unaccounted students:
```jsx
{!s.has_account && (
  <button
    onClick={async () => {
      const email = s.email || window.prompt('Enter student email:');
      if (!email) return;
      try {
        const result = await inviteStudent(s.id, email);
        toast.success(`Invite link generated for ${s.name}`);
        navigator.clipboard?.writeText(window.location.origin + result.invite_url);
        queryClient.invalidateQueries({ queryKey: ['students'] });
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Failed to invite');
      }
    }}
    style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)' }}
  >
    Invite
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/StudentListPage/StudentListPage.jsx
git commit -m "feat: add unaccounted filter and invite buttons to student list"
```

---

### Task 8: Run fake account cleanup and full verification

**Files:** None (verification only)

- [ ] **Step 1: Restart backend**

```bash
kill $(lsof -ti:8000) 2>/dev/null; sleep 1
cd /Users/bsg/Downloads/schoolchoice/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3
```

- [ ] **Step 2: Run cleanup**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -X DELETE "http://localhost:8000/api/v1/admin/cleanup/fake-accounts" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- [ ] **Step 3: Test unaccounted filter**

```bash
curl -s "http://localhost:8000/api/v1/students?unaccounted=true&limit=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json; d = json.load(sys.stdin)
print(f'Unaccounted students: {d[\"total\"]}')
for s in d['items'][:5]:
    print(f'  {s[\"name\"]:20} has_account={s.get(\"has_account\")} email={s.get(\"email\",\"\")}')
"
```

- [ ] **Step 4: Test invite flow end-to-end**

```bash
# Pick a student and set email
STUDENT_ID=$(curl -s "http://localhost:8000/api/v1/students?unaccounted=true&limit=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")

# Invite with email
INVITE=$(curl -s -X POST "http://localhost:8000/api/v1/admin/students/$STUDENT_ID/invite" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"email\": \"test-student@example.com\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['invite_url'])")

echo "Invite URL: $INVITE"

# Extract token from URL
INVITE_TOKEN=$(echo $INVITE | sed 's|/invite/||')

# Validate invite
curl -s "http://localhost:8000/api/v1/auth/invite/$INVITE_TOKEN" | python3 -m json.tool

# Accept invite
curl -s -X POST "http://localhost:8000/api/v1/auth/invite/$INVITE_TOKEN/accept" \
  -H "Content-Type: application/json" \
  -d '{"password":"TestPass123"}' | python3 -c "
import sys, json; d = json.load(sys.stdin)
print(f'Account created! Token: {d[\"access_token\"][:30]}...')
print(f'must_change_password: {d.get(\"must_change_password\")}')
"

# Verify student is no longer unaccounted
curl -s "http://localhost:8000/api/v1/students?unaccounted=true" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json; print(f'Unaccounted after invite: {json.load(sys.stdin)[\"total\"]}')
"
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/bsg/Downloads/schoolchoice/backend
python -m pytest tests/test_invite_service.py tests/test_student_import.py -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete account & invite system — cleanup, verification, end-to-end tested"
```
