# Phase 4: Import and Export - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

CSV and Excel file import with a column-mapping UI and validation preview; data export as CSV; report/plan export as self-contained HTML; entity list search (text) and filtering (field-type-aware). PDF export (DATA-05) deferred to v2.

</domain>

<decisions>
## Implementation Decisions

### Column Mapping UX
- **D-01:** Auto-map columns by header name similarity, user reviews and adjusts via dropdowns. Fastest path for well-formatted files.
- **D-02:** Show a data preview of the first 3-5 rows under each column during mapping so users can verify correctness before importing.
- **D-03:** For Excel files with multiple sheets, show a sheet picker (dropdown/list) after upload. User selects one sheet, then proceeds to column mapping.
- **D-04:** Unmapped file columns shown in a separate "Not imported" section. User can still manually assign them to an entity field if auto-match missed one.

### Validation & Error Flow
- **D-05:** Validation results presented as a summary banner (e.g., "142 valid, 8 errors, 3 warnings") with a row-level detail table below highlighting error rows with specific field and reason.
- **D-06:** Partial import supported — user can approve importing valid rows only. Failed rows are downloadable as a CSV with an added `error_reason` column. (Matches success criterion #2.)
- **D-07:** Duplicate detection by entity key fields (e.g., email, student ID). Duplicates shown as warnings in the preview. User chooses per-duplicate: skip, overwrite, or import as new.

### Search & Filter Controls
- **D-08:** Persistent search bar + filter controls always visible above the entity list table. Text search is a single input searching across all text fields.
- **D-09:** As-you-type search with 300ms debounce. Appropriate for SME-scale datasets (<10K records).
- **D-10:** Filter types auto-determined from entity YAML field types: enum → dropdown, date → date range picker, numeric → range inputs. Text fields included in global search only.

### Export
- **D-11:** CSV export respects current search/filter — exports what the user sees. An "Export all" option is also available.
- **D-12:** Import and Export buttons sit in an action bar above the entity list table. Grouped as data operations, always visible.
- **D-13:** PDF export (DATA-05) deferred to v2. HTML export covers the same need; users can print-to-PDF from browser.
- **D-14:** HTML report export is self-contained — all CSS and JS embedded inline. File opens correctly anywhere without internet. Consistent with existing plan generator pattern (Jinja2 + inline CSS/Chart.js).

### Claude's Discretion
- Backend library choice for CSV/Excel parsing (e.g., openpyxl, pandas, csv module)
- Auto-mapping algorithm for column name similarity
- Exact debounce timing and search implementation details
- Validation rule ordering and error message formatting
- Action bar layout and button styling within shadcn/ui patterns
- How duplicate key fields are determined per entity (from YAML config or convention)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — Phase 4 covers DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08
- `.planning/PROJECT.md` — Constraints: no Docker, non-technical primary users, stack continuity (FastAPI + React + PostgreSQL)
- `.planning/ROADMAP.md` — Phase 4 goal and 5 success criteria

### Prior Phase Decisions (carry forward)
- `.planning/phases/01-platform-foundation/01-CONTEXT.md` — Entity YAML config format (D-01 through D-06), module structure, API consolidation to `/api/v1`
- `.planning/phases/02-ai-provider-abstraction/02-CONTEXT.md` — AI calls through `call_ai()`, no frontend API changes needed
- `.planning/phases/03-frontend-stabilization/03-CONTEXT.md` — Entity schema API (D-06), auto-generated list/form (D-05 through D-08), TanStack Query (D-09 through D-11), shadcn/ui + Tailwind (D-13, D-14)

### Existing Code (must read before modifying)
- `frontend/src/components/FileUpload/FileUpload.jsx` — Existing drag-and-drop upload component with progress bar (reuse for import)
- `frontend/src/components/EntityListView/EntityListView.jsx` — Existing entity list component to extend with search/filter/export
- `frontend/src/pages/EntityListPage/EntityListPage.jsx` — Page wrapper using entity schema + TanStack Query
- `frontend/src/api/entities.js` — Existing entity API layer to extend with import/export endpoints
- `backend/app/api/v1/routes/entities.py` — Backend entity CRUD routes to extend
- `backend/app/platform/entity_registry.py` — Entity config registry (field types, validation rules)
- `backend/app/services/plan_generator.py` — Existing Jinja2 HTML generation pattern (reference for HTML export)

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Naming patterns and code style
- `.planning/codebase/STRUCTURE.md` — Directory layout
- `.planning/codebase/STACK.md` — Current tech stack

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FileUpload` component: Drag-and-drop with progress bar, browse button, accessible. Reuse directly for the import upload step.
- `EntityListView`: Existing list component rendering entity rows — extend with search bar, filter controls, and action bar.
- `QueryBoundary`: Loading/error wrapper for TanStack Query — reuse for import preview and validation display.
- shadcn/ui components: `button`, `card`, `dialog`, `input`, `tabs` — use for import wizard steps and filter controls.
- `EmptyState` component: Reuse for "no results" state after filtering.
- Entity schema API (`GET /api/v1/entities/{name}/schema`): Returns field types and validation rules — drives auto-mapping and filter type detection.

### Established Patterns
- TanStack Query `useQuery`/`useMutation` for all server state — import uses `useMutation`, search/filter uses `useQuery` with dynamic query keys.
- Axios client with auth interceptor (`frontend/src/api/client.js`) — all new API calls go through this.
- Jinja2 HTML generation in `plan_generator.py` — pattern for self-contained HTML export.
- Config-driven field type → component map (Phase 3 D-05) — extend for filter control rendering.

### Integration Points
- `EntityListPage` — Add action bar (Import/Export buttons), search input, and filter controls above the `EntityListView`.
- `frontend/src/api/entities.js` — Add `importEntity()`, `exportEntityCSV()`, `exportReportHTML()` API functions.
- `backend/app/api/v1/routes/entities.py` — Add `/import`, `/export` endpoints.
- `App.jsx` routes — Add import wizard route (e.g., `/entities/{name}/import`).
- `NavBarV2` — No changes needed; import accessed from entity list page.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- **PDF export (DATA-05)** — Deferred to v2. HTML export + browser print-to-PDF covers the need without headless browser dependency.

</deferred>

---

*Phase: 04-import-and-export*
*Context gathered: 2026-04-25*
