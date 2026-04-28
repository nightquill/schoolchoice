# Phase 6: Deployment and Production Readiness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 06-deployment-and-production-readiness
**Areas discussed:** RBAC enforcement, Deployment target, Secrets & env management, Demo seed script

---

## RBAC Enforcement

### Role naming

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 'counsellor' | Matches existing data, avoids migration. Domain modules can alias in UI | ✓ |
| Rename to 'staff' | More platform-appropriate. Requires DB migration | |
| Both + extensible | Rename default to 'staff', make roles configurable per domain via YAML | |

**User's choice:** Keep 'counsellor'
**Notes:** None

### Admin-only routes

| Option | Description | Selected |
|--------|-------------|----------|
| User management only | Admin-only: create/edit/delete users, assign roles. Everything else available to all authenticated users | ✓ |
| User mgmt + system config | Admin-only: user management + system-level operations (data refresh, seed, health) | |
| Granular per-route | Define admin vs counsellor access per route group in config | |

**User's choice:** User management only
**Notes:** None

### Admin UI location

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page tab | Add 'Users' tab to Settings page. Admin features grouped. Simple table with CRUD | ✓ |
| Dedicated /admin page | Standalone admin page at /admin/users, hidden for non-admins | |
| Nav section | 'Admin' section in sidebar that expands to show Users | |

**User's choice:** Settings page tab
**Notes:** None

---

## Deployment Target

### Backend host

| Option | Description | Selected |
|--------|-------------|----------|
| Railway (Recommended) | Container deploy for Python. No bundle limits. Procfile-based | ✓ |
| Render | Similar to Railway. Docker or native Python. Free tier available | |
| Vercel serverless | Requires restructuring FastAPI. XGBoost/SHAP may exceed limits | |
| Document all three | Provide docs for all three as options | |

**User's choice:** Railway (Recommended)
**Notes:** None

### Production database

| Option | Description | Selected |
|--------|-------------|----------|
| Neon only | Document Neon setup. One path. Free tier. Serverless Postgres | ✓ |
| Neon primary, Railway DB noted | Primary docs for Neon, note that Railway PostgreSQL also works | |
| Either, env-driven | No preference — any PostgreSQL via DATABASE_URL | |

**User's choice:** Neon only
**Notes:** None

### Frontend CI/CD

| Option | Description | Selected |
|--------|-------------|----------|
| vercel.json + docs | Build config + deployment docs. Manual deploys via git push | |
| Just docs, no vercel.json | Vercel auto-detects Vite. Document steps only | |
| Full CI/CD pipeline | GitHub Actions: build + deploy. Preview on PR, production on main | ✓ |

**User's choice:** Full CI/CD pipeline
**Notes:** None

### CI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend only | GitHub Actions for Vercel. Railway uses built-in git-push auto-deploy | |
| Both frontend + backend | Single workflow handles Vercel + Railway CLI deploy | |
| Both + tests | CI runs pytest + vitest first, deploys both on success. Full quality gate | ✓ |

**User's choice:** Both + tests
**Notes:** None

---

## Secrets & Environment Management

### generate_secrets.sh behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Generate crypto, prompt for services | Auto-generate SECRET_KEY. Interactive prompts for DATABASE_URL, AI_API_KEY | |
| Generate crypto, leave placeholders | Auto-generate SECRET_KEY. Leave service values as CHANGE_ME placeholders. Non-interactive | ✓ |
| Template copy only | Copy .env.example to .env with warning banner. User fills everything | |

**User's choice:** Generate crypto, leave placeholders
**Notes:** None

### Startup validation strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Hard fail on critical vars | Refuse to start if SECRET_KEY is placeholder or DATABASE_URL missing. AI_API_KEY can be empty | ✓ |
| Hard fail on all required | Refuse to start if ANY required var is missing or placeholder | |
| Warn but start | Print warnings for placeholders but still start | |

**User's choice:** Hard fail on critical vars
**Notes:** None

---

## Demo Seed Script

### Seed data scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full demo scenario | Admin + counsellor users, 3-5 students with grades/activities, schools + subjects, pre-generated plan | ✓ |
| Minimal viable demo | Admin + counsellor, schools + subjects, 1 basic student | |
| Users + reference data only | Demo users and reference data only. No sample students | |

**User's choice:** Full demo scenario
**Notes:** None

### Idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, upsert pattern | Check if demo data exists before inserting. Updates existing, never duplicates | ✓ |
| Yes, wipe and recreate | Drop demo data first, then re-seed. Clean slate but destructive | |
| No, run-once only | Fails if demo data exists. Fresh deployments only | |

**User's choice:** Yes, upsert pattern
**Notes:** None

---

## Claude's Discretion

- GitHub Actions workflow structure and job dependencies
- Railway deployment configuration (Procfile, nixpacks, or Dockerfile)
- Vercel project configuration (vercel.json structure, build settings)
- Neon connection pooling and SSL configuration
- Startup validation implementation approach
- Settings page UI layout and component structure
- Demo student data content (realistic but fictional)
- How existing seed SQL files are incorporated into seed_demo.py
- CORS_ORIGINS handling for production

## Deferred Ideas

None — discussion stayed within phase scope
