# Phase 6: Deployment and Production Readiness - Research

**Researched:** 2026-04-28
**Domain:** CI/CD pipeline, Vercel SPA deployment, Railway FastAPI hosting, Neon PostgreSQL, RBAC enforcement, secrets management, demo seeding
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Keep existing role values (`counsellor` and `admin`) — no renaming. Domain modules can alias the display label in the UI if needed (e.g., display "Staff" instead of "Counsellor" in a non-school deployment).
- **D-02:** Admin-only routes limited to user management — create/edit/delete users and assign roles. All other features (entity CRUD, consultant tasks, import/export, data refresh) remain available to all authenticated users.
- **D-03:** Admin user management UI lives as a "Users" tab on a Settings page. Table with create/edit/delete actions. Nav link or tab hidden for non-admin users.
- **D-04:** Frontend deployed to Vercel. Backend deployed to Railway (primary and only documented host). No Vercel serverless for backend — FastAPI + XGBoost + SHAP is too heavy for function size limits.
- **D-05:** Production database is Neon (managed PostgreSQL). Document Neon setup only — no Railway DB or alternative DB docs. User connects via DATABASE_URL env var.
- **D-06:** Full CI/CD pipeline via GitHub Actions. Runs pytest + vitest as quality gate, then deploys frontend to Vercel and backend to Railway on success. Preview deploys on PR, production on main merge.
- **D-07:** `generate_secrets.sh` auto-generates cryptographic secrets (SECRET_KEY, etc.) and leaves service-specific values (DATABASE_URL, AI_API_KEY, CORS_ORIGINS) as clearly-marked `CHANGE_ME` placeholders. Non-interactive script.
- **D-08:** Hard fail on critical vars at startup — app refuses to start if SECRET_KEY is the default placeholder or DATABASE_URL is missing. Prints exactly which vars need attention. AI_API_KEY can be empty (AI features degrade gracefully). Non-critical vars get warnings but don't block startup.
- **D-09:** `python scripts/seed_demo.py` creates a full demo scenario: admin user + counsellor user, 3-5 sample students with grades/activities, schools + subjects from existing seed data, and a pre-generated academic plan for one student. App should feel "lived in" for a demo.
- **D-10:** Seed script is idempotent using upsert pattern — checks if demo data exists before inserting, updates existing demo records if present, never duplicates. Safe to re-run on an existing deployment.

### Claude's Discretion

- Exact GitHub Actions workflow structure and job dependencies
- Railway deployment configuration (Procfile, nixpacks, or Dockerfile)
- Vercel project configuration (vercel.json structure, build settings)
- Neon connection pooling setup and SSL configuration
- Startup validation implementation (middleware vs app event vs config module)
- Settings page UI layout and component structure
- Demo student data content (names, grades, activities — realistic but fictional)
- How existing seed SQL files are incorporated into seed_demo.py
- CORS_ORIGINS handling for production (Vercel URL + custom domain)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | RBAC with at minimum admin and staff roles, enforced at API route level | `_require_admin` dependency pattern already exists; extend to `require_role()` reusable dependency; new admin user management routes needed |
| SEC-02 | Admin can manage user accounts and assign roles | New CRUD endpoints under `/api/v1/admin/users`; Settings page with Users tab |
| DEP-01 | Vercel deployment configuration for frontend (static build) | `vercel.json` with SPA rewrite + root directory pointing to `frontend/`; Vercel auto-detects Vite |
| DEP-02 | Managed PostgreSQL setup documented (Neon recommended) | Neon requires `sslmode=require` in DATABASE_URL; `postgresql+psycopg2://` dialect prefix needed |
| DEP-03 | Backend deployable to Railway with clear instructions | `railway.toml` with `startCommand`; Railpack auto-detects Python and `requirements.txt`; PORT injected by Railway |
| DEP-04 | Environment variable template with all required and optional vars documented | Extend `.env.example`; `generate_secrets.sh` produces cryptographically strong values for SECRET_KEY |
| DEP-05 | Seed data script for demo deployment | `scripts/seed_demo.py` using upsert via SQLAlchemy; incorporates existing seed SQL data |
| DEP-06 | Secret generation script for fresh deployments | `scripts/generate_secrets.sh` using `openssl rand -hex 32` for SECRET_KEY |

</phase_requirements>

---

## Summary

Phase 6 has two largely independent workstreams that must both land cleanly: (1) RBAC enforcement and admin user management UI, and (2) the full deployment pipeline (Vercel + Railway + Neon, GitHub Actions CI/CD, secrets tooling, and demo seed).

The RBAC work is straightforward given existing codebase foundations. A `_require_admin` dependency already exists in `admin.py`; the only gap is a reusable `require_role()` helper, new user management API endpoints, a Settings page with a Users tab (following the detailed UI spec), an updated `AuthContext` that surfaces the `role` field from the account endpoint, and route guards in `App.jsx`. The `AccountResponse` schema already returns `role`, so the backend already sends the data the frontend needs.

The deployment workstream requires creating four new files (`.github/workflows/ci.yml`, `vercel.json`, `railway.toml`, `scripts/generate_secrets.sh`), one new Python script (`scripts/seed_demo.py`), updating `backend/.env.example` with production vars, extending `backend/app/core/config.py` with startup validation, and writing a developer-facing `DEPLOY.md` guide. Key verified facts: Vercel auto-detects Vite and sets the build command to `npm run build` with output at `dist/` — the root directory must be set to `frontend/`. Railway uses Railpack (auto-detects Python from `requirements.txt`) but the start command must be set explicitly; Railway injects `$PORT` which uvicorn must use. Neon requires `?sslmode=require` appended to the DATABASE_URL (the `postgresql+psycopg2://` prefix is compatible). The existing 213 backend tests use SQLite in-memory and will pass in CI without a real database.

**Primary recommendation:** Build RBAC first (it adds new API routes that the CI test suite should cover), then implement deployment configs and tooling. The seed script is the last piece because it needs real users/data to function correctly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RBAC enforcement | API / Backend | — | Role check must happen server-side; frontend hides nav but backend must reject with 403 |
| Admin user management CRUD | API / Backend | — | Password hashing, role validation, self-delete prevention all belong in backend |
| Admin user management UI | Frontend Server (SPA) | — | Client renders Settings page; route guard `user.role === 'admin'` before rendering |
| Role surfacing to frontend | API / Backend | Browser / Client | `/api/v1/account` already returns `role`; AuthContext must store it after login |
| Frontend static build | CDN / Static (Vercel) | — | React SPA compiled to `dist/` by Vite; served as static files from Vercel edge |
| Backend API hosting | API / Backend (Railway) | — | FastAPI + XGBoost + SHAP too heavy for Vercel serverless; Railway container is the documented target |
| Database | Database / Storage (Neon) | — | Managed PostgreSQL; app connects via DATABASE_URL with sslmode=require |
| Startup validation | API / Backend | — | Checked at process start in config.py or main.py before any request is served |
| Secrets generation | CDN / Static (script) | — | `generate_secrets.sh` runs locally by the deployer; output is `.env` file |
| Demo seed | Database / Storage | API / Backend | Python script runs locally or on Railway shell; uses SQLAlchemy ORM to insert data |
| CI/CD quality gate | — (GitHub Actions) | — | GitHub-hosted runner orchestrates pytest + vitest, then triggers Vercel/Railway deploys |

---

## Standard Stack

### Core — VERIFIED against codebase

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.111.0 | Backend API framework | Already in use; `Depends()` for role gates |
| Pydantic-settings | 2.2.1 | Environment config validation | Already in use; extend with `@model_validator` for startup guard |
| SQLAlchemy | 2.0.30 | ORM for user management queries | Already in use; `db.query(User)` pattern established |
| passlib[bcrypt] | 1.7.4 | Password hashing for new users | Already in use in auth_service.py |
| Vite | 8.0.10 | Frontend build tool | Already in use; outputs to `frontend/dist/`; Vercel auto-detects |
| pytest | 8.2.0 | Backend test runner | Already in use with 213 tests in `backend/tests/` |
| vitest | 4.x | Frontend test runner | Already configured in `vite.config.js`; `passWithNoTests: true` |

### Supporting — Deployment Tooling

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vercel CLI | 52.0.0 | Frontend deploy from CI | `vercel deploy --prod` triggered by GitHub Actions |
| railway CLI | 4.37.4 | Backend deploy from CI | `railway up` triggered by GitHub Actions using `RAILWAY_TOKEN` |
| openssl | system | Generate SECRET_KEY entropy | `openssl rand -hex 32` in `generate_secrets.sh` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `railway.toml` start command | Procfile | `railway.toml` is Railway's native config-as-code; Procfile is supported but less explicit for env var config |
| `openssl rand -hex 32` | Python `secrets.token_hex(32)` | Either works; openssl is universally available in shell and avoids Python import in a bash script |
| Pydantic `@model_validator` for startup guard | FastAPI `lifespan` event | Both work; `@model_validator` runs at Settings instantiation (module import time) which gives earlier failure with zero additional wiring |

**Installation (nothing new needed — deployer tools):**
```bash
npm install -g vercel   # already available (v52.0.0 confirmed)
# railway CLI already installed (v4.37.4 confirmed)
```

**Version verification:** [VERIFIED: `npm view vercel version` → 52.0.0; `railway --version` → 4.37.4]

---

## Architecture Patterns

### System Architecture Diagram

```
Developer machine
  └── git push → GitHub
                    │
        ┌───────────▼────────────────────────────────────────────┐
        │  GitHub Actions: .github/workflows/ci.yml              │
        │                                                         │
        │  ┌─ quality-gate job ─────────────────────────────┐   │
        │  │  1. checkout                                    │   │
        │  │  2. python setup → pip install requirements.txt │   │
        │  │  3. pytest backend/tests/ (213 tests, SQLite)   │   │
        │  │  4. node setup → npm ci (frontend/)             │   │
        │  │  5. npm run build (Vite → frontend/dist/)       │   │
        │  │  6. vitest run (passWithNoTests: true)          │   │
        │  └────────────────────────────────────────────────┘   │
        │         │ on success                                    │
        │         ▼                                               │
        │  ┌─ deploy-frontend (Vercel) ──────────────────────┐  │
        │  │  vercel deploy --prod (main) / vercel (PR)      │  │
        │  └────────────────────────────────────────────────┘  │
        │         │                                              │
        │  ┌─ deploy-backend (Railway) ──────────────────────┐  │
        │  │  RAILWAY_TOKEN=secret railway up                │  │
        │  └────────────────────────────────────────────────┘  │
        └───────────────────────────────────────────────────────┘
                  │                         │
       ┌──────────▼──────────┐   ┌──────────▼──────────────┐
       │  Vercel Edge CDN    │   │  Railway Container       │
       │  frontend/dist/     │   │  uvicorn app.main:app    │
       │  SPA: React + Vite  │   │  --host 0.0.0.0          │
       │  static files       │   │  --port $PORT            │
       │  vercel.json SPA    │   │                          │
       │  rewrite rules      │   │  startup validation:     │
       └─────────────────────┘   │  • SECRET_KEY != default │
                │ HTTPS API      │  • DATABASE_URL present  │
                └───────────────►│                          │
                                 └──────────────┬───────────┘
                                                │ DATABASE_URL
                                                │ (sslmode=require)
                                     ┌──────────▼──────────┐
                                     │  Neon PostgreSQL     │
                                     │  Managed cloud DB    │
                                     │  postgresql+psycopg2 │
                                     └─────────────────────┘
```

### Recommended Project Structure (new files only)

```
schoolchoice/
├── .github/
│   └── workflows/
│       └── ci.yml                        # CI/CD pipeline (new)
├── scripts/
│   ├── generate_secrets.sh               # Secret generation script (new)
│   └── seed_demo.py                      # Demo seed script (new)
├── vercel.json                           # Vercel SPA config (new)
├── railway.toml                          # Railway start command (new)
├── DEPLOY.md                             # Deployment guide (new)
├── backend/
│   ├── .env.example                      # Extend with production vars
│   └── app/
│       ├── core/
│       │   └── config.py                 # Add startup validation
│       └── api/v1/routes/
│           └── admin.py                  # Add user management endpoints
└── frontend/
    └── src/
        ├── context/
        │   └── AuthContext.jsx           # Add role to context
        ├── pages/
        │   └── Settings/                 # New Settings page (new)
        └── App.jsx                       # Add /settings route guard
```

### Pattern 1: Reusable Role-Gating Dependency

**What:** A `require_role()` factory function in `dependencies.py` that returns a FastAPI `Depends()` callable for any role value.

**When to use:** Any new admin-only route. The existing `_require_admin` in `admin.py` is a one-off — `require_role()` is the reusable version.

**Example:**
```python
# Source: codebase pattern from backend/app/api/v1/routes/admin.py
# Extended to a reusable factory

from fastapi import Depends, HTTPException, status
from app.core.dependencies import get_current_user
from app.db.models import User

def require_role(role: str):
    """Factory: returns a FastAPI dependency that enforces a specific role."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if getattr(current_user, "role", "counsellor") != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return current_user
    return _check

# Usage on any admin route:
@router.get("/admin/users", dependencies=[Depends(require_role("admin"))])
def list_users(db: Session = Depends(get_db)): ...
```

[VERIFIED: pattern matches existing `_require_admin` in `backend/app/api/v1/routes/admin.py`]

### Pattern 2: Startup Validation in config.py

**What:** A Pydantic `@model_validator(mode="after")` on the `Settings` class that checks critical vars before the app accepts traffic. Runs at import time (when `settings = Settings()` is evaluated in `config.py`).

**When to use:** DEP-04, D-08 — hard fail on placeholder secrets.

**Example:**
```python
# Source: pydantic-settings @model_validator pattern (Context7: /pydantic/pydantic-settings)
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_FORBIDDEN_SECRET_KEYS = {
    "dev-secret-key-do-not-use-in-production-abc123",
    "CHANGE_ME",
    "changeme",
}

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""
    AI_MODEL: str = ""
    AI_BASE_URL: str = ""
    AI_TIMEOUT: int = 30

    @model_validator(mode="after")
    def _validate_production_secrets(self) -> "Settings":
        errors = []
        if self.SECRET_KEY in _FORBIDDEN_SECRET_KEYS:
            errors.append("SECRET_KEY must not be the default placeholder value. Run scripts/generate_secrets.sh.")
        if not self.DATABASE_URL or self.DATABASE_URL == "CHANGE_ME":
            errors.append("DATABASE_URL is required and must not be a placeholder.")
        if errors:
            raise ValueError(
                "Startup validation failed — insecure configuration detected:\n"
                + "\n".join(f"  - {e}" for e in errors)
            )
        return self
```

**Warning:** The existing `conftest.py` sets `SECRET_KEY` to a test value before import. The validator must allow test secrets (the test value `"test-secret-key-for-pytest-only-not-for-production"` must not be in the forbidden set). [VERIFIED: conftest.py line 12 uses that exact value — it is not in `_FORBIDDEN_SECRET_KEYS` above.]

### Pattern 3: Vercel SPA Deployment Config

**What:** `vercel.json` at the repo root with SPA rewrite rules and root directory pointing to `frontend/`. Vercel auto-detects Vite and uses `npm run build` → `dist/`.

**When to use:** DEP-01.

**Example:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The `vercel.json` lives at the repo root. The Vercel project's **Root Directory** setting must be configured to `frontend` in the Vercel dashboard (or via `--cwd frontend` in CLI). The rewrite rule is required so React Router paths like `/students/123/profile` resolve to `index.html` instead of 404ing.

[VERIFIED: Context7 /websites/vercel confirms this exact rewrite pattern for Vite SPAs]

### Pattern 4: Railway Start Command via railway.toml

**What:** `railway.toml` at the repo root specifying the uvicorn start command. Railway uses Railpack for auto-detection but the explicit `startCommand` overrides it and is required to pass `--port $PORT`.

**When to use:** DEP-03.

**Example:**
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
```

The `railway.toml` lives in the `backend/` directory (or the repo root with root directory configured in the Railway service settings to `backend/`). Railway's Railpack auto-detects `requirements.txt` and installs Python dependencies. Railway injects `$PORT` as an environment variable.

[VERIFIED: Context7 /websites/railway confirms `startCommand` field; FastAPI start command pattern uses `--port $PORT`]

### Pattern 5: Neon DATABASE_URL Format

**What:** Neon requires SSL. The connection string uses `postgresql+psycopg2://` (existing SQLAlchemy dialect) with `?sslmode=require` appended.

**Example:**
```
DATABASE_URL=postgresql+psycopg2://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

[VERIFIED: Context7 neon.com/docs/guides/python confirms `?sslmode=require` is required]

### Pattern 6: GitHub Actions CI/CD with Vercel + Railway Deploy

**What:** Single workflow file with three jobs: `test` (quality gate), `deploy-frontend` (Vercel), `deploy-backend` (Railway). Deploy jobs have `needs: test` so they never run if tests fail. Production deploy triggers on `push` to `main`; preview deploy triggers on `pull_request`.

**Key secrets required in GitHub:**
- `VERCEL_TOKEN` — Vercel access token
- `VERCEL_ORG_ID` — Vercel org/team ID
- `VERCEL_PROJECT_ID` — Vercel project ID
- `RAILWAY_TOKEN` — Railway project token

**Example structure:**
```yaml
# Source: GitHub Actions docs + Railway CLI deploy pattern
# https://docs.github.com/en/actions  and  https://docs.railway.com/cli/deploying
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.10" }
      - run: pip install -r backend/requirements.txt
        working-directory: .
      - run: pytest backend/tests/ -x -q
        env:
          DATABASE_URL: sqlite:///:memory:
          SECRET_KEY: test-secret-key-for-pytest-only-not-for-production
          ALGORITHM: HS256
          ACCESS_TOKEN_EXPIRE_MINUTES: "30"
          CORS_ORIGINS: http://localhost:5173
          AI_PROVIDER: gemini
          AI_API_KEY: ""
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
      - run: npx vitest run
        working-directory: frontend

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
        working-directory: frontend
      - run: npx vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
        working-directory: frontend
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          curl -fsSL https://railway.app/install.sh | sh
          RAILWAY_TOKEN=${{ secrets.RAILWAY_TOKEN }} railway up --service backend
        working-directory: backend
```

[CITED: https://docs.github.com/en/actions and https://docs.railway.com/cli/deploying]

### Pattern 7: generate_secrets.sh

**What:** Non-interactive bash script that generates a `.env` file with cryptographic values for `SECRET_KEY` and `CHANGE_ME` placeholders for service-specific vars.

**Example:**
```bash
#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-.env}"

SECRET_KEY=$(openssl rand -hex 32)

cat > "$OUT" <<EOF
# Generated by scripts/generate_secrets.sh — $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Fill in CHANGE_ME values before starting the app.

DATABASE_URL=CHANGE_ME
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=CHANGE_ME
AI_PROVIDER=gemini
AI_API_KEY=
# AI_MODEL=
# AI_BASE_URL=
# AI_TIMEOUT=30
EOF

echo "Generated: ${OUT}"
echo "  SECRET_KEY: set ($(echo -n "$SECRET_KEY" | wc -c | tr -d ' ') chars)"
echo "  Fill in DATABASE_URL and CORS_ORIGINS before starting."
```

[ASSUMED: `openssl` is always available on macOS and Linux. Confirmed on macOS — `command -v openssl` returns a path on this machine.]

### Pattern 8: AuthContext Extended with Role

**What:** The current `AuthContext` stores only the raw JWT token. To support frontend role guards, it must also store `user.role` fetched from `GET /api/v1/account` on login/init.

**When to use:** SEC-01 (route guard), D-03 (nav link visibility).

The `AccountResponse` schema already returns `role`. The `AuthContext` needs to:
1. After `login(token)` is called, immediately `GET /api/v1/account` and store the result as `user`.
2. Expose `user` (with `role`) from the context alongside `token` and `isAuthenticated`.
3. `App.jsx` ProtectedRoute for `/settings` checks `user?.role === 'admin'`.

[VERIFIED: `AccountResponse` in `backend/app/schemas/v2/account.py` includes `role: str`]

### Anti-Patterns to Avoid

- **Putting SECRET_KEY validation in main.py as a commented `if` block:** The validator belongs in `Settings` so it fires before any code that uses `settings` can run, even in background tasks or startup hooks.
- **Hardcoding `CHANGE_ME` as allowed in tests:** The test conftest already sets `SECRET_KEY` to a valid (non-placeholder) value; the forbidden set check is safe.
- **Using `vercel.json` with a `routes` array instead of `rewrites`:** The `routes` array disables the default Vercel routing; `rewrites` is additive and correct for SPAs.
- **Deploying Railway backend from the repo root:** The `backend/` directory is the Python project root; `requirements.txt` is at `backend/requirements.txt`, not root. Either set Railway's Root Directory to `backend/` or set `rootDirectory` in `railway.toml`.
- **seeding with plain `INSERT` instead of upsert:** The seed script must be idempotent (`INSERT ... ON CONFLICT DO UPDATE` or `db.merge()`), per D-10. The existing `_run_sql_file` helper uses savepoints, but `seed_demo.py` should use SQLAlchemy ORM for the demo records.
- **Fetching role in every ProtectedRoute component:** Role should be stored once in AuthContext and read from there; redundant API calls per route cause flash-of-wrong-content.
- **Using RAILWAY_API_TOKEN (account-scoped) instead of RAILWAY_TOKEN (project-scoped) for CI:** RAILWAY_TOKEN scopes to the project and is safer for CI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cryptographic secret generation | Custom random string generator | `openssl rand -hex 32` | System CSPRNG; 256 bits entropy; one-liner |
| JWT validation in route handler | Inline `jose.decode()` calls | Existing `get_current_user` dependency | Already tested, handles expiry, raises 401 correctly |
| Role check in route handler | `if user.role != "admin"` inline | `require_role("admin")` dependency | Consistent 403, testable, declarative |
| Idempotent DB seeding | Custom "check before insert" logic | SQLAlchemy `db.merge()` + fixed UUIDs | `merge()` upserts by PK — safe to re-run with same fixture UUIDs |
| SPA routing fix on Vercel | Custom 404.html tricks | `rewrites` in `vercel.json` | Verified pattern; works for all React Router paths |
| Railway environment PORT wiring | Hardcoded port in start command | `--port $PORT` in `startCommand` | Railway assigns dynamic PORT; hardcoding causes bind failure |

**Key insight:** Every infrastructure primitive this phase needs (shell secret generation, SPA routing, container port wiring) has a single-line standard solution — the risk in this phase is in configuration correctness, not in algorithmic complexity.

---

## Runtime State Inventory

> This is not a rename/refactor phase. No runtime state inventory required.

---

## Common Pitfalls

### Pitfall 1: pytest fails in CI because `settings = Settings()` is called at import time and CI env has no `.env` file

**What goes wrong:** `config.py` calls `Settings()` at module level. In CI, no `.env` file exists, so `DATABASE_URL` raises a `ValidationError` before any test fixture runs.

**Why it happens:** `conftest.py` sets `os.environ` before importing `app.main`, which is before `settings = Settings()` runs. The order is fragile — if any module is imported before `conftest.py` runs its `os.environ.setdefault()` calls, the Settings instantiation fails.

**How to avoid:** The existing `conftest.py` already sets all required env vars via `os.environ.setdefault()` at module top (before imports). In the CI workflow YAML, pass all required env vars to the pytest step explicitly as `env:` keys. This is belt-and-suspenders.

**Warning signs:** `pydantic_settings.ValidationError` in the GitHub Actions test step, before any test function runs.

### Pitfall 2: Startup validator blocks test suite because SECRET_KEY = "test-secret-key-for-pytest-only-not-for-production" is treated as a placeholder

**What goes wrong:** A naive check for "default" vs "production" secret might flag the test key.

**Why it happens:** The validator checks a hard-coded set of forbidden values. The test key must NOT be in this set.

**How to avoid:** The forbidden set should contain only the values found in `.env.example` and `generate_secrets.sh` output: `"dev-secret-key-do-not-use-in-production-abc123"` and `"CHANGE_ME"`. The test key is distinct.

**Warning signs:** All 213 tests fail with `ValueError: Startup validation failed` in CI.

### Pitfall 3: Vercel deploys successfully but React Router paths return 404 in production

**What goes wrong:** A user navigates directly to `/students/123/profile` or refreshes the page. Vercel tries to serve a file at that path, finds none, and returns 404.

**Why it happens:** Missing SPA rewrite rule. Without `rewrites: [{ source: "/(.*)", destination: "/index.html" }]`, Vercel treats every path as a file request.

**How to avoid:** The `vercel.json` rewrite rule is mandatory. Verified pattern from Context7.

**Warning signs:** Direct URL access works on localhost (Vite dev server handles it) but fails on production.

### Pitfall 4: Railway start command fails because uvicorn cannot find `app.main:app` from wrong working directory

**What goes wrong:** Railway clones the full repo and the start command runs from the repo root. `app.main` is at `backend/app/main.py`, so the module path resolves incorrectly.

**Why it happens:** Railway's working directory defaults to the repository root unless `rootDirectory` is configured.

**How to avoid:** In Railway service settings, set **Root Directory** to `backend`. Then `uvicorn app.main:app` resolves correctly. Document this in `DEPLOY.md`.

**Warning signs:** Railway deploy log shows `ModuleNotFoundError: No module named 'app'` or `No module named 'app.main'`.

### Pitfall 5: Neon connection fails with SSL error using default psycopg2 dialect

**What goes wrong:** `DATABASE_URL=postgresql+psycopg2://...neon.tech/neondb` (without `?sslmode=require`) causes a connection error because Neon requires TLS.

**Why it happens:** psycopg2 defaults to no SSL. Neon enforces SSL on all connections.

**How to avoid:** Document the required URL format in `DEPLOY.md` and in `.env.example`:
`postgresql+psycopg2://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`

**Warning signs:** `sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) SSL connection has been closed unexpectedly` in Railway logs.

### Pitfall 6: Admin self-delete is possible via API even if UI disables the button

**What goes wrong:** The UI prevents a logged-in admin from clicking "Delete" on their own row, but the API endpoint has no such check.

**Why it happens:** Frontend guards are cosmetic; backend must enforce constraints.

**How to avoid:** The `DELETE /api/v1/admin/users/{user_id}` handler must check `if user_id == str(current_user.id): raise HTTPException(403, "You cannot delete your own account.")`.

**Warning signs:** An admin can delete themselves via curl, leaving no admin account in the system.

### Pitfall 7: Demo seed script fails on re-run because email unique constraint fires

**What goes wrong:** Running `python scripts/seed_demo.py` twice inserts the same demo user emails, causing `IntegrityError: duplicate key value violates unique constraint "uq_users_email"`.

**Why it happens:** Plain `INSERT` without conflict handling.

**How to avoid:** Use fixed stable UUIDs for all demo records. Query by email first (`db.query(User).filter_by(email=DEMO_EMAIL).first()`) and either skip or update. Alternatively, use `INSERT ... ON CONFLICT (email) DO UPDATE`. Per D-10, the script must be idempotent.

**Warning signs:** `sqlalchemy.exc.IntegrityError` on second run.

---

## Code Examples

### Admin User Management Endpoints (new routes)

```python
# Source: Pattern from backend/app/api/v1/routes/admin.py + auth_service.py
# New endpoints under /api/v1/admin/users

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.core.security import get_password_hash
from app.db.models import User
from app.db.session import get_db
from app.core.dependencies import require_role  # new helper

router = APIRouter(prefix="/admin", tags=["admin-v2"])

@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return db.query(User).filter(User.is_active == True).all()

@router.post("/users", status_code=201)
def create_user(payload: UserCreateAdmin, db: Session = Depends(get_db),
                _: User = Depends(require_role("admin"))):
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
        raise HTTPException(409, "A user with this email already exists")
    return user

@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: str, db: Session = Depends(get_db),
                current_user: User = Depends(require_role("admin"))):
    if str(user_id) == str(current_user.id):
        raise HTTPException(403, "You cannot delete your own account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = False
    db.commit()
```

### Demo Seed Script (idempotent)

```python
# Source: Pattern from backend/tests/conftest.py + existing auth_service.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import get_password_hash
import uuid

DEMO_ADMIN_EMAIL = "admin@demo.example"
DEMO_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

def seed_demo(db: Session):
    # Upsert admin user
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
        admin.role = "admin"  # ensure role is correct on re-run
    db.commit()
    print(f"Demo admin: {DEMO_ADMIN_EMAIL}")

if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo(db)
    finally:
        db.close()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nixpacks build system | Railpack (Railway's own) | Recent Railway change | Railpack auto-detects Python; same behavior, different name |
| `routes` in vercel.json (legacy) | `rewrites` in vercel.json | 2022 Vercel docs update | `rewrites` is the correct SPA pattern; `routes` overrides all routing |
| Railway `RAILWAY_API_TOKEN` for CI | `RAILWAY_TOKEN` (project-scoped) | Current Railway CLI docs | Project tokens are preferred for CI; account tokens are overprivileged |

**Deprecated/outdated:**
- Railway's nixpacks: replaced by Railpack internally, though behavior is identical for Python/requirements.txt projects.
- Vercel `routes` array for SPA: replaced by `rewrites`; `routes` disables Vercel's default static asset handling.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `openssl` binary is available in the deployer's shell environment | Pattern 7 (generate_secrets.sh) | Script fails silently; need fallback using Python `secrets` module |
| A2 | Railway's Railpack auto-detects Python from `requirements.txt` in `backend/` | Pattern 4 | May need `runtime.txt` (Python 3.10) or explicit build command in `railway.toml` |
| A3 | Vercel free tier supports the frontend Vite build (no Next.js, no serverless) | Pattern 3 | Extremely low risk — static Vite builds are explicitly supported at all Vercel tiers |
| A4 | The 213 backend pytest tests all pass in CI with SQLite in-memory (no PostgreSQL needed) | Validation Architecture | Confirmed by `conftest.py` — uses `sqlite:///:memory:`. Risk only if new tests added in Phase 6 use PostgreSQL-specific features (JSON operators, etc.) |

---

## Open Questions (RESOLVED)

1. **Vercel project linking in CI**
   - What we know: `vercel deploy --prod` requires `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` env vars in the CI environment.
   - What's unclear: Whether the deployer runs `vercel link` once manually before CI works, or whether these IDs can be injected via GitHub secrets without a prior `vercel link`.
   - Recommendation: The DEPLOY.md should instruct the deployer to run `vercel link` locally once (it writes `.vercel/project.json`) and then add `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` to GitHub secrets. The CI workflow reads from secrets, not from `.vercel/project.json` (which must not be committed).
   - RESOLVED: Instruct deployer to run `vercel link` locally once, then add VERCEL_ORG_ID and VERCEL_PROJECT_ID to GitHub secrets. CI reads from secrets only.

2. **Vercel bundle size gate**
   - What we know: The phase success criterion specifies the output bundle must be under 500MB.
   - What's unclear: Whether the Vite frontend build (React + TipTap + TanStack Query) will actually hit that limit. Vite builds are typically 1-10 MB.
   - Recommendation: The 500MB limit appears to be a concern for the backend (XGBoost + SHAP), not the frontend SPA. It's effectively a non-issue for the Vercel static bundle; the planner should note this so the verification step is not surprising when it passes trivially.
   - RESOLVED: 500MB limit is for Vercel function bundles (not applicable to static SPA). Vite frontend build is typically 1-10 MB. Non-issue for this deployment.

3. **Railway root directory configuration**
   - What we know: `backend/requirements.txt` is the Python project root.
   - What's unclear: Whether the deployer must set Root Directory to `backend/` in the Railway dashboard, or whether a `railway.toml` in the repo root can specify a `rootDirectory` field.
   - Recommendation: Document both approaches in `DEPLOY.md`. The `railway.toml` `rootDirectory` key is the infrastructure-as-code approach; the dashboard setting is the manual fallback.
   - RESOLVED: Document both approaches in DEPLOY.md. Primary: `railway.toml` with `rootDirectory = "backend"`. Fallback: set Root Directory in Railway dashboard.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | ✓ | 24.14.0 | — |
| Python 3.10 | Backend tests | ✓ | 3.10.0 | — |
| PostgreSQL 15 | Local dev | ✓ | 15.17 | — |
| railway CLI | Manual deploy | ✓ | 4.37.4 | Deploy via Railway dashboard |
| vercel CLI | Manual deploy | ✓ (npm global) | 52.0.0 | Deploy via Vercel dashboard |
| openssl | generate_secrets.sh | ✓ (assumed macOS/Linux) | system | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| GitHub Actions runner | CI/CD | ✓ | ubuntu-latest | — |

[VERIFIED: `node --version`, `python3 --version`, `psql --version`, `railway --version`, `npm view vercel version` all confirmed via Bash]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.2.0 |
| Framework (frontend) | vitest 4.x (configured in `vite.config.js`) |
| Config file (backend) | `backend/tests/conftest.py` |
| Config file (frontend) | `frontend/vite.config.js` (test key present) |
| Quick run (backend) | `pytest backend/tests/ -x -q` (from repo root, with env vars) |
| Full suite (backend) | `pytest backend/tests/ -v` |
| Frontend run | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Non-admin user gets 403 on admin-only routes | unit | `pytest backend/tests/test_admin_users.py -x` | ❌ Wave 0 |
| SEC-01 | Admin user gets 200 on admin-only routes | unit | `pytest backend/tests/test_admin_users.py -x` | ❌ Wave 0 |
| SEC-02 | Admin can create user → 201 | unit | `pytest backend/tests/test_admin_users.py::test_create_user -x` | ❌ Wave 0 |
| SEC-02 | Admin can edit user role → 200 | unit | `pytest backend/tests/test_admin_users.py::test_update_user_role -x` | ❌ Wave 0 |
| SEC-02 | Admin cannot delete own account → 403 | unit | `pytest backend/tests/test_admin_users.py::test_self_delete_blocked -x` | ❌ Wave 0 |
| DEP-06 | generate_secrets.sh produces SECRET_KEY (32+ hex chars) | smoke | `bash scripts/generate_secrets.sh /tmp/test.env && grep SECRET_KEY /tmp/test.env` | ❌ Wave 0 |
| DEP-05 | seed_demo.py populates users and students | smoke | `python scripts/seed_demo.py && python -c "..."` (manual verify) | ❌ Wave 0 |
| DEP-04 | App fails to start with placeholder SECRET_KEY | unit | `pytest backend/tests/test_startup_validation.py -x` | ❌ Wave 0 |
| DEP-04 | App fails to start with missing DATABASE_URL | unit | `pytest backend/tests/test_startup_validation.py -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest backend/tests/ -x -q` (backend, ~30s) + `cd frontend && npx vitest run` (frontend, ~10s)
- **Per wave merge:** Full suite: `pytest backend/tests/ -v`
- **Phase gate:** Full backend + frontend suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_admin_users.py` — covers SEC-01, SEC-02 (RBAC enforcement + user management CRUD)
- [ ] `backend/tests/test_startup_validation.py` — covers DEP-04 (hard fail on placeholder secrets)
- [ ] Framework install: no gap — pytest and vitest already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT + bcrypt; no changes needed |
| V3 Session Management | no | JWT stateless; no server-side session |
| V4 Access Control | yes | `require_role("admin")` dependency on admin endpoints; frontend route guard |
| V5 Input Validation | yes | Pydantic schemas on all new admin user endpoints |
| V6 Cryptography | yes | `openssl rand -hex 32` for SECRET_KEY; never hand-roll |

### Known Threat Patterns for FastAPI + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation (counsellor calls admin API) | Elevation of Privilege | `require_role("admin")` FastAPI dependency on all `/admin/users` routes |
| Admin self-delete (no admin remains) | Denial of Service | Backend check: `if user_id == current_user.id → 403` |
| Placeholder SECRET_KEY in production | Information Disclosure | Startup validator in `Settings.__post_init__` / `@model_validator` |
| Neon connection without SSL | Information Disclosure | `?sslmode=require` in DATABASE_URL; documented in DEPLOY.md |
| CORS_ORIGINS set to `*` in production | Spoofing | `CORS_ORIGINS` is a required `CHANGE_ME` in the generated `.env`; startup warning if it contains wildcard |
| Admin API exposed without auth in Vercel preview | Spoofing | Preview frontend points to Railway backend which still enforces JWT; no bypass |

---

## Sources

### Primary (HIGH confidence)
- `backend/app/api/v1/routes/admin.py` — existing `_require_admin` pattern (VERIFIED: read in this session)
- `backend/app/core/config.py` — existing `Settings` class (VERIFIED: read in this session)
- `backend/app/core/dependencies.py` — `get_current_user` dependency (VERIFIED: read in this session)
- `backend/app/db/models.py` — `User` model with `role` column (VERIFIED: read in this session)
- `backend/app/schemas/v2/account.py` — `AccountResponse` includes `role` (VERIFIED: read in this session)
- `backend/tests/conftest.py` — test env var setup and SQLite fixture (VERIFIED: read in this session)
- Context7 `/websites/vercel` — SPA rewrite pattern for Vite (VERIFIED: fetched in this session)
- Context7 `/websites/railway` — start command and PORT injection (VERIFIED: fetched in this session)
- Context7 `/websites/github_en_actions` — CI workflow patterns for pytest + vitest (VERIFIED: fetched in this session)
- Context7 `/pydantic/pydantic-settings` — `@model_validator` startup validation (VERIFIED: fetched in this session)
- `neon.com/docs/guides/python` — `?sslmode=require` requirement (VERIFIED: fetched in this session)

### Secondary (MEDIUM confidence)
- Railway FastAPI guide (`docs.railway.com/guides/fastapi`) — start command, Railpack auto-detection (CITED)
- Railway config-as-code reference (`docs.railway.com/config-as-code/reference`) — `railway.toml` schema (CITED)

### Tertiary (LOW confidence)
- [ASSUMED A1] `openssl` binary presence in all deployer environments
- [ASSUMED A2] Railpack auto-detects Python without a `runtime.txt`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use in the codebase; verified versions
- Architecture (RBAC): HIGH — existing dependency pattern, existing User model with role column
- Architecture (Deployment): HIGH — Vercel/Railway/GitHub Actions patterns verified via Context7 and official docs
- Pitfalls: HIGH — all pitfalls derived from real code analysis (conftest.py, config.py, vercel.json pattern analysis)
- Demo seed: MEDIUM — pattern is clear; exact data content is Claude's discretion (D-09)

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable deployment docs; Vercel/Railway APIs are stable)
