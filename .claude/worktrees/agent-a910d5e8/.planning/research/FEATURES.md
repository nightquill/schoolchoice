# Feature Landscape

**Domain:** AI-powered SME data management and analysis platform (boilerplate repo, config-driven, self-hosted per-deployment)
**Researched:** 2026-04-24
**Confidence:** HIGH for core features (verified against market patterns and existing codebase); MEDIUM for differentiators (market signals but limited comparable open-source boilerplate comparisons)

---

## Context and Framing

The primary user is a non-technical business owner who deploys this platform for their domain — HR, CRM, school advisory, accounting — and uses it daily without touching code. Every feature decision must pass the question: "Can a non-technical operator understand and use this without a manual?"

The platform is a boilerplate repo, not a hosted SaaS. Each SME deployment is independent. This shapes what's in scope: deployment simplicity, BYOK AI keys, and a working domain module system matter more than multi-tenancy, billing, or a marketplace.

The existing codebase (v2.4.1) is a school choice advisory app that is feature-complete in its domain but tightly coupled to HKDSE-specific logic. The refactoring target is to extract the platform layer from this app while keeping the school choice module as the first working domain instance.

---

## Table Stakes

Features users expect. Missing or broken = users leave or the platform is not deployable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| JWT authentication with role-aware access | Every business tool requires login. Without RBAC, multi-staff deployments are unusable or unsafe. | Low (auth exists; RBAC extension is Medium) | Existing JWT + bcrypt auth is solid. RBAC extension needed per PROJECT.md. At minimum: admin and staff roles. |
| Entity CRUD with flexible fields | The platform's core abstraction — students/employees/customers/etc. CRUD is the lowest common denominator. Without it, nothing else works. | Medium | JSONB already used for semi-structured fields. Platform abstraction (away from StudentProfile) is the work. |
| Data import from CSV/Excel with column mapping UI | Business owners have existing data in spreadsheets. Manual entry of 50+ records is a dealbreaker for adoption. Import is the on-ramp. | Medium | Identified as a "missing critical feature" in CONCERNS.md. Bulk CSV upload is explicitly absent today. |
| Data export (CSV for raw data, PDF/HTML for reports) | Business owners need to share outputs — with clients, regulators, or their own records. Export is how the platform proves its value externally. | Low–Medium | HTML plan export exists. PDF export and CSV entity export are missing. |
| Search and filtering on entity lists | Any list of more than 20 records without search is unusable. Filtering is how users find what they need. | Low | School/student search exists in the codebase. Needs generalizing. |
| Dashboard with key metrics | Users need a homepage that answers "what's happening today?" without navigating to multiple pages. | Medium | DataAnalysis and Dashboard pages exist; need generalizing to be domain-config-driven. |
| AI freeform Q&A (chat against platform data) | The primary AI value proposition. Users ask questions like "which employees have salary reviews due?" and get answers. | Medium | Plan chat service (Gemini-only) exists. Needs provider abstraction and generalization beyond plans. |
| AI guided workflow (structured decision support) | Ad-hoc chat is powerful but unfocused. Guided workflows (step-by-step prompts for a specific task like "generate a performance review") produce better, more consistent outputs. Validated in the school choice domain via plan generation. | High | Plan generator is the prototype. Platform generalization to domain-configurable workflows is the work. |
| Visualizations: charts and data tables | SME users cannot read JSON dumps. Charts and tables translate data into insight. The existing Chart.js integration in plan HTML validates the user expectation. | Medium | Chart.js already bundled. DataAnalysis page exists. Needs config-driven dashboard charts. |
| Health check and operational visibility | Operators need to know if AI providers are configured, if the database is healthy, and if background jobs are running. Without this, debugging a broken deployment is opaque. | Low | `/health` endpoint exists but is minimal. Needs feature flags (chat_enabled, ml_model_loaded, etc.). |
| Secure secret management for deployment | Every deployment needs to configure DATABASE_URL, SECRET_KEY, and AI provider keys without hardcoding them. | Low | .env pattern exists. CORS is hardcoded — must be fixed. Deployment template must parametrize all secrets. |

---

## Differentiators

Features that set this platform apart from generic tools (Airtable, Notion, spreadsheets). Not expected by users — but valued once experienced, and critical for the platform's positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| BYOK AI provider support (OpenAI, Anthropic, OpenAI-compatible, custom URL) | SMEs have varied preferences: some have OpenAI enterprise agreements, some want to self-host Ollama for data privacy, some prefer Anthropic. Locking to one provider is a dealbreaker for a class of users. No comparable open-source SME platform offers this as first-class config. | Medium | Existing Gemini SDK is hardcoded. Abstraction layer needs to route to any OpenAI-compatible endpoint. The "custom URL" case covers Ollama, Together, Fireworks, and private deployments. |
| Domain module system (school_choice, HR, CRM as swappable folders) | The platform's core architectural differentiator. Competitors (Airtable, Notion) are general-purpose but have no AI-driven domain logic. Custom-built apps have domain logic but no reusable platform. This hits the middle: opinionated platform + replaceable domain modules. | High | No comparable open-source boilerplate. Config-driven entity definitions + domain module folders. This is the platform's identity. |
| Hybrid AI recommendation engine (eligibility rules + ML scoring + explainability) | Pure AI "black box" recommendations are distrusted by business owners. A hybrid approach — hard rules filter, ML scores, SHAP explains — gives users confidence and auditability. The school choice matchmaker demonstrates this is achievable and valuable. | High | XGBoost + SHAP exists and is validated. Generalizing from schools to generic "target entities" is the platform work. |
| Eligibility confidence indicators on recommendations | When a recommendation is based on incomplete data (mock grades, missing fields), showing the user "this match is LOW confidence because field X is missing" prevents false confidence. No comparable tool surfaces this. | Low | CONCERNS.md identifies this as an unimplemented feature that surprises counselors. Easy to add, meaningful as a trust signal. |
| Plan/report template switching | Users can switch between report styles (professional, modern, minimal) without regenerating data. This is a UX differentiator over competitors that have one fixed output format. | Low | Three templates exist in the plan generator. Needs to be generalized to the platform document system. |
| Rich text section editing (TipTap inline editor) | AI-generated content needs human override. TipTap integration allows users to edit individual sections of a generated report without regenerating the whole thing. This is collaborative AI: AI drafts, human refines. | Low (exists) | TipTap + section overrides already implemented and validated. Needs preservation through refactoring. |
| Vercel + managed DB one-command deployment | Most SME software requires a developer to deploy. Vercel + Supabase/Neon with a single deploy button and environment variable instructions means a technical-enough business owner can self-host. | Medium | No deployment template exists yet. Supabase auto-syncs env vars to Vercel projects (confirmed). Neon provides preview DB branches per Vercel deployment. |
| Background task transparency | Long-running operations (report generation, ML matching) should show progress and status rather than a spinner with no feedback. Users lose trust when operations appear to hang. | Low | Background task + polling pattern exists for plan generation. Needs surface-level status UI generalization. |
| XGBoost model fallback warning | If the ML model file is missing, the system silently falls back to weighted scoring. Making this visible (log + API status + UI indicator) differentiates from competitors where degraded behavior is silent. | Low | Identified in CONCERNS.md. Startup warning + `/health` flag is the fix. |

---

## Anti-Features

Features to deliberately NOT build. Building these would dilute focus, increase complexity, or conflict with the project's boilerplate-repo identity.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Live connectors to external systems (QuickBooks, Salesforce, Xero, ERPs) | Requires OAuth flows, API versioning, provider-specific error handling, and ongoing maintenance as APIs change. Adds massive complexity before the platform's core abstractions are stable. | Design the import/export schema to be compatible with these systems' CSV exports. Document the expected column format so users can export from QuickBooks and import here. Phase in connectors after platform stabilizes. |
| Multi-tenant SaaS (single deployment serving multiple organizations) | Changes the auth model, data isolation model, billing model, and operational complexity fundamentally. The boilerplate-repo model (each SME runs their own instance) is simpler and avoids all of this. | Each deployment is one tenant. The operator manages their own instance. |
| Mobile native apps (iOS, Android) | The user base is business operators working at desks. Responsive web covers the mobile case adequately. Native apps require a separate codebase, separate deployment, and separate maintenance. | Build responsive web. Test on mobile browsers. |
| Real-time collaboration (multiple users editing simultaneously) | Conflict resolution, operational transforms, or CRDTs are significant engineering work. The current interaction model is single-user. | Single-user interaction model. Use simple "last write wins" semantics with optimistic UI. |
| Payment and subscription management | Not a SaaS product. No billing in the platform. | If an operator wants to charge their own clients for platform access, they handle billing externally. |
| Self-service template marketplace (user-created domain modules) | Domain modules require Python backend logic, not just configuration. User-created modules are a security and quality risk. | Modules are developer-created and shipped as part of the boilerplate repo or as separate repos. Document the module interface so developers can create new ones. |
| Full-text search across all entity fields | Requires Elasticsearch or Postgres full-text indexes with ranking. Significant infrastructure. Simple filtered search (indexed columns) is sufficient for SME scale (< 10,000 records). | Implement indexed column search with server-side filtering. Add Postgres full-text search only if a real-world deployment needs it. |
| AI-generated database schema (autonomous domain setup) | Sounds powerful but produces fragile, unpredictable schemas. Business owners need to understand their data structure. | Config-driven entity definitions with a YAML/JSON schema that developers customize per domain. Non-technical operators see the entity form, not the schema. |
| Audit log / compliance trail | Legitimate need for regulated industries, but adds write overhead on every mutation and requires a separate log store. Out of scope for the initial platform. | Design the data model so adding audit logging later is possible (e.g., use created_at/updated_at everywhere). |
| Inline dashboard widget customization (drag-and-drop layout editor) | High engineering cost. Business owners don't need this — they need the right 3–5 metrics visible by default for their domain. | Domain modules define their dashboard layout in config. Operators can request changes from the developer who set up their instance. |

---

## Feature Dependencies

The following dependency graph shows which features must be built before others can exist.

```
JWT auth
  └── RBAC (role-aware access)
        └── Multi-staff deployments

Entity framework (config-driven definitions)
  ├── Entity CRUD
  │     ├── Search and filtering
  │     ├── CSV import with column mapping
  │     └── CSV export
  └── Domain module system
        ├── School choice module (first instance)
        ├── AI freeform Q&A (chat against entity data)
        └── AI guided workflow (domain-specific recommendation engine)
              ├── Hybrid scoring engine (rules + ML + explainability)
              ├── Eligibility confidence indicators
              └── Plan/report generation
                    ├── Template switching
                    ├── Rich text section editing (TipTap)
                    └── PDF/HTML export

BYOK AI provider abstraction
  ├── AI freeform Q&A
  └── AI guided workflow

Health check + operational visibility
  └── Deployment template (Vercel + managed DB)

Background task transparency
  └── AI guided workflow (long-running matching + plan generation)
```

Key ordering constraints:
- Entity framework must precede all domain modules and AI features (everything depends on knowing what entities exist)
- BYOK AI abstraction must precede any AI feature expansion (otherwise you're building on the hardcoded Gemini foundation)
- RBAC should be built before multi-user deployments go live (security-before-deployment ordering)
- Deployment template should come after the platform core stabilizes (pointless to deploy a half-refactored app)

---

## MVP Recommendation

For a first deployable version of the platform (school choice module working, platform layer usable by a second domain):

**Prioritize:**
1. Entity framework + config-driven definitions (unlocks everything else)
2. BYOK AI provider abstraction (unblocks AI features from Gemini lock-in)
3. CSV import with column mapping UI (most-cited missing feature, on-ramp for new deployments)
4. RBAC (admin + staff roles minimum) (required before any multi-user deployment)
5. Generalized AI freeform Q&A (chat against entity data, not just plans)
6. Health check with feature flags (ai_provider_configured, ml_model_loaded) (operational visibility for operators)
7. Deployment template (Vercel + Supabase/Neon with documented env vars) (makes the boilerplate actually deployable)

**Defer (second milestone):**
- Full domain module system (build the interface after one successful port of school choice to the platform)
- Drag-and-drop dashboard customization (anti-feature — domain config is sufficient)
- PDF export via headless browser (HTML export is sufficient initially; server-side PDF adds infra complexity)
- Connector API for external systems (explicitly out of scope in PROJECT.md)

**Known risks requiring phase-specific research:**
- BYOK AI abstraction: The abstraction layer must handle streaming, token counting differences, and error response format differences across providers. Needs investigation of LiteLLM or similar proxy vs. hand-rolled adapter.
- XGBoost model portability: When domain changes from school choice to HR/CRM, the ML model needs retraining or replacement. The platform layer should not assume a pre-trained model file exists.
- Vercel deployment for FastAPI: Vercel's native Python support (serverless functions) has cold start and timeout limitations. A FastAPI app may need to be deployed as a Vercel serverless function or use a separate backend host (Railway, Fly.io). This needs a feasibility check before committing to Vercel as the backend host.

---

## Sources

- [Best AI-Powered Data Platforms for SMEs in 2026 — Analytics Insight](https://www.analyticsinsight.net/artificial-intelligence/best-ai-powered-data-platforms-for-smes-in-2026)
- [2026 Analytics & AI Predictions for Data-Forward SMBs — PowerMetrics](https://www.powermetrics.app/blog/smb-data-analytics-ai-metrics-trends-2026)
- [Julius AI: Chat with Your Data Using AI](https://julius.ai/)
- [AI Workflows vs. AI Chat — Nathan Thompson / Substack](https://nathanai.substack.com/p/ai-workflows-vs-ai-chat)
- [BYOK Now Live in JetBrains IDEs — JetBrains AI Blog](https://blog.jetbrains.com/ai/2025/12/bring-your-own-key-byok-is-now-live-in-jetbrains-ides/)
- [Vercel BYOK Documentation](https://vercel.com/docs/ai-gateway/authentication-and-byok/byok)
- [CSV Upload Tool: Smart Data Ingestion — Osmos](https://www.osmos.io/blog/smart-data-uploader-for-customer-data-onboarding)
- [NocoBase: Open-source no-code/low-code platform](https://www.nocobase.com/)
- [BI Dashboard Design Best Practices 2025 — Julius AI](https://julius.ai/articles/business-intelligence-dashboard-design-best-practices)
- [Business Intelligence Dashboard Adoption Failures — SR Analytics](https://sranalytics.io/blog/business-intelligence-dashboards/)
- [Vercel + Supabase Integration](https://vercel.com/marketplace/supabase)
- [Neon + Vercel Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration)
- [Chatbot Best Practices 2025 — Classic Informatics](https://www.classicinformatics.com/blog/chatbot-best-practices-2025-enterprises)
- [RBAC Best Practices 2025 — OsoHQ](https://www.osohq.com/learn/rbac-best-practices)
- [How to Design RBAC — NocoBase](https://www.nocobase.com/en/blog/how-to-design-rbac-role-based-access-control-system)

*Internal sources: PROJECT.md (2026-04-24), codebase/CONCERNS.md (2026-04-24), codebase/ARCHITECTURE.md (2026-04-24)*
