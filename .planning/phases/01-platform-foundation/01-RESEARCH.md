# Phase 1: Platform Foundation - Research

**Researched:** 2026-04-24
**Domain:** FastAPI modular architecture, YAML-driven entity layer, Python refactoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Entity YAML Config Format**
- D-01: Entity definitions use YAML with fields + types + validation (no relationships in YAML — relationships handled in code)
- D-02: Supported field types: string, text, int, decimal, date, datetime, enum, boolean, jsonb
- D-03: Validation rules in YAML: required/optional, min/max, max_length, regex, choices (for enum)
- D-04: JSONB is a first-class field type — stores arbitrary JSON, no schema validation in YAML; domain modules validate JSONB structure in their own service code
- D-05: Entity YAML files live inside their domain module: `modules/school_choice/entities/student.yaml`
- D-06: Auto-generated CRUD endpoints return all fields by default. Modules can override with custom endpoints when filtered responses are needed.

**Module Structure & Discovery**
- D-07: Manifest-based auto-discovery — each module has a `config.yaml` declaring name, entities, routes, and services. Platform scans `backend/app/modules/` at startup and registers everything automatically.
- D-08: Modules live at `backend/app/modules/<domain_name>/` — inside the existing app package so they can import from `app.core`, `app.db` directly
- D-09: Each module defines its own SQLAlchemy models (own tables only). Links to platform tables (User) via foreign keys but never modifies platform models.
- D-10: Module structure is backend-only in Phase 1. Frontend stays in `frontend/src/` as-is. Frontend modularization deferred to Phase 3.

**API Consolidation**
- D-11: Consolidate into `/api/v1` prefix (the API was never public). Merge the best of v2 logic into v1 routes, delete v2 route files and v2-only schemas.
- D-12: Platform auto-generates CRUD endpoints from entity YAML (GET list, POST, GET by ID, PUT, DELETE) under `/api/v1/{entity_name}/`. Modules add custom routes that extend or override auto-generated ones.

**Migration & Extraction**
- D-13: Incremental strangler fig approach — move one service at a time into `modules/school_choice/`. Run all 60 tests after each move. Order: hkdse_service → matchmaker_v2 → plan_generator → plan_chat_service. Core imports redirect to module paths.
- D-14: ORM models split into platform + module: User and Base stay in `backend/app/db/models.py`. All domain-specific models (Student, School, AcademicPlan, Subject, StudentSubjectGrade, StudentSchoolTarget, etc.) move into `modules/school_choice/models/`. The v1/v2 model split is resolved.
- D-15: Health endpoint at `GET /health` reports: DB status, CORS origin, schema parity check result, and per-module health. Each module can register a health check function (school_choice reports XGBoost model status). ORM-schema parity check runs at startup and logs warnings.

### Claude's Discretion
- Exact YAML parsing library choice (PyYAML vs ruamel.yaml vs pydantic-yaml)
- Internal structure of the entity registry (how auto-generated models are stored in memory)
- How import redirects work during incremental migration (re-exports vs path updates)
- ORM-schema parity check implementation details
- Bug fix implementation specifics (BUG-01 through BUG-05) — these are well-defined in requirements

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Developer can define entities via YAML config without writing Python models | Entity registry pattern with PyYAML + SQLAlchemy dynamic model generation |
| PLAT-02 | Platform auto-generates CRUD API endpoints from entity config at startup | FastAPI router factory; dynamic endpoint generation at app startup |
| PLAT-04 | Developer can create a domain module as a self-contained folder | Module folder structure with config.yaml manifest |
| PLAT-05 | Domain module registers itself via manifest; platform discovers and loads at startup | importlib.import_module + directory scan at startup in main.py |
| PLAT-06 | School choice app functions as a domain module with all existing features preserved | Strangler fig: incremental extraction with test guard (60 tests green at every commit) |
| PLAT-07 | v1/v2 API routes consolidated into a single clean API layer | Merge schemas/v2 into schemas/, delete route duplication, single `/api/v1` prefix |
| PLAT-08 | ORM-schema parity check runs at startup and logs warnings for drift | SQLAlchemy `inspect()` against `information_schema` columns |
| SEC-03 | Health check reports: DB status, AI provider configured, ML model loaded, background jobs status | `/health` endpoint extended; module health callbacks registered at discovery |
| SEC-04 | CORS origins configurable via environment variable (not hardcoded) | Already implemented via `settings.CORS_ORIGINS`; verify and document |
| SEC-05 | All user-provided content HTML-escaped in generated reports (XSS prevention) | Audit `plan_generator.py` f-strings for bare `{var}` embedding without `_esc()` |
| BUG-01 | Chat rate limiting uses rolling 24-hour window instead of date strings | Change key from `date.today().isoformat()` prefix to `datetime.utcnow() - 24h` window |
| BUG-02 | Matchmaker shows eligibility confidence indicator for incomplete data | Add `data_completeness` field to MatchResult; compute fraction of subject grades present |
| BUG-03 | School name duplication resolved in API responses | `Recommendation.school_name` is denormalized; JOIN to `schools.name` as single source |
| BUG-04 | HTML escaping applied consistently in plan generator for all user-provided strings | Wrap unescaped `{subj}`, `{task}`, `{school}` etc. in `_esc()` calls |
| BUG-05 | XGBoost model fallback logs a warning at startup and reports status via health endpoint | Call `_get_model()` at startup, `logging.warning()` if None, expose in `/health` |

</phase_requirements>

---

## Summary

Phase 1 is a structural refactoring of the existing FastAPI + SQLAlchemy codebase. No new user-visible features are being built — the goal is to establish a modular platform foundation that all future phases depend on. The work falls into four discrete categories: (1) entity YAML config layer + CRUD auto-generation, (2) domain module extraction via strangler fig, (3) API consolidation, and (4) infrastructure bug fixes plus health/diagnostic improvements.

The codebase is well-understood from direct inspection. The existing 60 backend tests (5 auth + 22 routes + 33 services = 60 as of v2.2) use SQLite in-memory and must remain green at every commit. The primary refactoring risk is import chain disruption — services are imported directly by routes, and moving them requires careful re-export scaffolding before the actual move. The tests import from `app.services.*` paths directly; those import paths must remain stable until tests are updated.

The entity YAML layer is new greenfield work within the same codebase. PyYAML 6.0 is already installed in the environment (not yet in requirements.txt — needs adding). The dynamic SQLAlchemy model and FastAPI router generation pattern is standard and well-documented.

**Primary recommendation:** Execute the five work streams in this order: (1) bug fixes first (lowest risk, highest confidence), (2) health endpoint extension, (3) entity YAML + auto-CRUD (isolated new feature), (4) API consolidation, (5) module extraction. This order ensures the test suite remains green at every step and that each stream can be validated independently.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entity YAML parsing + registry | API / Backend | — | Pure backend concern; entities define DB schema and API endpoints |
| Module discovery + registration | API / Backend | — | Startup-time scanning and router registration in main.py |
| Auto-generated CRUD endpoints | API / Backend | — | FastAPI router factory at startup; no frontend impact in Phase 1 |
| Domain model extraction (school_choice) | API / Backend | Database / Storage | Models move to module folder; same PostgreSQL tables |
| API v1/v2 consolidation | API / Backend | — | Route and schema file reorganization; no DB changes |
| ORM-schema parity check | API / Backend | Database / Storage | Inspect DB at startup vs mapped ORM columns |
| Health endpoint extension | API / Backend | — | GET /health enriched with module callbacks |
| Bug fixes (BUG-01 to BUG-05) | API / Backend | — | All bugs are in backend service layer |
| CORS configuration (SEC-04) | API / Backend | — | Already env-driven; verification only |
| XSS prevention in plan generator (SEC-05) | API / Backend | — | HTML escaping in plan_generator.py service |

---

## Standard Stack

### Core (already installed, verified in environment)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.111.0 | HTTP framework, router factory | Project-established; auto-generates OpenAPI docs |
| SQLAlchemy | 2.0.30 | ORM + schema inspection | Project-established; `inspect()` API for parity checks |
| Pydantic v2 | 2.7.1 | Schema validation, settings | Project-established; entity validation models |
| pydantic-settings | 2.2.1 | BaseSettings for env vars | Project-established; config.py pattern |
| PyYAML | 6.0 | YAML entity config parsing | Already installed; `yaml.safe_load()` is safe and sufficient |
| Python logging | stdlib | Startup diagnostics | No external dep needed; standard `logging.getLogger()` |

[VERIFIED: direct pip3 show and codebase inspection]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ruamel.yaml | 0.17.21 | Advanced YAML parsing | Only if round-trip comment preservation is needed — not required here |
| importlib | stdlib | Dynamic module import for module discovery | `importlib.import_module()` in platform scanner |
| pathlib | stdlib | Directory scanning | `Path('backend/app/modules').iterdir()` for module discovery |

[VERIFIED: pip3 show in environment]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyYAML 6.0 | ruamel.yaml | ruamel.yaml preserves comments on round-trip but adds complexity; PyYAML is sufficient for read-only entity config |
| PyYAML 6.0 | pydantic-yaml | pydantic-yaml adds another dependency; validating YAML structure with plain Pydantic models is cleaner |
| SQLAlchemy `inspect()` for parity | Alembic autogenerate | Alembic autogenerate is for migrations; `inspect()` for startup-only drift detection is lighter |

**Installation (add to requirements.txt — PyYAML already present in env but not in file):**
```bash
pip install pyyaml==6.0
```

Note: `pyyaml==6.0` is not currently in `backend/requirements.txt`. It must be added. [VERIFIED: grep requirements.txt shows no yaml entry]

---

## Architecture Patterns

### System Architecture Diagram

```
Startup flow (main.py)
│
├── Platform Scanner
│   ├── Scan backend/app/modules/*/config.yaml
│   ├── Load entity YAML files from each module
│   ├── Build EntityRegistry (entity_name → SQLAlchemy model + Pydantic schemas)
│   ├── Generate CRUD routers per entity
│   └── Register module health callbacks
│
├── Module Registration
│   ├── Include auto-generated CRUD routers → /api/v1/{entity}/
│   ├── Include module custom routers (school_choice routes)
│   └── Replace old imports: app.services.* → app.modules.school_choice.*
│
├── ORM Parity Check
│   └── SQLAlchemy inspect() vs DB information_schema → log warnings
│
└── Health Endpoint (GET /health)
    ├── DB connectivity check
    ├── CORS origin in use (from settings)
    ├── Schema parity result (from startup check)
    └── Per-module health (school_choice: XGBoost model status)

Request flow (/api/v1/*)
Browser → FastAPI Router
    → Auto-CRUD handler (entity registry lookup)
        OR custom module route (school_choice routes)
    → SQLAlchemy session (get_db dependency)
    → PostgreSQL
```

### Recommended Project Structure (post-Phase 1)

```
backend/app/
├── main.py                        # Updated: platform scanner, module loader
├── core/
│   ├── config.py                  # Unchanged
│   ├── security.py                # Unchanged
│   ├── dependencies.py            # Unchanged
│   └── entity_registry.py        # NEW: EntityRegistry class
├── platform/
│   ├── __init__.py
│   ├── module_loader.py           # NEW: scans modules/, loads config.yaml, registers routers
│   ├── crud_generator.py          # NEW: generates FastAPI CRUD routes from EntityConfig
│   ├── yaml_loader.py             # NEW: parses entity YAML → EntityConfig dataclass
│   └── health.py                  # NEW: health check orchestrator
├── db/
│   ├── models.py                  # TRIMMED: User + Base only
│   ├── models_v2.py               # DELETED after migration
│   └── session.py                 # Unchanged
├── api/v1/routes/                 # Unchanged for platform routes
│   ├── auth.py                    # Unchanged
│   └── (legacy routes deleted or redirected)
├── schemas/                       # v2/ subdirectory merged into here
└── modules/
    └── school_choice/
        ├── config.yaml            # Module manifest
        ├── entities/
        │   ├── student.yaml
        │   ├── school.yaml
        │   └── (other entities)
        ├── models/
        │   ├── __init__.py
        │   └── models.py          # Student, School, AcademicPlan, etc.
        ├── routes/
        │   ├── students.py
        │   ├── plan.py
        │   ├── match.py
        │   └── (all current routes that are HKDSE-specific)
        ├── services/
        │   ├── hkdse_service.py
        │   ├── matchmaker_v2.py
        │   ├── plan_generator.py
        │   └── plan_chat_service.py
        ├── schemas/
        │   └── (v2 schemas moved here)
        └── health.py              # school_choice health callback (XGBoost status)
```

### Pattern 1: YAML Entity Config → Dynamic SQLAlchemy Model

**What:** Parse entity YAML at startup, generate a SQLAlchemy mapped class and Pydantic schemas dynamically. Register in EntityRegistry keyed by entity name.

**When to use:** Every entity defined in YAML. The registry is the authoritative source during request handling for auto-CRUD endpoints.

**Example:**
```python
# Source: SQLAlchemy 2.0 docs — dynamic mapped classes
# backend/app/platform/crud_generator.py

import yaml
from pathlib import Path
from sqlalchemy import Column, String, Integer, Text, Boolean, Date, DateTime, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase
from pydantic import BaseModel, create_model
from fastapi import APIRouter, Depends
from typing import Any, Optional
import uuid

FIELD_TYPE_MAP = {
    "string":   lambda: Column(String(255), nullable=True),
    "text":     lambda: Column(Text, nullable=True),
    "int":      lambda: Column(Integer, nullable=True),
    "decimal":  lambda: Column(Numeric(10, 4), nullable=True),
    "date":     lambda: Column(Date, nullable=True),
    "datetime": lambda: Column(DateTime(timezone=True), nullable=True),
    "boolean":  lambda: Column(Boolean, nullable=True, default=False),
    "jsonb":    lambda: Column(JSON, nullable=True),
    # enum handled separately: Column(String(50)) with CheckConstraint
}

def load_entity_config(yaml_path: Path) -> dict:
    with open(yaml_path) as f:
        return yaml.safe_load(f)

def build_pydantic_schema(entity_config: dict, schema_name: str) -> type[BaseModel]:
    """Build a Pydantic model from entity config dict."""
    fields: dict[str, Any] = {}
    for field in entity_config.get("fields", []):
        name = field["name"]
        ftype = field.get("type", "string")
        required = field.get("required", False)
        # Map YAML type → Python type
        py_type = {"string": str, "text": str, "int": int, "decimal": float,
                   "date": str, "datetime": str, "boolean": bool,
                   "jsonb": Any, "enum": str}.get(ftype, str)
        if required:
            fields[name] = (py_type, ...)
        else:
            fields[name] = (Optional[py_type], None)
    return create_model(schema_name, **fields)
```

[CITED: https://docs.sqlalchemy.org/en/20/orm/declarative_config.html]

### Pattern 2: Module Manifest Auto-Discovery

**What:** At startup, scan `backend/app/modules/` for directories containing `config.yaml`. Load each config, import the module's router, register it with the FastAPI app.

**When to use:** All modules. The manifest approach means zero changes to `main.py` when new modules are added.

**Example:**
```python
# Source: Python importlib docs + FastAPI include_router pattern
# backend/app/platform/module_loader.py

import importlib
import yaml
from pathlib import Path
from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)

def discover_and_register_modules(app: FastAPI, modules_dir: Path) -> list[dict]:
    """Scan modules_dir, load each module's config.yaml, register routers."""
    registered = []
    for module_dir in sorted(modules_dir.iterdir()):
        config_path = module_dir / "config.yaml"
        if not config_path.exists():
            continue
        with open(config_path) as f:
            config = yaml.safe_load(f)
        module_name = config["name"]
        # Import module router package
        import_path = f"app.modules.{module_dir.name}.routes"
        try:
            routes_pkg = importlib.import_module(import_path)
            for router_attr in config.get("routes", []):
                router = getattr(routes_pkg, router_attr)
                app.include_router(router, prefix="/api/v1")
            registered.append({"name": module_name, "status": "ok"})
            logger.info(f"Module registered: {module_name}")
        except Exception as e:
            logger.error(f"Module load failed: {module_name} — {e}")
            registered.append({"name": module_name, "status": "error", "detail": str(e)})
    return registered
```

[CITED: https://docs.python.org/3/library/importlib.html]

### Pattern 3: Module config.yaml Manifest Format

**What:** Declarative manifest that tells the platform loader everything it needs to register the module.

**Example:**
```yaml
# backend/app/modules/school_choice/config.yaml
name: school_choice
version: "1.0"
entities:
  - entities/student.yaml
  - entities/school.yaml
routes:
  # Attribute names on the routes package to include_router
  - students.router
  - plan.router
  - match.router
  - grades.router
  - targets.router
  - schools.router
  - subjects.router
  - transcripts.router
  - cohorts.router
  - analytics.router
  - admin.router
  - account.router
  - action_plan.router
  - recommendations.router
health_callback: "app.modules.school_choice.health:check_health"
```

### Pattern 4: Entity YAML Format

**What:** Declarative entity definition. Platform generates SQLAlchemy model + Pydantic schemas + CRUD router.

**Example:**
```yaml
# backend/app/modules/school_choice/entities/student.yaml
name: student
table: students   # explicit table name (maps to existing table)
fields:
  - name: name
    type: string
    required: true
    max_length: 255
  - name: target_region
    type: enum
    choices: [local, international]
    required: true
  - name: grades
    type: jsonb
  - name: ielts_score
    type: jsonb
  - name: notes
    type: text
```

### Pattern 5: ORM-Schema Parity Check

**What:** At startup, compare SQLAlchemy model column names against actual DB table columns via `inspect()`. Log warnings for any drift (columns in DB not in model, or columns in model not in DB).

**When to use:** Once at startup, before seeding. Warns but does not block startup.

**Example:**
```python
# Source: SQLAlchemy inspection API docs
# backend/app/platform/health.py

from sqlalchemy import inspect as sa_inspect
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

def check_orm_schema_parity(engine: Engine, orm_models: list) -> dict:
    """Compare ORM column definitions against live DB schema."""
    inspector = sa_inspect(engine)
    issues = []
    for model in orm_models:
        table_name = model.__tablename__
        if not inspector.has_table(table_name):
            issues.append(f"Table missing in DB: {table_name}")
            continue
        db_cols = {c["name"] for c in inspector.get_columns(table_name)}
        orm_cols = {c.key for c in model.__table__.columns}
        missing_in_db = orm_cols - db_cols
        extra_in_db = db_cols - orm_cols
        if missing_in_db:
            issues.append(f"{table_name}: ORM has columns not in DB: {missing_in_db}")
        if extra_in_db:
            logger.debug(f"{table_name}: DB has extra columns not in ORM: {extra_in_db}")
    for issue in issues:
        logger.warning(f"[SCHEMA PARITY] {issue}")
    return {"status": "drift_detected" if issues else "ok", "issues": issues}
```

[CITED: https://docs.sqlalchemy.org/en/20/core/reflection.html]

### Pattern 6: Import Redirect for Strangler Fig Migration

**What:** During incremental service extraction, old import paths continue to work by re-exporting from the new location. This keeps the 60 tests green without mass-updating import paths.

**When to use:** During each service move. After full extraction, old files can be deleted.

**Example:**
```python
# backend/app/services/hkdse_service.py  (becomes a thin re-export)
# After hkdse_service is moved to modules/school_choice/services/

from app.modules.school_choice.services.hkdse_service import *  # noqa: F401, F403
# All existing imports from app.services.hkdse_service continue to work
```

[ASSUMED: This pattern is standard Python but not yet confirmed against test import paths in this codebase specifically. Test files import directly from `app.services.*` paths.]

### Anti-Patterns to Avoid

- **Dynamic SQLAlchemy models with `type()` without `__tablename__`**: Generated models must include `__tablename__` and the `Base` to register with metadata. Missing either causes `MetaData` registration errors at `create_all()`.
- **`yaml.load()` without Loader**: Always use `yaml.safe_load()`. `yaml.load()` without an explicit Loader raises a warning in PyYAML 6.0 and is a security risk with untrusted input.
- **Importing module routes before module models are registered**: SQLAlchemy relationships fail with `NoInspectionAvailable` if models are imported before their Base is registered. The module loader must import models before routes.
- **Re-exporting `*` from multiple modules with name collisions**: If two modules export the same name, the last `import *` wins silently. Use explicit named re-exports during the strangler fig phase.
- **`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in test suite**: This PostgreSQL syntax crashes the SQLite test runner (verified — currently causing test collection errors when `main.py` is imported). Phase 1 must guard these runtime migrations with a dialect check or move them to proper Alembic migrations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic Pydantic model creation | Custom metaclass | `pydantic.create_model()` | Handles field types, validators, docstrings automatically |
| HTML escaping | Custom string replacement | `html.escape()` (stdlib) | Already used in plan_generator; extend the pattern |
| YAML parsing | Custom parser | `yaml.safe_load()` (PyYAML) | Battle-tested; handles all YAML 1.1 edge cases |
| Module discovery | Custom file scanner | `pathlib.Path.iterdir()` + `importlib.import_module()` | Standard Python; no extra deps |
| DB schema inspection | Raw SQL against information_schema | `sqlalchemy.inspect()` | Cross-DB compatible; already in project's SQLAlchemy version |
| Rolling time windows (BUG-01) | Custom cache/expiry logic | `datetime.utcnow() - timedelta(hours=24)` comparison | stdlib datetime; simple and correct |

**Key insight:** Every problem in this phase has a stdlib or already-installed solution. The only new dependency is PyYAML being added to requirements.txt (it's already installed).

---

## Runtime State Inventory

> This is a refactoring phase — runtime state must be audited.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | PostgreSQL tables: `users`, `students`, `schools`, `recommendations`, `action_plans`, `grade_systems`, `subjects`, `student_subject_grades`, `transcripts`, `student_school_targets`, `plan_generation_jobs`, `academic_plans`, `student_cohorts`, `cohort_memberships`, `plan_history` — table names are unchanged, only ORM file locations move | Code edit only (model file paths) — no data migration needed |
| Live service config | No external services configured; backend runs locally via uvicorn | None |
| OS-registered state | No systemd/launchd/Task Scheduler entries found | None |
| Secrets/env vars | `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `UPLOAD_DIR`, `PLAN_GENERATION_TIMEOUT_SECONDS`, `GEMINI_API_KEY`, `ML_MODEL_PATH` — names do not change in this phase | None — names unchanged |
| Build artifacts | `backend/data` is a symlink to project-root `data/` (per memory); `backend/tests/test.db` is SQLite artifact | None — symlink and test.db are not affected by module reorganization |

[VERIFIED: direct file inspection of main.py, conftest.py, memory file]

**Critical note on test infrastructure:** `main.py` currently runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at module-import time (lines 141-160). This is PostgreSQL-specific syntax. When `conftest.py` imports `app.main`, this crashes with `sqlalchemy.exc.OperationalError: near "EXISTS": syntax error` on SQLite. This is confirmed by running `python -m pytest --collect-only` — it fails on collection. The 60 tests pass in production because PostgreSQL supports this syntax. Phase 1 MUST fix this as part of the `main.py` refactoring — move these runtime column additions to a DB dialect check or to Alembic migrations.

---

## Common Pitfalls

### Pitfall 1: SQLAlchemy Metadata Registration Order

**What goes wrong:** If module models (e.g., `Student`) are imported after `Base.metadata.create_all()` is called in a test or at startup, the new tables won't be created.

**Why it happens:** `create_all()` creates tables for models registered in `Base.metadata` at call time. Models imported after this call are not included.

**How to avoid:** Import all module models before calling `create_all()`. In the new `main.py`, the module loader must import model packages before the `create_all()` call. The existing `import app.db.models_v2  # noqa: F401` pattern shows how this was handled — replicate it for module models.

**Warning signs:** Tables missing in DB after startup; `NoReferencedTableError` during relationship resolution.

### Pitfall 2: Strangler Fig Breaks Test Import Paths

**What goes wrong:** Tests import directly from `app.services.hkdse_service`, `app.services.matchmaker_v2`, etc. Moving the file without a re-export stub causes `ModuleNotFoundError` on the test files that import from the old path.

**Why it happens:** Python's `import` is a path-based lookup; moving the file changes the path.

**How to avoid:** For each service file moved, leave a stub at the old path that re-exports everything. The stub can be deleted at the end of Phase 1 after test imports are updated, or kept as a compatibility shim.

**Warning signs:** `ModuleNotFoundError: No module named 'app.services.hkdse_service'` in test output after a service move.

### Pitfall 3: PyYAML safe_load Silently Returns None for Empty Files

**What goes wrong:** If a `config.yaml` is empty or only contains comments, `yaml.safe_load()` returns `None`. Calling `.get("name")` on `None` raises `AttributeError`.

**Why it happens:** PyYAML treats an all-comment YAML file as empty document (returns `None`).

**How to avoid:** Always null-check after `safe_load`: `config = yaml.safe_load(f) or {}`.

**Warning signs:** `AttributeError: 'NoneType' object has no attribute 'get'` during module discovery.

### Pitfall 4: FastAPI Router Registration Order Matters

**What goes wrong:** Auto-generated CRUD routes for `/api/v1/students/` may conflict with existing custom routes in `students.py` if registered in wrong order. FastAPI matches routes in registration order — a catch-all route registered first will shadow more specific ones.

**Why it happens:** FastAPI uses first-match routing. `GET /students/{id}` registered before `GET /students/search` means `/students/search` is treated as an `id` parameter.

**How to avoid:** Register custom module routes before auto-generated CRUD routes. Or use distinct path prefixes for auto-generated routes (e.g., `/api/v1/entities/students/` separate from custom `/api/v1/students/`).

**Warning signs:** `/students/search` returns 422 validation error instead of search results (FastAPI tries to cast "search" to UUID).

### Pitfall 5: Rolling 24-Hour Rate Limit Key Accumulation (BUG-01)

**What goes wrong:** The current implementation uses `date.today().isoformat()` as part of the rate limit key. This means the limit resets at midnight, not 24 hours after first use. A counsellor can send 20 messages at 23:50, then 20 more at 00:10 (only 20 minutes later).

**Why it happens:** Calendar day vs rolling window — fundamentally different semantics.

**How to avoid:** For rolling 24h: store timestamps of requests in a list within `chat_request_counts`, filter to last 24h at check time. Or simpler: store a `{key: {"count": N, "window_start": iso_datetime}}` dict and reset when `now - window_start > 24h`.

**Warning signs:** Rate limit can be bypassed by making requests around midnight.

### Pitfall 6: ALTER TABLE IF NOT EXISTS Breaks SQLite Test Runner

**What goes wrong:** `main.py` runs PostgreSQL-specific `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` at import time. When tests import `app.main`, the SQLite test engine receives this statement and fails.

**Why it happens:** `IF NOT EXISTS` in `ALTER TABLE` is PostgreSQL syntax, not SQL standard.

**How to avoid:** Either (a) guard with `if engine.dialect.name == 'postgresql':` before executing, or (b) move these column additions to proper Alembic migrations. Option (b) is cleaner architecturally but requires adding Alembic to the dev workflow. Option (a) is faster and safe for Phase 1.

**Warning signs:** `sqlalchemy.exc.OperationalError: near "EXISTS": syntax error` on test collection — already confirmed in this codebase.

---

## Code Examples

### BUG-01: Rolling 24-Hour Rate Limit Fix

```python
# Source: [ASSUMED] standard rolling window pattern
from datetime import datetime, timezone, timedelta

def _check_and_increment_rate_limit(db: Session, plan: AcademicPlan, counsellor_id: Any) -> None:
    """Rolling 24-hour window: max 20 requests per counsellor per plan."""
    key = f"{counsellor_id}:{plan.id}"
    counts: dict = dict(plan.chat_request_counts or {})
    entry = counts.get(key, {"count": 0, "window_start": None})

    now = datetime.now(timezone.utc)
    window_start_str = entry.get("window_start")

    if window_start_str:
        window_start = datetime.fromisoformat(window_start_str)
        if now - window_start > timedelta(hours=24):
            # Reset window
            entry = {"count": 0, "window_start": now.isoformat()}
    else:
        entry["window_start"] = now.isoformat()

    if entry["count"] >= 20:
        raise HTTPException(status_code=429, detail="Daily AI chat limit (20 requests) reached for this plan.")

    entry["count"] += 1
    counts[key] = entry
    plan.chat_request_counts = counts
```

### BUG-02: Eligibility Confidence Indicator

```python
# Source: [ASSUMED] based on MatchResult dataclass and requirements
# In matchmaker_v2.py — extend MatchResult and run_matching

@dataclass
class MatchResult:
    # ... existing fields ...
    data_completeness: float  # NEW: 0.0–1.0 fraction of expected grade fields present

def compute_data_completeness(student_data: dict) -> float:
    """Compute fraction of 4 compulsory + any elective subjects that have grades."""
    grades = student_data.get("grades_by_code", {})
    compulsory_present = sum(1 for c in ["CHLA", "ENGL", "MATH", "CSD"] if c in grades and grades[c])
    compulsory_score = compulsory_present / 4
    elective_grades = [v for k, v in grades.items() if k not in {"CHLA", "ENGL", "MATH", "CSD"}]
    elective_score = min(len([g for g in elective_grades if g]) / 2, 1.0) if elective_grades else 0.0
    return round((compulsory_score * 0.7 + elective_score * 0.3), 2)
```

### BUG-04: Consistent HTML Escaping in plan_generator.py

The existing `_esc()` helper is already defined and used for most values. The unescaped f-strings to fix are at lines 510, 725, 727, 729, 762, 768, 796, 1005, 1007 — all inline f-strings that embed `subj`, `task`, `school`, `sitting`, `raw`, `action` variables derived from user input:

```python
# BEFORE (unsafe):
rows += f"<tr><td>{subj}</td><td>{sitting}</td><td>{raw}</td>...</tr>"

# AFTER (safe):
rows += f"<tr><td>{_esc(subj)}</td><td>{_esc(sitting)}</td><td>{_esc(raw)}</td>...</tr>"
```

### BUG-05: XGBoost Startup Warning + Health Reporting

```python
# Source: [ASSUMED] standard pattern for startup logging
# In main.py startup or a new platform/health.py module

import logging
logger = logging.getLogger(__name__)

def _check_ml_model_status() -> dict:
    """Check XGBoost model at startup; log warning if unavailable."""
    from app.modules.school_choice.services.matchmaker_v2 import _get_model
    model = _get_model()
    if model is None:
        logger.warning(
            "[STARTUP] XGBoost model not loaded — ML_MODEL_PATH not set or file not found. "
            "Matchmaker will use rule-only scoring (no ML component)."
        )
        return {"xgboost_model": "unavailable", "scoring_mode": "rule_only"}
    logger.info("[STARTUP] XGBoost model loaded successfully.")
    return {"xgboost_model": "loaded", "scoring_mode": "hybrid"}
```

### Health Endpoint Extension (SEC-03)

```python
# Source: [ASSUMED] based on existing /health endpoint and D-15

@app.get("/health", tags=["health"])
def health_check():
    """Extended health check: DB, CORS, schema parity, module status."""
    from sqlalchemy import text as _t

    # DB check
    try:
        with engine.connect() as conn:
            conn.execute(_t("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "cors_origin": settings.CORS_ORIGINS,
        "schema_parity": _schema_parity_result,  # set at startup
        "modules": _module_health_results,         # populated by module loader
    }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQLAlchemy 1.x `Column` class syntax | SQLAlchemy 2.0 `DeclarativeBase` + `mapped_column()` | SQLAlchemy 2.0 (2023) | Current code uses old 1.x-compatible syntax (works in 2.0 compat mode) — Phase 1 should not migrate to 2.0 `mapped_column()` to avoid test disruption |
| FastAPI `@app.on_event("startup")` | FastAPI lifespan context manager | FastAPI 0.93+ (2023) | Current code does not use lifespan; Phase 1 startup work goes in module-level code as existing pattern shows |
| Pydantic v1 `class Config` | Pydantic v2 `model_config = {}` | Pydantic v2 (2023) | Already using v2 pattern in config.py |

**Deprecated/outdated:**
- `models_v2.py`: This file exists solely to hold domain models that "weren't ready" when `models.py` was created. Phase 1 eliminates this split by moving all domain models to `modules/school_choice/models/`.
- Runtime `ALTER TABLE IF NOT EXISTS` in `main.py`: This is a workaround for missing Alembic migrations. Phase 1 should at minimum guard against SQLite dialect to fix the test runner, even if full Alembic adoption is deferred.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Re-export stubs (`from app.modules.school_choice.services.hkdse_service import *`) will maintain test compatibility without touching test files | Architecture Patterns (Pattern 6), Pitfall 2 | Tests fail after service moves; would require mass import updates in test files before tests pass |
| A2 | Rolling window rate limit key format `{counsellor_id}:{plan_id}` → entry dict with count + window_start is backward-compatible with existing `chat_request_counts` JSONB shape | BUG-01 Code Example | Existing chat_request_counts rows in production DB have old format (`{date:id:planid: N}`); migration of existing values needed |
| A3 | `data_completeness` formula (70% compulsory, 30% elective) is a reasonable default for BUG-02 — no explicit formula is defined in requirements | BUG-02 Code Example | If specific completeness formula is required, this implementation will produce incorrect indicator values |
| A4 | PyYAML `safe_load()` handles all field type values in entity YAML without issue; no custom YAML tags needed | Standard Stack | If custom YAML types are needed in future, PyYAML safe_load rejects them; would need ruamel.yaml or full YAML loader |
| A5 | The 60 test count refers to the v2.2 state: 5 (auth) + 22 (routes) + 33 (services) = 60 | Validation Architecture | If additional tests were added after v2.2, the baseline count may be higher than 60 |

---

## Open Questions

1. **`ALTER TABLE IF NOT EXISTS` in main.py — fix approach**
   - What we know: Currently breaks SQLite test collection (confirmed); PostgreSQL production unaffected.
   - What's unclear: Whether to (a) add `if engine.dialect.name == 'postgresql':` guard, or (b) move to Alembic migrations.
   - Recommendation: Option (a) is the minimum fix for Phase 1 (one-line guard per ALTER TABLE block). Option (b) is technically correct but adds Alembic workflow overhead that the planner should evaluate against phase scope. If Alembic is not in scope, use option (a).

2. **Auto-generated CRUD vs existing custom routes — namespace conflict**
   - What we know: Auto-generated CRUD would produce `GET /api/v1/students/` and `GET /api/v1/students/{id}` — same paths as existing `students.py` routes.
   - What's unclear: D-06 says "Modules can override with custom endpoints when needed." The planner needs to decide whether auto-generated routes are additive (new path prefix like `/api/v1/entities/`) or replace the custom routes for the `student` entity.
   - Recommendation: For Phase 1 with the school_choice module, the custom routes already exist and are well-tested. Auto-generated CRUD should use a distinct path or be explicitly skipped for entities that have custom routes declared in config.yaml. Add an `"auto_crud": false` flag in entity YAML for entities with full custom route coverage.

3. **BUG-03 school name — scope of fix**
   - What we know: `Recommendation.school_name` is a denormalized copy stored at generation time (by design, for historical accuracy). The `targets.py` route correctly JOINs `school.name` for the current name. The `recommendations.py` route returns the stored `school_name` from the `recommendations` table.
   - What's unclear: Requirements say "single source of truth." This could mean (a) always JOIN to `schools.name` in API responses, discarding the denormalized copy, or (b) keep denormalized copy but ensure it's refreshed on update.
   - Recommendation: For targets and match API responses, always use `school.name` from the JOIN (already done in `targets.py`). For historical `recommendations`, return the stored name as-is (it represents the name at generation time). The bug is in match responses that duplicate `school_name` at both `school_name` field level and inside `MatchResult` — ensure single field in response.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.9 | All backend code | ✓ | 3.9.19 | — |
| PostgreSQL 15 | Production DB | ✓ | 15.x (Homebrew) | — |
| PyYAML | Entity config parsing | ✓ | 6.0 (installed, not in requirements.txt) | — |
| uvicorn | Backend server | ✓ | (part of uvicorn[standard]==0.29.0) | — |
| SQLite (in-memory) | Test suite | ✓ | stdlib | — |

**Missing dependencies with no fallback:** None — all dependencies are available.

**Missing dependencies with fallback:** None.

**Note:** PyYAML is already installed in the Python environment but is not listed in `backend/requirements.txt`. The plan must include adding `pyyaml==6.0` to `requirements.txt` to make the dependency explicit. [VERIFIED: grep requirements.txt + pip3 show pyyaml]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.2.0 |
| Config file | None (uses pytest defaults with `tests/` discovery) |
| Quick run command | `cd backend && python -m pytest tests/test_v2_services.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | Entity YAML parsed to valid config dict | unit | `pytest tests/test_platform.py::test_entity_yaml_parse -x` | ❌ Wave 0 |
| PLAT-02 | Auto-generated CRUD endpoints return 200/201 | integration | `pytest tests/test_platform.py::test_auto_crud_endpoints -x` | ❌ Wave 0 |
| PLAT-04 | Module folder loads without error | unit | `pytest tests/test_platform.py::test_module_load -x` | ❌ Wave 0 |
| PLAT-05 | Module discovery registers routers at startup | integration | `pytest tests/test_platform.py::test_module_discovery -x` | ❌ Wave 0 |
| PLAT-06 | All 60 existing tests pass after extraction | regression | `pytest tests/ -v` | ✅ existing |
| PLAT-07 | No v2 route files exist; all endpoints accessible via /api/v1 | integration | `pytest tests/test_v2_routes.py -v` (existing, paths unchanged) | ✅ existing |
| PLAT-08 | Startup parity check logs result; /health reports it | integration | `pytest tests/test_platform.py::test_health_schema_parity -x` | ❌ Wave 0 |
| SEC-03 | /health returns db, cors, parity, module fields | integration | `pytest tests/test_platform.py::test_health_endpoint -x` | ❌ Wave 0 |
| SEC-04 | CORS from env var, not hardcoded | unit | `pytest tests/test_platform.py::test_cors_from_env -x` | ❌ Wave 0 |
| SEC-05 | plan_generator escapes all user-provided strings | unit | `pytest tests/test_v2_services.py::test_plan_generator_xss -x` | ❌ Wave 0 |
| BUG-01 | Rolling 24h rate limit enforced; midnight reset impossible | unit | `pytest tests/test_v2_services.py::test_rate_limit_rolling -x` | ❌ Wave 0 |
| BUG-02 | data_completeness field present in MatchResult | unit | `pytest tests/test_v2_services.py::test_data_completeness -x` | ❌ Wave 0 |
| BUG-03 | Match/targets API returns school.name, not denormalized copy | integration | `pytest tests/test_v2_routes.py::test_school_name_single_source -x` | ❌ Wave 0 |
| BUG-04 | XSS characters in student name escaped in plan HTML | unit | `pytest tests/test_v2_services.py::test_plan_html_escaping -x` | ❌ Wave 0 |
| BUG-05 | XGBoost unavailable → warning logged at startup | unit | `pytest tests/test_platform.py::test_xgboost_fallback -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_v2_services.py tests/test_auth.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green (≥60 tests passing) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_platform.py` — covers PLAT-01, PLAT-02, PLAT-04, PLAT-05, PLAT-08, SEC-03, SEC-04, BUG-05
- [ ] Add `pyyaml==6.0` to `backend/requirements.txt`
- [ ] Fix `conftest.py` test collection error (ALTER TABLE IF NOT EXISTS SQLite crash) — either guard in main.py or skip the block in test mode before new tests can be collected

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | JWT already in place; not changed in this phase |
| V3 Session Management | no | Unchanged from existing |
| V4 Access Control | no | RBAC deferred to Phase 6 |
| V5 Input Validation | yes | Pydantic models on all auto-generated CRUD endpoints; entity YAML must not bypass validation |
| V6 Cryptography | no | bcrypt + JWT unchanged |
| XSS (OWASP, related to V5) | yes | SEC-05: html.escape() for all user-provided strings in plan_generator |

### Known Threat Patterns for FastAPI + Dynamic CRUD

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Auto-CRUD generates endpoints without auth | Elevation of Privilege | All generated routes must include `Depends(get_current_user)` by default |
| YAML entity file injection (malicious config.yaml) | Tampering | Use `yaml.safe_load()` — prohibits Python object execution |
| XSS via user-provided strings in HTML plan | Tampering | `html.escape()` on all f-string variable insertions (SEC-05 / BUG-04) |
| Rate limit bypass at midnight rollover | Denial of Service | Rolling 24h window (BUG-01 fix) |
| Module loader importing untrusted code | Tampering | Modules live inside the app package under version control; not user-uploaded |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection (`backend/app/main.py`, `backend/app/db/models.py`, `backend/app/db/models_v2.py`, `backend/app/core/config.py`, `backend/app/services/*.py`) — all code patterns verified by reading files
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/CONVENTIONS.md` — project analysis documents
- `backend/tests/conftest.py`, `backend/tests/test_v2_services.py` — test infrastructure verified
- `backend/TEST_RESULTS_V2.md` — test count (57 as of v2.0, 60 as of v2.2) verified
- Memory file: `project_schoolchoice_build.md` — 60/60 tests confirmed for v2.2

### Secondary (MEDIUM confidence)

- SQLAlchemy 2.0 inspection API — `sa_inspect(engine)` pattern is well-documented [CITED: https://docs.sqlalchemy.org/en/20/core/reflection.html]
- Python importlib dynamic import — standard library, stable [CITED: https://docs.python.org/3/library/importlib.html]
- FastAPI `create_model()` / dynamic router — documented in Pydantic/FastAPI docs [ASSUMED]

### Tertiary (LOW confidence)

- BUG-02 `data_completeness` formula (70% compulsory / 30% elective weighting) — derived from HKDSE best-5 requirements; specific weighting is [ASSUMED]
- Rolling window implementation approach for BUG-01 — standard pattern [ASSUMED]

---

## Project Constraints (from CLAUDE.md)

- **No Docker**: System runs via `uvicorn` + Homebrew PostgreSQL 15. No `docker` commands.
- **Local-first stack**: PostgreSQL local, no external services (Clerk, Auth0, external DB).
- **preferences.md is canonical**: Tech stack (FastAPI, PostgreSQL, SQLAlchemy, XGBoost, Pydantic) must not change.
- **Full implementations only**: No truncated code snippets in task output (`// rest of function` is not acceptable).
- **Verification protocol**: Executor must run `python -m pytest tests/ -v` and confirm ≥60 tests pass before any completion claim.
- **60 tests must pass at every commit**: Strangler fig approach requires test suite stays green at each atomic move.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by reading requirements.txt and running pip3 show
- Architecture: HIGH — verified by reading all key source files directly
- Pitfalls: HIGH for identified issues (SQLite ALTER TABLE confirmed by running pytest); MEDIUM for general patterns
- Bug locations: HIGH — specific line numbers verified in source files

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable codebase; no external dependencies changing)
