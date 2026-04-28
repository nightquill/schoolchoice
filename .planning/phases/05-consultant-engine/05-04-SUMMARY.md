---
phase: "05"
plan: "04"
subsystem: consultant-api-endpoints
tags: [sse-streaming, consultant-router, rate-limiting, query-param-auth, confidence-guardrail]
dependency_graph:
  requires: [TaskEngine, call_ai_stream, ConsultantPlanOutput, ConsultantSaveRequest]
  provides: [consultant.router, get_current_user_or_query_token, stream_consultant_task, save_consultant_task, get_consultant_task_status]
  affects: [main.py, dependencies.py]
tech_stack:
  added: []
  patterns: [sse-streaming-endpoint, query-param-auth-fallback, rolling-rate-limit, confidence-guardrail-downgrade, jinja2-html-rendering]
key_files:
  created:
    - backend/app/api/v1/routes/consultant.py
    - backend/tests/test_consultant_routes.py
  modified:
    - backend/app/core/dependencies.py
    - backend/app/main.py
decisions:
  - "Used GET (not POST) for SSE stream endpoint because EventSource is GET-only (RESEARCH.md A1 resolution)"
  - "Query param token auth via get_current_user_or_query_token for EventSource compatibility (T-05-15 accepted risk)"
  - "Extracted _resolve_user_from_token() helper in dependencies.py to share JWT validation logic between standard and query-param auth"
  - "Rate limit stored in AcademicPlan.chat_request_counts JSON column with consultant-prefixed keys to avoid collisions with existing chat rate limits"
  - "entity_id converted to UUID via _to_uuid() helper for SQLite test compatibility"
metrics:
  duration: "7m 29s"
  completed: "2026-04-28T18:58:46Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
  tests_added: 11
  tests_total_passing: 209
---

# Phase 5 Plan 04: Consultant API Endpoints Summary

SSE streaming endpoint with query-param auth fallback, save endpoint with jsonschema + Pydantic double validation and confidence guardrail, status endpoint, rate limiting, and router wired into main.py with startup YAML validation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create consultant.py router with SSE stream, status, rate limiting, and query param token auth | 5c136d5 | consultant.py, dependencies.py |
| 2 | Wire router into main.py, add save endpoint validation, startup YAML validation, integration tests | e4fc8c7 | main.py, test_consultant_routes.py |

## What Was Built

### consultant.py (3 endpoints)
- **GET /consultant/tasks/{task_id}/stream**: SSE streaming endpoint using `call_ai_stream()`. Uses `get_current_user_or_query_token` for auth (EventSource GET-only limitation). Returns `StreamingResponse` with `text/event-stream` content type, `Cache-Control: no-cache`, and `X-Accel-Buffering: no` headers.
- **POST /consultant/tasks/{task_id}/save**: Validates AI output via jsonschema against task YAML schema, then via Pydantic `ConsultantPlanOutput`. Applies confidence guardrail (downgrades AI-inflated tiers). Renders HTML via Jinja2 template. Persists to AcademicPlan DB row.
- **GET /consultant/tasks/{task_id}/status**: Returns current plan state (version, generated_at, has_content) for given entity_id.

### get_current_user_or_query_token (dependencies.py)
New auth dependency that accepts JWT from either Authorization header or `token` query parameter. Reuses shared `_resolve_user_from_token()` helper extracted from existing `get_current_user()`. Only used by the SSE stream endpoint.

### Rate limiting
Rolling 24-hour window, 20 requests per entity per user. Uses consultant-prefixed keys in AcademicPlan.chat_request_counts to avoid collision with existing plan chat rate limits.

### Startup YAML validation
`TaskEngine.validate_all_task_yamls()` called at app startup in main.py. Logs warnings for any malformed task YAMLs (Pitfall 4 prevention).

### Integration tests (11 tests)
- TestConsultantStream (6): SSE content type, auth required, query token auth, SSE headers, 404 for unknown task, 400 for bad entity
- TestConsultantSave (3): auth required, invalid JSON rejection, schema mismatch rejection
- TestConsultantStatus (2): auth required, 404 for missing plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UUID string/object mismatch in SQLite tests**
- **Found during:** Task 2 test execution
- **Issue:** AcademicPlan.student_id is UUID(as_uuid=True) column; SQLite processor expects UUID objects, not strings. All DB queries with string entity_id failed with `'str' object has no attribute 'hex'`.
- **Fix:** Added `_to_uuid()` helper that converts string entity_id to `uuid.UUID` before all DB queries. Applied to rate limit check, status endpoint, and save endpoint.
- **Files modified:** backend/app/api/v1/routes/consultant.py
- **Commit:** e4fc8c7

## Threat Mitigations Implemented

| Threat ID | Mitigation | Location |
|-----------|-----------|----------|
| T-05-11 | get_current_user on save/status; get_current_user_or_query_token on stream; JWT verification in both paths | consultant.py, dependencies.py |
| T-05-12 | jsonschema.validate() + Pydantic ConsultantPlanOutput double validation before DB write; confidence guardrail downgrades inflated tiers | consultant.py save_consultant_task() |
| T-05-13 | Rate limiting: 20 req/entity/user/24h rolling window; AI_TIMEOUT passed through to LiteLLM | consultant.py _check_consultant_rate_limit() |
| T-05-14 | html.escape() filter registered in Jinja2 Environment for template rendering | consultant.py _render_plan_html() |
| T-05-15 | Accepted risk: token in URL visible in browser history/logs; acceptable for single-user deployment model | dependencies.py get_current_user_or_query_token() |

## Known Stubs

None -- all endpoints are fully wired to real implementations (TaskEngine, call_ai_stream, DB persistence).

## Verification

- All 11 new tests pass: `pytest tests/test_consultant_routes.py -v` (0.39s)
- Full suite regression: 209 tests pass (11 new + 198 existing)
- Router importable: `from app.api.v1.routes.consultant import router` returns 3 routes
- main.py contains `consultant.router` registration and `validate_all_task_yamls()` call

## Self-Check: PASSED

All 4 files verified on disk. Both task commits verified in git log.
