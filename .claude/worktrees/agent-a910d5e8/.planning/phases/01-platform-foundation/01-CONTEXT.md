# Phase 1: Platform Foundation - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Modularize the codebase into a config-driven entity layer with domain modules, consolidate v1/v2 APIs into a single version, extract all HKDSE-specific logic into `modules/school_choice/`, fix infrastructure-level bugs (BUG-01 through BUG-05), and add startup diagnostics + health endpoint. All 60 existing backend tests must pass at every commit throughout.

</domain>

<decisions>
## Implementation Decisions

### Entity YAML Config Format
- **D-01:** Entity definitions use YAML with fields + types + validation (no relationships in YAML — relationships handled in code)
- **D-02:** Supported field types: string, text, int, decimal, date, datetime, enum, boolean, jsonb
- **D-03:** Validation rules in YAML: required/optional, min/max, max_length, regex, choices (for enum)
- **D-04:** JSONB is a first-class field type — stores arbitrary JSON, no schema validation in YAML; domain modules validate JSONB structure in their own service code
- **D-05:** Entity YAML files live inside their domain module: `modules/school_choice/entities/student.yaml`
- **D-06:** Auto-generated CRUD endpoints return all fields by default. Modules can override with custom endpoints when filtered responses are needed.

### Module Structure & Discovery
- **D-07:** Manifest-based auto-discovery — each module has a `config.yaml` declaring name, entities, routes, and services. Platform scans `backend/app/modules/` at startup and registers everything automatically.
- **D-08:** Modules live at `backend/app/modules/<domain_name>/` — inside the existing app package so they can import from `app.core`, `app.db` directly
- **D-09:** Each module defines its own SQLAlchemy models (own tables only). Links to platform tables (User) via foreign keys but never modifies platform models.
- **D-10:** Module structure is backend-only in Phase 1. Frontend stays in `frontend/src/` as-is. Frontend modularization deferred to Phase 3.

### API Consolidation
- **D-11:** Consolidate into `/api/v1` prefix (the API was never public). Merge the best of v2 logic into v1 routes, delete v2 route files and v2-only schemas.
- **D-12:** Platform auto-generates CRUD endpoints from entity YAML (GET list, POST, GET by ID, PUT, DELETE) under `/api/v1/{entity_name}/`. Modules add custom routes that extend or override auto-generated ones.

### Migration & Extraction
- **D-13:** Incremental strangler fig approach — move one service at a time into `modules/school_choice/`. Run all 60 tests after each move. Order: hkdse_service → matchmaker_v2 → plan_generator → plan_chat_service. Core imports redirect to module paths.
- **D-14:** ORM models split into platform + module: User and Base stay in `backend/app/db/models.py`. All domain-specific models (Student, School, AcademicPlan, Subject, StudentSubjectGrade, StudentSchoolTarget, etc.) move into `modules/school_choice/models/`. The v1/v2 model split is resolved.
- **D-15:** Health endpoint at `GET /health` reports: DB status, CORS origin, schema parity check result, and per-module health. Each module can register a health check function (school_choice reports XGBoost model status). ORM-schema parity check runs at startup and logs warnings.

### Claude's Discretion
- Exact YAML parsing library choice (PyYAML vs ruamel.yaml vs pydantic-yaml)
- Internal structure of the entity registry (how auto-generated models are stored in memory)
- How import redirects work during incremental migration (re-exports vs path updates)
- ORM-schema parity check implementation details
- Bug fix implementation specifics (BUG-01 through BUG-05) — these are well-defined in requirements

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Platform Requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 1 covers PLAT-01, PLAT-02, PLAT-04, PLAT-05, PLAT-06, PLAT-07, PLAT-08, SEC-03, SEC-04, SEC-05, BUG-01 through BUG-05
- `.planning/PROJECT.md` — Project vision, constraints (no Docker, stack continuity, non-technical users)
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria (5 criteria that must be TRUE)

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — Current architecture: layers, data flow, key abstractions
- `.planning/codebase/STRUCTURE.md` — Directory layout, where to add new code, key file locations
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, import organization

### Existing Code (key files to understand before modifying)
- `backend/app/main.py` — FastAPI app init, routing, seeding, startup logic
- `backend/app/db/models.py` — v1 ORM models (User, Student, School)
- `backend/app/db/models_v2.py` — v2 ORM models (AcademicPlan, Subject, etc.)
- `backend/app/core/config.py` — Pydantic BaseSettings for env vars
- `backend/app/services/` — All service files that need extraction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/core/config.py` — Pydantic BaseSettings pattern can be extended for module config loading
- `backend/app/core/dependencies.py` — `get_current_user` and `get_db` dependencies reused by all module routes
- `backend/app/core/security.py` — JWT + bcrypt auth stays platform-level, used by all modules

### Established Patterns
- FastAPI router registration via `app.include_router()` in main.py — module routes follow the same pattern
- SQLAlchemy declarative Base with shared metadata — module models extend the same Base
- Pydantic schemas for request/response validation — auto-generated CRUD follows the same pattern
- Background task processing via FastAPI BackgroundTasks — plan generation uses this

### Integration Points
- `backend/app/main.py` — Module discovery and registration happens here at startup
- `backend/app/db/session.py` — Shared database session factory, module models use the same engine
- `backend/app/api/v1/routes/` — Module custom routes registered alongside auto-generated CRUD
- `backend/tests/` — All 60 tests must remain green; test imports may need updating as code moves

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-platform-foundation*
*Context gathered: 2026-04-24*
