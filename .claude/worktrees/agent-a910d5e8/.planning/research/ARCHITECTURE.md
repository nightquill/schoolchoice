# Architecture Patterns: Modular AI-Powered Data Platform

**Domain:** Config-driven SME data management and analysis platform
**Source codebase:** DataPilot v2.4.1 (FastAPI + React + PostgreSQL)
**Researched:** 2026-04-24
**Confidence:** HIGH (backed by official docs, established open-source examples, and first-principles analysis of existing codebase)

---

## Recommended Architecture

The target is a **Modular Monolith** — a single deployable unit that is internally structured as independent, bounded domain modules. This deliberately avoids microservices (operational overhead incompatible with SME deployments) and avoids an undifferentiated big-ball-of-mud monolith (the current problem). Each domain module is a self-contained folder owning its models, routes, services, schemas, and UI components, but all modules run in the same process and share a PostgreSQL database.

```
Platform Core (shared infrastructure)
├── Config Engine        — entity/field definitions from YAML/JSON
├── AI Abstraction Layer — multi-provider LLM calls via LiteLLM
├── Import/Export Engine — CSV/Excel parsing, field mapping, validation
├── Auth & RBAC          — JWT + bcrypt, role-based access
└── Shared DB Layer      — SQLAlchemy base, session factory, migrations

Domain Modules (pluggable, self-contained)
├── school_choice/       — HKDSE matching, plan generation (first customer)
├── [future_domain]/     — e.g. CRM, HR, accounting
└── ...

Consultant Engine (cross-cutting, module-aware)
├── Freeform Q&A         — AI chat over any entity type
└── Guided Workflows     — Step-based decision support with state
```

---

## Component Boundaries

### 1. Platform Core

The platform core is the invariant layer. Domain modules depend on core, never the reverse. Core provides contracts (abstract base classes, shared models, utility functions) that all modules consume.

| Component | Responsibility | Consumes | Exposes |
|---|---|---|---|
| `core/config.py` | Load env vars, instance config | .env, instance.yaml | Settings singleton |
| `core/security.py` | JWT creation/verification, bcrypt | Settings | `get_current_user` dependency |
| `core/dependencies.py` | FastAPI dependency injection | DB session, auth | `get_db`, `get_current_user`, `require_role` |
| `core/entity_config.py` | Parse YAML entity definitions into field specs | entity YAML files | EntityConfig, FieldSpec Pydantic models |
| `core/ai/provider.py` | LiteLLM wrapper — unified LLM call interface | instance AI config | `ai_complete(prompt, context)` function |
| `core/importer/` | CSV/Excel parsing, field mapping engine | pandas/openpyxl | `ImportJob`, `FieldMapper`, `ImportResult` |
| `core/db/base.py` | SQLAlchemy declarative base | SQLAlchemy | `Base` class all models inherit |
| `core/db/session.py` | Engine, SessionLocal, get_db | DATABASE_URL | `SessionLocal`, `get_db` |

**Rule:** Nothing in `core/` may import from `modules/`. Import direction is one-way.

### 2. Domain Modules

Each domain module is a folder under `backend/app/modules/<domain_name>/`. The folder boundary IS the module boundary — no file outside the folder may import from inside it except through the module's public `__init__.py` exports.

| Module Sub-Component | Responsibility |
|---|---|
| `models.py` | SQLAlchemy table definitions (extends `core/db/base.py:Base`) |
| `routes.py` | FastAPI APIRouter; thin — delegates to services |
| `services.py` | Business logic, domain algorithms |
| `schemas.py` | Pydantic request/response models |
| `config.yaml` | Entity field definitions consumed by core entity engine |
| `__init__.py` | Exports: `router`, `module_meta` (name, label, entity_type) |

Module registration in `main.py` is explicit — each installed module is listed and its router mounted. No auto-discovery magic.

```python
# backend/app/main.py
from app.modules.school_choice import router as school_choice_router
app.include_router(school_choice_router, prefix="/api/v1/school-choice")
```

### 3. AI Abstraction Layer

The AI abstraction layer wraps LiteLLM. LiteLLM provides a single `completion()` call signature that routes to OpenAI, Anthropic, Gemini, any OpenAI-compatible endpoint, or a custom URL — all via the same Python function. This is the correct tool for BYOK multi-provider support in a Python backend.

| Component | Responsibility |
|---|---|
| `core/ai/provider.py` | Reads AI config (provider, model, api_key, api_base) from DB or env; calls `litellm.completion()` |
| `core/ai/config.py` | Pydantic model for AI provider config: provider string, model string, api_key, api_base URL |
| `db/models/ai_config.py` | Persisted AI config record per instance (stored encrypted or as env-ref) |

LiteLLM call pattern for BYOK:
```python
import litellm

response = litellm.completion(
    model=f"{config.provider}/{config.model}",  # e.g. "openai/gpt-4o" or "anthropic/claude-3-5-sonnet"
    api_key=config.api_key,
    api_base=config.api_base,               # None for cloud providers, URL for self-hosted
    messages=messages,
)
```

Provider strings: `"openai"`, `"anthropic"`, `"gemini"`, `"openai"` (with custom api_base for any OpenAI-compatible endpoint including Ollama, Together, self-hosted vLLM).

**Why LiteLLM over rolling a custom abstraction:** LiteLLM handles provider-specific response formats, streaming differences, error normalization, and retry logic. Building equivalent coverage in-house is 3-6 weeks of work that becomes maintenance debt every time a provider changes their API. LiteLLM has 40k+ GitHub stars and active maintenance as of 2025. (MEDIUM confidence — verified via GitHub and official docs, no internal benchmark.)

### 4. Config-Driven Entity Framework

Entity definitions live in YAML files (one per domain module). The platform core reads these at startup and uses them to drive:
- Dynamic form generation in the frontend
- Field-level validation rules
- Import/export column mapping

```yaml
# backend/app/modules/school_choice/config.yaml
entity:
  name: student
  label: Student
  primary_label_field: name
  fields:
    - name: name
      type: string
      required: true
      label: Full Name
    - name: dse_year
      type: integer
      label: DSE Year
      min: 2000
      max: 2030
    - name: notes
      type: text
      label: Notes
      required: false
  relationships:
    - name: grades
      type: has_many
      target: subject_grade
```

The `EntityConfig` Pydantic model (in `core/entity_config.py`) validates this at startup. The frontend fetches entity configs via a platform API endpoint and uses them to render generic `EntityForm` and `EntityTable` components. Domain-specific views can override any section with custom components registered in the module's frontend manifest.

### 5. Consultant Engine

The consultant engine is a platform-level service (not domain-specific) that operates over any entity type. It exposes two modes:

**Freeform Q&A:** User asks any question. The engine loads the relevant entity data, constructs a prompt with context, and calls the AI abstraction layer. Response streamed back via SSE.

**Guided Workflows:** A step-based decision workflow defined in YAML. Each step specifies: question to ask the user or AI, data to load, branching conditions, output to persist. The engine walks the user through the workflow, calling AI at designated steps, collecting responses, and assembling a final recommendation document.

```yaml
# Example guided workflow definition (domain module provides this)
workflow:
  id: school_fit_analysis
  label: School Fit Analysis
  steps:
    - id: gather_priorities
      type: user_input
      prompt: "What are your top 3 priorities in choosing a university?"
    - id: analyze_fit
      type: ai_analysis
      prompt_template: "Given priorities: {priorities}, and student profile: {student_summary}, rank these schools: {shortlist}"
      data_required: [student_summary, shortlist]
    - id: review_results
      type: user_confirm
      display: recommendation_table
```

The workflow engine lives in `core/consultant/workflow_engine.py`. Domain modules register their workflows in their `__init__.py`. This avoids embedding workflow logic in routes or services.

### 6. Import/Export Engine

Stateless service in `core/importer/`. Accepts a file (CSV or Excel), a field map (column header → entity field name), and a target entity type. Returns parsed + validated rows or a structured error report.

Pipeline stages:
1. **Parse** — pandas reads CSV/Excel into DataFrame
2. **Map** — user-supplied column-to-field mapping applied
3. **Validate** — each row validated against EntityConfig field rules
4. **Stage** — valid rows written to a staging table; errors returned to UI
5. **Commit** — user confirms; staged rows promoted to entity tables

The field mapping UI is a generic React component (`FieldMapper`) that receives source columns and target EntityConfig fields and renders a mapping interface. It lives in `frontend/src/platform/components/FieldMapper/`.

---

## Data Flow

### Entity Data Flow (standard CRUD)

```
Browser
  → frontend/src/platform/api/entities.js (generic API client)
  → GET/POST /api/v1/{module}/{entity}/{id}
  → backend/app/modules/{domain}/routes.py (thin route handler)
  → backend/app/modules/{domain}/services.py (business logic)
  → SQLAlchemy session → PostgreSQL
  ← JSON response (EntityConfig-aware schema)
  ← frontend renders via generic EntityTable / EntityForm
     OR domain-specific override component
```

### AI Consultant Flow (freeform)

```
Browser chat input
  → POST /api/v1/consultant/chat
  → core/consultant/chat_service.py
      loads entity context from DB
      constructs prompt
  → core/ai/provider.py → LiteLLM → provider API
  ← streaming SSE response
  ← frontend streams into chat panel
```

### AI Consultant Flow (guided workflow)

```
Browser: user selects workflow
  → POST /api/v1/consultant/workflows/{workflow_id}/start
  → core/consultant/workflow_engine.py creates WorkflowSession
  POST /api/v1/consultant/workflows/{session_id}/step (per step)
  → engine evaluates step type:
      user_input: returns question to frontend
      ai_analysis: calls core/ai/provider.py, returns structured result
      user_confirm: returns data for user approval
  → WorkflowSession state persisted in DB between steps
  ← final step: WorkflowResult saved, PDF/HTML document generated
```

### Import Flow

```
Browser: user uploads CSV, maps columns
  → POST /api/v1/import/upload (multipart)
  → core/importer/parser.py → staged DataFrame
  → POST /api/v1/import/preview (field_map JSON)
  → core/importer/validator.py validates rows against EntityConfig
  ← returns preview: valid_rows, error_rows, warnings
  Browser: user reviews, confirms
  → POST /api/v1/import/commit (import_job_id)
  → core/importer/committer.py promotes staged → entity tables
  ← import summary (rows inserted, rows skipped)
```

### AI Config Flow (BYOK setup)

```
Admin: fills AI provider form (provider, model, api_key, api_base)
  → POST /api/v1/account/ai-config
  → stored in PostgreSQL ai_config table (api_key stored as-is or env-ref)
  At runtime:
  → core/ai/provider.py reads ai_config from DB or env
  → passes to litellm.completion() per call
  → no API keys in code or config files
```

---

## Directory Layout (Target)

```
backend/app/
├── main.py                        # App init, middleware, router mounting
├── core/
│   ├── config.py                  # Pydantic Settings (env vars)
│   ├── security.py                # JWT, bcrypt
│   ├── dependencies.py            # get_db, get_current_user, require_role
│   ├── entity_config.py           # YAML entity definition loader + validator
│   ├── ai/
│   │   ├── provider.py            # LiteLLM wrapper: ai_complete()
│   │   └── config.py              # AIProviderConfig Pydantic model
│   ├── consultant/
│   │   ├── chat_service.py        # Freeform Q&A logic
│   │   └── workflow_engine.py     # Guided workflow step executor
│   └── importer/
│       ├── parser.py              # CSV/Excel → DataFrame
│       ├── validator.py           # Row validation against EntityConfig
│       └── committer.py          # Staged rows → entity tables
├── db/
│   ├── base.py                    # SQLAlchemy declarative base
│   ├── session.py                 # Engine, SessionLocal, get_db
│   └── models/
│       ├── user.py                # User, Role (platform-level)
│       ├── ai_config.py           # AI provider config storage
│       ├── workflow_session.py    # WorkflowSession state
│       └── import_job.py          # Import staging + job tracking
├── schemas/
│   ├── user.py                    # UserCreate, UserResponse
│   ├── ai_config.py               # AIConfigCreate, AIConfigResponse
│   └── import.py                  # ImportPreview, ImportResult
├── api/
│   └── v1/
│       └── routes/
│           ├── auth.py            # Login, register
│           ├── account.py         # User settings, AI config
│           ├── consultant.py      # Chat, workflow endpoints
│           └── import.py          # Upload, preview, commit endpoints
└── modules/
    ├── school_choice/
    │   ├── __init__.py            # Exports router, module_meta
    │   ├── config.yaml            # Entity field definitions
    │   ├── models.py              # School, Student, Grade etc.
    │   ├── routes.py              # APIRouter for school choice
    │   ├── services.py            # matchmaker, plan generator
    │   ├── schemas.py             # SchoolChoiceRequest/Response
    │   └── workflows/
    │       └── school_fit.yaml    # Guided workflow definition
    └── [future_module]/
        └── ...

frontend/src/
├── platform/
│   ├── api/
│   │   ├── client.js              # Axios with auth interceptor
│   │   ├── entities.js            # Generic entity CRUD calls
│   │   ├── consultant.js          # Chat + workflow calls
│   │   └── import.js              # Import pipeline calls
│   ├── components/
│   │   ├── EntityTable/           # Config-driven data table
│   │   ├── EntityForm/            # Config-driven form
│   │   ├── FieldMapper/           # Import column mapping UI
│   │   ├── AIChat/                # Freeform chat panel
│   │   └── WorkflowWizard/        # Step-based workflow UI
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── EntityConfigContext.jsx # Loaded entity configs
│   └── hooks/
│       ├── useAuth.js
│       ├── useEntityConfig.js
│       └── useWorkflow.js
├── modules/
│   └── school_choice/
│       ├── pages/                 # Module-specific page overrides
│       ├── components/            # Domain-specific components
│       └── index.js              # Module manifest (routes, overrides)
└── App.jsx                        # Platform routes + module route injection
```

---

## Patterns to Follow

### Pattern 1: Module Manifest Registration

Each frontend module exports a manifest. The platform `App.jsx` iterates registered modules and mounts their routes and nav items. This is compile-time, not runtime — no dynamic import magic needed for an SME boilerplate.

```javascript
// frontend/src/modules/school_choice/index.js
export const moduleManifest = {
  id: 'school_choice',
  label: 'School Choice',
  routes: [
    { path: '/students', component: () => import('./pages/StudentList') },
    { path: '/students/:id', component: () => import('./pages/StudentProfile') },
  ],
  navItems: [
    { label: 'Students', path: '/students', icon: 'Users' },
  ],
};
```

React.lazy + Suspense is used for route-level code splitting. Each module's pages load on demand.

### Pattern 2: AI Provider Config at Runtime

The AI provider selection is a runtime configuration, not a compile-time one. `core/ai/provider.py` reads the persisted `AIConfig` from the database on each call (cached per request). This means the admin can switch providers without redeployment.

```python
# core/ai/provider.py
async def ai_complete(messages: list[dict], db: Session) -> str:
    config = db.query(AIConfig).first()
    response = litellm.completion(
        model=f"{config.provider}/{config.model}",
        api_key=config.api_key,
        api_base=config.api_base or None,
        messages=messages,
    )
    return response.choices[0].message.content
```

### Pattern 3: Entity Config as Single Source of Truth

`EntityConfig` is loaded at startup from each module's `config.yaml`. It is served to the frontend via `GET /api/v1/config/entities`. Frontend components (`EntityForm`, `EntityTable`) consume this config to render field labels, types, validation, and ordering without hardcoding.

Domain-specific components may override any field or section by registering an override in the module manifest. The platform renders the override if registered, falls back to generic component if not.

### Pattern 4: Thin Routes, Fat Services

Routes do three things only: validate the incoming request (Pydantic), call the service, return the response. All business logic lives in services. This is existing convention in the codebase and must be preserved — it makes modules testable in isolation.

### Pattern 5: Background Tasks for Long Operations

Plan generation and large import commits use FastAPI `BackgroundTasks`. A job record (status: QUEUED → RUNNING → DONE/FAILED) is created immediately. The client polls status. This pattern already exists and must be extended to the import engine.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Cross-Module Imports

**What goes wrong:** `school_choice/services.py` imports from `hr/models.py`. Modules become coupled; changes ripple unpredictably.

**Prevention:** Enforce module boundaries via linting rule or simple convention. Modules may only import from `core/` and their own folder. If data from another module is needed, it must be accessed via the module's exported service function or via a platform-level join.

### Anti-Pattern 2: Domain Logic in Config Engine

**What goes wrong:** EntityConfig tries to express HKDSE-specific grading rules, eligibility conditions, or ML scoring. Config format becomes unwieldy.

**Prevention:** Config expresses structure (fields, types, labels, validation). Domain logic (algorithms, scoring, eligibility) lives in the module's `services.py` in code. Config is not a programming language.

### Anti-Pattern 3: AI Keys in Source Code or Config Files

**What goes wrong:** API keys committed to repo or stored in config.yaml. Boilerplate clones expose real keys.

**Prevention:** AI config (provider, model, api_key, api_base) stored in the database only, entered by the deployer via the admin UI after deployment. Never in env files committed to the repo (env files are .gitignored; only `.env.example` is committed).

### Anti-Pattern 4: One Giant Workflow Engine for Everything

**What goes wrong:** Trying to make the workflow engine also be the matchmaker, the plan generator, and the import pipeline. Every concern becomes a "workflow step."

**Prevention:** Workflow engine handles only consultant-style guided interactions. Matching, plan generation, and import are separate purpose-built services. The workflow engine may call these services as atomic operations, not replace them.

### Anti-Pattern 5: Global EntityConfig Mutation at Runtime

**What goes wrong:** Admin can edit entity config in the UI, entity config changes at runtime, running requests see an inconsistent schema, import jobs fail mid-stream.

**Prevention:** EntityConfig is read-only at runtime (loaded at startup from YAML, served as-is). Changes to entity structure require a redeploy. For the SME boilerplate use case (each instance is a single deployment), this is acceptable. Document this constraint clearly.

---

## Component Communication Map

```
Frontend Platform Components
  ↕ HTTP/JSON
Backend API Routes (v1)
  ↓
  ├── core/ai/provider.py ──────────────→ LiteLLM → External AI APIs
  ├── core/consultant/chat_service.py
  ├── core/consultant/workflow_engine.py
  ├── core/importer/* (pipeline stages)
  ├── core/entity_config.py (read-only)
  └── modules/*/services.py (domain logic)
         ↕
      SQLAlchemy ORM
         ↕
      PostgreSQL

Frontend Module Components (domain-specific)
  ↕ HTTP/JSON
Backend Modules API Routes
  ↓
  └── modules/*/services.py
         ↕
      SQLAlchemy ORM
         ↕
      PostgreSQL
```

No module talks to another module at the service level. Cross-module data access is done via direct DB queries through the shared session, selecting from the other module's tables by name (not by importing the other module's models).

---

## Suggested Build Order (Dependencies Drive Sequence)

The components have hard dependencies that dictate build order. Later components depend on earlier ones being stable.

| Stage | Component | Why This Position | Depends On |
|---|---|---|---|
| 1 | Core DB layer (`base.py`, `session.py`) | Everything depends on DB | Nothing |
| 2 | Core auth (`security.py`, auth routes, User model) | All protected routes need auth | Core DB |
| 3 | Core entity config loader | All domain modules use it | Core DB |
| 4 | School choice module (models → services → routes) | First customer; validates the module interface contract | Core DB, entity config |
| 5 | AI abstraction layer + LiteLLM integration | Replaces hardcoded Gemini; needed for consultant | Core auth |
| 6 | Freeform consultant (chat_service, SSE route) | Uses AI layer, needs entity data | AI layer, module models |
| 7 | Guided workflow engine | Builds on freeform consultant patterns | Consultant chat, AI layer |
| 8 | Import/Export engine | Uses entity config for validation | Entity config, module models |
| 9 | Frontend platform components (EntityTable, EntityForm, FieldMapper, AIChat) | Use backend contracts established in stages 3-8 | All backend |
| 10 | RBAC (role model, require_role dependency) | Can be layered on after routes are established | Auth |
| 11 | Deployment config (Vercel, managed DB) | Last — environment concerns | Everything |

The existing school_choice code refactors into Stage 4. The matching engine and plan generator become `modules/school_choice/services.py`. The AI chat refactors into Stage 6 on top of the new AI layer.

---

## Scalability Considerations

This is a boilerplate for single-tenant deployments, not a multi-tenant SaaS. Scalability concerns are per-instance:

| Concern | At 100 entities | At 10K entities | At 100K entities |
|---|---|---|---|
| Query performance | Default SQLAlchemy queries fine | Add pagination, filtering indexes on common fields | Add database-side full-text search (pg_trgm), query result caching |
| Import jobs | Synchronous with background task | pandas handles well; add chunk processing for >50K rows | Celery or ARQ task queue |
| AI calls | Per-request, synchronous | Add per-user rate limiting (rolling window) | Add async AI call queue |
| Plan/report generation | Background task pattern (existing) | No change needed | No change needed |

For Vercel + managed DB (Neon/Supabase) deployment, connection pooling via PgBouncer (offered by both Neon and Supabase) is required. FastAPI with uvicorn workers is stateless and scales horizontally on Vercel serverless functions.

---

## Sources

- [FastAPI Bigger Applications (official)](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [FastAPI Modular Monolith Starter Kit (GitHub)](https://github.com/arctikant/fastapi-modular-monolith-starter-kit)
- [Module-Functionality Structure for FastAPI (Medium)](https://medium.com/@amirm.lavasani/how-to-structure-your-fastapi-projects-0219a6600a8f)
- [LiteLLM OpenAI-Compatible Endpoints (official docs)](https://docs.litellm.ai/docs/providers/openai_compatible)
- [LiteLLM GitHub (BerriAI)](https://github.com/BerriAI/litellm)
- [LiteLLM Setting API Keys and Base URL (official)](https://docs.litellm.ai/docs/set_keys)
- [Pydantic AI Model Provider Integration (DeepWiki)](https://deepwiki.com/pydantic/pydantic-ai/4-model-provider-integration)
- [React Lazy Loading (official React docs)](https://react.dev/reference/react/lazy)
- [Plugin System in React — Design and Isolation (Medium)](https://medium.com/@rahul.dinkar/building-a-plugin-system-in-react-design-isolation-and-communication-56539bd1313f)
- [Dynamic Data Model with JSONB and PostgreSQL (Medium)](https://medium.com/@ajaymaurya73130/how-to-build-a-dynamic-data-model-using-jsonb-and-postgresql-1a6fde6da947)
- [zhanymkanov/fastapi-best-practices (GitHub)](https://github.com/zhanymkanov/fastapi-best-practices)

---

*Architecture research: 2026-04-24*
