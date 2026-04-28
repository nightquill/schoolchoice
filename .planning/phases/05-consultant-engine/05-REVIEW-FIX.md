---
phase: 05-consultant-engine
fixed_at: 2026-04-28T15:10:00Z
review_path: .planning/phases/05-consultant-engine/05-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 9
skipped: 2
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-04-28T15:10:00Z
**Source review:** .planning/phases/05-consultant-engine/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (4 critical, 7 warning)
- Fixed: 9
- Skipped: 2

## Fixed Issues

### CR-02: `_truncate_context` mutates inner dicts of the original context (data corruption)

**Files modified:** `backend/app/platform/task_engine.py`, `backend/tests/test_task_engine.py`
**Commit:** 2c1edc0
**Applied fix:** Added `import copy` and replaced `list(ctx["matchmaker"])` with `[copy.deepcopy(r) for r in ctx["matchmaker"]]` so inner dict mutations (rationale truncation, shap_explanation pop) do not affect the original context. Strengthened the test to also verify a high-scoring item (index 7) that IS in the truncated top-5 retains `shap_explanation` in the original.

### CR-04: Frontend calls non-existent backend endpoint `changeConsultantTemplate`

**Files modified:** `frontend/src/api/consultant.js`
**Commit:** e73f684
**Applied fix:** Removed the dead `changeConsultantTemplate` function which called `POST /consultant/tasks/{taskId}/template` -- an endpoint that does not exist in the backend router. The function was unused by any component.

### WR-01: SSE error events cannot be sent after streaming has started

**Files modified:** `backend/app/core/ai_service.py`
**Commit:** 82fb39f
**Applied fix:** Added a `started` flag that tracks whether any chunks have been yielded. In exception handlers, if `started` is True, yields a structured SSE error event (`event: error\ndata: ...`) instead of raising HTTPException (which would just drop the connection silently mid-stream).

### WR-02: Save endpoint filters with string instead of UUID

**Files modified:** `backend/app/api/v1/routes/consultant.py`
**Commit:** 9b2eebe
**Applied fix:** Changed the save endpoint's AcademicPlan query filter from `AcademicPlan.student_id == body.entity_id` (string) to `AcademicPlan.student_id == _to_uuid(body.entity_id)`, matching the create path.

### WR-03: Confidence guardrail silently swallows all exceptions

**Files modified:** `backend/app/api/v1/routes/consultant.py`
**Commit:** 8ef0237
**Applied fix:** Split the bare `except Exception` into two handlers: `except (ImportError, AttributeError)` for expected/benign failures (logged as warning), and `except Exception` which logs at error level with traceback and re-raises so bugs in guardrail logic surface in monitoring.

### WR-04: No authorization check -- any authenticated user can access any student's plan

**Files modified:** `backend/app/api/v1/routes/consultant.py`
**Commit:** b4d915b
**Applied fix:** Added `_verify_student_ownership(db, entity_id, current_user)` helper that loads the Student, checks `student.user_id == user.id`, and raises HTTP 403 on mismatch. Applied to all four endpoints (stream, status, save, chat). Fixed: requires human verification (authorization logic should be reviewed for edge cases).

### WR-05: PII blocklist uses simple substring matching, producing false positives

**Files modified:** `backend/app/platform/task_engine.py`
**Commit:** 9e8985e
**Applied fix:** Replaced `if pii_field in combined_prompt` with `if re.search(rf'\b{pii_field}\b', combined_prompt)` to use word-boundary matching. This prevents false positives where "dob" matched "adobe" or "ssn" matched arbitrary data.

### WR-06: `_render_plan_html` disables Jinja2 autoescape

**Files modified:** `backend/app/api/v1/routes/consultant.py`, `backend/app/modules/school_choice/templates/minimal.html.j2`, `backend/app/modules/school_choice/templates/professional.html.j2`, `backend/app/modules/school_choice/templates/modern.html.j2`
**Commit:** b6d4fe9
**Applied fix:** Changed `autoescape=False` to `autoescape=True` in the Jinja2 Environment. Added `| safe` after `| tojson` in all three template files' script blocks to prevent double-escaping of JSON data for Chart.js.

### WR-07: Duplicate rate-limit logic between consultant.py and plan_chat_service.py

**Files modified:** `backend/app/api/v1/routes/consultant.py`
**Commit:** 2b3341a
**Applied fix:** Removed the `_check_consultant_rate_limit` call from the `/chat` endpoint. Rate limiting is handled inside `plan_chat_service.handle_chat()` which has its own `_check_and_increment_rate_limit`. The duplicate was double-counting each chat request (2 slots consumed per call).

## Skipped Issues

### CR-01: JWT token exposed in URL query parameter

**File:** `frontend/src/pages/ConsultantTask/ConsultantTask.jsx:119`
**Reason:** The fix requires implementing an SSE ticket system: a new backend endpoint, a cache/DB store for short-lived tickets, and frontend changes to request a ticket before opening EventSource. This is an architectural addition that should be planned as a dedicated task, not an automated fix. The risk is documented in the review.
**Original issue:** JWT bearer token is placed in the EventSource URL as a query parameter, exposing it in server/proxy/CDN access logs, browser history, and analytics.

### CR-03: Rate limit bypass -- `_check_consultant_rate_limit` skips when no AcademicPlan exists

**File:** `backend/app/api/v1/routes/consultant.py:57-97`
**Reason:** The rate limit is stored on the AcademicPlan row. When no plan exists (first-time generation), the function returns early and skips the limit. Fixing this requires a separate rate-limit store (Redis counter or dedicated DB table) keyed by user_id + entity_id, which is an architectural change beyond an automated fix.
**Original issue:** Any user can bypass rate limiting by using a valid UUID that has no AcademicPlan row yet.

---

_Fixed: 2026-04-28T15:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
