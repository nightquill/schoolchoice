# DataPilot — AI-Powered Data Management & Analysis Platform

## What This Is

A boilerplate platform for building AI agent-integrated data management and analysis applications for small and medium enterprises. The core is config-driven for entity/relationship definitions, with domain-specific logic (consultant workflows, matching algorithms) living in pluggable modules. The first deployed instance is an academic advising app (school choice for Hong Kong HKDSE students), which serves as the showcase for the platform's capabilities.

Business owners — not analysts — are the primary users. They import data (CSV, Excel, API), configure their domain, and get AI-powered analysis and recommendations without writing code.

## Core Value

A non-technical business owner can deploy an instance, configure it for their domain, import their data, and get AI-driven analysis and recommendations — all without touching code.

## Requirements

### Validated

- ✓ JWT authentication with bcrypt password hashing — existing
- ✓ Student/entity CRUD with rich profiles (JSONB flexible fields) — existing
- ✓ School/reference data management with search and filtering — existing
- ✓ Hybrid matching engine (eligibility filter + weighted scoring + XGBoost ML) — existing
- ✓ Academic plan generation (HTML with Chart.js visualizations, 3 templates) — existing
- ✓ AI chat integration for plan modification (Gemini) — existing
- ✓ Rich text section editing (TipTap) with template switching — existing
- ✓ Background task processing for long-running operations — existing
- ✓ Data seeding from SQL/JSON files — existing

### Active

- [ ] **Platform core**: Refactor monolithic school-specific code into modular, config-driven platform
- [ ] **Entity framework**: Config-driven entity definitions (fields, relationships, validation rules) — students become employees/customers/etc.
- [ ] **Domain modules**: Module system where each domain (school_choice, accounting, HR, CRM) is a self-contained folder with models, routes, UI components, and consultant workflows
- [ ] **Multi-provider AI agent integration**: Support OpenAI, Anthropic, any OpenAI-compatible endpoint, and custom API URLs — switchable per instance via BYOK config
- [ ] **Consultant module**: Generalized AI recommendation engine replacing the school-specific plan feature — freeform Q&A analysis AND structured guided workflows with better reasoning, organization, and visualization
- [ ] **Import/export system**: CSV, Excel, and API import with field mapping UI — data lives in the platform
- [ ] **UX polish**: Clean, professional interface suitable for non-technical business owners
- [ ] **Bug fixes**: Address known bugs from codebase audit (rate limiting, eligibility confidence, schema duplication, HTML escaping)
- [ ] **Visualization upgrade**: Better charts, dashboards, and data presentation across the platform
- [ ] **Role-based access control**: Multi-role support beyond single counselor role
- [ ] **Deployment template**: One-click-ish Vercel + managed DB (Supabase/Neon) deployment
- [ ] **School choice showcase**: Existing app rebuilt on the platform as the first domain module and demo

### Out of Scope

- Live connectors to external systems (QuickBooks, Salesforce, ERP) — design for it, but import/export first
- Mobile native apps — responsive web only
- Multi-tenant SaaS — each instance is a separate deployment
- Real-time collaboration — single-user interaction model
- Payment/subscription management — no billing in the platform
- Self-service template marketplace — modules are developer-created, not end-user-created

## Context

**Existing codebase (v2.4.1):** FastAPI + React + PostgreSQL. 60 tests passing. The school choice app is feature-complete for its domain but tightly coupled to HKDSE-specific logic throughout models, services, and UI components.

**Key technical debt:**
- StudentProfile.jsx is 1,450 lines with 46+ hooks — needs decomposition
- Plan generator builds 1,300+ lines of HTML via f-strings — needs templating
- v1/v2 API route duplication — needs consolidation
- No frontend tests — needs Vitest + RTL setup
- CORS, seed data, and environment config are hardcoded for local dev

**Known bugs to fix:**
- Chat rate limiting uses date strings instead of rolling 24h window
- Matchmaker silently passes students with missing required subjects (no confidence indicator)
- School name duplication in API responses (string + object)
- HTML escaping inconsistent in plan generator
- XGBoost model fallback is silent (no warning logged)

**AI integration status:** Currently Gemini-only via hardcoded SDK. Needs abstraction layer for multi-provider BYOK support.

**Target deployment:** Vercel (frontend) + managed PostgreSQL (Supabase or Neon). No Docker in dev (user preference — use uvicorn + Homebrew PostgreSQL 15 locally).

## Constraints

- **No Docker in dev**: User has Docker uninstalled. Local dev uses uvicorn + Homebrew PostgreSQL 15 directly.
- **Existing functionality preserved**: All current school choice features must continue working throughout refactoring. The app is the first customer of the platform.
- **Non-technical primary user**: UI/UX decisions must favor simplicity over power-user features. Business owners, not analysts.
- **Boilerplate repo**: The deliverable is a cloneable repo, not a hosted service. Each deployment is independent.
- **Stack continuity**: FastAPI + React + PostgreSQL. No framework changes.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Boilerplate repo (not white-label SaaS) | Each SME gets their own deployment, simpler than multi-tenant | — Pending |
| Config-driven entities + module folders for logic | Entities/fields via config for flexibility, complex workflows in code modules for power | — Pending |
| All AI providers (OpenAI, Anthropic, OpenAI-compatible, custom) | SMEs have varied AI preferences and may self-host models | — Pending |
| Import/export first, live connectors later | Reduces initial complexity; covers 80% of SME data needs | — Pending |
| Vercel + managed DB deployment | Lowest ops burden for SME business owners | — Pending |
| School choice app as first customer (not just demo) | Forces the platform to actually work for a real domain, not just look good | — Pending |
| Consultant = freeform Q&A + guided workflows | Business owners need both ad-hoc questions and structured decision support | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-25 after Phase 2 (AI Provider Abstraction) completion — all AI calls route through LiteLLM-backed call_ai(); BYOK config via env vars*
