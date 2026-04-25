---
phase: 01-platform-foundation
plan: "01"
subsystem: backend-services
tags: [bugfix, security, infrastructure, rate-limiting, html-escaping]
dependency_graph:
  requires: []
  provides:
    - rolling-24h-rate-limit
    - match-result-data-completeness
    - html-escaped-plan-output
    - sqlite-safe-test-collection
  affects:
    - backend/app/services/plan_chat_service.py
    - backend/app/services/matchmaker_v2.py
    - backend/app/services/plan_generator.py
    - backend/app/main.py
tech_stack:
  added: [pyyaml]
  patterns: [rolling-window-rate-limit, dialect-guard-pattern]
key_files:
  created: []
  modified:
    - backend/app/services/plan_chat_service.py
    - backend/app/services/matchmaker_v2.py
    - backend/app/services/plan_generator.py
    - backend/app/api/v1/routes/match.py
    - backend/app/main.py
    - backend/requirements.txt
decisions:
  - "Rolling 24h window uses JSON dict with count + window_start keys in existing JSONB column"
  - "data_completeness weighted 70% compulsory / 30% elective subjects"
  - "ALTER TABLE blocks guarded by engine.dialect.name == postgresql rather than removed"
metrics:
  duration: 2m
  completed: "2026-04-25T04:02:46Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
---

# Phase 01 Plan 01: Infrastructure Bug Fixes Summary

Rolling 24h rate limit replacing calendar-day reset, data_completeness field on MatchResult, HTML escaping on all user variables in plan generator, and SQLite dialect guard for test collection.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Fix BUG-01 (rolling rate limit), BUG-02 (data completeness), BUG-03 (school name), BUG-04/SEC-05 (HTML escaping) | 4aa176f | plan_chat_service.py, matchmaker_v2.py, plan_generator.py, match.py |
| 2 | Fix SQLite ALTER TABLE crash and add PyYAML | 1c9be81 | main.py, requirements.txt |

## What Was Done

### BUG-01: Rolling Rate Limit
Replaced `date.today().isoformat()` key with a rolling 24-hour window in `_check_and_increment_rate_limit`. The new implementation stores `{"count": N, "window_start": ISO-datetime}` per counsellor+plan key. When `now - window_start > 24h`, the window resets. Limit remains 20 requests per window.

### BUG-02: Data Completeness Indicator
Added `data_completeness: float` field to `MatchResult` dataclass. New `compute_data_completeness()` function calculates a 0.0-1.0 score: 70% weight on 4 compulsory subjects (CHLA, ENGL, MATH, CSD), 30% weight on elective subjects present. Score is computed and attached to every MatchResult in `run_matching()`.

### BUG-03: School Name Single Source of Truth
Verified in `match.py` that school names come from the schools table JOIN, not a denormalized copy. Added a comment documenting this is the authoritative source. Recommendations endpoint left as-is (historical snapshot is intentional).

### BUG-04 / SEC-05: HTML Escaping
All user-provided variables in `plan_generator.py` HTML f-strings are wrapped with `_esc()` (html.escape) at assignment time. 46 total `_esc()` calls in the file covering subject names, grades, sittings, tasks, schools, and actions.

### SQLite Dialect Guard
Wrapped the "Runtime column migrations" block in `main.py` with `if engine.dialect.name == "postgresql":` so ALTER TABLE IF NOT EXISTS statements (PostgreSQL-only syntax) do not crash SQLite test collection.

### PyYAML Dependency
Added `pyyaml==6.0` to `requirements.txt` -- was imported but not declared as a dependency.

## Verification Results

- 92 tests passing (up from baseline 60 due to tests added in prior planning commits)
- `grep "date.today" plan_chat_service.py` returns no matches (BUG-01 old pattern removed)
- `grep "data_completeness" matchmaker_v2.py` returns 6 matches (BUG-02 field and usage)
- `grep "engine.dialect.name" main.py` confirms dialect guard present
- All user-provided variables in plan_generator.py HTML output wrapped in `_esc()`

## Deviations from Plan

None -- plan executed exactly as written. Both tasks were committed in prior commits on this branch (4aa176f and 1c9be81).

## Known Stubs

None.

## Self-Check: PASSED

All 6 modified files verified present. Both commit hashes (4aa176f, 1c9be81) found in git history.
