# Technology Stack

**Project:** DataPilot — AI-Powered Data Management & Analysis Platform
**Researched:** 2026-04-24
**Base:** FastAPI + React + PostgreSQL (v2.4.1, extend-don't-replace)

---

## Guiding Principle

This is an additive research report. The existing stack (FastAPI 0.111, React 19, PostgreSQL 15, SQLAlchemy 2.0, Alembic, Pydantic 2, Vite 8, pytest) is **locked** — Project.md requires stack continuity. Every recommendation here sits on top of or alongside what already exists. Nothing recommends replacing a working piece.

---

## Recommended Additions by Domain

### 1. Multi-Provider AI Integration

**Recommended: LiteLLM Python SDK**
**Version:** 1.83.x stable (PyPI latest as of research date; stable releases ship weekly)
**Confidence:** HIGH — verified via PyPI and official docs

LiteLLM is the right choice over alternatives (raw OpenAI SDK, Anthropic SDK, or building a manual adapter) for one concrete reason: it provides a single `completion()` interface across 100+ providers including OpenAI, Anthropic, Gemini, any OpenAI-compatible endpoint (Ollama, Together AI, local vLLM), and custom `api_base` URLs — which is exactly what BYOK support requires.

```python
# All of these work identically:
litellm.completion(model="openai/gpt-4o", messages=..., api_key=user_key)
litellm.completion(model="anthropic/claude-opus-4-5", messages=..., api_key=user_key)
litellm.completion(model="openai/your-model", api_base="https://self-hosted.example.com/v1", messages=..., api_key=user_key)
```

Per-request `api_key` and `api_base` override environment defaults — this is the BYOK pattern. No proxy server needed; use the Python SDK directly embedded in FastAPI.

**What NOT to use:**
- Raw `anthropic` + `openai` SDKs separately: you'd write your own adapter layer that LiteLLM already is
- LiteLLM Proxy (the standalone server): adds ops complexity without benefit for a single-instance boilerplate repo
- LangChain: 10x the dependency weight for a problem LiteLLM solves in one function call

```bash
pip install litellm==1.83.13
```

**Config pattern for the platform:**
Store AI provider config in the instance's `.env`:
```
AI_PROVIDER=anthropic          # or openai, openai_compatible, custom
AI_MODEL=claude-opus-4-5       # model string for litellm
AI_API_KEY=sk-...              # BYOK key
AI_API_BASE=                   # optional: custom endpoint URL
```
The AI service layer reads these and passes them as per-request overrides to `litellm.completion()`. Users who want to switch providers change two env vars, not code.

---

### 2. AI Streaming to Frontend

**Recommended: FastAPI `StreamingResponse` + SSE + native browser `EventSource` / `fetch` with `ReadableStream`**
**Confidence:** HIGH — established pattern, no library needed

SSE is the de facto standard for LLM token streaming. OpenAI, Anthropic, and LiteLLM all emit `text/event-stream` format. The pattern is:

- **Backend:** FastAPI `StreamingResponse` wrapping an async generator that yields LiteLLM streaming chunks
- **Frontend:** `fetch()` with `ReadableStream` decoding (preferred over `EventSource` because it allows POST and custom headers for auth)

No additional library needed on the frontend beyond what's already in the project. The existing `axios` instance handles non-streaming calls; streaming uses raw `fetch` directly.

**What NOT to use:**
- WebSockets: overkill for one-directional token streaming; adds reconnection complexity
- Socket.IO: same problem, heavier
- The Vercel AI SDK: it's Next.js-first and introduces React-framework coupling incompatible with Vite/React SPA

---

### 3. Import / Export System

**Recommended: pandas 3.0.2 + openpyxl 3.1.5**
**Confidence:** HIGH — verified via PyPI

The existing codebase has scikit-learn and XGBoost already in the dependency tree, meaning numpy/scipy are already present. Adding pandas is a small marginal cost, and pandas gives:
- `pd.read_csv()` / `pd.read_excel()` for import with automatic type inference
- `df.to_csv()` / `df.to_excel()` for export
- Column introspection for building the field-mapping UI (expose column headers as JSON, let user map to entity fields)

openpyxl is the read/write engine pandas delegates to for `.xlsx` files. xlsxwriter is write-only and not needed; openpyxl covers both directions.

```bash
pip install pandas==3.0.2 openpyxl==3.1.5
```

**FastAPI upload pattern:**
```python
@router.post("/import/preview")
async def preview_import(file: UploadFile = File(...)):
    contents = await file.read()
    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents))
    else:
        df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")
    return {"columns": df.columns.tolist(), "preview": df.head(5).to_dict("records")}
```

The field-mapping step is a UI concern (React) that posts a mapping config JSON; the actual import endpoint then applies the mapping server-side before inserting rows.

**What NOT to use:**
- `csv` module from stdlib: no Excel support, no type inference
- `xlrd`: only reads old `.xls` format (Excel 97-2003), not `.xlsx`
- `fastapi-csv` (GitHub): unmaintained since 2021, 100 stars

---

### 4. Config-Driven Entity Framework

**Recommended: JSONB columns in PostgreSQL + Pydantic dynamic model generation + Alembic migrations**
**Confidence:** MEDIUM — pattern is validated but requires careful design; no off-the-shelf library does exactly this

The existing codebase already uses JSONB for `StudentProfile.extra_fields`. The platform extends this:

**Entity config storage:** A `entity_config` table stores JSON definitions:
```json
{
  "entity_type": "employee",
  "fields": [
    {"name": "department", "type": "string", "required": true},
    {"name": "salary", "type": "number", "required": false}
  ]
}
```

**Runtime model generation:** Use `pydantic.create_model()` to generate Pydantic validation models from config at startup (cached in memory, regenerated on config change):
```python
from pydantic import create_model
from typing import Optional

def build_entity_model(config: dict) -> type:
    field_defs = {}
    for f in config["fields"]:
        py_type = {"string": str, "number": float, "boolean": bool}[f["type"]]
        if not f.get("required"):
            py_type = Optional[py_type]
        field_defs[f["name"]] = (py_type, ...)
    return create_model(f"Entity_{config['entity_type']}", **field_defs)
```

**Database storage:** Entity instances store flexible field values in a JSONB `data` column alongside fixed fields (id, created_at, entity_type, owner). The fixed schema never changes; the JSONB holds domain-specific values validated at the application layer.

**Migrations:** Alembic handles the platform's own table migrations normally. Entity-instance tables don't need migrations — the JSONB approach means "schema changes" are config record updates, not DDL changes.

**What NOT to use:**
- EAV (Entity-Attribute-Value) tables: notorious for query complexity and performance problems at scale; JSONB achieves the same flexibility with GIN indexing
- SQLAlchemy polymorphic inheritance: tight coupling between Python models and database schema fights the config-driven goal
- A separate schema registry service (Confluent, etc.): overkill for SME-scale deployments

---

### 5. Frontend State Management

**Recommended: TanStack Query v5 for server state + React Context for auth/session**
**Confidence:** HIGH — verified, current as of 2025

The existing codebase uses `useState` + `useEffect` + `axios`. The 1,450-line `StudentProfile.jsx` with 46+ hooks is a symptom of manual server state management. TanStack Query (React Query) eliminates most of that complexity:

- Automatic caching, deduplication, background refetch
- Optimistic updates for mutations
- Loading/error states built in, reducing hook count dramatically
- Works identically with the existing `axios` instance

```bash
npm install @tanstack/react-query@5
```

**For global UI state** (auth token, current user, theme): React Context is sufficient. Zustand is not needed at this scale and adds a dependency without benefit.

**What NOT to use:**
- Redux Toolkit: enterprise-scale boilerplate for a single-user app; RTK Query overlaps with TanStack Query
- Zustand: fine library, but React Context + TanStack Query covers all needs here
- SWR: Vercel-backed alternative to TanStack Query; TanStack Query has more features and is framework-agnostic

---

### 6. Frontend Testing

**Recommended: Vitest + React Testing Library**
**Confidence:** HIGH — de facto standard for Vite-based React projects

The existing project has no frontend tests (flagged as technical debt in PROJECT.md). Vitest is the natural choice because it reuses the existing `vite.config.js` and runs tests in the same Vite pipeline with HMR-speed feedback. React Testing Library tests components from the user's perspective (DOM interactions) rather than implementation details.

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**What NOT to use:**
- Jest: requires separate babel/transform config that duplicates Vite setup; Vitest is a drop-in replacement that's faster
- Cypress for unit tests: use Playwright (already implied in CLAUDE.md) for E2E, Vitest for unit/integration

---

### 7. Managed Database (Production)

**Recommended: Neon PostgreSQL**
**Confidence:** MEDIUM — assessed against Supabase; Neon wins for this use case

**Why Neon over Supabase:**
- This is a boilerplate repo where FastAPI handles auth, not a BaaS. Supabase's value-add features (built-in auth, realtime, storage) go unused and add complexity.
- Neon's native Vercel integration creates database branches per preview deployment, which is useful for testing config changes.
- Neon supports the `-pooler` endpoint suffix for PgBouncer connection pooling, required for serverless because each Vercel function invocation opens a new connection.
- Neon has a more permissive always-on free tier for SME demos.
- The Databricks acquisition (May 2025) adds enterprise backing; they have committed to open source and independent operation.

**Connection config for Vercel:**
```
# Use pooled endpoint for serverless, direct for migrations
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.neon.tech/dbname?sslmode=require
DATABASE_DIRECT_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
```

Run Alembic migrations against `DATABASE_DIRECT_URL` (pooled connections break prepared statements used by Alembic). Application uses `DATABASE_URL` (pooled).

The existing `psycopg2-binary` works with Neon without changes.

**What NOT to use:**
- Supabase: BaaS features add noise; Supabase's Postgres is just Postgres with extras this project doesn't need
- PlanetScale: MySQL, not PostgreSQL; incompatible with existing schema

---

### 8. Deployment Architecture

**Recommended: Vercel (frontend static SPA) + Vercel Functions (FastAPI backend)**
**Confidence:** MEDIUM — Vercel FastAPI support is official and documented, but ML bundle size is a real constraint

**Frontend:** Vite builds a static SPA (`dist/`). Deploy as Vercel static site. Zero config required.

**Backend:** FastAPI deploys as a single Vercel Function using the Python runtime. Vercel officially supports FastAPI and detects the `app` instance automatically.

**Critical constraint — bundle size:** The 500MB limit (increased from 250MB in February 2026) is currently sufficient, but the ML dependencies are heavy:
- scikit-learn + XGBoost + SHAP combined: ~150-200MB uncompressed
- LiteLLM: ~50MB
- pandas + openpyxl: ~80MB
- FastAPI + SQLAlchemy + everything else: ~100MB
- **Estimated total: ~380-430MB** — fits within 500MB but is close

**Mitigation strategy:** In `vercel.json`, use `excludeFiles` to strip unnecessary scikit-learn datasets, XGBoost test fixtures, and any large bundled assets. Monitor bundle size in CI.

**Execution time:** Vercel Fluid compute defaults to 300s (5 minutes) on all plans. ML inference and file imports should complete well within this. AI chat streaming is unaffected — streaming responses don't hit the execution timeout until the connection closes.

**What NOT to use:**
- Railway / Render for FastAPI: viable alternatives, but the project spec says Vercel; document as fallback if bundle size becomes a problem
- Docker on Vercel: user has Docker uninstalled and project explicitly prohibits it for dev; use the Python runtime directly

---

## Full Stack Summary Table

| Concern | Library | Version | Status |
|---------|---------|---------|--------|
| API Framework | FastAPI | 0.111.0 | Existing |
| UI Framework | React | 19.2.4 | Existing |
| Database ORM | SQLAlchemy | 2.0.30 | Existing |
| Migrations | Alembic | 1.13.1 | Existing |
| Data Validation | Pydantic | 2.7.1 | Existing |
| Auth | python-jose + passlib | existing | Existing |
| Rich Text Editor | TipTap | 3.21.0 | Existing |
| ML | scikit-learn + XGBoost + SHAP | existing | Existing |
| HTML Templates | Jinja2 | 3.1.4 | Existing |
| Test Runner (Python) | pytest | 8.2.0 | Existing |
| Bundler | Vite | 8.0.1 | Existing |
| **Multi-provider AI** | **LiteLLM** | **1.83.x** | **Add** |
| **Import/Export** | **pandas** | **3.0.2** | **Add** |
| **Import/Export** | **openpyxl** | **3.1.5** | **Add** |
| **Server state (React)** | **TanStack Query** | **5.x** | **Add** |
| **Frontend tests** | **Vitest + RTL** | **latest** | **Add** |
| **Managed DB** | **Neon PostgreSQL** | N/A (hosted) | **Prod infra** |

---

## Installation

```bash
# Backend additions
pip install litellm==1.83.13 pandas==3.0.2 openpyxl==3.1.5

# Frontend additions
npm install @tanstack/react-query@5

# Frontend dev additions
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI abstraction | LiteLLM SDK | Raw OpenAI + Anthropic SDKs | Manual adapter duplicates LiteLLM's work; no custom endpoint support |
| AI abstraction | LiteLLM SDK | LangChain | 10x dependency weight, agent-framework coupling not needed for this use case |
| Excel parsing | pandas + openpyxl | xlrd | xlrd reads `.xls` only (pre-2007 Excel); openpyxl handles modern `.xlsx` |
| Server state | TanStack Query | Redux Toolkit | RTK is enterprise-scale boilerplate; overkill for a single-user app |
| Server state | TanStack Query + Context | Zustand | Adds dependency without filling a gap that Context doesn't cover |
| Frontend tests | Vitest | Jest | Jest requires duplicate Babel/transform config; Vitest reuses existing Vite pipeline |
| Managed DB | Neon | Supabase | Supabase BaaS features (auth, realtime) go unused; Neon's branching suits preview deployments better |
| Entity flexibility | JSONB + pydantic.create_model | EAV tables | EAV is notoriously slow and complex to query; JSONB with GIN indexes is the modern PostgreSQL answer |
| Deployment | Vercel Functions | Railway / Render | Project spec requires Vercel; document as fallback if 500MB bundle limit becomes binding |

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Bundle size exceeds 500MB on Vercel | High | Low-Medium | Strip unused assets in `excludeFiles`; profile with `vercel build --debug` |
| LiteLLM API surface changes (weekly releases) | Medium | Medium | Pin to a specific version in requirements.txt; review changelogs before upgrades |
| Pydantic dynamic models break OpenAPI schema generation | Medium | Low | Use `include_in_schema=False` or custom OpenAPI routes for dynamically-generated endpoints |
| Neon cold-start latency on free tier | Low | High | Use pooled connection string; accept sub-second cold starts on demo instances |
| pandas + ML libraries bloat Vercel bundle | High | Medium | Track uncompressed bundle size in CI; have Railway as documented fallback |

---

## Sources

- LiteLLM official docs: https://docs.litellm.ai/docs/
- LiteLLM PyPI (version confirmed): https://pypi.org/project/litellm/
- Vercel FastAPI deployment docs: https://vercel.com/docs/frameworks/backend/fastapi
- Vercel Python bundle size (500MB): https://vercel.com/changelog/python-vercel-functions-bundle-size-limit-increased-to-500mb
- Vercel function duration limits: https://vercel.com/docs/functions/limitations
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling
- TanStack Query v5: https://tanstack.com/query/latest
- Vitest: https://vitest.dev/
- pandas 3.0.2: https://pypi.org/project/pandas/
- openpyxl 3.1.5: https://pypi.org/project/openpyxl/
- Neon vs Supabase comparison: https://designrevision.com/blog/supabase-vs-neon
