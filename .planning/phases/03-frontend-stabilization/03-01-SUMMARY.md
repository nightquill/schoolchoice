---
phase: 03-frontend-stabilization
plan: 01
subsystem: frontend-infra, backend-entities
tags: [vitest, tailwind, shadcn, tanstack-query, entity-api]
dependency_graph:
  requires: []
  provides: [vitest-config, tailwind-v3, shadcn-ui, tanstack-query, entity-endpoints, path-alias]
  affects: [frontend/vite.config.js, frontend/tailwind.config.js, backend/app/main.py]
tech_stack:
  added: [vitest@4.1.5, "@testing-library/react@16.3.2", "@testing-library/jest-dom@6.9.1", jsdom@29.0.2, tailwindcss@3.4.19, postcss@8.5.8, autoprefixer@10.5.0, "@tanstack/react-query@5.100.2", shadcn-ui, clsx, tailwind-merge, class-variance-authority]
  patterns: [vitest-jsdom, tailwind-v3-postcss, shadcn-components-json, entity-registry-config-only]
key_files:
  created:
    - frontend/src/test/setup.js
    - frontend/tailwind.config.js
    - frontend/postcss.config.js
    - frontend/components.json
    - frontend/jsconfig.json
    - frontend/src/lib/utils.js
    - frontend/src/components/ui/button.jsx
    - backend/app/api/v1/routes/entities.py
    - backend/tests/test_entities.py
  modified:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/vite.config.js
    - frontend/src/index.css
    - backend/app/main.py
    - backend/app/platform/entity_registry.py
    - backend/app/platform/module_loader.py
decisions:
  - "Used .js extension with module.exports for tailwind.config.js and postcss.config.js (CJS syntax in ESM project) — shadcn requires tailwind.config.js filename specifically"
  - "Added register_config() to EntityRegistry for auto_crud=false entities — avoids SQLAlchemy model collision with hand-written models while still exposing config metadata via API"
  - "Added jsconfig.json with @/* path alias — required by shadcn CLI for import alias validation"
  - "Used passWithNoTests: true in Vitest config — ensures exit code 0 when no test files exist yet"
metrics:
  duration: 19m
  completed: "2026-04-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 9
  files_modified: 7
  tests_added: 4
  tests_total_passing: 136
---

# Phase 03 Plan 01: Frontend Infrastructure + Entity Endpoints Summary

Vitest + RTL test runner, Tailwind CSS v3 with shadcn/ui component system, TanStack Query v5, and backend entity schema API endpoints with auth protection and full test coverage.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Install npm deps, configure Vitest + Tailwind + shadcn | ca6570f | Done |
| 2 | Create backend entity schema/list endpoints with tests | 7bab715 | Done |

## What Was Built

### Task 1: Frontend Infrastructure
- **Vitest** v4.1.5 configured with jsdom environment, globals, and RTL jest-dom matchers
- **Tailwind CSS** v3.4.19 with PostCSS pipeline — content paths set to `./index.html` and `./src/**/*.{js,jsx}`
- **shadcn/ui** initialized — `components.json` created, `cn()` utility in `src/lib/utils.js`, Button component verified installable
- **TanStack Query** v5.100.2 installed as production dependency
- **Path alias** `@/` configured in both `vite.config.js` (resolve.alias) and `jsconfig.json` (for IDE + shadcn CLI)
- **CSS variables** for shadcn mapped to project design tokens from `tokens.css` (primary=#2563EB, destructive=#DC2626, border=#CBD5E1)

### Task 2: Backend Entity Endpoints
- `GET /api/v1/entities` — returns JSON array of registered entity names/table/auto_crud (auth required)
- `GET /api/v1/entities/{name}/schema` — returns entity field definitions as JSON (auth required, 404 for unknown)
- Both endpoints protected via `Depends(get_current_user)` — unauthenticated requests return 401
- Entity YAML configs now loaded during module discovery via `module_loader.py`
- `register_config()` method added to `EntityRegistry` for entities with `auto_crud: false` (avoids dynamic model collision with hand-written ORM classes)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Entity YAML configs not loaded into registry**
- **Found during:** Task 2
- **Issue:** The entity registry's `register()` method was never called anywhere. YAML entity configs existed in `modules/school_choice/entities/` but weren't loaded, so the API endpoints returned empty results.
- **Fix:** Added entity YAML loading to `module_loader.py` during module discovery. Entities with `auto_crud: true` use `registry.register()` (creates dynamic model), entities with `auto_crud: false` use new `registry.register_config()` (metadata only).
- **Files modified:** `backend/app/platform/module_loader.py`, `backend/app/platform/entity_registry.py`
- **Commit:** 7bab715

**2. [Rule 3 - Blocking] SQLAlchemy model collision for auto_crud=false entities**
- **Found during:** Task 2
- **Issue:** `registry.register()` creates a dynamic SQLAlchemy model class named after the entity (e.g., "Student"). For entities with `auto_crud: false` (like student, school), this collided with existing hand-written ORM models on the same Base, causing `InvalidRequestError: Multiple classes found for path "Student"`.
- **Fix:** Added `register_config()` method to `EntityRegistry` that stores only the config metadata without creating a dynamic model. Module loader uses this for `auto_crud: false` entities.
- **Files modified:** `backend/app/platform/entity_registry.py`
- **Commit:** 7bab715

**3. [Rule 3 - Blocking] shadcn CLI required jsconfig.json**
- **Found during:** Task 1
- **Issue:** `npx shadcn@latest init` failed with "No import alias found in your tsconfig.json file." The project uses JavaScript (not TypeScript), so jsconfig.json was needed.
- **Fix:** Created `frontend/jsconfig.json` with `@/*` path mapping.
- **Files modified:** `frontend/jsconfig.json`
- **Commit:** ca6570f

**4. [Rule 3 - Blocking] Vitest exits code 1 with no tests**
- **Found during:** Task 1
- **Issue:** `npx vitest run` exits with code 1 when no test files exist, but acceptance criteria requires exit code 0.
- **Fix:** Added `passWithNoTests: true` to Vitest config.
- **Files modified:** `frontend/vite.config.js`
- **Commit:** ca6570f

## Verification Results

- `npx vitest run` exits code 0 (no tests, passWithNoTests)
- `npm list tailwindcss` shows 3.4.19
- `npm list @tanstack/react-query` shows 5.100.2
- `components.json` exists with shadcn configuration
- `npx shadcn@latest add button` successfully creates `src/components/ui/button.jsx`
- 4 entity endpoint tests pass (unauth 401, auth list, valid schema, 404 unknown)
- All 136 backend tests pass

## Known Stubs

None.

## Self-Check: PASSED

All 9 created files verified present. Both commit hashes (ca6570f, 7bab715) verified in git log.
