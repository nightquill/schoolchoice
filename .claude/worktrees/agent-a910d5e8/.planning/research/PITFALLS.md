# Domain Pitfalls

**Domain:** AI-powered data management platform — refactoring domain-specific app into general-purpose boilerplate
**Researched:** 2026-04-24
**Project:** DataPilot (schoolchoice v2.4.1 → platform)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or permanently broken functionality.

---

### Pitfall 1: Breaking Existing Features While Refactoring

**What goes wrong:** The school choice app stops working partway through the platform refactor. Routes disappear, data relationships break, or the frontend silently stops talking to the API because a shared model was restructured. The original v2.4.1 functionality (matchmaker, plan generator, AI chat) is never fully restored, and the project ships a platform with no working showcase.

**Why it happens:** Refactoring is treated as "first do the platform, then reconnect school choice" — but school choice is the only user of the platform during build, so breakage goes undetected until integration. The monorepo has no frontend tests and sparse v1 backend tests (14/17 v1 endpoints are untested), so regressions escape silently.

**Consequences:** Months of work that can't be demo'd. Counselors lose a working tool. Platform "works in principle" but no domain module proves it.

**Prevention:**
- Adopt the Strangler Fig pattern strictly: the new platform layer grows alongside existing code; school choice routes continue to function at every commit, not just at the end of a phase.
- Every phase must end with all 60 existing tests still passing plus any new tests added.
- Add a smoke test suite (Playwright or pytest integration) covering the five highest-risk paths: student CRUD, matchmaker run, plan generation, AI chat, school search. Run it at the end of every PR.
- Keep v1 API routes alive and aliased to new platform routes rather than deleting them until the school choice domain module is fully rebuilt on the platform and the alias is no longer needed.

**Warning signs:**
- A PR touches `models.py` or `models_v2.py` without a corresponding migration and ORM column check.
- A PR deletes or renames a route without confirming the frontend still compiles and the existing tests still pass.
- Phase plan says "reconnect school choice at the end" rather than keeping it working throughout.

**Phase mapping:** Relevant to every phase. Enforce most strictly in Phase 1 (platform core / entity framework refactor) where the structural changes are largest.

---

### Pitfall 2: Over-Engineering the Config System

**What goes wrong:** The config-driven entity framework becomes a DSL. Every possible field type, relationship cardinality, validation rule, computed field, and display hint is modeled in YAML or JSON config. Configuring a new domain requires understanding 40+ config keys. The first non-school domain takes three weeks to configure instead of one day.

**Why it happens:** The designer sees the variety of SME domains (HR, CRM, accounting) and tries to make the config expressive enough to handle all of them from day one. This is premature generalization — surface-level similarity between "student with grades" and "employee with performance reviews" does not mean they share the same underlying structure.

A 2025 study found that abstractions created before validation make code 40% harder to review and increase bug introduction rates by 25%. The payment platform example (six-month delay when localised payment flows required extensive retrofitting) is directly applicable here.

**Consequences:** Config system complexity leaks into the UI (business owners face a configuration interface only a developer could understand). Domain modules that should be "pluggable" require platform-level changes for every new field type encountered. The config schema itself becomes the hardest thing to refactor.

**Prevention:**
- Build exactly what school choice needs, extracted from the existing hardcoded code. Do not add config keys for domains that don't exist yet.
- Use the rule of three: a config abstraction is only warranted when three distinct domain modules need it, not speculatively.
- Keep domain-specific logic (matching weights, eligibility rules, plan templates) in code modules, not config. Config handles structure (fields, labels, types); modules handle behavior (algorithms, workflows).
- Validate every config key against a concrete school choice usage before shipping it as part of the platform API.

**Warning signs:**
- Config schema has more than 15 top-level keys.
- A new domain module requires editing the platform core to support a new config key it needs.
- Config validation error messages require reading documentation to interpret.
- Business owner-facing setup UI has more than 3 screens.

**Phase mapping:** Phase 1 (entity framework). Establish a tight scope: only extract what school choice demonstrably needs. Phase 3 or later can add config extensions when a second domain module proves the need.

---

### Pitfall 3: Leaky AI Provider Abstraction

**What goes wrong:** The multi-provider abstraction (OpenAI, Anthropic, Gemini, custom OpenAI-compatible endpoints) looks clean in theory but leaks in practice. Anthropic's extended thinking, OpenAI's structured outputs, and Gemini's grounding don't map onto a common interface. The wrapper either strips provider-specific capabilities (reducing value) or exposes them as pass-through params (breaking the abstraction). Switching providers in production changes output format and the plan chat stops working.

**Why it happens:** Provider APIs have converged on similar surface shapes (messages array, role/content structure) but diverged on everything beyond basic completion: streaming behavior, token counting, function calling schemas, error codes, retry semantics, and rate limit headers. An abstraction that normalises these requires maintaining a translation layer for each provider — this is exactly what LiteLLM does, and production teams report ongoing maintenance overhead, debugging opacity, and periodic memory leaks.

**Consequences:** A BYOK user who switches from Gemini to Claude mid-deployment finds the AI chat returns garbled responses or HTTP 500. The abstraction layer becomes the hardest component to debug because failures have three possible sources: the caller, the wrapper, and the provider.

**Prevention:**
- Do not build a universal abstraction from scratch. Use LiteLLM as the provider translation layer (it already handles 100+ providers) but wrap it in a thin DataPilot interface that exposes only three operations: `complete(messages, config)`, `stream(messages, config)`, `health_check()`. Keep provider-specific params accessible via a passthrough `extra` dict rather than hiding them.
- Be explicit about what is guaranteed across providers (basic chat completion) and what is provider-specific (structured outputs, function calling). Document this in the platform README, not just code comments.
- Store API keys in environment variables per deployment. Never accept them at runtime via UI for a boilerplate deployment — each instance is already a separate deployment with its own env. This avoids the BYOK key-lifecycle management complexity.
- Test each supported provider with the actual plan chat flow, not just a "hello world" ping. The plan chat sends large context (full plan structure as JSON) and expects a JSON patch back — this is where provider differences surface.

**Warning signs:**
- Provider-specific response parsing logic appears inside `plan_chat_service.py` rather than inside the provider adapter.
- Adding a new provider requires editing the core chat service, not just adding a new adapter file.
- The abstraction has a `provider == "anthropic"` branch anywhere outside the adapter layer.
- LiteLLM version is pinned and no one has read its changelog for the current quarter (supply chain risk — a 2026 supply chain compromise affected LiteLLM users).

**Phase mapping:** Phase 2 (AI provider abstraction). Keep scope narrow: abstract the existing Gemini integration first. Add OpenAI-compatible second. Add Anthropic third. Do not attempt all three simultaneously.

---

### Pitfall 4: Platform Too Generic to Be Useful

**What goes wrong:** The platform ships as a blank-slate framework. A new developer clones the repo and sees: no entities defined, no example workflows, no seed data that demonstrates the system working. The school choice showcase is either absent or requires 20 manual config steps to activate. The platform is technically complete but practically unusable as a starting point for a new domain.

**Why it happens:** Platform work focuses on infrastructure (entity framework, module loader, AI abstraction, import system) while the demo experience is treated as documentation work deferred to the end. By the end, the team is tired and the demo is thin.

**Consequences:** The boilerplate repo fails its primary purpose. A developer evaluating DataPilot for an HR module clones it, sees a blank screen, and builds their own thing from scratch instead.

**Prevention:**
- The school choice domain module is the living smoke test of the platform. It must be fully functional on the platform — not a thin stub — before the milestone is declared complete. If school choice can't be demo'd end-to-end on the new platform, the platform is not done.
- Include a `make demo` or `scripts/seed_demo.py` that loads school choice seed data and creates a demo user with credentials, so any clone is immediately demo-able.
- Write the "new domain in 30 minutes" developer guide during Phase 1, not after the last phase. Each phase validates that the guide still works.

**Warning signs:**
- End of a phase and the school choice features (matchmaker, plan, AI chat) are not exercised by at least one automated test on the new platform code paths.
- The README says "see docs/ for setup" and docs/ is empty or generic.
- A second team member who wasn't in the original build session cannot get the demo running in under 15 minutes.

**Phase mapping:** Relevant to every phase. Validate against it at each phase boundary. Critical in final phase (deployment template).

---

### Pitfall 5: ORM-Schema Drift During Refactoring

**What goes wrong:** The platform entity framework introduces new tables and restructures existing ones. The ORM models in `models.py` and `models_v2.py` are manually updated but fall out of sync with the actual database schema — a repeat of the BUG-V2-010/011/012 issues already documented in CONCERNS.md. A new column added via `ALTER TABLE` at startup is not reflected in the ORM model, causing `AttributeError` at runtime on the code path that uses it.

**Why it happens:** The codebase already has two parallel schema evolution mechanisms: Alembic migrations and startup `ALTER TABLE IF NOT EXISTS` calls. The platform refactor will add a third (config-driven schema generation). Three mechanisms means three places where the ORM can fall out of sync. The current startup validation is missing (identified as a concern in CONCERNS.md but not yet implemented).

**Consequences:** Runtime 500 errors in production that only trigger on specific code paths. Silent data loss if a column is assumed to exist but isn't fetched. Debugging is time-consuming because the error is at runtime, not at startup.

**Prevention:**
- Before touching any schema code in Phase 1, implement the startup column parity check described in CONCERNS.md: query `information_schema.columns`, compare against ORM `__table__.columns`, and raise a loud startup error (not just a warning) if they differ.
- Adopt Alembic as the single schema evolution mechanism. Remove the `ALTER TABLE IF NOT EXISTS` pattern from `main.py`. All schema changes — including platform-layer additions — go through Alembic migrations.
- Never allow config-driven entity definitions to generate schema changes at runtime. Config defines logical structure; a developer-run migration command translates config into an Alembic migration file. This keeps schema changes auditable.

**Warning signs:**
- A PR adds a new column to the database but the corresponding ORM model change is in a separate, later PR.
- `ALTER TABLE IF NOT EXISTS` calls remain in `main.py` after the Alembic migration is added.
- The startup column parity check is not yet in place when schema refactoring begins.

**Phase mapping:** Phase 1 (platform core). Implement the parity check and Alembic consolidation before any structural changes to the schema.

---

## Moderate Pitfalls

---

### Pitfall 6: Refactoring the Frontend Without Tests

**What goes wrong:** StudentProfile.jsx (1,450 lines, 46+ hooks) is decomposed into 7 sub-components as planned. The decomposition looks clean. But three of the seven tabs have subtly broken state management because the parent `student` state mutation pattern changed. Counselors report that grades saved in one tab don't appear when switching to another. Without frontend tests, this regression is discovered only in manual QA — or worse, in production.

**Why it happens:** The frontend has no tests at all (identified in CONCERNS.md). Decomposing a monolithic component is high-risk precisely because the shared mutable state is what makes the original work, and the refactor's first job is to break that sharing intentionally.

**Prevention:**
- Set up Vitest + React Testing Library before touching StudentProfile.jsx. Write characterization tests against the current behavior first (what state changes in the parent when a grade is saved?), then refactor, then verify the tests still pass.
- The decomposition must include a clear answer to "who owns state?" before the first file is split. Options: React Context for student state shared across tabs, or each tab fetches its own data independently (preferred for isolation). Document the chosen pattern in a comment at the top of the new container component.
- Do not split the component in a single PR. Split one tab at a time, merge, verify, move to the next.

**Warning signs:**
- StudentProfile refactoring PR is larger than 500 lines of net change.
- The PR has no new tests.
- The PR creates all 7 sub-components in a single commit.

**Phase mapping:** Phase 1 (entity framework / component decomposition). Tests must exist before the split begins.

---

### Pitfall 7: The Module System Becomes a Framework (Circular Dependency Hell)

**What goes wrong:** Domain modules (school_choice, accounting, HR) start importing from each other — school_choice imports a utility from accounting, the platform core imports from school_choice to register it, school_choice imports from platform core to use the entity framework. Python's import system silently handles many circular references at module load time, masking the coupling until a subtle runtime error appears.

**Why it happens:** The module system starts with clean boundaries but "just one quick import" decisions accumulate. Since the platform is a monorepo (not separate packages), nothing enforces the boundary.

**Prevention:**
- Each domain module must have exactly one allowed import direction: `domain_module → platform_core`. The platform core never imports from domain modules. Modules never import from other modules. Platform core provides a registration/discovery mechanism so modules are discovered dynamically (via entry points or a config list), not statically imported.
- Add a CI lint step (e.g., `import-linter` or `pylint` with a custom checker) that fails if any platform core file imports from a domain module folder.
- The registration pattern: domain modules register themselves by calling `platform.register(module_config)` at module load time. Platform core does not know about school_choice by name.

**Warning signs:**
- `from app.modules.school_choice import ...` appears in any file outside the school_choice module folder.
- `from app.core import ...` appears in a domain module (acceptable) and `from app.modules import ...` appears in a different module (not acceptable).
- Adding a new domain module requires editing a file in `app/core/`.

**Phase mapping:** Phase 1 (module system design). Establish the boundary rule before any module is written.

---

### Pitfall 8: Import/Export System Becomes a Data Migration Tool

**What goes wrong:** The CSV/Excel import feature starts as "upload a file, map columns, import rows." It ends up becoming a full ETL pipeline with transformation rules, data cleaning logic, duplicate detection, rollback, and preview modes — because every real-world SME dataset is messy. The import phase takes 3x as long as planned and the rest of the platform is blocked waiting for it.

**Why it happens:** The first real dataset imported by a real user reveals that field names don't match, dates are in four formats, some rows have missing required fields, and two rows are duplicates. The team adds handling for each case. Scope creeps silently.

**Prevention:**
- Scope the import system to: (1) upload file, (2) column mapping UI, (3) validation with error report, (4) commit or cancel. Nothing more in the first pass.
- "Duplicate detection" and "data transformation rules" are explicitly out of scope for the first import implementation. Document this constraint in the phase plan.
- Provide a clear error export: when validation fails, the user downloads a CSV of the failing rows with an error column explaining why each failed. They fix it in Excel and re-upload. This removes the need to build a browser-based data cleaning tool.

**Warning signs:**
- Import phase plan includes "smart duplicate detection" or "transform rules."
- More than two weeks is allocated to the import system in the first milestone.
- The import service is importing from the matchmaker or plan generator (business logic has leaked into import).

**Phase mapping:** Import/export phase. Treat it as a bounded feature with a hard scope document, not an open-ended infrastructure investment.

---

### Pitfall 9: BYOK Config Stored Insecurely

**What goes wrong:** The BYOK AI key configuration (user provides their own OpenAI / Anthropic / Gemini API key per deployment) is stored in the database rather than environment variables, with the mistaken belief that database storage is more convenient for non-technical operators. The key is stored as plaintext or with reversible encryption. A database dump or a poorly scoped SELECT query exposes the key.

**Why it happens:** The boilerplate is designed for non-technical business owners. The designer wants to make key configuration "just fill in a form." Putting it in the DB feels more operator-friendly than editing a `.env` file. But since each deployment is an independent instance (not a SaaS multi-tenant system), there is no legitimate reason to store keys in the database.

**Prevention:**
- API keys are environment variables only. The platform reads them from env at startup; they never touch the database.
- Provide a `.env.example` and a `configure.sh` helper script that prompts the operator to enter keys and writes them to `.env`. This is operator-friendly without being insecure.
- If a UI-based key configuration screen is ever added (future feature), it must write to the `.env` file via a local-only admin endpoint and immediately discard the value from memory — never persist it in the database.

**Warning signs:**
- A `settings` or `config` database table has columns named `api_key`, `gemini_key`, or similar.
- The AI provider key is readable via any GET endpoint.
- The platform README says "configure your AI key in the admin panel."

**Phase mapping:** Phase 2 (AI provider abstraction). Establish the env-only key pattern before any provider configuration UI is sketched.

---

### Pitfall 10: v1/v2 API Duplication Calcifies Into the Platform

**What goes wrong:** The existing v1/v2 route duplication (already identified as tech debt) is carried into the platform layer unchanged. The platform adds a third API layer (generic entity CRUD) that sits alongside v1 and v2. The codebase now has three versions of student-related routes. Schema serialisation bugs that are fixed in v2 are still present in v1 because no one wants to touch the legacy routes. The school choice frontend is using v1 routes, the new platform frontend uses generic routes, and no one is sure which is authoritative.

**Why it happens:** Consolidating v1 and v2 is deferred because it seems like a separate cleanup task. But the platform refactor creates the perfect moment to consolidate — and if that moment is missed, the duplication becomes permanent scaffolding that every future feature works around.

**Prevention:**
- Treat v1/v2 consolidation as a prerequisite for the platform refactor, not a follow-up. The platform API must have exactly one route prefix that school choice uses.
- Strategy: migrate all v1 callers (frontend components) to v2 routes, then alias v1 routes to v2 handlers (not duplicate implementations), then mark v1 as deprecated with a response header. Removal can wait until the school choice domain module is rebuilt.
- Add a test that verifies any v1 route returns identical response shape to its v2 equivalent. This prevents v1 from drifting as v2 is updated.

**Warning signs:**
- Platform architecture doc has a "v3 routes" section while v1 routes still exist.
- A bug fix is applied to v2 routes but the same bug is never fixed in v1.
- The frontend has `import { API_V1 } from...` and `import { API_V2 } from...` in the same file.

**Phase mapping:** Phase 1 (platform core). Consolidate before adding the new generic entity API layer.

---

## Minor Pitfalls

---

### Pitfall 11: Hardcoded HKDSE Logic Surfaces in Unexpected Places

**What goes wrong:** The generalization removes obvious school-choice-specific code but misses subtler domain assumptions: grade scales (1-7 DSE scoring), subject name constants, program alignment heuristics, MOCK/OFFICIAL grade type distinctions. These surface as runtime errors or incorrect behavior when the platform is configured for a non-HKDSE domain.

**Prevention:**
- Run a full-codebase grep for: "DSE", "HKDSE", "mock", "official", "level", subject name strings. Every hit must be either moved into the school_choice domain module or replaced with a domain-configurable value.
- The entity framework tests should include a "non-school" domain smoke test (e.g., a minimal HR config) that exercises the platform without triggering any school-choice-specific code paths.

**Phase mapping:** Phase 1 (entity framework). Perform the grep audit before writing any new platform code.

---

### Pitfall 12: Plan Generator HTML Templating Debt Compounds

**What goes wrong:** The plan generator's 1,300-line f-string HTML is not migrated to Jinja2 as part of the platform refactor. The new "consultant module" that replaces it is built on the same pattern. Now there are two large f-string HTML generators to maintain, and the HTML escaping bug (identified in CONCERNS.md) is replicated in the new one.

**Prevention:**
- Before building the consultant module, extract the plan generator to Jinja2 templates as a prerequisite. This fixes the HTML escaping bug, establishes the templating pattern, and makes the new consultant module start from a clean foundation.
- The Jinja2 migration is a contained task (no behavior change, just templating mechanism change) and should be completed in Phase 1 or as the first step of the consultant module phase.

**Phase mapping:** Phase 1 or the consultant module phase. Do not allow the consultant module to start before the templating pattern is established.

---

### Pitfall 13: Deployment Template Ships Without Production Secret Hygiene

**What goes wrong:** The boilerplate repo ships with `docker-compose.yml` defaults (`advisorsecret`, `SECRET_KEY=dev`) that are copy-pasted into production by operators who don't read the docs. This is already flagged in CONCERNS.md. The platform refactor adds new secrets (AI provider keys) that face the same risk.

**Prevention:**
- The deployment template must fail loudly if any secret is set to the example value. Implement a startup check: if `SECRET_KEY == "dev"` or `POSTGRES_PASSWORD == "advisorsecret"`, raise a startup error with an explicit message ("Production secrets not configured. See DEPLOYMENT.md").
- Add a `generate_secrets.sh` script to the repo that creates a `.env` with cryptographically random values for all required secrets. Make this the documented first step of deployment.

**Phase mapping:** Final phase (deployment template). But add the startup secret-check in Phase 1 so it's enforced throughout.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Entity framework / platform core | Over-engineering config schema | Build only what school choice needs; validate every key against actual usage |
| Entity framework / platform core | ORM-schema drift | Implement column parity check and Alembic consolidation before touching schema |
| Entity framework / platform core | v1/v2 API duplication compounds | Consolidate to single route version before adding generic entity API |
| Entity framework / platform core | HKDSE logic hidden in unexpected places | Full-codebase grep audit before writing new platform code |
| StudentProfile decomposition | Regression without tests | Vitest + RTL setup before any component split |
| AI provider abstraction | Leaky abstraction, debugging opacity | Wrap LiteLLM in thin DataPilot interface; test each provider with real plan chat context |
| AI provider abstraction | API keys stored insecurely | Env-only key pattern, enforced from day one |
| Module system design | Circular imports, domain coupling | Enforce one-way dependency: domain → platform core only, with CI lint check |
| Consultant module | Plan generator debt replicated | Jinja2 migration prerequisite before consultant module begins |
| Import/export | Scope creep into ETL territory | Hard scope document; error CSV export instead of browser-based data cleaning |
| Deployment template | Production secrets not configured | Startup secret validation + `generate_secrets.sh` |
| Every phase transition | Existing school choice features broken | 60+ tests must pass at every phase boundary; smoke test suite on highest-risk paths |

---

## Sources

- [7 Pitfalls to Avoid in Application Refactoring Projects — vFunction](https://vfunction.com/blog/7-pitfalls-to-avoid-in-application-refactoring-projects/)
- [Five application modernization pitfalls — vFunction](https://vfunction.com/blog/app-modernization-pitfalls/)
- [Strangler Fig Pattern — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- [Strangler Fig Pattern pitfalls — The Ordinary Company](https://theordinarycompany.io/blog/strangler-fig-pattern/)
- [Post-Architecture: Premature Abstraction Is the Root of All Evil](https://arendjr.nl/blog/2024/07/post-architecture-premature-abstraction-is-the-root-of-all-evil/)
- [How Early Custom Abstractions Hurt Platform Teams](https://www.ai-infra-link.com/how-early-custom-abstractions-hurt-platform-teams-and-what-to-do-instead/)
- [LiteLLM in Production — PyData Berlin 2025](https://cfp.pydata.org/berlin2025/talk/NUNXEV/)
- [LiteLLM Security Incident: AI Supply Chain Risk — Ardan Labs](https://www.ardanlabs.com/news/2026/ai-security-supply-chain-problem-litellm-incident-signals/)
- [The LLM Abstraction Layer: Why Your Codebase Needs One in 2025 — ProxAI](https://www.proxai.co/blog/archive/llm-abstraction-layer)
- [5 Things SaaS Companies Get Wrong with BYOK — IronCore Labs](https://ironcorelabs.com/blog/2024/five-things-saas-mess-up-with-byok/)
- [Strategies for Reliable Schema Migrations — Atlas](https://atlasgo.io/blog/2024/10/09/strategies-for-reliable-migrations)
- [Zero downtime schema migrations with pgroll — Neon](https://neon.com/guides/pgroll)
- [Breaking Up with Our Monolithic Table: A React Refactoring Journey — DEV Community](https://dev.to/aze3ma/breaking-up-with-our-monolithic-table-a-react-refactoring-journey-6k2)
- [PostgreSQL JSONB vs. EAV — razsamuel.com](https://www.razsamuel.com/postgresql-jsonb-vs-eav-dynamic-data/)
- [API Incompatibility: OpenAI, Anthropic, Google — supermemory.ai](https://supermemory.ai/blog/we-solved-ai-api-interoperability/)
- [Should you abstract away third-party vendors in your code? — Test Double](https://testdouble.com/insights/abstracting-vendors-in-code)
