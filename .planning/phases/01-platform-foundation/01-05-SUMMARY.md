---
phase: 01-platform-foundation
plan: "05"
subsystem: backend/services
tags: [strangler-fig, module-extraction, services, school-choice]
dependency_graph:
  requires: [01-01, 01-04]
  provides: [school-choice-services-module]
  affects: [backend/app/services/, backend/app/modules/school_choice/services/]
tech_stack:
  added: []
  patterns: [strangler-fig-re-export, wildcard-import-stub, __all__-for-private-reexport]
key_files:
  created:
    - backend/app/modules/school_choice/services/__init__.py
    - backend/app/modules/school_choice/services/hkdse_service.py
    - backend/app/modules/school_choice/services/matchmaker_v2.py
    - backend/app/modules/school_choice/services/plan_generator.py
    - backend/app/modules/school_choice/services/plan_chat_service.py
  modified:
    - backend/app/services/hkdse_service.py
    - backend/app/services/matchmaker_v2.py
    - backend/app/services/plan_generator.py
    - backend/app/services/plan_chat_service.py
decisions:
  - "Added __all__ to plan_generator module file to re-export private helpers (_build_action_items, _esc) consumed by routes and tests via wildcard import stubs"
metrics:
  duration_seconds: 472
  completed: "2026-04-25T04:27:33Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 115
  test_pass: 115
  files_created: 5
  files_modified: 4
---

# Phase 01 Plan 05: Service Extraction to School Choice Module Summary

Four HKDSE-specific service files extracted from app/services/ to modules/school_choice/services/ using strangler fig pattern with re-export stubs preserving all 115 tests.

## What Was Done

### Task 1: Move hkdse_service and matchmaker_v2 to module
- Copied hkdse_service.py (pure HKDSE grade logic) to modules/school_choice/services/ with no import changes needed
- Copied matchmaker_v2.py to modules/school_choice/services/ with internal imports updated from `app.services.hkdse_service` to `app.modules.school_choice.services.hkdse_service`
- Replaced both originals with 5-line re-export stubs using `from app.modules.school_choice.services.X import *`
- All 115 tests passed after each move
- Commit: e4b1051

### Task 2: Move plan_generator and plan_chat_service to module
- Copied plan_generator.py (1319 lines, includes BUG-04/SEC-05 HTML escaping fixes) with all 9 internal hkdse_service imports updated to module path
- Copied plan_chat_service.py (includes BUG-01 rolling rate limit fix) with plan_generator and hkdse_service imports updated to module path
- Added `__all__` to plan_generator module file to ensure private helpers (`_build_action_items`, `_esc`) are re-exported through wildcard import stubs (routes and tests import these)
- Replaced both originals with 5-line re-export stubs
- Verified zero `from app.services` imports remain in module services directory
- All 115 tests passed
- Commit: b62e62f

## Verification Results

1. All 115 tests pass (zero test file modifications)
2. `grep -rn "from app.services" backend/app/modules/school_choice/services/` returns empty
3. All four stubs are exactly 5 lines each
4. Re-export validation: `from app.services.hkdse_service import grade_to_int; from app.services.matchmaker_v2 import MatchResult; from app.services.plan_generator import _esc` all succeed
5. Bug fixes preserved: `window_start` in plan_chat_service (BUG-01), `data_completeness` in matchmaker_v2 (BUG-02), `_esc` in plan_generator (BUG-04/SEC-05)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added __all__ to plan_generator for private name re-exports**
- **Found during:** Task 2
- **Issue:** `import *` does not export names starting with `_`. Routes and tests import `_build_action_items` from `app.services.plan_generator`, which broke when the stub used wildcard import.
- **Fix:** Added explicit `__all__` list to `backend/app/modules/school_choice/services/plan_generator.py` including all private helpers
- **Files modified:** backend/app/modules/school_choice/services/plan_generator.py
- **Commit:** b62e62f

## Known Stubs

None. All stubs are intentional re-export stubs for backward compatibility per strangler fig pattern (D-13).

## Self-Check: PASSED
