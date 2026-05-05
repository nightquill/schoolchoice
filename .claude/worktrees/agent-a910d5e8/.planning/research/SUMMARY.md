# Project Research Summary

**Project:** DataPilot — AI-Powered SME Data Management Platform (refactored from schoolchoice v2.4.1)
**Domain:** Config-driven SME data management and analysis platform (boilerplate repo, single-tenant per deployment)
**Researched:** 2026-04-24
**Confidence:** HIGH (stack and architecture), MEDIUM (deployment and entity framework complexity)

## Executive Summary

DataPilot is a domain-agnostic, AI-powered data platform built for non-technical SME operators. The existing codebase (v2.4.1) is a fully working school choice advisory tool for HKDSE students that demonstrates the core value proposition — rules-filtered, ML-scored, AI-explained recommendations with rich plan generation — but is tightly coupled to school-choice domain logic. The platform refactor extracts a reusable foundation (entity framework, AI abstraction, import/export, consultant engine) while keeping the school choice module as the first working domain instance that validates every platform contract. The target architecture is a modular monolith: one deployable unit, internally structured as self-contained domain modules that plug into platform core infrastructure.

The recommended approach is additive and incremental. Nothing in the existing stack is replaced — FastAPI, React 19, PostgreSQL 15, SQLAlchemy 2.0, Alembic, Pydantic 2, and Vite are all locked. New additions are minimal and justified: LiteLLM for multi-provider AI (replaces the hardcoded Gemini SDK), pandas + openpyxl for import/export (absent today), TanStack Query for frontend server state (reduces the 1,450-line StudentProfile.jsx pattern), and Vitest + React Testing Library to establish a test baseline before any component decomposition. The Strangler Fig pattern is mandatory — school choice features must work at every commit, not just at phase boundaries, because the school choice module is the only proof that the platform contracts are correct.

The dominant risk is refactoring without adequate regression coverage. The frontend has zero tests; the backend has 60 tests but 14/17 v1 endpoints are uncovered. A secondary risk is over-engineering the config-driven entity framework before a second domain module exists to validate the abstractions. The mitigation for both is the same: build exactly what school choice needs, make it work end-to-end, then generalize. Do not speculate ahead of concrete demand.

---

## Key Findings

### Recommended Stack

The existing stack is the stack. All additions sit on top of it without replacing anything. The four meaningful additions are: (1) LiteLLM 1.83.x as the universal AI provider adapter — it provides a single `completion()` call across 100+ providers including OpenAI, Anthropic, Gemini, and any OpenAI-compatible endpoint (Ollama, Together AI, self-hosted vLLM), which is exactly what BYOK requires; (2) pandas 3.0.2 + openpyxl 3.1.5 for CSV/Excel import/export, a critically missing feature; (3) TanStack Query v5 for frontend server state to replace the manual useState/useEffect/axios pattern that produced the 46-hook StudentProfile component; and (4) Vitest + React Testing Library as the frontend test foundation. For production deployment, Neon PostgreSQL (over Supabase) is preferred because Supabase's BaaS features go unused in a FastAPI-auth project and Neon's branching suits Vercel preview deployments. The Vercel bundle will run approximately 380–430MB against a 500MB limit — tight but workable with careful asset exclusions.

**Core technologies:**
- **LiteLLM 1.83.x** — multi-provider AI abstraction — single `completion()` interface across all providers, handles streaming, error normalization, BYOK key passthrough per request
- **pandas 3.0.2 + openpyxl 3.1.5** — CSV/Excel import/export — the dependency tree already has numpy via scikit-learn, so the marginal cost is low
- **TanStack Query v5** — React server state — eliminates the manual fetch/cache/refetch pattern that caused the monolithic StudentProfile component
- **Vitest + React Testing Library** — frontend tests — reuses the existing Vite pipeline; prerequisite before any component decomposition
- **Neon PostgreSQL** (production) — managed DB with Vercel branching integration and PgBouncer pooling endpoint
- **JSONB + pydantic.create_model()** — config-driven entity fields — extends the existing pattern already used for `StudentProfile.extra_fields`

### Expected Features

The primary user is a non-technical business operator. Every feature must pass the test: "Can this person use it without reading a manual?"

**Must have (table stakes):**
- JWT authentication + RBAC (admin/staff roles minimum) — multi-user deployments are unsafe without it
- Config-driven entity CRUD with flexible fields — the platform's core abstraction
- CSV/Excel import with column-mapping UI — the on-ramp for new deployments; absence is the most-cited missing feature
- Data export (CSV for raw data, HTML for reports) — how the platform proves value externally
- Search and filtering on entity lists — any list over 20 records without search is unusable
- AI freeform Q&A (chat against entity data) — the primary AI value proposition
- AI guided workflow (step-based decision support) — produces consistent, auditable outputs vs. ad-hoc chat
- Dashboard with domain-configurable metrics — the homepage experience
- Health check with feature flags (ai_provider_configured, ml_model_loaded) — operational visibility for operators
- Deployment template (Vercel + Neon with parameterized secrets) — the platform must actually be deployable

**Should have (differentiators):**
- BYOK AI provider support (OpenAI, Anthropic, custom OpenAI-compatible URL) — no comparable open-source SME platform offers this as first-class config
- Domain module system (school_choice as first instance, with defined interface for second) — the platform's architectural identity
- Hybrid AI recommendation engine (eligibility rules + XGBoost + SHAP explainability) — auditable, trusted recommendations vs. black-box AI
- Eligibility confidence indicators ("this match is LOW confidence because field X is missing") — easy to add, high trust value
- TipTap rich-text section editing of AI-generated reports — already exists, must survive refactoring
- Background task transparency (progress/status for long-running operations) — already exists as a pattern, needs surface-level generalization

**Defer (v2+):**
- PDF export via headless browser — HTML export is sufficient initially; server-side PDF adds infra complexity
- Full domain module system for a second domain (HR, CRM) — build the interface after school choice proves it works
- Live external system connectors (QuickBooks, Salesforce) — design import/export schema for compatibility; build connectors later
- Drag-and-drop dashboard customization — domain config-driven layout is sufficient; this is an explicit anti-feature

### Architecture Approach

The target is a modular monolith with a strict one-way dependency rule: domain modules depend on platform core; platform core never depends on domain modules. Platform core provides the invariant infrastructure (auth, entity config loader, AI abstraction, import/export engine, shared DB layer). Domain modules (school_choice, future HR/CRM) are self-contained folders with their own models, routes, services, schemas, config.yaml, and workflow definitions. The frontend mirrors this structure with a platform component library (EntityTable, EntityForm, FieldMapper, AIChat, WorkflowWizard) and domain-specific page overrides registered via module manifests. The AI abstraction layer wraps LiteLLM with three exposed operations: `complete()`, `stream()`, `health_check()`. Import is a five-stage pipeline: parse → map → validate → stage → commit, with a user-confirmation step before any data is written to entity tables.

**Major components:**
1. **Platform Core** — config.py, security.py, entity_config loader, AI provider wrapper, import/export pipeline, shared DB session
2. **School Choice Domain Module** — models, routes, services (matchmaker + plan generator), config.yaml, workflow definitions; simultaneously the first customer and the regression test for every platform contract
3. **Consultant Engine** — freeform chat service (entity-aware, SSE-streamed) and guided workflow engine (YAML-defined steps, persisted session state)
4. **Frontend Platform Layer** — generic EntityTable, EntityForm, FieldMapper, AIChat, WorkflowWizard components; domain modules register page overrides via module manifests
5. **Deployment Layer** — Vercel static (frontend) + Vercel Functions (FastAPI backend) + Neon PostgreSQL with pooled/direct URL separation for migrations

### Critical Pitfalls

1. **Breaking school choice while refactoring** — Use the Strangler Fig pattern strictly: all 60 existing tests must pass at every commit. Add a Playwright smoke test suite covering the five highest-risk paths (student CRUD, matchmaker run, plan generation, AI chat, school search) before any structural changes begin. Keep v1 API routes alive and aliased to new routes rather than deleting them.

2. **ORM-schema drift during refactoring** — The codebase has two parallel schema evolution mechanisms (Alembic + runtime `ALTER TABLE IF NOT EXISTS`). Before touching any schema code, implement the startup column parity check described in CONCERNS.md, consolidate to Alembic as the sole migration mechanism, and enforce the rule that config-driven entity definitions never generate DDL at runtime.

3. **Over-engineering the entity config system** — Build exactly what school choice needs. Apply the rule of three: a config abstraction is only warranted when three distinct domain modules need it. Config expresses structure (fields, labels, types); modules express behavior (algorithms, scoring). Maximum 15 top-level config keys before it's a warning sign.

4. **Leaky AI provider abstraction** — Do not build a custom abstraction. Wrap LiteLLM in a thin DataPilot interface exposing three operations. Keep provider-specific params accessible via a passthrough `extra` dict. Store AI keys in environment variables only — never in the database. Pin LiteLLM version and review changelogs quarterly (a 2026 supply chain incident affected LiteLLM users).

5. **Refactoring the frontend without tests** — The frontend has zero tests. Vitest + React Testing Library must be set up and characterization tests must be written against current StudentProfile behavior before any component decomposition begins. Split one tab at a time, never all at once. No PR > 500 lines of net change during decomposition.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Platform Foundation and School Choice Migration

**Rationale:** All downstream work depends on having a stable platform core with a working domain module. The entity framework, auth consolidation, API version consolidation, and school choice migration to the new module structure must all happen together — they are inseparable because school choice is the only real test of the platform contracts. The ORM-schema drift and Strangler Fig pitfalls both apply maximally here.

**Delivers:** A functional platform with school choice running on the new module structure. All 60 existing tests still passing. Startup column parity check in place. Alembic as the sole migration mechanism. HKDSE-specific logic fully contained inside the school_choice module folder. v1/v2 API routes consolidated to a single version.

**Addresses (from FEATURES.md):** Entity CRUD with flexible fields, search and filtering, dashboard with domain-configurable metrics, health check with feature flags.

**Avoids (from PITFALLS.md):** ORM-schema drift (Alembic consolidation before touching schema), breaking school choice (Strangler Fig + smoke tests), HKDSE logic leaking into platform (full-codebase grep audit), v1/v2 duplication calcifying (consolidate before adding generic entity API).

**Prerequisites to implement first within this phase:** Startup column parity check, Alembic consolidation, HKDSE grep audit, v1/v2 route consolidation.

---

### Phase 2: AI Provider Abstraction and BYOK

**Rationale:** The existing Gemini SDK is hardcoded. Every AI feature in subsequent phases (freeform Q&A, guided workflows) must be built on the new abstraction layer, not on Gemini directly. Building the abstraction before expanding AI features prevents the leaky-abstraction pitfall from compounding.

**Delivers:** LiteLLM-backed AI provider layer with `complete()`, `stream()`, `health_check()` interface. Environment-variable-only key storage enforced from the first line. School choice plan chat and AI features migrated to the new layer and verified working with at least OpenAI-compatible + Anthropic. BYOK configuration documented in `.env.example`.

**Uses (from STACK.md):** LiteLLM 1.83.x, FastAPI StreamingResponse + SSE.

**Implements (from ARCHITECTURE.md):** `core/ai/provider.py`, `core/ai/config.py`; BYOK AI config flow.

**Avoids (from PITFALLS.md):** Leaky AI abstraction (wrap LiteLLM, don't build from scratch), BYOK keys in database (env-only pattern enforced here, not retrofitted later).

**Research flag:** Test each provider (OpenAI, Anthropic, OpenAI-compatible) with real plan chat context (large JSON payload, expects JSON patch response) before declaring this phase complete — this is where provider-specific differences surface.

---

### Phase 3: Frontend Stabilization and Test Coverage

**Rationale:** The frontend has zero tests and a 1,450-line monolithic component. Any further feature work that touches the frontend without a test baseline compounds technical debt. This phase unblocks safe component decomposition and introduces TanStack Query to eliminate the root cause of the monolithic pattern.

**Delivers:** Vitest + React Testing Library installed and configured. Characterization tests covering StudentProfile's existing behavior. StudentProfile decomposed into sub-components (one tab at a time, one PR at a time). TanStack Query introduced for server state. Generic platform components begun (EntityTable, EntityForm as the first two).

**Uses (from STACK.md):** TanStack Query v5, Vitest + React Testing Library.

**Avoids (from PITFALLS.md):** Refactoring frontend without tests (tests before any split), StudentProfile regression (characterization-first approach, tab-by-tab decomposition).

---

### Phase 4: Import/Export System

**Rationale:** Import is the most-cited missing feature and the on-ramp for new deployments. It requires the entity config loader (Phase 1) to be stable before it can validate rows against entity definitions. Scoping it tightly is critical — the import/export system has a documented tendency to expand into ETL territory.

**Delivers:** CSV/Excel upload with pandas parsing, column-mapping UI (FieldMapper React component), row validation against EntityConfig with structured error report, user-confirmation step, commit to entity tables. CSV export for entity data. HTML export for reports (PDF export deferred). Error export: failing rows downloadable as CSV with error column.

**Uses (from STACK.md):** pandas 3.0.2, openpyxl 3.1.5, FastAPI multipart upload.

**Implements (from ARCHITECTURE.md):** `core/importer/` five-stage pipeline, `frontend/src/platform/components/FieldMapper/`.

**Avoids (from PITFALLS.md):** Import scope creep into ETL (hard scope: no duplicate detection, no transform rules, no browser-based data cleaning in first pass; maximum two weeks allocated).

---

### Phase 5: Consultant Engine (Freeform Chat + Guided Workflows)

**Rationale:** AI chat and guided workflows are the primary differentiators, but they require a stable AI abstraction layer (Phase 2) and entity data (Phase 1) to be meaningful. The guided workflow engine is a significant build; scoping freeform chat first provides a simpler starting point that validates the SSE streaming pattern before the more complex stateful workflow system.

**Delivers:** Freeform AI chat against any entity type (SSE-streamed, entity-context-aware). Guided workflow engine (YAML-defined steps, persisted WorkflowSession state). School choice fit analysis workflow migrated to the new engine. WorkflowWizard React component. Background task transparency UI for long-running AI operations.

**Implements (from ARCHITECTURE.md):** `core/consultant/chat_service.py`, `core/consultant/workflow_engine.py`, `WorkflowSession` DB model, `frontend/src/platform/components/AIChat/`, `WorkflowWizard/`.

**Avoids (from PITFALLS.md):** Plan generator templating debt replicated (migrate plan generator from f-string HTML to Jinja2 templates as a prerequisite before building the consultant module), workflow engine becoming a catch-all (workflow engine handles consultant interactions only; matching, plan generation, and import remain separate services).

**Research flag:** SSE streaming across different AI providers has minor behavioral differences (chunk sizes, done signaling). Verify the streaming behavior with each supported provider before marking this phase complete.

---

### Phase 6: Deployment Template and Production Readiness

**Rationale:** Deployment configuration is last because it is meaningless to create a deployment template for a half-refactored application. Once all platform components are stable and school choice is fully working on the platform, the deployment template becomes a documentation and configuration exercise rather than an infrastructure guess.

**Delivers:** `vercel.json` with `excludeFiles` configured to strip unnecessary ML assets and keep bundle under 500MB. Neon PostgreSQL with pooled connection string for application and direct URL for Alembic migrations. `.env.example` with all required secrets documented. `generate_secrets.sh` for cryptographically random secret generation. Startup validation that rejects default/example secret values. `scripts/seed_demo.py` that loads school choice seed data with a demo user so any clone is immediately demo-able. DEPLOYMENT.md first-deploy walkthrough.

**Avoids (from PITFALLS.md):** Production secrets not configured (startup secret validation enforced, `generate_secrets.sh` as documented first step), platform too generic to be useful (seed_demo.py and demo user are part of this phase's deliverables, not documentation deferred to later).

**Research flag:** Verify actual Vercel bundle size with `vercel build --debug` against the real dependency tree. If it exceeds 500MB, Railway/Render is the documented fallback — do not spend time optimizing beyond what `excludeFiles` provides.

---

### Phase Ordering Rationale

- **Platform foundation before AI features** — the entity framework and module structure must be stable before AI features can be built on top of them. AI chat without entity data is a generic chatbot; BYOK without the abstraction layer is still Gemini-only.
- **AI abstraction before expanding AI features** — building any new AI capability on the hardcoded Gemini SDK would require refactoring twice. Phase 2 prevents this.
- **Tests before component decomposition** — the frontend decomposition is the highest-risk pure-code refactor. Without tests, regressions are invisible until counselors report broken behavior.
- **Import before consultant engine** — import is simpler (stateless pipeline) and has harder scope boundaries. Proving the entity config loader works for import validates the same contracts that the consultant engine will rely on for entity context.
- **Deployment last** — the template is a snapshot of a complete, working system. Premature deployment templates create pressure to stabilize before the platform is ready.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 2 (AI Provider Abstraction):** Provider-specific streaming behavior, error format differences, and large-context handling (plan chat sends full plan JSON) need verification against each supported provider before the abstraction contract is finalized. LiteLLM's changelog must be reviewed before version pinning.
- **Phase 5 (Consultant Engine):** The guided workflow engine has no direct prior art in the codebase. The YAML workflow definition format and WorkflowSession state machine need design validation before implementation begins. Consider a spike on the simplest possible workflow (two steps: user input + AI response) before designing the full engine.
- **Phase 6 (Deployment):** Actual Vercel bundle size must be measured empirically. If it exceeds 500MB, an alternative deployment target (Railway, Fly.io) needs a spike to confirm feasibility before the phase begins.

Phases with standard patterns (research-phase optional):

- **Phase 1 (Platform Foundation):** Modular monolith patterns for FastAPI are well-documented. The Strangler Fig pattern is well-understood. The main risk is execution discipline, not knowledge gaps.
- **Phase 3 (Frontend Stabilization):** Vitest + RTL + TanStack Query are all well-documented and widely used with Vite/React. Standard patterns apply.
- **Phase 4 (Import/Export):** pandas file parsing is well-documented and the five-stage pipeline pattern is straightforward. Risk is scope creep, not technical uncertainty.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions verified against official docs and PyPI. Existing stack is locked. Vercel bundle size is estimated (MEDIUM within HIGH) — must be measured empirically. |
| Features | HIGH for table stakes, MEDIUM for differentiators | Table stakes derived from existing codebase gaps and CONCERNS.md. Differentiators validated against market signals but limited open-source boilerplate comparisons exist. |
| Architecture | HIGH | Modular monolith pattern is well-established for FastAPI. Component boundaries and data flows are derived from first-principles analysis of existing codebase. JSONB + pydantic.create_model() is validated by existing usage in StudentProfile. |
| Pitfalls | HIGH | Pitfalls derived from existing CONCERNS.md issues (documented bugs), codebase-specific patterns (dual migration mechanism, zero frontend tests), and verified external sources on refactoring and LLM abstraction. |

**Overall confidence:** HIGH

### Gaps to Address

- **Entity config schema scope:** Research recommends building exactly what school choice needs. The exact set of required config keys (field types, validation rules, relationship types) is not fully enumerated. A config key inventory derived from the existing school choice codebase should be produced at the start of Phase 1 before any new config schema is designed.
- **XGBoost model portability:** When a second domain module (HR, CRM) is introduced, the pre-trained school choice XGBoost model is irrelevant. The platform layer must not assume a model file exists. This is deferred — the platform should document that domain modules either ship a pre-trained model or fall back to weighted scoring — but it needs a design decision before Phase 5 (consultant engine) ships workflow results that reference ML scores.
- **LiteLLM supply chain risk:** A 2026 supply chain incident affected LiteLLM users. Version must be pinned in requirements.txt and changelogs reviewed before upgrades. No mitigation beyond version pinning and monitoring is proposed in the research; this should be acknowledged in the deployment security checklist.
- **Vercel bundle size empirical validation:** The ~380–430MB estimate is based on uncompressed dependency sizes. Actual Vercel bundle size must be verified with `vercel build --debug` early in Phase 6, with Railway/Render documented as a tested fallback if the limit is exceeded.

---

## Sources

### Primary (HIGH confidence)
- LiteLLM official docs (https://docs.litellm.ai/) — BYOK pattern, per-request api_key/api_base override, streaming behavior
- Vercel FastAPI deployment docs (https://vercel.com/docs/frameworks/backend/fastapi) — Python runtime, bundle size limits
- Vercel Python bundle size changelog (https://vercel.com/changelog/python-vercel-functions-bundle-size-limit-increased-to-500mb) — 500MB limit confirmed February 2026
- Neon connection pooling docs (https://neon.com/docs/connect/connection-pooling) — pooled vs. direct URL pattern for Alembic
- TanStack Query v5 (https://tanstack.com/query/latest) — server state management
- FastAPI Bigger Applications (https://fastapi.tiangolo.com/tutorial/bigger-applications/) — module router structure
- Strangler Fig Pattern — Microsoft Azure Architecture Center (https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- Vitest (https://vitest.dev/) — Vite-native test runner

### Secondary (MEDIUM confidence)
- Neon vs. Supabase comparison (https://designrevision.com/blog/supabase-vs-neon) — Neon preferred for FastAPI-auth projects
- FastAPI Modular Monolith Starter Kit (https://github.com/arctikant/fastapi-modular-monolith-starter-kit) — module boundary patterns
- zhanymkanov/fastapi-best-practices (https://github.com/zhanymkanov/fastapi-best-practices) — thin routes, fat services convention
- PostgreSQL JSONB vs. EAV (https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/) — JSONB with GIN indexing preferred
- LiteLLM in Production — PyData Berlin 2025 (https://cfp.pydata.org/berlin2025/talk/NUNXEV/) — production maintenance overhead context

### Tertiary (LOW confidence — single source or inference)
- LiteLLM Security Incident 2026 — Ardan Labs (https://www.ardanlabs.com/news/2026/ai-security-supply-chain-problem-litellm-incident-signals/) — supply chain risk; mitigation is version pinning
- Premature abstraction study (2025) — cited in PITFALLS.md; 40% harder to review, 25% higher bug rate — informative but not independently verified
- Best AI Platforms for SMEs 2026 — Analytics Insight — market signals for differentiator validation; MEDIUM confidence only

*Internal sources: PROJECT.md (2026-04-24), CONCERNS.md (2026-04-24), codebase ARCHITECTURE.md (2026-04-24)*

---
*Research completed: 2026-04-24*
*Ready for roadmap: yes*
