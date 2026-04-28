---
phase: 05-consultant-engine
reviewed: 2026-04-28T14:32:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - backend/app/api/v1/routes/consultant.py
  - backend/app/core/ai_service.py
  - backend/app/core/dependencies.py
  - backend/app/main.py
  - backend/app/modules/school_choice/rules/matching_rules.yaml
  - backend/app/modules/school_choice/tasks/academic_plan.yaml
  - backend/app/modules/school_choice/templates/minimal.html.j2
  - backend/app/modules/school_choice/templates/modern.html.j2
  - backend/app/modules/school_choice/templates/professional.html.j2
  - backend/app/platform/recommendation_engine.py
  - backend/app/platform/schemas/__init__.py
  - backend/app/platform/schemas/consultant_output.py
  - backend/app/platform/task_engine.py
  - backend/app/platform/templates/base_plan.html.j2
  - backend/app/platform/yaml_loader.py
  - backend/requirements.txt
  - backend/tests/test_ai_service_stream.py
  - backend/tests/test_consultant_routes.py
  - backend/tests/test_recommendation_engine.py
  - backend/tests/test_task_engine.py
  - frontend/src/App.jsx
  - frontend/src/api/consultant.js
  - frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx
  - frontend/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx
  - frontend/src/pages/ConsultantTask/ConsultantTask.jsx
findings:
  critical: 4
  warning: 7
  info: 3
  total: 14
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-28T14:32:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

The consultant engine implementation covers SSE streaming, YAML-driven task execution, recommendation engine, confidence guardrails, and a React frontend. The architecture is generally sound. However, the review found **4 critical issues** including a security vulnerability (JWT in URL), a data corruption bug (shared mutable state in truncation), a rate-limit bypass, and a missing backend endpoint called by the frontend. There are also 7 warnings covering missing authorization checks, silent error swallowing, and incomplete validation.

## Critical Issues

### CR-01: JWT token exposed in URL query parameter (logged in server/proxy access logs)

**File:** `frontend/src/pages/ConsultantTask/ConsultantTask.jsx:119`
**Issue:** The JWT bearer token is placed directly in the EventSource URL as a query parameter (`?token=${token}`). While this is a known limitation of the EventSource API (GET-only, no custom headers), the token will be logged in server access logs, proxy logs, CDN logs, browser history, and any analytics/error tracking. This is a recognized security anti-pattern. The backend `get_current_user_or_query_token` dependency in `dependencies.py:69-96` intentionally supports this, so both sides are complicit.
**Fix:** Use a short-lived, single-use SSE ticket pattern instead. The frontend requests a one-time ticket via a POST endpoint (using the Authorization header), then passes the opaque ticket ID as the query param. The backend validates and consumes the ticket on first use. This limits exposure to a token that is valid for only one SSE connection. Example:

```python
# Backend: new endpoint
@router.post("/consultant/sse-ticket")
def create_sse_ticket(db=Depends(get_db), user=Depends(get_current_user)):
    ticket = str(uuid4())
    # store in cache/DB with 60s TTL, bound to user_id
    return {"ticket": ticket}
```

If the ticket pattern is too costly for this iteration, at minimum set a very short TTL on tokens used via query param, and document the risk.

### CR-02: `_truncate_context` mutates inner dicts of the original context (data corruption)

**File:** `backend/app/platform/task_engine.py:235-258`
**Issue:** The method claims "Modifies a copy -- never mutates the original context dict" but this is incorrect. Line 246 does `results = list(ctx["matchmaker"])` which shallow-copies the list, but the individual dicts inside are still the same objects. Lines 252-253 mutate `r["rationale"]` and line 255 pops `r["shap_explanation"]` -- these mutations affect the original context's dicts. If the original context is used after truncation (e.g., for logging, error reporting, or re-render), the data is silently corrupted. The existing test (`test_truncate_context_does_not_mutate_original`) passes only by accident: it checks index 0 which has the lowest `final_score` (0.0) and is therefore NOT in the top-5 slice, so its `shap_explanation` is never popped.
**Fix:** Deep-copy the inner dicts:
```python
import copy

def _truncate_context(self, context: dict, task: TaskDefinition) -> dict:
    ctx = dict(context)
    if "matchmaker" in ctx and isinstance(ctx["matchmaker"], list):
        # Deep copy so mutations don't affect the original
        results = [copy.deepcopy(r) for r in ctx["matchmaker"]]
        results = sorted(results, key=lambda r: r.get("final_score", 0), reverse=True)[:5]
        # ... rest unchanged
        ctx["matchmaker"] = results
    return ctx
```

Also fix the test to check an item that IS in the truncated set:
```python
# Check a high-scoring item (index 7, score 0.7) that IS in top 5
assert "shap_explanation" in context["matchmaker"][7]
```

### CR-03: Rate limit bypass -- `_check_consultant_rate_limit` does not validate entity_id as UUID

**File:** `backend/app/api/v1/routes/consultant.py:57-97`
**Issue:** The `stream_consultant_task` endpoint (line 118) passes `entity_id` (a raw string from query param) to `_check_consultant_rate_limit` before any UUID validation occurs. Inside the rate limit function, line 67 calls `_to_uuid(entity_id)` to query the AcademicPlan, and if no plan is found (line 69), the function returns early -- **skipping the rate limit entirely**. This means any user can bypass rate limiting for the stream endpoint by using a valid UUID that has no AcademicPlan row yet (which is the common case for first-time generation). The rate limit only protects subsequent calls after a plan has been saved.
**Fix:** The rate limit should track requests even when no plan exists yet. Consider using a separate rate-limit store (Redis counter, or a dedicated rate_limits table) keyed by `user_id + entity_id`, rather than piggybacking on the AcademicPlan row that may not exist yet.

### CR-04: Frontend calls non-existent backend endpoint `changeConsultantTemplate`

**File:** `frontend/src/api/consultant.js:25-29`
**Issue:** The function `changeConsultantTemplate` calls `POST /api/v1/consultant/tasks/{taskId}/template`, but this endpoint does not exist in `consultant.py`. The consultant router defines only `/stream`, `/status`, `/save`, and `/chat`. Calling this function will always return a 404/405 error at runtime.
**Fix:** Either remove `changeConsultantTemplate` from the frontend API module (it appears unused in `ConsultantTask.jsx` which uses `setPlanTemplate` from the plan API instead), or implement the endpoint in `consultant.py`.

## Warnings

### WR-01: SSE error events cannot be sent after streaming has started (silent failure)

**File:** `backend/app/core/ai_service.py:119-127`
**Issue:** In `call_ai_stream`, if an exception occurs AFTER some chunks have already been yielded (mid-stream), the `except` blocks raise `HTTPException`. However, once a `StreamingResponse` has started sending data, FastAPI cannot send an HTTP error response -- the connection is already committed to `200 text/event-stream`. The exception will simply terminate the stream without the client receiving a meaningful error. The client sees a dropped connection rather than a structured error.
**Fix:** Yield an SSE error event instead of raising HTTPException when streaming has started:
```python
except Exception as exc:
    logger.error("AI streaming error: %s", exc)
    yield f"event: error\ndata: Unexpected error communicating with AI provider.\n\n"
    return
```

### WR-02: Save endpoint filters `AcademicPlan.student_id == body.entity_id` with string, not UUID

**File:** `backend/app/api/v1/routes/consultant.py:270-272`
**Issue:** Line 271 compares `AcademicPlan.student_id` (a `UUID(as_uuid=True)` column) against `body.entity_id` (a raw string). With PostgreSQL, SQLAlchemy will attempt implicit casting, but this may fail with certain drivers or produce unexpected behavior. In contrast, line 277 correctly uses `_to_uuid(body.entity_id)` when creating a new plan. The inconsistency suggests the filter may silently return no match on some configurations, leading to duplicate plan creation attempts that would then fail on the unique constraint.
**Fix:**
```python
plan = db.query(AcademicPlan).filter(
    AcademicPlan.student_id == _to_uuid(body.entity_id)
).first()
```

### WR-03: Confidence guardrail silently swallows all exceptions

**File:** `backend/app/api/v1/routes/consultant.py:392-393`
**Issue:** The `_apply_confidence_guardrail` function has a bare `except Exception` that logs a warning and continues. This means any bug in the guardrail logic (e.g., import errors, attribute errors, query failures) is silently swallowed. An AI that claims HIGH confidence for a student with LOW data completeness would pass through unchecked, defeating the purpose of the guardrail.
**Fix:** Narrow the exception handler to expected exceptions only (e.g., `ImportError`, `AttributeError` for missing ORM fields). Let unexpected exceptions propagate so they are caught by tests and monitoring:
```python
except (ImportError, AttributeError) as exc:
    logger.warning("Confidence guardrail skipped (expected): %s", exc)
except Exception as exc:
    logger.error("Confidence guardrail unexpected failure: %s", exc, exc_info=True)
    raise  # or at minimum, force-downgrade all tiers to LOW
```

### WR-04: No authorization check -- any authenticated user can access any student's plan

**File:** `backend/app/api/v1/routes/consultant.py:104-144, 151-175, 215-299, 307-340`
**Issue:** All four consultant endpoints authenticate the user but never verify that `current_user` owns or has access to the student identified by `entity_id`. Any logged-in user can stream, save, view status, or chat about any other user's student plans by guessing/enumerating `entity_id` UUIDs.
**Fix:** Add an ownership check after loading the student or plan:
```python
student = db.query(Student).filter(Student.id == _to_uuid(entity_id)).first()
if not student or student.user_id != current_user.id:
    raise HTTPException(status_code=403, detail="Access denied")
```

### WR-05: PII blocklist uses simple substring matching, producing false positives

**File:** `backend/app/platform/task_engine.py:97-100`
**Issue:** The PII scan does `if pii_field in combined_prompt`, which is a substring match. The word `dob` appears in common English words like "adobe", and `ssn` could appear in words or data. This would cause false-positive rejections, blocking legitimate prompts. The blocklist field `sibling_data` is extremely specific and unlikely to appear verbatim, but `dob` and `ssn` are problematic.
**Fix:** Use word-boundary matching or check against the context keys rather than the rendered prompt text:
```python
import re
for pii_field in PII_BLOCKLIST:
    if re.search(rf'\b{pii_field}\b', combined_prompt):
        raise ValueError(...)
```

### WR-06: `_render_plan_html` disables Jinja2 autoescape, relying on manual `html_escape` filter

**File:** `backend/app/api/v1/routes/consultant.py:199`
**Issue:** The Jinja2 Environment is created with `autoescape=False`. The templates DO use `| html_escape` consistently on user-facing data, but this is fragile -- any new template variable added without the filter will create an XSS vector. The `chart_data | tojson` usage in templates (e.g., `professional.html.j2:168`) outputs raw JSON into a `<script>` block, which could enable XSS if `chart_data` contains a `</script>` tag or similar payload.
**Fix:** Enable autoescape and use `| safe` only where explicitly needed (e.g., the tojson output in script blocks):
```python
env = Environment(
    loader=FileSystemLoader(template_dirs),
    autoescape=True,
)
```
For the `tojson` in script blocks, use Jinja2's `tojson` filter which properly escapes for script contexts, or mark it as `| tojson | safe`.

### WR-07: Duplicate rate-limit logic between consultant.py and plan_chat_service.py

**File:** `backend/app/api/v1/routes/consultant.py:57-97` and `backend/app/modules/school_choice/services/plan_chat_service.py:60-82`
**Issue:** The `/chat` endpoint calls `_check_consultant_rate_limit` (consultant.py line 323) AND then calls `plan_chat_service.handle_chat()` which has its own internal rate limit check (`_check_and_increment_rate_limit` at plan_chat_service.py line 155-156). This double-counts rate limit usage: each chat request consumes 2 rate limit slots instead of 1. Additionally, the two implementations use different key formats, so they track independently and neither enforces the intended 20-request limit correctly.
**Fix:** Remove the rate limit check from the consultant chat endpoint (line 323) and let `plan_chat_service.handle_chat()` handle it, OR remove the internal check from the service and keep it in the route. Do not do both.

## Info

### IN-01: Unused import `ConsultantTaskRequest` not exported or referenced

**File:** `backend/app/platform/schemas/consultant_output.py:40-42`
**Issue:** `ConsultantTaskRequest` is defined but never imported or used by any route or test. It appears to be dead code.
**Fix:** Remove the class or add a usage if intended.

### IN-02: `backend/app/platform/schemas/__init__.py` is empty

**File:** `backend/app/platform/schemas/__init__.py`
**Issue:** The `__init__.py` is completely empty. While this is valid for a package marker, it could re-export common schemas to simplify imports elsewhere.
**Fix:** No action required, but consider adding re-exports if the pattern is used elsewhere in the project.

### IN-03: Template duplication across minimal, modern, and professional templates

**File:** `backend/app/modules/school_choice/templates/minimal.html.j2`, `modern.html.j2`, `professional.html.j2`
**Issue:** All three templates share nearly identical `{% block content %}` and `{% block scripts %}` blocks (the HTML structure is copy-pasted). They only differ in their `{% block styles %}` CSS overrides. This makes maintenance error-prone -- a bug fix or new section must be applied to all three files.
**Fix:** Extract the shared content and scripts blocks into the base template or a shared partial, and have the child templates only override styles.

---

_Reviewed: 2026-04-28T14:32:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
