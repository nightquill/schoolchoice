# Phase 5: Consultant Engine - Research

**Researched:** 2026-04-28
**Domain:** YAML-driven AI content generation, SSE streaming, recommendation engine generalization
**Confidence:** HIGH

## Summary

Phase 5 builds three interconnected systems on top of the existing codebase: (1) a YAML-driven task engine that loads task definitions, resolves entity data slots, renders Jinja2 prompt templates, calls the AI provider, and validates structured JSON output; (2) SSE streaming via `call_ai_stream()` using LiteLLM's `acompletion` async generator, replacing the current polling-based plan generation UX; and (3) a generalized recommendation engine that extracts the eligibility/scoring/ranking logic from `matchmaker_v2.py` into a YAML-configurable rule evaluator with confidence badges.

The codebase already owns every pattern needed. `ai_service.py` provides the single-entry-point `call_ai()` wrapper around LiteLLM. `yaml_loader.py` provides the YAML-to-dataclass parsing pattern. `plan_generator.py` (1,343 lines) provides the Jinja2 + Chart.js HTML rendering pattern. `plan_chat_service.py` provides the JSON-patch modification and rate-limiting pattern. `matchmaker_v2.py` provides the three-tier pipeline (eligibility filter, weighted scoring, optional XGBoost + SHAP). No new frameworks are needed -- the work is extraction, generalization, and extension of existing code.

The AI-SPEC provides complete implementation guidance including `TaskEngine` class structure, `call_ai_stream()` implementation, Pydantic output schemas, retry logic, truncation hierarchy, and SSE endpoint patterns. The UI-SPEC provides complete visual contracts for `ConfidenceBadge`, `SSEStreamDisplay`, and `ConsultantTaskPage`. Research focused on verifying these specs against the actual codebase and identifying gaps.

**Primary recommendation:** Follow the AI-SPEC and UI-SPEC as written -- they are thoroughly grounded in the existing codebase. The main implementation risk is the plan_generator.py extraction (1,343 lines of f-string HTML to Jinja2 template conversion), which should be done incrementally with existing tests as a regression safety net.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Mostly YAML configuration -- YAML defines data sources, AI prompt templates per section, output section order, chart types. Python only for custom data transforms.
- **D-02:** Named data slots for data sources -- YAML declares named slots like `primary_entity: student`, `reference_data: schools`, `ml_output: matchmaker`.
- **D-03:** Tasks live in both platform and domain modules with override -- platform provides generic tasks, modules can override or add domain-specific ones.
- **D-04:** Single trigger execution -- user clicks "Generate Plan" and the engine produces report. No intermediate wizard steps.
- **D-05:** Jinja2 templates per task -- each task YAML points to a Jinja2 HTML template.
- **D-06:** Platform base + domain layer for template styles -- platform provides base HTML structure, typography, color tokens, and Chart.js integration.
- **D-07:** YAML chart directives -- task YAML specifies chart type, data bindings, and labels.
- **D-08:** Server-side HTML rendering (current pattern) -- backend generates complete HTML string via Jinja2.
- **D-09:** Both TipTap editing + AI chat available for post-generation modification.
- **D-10:** Single structured AI call -- one `call_ai()` with detailed system prompt returning structured JSON.
- **D-11:** AI prompt templates inline in task YAML.
- **D-12:** Streaming via SSE -- `call_ai()` gets a streaming variant; Phase 2 D-06 deferred streaming to this phase.
- **D-13:** JSON with schema for AI output -- AI returns JSON matching a schema defined in the task YAML.
- **D-14:** YAML rule definitions for domain recommendations.
- **D-15:** Three-tier confidence badge -- LOW (<=0.4) / MEDIUM (0.4-0.7) / HIGH (>0.7).
- **D-16:** Confidence thresholds configurable per domain -- domain YAML defines its own cutoffs.
- **D-17:** SHAP explainability optional per domain.

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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-04 | Developer can define guided AI workflows in YAML (step sequences with AI calls at designated steps) | TaskEngine + YAML task definitions pattern; `yaml_loader.py` extension pattern verified in codebase |
| AI-05 | Guided workflow engine executes YAML-defined workflows with session state persisted between steps | TaskEngine.execute_task() with data slot resolution; DB persistence via existing AcademicPlan model pattern |
| AI-06 | School choice plan generation rebuilt as a guided workflow on the platform engine | Existing `plan_generator.py` (1,343 lines) extraction to Jinja2 templates + `academic_plan.yaml` task definition |
| AI-07 | Hybrid recommendation engine generalized: configurable eligibility rules + weighted scoring + optional ML model per domain | `matchmaker_v2.py` three-tier pipeline extraction to `RecommendationEngine` with `rules.yaml` per domain |
| AI-08 | SHAP explainability available for any domain module using the ML scoring component | Existing SHAP integration in `matchmaker_v2.py` already domain-agnostic in structure; needs extraction to platform level |
| AI-09 | Eligibility confidence indicator shows data completeness level on each recommendation | `compute_data_completeness()` already returns 0.0-1.0; add threshold logic (D-15) and `ConfidenceBadge` component |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| YAML task definition loading | API / Backend | -- | File I/O and parsing at startup; no frontend involvement |
| Data slot resolution | API / Backend | Database / Storage | Backend resolves entity references; DB provides entity data |
| AI prompt rendering (Jinja2) | API / Backend | -- | Server-side template rendering; no client involvement |
| AI call (structured generation) | API / Backend | -- | LiteLLM call from `ai_service.py`; never from frontend |
| SSE streaming | API / Backend | Browser / Client | Backend generates SSE stream; frontend consumes via EventSource |
| JSON schema validation | API / Backend | -- | Pydantic + jsonschema validation server-side before DB write |
| HTML plan rendering (Jinja2) | API / Backend | -- | Server-side HTML generation; frontend displays in iframe |
| Confidence badge display | Browser / Client | API / Backend | Frontend renders badge; backend computes tier via `compute_data_completeness()` |
| Recommendation engine | API / Backend | Database / Storage | Rule evaluation and scoring in Python; DB provides entity data |
| SHAP explainability | API / Backend | -- | XGBoost + SHAP computation entirely server-side |
| Plan chat modification | API / Backend | Browser / Client | Backend processes JSON patch; frontend sends chat messages |
| Template switching | Browser / Client | API / Backend | Frontend triggers; backend re-renders HTML with new template |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| LiteLLM | >=1.40,<2.0 (pinned in requirements.txt; latest: 1.83.14) | AI provider abstraction, streaming via `acompletion` | Already integrated Phase 2; `call_ai()` + `call_ai_stream()` entry points [VERIFIED: requirements.txt + pip index] |
| Jinja2 | 3.1.4 | Prompt template rendering + HTML plan rendering | Already in requirements.txt; existing pattern in `plan_generator.py` [VERIFIED: requirements.txt] |
| PyYAML | 6.0 | YAML task/rule definition parsing | Already in requirements.txt; existing pattern in `yaml_loader.py` [VERIFIED: requirements.txt] |
| Pydantic | 2.7.1 | Output schema validation, request/response models | Already in requirements.txt; used throughout codebase [VERIFIED: requirements.txt] |
| jsonschema | 4.23.0 (installed as transitive dep; latest: 4.26.0) | Runtime JSON schema validation for task YAML output schemas | Already importable in environment; used alongside Pydantic for YAML-defined schemas [VERIFIED: python import check] |
| FastAPI | 0.111.0 | SSE endpoints via `StreamingResponse` | Already in requirements.txt [VERIFIED: requirements.txt] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| XGBoost | 2.0.3 | ML scoring component for recommendation engine | When domain provides trained model via `ML_MODEL_PATH` [VERIFIED: requirements.txt] |
| SHAP | 0.45.0 | Feature importance explanations | When domain enables SHAP (D-17) and ML model is available [VERIFIED: requirements.txt] |
| nh3 | >=0.2.15 | HTML sanitization | Already in requirements.txt; for any user-provided content in templates [VERIFIED: requirements.txt] |

### Frontend
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React | 19.2.4 | UI framework | Existing; all new components [VERIFIED: package.json] |
| @tanstack/react-query | 5.100.2 | Server state management | Existing; plan data fetching [VERIFIED: package.json] |
| @tiptap/react | 3.21.0 | Rich text section editing | Existing; plan section editor [VERIFIED: package.json] |
| shadcn/ui (Radix primitives) | base-nova style | Badge, Popover, Button components | Existing; confidence badge uses Badge + Popover [VERIFIED: UI-SPEC] |
| lucide-react | 1.11.0 | Icons | Existing; toolbar icons [VERIFIED: package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsonschema | Pydantic-only validation | Pydantic requires a Python model; jsonschema validates against YAML-defined schemas without code generation. Use both: jsonschema for runtime YAML-schema validation, Pydantic for typed downstream use. |
| EventSource (native browser) | fetch + ReadableStream | EventSource auto-reconnects and handles SSE format natively. fetch+ReadableStream requires manual SSE parsing. EventSource is simpler for this use case. |
| f-string HTML (current) | Jinja2 file templates | D-05 locks Jinja2. Current 1,343-line f-string approach is not maintainable at the platform generalization level. |

**Installation:**
```bash
# Backend: jsonschema is the only potentially new explicit dependency
pip install jsonschema>=4.23.0
# All other backend deps already in requirements.txt

# Frontend: no new dependencies needed
# shadcn components already installed: badge, button, card, popover, etc.
```

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Generate Plan"
        |
        v
[Frontend: ConsultantTaskPage]
        |
        | POST /api/v1/consultant/tasks/{task_id}/stream?entity_id={id}
        v
[FastAPI Router: consultant.py]
        |
        v
[TaskEngine.load_task(task_id)]
        |  Searches: modules/{domain}/tasks/ -> platform/tasks/
        |  Returns: TaskDefinition dataclass
        v
[TaskEngine.build_messages(task_def, entity_id, db)]
        |  1. Resolve data slots (student, matchmaker, etc.)
        |  2. Render Jinja2 prompt templates with entity data
        |  3. Check token count, truncate if needed
        |  Returns: messages list
        v
[call_ai_stream(messages, **kwargs)]  -----> [LiteLLM acompletion(stream=True)]
        |                                              |
        | SSE chunks: "data: {token}\n\n"              | Provider API
        v                                              v
[StreamingResponse] <--- async generator <--- [AI Provider (OpenAI/Anthropic/Gemini)]
        |
        | SSE stream
        v
[Frontend: SSEStreamDisplay]
        |  Accumulates tokens
        |  On "done" event:
        v
[POST /api/v1/consultant/tasks/{task_id}/save]
        |
        v
[TaskEngine.execute_task() -- validate JSON, render Jinja2 HTML]
        |
        v
[AcademicPlan DB row updated: html_content, recommended_schools, version++]
```

### Component Responsibilities

| Component | File(s) | Responsibility |
|-----------|---------|----------------|
| TaskEngine | `platform/task_engine.py` (NEW) | Load YAML tasks, resolve data slots, build messages, execute with retry |
| RecommendationEngine | `platform/recommendation_engine.py` (NEW) | Load YAML rules, evaluate eligibility/scoring generically |
| call_ai_stream | `core/ai_service.py` (EXTEND) | Async streaming LiteLLM wrapper |
| ConsultantTaskPage | `frontend/src/pages/ConsultantTask/` (NEW) | Full page: SSE display, chat panel, toolbar |
| ConfidenceBadge | `frontend/src/components/ConfidenceBadge/` (NEW) | THREE-tier badge with tooltip |
| SSEStreamDisplay | `frontend/src/components/SSEStreamDisplay/` (NEW) | Token-by-token streaming display |
| academic_plan.yaml | `modules/school_choice/tasks/` (NEW) | School choice task definition |
| matching_rules.yaml | `modules/school_choice/rules/` (NEW) | School choice eligibility/scoring rules |

### Recommended Project Structure
```
backend/app/
  core/
    ai_service.py               # EXTEND: add call_ai_stream()
  platform/
    yaml_loader.py              # EXTEND: add load_task_yaml(), load_rules_yaml()
    task_engine.py              # NEW: TaskDefinition, TaskEngine
    recommendation_engine.py    # NEW: RuleDefinition, RecommendationEngine
    schemas/
      consultant_output.py      # NEW: ConsultantPlanOutput Pydantic model
    templates/
      base_plan.html.j2         # NEW: platform-level base Jinja2 template
    tasks/                      # NEW: platform-level generic tasks (empty at start)
  modules/
    school_choice/
      tasks/
        academic_plan.yaml      # NEW: school choice task definition
      rules/
        matching_rules.yaml     # NEW: eligibility + scoring rules from matchmaker_v2.py
      templates/
        professional.html.j2    # NEW: extracted from plan_generator.py
        modern.html.j2          # NEW: extracted from plan_generator.py
        minimal.html.j2         # NEW: extracted from plan_generator.py
  api/v1/routes/
    consultant.py               # NEW: /consultant/tasks/{task_id}/stream, /save, /status

frontend/src/
  pages/
    ConsultantTask/
      ConsultantTask.jsx        # NEW: generalized plan page
  components/
    ConfidenceBadge/
      ConfidenceBadge.jsx       # NEW: three-tier badge
    SSEStreamDisplay/
      SSEStreamDisplay.jsx      # NEW: streaming text display
```

### Pattern 1: YAML Task Definition
**What:** Each consultant task is a YAML file defining data sources, prompts, output schema, and rendering template.
**When to use:** Every new consultant task -- no Python code changes needed for new tasks.
**Example:**
```yaml
# Source: AI-SPEC Section 4b.3 + CONTEXT.md D-01, D-02, D-11
task_id: academic_plan
name: Academic Plan
description: Generate a school choice academic plan for a student

data_slots:
  student: student
  matchmaker: matchmaker

prompts:
  system: |
    You are a professional academic consultant...
    GROUNDING RULES:
    1. Only reference schools that appear in the provided match results.
    ...
  user: |
    Student Profile:
    {{ student | tojson(indent=2) }}
    School Match Results:
    {{ matchmaker | tojson(indent=2) }}
    Generate the academic plan now.

output_schema:
  type: object
  required: [student_summary, recommended_schools, action_plan]
  properties:
    student_summary: { type: string, minLength: 50 }
    recommended_schools:
      type: array
      items:
        type: object
        required: [school_name, rationale, fit_score, confidence_tier]
        properties:
          school_name: { type: string }
          rationale: { type: string, minLength: 20 }
          fit_score: { type: number, minimum: 0, maximum: 1 }
          confidence_tier: { type: string, enum: [LOW, MEDIUM, HIGH] }
          action_items: { type: array, items: { type: string } }

jinja2_template: professional.html.j2
max_tokens: 4096
temperature: 0.3
enable_chat: true
```

### Pattern 2: SSE Streaming Endpoint
**What:** Async endpoint that streams AI tokens to the frontend via SSE.
**When to use:** User-facing "Generate Plan" button -- first token visible in ~1s.
**Example:**
```python
# Source: AI-SPEC Section 3 + CONTEXT.md D-12
@router.post("/consultant/tasks/{task_id}/stream")
async def stream_consultant_task(
    task_id: str,
    entity_id: str = Query(...),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    engine = TaskEngine()
    task_def = engine.load_task(task_id)
    messages = engine.build_messages(task_def, entity_id, db)
    return StreamingResponse(
        call_ai_stream(messages, max_tokens=task_def.max_tokens, temperature=task_def.temperature),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### Pattern 3: YAML Rule Definitions for Recommendation Engine
**What:** Domain module provides a `rules.yaml` defining eligibility criteria and scoring weights.
**When to use:** Any domain that needs ranked recommendations with confidence badges.
**Example:**
```yaml
# Source: CONTEXT.md D-14, D-16
domain: school_choice
confidence_thresholds:
  high: 0.7
  medium: 0.4

eligibility_rules:
  - name: minimum_aggregate_score
    field: student.best5_aggregate
    operator: ">="
    threshold_field: school.minimum_entry_score
    skip_when_null: true
  - name: required_subjects
    type: subject_requirement_check
    # complex rule: delegates to Python hook

scoring_weights:
  academic_fit: 0.50
  subject_alignment: 0.20
  language_fit: 0.15
  interest_alignment: 0.15

ml_model:
  enabled: true
  blend_weight: 0.4  # final = 0.6*weighted + 0.4*ml
  shap_enabled: true
```

### Anti-Patterns to Avoid
- **Importing `litellm` outside `ai_service.py`:** All LiteLLM calls MUST go through `call_ai()` or `call_ai_stream()`. Bypassing skips API key guards, model string builder, error normalization. [VERIFIED: AI-SPEC Pitfall 1]
- **Using `asyncio.run()` inside a FastAPI route:** FastAPI operates inside a running event loop. Use `async def` and `await` directly. [VERIFIED: AI-SPEC Pitfall 2]
- **Validating Pydantic on a streaming response:** Tokens arrive incrementally -- cannot validate partial JSON. Use `call_ai()` (synchronous) for DB writes; use `call_ai_stream()` for display only. [VERIFIED: AI-SPEC Section 4b.2]
- **Mixing entity data into the system prompt:** System prompt is the stable contract (cacheable by Anthropic); user prompt carries the variable entity data. [VERIFIED: AI-SPEC Section 4b.3]
- **Writing raw `yaml.safe_load()` in feature code:** Always go through typed loader functions in `yaml_loader.py` with null guards and validation. [VERIFIED: existing `yaml_loader.py` pattern]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AI provider abstraction | Custom HTTP clients per provider | LiteLLM `acompletion()` / `completion()` | Already integrated; handles auth, retries, model routing across 100+ providers [VERIFIED: Phase 2 integration] |
| SSE wire format | Custom SSE frame serializer | FastAPI `StreamingResponse` + `"data: {chunk}\n\n"` format | Standard SSE format; native `EventSource` browser API handles reconnection and parsing [VERIFIED: FastAPI docs] |
| JSON Schema validation | Custom validator | `jsonschema.validate()` + Pydantic | jsonschema handles the YAML-defined schemas; Pydantic handles typed Python objects [VERIFIED: jsonschema 4.23.0 available] |
| HTML sanitization | Custom escaper | `nh3` (already in deps) + `html.escape()` | Existing pattern in `plan_generator.py`; nh3 for untrusted HTML, html.escape for template values [VERIFIED: requirements.txt] |
| YAML parsing | Custom config parser | PyYAML `safe_load()` via `yaml_loader.py` | Established pattern; null guards, type validation already in place [VERIFIED: yaml_loader.py] |
| Confidence calculation | New completeness algorithm | Extend existing `compute_data_completeness()` | Already returns 0.0-1.0 float with compulsory/elective weighting [VERIFIED: matchmaker_v2.py] |

**Key insight:** This phase is 90% extraction and generalization of existing code, not greenfield development. The 1,343-line `plan_generator.py`, 661-line `matchmaker_v2.py`, and 260-line `plan_chat_service.py` contain all the domain logic -- the work is making it YAML-configurable and domain-agnostic.

## Common Pitfalls

### Pitfall 1: Breaking Existing Plan Generation During Extraction
**What goes wrong:** Extracting `plan_generator.py` (1,343 lines of f-string HTML) into Jinja2 templates introduces rendering regressions -- missing CSS variables, broken Chart.js scripts, lost print styles.
**Why it happens:** The existing code uses Python f-strings with complex HTML embedding. Converting to Jinja2 templates changes the escaping rules and variable resolution.
**How to avoid:** Keep the existing `plan_generator.py` working throughout the migration. Build the new Jinja2 templates alongside it. Switch the endpoint to the new engine only after visual comparison confirms identical output. Run `test_v2_services.py` after every change.
**Warning signs:** Plan HTML output changes size significantly; Chart.js fails to render; print layout breaks.

### Pitfall 2: SSE Stream Drops Without Cleanup
**What goes wrong:** Client disconnects mid-stream (network issue, user navigates away) but backend continues generating tokens, wasting API credits. Or: partial plan JSON gets written to the DB.
**Why it happens:** SSE connections are long-lived (10-30s for plan generation). No server-side awareness of client disconnect in the simple `StreamingResponse` pattern.
**How to avoid:** Never write to DB during streaming. Accumulate the full response client-side, then POST the complete JSON to a separate `/save` endpoint for validation and persistence. Use `EventSource.onerror` to detect drops. Backend: `call_ai_stream()` raises HTTPException on provider errors -- `StreamingResponse` handles the connection close.
**Warning signs:** Partial plans in DB; AI API cost higher than expected; users see "generation failed" frequently.

### Pitfall 3: Confidence Badge Disagrees with AI Output
**What goes wrong:** AI assigns HIGH confidence to a school that `compute_data_completeness()` scores as MEDIUM (0.55). User trusts the badge. The recommendation is based on insufficient data.
**Why it happens:** The AI infers confidence from its own assessment of the data quality, which may differ from the deterministic `compute_data_completeness()` calculation.
**How to avoid:** AI-SPEC Section 6 defines an online guardrail: after AI validation, compare AI-returned `confidence_tier` against `compute_data_completeness()` output for each school. Downgrade AI tier if higher than code-computed tier. Never upgrade.
**Warning signs:** Confidence tier override rate above 15% in monitoring.

### Pitfall 4: YAML Task Discovery Fails Silently
**What goes wrong:** A new task YAML file has a typo or missing required field. The engine fails when a user clicks "Generate Plan" -- a runtime error on the critical path.
**Why it happens:** YAML is parsed at request time, not at startup. Malformed YAML is not caught until user interaction.
**How to avoid:** Add a `validate_all_task_yamls()` function called at application startup (in `main.py` lifespan). Parse every YAML in platform/tasks/ and modules/*/tasks/. Fail loudly at startup if any YAML is malformed or missing required fields.
**Warning signs:** HTTP 500 errors on consultant endpoints after deployment.

### Pitfall 5: Token Budget Exceeded by Growing Entity Data
**What goes wrong:** A student with many subjects, awards, and matchmaker results with full SHAP explanations produces a prompt exceeding the context window. The AI call fails or produces truncated output.
**Why it happens:** Entity data grows over time. The prompt template includes `{{ matchmaker | tojson }}` which serializes everything.
**How to avoid:** AI-SPEC Section 4b.4 defines a truncation hierarchy: measure token count after building messages; if over `max_context_tokens` (default 60K), apply truncation steps in order (reduce to top 5, truncate rationales, remove SHAP dicts, remove low-priority fields). Raise ValueError only if still over budget after all steps.
**Warning signs:** `prompt_tokens` in AI response usage exceeding 10K; truncation warnings in logs.

## Code Examples

### call_ai_stream() -- Async SSE Generator
```python
# Source: AI-SPEC Section 3 -- verified against existing call_ai() pattern in ai_service.py
async def call_ai_stream(
    messages: list[dict[str, str]],
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI_API_KEY is not configured.")

    model_string = _build_model_string()
    try:
        response = await litellm.acompletion(
            model=model_string,
            messages=messages,
            api_key=settings.AI_API_KEY,
            api_base=settings.AI_BASE_URL or None,
            timeout=settings.AI_TIMEOUT,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            content = chunk.choices[0].delta.content or ""
            if content:
                yield f"data: {content}\n\n"
        yield "event: done\ndata: \n\n"
    except litellm.AuthenticationError:
        raise HTTPException(status_code=503, detail="AI provider authentication failed.")
    except Exception:
        raise HTTPException(status_code=502, detail="Unexpected AI provider error.")
```

### Frontend EventSource Consumer
```javascript
// Source: AI-SPEC Section 4b.2 -- frontend SSE pattern
const source = new EventSource(
  `/api/v1/consultant/tasks/${taskId}/stream?entity_id=${entityId}`
);
let buffer = '';
source.onmessage = (event) => {
  buffer += event.data;
  appendToken(event.data);
};
source.addEventListener('done', () => {
  source.close();
  // POST the complete buffer for validation and DB persistence
  saveGeneratedPlan(taskId, entityId, buffer);
});
source.onerror = () => {
  source.close();
  showError('Generation was interrupted. Please try again.');
};
```

### TaskDefinition Dataclass
```python
# Source: AI-SPEC Section 4 -- mirrors yaml_loader.py EntityConfig pattern
@dataclass
class TaskDefinition:
    task_id: str
    name: str
    description: str
    data_slots: dict[str, str]
    system_prompt_template: str
    user_prompt_template: str
    output_schema: dict
    jinja2_template: str
    max_tokens: int = 4096
    temperature: float = 0.3
    enable_chat: bool = True
    max_context_tokens: int = 60_000
```

### Confidence Badge Tier Calculation
```python
# Source: CONTEXT.md D-15 + matchmaker_v2.py compute_data_completeness()
def compute_confidence_tier(
    data_completeness: float,
    thresholds: dict | None = None,
) -> tuple[str, str]:
    """Returns (tier, tooltip_text)."""
    t = thresholds or {"high": 0.7, "medium": 0.4}
    if data_completeness > t["high"]:
        return ("HIGH", "All eligibility data complete.")
    elif data_completeness > t["medium"]:
        return ("MEDIUM", f"Some data missing. Confidence reflects available data only.")
    else:
        return ("LOW", f"Significant data missing. Confidence reflects available data only.")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling-based plan generation (current) | SSE streaming via `call_ai_stream()` | Phase 5 | First token visible in ~1s vs 10-30s blank wait |
| Hardcoded `plan_generator.py` f-strings | Jinja2 templates per task YAML | Phase 5 | New tasks via YAML, not Python changes |
| School-choice-specific matchmaker | Generic `RecommendationEngine` with YAML rules | Phase 5 | Second domain pluggable via rules.yaml |
| No confidence indicator | Three-tier badge (LOW/MEDIUM/HIGH) | Phase 5 | Users see data completeness signal |

**Deprecated/outdated:**
- `plan_generator.py` f-string HTML generation: Replaced by Jinja2 templates, but keep functioning during migration
- Direct `plan_chat_service.py` Gemini references in comments: Already fixed in Phase 2 to use `call_ai()`, but some comments still say "Gemini"

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | EventSource (GET-only) will work with the POST endpoint pattern in AI-SPEC | Architecture Patterns | EventSource only supports GET. The SSE endpoint may need to be GET with query params, or use fetch+ReadableStream instead. Medium risk -- affects frontend implementation. |
| A2 | `jsonschema` 4.23.0 (installed as transitive dependency) will remain available after next pip install | Standard Stack | If jsonschema is removed as a transitive dep, it must be added explicitly to requirements.txt. Low risk. |
| A3 | Jinja2 `Environment(loader=BaseLoader())` with `from_string()` is performant enough for request-time template rendering | Architecture Patterns | If slow, switch to `FileSystemLoader` with template caching. Low risk -- prompts are small strings. |
| A4 | The existing 60 backend tests will catch regressions during plan_generator.py extraction | Pitfalls | If tests don't cover specific HTML output patterns, silent rendering regressions are possible. Medium risk. |

**IMPORTANT NOTE on A1:** The AI-SPEC shows `EventSource` with a URL pattern, but `EventSource` is a GET-only API. The endpoint in the AI-SPEC is defined as `POST`. There are two resolution paths: (1) change the endpoint to GET with query parameters for `task_id` and `entity_id`, or (2) use `fetch()` with `ReadableStream` on the frontend instead of `EventSource`. The planner must address this discrepancy. Recommendation: Use GET endpoint since the operation is idempotent (re-running produces equivalent output) and the only parameters are `task_id` and `entity_id` (both URL/query safe).

## Open Questions

1. **EventSource GET vs POST for SSE endpoint**
   - What we know: `EventSource` browser API only supports GET requests. AI-SPEC defines the endpoint as POST.
   - What's unclear: Whether the team prefers GET (simple, native EventSource) or POST (more RESTful for "trigger generation" semantics, requires fetch+ReadableStream).
   - Recommendation: Use GET with query params. The operation is idempotent. `EventSource` provides automatic reconnection. If POST is required for semantic correctness, use `fetch()` + `ReadableStream` + manual SSE parsing on the frontend.

2. **plan_generator.py extraction strategy**
   - What we know: 1,343 lines of f-string HTML with 3 templates (professional/modern/minimal), Chart.js, print CSS, section helpers.
   - What's unclear: Whether to extract incrementally (one section at a time) or all at once.
   - Recommendation: Incremental extraction. Keep `generate_html_plan()` working throughout. Build Jinja2 templates alongside. Switch endpoint last.

3. **Streaming + validation two-phase pattern**
   - What we know: Streaming shows tokens live; validation requires complete JSON. AI-SPEC implies streaming for UX, then separate sync call for DB persistence.
   - What's unclear: Whether to stream the actual JSON (and accumulate client-side for save) or stream a user-friendly text representation and then do a separate sync AI call for the structured JSON.
   - Recommendation: Stream the actual JSON. Client accumulates the buffer. On "done" event, POST the accumulated JSON to a `/save` endpoint for server-side Pydantic validation and DB write. One AI call, not two.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Backend | Assumed (existing project runs) | -- | -- |
| PostgreSQL | Database | Assumed (existing project runs) | -- | -- |
| Node.js / npm | Frontend | Assumed (existing project runs) | -- | -- |
| LiteLLM | AI calls | In requirements.txt | >=1.40 | -- |
| Jinja2 | Template rendering | In requirements.txt | 3.1.4 | -- |
| jsonschema | Schema validation | Importable (4.23.0) | 4.23.0 | Add explicitly to requirements.txt |
| Arize Phoenix | Eval/tracing (AI-SPEC) | Not installed | -- | Defer to post-Phase 5; not blocking |
| Promptfoo | CI eval (AI-SPEC) | Not installed | -- | Defer to post-Phase 5; not blocking |

**Missing dependencies with no fallback:** None -- all core dependencies available.

**Missing dependencies with fallback:**
- Arize Phoenix and Promptfoo (eval tooling from AI-SPEC): Not installed. These are recommended for production monitoring but not required for Phase 5 implementation. Install as a post-Phase 5 operational task.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.2.0 (backend), Vitest via vite.config.js (frontend) |
| Config file | `backend/tests/conftest.py` (SQLite in-memory), `frontend/vite.config.js` (jsdom) |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-04 | YAML task definition loads and parses correctly | unit | `pytest tests/test_task_engine.py::test_load_task_yaml -x` | Wave 0 |
| AI-04 | Data slot resolution returns correct entity data | unit | `pytest tests/test_task_engine.py::test_resolve_data_slots -x` | Wave 0 |
| AI-05 | TaskEngine.execute_task produces valid JSON | integration | `pytest tests/test_task_engine.py::test_execute_task_validates_output -x` | Wave 0 |
| AI-06 | academic_plan.yaml task produces plan matching existing format | integration | `pytest tests/test_consultant_migration.py::test_academic_plan_task -x` | Wave 0 |
| AI-07 | RecommendationEngine evaluates YAML rules correctly | unit | `pytest tests/test_recommendation_engine.py::test_evaluate_rules -x` | Wave 0 |
| AI-07 | RecommendationEngine produces same results as matchmaker_v2 for school choice | integration | `pytest tests/test_recommendation_engine.py::test_school_choice_parity -x` | Wave 0 |
| AI-08 | SHAP explanations available when ML model configured | unit | `pytest tests/test_recommendation_engine.py::test_shap_enabled -x` | Wave 0 |
| AI-09 | Confidence tier computed correctly for all three tiers | unit | `pytest tests/test_recommendation_engine.py::test_confidence_tiers -x` | Wave 0 |
| AI-09 | Confidence tier guardrail downgrades AI-inflated tiers | unit | `pytest tests/test_task_engine.py::test_confidence_guardrail -x` | Wave 0 |
| SSE | call_ai_stream yields SSE-formatted chunks | unit | `pytest tests/test_ai_service.py::test_call_ai_stream -x` | Wave 0 |
| SSE | Consultant SSE endpoint returns StreamingResponse | integration | `pytest tests/test_consultant_routes.py::test_stream_endpoint -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_task_engine.py` -- covers AI-04, AI-05, AI-06
- [ ] `tests/test_recommendation_engine.py` -- covers AI-07, AI-08, AI-09
- [ ] `tests/test_consultant_routes.py` -- covers SSE endpoint integration
- [ ] `tests/test_consultant_migration.py` -- covers AI-06 parity with existing plan generation
- [ ] Add `jsonschema>=4.23.0` explicitly to `requirements.txt` (currently transitive dep only)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Existing JWT auth unchanged |
| V3 Session Management | No | Existing session pattern unchanged |
| V4 Access Control | Yes | Existing `get_current_user` dependency on new consultant endpoints |
| V5 Input Validation | Yes | Pydantic request schemas; jsonschema for AI output; `html.escape()` + `nh3` for template values |
| V6 Cryptography | No | No new crypto operations |
| V13 API Security | Yes | Rate limiting (20 requests/entity/24h); token count ceiling; SSE timeout |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via entity data | Tampering | Jinja2 auto-escaping in prompts; system prompt grounding rules enforce data-only responses; output schema validation rejects unexpected structures |
| PII leakage to AI provider | Information Disclosure | Data slot resolution limits which entity fields enter the prompt; PII blocklist scan in `build_messages()`; FERPA data minimization (AI-SPEC Section 5) |
| AI output injection (XSS in generated HTML) | Tampering | All AI-generated content passed through `html.escape()` before Jinja2 template insertion; `nh3` for any HTML that must preserve formatting |
| SSE connection exhaustion | Denial of Service | Rate limiting per entity/user; `max_context_tokens` ceiling; streaming timeout in LiteLLM config |
| YAML injection via malformed task files | Tampering | `yaml.safe_load()` (not `yaml.load()`) used exclusively; YAML files are developer-authored, not user-uploaded |

## Sources

### Primary (HIGH confidence)
- `backend/app/core/ai_service.py` -- existing `call_ai()` implementation verified
- `backend/app/platform/yaml_loader.py` -- existing YAML parsing pattern verified
- `backend/app/modules/school_choice/services/matchmaker_v2.py` -- existing recommendation pipeline verified (661 lines)
- `backend/app/modules/school_choice/services/plan_generator.py` -- existing HTML generation verified (1,343 lines)
- `backend/app/modules/school_choice/services/plan_chat_service.py` -- existing chat pattern verified (260 lines)
- `backend/app/platform/module_loader.py` -- existing module discovery pattern verified
- `backend/requirements.txt` -- all backend dependencies verified
- `frontend/package.json` -- all frontend dependencies verified
- LiteLLM latest version 1.83.14 [VERIFIED: pip index versions litellm]
- jsonschema 4.23.0 installed as transitive dependency [VERIFIED: python import check]
- `.planning/phases/05-consultant-engine/05-AI-SPEC.md` -- comprehensive implementation guidance
- `.planning/phases/05-consultant-engine/05-UI-SPEC.md` -- complete visual/interaction contracts

### Secondary (MEDIUM confidence)
- FastAPI StreamingResponse SSE pattern [CITED: docs.fastapi.tiangolo.com/advanced/custom-response]
- LiteLLM acompletion streaming API [CITED: github.com/berriai/litellm]
- EventSource browser API limitations (GET-only) [ASSUMED -- well-known browser API constraint]

### Tertiary (LOW confidence)
- Arize Phoenix and Promptfoo eval tooling availability and compatibility [ASSUMED -- not installed, not tested in this environment]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified in requirements.txt and package.json; no new frameworks needed
- Architecture: HIGH -- all patterns grounded in existing codebase code; AI-SPEC provides complete implementation guidance
- Pitfalls: HIGH -- derived from actual codebase analysis (1,343-line extraction risk, SSE GET/POST discrepancy, confidence badge disagreement)

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable -- no fast-moving external dependencies; LiteLLM pinned to <2.0)
