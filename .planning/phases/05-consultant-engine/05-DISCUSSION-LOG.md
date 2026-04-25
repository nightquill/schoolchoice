# Phase 5: Consultant Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 05-consultant-engine
**Areas discussed:** Template Task YAML, Output Presentation, AI Reasoning Pipeline, Recommendation Generalization

**Key clarification before discussion:** User clarified that the consultant engine is NOT freeform AI chat. It is a template-driven task engine — each deployment defines domain-specific tasks that take data + ML recommendations and produce professional plans/presentations. The school choice example: ML matchmaker output -> AI explains, convinces, visualizes, plans -> professional HTML report.

---

## Template Task YAML

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly YAML | YAML defines data sources, AI prompt templates, output sections, chart types. Python only for custom transforms. | ✓ |
| YAML skeleton + Python logic | YAML defines structure, Python implements logic. More flexible but requires code changes. | |
| Full YAML with expressions | Jinja2-style expressions in YAML. No Python for simple tasks. Risks mini-language. | |

**User's choice:** Mostly YAML
**Notes:** New task = new YAML file + optional Python hooks

| Option | Description | Selected |
|--------|-------------|----------|
| Named data slots | YAML declares named slots (primary_entity, reference_data, ml_output). Engine resolves from registry. | ✓ |
| Explicit query paths | YAML specifies exact API endpoints or DB queries. Tightly coupled. | |
| Convention-based | Engine auto-provides entity + related entities. Less config, more magic. | |

**User's choice:** Named data slots

| Option | Description | Selected |
|--------|-------------|----------|
| Inside domain module | Tasks in module folder. Discovered via manifest. | |
| Shared tasks folder | All tasks in platform/tasks/. Easy to browse. | |
| Both with override | Platform provides generic tasks, modules override or add domain-specific ones. | ✓ |

**User's choice:** Both with override

| Option | Description | Selected |
|--------|-------------|----------|
| Single trigger | User clicks Generate -> engine produces report. No wizard steps. | ✓ |
| Optional wizard steps | YAML can define 0+ input steps before generation. | |
| Always multi-step | Every task is a guided workflow with explicit steps. | |

**User's choice:** Single trigger

---

## Output Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Jinja2 templates per task | Each task YAML points to a Jinja2 HTML template. Proven pattern. | ✓ |
| Section-based composition | YAML defines sections, engine composes from reusable renderers. | |
| AI-generated layout | AI decides section order. Most dynamic, hardest quality control. | |

**User's choice:** Jinja2 templates per task

| Option | Description | Selected |
|--------|-------------|----------|
| Generalize to platform | Move 3 template styles to platform level with shared CSS variables. | |
| Per-domain templates | Each domain defines its own templates independently. | |
| Platform base + domain layer | Platform provides base HTML, typography, color tokens, Chart.js. Domains extend. | ✓ |

**User's choice:** Platform base + domain layer

| Option | Description | Selected |
|--------|-------------|----------|
| YAML chart directives | Task YAML specifies chart type, data bindings, labels. Engine renders Chart.js. | ✓ |
| Template-embedded Chart.js | Chart.js code in Jinja2 template with data injection. Current approach. | |
| Chart components library | Pre-built chart components referenced by name. Reusable but limited. | |

**User's choice:** YAML chart directives

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side HTML (current) | Backend generates complete HTML via Jinja2. Self-contained for export. | ✓ |
| Client-side React | Backend returns JSON, frontend renders with React + Chart.js. | |
| Hybrid | Interactive React in-app, server-side HTML for export. | |

**User's choice:** Server-side HTML (current)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, generalize it | AI chat for modifying any task output. Needs per-task prompt engineering. | |
| Per-section TipTap only | Keep TipTap editing only. Simpler. | |
| Both available | TipTap for direct edits + AI chat for natural language modifications. Task YAML enables/disables. | ✓ |

**User's choice:** Both available

---

## AI Reasoning Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Single structured call | One call_ai() returning structured JSON with all sections. Fewer API calls. | ✓ |
| Chained calls per section | Sequential calls, each focused. More tokens, higher per-section quality. | |
| Parallel section calls | Multiple call_ai() in parallel. Fastest but sections may not cohere. | |

**User's choice:** Single structured call

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in task YAML | System prompt and output schema in task YAML. Everything in one place. | ✓ |
| Separate prompt files | YAML references external prompt files. Better for long prompts. | |
| YAML with includes | Short prompts inline, long prompts via !include. | |

**User's choice:** Inline in task YAML

| Option | Description | Selected |
|--------|-------------|----------|
| Streaming via SSE | call_ai() streaming variant. Progressive output. LiteLLM supports natively. | ✓ |
| Synchronous with progress | Keep synchronous. Show progress indicator. | |
| Background job + polling | Current plan generation pattern. Proven but no progressive output. | |

**User's choice:** Streaming via SSE

| Option | Description | Selected |
|--------|-------------|----------|
| JSON with schema | AI returns JSON matching schema in task YAML. Engine validates. | ✓ |
| Markdown with sections | AI returns Markdown. Engine parses by headers. | |
| JSON + structured output | LiteLLM structured output to enforce schema. Most reliable but model-dependent. | |

**User's choice:** JSON with schema

---

## Recommendation Generalization

| Option | Description | Selected |
|--------|-------------|----------|
| YAML rule definitions | rules.yaml defines eligibility, scoring weights, formula. Generic evaluation. | ✓ |
| Python interface + config | Abstract RecommendationEngine interface. Domain implements in Python. | |
| Hybrid | Simple rules in YAML, complex in Python hooks. | |

**User's choice:** YAML rule definitions

| Option | Description | Selected |
|--------|-------------|----------|
| Three-tier badge | LOW/MEDIUM/HIGH with color coding and tooltip. | ✓ |
| Percentage bar | Raw 0-100% progress bar. | |
| Three-tier + detail on hover | Badge default, percentage and missing fields on hover. | |

**User's choice:** Three-tier badge

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable per domain | Domain YAML defines own thresholds. | ✓ |
| Fixed platform defaults | Platform defines fixed cutoffs for all domains. | |
| Platform defaults + override | Platform defaults, domain can override. | |

**User's choice:** Configurable per domain

| Option | Description | Selected |
|--------|-------------|----------|
| Optional per domain | SHAP available when domain provides ML model. Fallback to rule-based. | ✓ |
| Always available | Generate explanations even without ML. | |
| ML domains only | SHAP only with ML model. Rule-based domains use AI for explanations. | |

**User's choice:** Optional per domain

## Claude's Discretion

- Exact YAML schema structure for task and rule definitions
- Data slot resolution internals
- Streaming SSE implementation details
- JSON schema validation approach
- Module task override/discovery at startup
- Chart.js rendering pipeline from YAML to embedded JS
- Error handling for malformed AI responses
- Rate limiting for consultant task execution
- Jinja2 base template structure and extension mechanism

## Deferred Ideas

None — discussion stayed within phase scope
