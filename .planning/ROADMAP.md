# Roadmap: DataPilot

## Overview

DataPilot is built by extracting a reusable platform from a working school choice app (v2.4.1) without breaking it. The journey runs in six phases: stabilize and modularize the existing codebase into a platform foundation, abstract AI provider access, shore up the frontend with tests and decomposition, add import/export as the primary data on-ramp, build the AI consultant engine as the platform's differentiator, then ship a production-ready deployment template. School choice must work at every commit throughout — it is the proof that every platform contract is correct.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Platform Foundation** - Modularize the codebase, migrate school choice to the domain module structure, consolidate APIs, and fix infrastructure-level bugs
- [ ] **Phase 2: AI Provider Abstraction** - Replace hardcoded Gemini with LiteLLM multi-provider layer and BYOK config
- [ ] **Phase 3: Frontend Stabilization** - Establish test coverage, decompose StudentProfile, introduce TanStack Query, and build platform-level UI components
- [ ] **Phase 4: Import and Export** - CSV/Excel import with column-mapping UI, data export, and report export
- [ ] **Phase 5: Consultant Engine** - Freeform AI chat and YAML-driven guided workflow engine with school choice workflow migrated
- [ ] **Phase 6: Deployment and Production Readiness** - Vercel + Neon deployment template, secrets management, RBAC enforcement, and demo seed

## Phase Details

### Phase 1: Platform Foundation
**Goal**: The school choice app runs on a modular platform structure with all existing features preserved, v1/v2 APIs consolidated, config-driven entity layer in place, and infrastructure bugs resolved
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-04, PLAT-05, PLAT-06, PLAT-07, PLAT-08, SEC-03, SEC-04, SEC-05, BUG-01, BUG-02, BUG-03, BUG-04, BUG-05
**Success Criteria** (what must be TRUE):
  1. Developer can define a new entity (name, fields, types, validation rules) in a YAML config file and the platform auto-generates working CRUD API endpoints at startup without writing any Python
  2. School choice app loads and all existing features work (student CRUD, matchmaker, plan generation, AI chat, school search) with all 60 backend tests still passing
  3. HKDSE-specific logic is fully contained inside a `modules/school_choice/` folder — a project-wide grep finds no school-choice domain references in `core/`
  4. A single API version handles all requests — no v1/v2 duplication in routes
  5. Startup logs report ORM-schema parity check result, XGBoost model status, and CORS origin in use; health endpoint returns all three
**Plans:** 6 plans

Plans:
- [ ] 01-01-PLAN.md — Bug fixes (BUG-01 through BUG-04), HTML escaping (SEC-05), SQLite test fix, PyYAML dependency
- [ ] 01-02-PLAN.md — Platform entity layer: YAML parser, entity registry, CRUD generator (PLAT-01, PLAT-02)
- [ ] 01-03-PLAN.md — Module loader, health infrastructure, ORM parity check (PLAT-04, PLAT-05, PLAT-08, SEC-03, SEC-04, BUG-05)
- [ ] 01-04-PLAN.md — Domain model extraction to modules/school_choice/models/ with re-export stubs (PLAT-06)
- [ ] 01-05-PLAN.md — Service extraction to modules/school_choice/services/ via strangler fig (PLAT-06)
- [ ] 01-06-PLAN.md — Wire module loader + health into main.py, API consolidation, integration tests (PLAT-07)

### Phase 2: AI Provider Abstraction
**Goal**: All AI calls route through a single LiteLLM-backed interface; school choice plan chat and AI features work with any configured provider; BYOK API key config is fully environment-variable-driven
**Depends on**: Phase 1
**Requirements**: AI-01, AI-02, AI-03, AI-10
**Success Criteria** (what must be TRUE):
  1. Deployer can switch AI provider (OpenAI, Anthropic, Gemini, or any OpenAI-compatible URL) by changing two environment variables — no code changes required
  2. School choice plan chat works end-to-end (returns a modified plan) with at least two different configured providers verified in sequence
  3. AI provider API keys exist only in environment variables — no key material appears in the database, logs, or any API response
  4. Health endpoint reports which AI provider is configured and whether it is reachable
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — AI config settings, LiteLLM ai_service.py wrapper, dependency updates, unit tests (AI-01, AI-02, AI-03)
- [x] 02-02-PLAN.md — Migrate plan_chat_service from Gemini SDK to call_ai(), extend health with AI status, update tests (AI-10)
- [x] 02-03-PLAN.md — Manual verification script and human checkpoint with real AI provider (AI-01, AI-02, AI-10)

### Phase 3: Frontend Stabilization
**Goal**: The frontend has a working test baseline, StudentProfile is decomposed into independent tab components, TanStack Query manages server state, and the UI is polished and professional
**Depends on**: Phase 2
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08, PLAT-03
**Success Criteria** (what must be TRUE):
  1. Vitest + React Testing Library are configured and characterization tests exist for StudentProfile — a component decomposition does not silently break existing behavior
  2. StudentProfile renders as independent tab components (Personal, Grades, Language, Evaluations, Activities, Notes, Plans) and each tab can be navigated without reloading the page
  3. Adding a new entity via YAML config results in a generated list view and form appearing in the frontend without writing React code
  4. UI is consistent throughout — spacing, typography, and color are uniform across all pages and the interface reads as professional to a non-technical business owner
  5. All pages render correctly on a 375px-wide mobile viewport with no horizontal overflow
**Plans:** 6 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Infrastructure: Vitest + RTL, TanStack Query, Tailwind v3 + shadcn init, @ alias, backend entity endpoints (UX-01, UX-04, PLAT-03)
- [ ] 03-02-PLAN.md — QueryClientProvider + QueryBoundary + characterization tests for StudentProfile monolith (UX-01, UX-03)
- [ ] 03-03-PLAN.md — StudentProfile decomposition: 7 tab components + 7 custom hooks + parent rewrite (UX-02, UX-03)
- [ ] 03-04-PLAN.md — Config-driven entity UI: API layer, EntityListView, EntityForm, field type map, entity pages, dynamic nav (PLAT-03)
- [ ] 03-05-PLAN.md — shadcn/ui component replacements (Button, Dialog, Tabs, Input, Card, Sonner) + UI polish (UX-04)
- [ ] 03-06-PLAN.md — Mobile responsive, config-driven dashboard, TipTap preservation, template switching (UX-05, UX-06, UX-07, UX-08)

### Phase 4: Import and Export
**Goal**: Users can import CSV and Excel files into any entity with a column-mapping UI and validation preview; users can export entity data as CSV and reports as HTML
**Depends on**: Phase 3
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV or Excel file, see a column-mapping UI that matches file columns to entity fields, review a validation error summary, and approve import — data appears in the entity list only after explicit confirmation
  2. Rows that fail validation are downloadable as a CSV with an added error description column
  3. User can export any entity list to CSV — the downloaded file contains all visible fields for all filtered rows
  4. User can export any generated report or plan as an HTML file that renders correctly when opened in a browser
  5. User can search any entity list by typing text and can filter by field values using dropdowns, date ranges, or numeric range inputs
**Plans**: TBD
**UI hint**: yes

### Phase 5: Consultant Engine
**Goal**: Users can ask freeform AI questions about their entity data and run structured guided workflows; school choice plan generation is migrated to the workflow engine; recommendation engine is generalized across domains
**Depends on**: Phase 4
**Requirements**: AI-04, AI-05, AI-06, AI-07, AI-08, AI-09
**Success Criteria** (what must be TRUE):
  1. User can open an AI chat panel for any entity, ask a question about that entity's data, and receive a streamed response without a page reload
  2. User can run the school choice fit analysis as a guided multi-step workflow — each step presents a prompt, accepts input, and the workflow produces a final structured plan
  3. Developer can define a new guided workflow by writing a YAML file — no Python code changes required to add workflow steps or AI prompt templates
  4. Each school recommendation displays an eligibility confidence indicator (e.g., LOW / MEDIUM / HIGH) reflecting how complete the student's data is
  5. The hybrid recommendation engine (eligibility rules + weighted scoring + optional XGBoost) works for the school choice domain and the configuration interface allows a second domain to plug in its own rules and weights
**Plans**: TBD
**UI hint**: yes

### Phase 6: Deployment and Production Readiness
**Goal**: Any developer can clone the repo, follow a documented setup, and have a running production instance on Vercel + Neon with a seeded demo in under an hour; RBAC enforces admin/staff roles throughout
**Depends on**: Phase 5
**Requirements**: SEC-01, SEC-02, DEP-01, DEP-02, DEP-03, DEP-04, DEP-05, DEP-06
**Success Criteria** (what must be TRUE):
  1. A staff user cannot access admin-only routes (user management, role assignment) — the API returns 403 for any unauthorized attempt
  2. Admin user can create a new user account and assign it a role via the UI — the new user can log in and see only role-appropriate features
  3. Running `vercel build` completes successfully and the output bundle is under 500MB; `vercel deploy` produces a working frontend that connects to the configured backend
  4. Running `./scripts/generate_secrets.sh` produces a complete `.env` file; starting the backend with placeholder/example secrets fails with a clear startup error rather than running insecurely
  5. Running `python scripts/seed_demo.py` populates the database with school choice sample data and a demo user — the app is immediately usable for a demo without additional configuration
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation | 0/6 | Planning complete | - |
| 2. AI Provider Abstraction | 0/3 | Planning complete | - |
| 3. Frontend Stabilization | 0/6 | Planning complete | - |
| 4. Import and Export | 0/TBD | Not started | - |
| 5. Consultant Engine | 0/TBD | Not started | - |
| 6. Deployment and Production Readiness | 0/TBD | Not started | - |
