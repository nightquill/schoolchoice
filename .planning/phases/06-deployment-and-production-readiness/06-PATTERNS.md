# Phase 6: Deployment and Production Readiness - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 13 new/modified files
**Analogs found:** 10 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/core/config.py` (modify) | config | request-response | `backend/app/core/config.py` | exact (self) |
| `backend/app/core/dependencies.py` (modify) | middleware/utility | request-response | `backend/app/api/v1/routes/admin.py` (`_require_admin`) | role-match |
| `backend/app/api/v1/routes/admin.py` (modify) | controller | CRUD | `backend/app/api/v1/routes/admin.py` | exact (self-extend) |
| `backend/app/schemas/v2/account.py` (analog for user schemas) | model | request-response | `backend/app/schemas/v2/account.py` | exact |
| `backend/tests/test_admin_users.py` (new) | test | request-response | `backend/tests/test_v2_routes.py` | role-match |
| `backend/tests/test_startup_validation.py` (new) | test | request-response | `backend/tests/test_v2_routes.py` | role-match |
| `frontend/src/context/AuthContext.jsx` (modify) | provider | request-response | `frontend/src/context/AuthContext.jsx` | exact (self) |
| `frontend/src/pages/Settings/Settings.jsx` (new) | component | CRUD | `frontend/src/pages/AccountSettings/AccountSettings.jsx` | exact |
| `frontend/src/App.jsx` (modify) | config | request-response | `frontend/src/App.jsx` | exact (self) |
| `frontend/src/api/admin.js` (new) | utility | request-response | `frontend/src/api/account.js` | role-match |
| `.github/workflows/ci.yml` (new) | config | batch | no analog | none |
| `scripts/generate_secrets.sh` (new) | utility | batch | no analog | none |
| `scripts/seed_demo.py` (new) | utility | CRUD | `backend/tests/conftest.py` (user creation pattern) | partial |
| `vercel.json` (new) | config | — | no analog | none |
| `railway.toml` (new) | config | — | no analog | none |
| `backend/.env.example` (modify) | config | — | `backend/.env.example` | exact (self) |

---

## Pattern Assignments

### `backend/app/core/config.py` (config — add startup validator)

**Analog:** `backend/app/core/config.py` (self — extend existing `Settings` class)

**Existing class structure** (lines 1-46 — full file):
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    AI_BASE_URL: str = ""
    AI_TIMEOUT: int = 30

settings = Settings()
```

**Add after existing fields — startup validator pattern** (from RESEARCH.md Pattern 2):
```python
from pydantic import model_validator

# Forbidden set: exactly the placeholder values in .env.example and generate_secrets.sh
# NOTE: "test-secret-key-for-pytest-only-not-for-production" is NOT in this set
_FORBIDDEN_SECRET_KEYS = {
    "dev-secret-key-do-not-use-in-production-abc123",
    "CHANGE_ME",
    "changeme",
}

# Add inside Settings class, after all field declarations:
@model_validator(mode="after")
def _validate_production_secrets(self) -> "Settings":
    errors = []
    if self.SECRET_KEY in _FORBIDDEN_SECRET_KEYS:
        errors.append(
            "SECRET_KEY must not be the default placeholder value. "
            "Run scripts/generate_secrets.sh."
        )
    if not self.DATABASE_URL or self.DATABASE_URL == "CHANGE_ME":
        errors.append("DATABASE_URL is required and must not be a placeholder.")
    if errors:
        raise ValueError(
            "Startup validation failed — insecure configuration detected:\n"
            + "\n".join(f"  - {e}" for e in errors)
        )
    return self
```

**Critical constraint:** The forbidden set must NOT include `"test-secret-key-for-pytest-only-not-for-production"` (conftest.py line 12) or `"test-secret-key-for-pytest-only"` (test_v2_routes.py line 13). Both test values are distinct from the forbidden set above.

---

### `backend/app/core/dependencies.py` (middleware/utility — add `require_role`)

**Analog:** `backend/app/api/v1/routes/admin.py` lines 30-38 (`_require_admin`) and `backend/app/core/dependencies.py` lines 1-97 (full file for import context)

**Existing imports pattern** (`dependencies.py` lines 1-17):
```python
from __future__ import annotations
from typing import Optional
from fastapi import Depends, Header, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session
from app.core.security import verify_token
from app.db.session import get_db
from app.db.models import User
```

**Existing `_require_admin` to generalize** (`admin.py` lines 30-38):
```python
def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: enforce admin role. Returns user or raises 403."""
    role = getattr(current_user, "role", "counsellor")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
```

**New `require_role` factory to add at end of `dependencies.py`:**
```python
def require_role(role: str):
    """Factory: returns a FastAPI dependency that enforces a specific role.

    Usage:
        @router.get("/admin/users", dependencies=[Depends(require_role("admin"))])
    Or as a positional dependency returning the user:
        current_user: User = Depends(require_role("admin"))
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if getattr(current_user, "role", "counsellor") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return current_user
    return _check
```

---

### `backend/app/api/v1/routes/admin.py` (controller — add user management CRUD)

**Analog:** `backend/app/api/v1/routes/admin.py` (self-extend — existing router, prefix, and `_require_admin` already in place)

**Existing router setup** (lines 1-20):
```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/admin", tags=["admin-v2"])
```

**Existing route pattern to match** (lines 57-83 — POST with Depends chain):
```python
@router.post(
    "/data-refresh",
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_data_refresh(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    ...
    return { "task_id": task_id, ... }
```

**New endpoints pattern** (from RESEARCH.md Code Examples, lines 579-630 — add at bottom of file):
```python
# Add new imports at top of file:
from sqlalchemy.exc import IntegrityError
from app.core.dependencies import require_role  # new helper
from app.core.security import get_password_hash
# Pydantic schemas — define in app/schemas/v2/admin_users.py (new file)
from app.schemas.v2.admin_users import UserCreateAdmin, UserUpdateAdmin, UserAdminResponse

# GET /admin/users
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return db.query(User).filter(User.is_active == True).all()

# POST /admin/users  — status 201
@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
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
    return user

# PATCH /admin/users/{user_id}
@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdateAdmin,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.role is not None:
        user.role = payload.role
    db.commit()
    db.refresh(user)
    return user

# DELETE /admin/users/{user_id}  — status 204
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot delete your own account.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_active = False
    db.commit()
```

---

### `backend/app/schemas/v2/admin_users.py` (new schema file)

**Analog:** `backend/app/schemas/v2/account.py` (lines 1-57 — same Pydantic v2 pattern)

**Imports and schema pattern** (`account.py` lines 1-27):
```python
from __future__ import annotations
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator

class AccountResponse(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Validation pattern** (`account.py` lines 30-44 — `field_validator` usage):
```python
class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    preferred_language: Optional[str] = None

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"en", "zh-HK"}
        if v not in allowed:
            raise ValueError(f"preferred_language must be one of {allowed}")
        return v
```

**Apply same pattern for `admin_users.py`:** `UserCreateAdmin` requires `email`, `password`, `role` with `field_validator` checking `role in {"counsellor", "admin"}`. `UserAdminResponse` mirrors `AccountResponse` with `model_config = {"from_attributes": True}`.

---

### `backend/tests/test_admin_users.py` (new test file)

**Analog:** `backend/tests/test_v2_routes.py` (lines 1-159 — class-based test structure, TestClient, auth_headers fixture)

**File header / env-var setup pattern** (`test_v2_routes.py` lines 1-22):
```python
"""
tests/test_admin_users.py
...
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

import pytest
from fastapi.testclient import TestClient
```

**Admin fixture pattern** — extend `conftest.py` auth_headers fixture logic to create an admin user. Source: `conftest.py` lines 104-147:
```python
# In test_admin_users.py (local fixture), create admin variant:
@pytest.fixture
def admin_auth_headers(client, db):
    import uuid as _uuid
    from app.db.models import User
    from app.core.security import get_password_hash, create_access_token
    from app.core.dependencies import get_current_user
    from app.main import app

    email = "admin@example.com"
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
    else:
        user = existing

    def _override():
        return user
    app.dependency_overrides[get_current_user] = _override
    token = create_access_token(data={"sub": str(user.id)})
    yield {"Authorization": f"Bearer {token}"}
    del app.dependency_overrides[get_current_user]
```

**Test class pattern** (`test_v2_routes.py` lines 57-112 — class-based, unauthenticated + authenticated pairs):
```python
class TestAdminUsersEndpoints:
    def test_list_users_unauthenticated(self, client):
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code in (401, 403)

    def test_list_users_as_counsellor_returns_403(self, client, auth_headers):
        # auth_headers fixture creates a counsellor-role user
        resp = client.get("/api/v1/admin/users", headers=auth_headers)
        assert resp.status_code == 403

    def test_list_users_as_admin_returns_200(self, client, admin_auth_headers):
        resp = client.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_user(self, client, admin_auth_headers):
        resp = client.post(
            "/api/v1/admin/users",
            json={"email": "new@example.com", "password": "pass123", "role": "counsellor"},
            headers=admin_auth_headers,
        )
        assert resp.status_code == 201

    def test_self_delete_blocked(self, client, admin_auth_headers, db):
        # Get admin user id, then attempt DELETE on own id
        ...
        assert resp.status_code == 403
```

---

### `backend/tests/test_startup_validation.py` (new test file)

**Analog:** `backend/tests/test_v2_routes.py` (structure) and `backend/app/core/config.py` (the target under test)

**Pattern — test validator by overriding env vars:**
```python
"""
tests/test_startup_validation.py

Tests that Settings() raises ValueError for forbidden placeholder values.
These tests must NOT import app.main (which triggers Settings()) at module level.
"""
import os
import pytest

def test_placeholder_secret_key_raises():
    """Settings must reject the default .env.example SECRET_KEY."""
    os.environ["SECRET_KEY"] = "dev-secret-key-do-not-use-in-production-abc123"
    os.environ["DATABASE_URL"] = "postgresql+psycopg2://x:x@localhost/db"

    # Re-import Settings fresh (clear module cache if needed via importlib.reload)
    from importlib import reload
    import app.core.config as cfg_module
    with pytest.raises((ValueError, Exception)):
        reload(cfg_module)
    # Restore
    os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-not-for-production"

def test_missing_database_url_raises():
    """Settings must reject missing DATABASE_URL."""
    saved = os.environ.pop("DATABASE_URL", None)
    from importlib import reload
    import app.core.config as cfg_module
    with pytest.raises((ValueError, Exception)):
        reload(cfg_module)
    if saved:
        os.environ["DATABASE_URL"] = saved
```

**Note:** The validator fires at `Settings()` instantiation (module import time). Tests must reload the config module or test by directly instantiating `Settings()` with a patched env — not via the cached `settings` singleton. Consider using `pydantic_settings.BaseSettings` directly with `_env_file=None` and keyword args if module reload proves fragile.

---

### `frontend/src/context/AuthContext.jsx` (provider — add role to context)

**Analog:** `frontend/src/context/AuthContext.jsx` lines 1-25 (full file — self-extend)

**Existing full file** (all 25 lines):
```jsx
import { createContext, useState } from 'react';
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const isAuthenticated = !!token;

  const login = (t) => {
    localStorage.setItem('token', t);
    setToken(t);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Pattern to add — fetch account after login:**
- Add `user` state (stores full account object including `role`)
- `login(t)` must call `GET /api/v1/account` immediately after setting token, then `setUser(data)`
- `logout()` must clear both token and user: `setUser(null)`
- Expose `user` in context value alongside `token` and `isAuthenticated`
- `role` is read via `user?.role` by consumers — no separate role state needed

**Import pattern to follow** (matches `AdminDataRefresh.jsx` lines 9-10 which calls `getAccount`):
```jsx
import { getAccount } from '../api/account';
```

**`AdminDataRefresh.jsx` role-check reference** (lines 28-38 — how role is currently checked post-fetch):
```jsx
useEffect(() => {
  getAccount()
    .then((data) => {
      setAccount(data);
      if (data.role !== 'admin') {
        showToast('You do not have permission to access that page.', 'error');
        navigate('/dashboard');
      }
    })
    .catch(() => navigate('/dashboard'));
}, []);
```
The new AuthContext centralizes this so individual pages don't need to re-fetch.

---

### `frontend/src/pages/Settings/Settings.jsx` (new component — Settings page with Users tab)

**Analog:** `frontend/src/pages/AccountSettings/AccountSettings.jsx` (full file — same page architecture)

**Imports pattern** (`AccountSettings.jsx` lines 1-14):
```jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Toast from '../../components/Toast/Toast';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { getAccount } from '../../api/account';
```

**Page shell pattern** (`AccountSettings.jsx` lines 16-52 — state + useEffect + layout vars):
```jsx
function AccountSettings() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toasts, showToast, removeToast } = useToast();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAccount()
      .then((data) => { setAccount(data); ... })
      .catch(() => setError('Failed to load account settings.'))
      .finally(() => setLoading(false));
  }, []);
```

**CSS-in-JS style vars pattern** (`AccountSettings.jsx` lines 129-177 — inline style objects using CSS vars):
```jsx
const pageStyle = {
  background: 'var(--color-background)',
  minHeight: '100vh',
  fontFamily: 'var(--font-family-base)',
};
const contentStyle = {
  maxWidth: '640px',
  margin: '0 auto',
  padding: 'var(--space-10) var(--space-8)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
};
const cardStyle = (danger = false) => ({
  background: 'var(--color-surface)',
  border: `var(--border-width) solid ${danger ? 'var(--color-error)' : 'var(--color-border)'}`,
  borderRadius: 'var(--border-radius-lg)',
  padding: 'var(--space-6)',
  boxShadow: 'var(--shadow-sm)',
});
```

**Loading/error guard pattern** (`AccountSettings.jsx` lines 179-191):
```jsx
if (loading) return (
  <div style={pageStyle}>
    <NavBarV2 account={account} />
    <div style={{ padding: 'var(--space-10)' }}><LoadingSpinner label="Loading..." /></div>
  </div>
);
if (error) return (
  <div style={pageStyle}>
    <NavBarV2 account={account} />
    <div style={{ padding: 'var(--space-10)' }}><ErrorMessage message={error} /></div>
  </div>
);
```

**Admin tab guard:** The Settings page renders two tabs. The "Users" tab renders only when `account?.role === 'admin'`. Tab state: `const [activeTab, setActiveTab] = useState('general')`. When `account.role !== 'admin'` and URL is `/settings`, only the General tab is visible (no redirect needed — tab is simply absent from the DOM).

**Admin data table pattern** (from `AdminDataRefresh.jsx` lines 64-110 — card + content structure):
```jsx
<div style={cardStyle}>
  <h2 style={cardTitleStyle}>Users</h2>
  {/* table of users */}
</div>
```

---

### `frontend/src/App.jsx` (modify — add `/settings` route)

**Analog:** `frontend/src/App.jsx` lines 1-78 (full file — self-extend)

**Existing ProtectedRoute pattern** (lines 33-36):
```jsx
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

**Add AdminRoute variant** — a role-gated route that checks `user?.role === 'admin'`:
```jsx
function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
```

**Existing route registration pattern** (lines 63-64 — how admin page is added):
```jsx
<Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
<Route path="/admin/data-refresh" element={<ProtectedRoute><AdminDataRefresh /></ProtectedRoute>} />
```

**New route to add:**
```jsx
import Settings from './pages/Settings/Settings';
// ...
<Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
```
The `/settings` page itself handles admin tab visibility. `AdminRoute` is used for future pages that must fully block non-admins, but `/settings` shows a reduced view to counsellors (General tab only), so `ProtectedRoute` is sufficient for the route guard.

---

### `frontend/src/api/admin.js` (new API client file)

**Analog:** `frontend/src/api/account.js` (full file — 14 lines, identical structure)

**Full analog file** (`account.js` lines 1-14):
```js
import client from './client';

export const getAccount = () =>
  client.get('/api/v1/account').then((r) => r.data);

export const updateAccount = (data) =>
  client.patch('/api/v1/account', data).then((r) => r.data);

export const changePassword = (data) =>
  client.post('/api/v1/account/change-password', data).then((r) => r.data);

export const deleteAccount = () =>
  client.delete('/api/v1/account').then((r) => r.data);
```

**Apply same pattern for `admin.js`:**
```js
import client from './client';

export const listUsers = () =>
  client.get('/api/v1/admin/users').then((r) => r.data);

export const createUser = (data) =>
  client.post('/api/v1/admin/users', data).then((r) => r.data);

export const updateUser = (id, data) =>
  client.patch(`/api/v1/admin/users/${id}`, data).then((r) => r.data);

export const deleteUser = (id) =>
  client.delete(`/api/v1/admin/users/${id}`).then((r) => r.data);
```

---

### `scripts/seed_demo.py` (new utility script — idempotent demo seed)

**Analog:** `backend/tests/conftest.py` lines 104-147 (user creation pattern with direct ORM access)

**User creation pattern from conftest** (lines 110-131):
```python
from app.db.models import User
from app.core.security import get_password_hash

email = "test@example.com"
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
```

**Session setup pattern** (conftest lines 36-52 — SessionLocal usage):
```python
from app.db.session import SessionLocal
db = SessionLocal()
try:
    # ... work
finally:
    db.close()
```

**Script bootstrap pattern** (RESEARCH.md Code Examples lines 634-671):
```python
import os, sys
# Allow running from repo root: python scripts/seed_demo.py
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import get_password_hash
import uuid

DEMO_ADMIN_EMAIL = "admin@demo.example"
DEMO_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

def seed_demo(db: Session):
    admin = db.query(User).filter(User.email == DEMO_ADMIN_EMAIL).first()
    if admin is None:
        admin = User(
            id=DEMO_ADMIN_ID,
            email=DEMO_ADMIN_EMAIL,
            hashed_password=get_password_hash("demo-admin-password"),
            role="admin",
            display_name="Demo Admin",
        )
        db.add(admin)
    else:
        admin.role = "admin"  # ensure correct on re-run
    db.commit()

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo(db)
    finally:
        db.close()
```

---

## Shared Patterns

### Authentication — JWT Bearer
**Source:** `backend/app/core/dependencies.py` lines 49-66 (`get_current_user`)
**Apply to:** All new admin route handlers
```python
from app.core.dependencies import get_current_user
# Standard usage:
current_user: User = Depends(get_current_user)
```

### Role Gate
**Source:** `backend/app/api/v1/routes/admin.py` lines 30-38 (`_require_admin`) — generalize to `require_role()`
**Apply to:** All new `/admin/users` endpoints
```python
from app.core.dependencies import require_role
# In route signature:
_: User = Depends(require_role("admin"))
# Or when you need the user object:
current_user: User = Depends(require_role("admin"))
```

### Error Handling (backend)
**Source:** `backend/app/api/v1/routes/admin.py` lines 57-83 (HTTPException pattern)
**Apply to:** All new admin user endpoints
```python
raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")
raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot delete your own account.")
```

### Error Handling (frontend)
**Source:** `frontend/src/pages/AdminDataRefresh/AdminDataRefresh.jsx` lines 53-61
**Apply to:** All admin API calls in Settings page
```jsx
} catch (err) {
  if (err?.response?.status === 403) {
    showToast('You do not have permission.', 'error');
  } else {
    showToast('Failed to complete action.', 'error');
  }
}
```

### Toast / Feedback
**Source:** `frontend/src/pages/AccountSettings/AccountSettings.jsx` lines 18-19, 59-61
**Apply to:** Settings page and any new admin UI actions
```jsx
const { toasts, showToast, removeToast } = useToast();
showToast('User created.', 'success');
// At bottom of JSX:
<Toast toasts={toasts} removeToast={removeToast} />
```

### Test Auth Fixture
**Source:** `backend/tests/conftest.py` lines 104-147 (`auth_headers` fixture)
**Apply to:** `test_admin_users.py` — copy pattern and add `role="admin"` for the admin fixture variant

### CSS-in-JS Design System
**Source:** `frontend/src/pages/AccountSettings/AccountSettings.jsx` lines 129-177
**Apply to:** Settings page — all inline styles must use `var(--color-*)`, `var(--space-*)`, `var(--font-*)` tokens, never hardcoded hex or px values (except for small constants like `2px`)

---

## No Analog Found

Files with no close match in the codebase (use RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `.github/workflows/ci.yml` | config | batch | No existing CI config in codebase |
| `scripts/generate_secrets.sh` | utility | batch | No existing shell scripts in codebase |
| `vercel.json` | config | — | No existing Vercel config; use RESEARCH.md Pattern 3 verbatim |
| `railway.toml` | config | — | No existing Railway config; use RESEARCH.md Pattern 4 verbatim |

---

## Metadata

**Analog search scope:** `backend/app/api/v1/routes/`, `backend/app/core/`, `backend/app/schemas/`, `backend/tests/`, `frontend/src/context/`, `frontend/src/pages/`, `frontend/src/api/`
**Files scanned:** 14
**Pattern extraction date:** 2026-04-28
