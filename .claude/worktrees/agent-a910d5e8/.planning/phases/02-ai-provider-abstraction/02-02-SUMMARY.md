---
phase: 02-ai-provider-abstraction
plan: 02
subsystem: backend/modules/school_choice
tags: [ai, migration, litellm, health, plan-chat]
dependency_graph:
  requires: [ai_service, ai_config_fields]
  provides: [plan_chat_abstracted, health_ai_status]
  affects: [plan_chat_service, health_check, test_v2_routes]
tech_stack:
  added: []
  patterns: [call-ai-messages-array, health-provider-status]
key_files:
  created: []
  modified:
    - backend/app/modules/school_choice/services/plan_chat_service.py
    - backend/app/api/v1/routes/plan.py
    - backend/app/modules/school_choice/health.py
    - backend/tests/test_v2_routes.py
decisions:
  - "Health check reports configured/unconfigured status without live API call to avoid consuming credits on every health ping"
  - "User message placed in separate 'user' role content per messages array format (D-10) for prompt injection separation"
metrics:
  duration: ~5min
  completed: 2026-04-25
  tasks_completed: 2
  tasks_total: 2
  test_count: 132
  total_tests_passing: 132
---

# Phase 02 Plan 02: Migrate Plan Chat Service and Health Summary

Replaced hardcoded Gemini SDK in plan_chat_service with call_ai() messages array, extended module health to report AI provider status, and migrated all GEMINI_API_KEY test references to AI_API_KEY.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Migrate plan_chat_service from Gemini SDK to call_ai() | 433a3cb | Replaced google.generativeai with call_ai() messages array, removed GEMINI_API_KEY check, updated docstrings |
| 2 | Extend health.py with AI provider status, update tests | 1894df1 | Added ai_provider/ai_status/ai_model to health, migrated test assertions, added health AI test |

## Implementation Details

### plan_chat_service.py Changes

- Removed `import os` and `import google.generativeai` -- no longer needed
- Removed GEMINI_API_KEY environment check (call_ai() handles 503 internally)
- Replaced single-string Gemini prompt with messages array: system role for SYSTEM_PROMPT, user role for plan context + instruction
- All preserved logic unchanged: SYSTEM_PROMPT, rate limiting, _apply_patch, code fence stripping, JSON parsing, HTML regeneration, version increment

### health.py Changes

- Extended check_health() to report AI provider status alongside XGBoost model status
- Reports ai_provider (from settings.AI_PROVIDER), ai_status (configured/unconfigured), ai_model
- No live API call in health check -- avoids consuming credits on every ping
- Error handling for settings import failures

### Test Changes

- test_plan_chat_no_api_key: Checks AI_API_KEY (not GEMINI_API_KEY) in 503 detail
- test_plan_chat_no_plan_returns_404: Removed obsolete GEMINI_API_KEY env pop
- test_health_reports_ai_provider: New test verifying ai_provider and ai_status in health response

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functionality is fully wired. Plan chat uses call_ai() from Plan 01.

## Threat Flags

None -- no new endpoints or auth paths introduced. Existing trust boundaries (user message -> AI, AI response -> json.loads) preserved with same mitigations.

## Verification

- `python -m pytest tests/ -v` -- 132/132 passed (no regressions)
- `grep -r "GEMINI" backend/app/` -- zero matches in app code
- `grep -r "google.generativeai" backend/` -- zero matches
- Import verification: plan_chat_service imports and resolves call_ai successfully

## Self-Check: PASSED

All 4 modified files verified on disk. Both commits (433a3cb, 1894df1) found in git log.
