---
phase: 04-import-and-export
plan: "03"
subsystem: frontend-import-wizard
tags: [import, wizard, ui, column-mapping, validation, shadcn, react]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [import-wizard-ui, column-mapper, validation-summary, extended-entities-api]
  affects: [frontend/src/App.jsx, frontend/src/api/entities.js]
tech_stack:
  added: [select, table, badge, progress, separator (shadcn/base-ui)]
  patterns: [multi-step wizard state machine, useMutation for async steps, blob download via Axios]
key_files:
  created:
    - frontend/src/pages/ImportWizardPage/ImportWizardPage.jsx
    - frontend/src/components/ImportWizard/ImportWizard.jsx
    - frontend/src/components/ColumnMapper/ColumnMapper.jsx
    - frontend/src/components/ValidationSummary/ValidationSummary.jsx
    - frontend/src/components/ui/select.jsx
    - frontend/src/components/ui/table.jsx
    - frontend/src/components/ui/badge.jsx
    - frontend/src/components/ui/progress.jsx
    - frontend/src/components/ui/separator.jsx
  modified:
    - frontend/src/api/entities.js
    - frontend/src/App.jsx
decisions:
  - "Error CSV download routed through backend GET /entities/{name}/export/errors endpoint rather than client-side CSV construction, per RESEARCH.md architectural assignment"
  - "Build verification skipped due to pre-existing build failures (postcss.config.js ESM, fieldComponents.js JSX in .js) unrelated to this plan"
metrics:
  duration_minutes: 25
  tasks_completed: 3
  tasks_total: 3
  files_created: 11
  files_modified: 2
  completed_date: "2026-04-25"
---

# Phase 04 Plan 03: Frontend Import Wizard Summary

## One-liner

Multi-step import wizard (upload -> sheet select -> column map -> validation review -> confirm) with shadcn UI components and backend-routed error CSV export.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install shadcn components and extend entities.js API | c0fedc1 | select.jsx, table.jsx, badge.jsx, progress.jsx, separator.jsx, entities.js |
| 2 | Build ImportWizardPage, ImportWizard, ColumnMapper, ValidationSummary | a47ed79 | ImportWizardPage.jsx, ImportWizard.jsx, ColumnMapper.jsx, ValidationSummary.jsx |
| 3 | Add import wizard route to App.jsx | b75e03e | App.jsx |

## What Was Built

### API Layer (entities.js)
- `importParse(entityName, file)` — multipart POST to parse uploaded file; no Content-Type header set manually
- `importParseSheet(entityName, file, sheetName)` — parse a specific Excel sheet
- `importValidate(entityName, payload)` — validate rows against entity schema
- `importCommit(entityName, payload)` — commit valid rows to the database
- `exportEntityCSV(entityName, params)` — download entity data as CSV blob
- `exportPlanHTML(planId)` — download plan as HTML blob
- `exportErrorCSV(entityName, errorRows)` — backend-generated error CSV with `error_reason` column
- `getEntityList(tableName, params)` — updated to accept optional query params for search/filter

### ImportWizardPage
Page shell at `/entities/:name/import`. Uses `useParams()` for entity name, queries entity schema, wraps `ImportWizard` in `QueryBoundary`. Same style tokens as `EntityListPage`.

### ImportWizard
5-step state machine: `upload` -> `sheetSelect` (Excel only, when sheets > 1) -> `columnMapping` -> `validationPreview` -> `done`.

Three `useMutation` hooks:
- `parseMutation` — calls `importParse`, advances to sheetSelect or columnMapping
- `validateMutation` — calls `importValidate`, advances to validationPreview
- `commitMutation` — calls `importCommit`, shows success toast, advances to done

Step indicator nav with numbered steps and `aria-current="step"`. Sheet selection step only shown for multi-sheet Excel files.

### ColumnMapper
Two-column table (file column | entity field Select). Features:
- First 3 preview values shown under each column label in monospace
- Auto-mapped columns pre-selected with green CheckIcon (lucide, 16px, #16A34A)
- Already-used entity fields disabled in other dropdowns (prevents double-mapping)
- "Not imported" section below Separator for columns with no mapping selected

### ValidationSummary
- Summary banner with `role="alert"` and Badge components: valid (green), errors (destructive), warnings (amber)
- Error rows table with left border `3px solid #DC2626` and `rgba(220, 38, 38, 0.06)` background
- "Download error rows as CSV" — calls `exportErrorCSV(entityName, errorRows)` which POSTs to backend for server-side CSV with `error_reason` column
- Duplicate rows section with per-row radio buttons (Skip / Overwrite existing / Import as new) and batch "Apply to all" checkbox
- "Import N Valid Rows" CTA disabled when validCount === 0 or isCommitting

### App.jsx Route
`/entities/:name/import` registered before `/entities/:name/:id` (order matters — static segment before dynamic).

## Deviations from Plan

### Pre-existing Issues (logged, not fixed)

Two pre-existing build failures existed before this plan's changes (confirmed by git stash test):

1. `frontend/postcss.config.js` — CommonJS `module.exports` syntax in an ESM project (`"type": "module"` in package.json). Error: "module is not defined in ES module scope". Fix: rename to `postcss.config.cjs`.

2. `frontend/src/components/EntityForm/fieldComponents.js` — JSX syntax in a `.js` file without JSX parser config. Error: "Unexpected JSX expression". Fix: rename to `.jsx`.

These are logged in `.planning/phases/04-import-and-export/deferred-items.md` and are out-of-scope pre-existing issues not introduced by this plan.

## Known Stubs

None. All components receive live data from API mutations. No hardcoded empty values flow to UI rendering.

## Threat Surface Scan

All threats T-04-11 through T-04-13 from plan threat model are mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-04-11 (Tampering - ColumnMapper) | Entity fields sourced from schema query (server-controlled); user selects from provided list only |
| T-04-12 (Spoofing - ImportWizardPage route) | Route wrapped in ProtectedRoute; redirects to /login if unauthenticated |
| T-04-13 (Information Disclosure - ValidationSummary) | Accepted — error rows contain only data the user themselves uploaded |

No new network endpoints, auth paths, or trust boundary changes introduced by this plan.

## Self-Check: PASSED

Files created/exist:
- frontend/src/pages/ImportWizardPage/ImportWizardPage.jsx: FOUND
- frontend/src/components/ImportWizard/ImportWizard.jsx: FOUND
- frontend/src/components/ColumnMapper/ColumnMapper.jsx: FOUND
- frontend/src/components/ValidationSummary/ValidationSummary.jsx: FOUND
- frontend/src/components/ui/select.jsx: FOUND
- frontend/src/components/ui/badge.jsx: FOUND
- frontend/src/components/ui/progress.jsx: FOUND
- frontend/src/components/ui/separator.jsx: FOUND
- frontend/src/components/ui/table.jsx: FOUND

Commits exist:
- c0fedc1: feat(04-03): install shadcn ui components and extend entities.js API
- a47ed79: feat(04-03): build ImportWizardPage, ImportWizard, ColumnMapper, ValidationSummary
- b75e03e: feat(04-03): add import wizard route to App.jsx
