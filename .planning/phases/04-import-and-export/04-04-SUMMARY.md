---
phase: 04-import-and-export
plan: "04"
subsystem: frontend-search-filter-export
tags: [search, filter, export, csv, html, action-bar, entity-list]
dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [search-filter-bar, action-bar, csv-export-ui, html-export-ui]
  affects: [EntityListPage, AcademicPlan]
tech_stack:
  added: []
  patterns:
    - debounced search with setTimeout (300ms)
    - polymorphic filter controls driven by entity schema field types
    - blob download via Axios auth-intercepted requests
key_files:
  created:
    - frontend/src/components/FilterControl/FilterControl.jsx
    - frontend/src/components/SearchFilterBar/SearchFilterBar.jsx
    - frontend/src/components/ActionBar/ActionBar.jsx
    - frontend/src/components/ui/dropdown-menu.jsx
    - frontend/src/components/ui/popover.jsx
    - frontend/src/components/EntityForm/fieldComponents.jsx
    - frontend/postcss.config.cjs
  modified:
    - frontend/src/pages/EntityListPage/EntityListPage.jsx
    - frontend/src/pages/AcademicPlan/AcademicPlan.jsx
    - frontend/src/api/entities.js
    - frontend/src/components/EntityForm/EntityForm.jsx
decisions:
  - "Used base-ui Menu primitive for DropdownMenu wrapper (not Radix UI) to stay consistent with codebase base-nova shadcn style"
  - "Used native <select> for FilterControl enum type (consistent with fieldComponents pattern, avoids base-ui Select complexity)"
  - "Added exportEntityCSV and exportPlanHTML to entities.js (missing from wave 1) as Rule 3 fix"
  - "Fixed fieldComponents.js -> .jsx rename as Rule 1 bug (JSX in .js blocked build)"
  - "Fixed postcss.config.js -> .cjs rename as Rule 1 bug (ES module scope conflict blocked build)"
metrics:
  duration_minutes: 24
  completed_date: "2026-04-25"
  tasks_completed: 3
  files_changed: 11
---

# Phase 04 Plan 04: Search/Filter UI + Action Bar + HTML Export Summary

Search bar with 300ms debounce, schema-driven filter controls (enum select, date range, numeric range), action bar with import navigation and CSV export dropdown, and Export HTML button on AcademicPlan page using Axios auth-intercepted blob downloads.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install shadcn components and create FilterControl + SearchFilterBar | cc96206 | FilterControl.jsx, SearchFilterBar.jsx, dropdown-menu.jsx, popover.jsx |
| 2 | Create ActionBar and extend EntityListPage with search/filter/export | 4a89f79 | ActionBar.jsx, EntityListPage.jsx, entities.js |
| 3 | Add Export HTML button to AcademicPlan page | c630a47 | AcademicPlan.jsx |
| — | Fix postcss.config.js -> .cjs (pre-existing build blocker) | db3075a | postcss.config.cjs |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSX in .js file blocked build**
- **Found during:** Task 1 verification
- **Issue:** `frontend/src/components/EntityForm/fieldComponents.js` contained JSX but had `.js` extension; vite/rolldown refused to parse JSX in `.js` files with `"type": "module"` package
- **Fix:** Copied content to `fieldComponents.jsx`; updated EntityForm.jsx import to use `.jsx` extension
- **Files modified:** `frontend/src/components/EntityForm/fieldComponents.jsx` (new), `frontend/src/components/EntityForm/EntityForm.jsx`
- **Commit:** cc96206

**2. [Rule 1 - Bug] postcss.config.js used CommonJS module.exports in ES module scope**
- **Found during:** Build verification after Task 3
- **Issue:** `postcss.config.js` uses `module.exports` syntax but `package.json` has `"type": "module"`, causing `ReferenceError: module is not defined` during build
- **Fix:** Renamed `postcss.config.js` to `postcss.config.cjs`
- **Files modified:** `frontend/postcss.config.cjs`
- **Commit:** db3075a

**3. [Rule 3 - Blocking] Missing API functions in entities.js**
- **Found during:** Task 2 implementation
- **Issue:** `exportEntityCSV`, `exportPlanHTML`, and updated `getEntityList(tableName, params={})` were referenced in the plan's interface spec as "after Plan 03 Task 1" but were absent from the actual file
- **Fix:** Added all three functions to `entities.js`; `exportEntityCSV` and `exportPlanHTML` use Axios with auth interceptor and trigger blob downloads (mitigates T-04-16 and T-04-18)
- **Files modified:** `frontend/src/api/entities.js`
- **Commit:** 4a89f79

**4. [Design deviation] dropdown-menu.jsx uses base-ui Menu (not Radix UI)**
- **Found during:** Task 1
- **Reason:** The plan said `npx shadcn@latest add dropdown-menu popover` but the project uses `base-nova` style with `@base-ui/react` primitives (no Radix UI installed). Installing Radix would introduce an inconsistent dependency.
- **Fix:** Built `dropdown-menu.jsx` and `popover.jsx` as thin wrappers over `@base-ui/react/menu` and `@base-ui/react/popover` respectively, exporting the same API surface the plan's ActionBar code expects.

## Decisions Made

- **base-ui for dropdown/popover**: Consistent with `dialog.jsx`, `button.jsx`, `input.jsx` — all use base-ui primitives. Avoids Radix UI dependency alongside base-ui.
- **Native `<select>` for enum filter**: The existing `fieldComponents.jsx` already uses native `<select>` for enum; reusing that pattern keeps consistency.
- **`plan?.id` condition for Export HTML**: Button shown when plan has an `id` (not just `html_content`) so the export button is also available if a plan was generated previously and user navigates back.

## Known Stubs

None — all data flows are wired:
- `getEntityList` passes `q` and `filters` params to backend search/filter endpoint
- `exportEntityCSV` calls the `/api/v1/entities/{name}/export` endpoint and triggers file download
- `exportPlanHTML` calls `/api/v1/entities/plan-export/{plan_id}` and triggers file download
- `FilterControl` renders real interactive controls backed by schema field metadata

## Threat Flags

No new threat surface beyond what the plan's threat model covers (T-04-14 through T-04-18).

## Self-Check: PASSED

All created files verified present on disk. All task commits verified in git log.

Build verification: `npm run build` passes after fixing two pre-existing bugs (fieldComponents.js -> .jsx, postcss.config.js -> .cjs). 2218 modules transformed, no errors.
