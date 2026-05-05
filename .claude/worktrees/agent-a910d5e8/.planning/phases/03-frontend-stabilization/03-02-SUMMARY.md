---
phase: 03-frontend-stabilization
plan: 02
subsystem: frontend-infrastructure
tags: [tanstack-query, testing, characterization-tests, react]
dependency_graph:
  requires: [03-01]
  provides: [QueryClientProvider, QueryBoundary, StudentProfile-characterization-tests]
  affects: [03-03, 03-04, 03-05]
tech_stack:
  added: ["@tanstack/react-query (QueryClientProvider, QueryClient)"]
  patterns: [query-boundary-wrapper, characterization-testing]
key_files:
  created:
    - frontend/src/components/QueryBoundary/QueryBoundary.jsx
    - frontend/src/pages/StudentProfile/StudentProfile.test.jsx
  modified:
    - frontend/src/App.jsx
decisions:
  - "QueryClient configured with staleTime 30s and retry 1 to prevent infinite retry loops (T-03-03 mitigation)"
  - "Characterization tests use vi.mock for all API modules with never-resolving promises for loading state tests"
metrics:
  duration: 490s
  completed: "2026-04-25T10:19:23Z"
  tasks: 2
  files_created: 2
  files_modified: 1
---

# Phase 03 Plan 02: TanStack Query Setup and Characterization Tests Summary

TanStack Query infrastructure at app root with QueryBoundary shared component and 6 characterization tests locking StudentProfile monolith behavior before decomposition.

## What Was Done

### Task 1: QueryClientProvider + QueryBoundary Component
- Added `QueryClientProvider` wrapping all routes in `App.jsx` with `staleTime: 30_000` and `retry: 1`
- Created `QueryBoundary` component that renders `LoadingSpinner` when loading, `ErrorMessage` with "Try again" refetch button on error, and passes through children on success
- Commit: `0916576`

### Task 2: Characterization Tests for StudentProfile
- Created 6 characterization tests locking current StudentProfile behavior (D-03 requirement)
- Tests cover: student name rendering, all 7 tab labels present, Personal tab active by default, tab switching via click, loading state visibility, no page reload on tab switch
- All API modules mocked (`students`, `account`, `grades`, `transcripts`, `plan`, `client`, `schoolsV2`)
- Uses `QueryClientProvider` + `MemoryRouter` test wrapper with `retry: false`
- Commit: `9d87e70`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added mockGetGrades default in beforeEach**
- **Found during:** Task 2
- **Issue:** GradesTab component calls `getGrades()` on mount when switching to Grades tab, causing TypeError when mock returned undefined
- **Fix:** Added `mockGetGrades.mockResolvedValue([])` to beforeEach setup
- **Files modified:** frontend/src/pages/StudentProfile/StudentProfile.test.jsx
- **Commit:** 9d87e70

**2. [Rule 3 - Blocking] Refactored mock pattern from require() to hoisted vi.fn()**
- **Found during:** Task 2
- **Issue:** Using `require()` in beforeEach to access mocked modules failed with ESM module resolution - `client.js` was not being intercepted
- **Fix:** Declared mock functions as module-level `vi.fn()` variables, used arrow function factories in `vi.mock()` calls, imported component after mock definitions
- **Files modified:** frontend/src/pages/StudentProfile/StudentProfile.test.jsx
- **Commit:** 9d87e70

## Verification

```
npx vitest run — 6 tests passed, 1 test file, 0 failures
```

All acceptance criteria met:
- QueryClientProvider wraps all routes (2 matches in App.jsx)
- QueryBoundary renders LoadingSpinner, ErrorMessage, "Try again" button
- 6 characterization tests pass for StudentProfile monolith
- All tests green via `npx vitest run`

## Self-Check: PASSED
