# Phase 5: Consultant Engine - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/platform/task_engine.py` | service | request-response | `backend/app/platform/yaml_loader.py` + `backend/app/modules/school_choice/services/plan_chat_service.py` | role-match |
| `backend/app/platform/recommendation_engine.py` | service | CRUD | `backend/app/modules/school_choice/services/matchmaker_v2.py` | exact |
| `backend/app/platform/schemas/consultant_output.py` | model | transform | `backend/app/schemas/v2/plan.py` | exact |
| `backend/app/platform/templates/base_plan.html.j2` | template | transform | `backend/app/modules/school_choice/services/plan_generator.py` | exact |
| `backend/app/modules/school_choice/templates/professional.html.j2` | template | transform | `backend/app/modules/school_choice/services/plan_generator.py` | exact |
| `backend/app/modules/school_choice/templates/modern.html.j2` | template | transform | `backend/app/modules/school_choice/services/plan_generator.py` | exact |
| `backend/app/modules/school_choice/templates/minimal.html.j2` | template | transform | `backend/app/modules/school_choice/services/plan_generator.py` | exact |
| `backend/app/modules/school_choice/tasks/academic_plan.yaml` | config | file-I/O | `backend/app/modules/school_choice/config.yaml` + entity YAMLs | role-match |
| `backend/app/modules/school_choice/rules/matching_rules.yaml` | config | file-I/O | `backend/app/modules/school_choice/config.yaml` | role-match |
| `backend/app/core/ai_service.py` (EXTEND) | service | streaming | `backend/app/core/ai_service.py` (self) | exact |
| `backend/app/platform/yaml_loader.py` (EXTEND) | utility | file-I/O | `backend/app/platform/yaml_loader.py` (self) | exact |
| `backend/app/api/v1/routes/consultant.py` | controller | streaming + request-response | `backend/app/api/v1/routes/plan.py` | exact |
| `frontend/src/pages/ConsultantTask/ConsultantTask.jsx` | component | streaming + request-response | `frontend/src/pages/AcademicPlan/AcademicPlan.jsx` | exact |
| `frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx` | component | request-response | `frontend/src/components/EligibilityBadge/EligibilityBadge.jsx` | exact |
| `frontend/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx` | component | streaming | None | no-analog |
| `frontend/src/api/consultant.js` | utility | request-response | `frontend/src/api/plan.js` | exact |
| `backend/tests/test_task_engine.py` | test | CRUD | existing test files | role-match |
| `backend/tests/test_recommendation_engine.py` | test | CRUD | existing test files | role-match |

## Pattern Assignments

### `backend/app/platform/task_engine.py` (service, request-response)

**Analog 1 - YAML loading:** `backend/app/platform/yaml_loader.py`

**Dataclass pattern** (lines 17-34):
```python
@dataclass
class FieldConfig:
    name: str
    type: str = "string"
    required: bool = False
    max_length: Optional[int] = None
    min: Optional[float] = None
    max: Optional[float] = None
    regex: Optional[str] = None
    choices: list[str] = field(default_factory=list)


@dataclass
class EntityConfig:
    name: str
    table: str
    fields: list[FieldConfig] = field(default_factory=list)
    auto_crud: bool = True
    key_fields: list[str] = field(default_factory=list)
```
**Apply as:** `TaskDefinition` dataclass with fields: `task_id`, `name`, `description`, `data_slots`, `system_prompt_template`, `user_prompt_template`, `output_schema`, `jinja2_template`, `max_tokens`, `temperature`, `enable_chat`, `max_context_tokens`.

**YAML loading function pattern** (lines 37-71):
```python
def load_entity_yaml(path: Path) -> EntityConfig:
    with open(path) as f:
        raw = yaml.safe_load(f) or {}  # null guard
    if "name" not in raw:
        raise ValueError(f"Entity YAML missing required 'name' field: {path}")
    # ... field-by-field extraction with defaults and validation ...
    return EntityConfig(
        name=raw["name"],
        table=raw.get("table", raw["name"] + "s"),
        fields=fields,
        auto_crud=raw.get("auto_crud", True),
        key_fields=raw.get("key_fields", []),
    )
```
**Apply as:** `load_task_yaml(path: Path) -> TaskDefinition` following same pattern: `yaml.safe_load` with null guard, required field validation, field-by-field extraction with defaults.

**Analog 2 - AI call + patch pattern:** `backend/app/modules/school_choice/services/plan_chat_service.py`

**Message construction pattern** (lines 166-170):
```python
messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": f"Current plan data:\n{context_json}\n\nCounsellor instruction: {message}"},
]
raw_text = call_ai(messages)
```
**Apply as:** `TaskEngine.build_messages()` constructs the same `[system, user]` messages list but renders Jinja2 templates for the prompt content instead of f-strings.

**JSON parsing + error handling pattern** (lines 172-183):
```python
# Strip markdown code fences if AI wraps in them
if raw_text.startswith("```"):
    raw_text = re.sub(r"^```[a-z]*\n?", "", raw_text)
    raw_text = re.sub(r"\n?```$", "", raw_text.strip())

try:
    patch = json.loads(raw_text)
except json.JSONDecodeError as exc:
    raise HTTPException(
        status_code=502,
        detail=f"AI returned invalid JSON: {exc}",
    )
```
**Apply as:** `TaskEngine.execute_task()` uses same code-fence stripping + JSON parse + jsonschema validation.

---

### `backend/app/platform/recommendation_engine.py` (service, CRUD)

**Analog:** `backend/app/modules/school_choice/services/matchmaker_v2.py`

**Dataclass pattern** (lines 19-34):
```python
@dataclass
class MatchResult:
    school_id: str
    school_name: str
    major_name: Optional[str]
    major_jupas_code: Optional[str]
    eligibility_pass: bool
    failing_criteria: list[str]
    fit_score: float
    component_scores: dict
    ml_probability: Optional[float]
    final_score: float
    shap_explanation: Optional[dict]
    rationale: str
    data_completeness: float = 0.0
```
**Apply as:** Generic `RecommendationResult` dataclass. Domain-agnostic field names (e.g., `entity_id` instead of `school_id`).

**Data completeness function** (lines 40-54):
```python
def compute_data_completeness(student_data: dict) -> float:
    grades = student_data.get("grades_by_code", {})
    compulsory_present = sum(
        1 for c in ["CHLA", "ENGL", "MATH", "CSD"]
        if c in grades and grades[c]
    )
    compulsory_score = compulsory_present / 4
    elective_grades = [v for k, v in grades.items() if k not in {"CHLA", "ENGL", "MATH", "CSD"}]
    elective_score = min(len([g for g in elective_grades if g]) / 2, 1.0) if elective_grades else 0.0
    return round((compulsory_score * 0.7 + elective_score * 0.3), 2)
```
**Apply as:** The generic engine delegates completeness calculation to a domain-provided function (or the YAML rules). School choice provides a Python hook implementing this exact logic.

**Eligibility filter pattern** (lines 61-123):
```python
def run_eligibility_filter(
    student_data: dict,
    school: dict,
) -> tuple[bool, list[str]]:
    failing: list[str] = []
    best5 = student_data.get("best5_aggregate", 0) or 0
    min_score = school.get("minimum_entry_score")
    if min_score is not None and best5 > 0 and best5 < min_score:
        failing.append(f"Aggregate score below minimum ...")
    # ... more rules ...
    return (len(failing) == 0, failing)
```
**Apply as:** Generic `evaluate_eligibility(entity_data, target, rules)` that reads rule definitions from YAML and evaluates `field`, `operator`, `threshold_field` declaratively. Complex rules delegate to Python hooks.

**Weighted scoring pattern** (lines 168-199):
```python
def compute_weighted_score(student_data: dict, school: dict) -> dict:
    best5 = float(student_data.get("best5_aggregate") or 0)
    # Academic fit (50%)
    # Subject alignment (20%)
    # Language fit (15%)
    # Interest alignment (15%)
    # ... returns dict with each component and total weighted_score
```
**Apply as:** Generic scorer reads `scoring_weights` from YAML, applies each weight to a computed component score. Domain provides component score functions via Python hooks.

---

### `backend/app/core/ai_service.py` EXTEND (service, streaming)

**Analog:** Self -- `backend/app/core/ai_service.py` (lines 1-81)

**Existing `call_ai()` pattern** (lines 39-81):
```python
def call_ai(messages: list[dict[str, str]], **kwargs: Any) -> str:
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI chat is not available: AI_API_KEY is not configured.")
    model_string = _build_model_string()
    logger.info("Calling AI provider: %s", model_string)
    try:
        response = litellm.completion(
            model=model_string, messages=messages,
            api_key=settings.AI_API_KEY, api_base=settings.AI_BASE_URL or None,
            timeout=settings.AI_TIMEOUT, **kwargs,
        )
        content = response.choices[0].message.content
        if content is None:
            raise HTTPException(status_code=502, detail="AI provider returned an empty response.")
        return content.strip()
    except litellm.AuthenticationError as exc:
        logger.error("AI provider authentication failed: %s", exc)
        raise HTTPException(status_code=503, detail="AI provider authentication failed.")
    except litellm.ServiceUnavailableError as exc:
        logger.error("AI provider unreachable: %s", exc)
        raise HTTPException(status_code=503, detail="AI provider is temporarily unavailable.")
    except Exception as exc:
        logger.error("AI provider error: %s", exc)
        raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")
```
**Apply as:** Add `call_ai_stream()` as an `async def` using `litellm.acompletion(stream=True)`. Mirror the same guard checks (`AI_API_KEY`), same `_build_model_string()`, same exception hierarchy. Returns `AsyncGenerator[str, None]` yielding SSE-formatted `"data: {token}\n\n"` chunks. Ends with `"event: done\ndata: \n\n"`.

---

### `backend/app/platform/yaml_loader.py` EXTEND (utility, file-I/O)

**Analog:** Self (lines 1-71)

**Apply as:** Add `load_task_yaml(path: Path) -> TaskDefinition` and `load_rules_yaml(path: Path) -> RuleDefinition` following the same pattern as `load_entity_yaml()`: open file, `yaml.safe_load(f) or {}`, validate required fields, extract field-by-field into dataclass.

---

### `backend/app/api/v1/routes/consultant.py` (controller, streaming + request-response)

**Analog:** `backend/app/api/v1/routes/plan.py`

**Router + imports pattern** (lines 1-35):
```python
from __future__ import annotations
import logging
import os
from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/consultant", tags=["consultant"])
```

**Auth + DB dependency pattern** (lines 275-304, every endpoint):
```python
@router.post("/{student_id}/plan", response_model=PlanJobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_plan(
    student_id: UUID,
    background_tasks: BackgroundTasks,
    body: PlanGenerateRequest = PlanGenerateRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    # ... endpoint logic ...
```
**Apply as:** SSE stream endpoint uses `Depends(get_db)` + `Depends(get_current_user)`. Returns `StreamingResponse(...)` instead of a Pydantic model. Save endpoint follows exact same pattern as `plan_chat`.

**Background task + polling pattern** (lines 43-268, 275-335):
```python
def _generate_plan_task(job_id: UUID, student_id: UUID, plan_type: str = "UNIVERSITY") -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(PlanGenerationJob).filter(PlanGenerationJob.id == job_id).first()
        job.status = "RUNNING"
        db.commit()
        # ... long operation ...
        job.status = "DONE"
        db.commit()
    except Exception as exc:
        # ... mark FAILED ...
    finally:
        db.close()
```
**Note:** The SSE streaming approach replaces this background task + polling pattern. The new consultant endpoint streams directly via `StreamingResponse`, eliminating the need for `PlanGenerationJob` and polling. However, the save/validate endpoint uses the same DB session + commit pattern.

---

### `backend/app/platform/schemas/consultant_output.py` (model, transform)

**Analog:** `backend/app/schemas/v2/plan.py`

**Pydantic schema pattern** (lines 1-50):
```python
from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class PlanGenerateRequest(BaseModel):
    plan_type: str = "UNIVERSITY"


class PlanResponse(BaseModel):
    id: UUID
    student_id: UUID
    generated_at: Optional[datetime] = None
    version: int
    html_content: Optional[str] = None
    recommended_schools: Optional[Any] = None
    action_items: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```
**Apply as:** `ConsultantTaskRequest`, `ConsultantSaveRequest`, `ConsultantTaskResponse` following same Pydantic v2 patterns with `model_config = {"from_attributes": True}`.

---

### `backend/app/modules/school_choice/templates/*.html.j2` (template, transform)

**Analog:** `backend/app/modules/school_choice/services/plan_generator.py`

**Template CSS variables pattern** (lines 48-80):
```python
TEMPLATES: dict[str, dict[str, str]] = {
    "professional": {
        "--plan-bg": "#ffffff",
        "--plan-heading-color": "#1e3a5f",
        "--plan-accent": "#1e3a5f",
        "--plan-font-body": "Georgia, serif",
        "--plan-font-heading": "Georgia, serif",
        "--plan-section-padding": "28px 32px",
        "--plan-section-gap": "32px",
        "--plan-line-height": "1.8",
        "--plan-letter-spacing": "0.01em",
    },
    # ... modern, minimal ...
}
```
**Apply as:** These CSS variable dictionaries become the `:root` block in `base_plan.html.j2`. Each domain template (`professional.html.j2`, etc.) extends the base and injects the appropriate variable values.

**HTML generation sections** (exported in `__all__`, lines 19-41):
The existing plan_generator.py exports section functions: `_section_student_summary`, `_section_academic_profile`, `_section_recommended_schools`, `_section_action_plan`, `_section_skill_gaps`, `_section_language_readiness`, `_section_appendix`, `_charts_html_for_school`, `_gantt_svg`. Each returns an HTML f-string.
**Apply as:** Each section becomes a Jinja2 block in the template. The data that was passed as Python arguments becomes template context variables.

---

### `frontend/src/pages/ConsultantTask/ConsultantTask.jsx` (component, streaming)

**Analog:** `frontend/src/pages/AcademicPlan/AcademicPlan.jsx`

**Imports pattern** (lines 1-28):
```javascript
import { useState, useEffect, useRef, useCallback } from 'react';
import { FileDown } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage/ErrorMessage';
import EmptyState from '../../components/EmptyState/EmptyState';
import Button from '../../components/Button/Button';
import Toast from '../../components/Toast/Toast';
import PlanSectionEditor from '../../components/PlanSectionEditor/PlanSectionEditor';
import TemplateSelector from '../../components/TemplateSelector/TemplateSelector';
import { useToast } from '../../hooks/useToast';
```

**State management pattern** (lines 53-67):
```javascript
function AcademicPlan() {
  const { id } = useParams();
  const { toasts, showToast, removeToast } = useToast();
  const [student, setStudent] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
```
**Apply as:** Replace `polling` state with `streaming` state. Replace `pollRef` with SSE `EventSource` ref. Add `streamBuffer` state for accumulating tokens.

**Polling pattern** (lines 29-30 + used throughout):
```javascript
const POLL_INTERVAL_MS = 2000;
// ... setInterval-based polling for plan generation status ...
```
**Apply as:** Replace with `EventSource` connection. On `onmessage`, append to buffer and update display. On `done` event, close source and POST to save endpoint.

---

### `frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx` (component, request-response)

**Analog:** `frontend/src/components/EligibilityBadge/EligibilityBadge.jsx`

**Badge styling pattern** (lines 1-33):
```javascript
function EligibilityBadge({ pass, failingCriteria }) {
  const bg = (pass === null || pass === undefined)
    ? 'var(--color-text-secondary)'
    : pass
    ? 'var(--color-success)'
    : 'var(--color-error)';

  const badgeStyle = {
    display: 'inline-block',
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-medium)',
    background: bg,
    color: '#ffffff',
    letterSpacing: '0.04em',
    position: 'relative',
  };

  const label = (pass === null || pass === undefined) ? 'PENDING' : pass ? 'ELIGIBLE' : 'INELIGIBLE';
  const ariaLabel = pass === true ? 'Eligible' : pass === false
    ? `Ineligible${failingCriteria?.length ? ': ' + failingCriteria.join('; ') : ''}` : 'Eligibility not yet evaluated';
```
**Apply as:** Three-tier color mapping: `HIGH` -> `var(--color-success)`, `MEDIUM` -> `var(--color-warning, #f59e0b)`, `LOW` -> `var(--color-error)`. Same `badgeStyle` structure. Add `Popover` from `@/components/ui/popover` for tooltip showing missing data explanation.

---

### `frontend/src/api/consultant.js` (utility, request-response)

**Analog:** `frontend/src/api/plan.js`

**API client pattern** (lines 1-31):
```javascript
import client from './client';

export const generatePlan = (studentId, planType = 'UNIVERSITY') =>
  client.post(`/api/v1/students/${studentId}/plan`, { plan_type: planType }).then((r) => r.data);

export const getPlan = (studentId) =>
  client.get(`/api/v1/students/${studentId}/plan`).then((r) => r.data);

export const sendPlanChat = (studentId, message) =>
  client.post(`/api/v1/students/${studentId}/plan/chat`, { message }).then((r) => r.data);
```
**Apply as:** Same axios `client` import. SSE streaming does NOT use axios (uses native `EventSource` or `fetch`). Save + chat + template endpoints follow the same `client.post(url, body).then(r => r.data)` pattern.

**Note on SSE:** `EventSource` is GET-only. RESEARCH.md A1 flags this. Use `GET /api/v1/consultant/tasks/{task_id}/stream?entity_id={id}` or use `fetch()` + `ReadableStream` for POST. Recommendation: GET with query params since it is idempotent.

---

### `backend/app/modules/school_choice/tasks/academic_plan.yaml` (config, file-I/O)

**Analog:** `backend/app/modules/school_choice/config.yaml`

**YAML structure pattern** (lines 1-22):
```yaml
name: school_choice
version: "1.0"
models_import: app.modules.school_choice.models.models
entities:
  - entities/student.yaml
  - entities/school.yaml
routes: []
health_callback: "app.modules.school_choice.health:check_health"
```
**Apply as:** Task YAML follows same flat-key + nested-list structure. Required keys: `task_id`, `name`, `data_slots`, `prompts.system`, `prompts.user`, `output_schema`, `jinja2_template`. Optional keys with defaults: `max_tokens: 4096`, `temperature: 0.3`, `enable_chat: true`.

---

### `backend/app/platform/module_loader.py` - Discovery pattern for tasks

**Module discovery pattern** (lines 22-74):
```python
def discover_and_register_modules(app: FastAPI, modules_dir: Path) -> list[dict]:
    registered = []
    for module_dir in sorted(modules_dir.iterdir()):
        if not module_dir.is_dir():
            continue
        config_path = module_dir / "config.yaml"
        if not config_path.exists():
            continue
        config = yaml.safe_load(config_path.read_text()) or {}
        module_name = config.get("name", module_dir.name)
        try:
            # ... register entities, routes, health ...
            registered.append({"name": module_name, "status": "ok"})
        except Exception as e:
            logger.error(f"Module load failed: {module_name} -- {e}")
            registered.append({"name": module_name, "status": "error", "detail": str(e)})
    return registered
```
**Apply as:** `discover_tasks()` scans `platform/tasks/` and `modules/*/tasks/` directories for `.yaml` files. Parse each via `load_task_yaml()`. Module tasks override platform tasks with same `task_id`. Validate all at startup (Pitfall 4 prevention).

---

## Shared Patterns

### Authentication / Authorization
**Source:** `backend/app/core/dependencies.py` via `get_current_user`
**Apply to:** All new consultant route endpoints in `consultant.py`
```python
from app.core.dependencies import get_current_user
from app.db.models import User

# Every endpoint:
current_user: User = Depends(get_current_user),
```

### Database Session
**Source:** `backend/app/db/session.py` via `get_db`
**Apply to:** All new route endpoints and the save endpoint
```python
from app.db.session import get_db
from sqlalchemy.orm import Session

db: Session = Depends(get_db),
```

### Error Handling (Backend)
**Source:** `backend/app/core/ai_service.py` (lines 72-80) + `backend/app/modules/school_choice/services/plan_chat_service.py` (lines 177-183)
**Apply to:** All services calling AI or parsing JSON
```python
# AI errors: map to 502/503
except litellm.AuthenticationError:
    raise HTTPException(status_code=503, detail="AI provider authentication failed.")
except Exception:
    raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")

# JSON parse errors: map to 502
except json.JSONDecodeError as exc:
    raise HTTPException(status_code=502, detail=f"AI returned invalid JSON: {exc}")
```

### Rate Limiting
**Source:** `backend/app/modules/school_choice/services/plan_chat_service.py` (lines 53-83)
**Apply to:** Consultant task execution and chat endpoints
```python
def _check_and_increment_rate_limit(db: Session, plan: AcademicPlan, counsellor_id: Any) -> None:
    key = f"{counsellor_id}:{plan.id}"
    counts: dict = dict(plan.chat_request_counts or {})
    entry = counts.get(key, {"count": 0, "window_start": None})
    now = datetime.now(timezone.utc)
    # ... rolling 24-hour window check ...
    if entry["count"] >= 20:
        raise HTTPException(status_code=429, detail="Daily AI chat limit (20 requests) reached.")
```

### Frontend Component Structure
**Source:** `frontend/src/components/TemplateSelector/TemplateSelector.jsx` + `frontend/src/components/EligibilityBadge/EligibilityBadge.jsx`
**Apply to:** All new frontend components (`ConfidenceBadge`, `SSEStreamDisplay`)
- shadcn/ui imports from `@/components/ui/` (e.g., `badge`, `button`, `popover`)
- CSS variables for colors: `var(--color-success)`, `var(--color-error)`, `var(--color-text-secondary)`, etc.
- Inline style objects using design tokens
- `aria-label` for accessibility on status indicators

### Frontend API Client
**Source:** `frontend/src/api/client.js` (lines 1-26)
**Apply to:** `frontend/src/api/consultant.js`
```javascript
import client from './client';
// All API calls use: client.get/post/patch/delete(url, body).then(r => r.data)
```
Note: SSE streaming bypasses axios -- uses native `EventSource` or `fetch` with auth token from `localStorage.getItem('token')`.

### HTML Sanitization
**Source:** `backend/app/api/v1/routes/plan.py` (line 509) + `plan_generator.py` uses `html.escape()`
**Apply to:** All Jinja2 template rendering with AI-generated content
```python
import nh3
safe_html = nh3.clean(body.html_content)  # for user-submitted HTML
import html
html.escape(ai_generated_text)  # for AI-generated text in templates
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx` | component | streaming | No SSE/streaming component exists in the codebase. Use native `EventSource` browser API. Pattern from RESEARCH.md Code Examples (Frontend EventSource Consumer). |

**RESEARCH.md fallback pattern for SSEStreamDisplay:**
```javascript
// From RESEARCH.md Code Examples
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
  saveGeneratedPlan(taskId, entityId, buffer);
});
source.onerror = () => {
  source.close();
  showError('Generation was interrupted. Please try again.');
};
```
Note: `EventSource` does not support sending auth headers. Either: (a) use a short-lived token in query param, or (b) use `fetch()` + `ReadableStream` with `Authorization` header instead of `EventSource`.

## Metadata

**Analog search scope:** `backend/app/core/`, `backend/app/platform/`, `backend/app/api/v1/routes/`, `backend/app/modules/school_choice/services/`, `backend/app/schemas/v2/`, `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/api/`
**Files scanned:** 35+
**Pattern extraction date:** 2026-04-28
