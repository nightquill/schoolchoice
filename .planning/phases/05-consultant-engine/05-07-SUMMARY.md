---
phase: 05-consultant-engine
plan: 07
subsystem: consultant-api
tags: [gap-closure, chat-endpoint, backend]
dependency_graph:
  requires: [plan_chat_service, AcademicPlan model, call_ai abstraction]
  provides: [POST /consultant/tasks/{task_id}/chat endpoint, ConsultantChatRequest schema]
  affects: [frontend ConsultantTask.jsx sendConsultantChat()]
tech_stack:
  added: []
  patterns: [service delegation, rate limiting, UUID validation]
key_files:
  created: []
  modified:
    - backend/app/platform/schemas/consultant_output.py
    - backend/app/api/v1/routes/consultant.py
    - backend/tests/test_consultant_routes.py
decisions:
  - Return plain dict from chat endpoint (not PlanChatResponse) since frontend only reads data.message and calls loadPlan() separately
  - Promote AcademicPlan import to top-level in consultant.py to remove 3 redundant local imports
metrics:
  duration: 4m
  completed: 2026-04-28T19:26:34Z
  tasks_completed: 2
  tasks_total: 2
  test_count: 213
  test_passed: 213
---

# Phase 05 Plan 07: Consultant Chat Endpoint Summary

POST /consultant/tasks/{task_id}/chat endpoint wired to plan_chat_service.handle_chat, closing the sole gap blocking frontend AI chat functionality.

## What Was Done

### Task 1: Add ConsultantChatRequest schema and POST /chat endpoint
- Added `ConsultantChatRequest(entity_id: str, message: str)` Pydantic model to consultant_output.py
- Added `consultant_chat` endpoint at `@router.post("/tasks/{task_id}/chat")` in consultant.py
- Endpoint validates UUID, enforces rate limit, loads AcademicPlan, delegates to plan_chat_service.handle_chat
- Returns dict with {message, plan_id, version, html_content} matching frontend expectations
- Promoted AcademicPlan import to top-level, removed 3 redundant local imports
- Commit: 35e2962

### Task 2: Add chat endpoint integration tests
- Added `TestConsultantChat` class with 4 tests:
  - `test_chat_requires_auth` - verifies 401 without JWT
  - `test_chat_404_for_missing_plan` - verifies 404 when no AcademicPlan exists
  - `test_chat_returns_message` - verifies 200 with correct response shape (mocks plan_chat_service)
  - `test_chat_400_for_invalid_entity_id` - verifies 400 for malformed UUID
- Total consultant route tests: 15 (11 existing + 4 new)
- Full test suite: 213 passed, 0 failed
- Commit: 1e3e2bf

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FK constraint in test_chat_returns_message**
- **Found during:** Task 2
- **Issue:** Plan's test created AcademicPlan without a Student row, causing FK constraint violation in SQLite
- **Fix:** Added Student creation before AcademicPlan in the test fixture, using the auth user's ID as user_id
- **Files modified:** backend/tests/test_consultant_routes.py
- **Commit:** 1e3e2bf

**2. [Rule 2 - Cleanup] Promoted AcademicPlan import to top-level**
- **Found during:** Task 1
- **Issue:** AcademicPlan was imported locally in 3 functions; adding a 4th (consultant_chat) would increase duplication
- **Fix:** Single top-level import, removed 3 redundant `from app.db.models_v2 import AcademicPlan` local imports
- **Files modified:** backend/app/api/v1/routes/consultant.py
- **Commit:** 35e2962

## Verification

- Endpoint returns 401 without auth: VERIFIED
- ConsultantChatRequest schema accepts {entity_id, message}: VERIFIED
- Route registered at /consultant/tasks/{task_id}/chat: VERIFIED
- 15 consultant route tests pass: VERIFIED
- 213 total tests pass with no regressions: VERIFIED
- Frontend sendConsultantChat() request shape matches backend schema: VERIFIED

## Self-Check: PASSED
