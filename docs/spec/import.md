<!-- spec-tracks: apps/web/src/pages/StudentImport/StudentImport.jsx, apps/web/src/pages/ImportWizardPage/ImportWizardPage.jsx, apps/web/src/pages/EntityListPage/EntityListPage.jsx, apps/web/src/pages/EntityDetailPage/EntityDetailPage.jsx, apps/web/src/components/ImportWizard/ImportWizard.jsx, apps/web/src/components/ValidationSummary/ValidationSummary.jsx, apps/web/src/components/EntityListView/EntityListView.jsx, apps/web/src/components/EntityForm/EntityForm.jsx, apps/web/src/api/studentImport.js, apps/web/src/api/entities.js, backend/app/api/v1/routes/student_import.py, backend/app/api/v1/routes/entities.py -->

# Import Features Spec

Three import surfaces exist:

1. **Student Import** (`/import`) -- purpose-built CSV/Excel importer for student records + grades
2. **Entity Import Wizard** (`/entities/:name/import`) -- generic schema-driven importer for any registered entity
3. **Entity List/Detail Pages** (`/entities/:name`, `/entities/:name/:id`) -- schema-driven CRUD list and edit forms

---

## Student Import (`/import`)

### Elements
- **NavBarV2** (top navigation)
- **Page title**: "Import Students" (h1, 24px medium)
- **Step indicator** (flex row, sm text):
  - Step 1: "Upload File" (bold + primary when active)
  - Step 2: "Preview & Confirm" (bold + primary when active)
  - Step 3: "Done" (bold + primary when active)

#### Step 1: Upload
- **Info box** (bordered card, sm text):
  - **Accepted Formats**: CSV (.csv) & Excel (.xlsx) -- bold labels
  - **Required Columns**: (translated via `import.requiredColumnsList`)
  - **Grade Columns**: (translated via `import.gradeColumnsList`)
  - **Sitting Columns**: (translated via `import.sittingColumnsList`)
  - **Match note**: (xs text, explains matching by candidate number)
  - **Download Sample link** (`<a>`, href `/data/sample-students.csv`, download attribute, primary color underlined)
- **Upload area** (centered card, padded):
  - **Loading state**: `<LoadingSpinner>` with "Analysing..." label
  - **Normal state**: instruction text + `<input type="file">` accepting `.csv,.xlsx,.xls`

#### Step 2: Preview
- **Summary cards** (flex row, wrapping, 4 cards):
  - **New Students**: count in green (#166534), label below
  - **Updates**: count in blue (#1e40af), label below
  - **Errors**: count in red (#991b1b), label below
  - **Grades**: count in primary text color, label below
- **Preview table** (bordered card, horizontal scroll):
  - Headers: Row | Status | Candidate # | Name | Grades | Notes
  - Per row:
    - **Row number**: `row.row ?? idx + 1`
    - **Status badge**: colored pill (new=green, update=blue, error=red, skip=gray)
    - **Candidate number**: `row.candidate_number ?? '-'`
    - **Name**: `row.name ?? '-'`
    - **Grades summary**: `row.grades_summary ?? '-'`
    - **Notes/Errors**: `(row.warnings || row.errors || []).join('; ') || '-'` (red text for error rows)
  - **Empty state**: "No rows found" (centered)
- **Action buttons** (flex row):
  - **Confirm Import button** (`<Button>`, disabled while committing or when only errors exist, text "Importing..." / "Confirm Import")
  - **Cancel button** (outline variant, disabled while committing)

#### Step 3: Done
- **Success card** (centered):
  - **Checkmark icon** (48px)
  - **Heading**: "Import Complete" (xl bold)
  - **Summary text**: "X students created, Y updated, Z grades" (sm, secondary)
  - **Back to Dashboard button** (navigates to `/dashboard`)

### Data flow
- **Preview**: `POST /api/v1/import/students/preview`
  - Request: `FormData` with `file` field
  - Response: `{ rows: [{ row, status, candidate_number, name, grades_summary, warnings, errors, grades }], subject_columns: [...], unmapped_columns: [...], grade_conversions: [...], summary: { total, new, create, updated, update, errors, error, grades, grade_count } }`
- **Commit**: `POST /api/v1/import/students/commit`
  - Request: `FormData` with `file` field (re-uploaded)
  - Response: `{ created, updated, grades }`
- Backend permission check: admin always passes; non-admin needs `data_import >= read_only` (preview) or `read_write` (commit) on at least one org cohort
- File validation: max 10 MB, non-empty, format validation (magic bytes, corruption)
- Backend re-parses file on commit (does not trust preview state)

### Key behaviors
- File is re-sent on commit (not cached from preview step)
- Cancel resets to step 1, clears file and preview
- Commit button disabled when: committing, or errors > 0 AND new = 0 AND updated = 0
- Toast notifications on success and errors
- 403 if user lacks import permission for any org cohort

---

## Entity Import Wizard (`/entities/:name/import`)

### Elements
- **NavBarV2** (top navigation)
- **Page title**: "Import {name}" (h1, 24px medium, capitalized)
- **Format info box** (bordered card, sm text):
  - **Accepted Formats**: CSV (.csv) & Excel (.xlsx)
  - **Student-specific columns** (conditional, when `name === 'student'`):
    - Student columns list
    - Grade columns list
    - Sitting columns list
    - Match note (xs text)
    - Download sample link (`/data/sample-students.csv`)
  - **Generic entity note** (when `name !== 'student'`): "Columns auto-mapped" description
- **QueryBoundary** wrapper (loading/error states for schema fetch)
- **ImportWizard component** (receives `entityName` and `schema`):

#### ImportWizard Steps

**Step Indicator** (nav element, aria-label "Wizard steps"):
- 4 steps displayed (sheetSelect hidden from indicator since it only applies to Excel):
  1. Upload File
  2. (Select Sheet -- conditional, not shown in indicator)
  3. Map Columns
  4. Review & Import
- Each step: numbered circle (24px, colored by state) + label
- Active: primary color circle + medium weight text
- Complete: secondary color circle
- Dividers between steps (1px border line)

**Step: Upload**
- **Description text**: "Upload a CSV or Excel file for {entityName}"
- **FileUpload component** (accepts `.csv,.xlsx,.xls`, loading state while parsing)
- **Footer**: Next button (disabled until file selected or while parsing, text "Parsing..." / "Next")

**Step: Sheet Select** (only for multi-sheet Excel files)
- **Description text**: "Multiple sheets found"
- **Sheet selector**: `<Select>` dropdown with all sheet names from parsed result
- **Footer**: Back button (outline) + Next button (disabled until sheet selected, text "Loading..." / "Next")

**Step: Column Mapping**
- **Description text**: "Map file columns to {entityName} fields"
- **ColumnMapper component** (from `@schoolchoice/ui`):
  - Receives: `columns`, `previewRows`, `autoMapping`, `entityFields`, `mapping`, `onMappingChange`
  - Displays file columns with dropdowns to map to entity fields
  - Auto-mapping pre-populated from backend
- **Footer**: Back button (returns to sheetSelect or upload) + Next button (disabled while validating, text "Validating..." / "Next")

**Step: Validation Preview**
- **ValidationSummary component**:
  - **Summary banner** (role="alert", flex with badges):
    - **Valid count badge** (green bg #16A34A, white text): "X valid"
    - **Error count badge** (destructive variant, conditional): "X errors"
    - **Warning count badge** (amber bg #D97706, white text, conditional): "X warnings"
  - **Error rows table** (conditional, scrollable max-h 320px):
    - Headers: Row # | Field | Value | Reason
    - Each error row: red left border (3px #DC2626), light red background
    - **Download Errors link** (red underlined text, triggers CSV download)
  - **Duplicate rows section** (conditional):
    - **Section heading**: "X duplicate rows"
    - **Apply to All checkbox** + global dropdown (Skip / Overwrite / Import as New)
    - **Per-duplicate row**: row identifier + radio buttons for Skip/Overwrite/Import as New (disabled when Apply to All checked)
  - **Footer**: Back button (outline) + "Import X valid rows" button (disabled when validCount=0 or committing, text "Importing..." / "Import X valid rows")

**Step: Done**
- **Success card** (centered):
  - Checkmark icon (48px)
  - "Import Complete" heading (xl medium)
  - Description text
  - "Go to List" button (navigates to `/entities/{entityName}`)

### Data flow
- **Parse**: `POST /api/v1/entities/{name}/import/parse`
  - Request: `FormData` with `file`
  - Response (single sheet): `{ columns: string[], preview_rows: object[], all_rows: object[], total_rows: number, auto_mapping: { [col]: fieldName } }`
  - Response (multi-sheet): `{ sheets: string[] }`
  - Max 10 MB, 413 if exceeded
- **Parse Sheet**: `POST /api/v1/entities/{name}/import/parse-sheet?sheet_name=X`
  - Request: `FormData` with `file`
  - Response: same as single-sheet parse response
- **Validate**: `POST /api/v1/entities/{name}/import/validate`
  - Request: `{ mapping: { [col]: fieldName }, rows: object[] }`
  - Response: `{ valid_count, error_count, warning_count, valid_rows: [], error_rows: [{ row_number, field, value, error_reason }], duplicate_rows: [{ row_number, identifier }] }`
- **Commit**: `POST /api/v1/entities/{name}/import/commit`
  - Request: `{ valid_rows: [], mapping: {}, duplicate_decisions: { [index]: "skip"|"overwrite"|"new" } }`
  - Response: `{ imported_count, skipped_count }`
  - Backend re-validates before commit (never trusts client "valid" claim)
- **Export errors**: `GET /api/v1/entities/{name}/export/errors?error_rows=<JSON>`
  - Response: CSV file download with error_reason column

### Key behaviors
- Schema loaded via `GET /api/v1/entities/{name}/schema` -- drives field list for column mapping
- Auto-mapping: backend attempts to match file column names to entity field names
- Re-validation on commit: backend runs `validate_rows` again before inserting
- Duplicate resolution: per-row or global (Apply to All) with three options
- Step navigation: Back buttons return to previous step, conditional routing for sheet select
- All mutations use react-query `useMutation` with toast notifications

---

## Entity List Page (`/entities/:name`)

### Elements
- **NavBarV2** (top navigation)
- **Page title**: entity name (h1, 2xl medium, capitalized)
- **ActionBar component**:
  - **Import button** (hidden when `name === 'school'`)
  - **Export Filtered button** (exports current search/filter results as CSV)
  - **Export All button** (exports all records as CSV)
  - `isExporting` loading state
- **SearchFilterBar component**:
  - **Search input**: text search, debounced 300ms
  - **Filter controls**: driven by schema fields (supports string equality, range filters with from/to or min/max converted to `__gte`/`__lte` params)
- **QueryBoundary** wrapper (handles loading + error states)
- **EmptyState** (when no results and active search/filter)
- **EntityListView component**:
  - **Table** (full width, bordered, rounded):
    - Headers: first 5 schema fields (field names as column headers)
    - Rows: clickable (cursor pointer), hover highlight (#F1F5F9)
    - Cell values: `String(row[field.name] ?? '')`
  - **Empty state**: "No results" when rows array empty
  - Row click: navigates to `/entities/{name}/{id}`

### Data flow
- **Schema**: `GET /api/v1/entities/{name}/schema`
  - Response: `{ name, table, fields: [{ name, type, required, choices, max_length }] }`
- **List**: `GET /api/v1/{tableName}?q=<search>&filters=<JSON>`
  - Uses `schema.table` as the table name (falls through to auto-CRUD endpoints)
  - Handles both `{ items: [], total }` and plain array responses
  - Filters JSON-encoded: `{ field: value, field__gte: min, field__lte: max }`
- **Export Filtered**: `GET /api/v1/entities/{name}/export?q=&filters=`
  - Response: CSV blob, triggers browser download
- **Export All**: `GET /api/v1/entities/{name}/export`
  - Response: CSV blob, filename `{name}-export-{date}.csv`
- Table name validation: regex `/^[a-z][a-z0-9_]*$/` enforced client-side

### Key behaviors
- Search debounced by 300ms before triggering query
- Filters support range objects (`{ from, to }` or `{ min, max }`) converted to `__gte`/`__lte`
- Export respects current search + filter state (Export Filtered) or ignores it (Export All)
- Empty state only shown when there are active search/filter criteria and no results
- Row click navigates to detail/edit page
- Schema query enables list query (list disabled until schema loaded)
- Import button hidden for `school` entity

---

## Entity Detail Page (`/entities/:name/:id`)

### Elements
- **NavBarV2** (top navigation)
- **Page title**: "Edit {name}" (h1, 2xl medium, capitalized)
- **QueryBoundary** wrapper (loading + error for both schema and detail queries)
- **EntityForm component**:
  - **Dynamic fields**: rendered per schema field definition
    - Each field: label (sm medium, secondary color) + field component + validation error (red, sm)
    - Required fields marked with `*` suffix
    - Field components mapped by type via `FIELD_COMPONENT_MAP` (string, text, enum, etc.)
    - Input styling: full width, bordered, rounded, base font
  - **Client-side validation**: required fields checked on submit (error: "{field} is required")
  - **Footer** (flex row, gap):
    - **Save button** (primary, type submit, text "Saving..." / "Save", disabled while saving)
    - **Cancel button** (secondary, calls `onCancel`, disabled while saving)

### Data flow
- **Schema**: `GET /api/v1/entities/{name}/schema`
- **Detail**: `GET /api/v1/{tableName}/{id}` (enabled after schema loads)
- **Update**: `PUT /api/v1/{tableName}/{id}`
  - Request: form data object
  - On success: invalidates entity list and detail queries, navigates back to list
  - On error: toast "Failed to update {name}."

### Key behaviors
- Form initialized with `detailQuery.data` (keyed by `id` for proper reset)
- Schema-driven: field types, required flags, choices all come from entity config
- Optimistic navigation: redirects to list on successful save
- Cancel navigates back to list page

---

## Backend API Summary (Import Routes)

### Student Import (`/api/v1/import/students/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/import/students/preview` | POST | Parse + validate CSV/Excel, return preview with summary counts |
| `/import/students/commit` | POST | Parse + validate + commit. Re-parses file (no trust of preview). |

Permission: admin passes always. Non-admin needs `data_import` permission at cohort level. File limits: 10 MB max, non-empty, format validated.

### Entity Import/Export (`/api/v1/entities/`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/entities` | GET | List all registered entities with name/table/auto_crud |
| `/entities/{name}/schema` | GET | Entity config as JSON (fields, types, required, choices) |
| `/entities/{name}/import/parse` | POST | Parse CSV/Excel, return columns + preview + auto-mapping. Multi-sheet Excel returns sheet list. |
| `/entities/{name}/import/parse-sheet` | POST | Parse specific Excel sheet |
| `/entities/{name}/import/validate` | POST | Validate mapped rows, find duplicates. Returns valid/error/duplicate splits. |
| `/entities/{name}/import/commit` | POST | Commit valid rows. Re-validates. Supports skip/overwrite/new for duplicates. |
| `/entities/{name}/export` | GET | CSV export with optional q= and filters= params |
| `/entities/{name}/export/errors` | GET | Download error rows as CSV with error_reason column |
| `/entities/plan-export/{plan_id}` | GET | Download plan as HTML file |

All endpoints require authentication. File size limit: 10 MB. Entity resolution: tries registry first, then scans `Base.metadata` for matching `__tablename__`.
