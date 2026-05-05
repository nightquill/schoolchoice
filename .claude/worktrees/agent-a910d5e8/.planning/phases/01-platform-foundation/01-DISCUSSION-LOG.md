# Phase 1: Platform Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 01-platform-foundation
**Areas discussed:** Entity YAML config format, Module structure & discovery, API consolidation strategy, Migration & extraction approach

---

## Entity YAML Config Format

### Q1: How expressive should entity YAML definitions be for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Fields + types + validation | Field name, type, required/optional, simple validation (min/max, regex, choices). Relationships deferred to code. | ✓ |
| Fields + types + validation + relationships | All above plus foreign keys and many-to-many in YAML. More complex parser. | |
| Minimal — fields + types only | Just field names and types. No validation in YAML. | |

**User's choice:** Fields + types + validation (Recommended)
**Notes:** Covers 80% of use cases without over-engineering the YAML parser.

### Q2: Where should entity YAML files live?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside the domain module | modules/school_choice/entities/student.yaml. Self-contained per domain. | ✓ |
| Central entities/ directory | All entity YAMLs in top-level entities/ folder. Simpler discovery. | |

**User's choice:** Inside the domain module (Recommended)

### Q3: Should YAML config define which fields appear in API responses?

| Option | Description | Selected |
|--------|-------------|----------|
| Return all fields by default | Auto-generated CRUD returns every field. Modules override with custom endpoints. | ✓ |
| YAML controls visible fields | Add visible/api_exclude flags per field. | |
| You decide | Claude picks. | |

**User's choice:** Return all fields by default (Recommended)

### Q4: How to handle JSONB field types in YAML?

| Option | Description | Selected |
|--------|-------------|----------|
| Add a 'jsonb' type in YAML | First-class type, no schema validation on contents. Domain modules validate in service code. | ✓ |
| JSONB with schema hint | type: jsonb plus optional json_schema for validation. | |
| You decide | Claude picks. | |

**User's choice:** Add a 'jsonb' type in YAML (Recommended)

---

## Module Structure & Discovery

### Q1: How should the platform discover and load domain modules?

| Option | Description | Selected |
|--------|-------------|----------|
| Manifest-based auto-discovery | Each module has config.yaml. Platform scans modules/ dir and registers automatically. | ✓ |
| Explicit registration in main.py | Developer adds register_module() line. No auto-scanning. | |
| Python entry points | Proper Python package with setup.py entry points. | |

**User's choice:** Manifest-based auto-discovery (Recommended)

### Q2: Where should domain modules live?

| Option | Description | Selected |
|--------|-------------|----------|
| backend/app/modules/ | Inside existing app package. Direct imports from app.core, app.db. | ✓ |
| Top-level modules/ | Separate from backend/app/. Requires path manipulation. | |

**User's choice:** backend/app/modules/ (Recommended)

### Q3: Should modules extend platform ORM models?

| Option | Description | Selected |
|--------|-------------|----------|
| Own tables only | Module defines own models. Links to platform via FK. | ✓ |
| Can extend platform models | Modules add mixins/columns to platform models. | |
| You decide | Claude picks. | |

**User's choice:** Own tables only (Recommended)

### Q4: Should modules include frontend components in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Backend only in Phase 1 | Frontend stays as-is. Phase 3 handles frontend modularization. | ✓ |
| Full-stack modules from day one | Backend + frontend subdirectories per module. | |

**User's choice:** Backend only in Phase 1 (Recommended)

---

## API Consolidation Strategy

### Q1: How to resolve v1/v2 API duplication?

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate into /api/v1 | Keep prefix, merge v2 logic into v1, delete v2 files. API was never public. | ✓ |
| Move everything to /api/v2 | Clean v2 routes, keep v1 temporarily. | |
| Drop versioning entirely | Routes at /api/schools etc. No prefix. | |

**User's choice:** Consolidate into /api/v1 (Recommended)

### Q2: How should auto-generated and custom routes coexist?

| Option | Description | Selected |
|--------|-------------|----------|
| Platform generates CRUD, module adds custom | Auto-register GET/POST/PUT/DELETE per entity. Modules add extra custom routes. | ✓ |
| Module registers all routes | No auto-generated CRUD. Module owns everything. | |
| You decide | Claude picks. | |

**User's choice:** Platform generates CRUD, module adds custom (Recommended)

---

## Migration & Extraction Approach

### Q1: How to extract HKDSE code from core?

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental strangler fig | Move one service at a time, run 60 tests after each. | ✓ |
| Big-bang move with shim layer | Move all at once, add import shims. | |
| Copy then delete | Copy to new location, verify, delete originals. | |

**User's choice:** Incremental strangler fig (Recommended)

### Q2: What happens to existing ORM models?

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into platform + module models | User stays in core. Domain models move to module. v1/v2 split resolved. | ✓ |
| Keep models in core | All ORM models stay in backend/app/db/. Modules import from there. | |
| You decide | Claude picks. | |

**User's choice:** Merge into platform + module models (Recommended)

### Q3: How should health endpoint and startup diagnostics work?

| Option | Description | Selected |
|--------|-------------|----------|
| Platform health + module health hooks | /health reports DB, CORS, parity, per-module health. Modules register health check functions. | ✓ |
| Simple flat health check | Single /health with hardcoded checks. | |
| You decide | Claude picks. | |

**User's choice:** Platform health + module health hooks (Recommended)

---

## Claude's Discretion

- YAML parsing library choice
- Entity registry internals
- Import redirect strategy during migration
- ORM-schema parity check implementation
- Bug fix specifics (BUG-01 through BUG-05)

## Deferred Ideas

None — discussion stayed within phase scope
