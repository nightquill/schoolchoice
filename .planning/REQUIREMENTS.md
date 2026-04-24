# Requirements: DataPilot

**Defined:** 2026-04-24
**Core Value:** A non-technical business owner can deploy an instance, configure it for their domain, import their data, and get AI-driven analysis and recommendations — all without touching code.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Platform Core

- [ ] **PLAT-01**: Developer can define entities (fields, types, labels, validation rules) via YAML config without writing Python models
- [ ] **PLAT-02**: Platform auto-generates CRUD API endpoints from entity config at startup
- [ ] **PLAT-03**: Platform auto-generates frontend forms and list views from entity config
- [ ] **PLAT-04**: Developer can create a domain module as a self-contained folder (models, routes, services, schemas, UI components, config.yaml)
- [ ] **PLAT-05**: Domain module registers itself via a manifest file; platform discovers and loads modules at startup
- [ ] **PLAT-06**: School choice app functions as a domain module on the platform with all existing features preserved
- [ ] **PLAT-07**: v1 and v2 API routes consolidated into a single clean API layer (no duplication)
- [ ] **PLAT-08**: ORM-schema parity check runs at startup and logs warnings for drift

### AI Integration

- [ ] **AI-01**: Deployer can configure any AI provider (OpenAI, Anthropic, OpenAI-compatible endpoint, custom URL) via environment variables
- [ ] **AI-02**: AI provider abstraction (LiteLLM) routes all AI calls through a single interface regardless of configured provider
- [ ] **AI-03**: Deployer can bring their own API key (BYOK) — key stored in environment, never exposed to frontend
- [ ] **AI-04**: Developer can define guided AI workflows in YAML (step sequences with AI calls at designated steps)
- [ ] **AI-05**: Guided workflow engine executes YAML-defined workflows with session state persisted between steps
- [ ] **AI-06**: School choice plan generation rebuilt as a guided workflow on the platform engine
- [ ] **AI-07**: Hybrid recommendation engine generalized: configurable eligibility rules + weighted scoring + optional ML model per domain
- [ ] **AI-08**: SHAP explainability available for any domain module using the ML scoring component
- [ ] **AI-09**: Eligibility confidence indicator shows data completeness level on each recommendation
- [ ] **AI-10**: AI chat for plan/report modification works with any configured provider (not just Gemini)

### Data Management

- [ ] **DATA-01**: User can import CSV files with a column mapping UI (map file columns to entity fields)
- [ ] **DATA-02**: User can import Excel files (.xlsx) with sheet selection and column mapping
- [ ] **DATA-03**: Import pipeline validates data before committing (preview, error summary, approve/reject)
- [ ] **DATA-04**: User can export entity data as CSV
- [ ] **DATA-05**: User can export reports/plans as PDF
- [ ] **DATA-06**: User can export reports/plans as HTML
- [ ] **DATA-07**: User can search entity lists with text search across indexed fields
- [ ] **DATA-08**: User can filter entity lists by field values (dropdowns, date ranges, numeric ranges)

### UX & Frontend

- [ ] **UX-01**: Frontend test suite established (Vitest + React Testing Library) with characterization tests for critical pages
- [ ] **UX-02**: StudentProfile.jsx decomposed into independent tab components (Personal, Grades, Language, Evaluations, Activities, Notes, Plans)
- [ ] **UX-03**: TanStack Query replaces manual useState/useEffect for server state management
- [ ] **UX-04**: UI is polished and professional — consistent spacing, typography, color system suitable for non-technical business users
- [ ] **UX-05**: All pages are mobile-responsive
- [ ] **UX-06**: Config-driven dashboard layout per domain module (3-5 key metrics defined in module config)
- [ ] **UX-07**: Rich text section editing (TipTap) preserved and available for any report/plan type
- [ ] **UX-08**: Template switching (professional, modern, minimal) generalized to any report type

### Security & Operations

- [ ] **SEC-01**: RBAC with at minimum admin and staff roles, enforced at API route level
- [ ] **SEC-02**: Admin can manage user accounts and assign roles
- [ ] **SEC-03**: Health check endpoint reports: database status, AI provider configured, ML model loaded, background jobs status
- [ ] **SEC-04**: CORS origins configurable via environment variable (not hardcoded)
- [ ] **SEC-05**: All user-provided content HTML-escaped in generated reports (XSS prevention)

### Bug Fixes

- [ ] **BUG-01**: Chat rate limiting uses rolling 24-hour window instead of date strings
- [ ] **BUG-02**: Matchmaker shows eligibility confidence indicator for incomplete data (mock grades, missing fields)
- [ ] **BUG-03**: School name duplication resolved in API responses (single source of truth)
- [ ] **BUG-04**: HTML escaping applied consistently in plan generator for all user-provided strings
- [ ] **BUG-05**: XGBoost model fallback logs a warning at startup and reports status via health endpoint

### Deployment

- [ ] **DEP-01**: Vercel deployment configuration for frontend (static build)
- [ ] **DEP-02**: Managed PostgreSQL setup documented (Neon recommended, Supabase supported)
- [ ] **DEP-03**: Backend deployable to Vercel serverless functions or alternative host (Railway/Render) with clear instructions
- [ ] **DEP-04**: Environment variable template with all required and optional vars documented
- [ ] **DEP-05**: Seed data script for demo deployment (school choice sample data)
- [ ] **DEP-06**: Secret generation script for fresh deployments

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### AI Expansion

- **AI-V2-01**: Freeform Q&A chat against any entity data in the platform
- **AI-V2-02**: AI-generated entity schema suggestions from natural language description
- **AI-V2-03**: Automated data quality scoring and cleanup suggestions

### Data Expansion

- **DATA-V2-01**: Live connectors to external systems (QuickBooks, Salesforce, Xero)
- **DATA-V2-02**: Scheduled data import from URLs or APIs
- **DATA-V2-03**: Audit log for all data mutations

### UX Expansion

- **UX-V2-01**: Drag-and-drop dashboard widget customization
- **UX-V2-02**: User-facing notification system (in-app + email)
- **UX-V2-03**: Multi-language UI support (i18n)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant SaaS | Each deployment is independent; simpler auth and data isolation model |
| Mobile native apps | Responsive web sufficient; native adds codebase and maintenance burden |
| Real-time collaboration | Single-user interaction model; CRDT/OT complexity not justified |
| Payment/subscription management | Not a SaaS product; billing handled externally by operator |
| Self-service module marketplace | Modules require Python backend logic; security/quality risk from user-created modules |
| Full-text search (Elasticsearch) | Indexed column search sufficient for SME scale (<10K records) |
| AI-generated database schemas | Produces fragile schemas; config-driven YAML is predictable and debuggable |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 3 | Pending |
| PLAT-04 | Phase 1 | Pending |
| PLAT-05 | Phase 1 | Pending |
| PLAT-06 | Phase 1 | Pending |
| PLAT-07 | Phase 1 | Pending |
| PLAT-08 | Phase 1 | Pending |
| AI-01 | Phase 2 | Pending |
| AI-02 | Phase 2 | Pending |
| AI-03 | Phase 2 | Pending |
| AI-04 | Phase 5 | Pending |
| AI-05 | Phase 5 | Pending |
| AI-06 | Phase 5 | Pending |
| AI-07 | Phase 5 | Pending |
| AI-08 | Phase 5 | Pending |
| AI-09 | Phase 5 | Pending |
| AI-10 | Phase 2 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |
| DATA-05 | Phase 4 | Pending |
| DATA-06 | Phase 4 | Pending |
| DATA-07 | Phase 4 | Pending |
| DATA-08 | Phase 4 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 3 | Pending |
| UX-05 | Phase 3 | Pending |
| UX-06 | Phase 3 | Pending |
| UX-07 | Phase 3 | Pending |
| UX-08 | Phase 3 | Pending |
| SEC-01 | Phase 6 | Pending |
| SEC-02 | Phase 6 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Pending |
| SEC-05 | Phase 1 | Pending |
| BUG-01 | Phase 1 | Pending |
| BUG-02 | Phase 1 | Pending |
| BUG-03 | Phase 1 | Pending |
| BUG-04 | Phase 1 | Pending |
| BUG-05 | Phase 1 | Pending |
| DEP-01 | Phase 6 | Pending |
| DEP-02 | Phase 6 | Pending |
| DEP-03 | Phase 6 | Pending |
| DEP-04 | Phase 6 | Pending |
| DEP-05 | Phase 6 | Pending |
| DEP-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 43 total (note: DATA-05 PDF export is in scope but implementation approach revisited at Phase 4 planning — may defer headless-browser PDF to v2 in favor of HTML export)
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation — full traceability mapped*
