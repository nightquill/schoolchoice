# Phase 6: Deployment and Production Readiness - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Production deployment pipeline and operational readiness. Vercel frontend with CI/CD, Railway backend hosting, Neon PostgreSQL, secrets management with startup validation, RBAC enforcement for admin/staff roles, and a demo seed script that makes the app immediately usable. The deliverable is a repo that a developer can clone and have running in production within an hour.

</domain>

<decisions>
## Implementation Decisions

### RBAC Enforcement
- **D-01:** Keep existing role values (`counsellor` and `admin`) — no renaming. Domain modules can alias the display label in the UI if needed (e.g., display "Staff" instead of "Counsellor" in a non-school deployment).
- **D-02:** Admin-only routes limited to user management — create/edit/delete users and assign roles. All other features (entity CRUD, consultant tasks, import/export, data refresh) remain available to all authenticated users.
- **D-03:** Admin user management UI lives as a "Users" tab on a Settings page. Table with create/edit/delete actions. Nav link or tab hidden for non-admin users.

### Deployment Target
- **D-04:** Frontend deployed to Vercel. Backend deployed to Railway (primary and only documented host). No Vercel serverless for backend — FastAPI + XGBoost + SHAP is too heavy for function size limits.
- **D-05:** Production database is Neon (managed PostgreSQL). Document Neon setup only — no Railway DB or alternative DB docs. User connects via DATABASE_URL env var.
- **D-06:** Full CI/CD pipeline via GitHub Actions. Runs pytest + vitest as quality gate, then deploys frontend to Vercel and backend to Railway on success. Preview deploys on PR, production on main merge.

### Secrets & Environment Management
- **D-07:** `generate_secrets.sh` auto-generates cryptographic secrets (SECRET_KEY, etc.) and leaves service-specific values (DATABASE_URL, AI_API_KEY, CORS_ORIGINS) as clearly-marked `CHANGE_ME` placeholders. Non-interactive script.
- **D-08:** Hard fail on critical vars at startup — app refuses to start if SECRET_KEY is the default placeholder or DATABASE_URL is missing. Prints exactly which vars need attention. AI_API_KEY can be empty (AI features degrade gracefully). Non-critical vars get warnings but don't block startup.

### Demo Seed Script
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — Phase 6 covers SEC-01, SEC-02, DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06
- `.planning/PROJECT.md` — Constraints: no Docker, non-technical primary users, stack continuity (FastAPI + React + PostgreSQL)
- `.planning/ROADMAP.md` — Phase 6 goal and 5 success criteria

### Prior Phase Decisions (carry forward)
- `.planning/phases/04-import-and-export/04-CONTEXT.md` — Entity list patterns, action bar design, HTML export
- `.planning/phases/05-consultant-engine/05-CONTEXT.md` — SSE streaming, consultant task YAML, recommendation engine

### Existing Auth & RBAC Code (must read before modifying)
- `backend/app/db/models.py` — User model with `role` column (line ~93): `counsellor` | `admin`
- `backend/app/api/v1/routes/admin.py` — Existing `_require_admin` dependency, admin-only route pattern
- `backend/app/core/dependencies.py` — `get_current_user` JWT dependency

### Existing Environment & Seed Data
- `backend/.env.example` — Current env var template (DATABASE_URL, SECRET_KEY, AI_PROVIDER, AI_API_KEY, CORS_ORIGINS)
- `database/seed_data.sql` — Original seed data
- `database/seed_data_v2.sql` — Updated seed data
- `data/seed/seed_subjects.sql` — Subject reference data
- `data/seed/seed_schools.sql` — School reference data

### Codebase Maps
- `.planning/codebase/STACK.md` — Current tech stack (FastAPI 0.111, React 19, Vite 8, SQLAlchemy 2.0)
- `.planning/codebase/ARCHITECTURE.md` — Architecture layers and data flow
- `.planning/codebase/STRUCTURE.md` — Directory layout

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_require_admin` dependency in `admin.py` — existing admin role gate pattern; extend to a reusable `require_role()` dependency
- `get_current_user` in `dependencies.py` — JWT auth dependency; already returns User with role field
- `backend/.env.example` — base for generate_secrets.sh template; extend with production vars
- `database/seed_data.sql` + `data/seed/*.sql` — existing reference data to incorporate into seed_demo.py
- Existing Settings page pattern (if any) or shadcn/ui Tabs component for admin user management UI

### Established Patterns
- FastAPI `Depends()` for route-level auth — extend with role-aware dependency
- SQLAlchemy model with role column — no schema changes needed
- Existing admin routes under `/admin` prefix with `_require_admin` dependency

### Integration Points
- `backend/app/main.py` — Add startup validation for required env vars
- `backend/app/api/v1/routes/` — New user management endpoints under admin prefix
- `frontend/src/pages/` — New Settings page with Users tab (admin only)
- `frontend/src/App.jsx` — Route guard for admin-only pages
- `.github/workflows/` — New CI/CD workflow file
- `scripts/generate_secrets.sh` — New script
- `scripts/seed_demo.py` — New script
- `vercel.json` — Frontend deployment config

</code_context>

<specifics>
## Specific Ideas

- The app should feel "lived in" for demos — not just empty reference data, but sample students with actual grades, activities, and at least one pre-generated academic plan
- CI/CD is a first-class deliverable, not an afterthought — full quality gate (tests pass) before any deploy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-deployment-and-production-readiness*
*Context gathered: 2026-04-28*
