# Phase 5: Consultant Engine - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Template-driven AI consultant engine that transforms entity data + ML recommendations into professional plans/presentations. Each deployment defines domain-specific "consultant tasks" via YAML — the engine assembles data, runs AI reasoning, and renders a professional HTML report with charts and actionable roadmaps. School choice plan generation is migrated to become the first task definition. The recommendation engine is generalized so a second domain can plug in its own rules and weights. This is NOT freeform chat — it is structured, template-driven professional output generation.

</domain>

<decisions>
## Implementation Decisions

### Template Task YAML
- **D-01:** Mostly YAML configuration — YAML defines data sources, AI prompt templates per section, output section order, chart types. Python only for custom data transforms (e.g., grade calculations). A new task = new YAML file + optional Python hooks.
- **D-02:** Named data slots for data sources — YAML declares named slots like `primary_entity: student`, `reference_data: schools`, `ml_output: matchmaker`. The engine resolves these from the entity registry and module services.
- **D-03:** Tasks live in both platform and domain modules with override — platform provides generic tasks (`platform/tasks/`), modules can override or add domain-specific ones (`modules/school_choice/tasks/`). Module tasks discovered at startup via module manifest.
- **D-04:** Single trigger execution — user clicks "Generate Plan" and the engine assembles data, runs AI, produces report. No intermediate wizard steps. School choice plan generation already works this way.

### Output Presentation
- **D-05:** Jinja2 templates per task — each task YAML points to a Jinja2 HTML template. The template receives structured data from the AI reasoning pipeline. School choice keeps its existing templates, new domains write new Jinja2 templates.
- **D-06:** Platform base + domain layer for template styles — platform provides base HTML structure, typography, color tokens, and Chart.js integration. Domain templates extend the base with domain-specific sections. Professional/modern/minimal styles generalized to platform level.
- **D-07:** YAML chart directives — task YAML specifies chart type (radar, bar, pie), data bindings, and labels. Engine renders via Chart.js. Declarative chart config, no JavaScript knowledge required from task authors.
- **D-08:** Server-side HTML rendering (current pattern) — backend generates complete HTML string via Jinja2. Frontend displays rendered HTML. Self-contained for export. Good for print/PDF.
- **D-09:** Both TipTap editing + AI chat available for post-generation modification — TipTap for direct section edits, AI chat for natural language modifications. Task YAML can enable/disable AI chat per task. Existing plan already supports both.

### AI Reasoning Pipeline
- **D-10:** Single structured AI call — one `call_ai()` with a detailed system prompt that returns structured JSON with all sections (summary, explanations, chart data, action items). Fewer API calls, relies on prompt quality. Works well with capable models.
- **D-11:** AI prompt templates inline in task YAML — system prompt and output schema defined directly in the task YAML file. Everything about a task is in one place. Jinja2 variables for data injection into prompts.
- **D-12:** Streaming via SSE — `call_ai()` gets a streaming variant. Frontend shows output appearing progressively. Better UX for long generations (10-30s). LiteLLM supports streaming natively. Phase 2 D-06 deferred streaming to this phase.
- **D-13:** JSON with schema for AI output — AI returns JSON matching a schema defined in the task YAML. Engine validates against schema before rendering. Reliable parsing, extends existing JSON-patch pattern.

### Recommendation Engine Generalization
- **D-14:** YAML rule definitions for domain recommendations — domain module provides a `rules.yaml` defining eligibility criteria (field comparisons, thresholds), scoring weights (field importance), and scoring formula. Engine evaluates rules generically. New domain = new YAML.
- **D-15:** Three-tier confidence badge — LOW (<=0.4) / MEDIUM (0.4-0.7) / HIGH (>0.7) badge next to each recommendation. Color-coded (red/yellow/green). Tooltip explains which data is missing.
- **D-16:** Confidence thresholds configurable per domain — domain YAML defines its own LOW/MEDIUM/HIGH cutoffs. Each domain decides what "enough data" means for its context.
- **D-17:** SHAP explainability optional per domain — SHAP available when a domain provides an XGBoost (or compatible) model. If no ML model, engine falls back to rule-based scoring only. School choice enables SHAP, other domains may not need it.

### Claude's Discretion
- Exact YAML schema structure for task definitions and rule definitions
- How data slot resolution works internally (entity registry lookup)
- Streaming SSE implementation details (endpoint design, frontend EventSource handling)
- JSON schema validation approach (jsonschema library vs custom)
- How module task override/discovery works at startup
- Chart.js rendering pipeline from YAML directives to embedded JavaScript
- Error handling for malformed AI JSON responses
- Rate limiting approach for consultant task execution
- How Jinja2 base templates are structured and extended

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — Phase 5 covers AI-04, AI-05, AI-06, AI-07, AI-08, AI-09
- `.planning/PROJECT.md` — Constraints: no Docker, non-technical primary users, stack continuity (FastAPI + React + PostgreSQL)
- `.planning/ROADMAP.md` — Phase 5 goal and 5 success criteria

### Prior Phase Decisions (carry forward)
- `.planning/phases/01-platform-foundation/01-CONTEXT.md` — Entity YAML config format, module structure, module manifest discovery, API consolidation
- `.planning/phases/02-ai-provider-abstraction/02-CONTEXT.md` — `call_ai()` entry point (D-05), LiteLLM model string format (D-07), synchronous-only deferred streaming to Phase 5 (D-06)
- `.planning/phases/03-frontend-stabilization/03-CONTEXT.md` — TanStack Query patterns, shadcn/ui components, entity schema API
- `.planning/phases/04-import-and-export/04-CONTEXT.md` — Entity list patterns, action bar design, HTML export as self-contained files

### Existing AI & Recommendation Code (must read before modifying)
- `backend/app/core/ai_service.py` — Current synchronous `call_ai()` wrapper; needs streaming variant
- `backend/app/modules/school_choice/services/plan_chat_service.py` — JSON-patch chat pattern, rate limiting, prompt structure, HTML regeneration
- `backend/app/modules/school_choice/services/matchmaker_v2.py` — Eligibility filter, weighted scoring, ML scoring, `compute_data_completeness()`, SHAP integration
- `backend/app/services/plan_generator.py` — Jinja2 HTML generation with 3 templates, Chart.js, CSS variables, print-safe styling (1,300+ lines — the pattern to generalize)
- `backend/app/platform/yaml_loader.py` — Existing YAML parsing pattern for entity configs

### Frontend Code (must read before modifying)
- `frontend/src/pages/AcademicPlan/AcademicPlan.jsx` — Current plan page with polling, chat panel, TipTap editing, template selector
- `frontend/src/api/plan.js` — Plan API client (generate, chat, template, section edit)
- `frontend/src/components/PlanSectionEditor/PlanSectionEditor.jsx` — TipTap section editor component
- `frontend/src/components/TemplateSelector/TemplateSelector.jsx` — Template switching component

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Current architecture layers, data flow for plan generation
- `.planning/codebase/CONVENTIONS.md` — Naming patterns, code style, module design

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ai_service.py:call_ai()` — Single AI entry point; extend with `call_ai_stream()` for SSE support
- `plan_generator.py` — Jinja2 + Chart.js HTML generation pattern; extract base template structure to platform level
- `matchmaker_v2.py` — Eligibility/scoring/ranking pipeline; refactor into generic engine with pluggable rule evaluator
- `compute_data_completeness()` — Already returns 0.0-1.0 float; add threshold logic and badge rendering
- `plan_chat_service.py` — JSON-patch AI modification pattern; generalize to work with any task output
- `PlanSectionEditor` + `TemplateSelector` — Existing React components for post-generation editing
- `yaml_loader.py` — YAML parsing pattern with dataclass output; extend for task and rule definitions

### Established Patterns
- YAML config → Python dataclass (entity config pattern in `yaml_loader.py`)
- Module manifest for discovery at startup (`module_loader.py`)
- Background task with polling for long operations (plan generation)
- Jinja2 template rendering with CSS variables for theme switching
- Chart.js via CDN in generated HTML

### Integration Points
- `modules/school_choice/tasks/` — New directory for school choice task YAML definitions
- `platform/tasks/` — New directory for platform-level generic tasks
- `platform/task_engine.py` — New: task execution engine (load YAML, resolve data slots, call AI, render template)
- `platform/recommendation_engine.py` — New: generic recommendation engine (load rules YAML, evaluate eligibility/scoring)
- `core/ai_service.py` — Add `call_ai_stream()` for SSE streaming
- `api/v1/routes/` — New consultant task endpoints (trigger, stream, status)
- Frontend: New ConsultantTask page/component with SSE streaming display

</code_context>

<specifics>
## Specific Ideas

- The consultant is NOT freeform chat — it is called to deal with template tasks. The school choice example: explain, convince, visualize, and plan based on ML recommendations.
- The general pattern: everyday business decisions (varying by deployment) that produce professional plans/presentations/roadshows.
- The commonality across all deployments is the appearance of a professional deliverable.
- Existing plan_generator.py's 3 templates (professional/modern/minimal) should be generalized to platform level as base styles.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-consultant-engine*
*Context gathered: 2026-04-25*
