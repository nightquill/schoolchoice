# Phase 4: Import and Export - Research

**Researched:** 2026-04-25
**Domain:** CSV/Excel import pipeline, file export, entity list search and filtering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Column Mapping UX**
- D-01: Auto-map columns by header name similarity, user reviews and adjusts via dropdowns.
- D-02: Show a data preview of the first 3-5 rows under each column during mapping.
- D-03: For Excel files with multiple sheets, show a sheet picker after upload before column mapping.
- D-04: Unmapped file columns shown in a "Not imported" section; user can manually assign them.

**Validation & Error Flow**
- D-05: Validation results as summary banner ("142 valid, 8 errors, 3 warnings") plus row-level detail table.
- D-06: Partial import supported — valid rows import, failed rows downloadable as CSV with `error_reason` column.
- D-07: Duplicate detection by entity key fields; user resolves per-duplicate: skip / overwrite / import as new.

**Search & Filter Controls**
- D-08: Persistent search bar + filter controls always visible above entity list table.
- D-09: As-you-type search with 300ms debounce.
- D-10: Filter types auto-determined from entity YAML field types: enum -> dropdown, date -> date range picker, numeric -> range inputs.

**Export**
- D-11: CSV export respects current search/filter; "Export all" option also available.
- D-12: Import and Export buttons in an action bar above the entity list table; always visible.
- D-13: PDF export (DATA-05) deferred to v2.
- D-14: HTML report export is self-contained — all CSS and JS embedded inline; Jinja2 + inline CSS/Chart.js pattern.

### Claude's Discretion
- Backend library choice for CSV/Excel parsing (e.g., openpyxl, pandas, csv module)
- Auto-mapping algorithm for column name similarity
- Exact debounce timing and search implementation details
- Validation rule ordering and error message formatting
- Action bar layout and button styling within shadcn/ui patterns
- How duplicate key fields are determined per entity (from YAML config or convention)

### Deferred Ideas (OUT OF SCOPE)
- PDF export (DATA-05) — deferred to v2. HTML export + browser print-to-PDF covers the need.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | User can import CSV files with a column mapping UI | Import service pattern; `FileUpload` component reuse; `openpyxl`/csv stdlib for parsing |
| DATA-02 | User can import Excel files (.xlsx) with sheet selection and column mapping | `openpyxl` (already available in environment); sheet picker step in wizard |
| DATA-03 | Import pipeline validates data before committing (preview, error summary, approve/reject) | Two-phase import API: `/parse` then `/commit`; Pydantic validation; duplicate detection |
| DATA-04 | User can export entity data as CSV | `csv` stdlib + FastAPI `StreamingResponse`; query param filters applied server-side |
| DATA-05 | User can export reports/plans as PDF | DEFERRED to v2 per D-13 |
| DATA-06 | User can export reports/plans as HTML | Existing `plan_generator.py` Jinja2 + inline CSS pattern; new HTML export endpoint |
| DATA-07 | User can search entity lists with text search across indexed fields | Query param `q=` on list endpoints; SQL `ILIKE` across string/text fields |
| DATA-08 | User can filter entity lists by field values (dropdowns, date ranges, numeric ranges) | Query params per field type; filter logic in `import_export_service.py` or entity routes |

</phase_requirements>

---

## Summary

Phase 4 adds file import/export and search/filter to the generic entity system built in Phase 3. All work is an extension of existing infrastructure — the entity registry, CRUD generator, EntityListView, and FileUpload component are all in place. The central challenge is the multi-step import wizard: file parse -> sheet select (Excel) -> column mapping -> validation preview -> confirm commit. This requires a two-call backend API (parse/preview endpoint, then commit endpoint) so the user can review before data is written.

The existing stack already has all required libraries. `openpyxl` (version 3.0.9) is installed in the environment but is NOT listed in `backend/requirements.txt` — it must be added. The Python `csv` module (stdlib) handles CSV reading and writing with no extra dependency. The frontend already has TanStack Query v5, shadcn/ui initialized, `lucide-react`, and `sonner` (toasts). The new shadcn components required (Select, Table, Badge, Progress, Separator, DropdownMenu, Popover) must be added via `npx shadcn@latest add` commands — they are not yet installed.

The `auto_crud` entity system routes all generic entity list queries through `build_crud_router` at `/api/v1/{table}`. Search and filter must be added as optional query parameters to the generated list endpoint, OR as a separate search endpoint on `entities.py`. Because `auto_crud=false` entities (student, school) use hand-written routes, the search/filter parameters must be applied uniformly — the cleanest approach is to add `q`, `field`, and filter params directly to the auto-crud list route, and separately to hand-written routes only as needed.

**Primary recommendation:** Implement the import wizard as a dedicated page route with a two-phase API (parse -> commit). Add search/filter as query params to the auto-CRUD list endpoint. Export CSV via a streaming FastAPI response. HTML report export extends the existing `plan_generator.py` pattern.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File upload (drag/drop) | Browser / Client | — | `FileUpload` component handles file selection; no server round-trip until Next clicked |
| CSV/Excel parsing | API / Backend | — | Files sent as multipart upload; parsing is server responsibility to avoid JS memory limits with large files |
| Sheet detection (Excel) | API / Backend | — | Requires openpyxl access; frontend gets sheet names list back from parse endpoint |
| Column auto-mapping | API / Backend | — | Similarity matching runs server-side against entity schema from registry |
| Validation preview | API / Backend | — | Pydantic validation applied server-side; frontend displays results |
| Import commit | API / Backend | Database | Writes validated rows to PostgreSQL via ORM |
| Duplicate detection | API / Backend | Database | SQL query to find matching rows by key fields |
| CSV export | API / Backend | — | StreamingResponse with current filter applied server-side |
| HTML report export | API / Backend | — | Jinja2 rendering server-side; returns self-contained HTML |
| Search/filter UI | Browser / Client | — | Builds query params, sends to API; 300ms debounce in browser |
| Search/filter logic | API / Backend | Database | SQL ILIKE for text, WHERE clauses for enum/date/numeric |
| Error CSV download | API / Backend | — | Generates CSV with error_reason column appended |

---

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openpyxl` | 3.0.9 (env) | Excel .xlsx read/write | Only .xlsx-capable Python library without pandas overhead; already installed |
| `csv` (stdlib) | n/a | CSV read/write | Zero dependency; handles all CSV dialect edge cases; FastAPI streams via `io.StringIO` |
| `difflib` (stdlib) | n/a | Column name similarity scoring for auto-map | `SequenceMatcher.ratio()` gives 0-1 score; no install needed |
| `@tanstack/react-query` | ^5.100.2 | TanStack Query for import mutations and filtered queries | Already in use (Phase 3); `useMutation` for import steps |
| `lucide-react` | ^1.11.0 | Icons: Upload, Download, Search, FileDown, Check | Already installed; confirmed: upload.mjs, download.mjs, search.mjs, file-down.mjs, check.mjs |
| `sonner` | ^2.0.7 | Import/export success and error toasts | Already in use; `ui/sonner.jsx` exists |
| `FastAPI` `StreamingResponse` | (FastAPI stdlib) | Stream CSV export without buffering whole file | Built into FastAPI; no extra dep |

[VERIFIED: filesystem check of backend/requirements.txt, node_modules/lucide-react, package.json]

### New Dependencies Required

| Library | Install Command | Purpose | Gap |
|---------|----------------|---------|-----|
| `openpyxl` | `pip install openpyxl==3.0.9` | Excel parsing | Installed in environment but NOT in requirements.txt |
| `shadcn Select` | `npx shadcn@latest add select` | Column mapping dropdowns, sheet picker, enum filters | Not yet in `src/components/ui/` |
| `shadcn Table` | `npx shadcn@latest add table` | Data preview, validation error table | Not yet in `src/components/ui/` |
| `shadcn Badge` | `npx shadcn@latest add badge` | Valid/error/warning counts in summary | Not yet in `src/components/ui/` |
| `shadcn Progress` | `npx shadcn@latest add progress` | Import progress indicator | Not yet in `src/components/ui/` |
| `shadcn Separator` | `npx shadcn@latest add separator` | Visual dividers in wizard | Not yet in `src/components/ui/` |
| `shadcn DropdownMenu` | `npx shadcn@latest add dropdown-menu` | Export options (filtered / all) | Not yet in `src/components/ui/` |
| `shadcn Popover` | `npx shadcn@latest add popover` | Date range filter container | Not yet in `src/components/ui/` |

[VERIFIED: filesystem check of frontend/src/components/ui/ — only button.jsx, card.jsx, dialog.jsx, input.jsx, sonner.jsx, tabs.jsx exist]

**Installation:**
```bash
# Backend — add to requirements.txt
pip install openpyxl==3.0.9

# Frontend — add shadcn components
cd frontend
npx shadcn@latest add select table badge progress separator dropdown-menu popover
```

**Version verification:**
- openpyxl 3.0.9 confirmed installed and functional [VERIFIED: `pip show openpyxl`; `python3 -c "import openpyxl; ..."` ran successfully]
- Radix UI primitive versions: @radix-ui/react-select 2.2.6, @radix-ui/react-popover 1.1.15, @radix-ui/react-dropdown-menu 2.1.16, @radix-ui/react-progress 1.1.8 [VERIFIED: npm view]

### Existing Components to Reuse

| Component | File | Reuse Strategy |
|-----------|------|---------------|
| `FileUpload` | `frontend/src/components/FileUpload/FileUpload.jsx` | Add `accept=".csv,.xlsx,.xls"` prop; wraps upload step of wizard |
| `EntityListView` | `frontend/src/components/EntityListView/EntityListView.jsx` | Extend to accept `searchQuery` / `filters` props passed from page; render rows from filtered data |
| `QueryBoundary` | `frontend/src/components/QueryBoundary/QueryBoundary.jsx` | Wrap import preview step and filtered entity list |
| `EmptyState` | `frontend/src/components/EmptyState/EmptyState.jsx` | "No results found" for filtered queries; "No data yet" for empty entity |
| `ui/button.jsx` | `frontend/src/components/ui/button.jsx` | All CTA buttons |
| `ui/card.jsx` | `frontend/src/components/ui/card.jsx` | Import wizard step containers |
| `ui/dialog.jsx` | `frontend/src/components/ui/dialog.jsx` | Duplicate resolution dialog |
| `ui/input.jsx` | `frontend/src/components/ui/input.jsx` | Search bar, numeric range filter inputs |
| `ui/sonner.jsx` | `frontend/src/components/ui/sonner.jsx` | Success/error toasts |

[VERIFIED: filesystem check — all files confirmed present]

---

## Architecture Patterns

### System Architecture Diagram

```
User browser
    |
    |  1. Upload file (multipart)
    v
POST /api/v1/entities/{name}/import/parse
    |  - openpyxl or csv.reader parses bytes
    |  - returns: {sheets: [...], columns: [...], preview_rows: [...], mapping: {...}}
    |
    |  2. User reviews column mapping in ImportWizard (React)
    |     - ColumnMapper renders mapping dropdowns
    |     - auto_mapping pre-fills dropdowns
    |
    |  3. User clicks "Next" -> Validate
    v
POST /api/v1/entities/{name}/import/validate
    |  - applies column mapping to all rows
    |  - Pydantic validation per field type/required
    |  - duplicate detection via SQL
    |  - returns: {valid_count, error_count, warning_count, error_rows: [...]}
    |
    |  4. User reviews ValidationSummary -> clicks "Import N Valid Rows"
    v
POST /api/v1/entities/{name}/import/commit
    |  - re-applies mapping + skips error rows
    |  - writes valid rows via ORM bulk_insert_mappings
    |  - applies duplicate decisions (skip/overwrite/new)
    |  - returns: {imported_count, skipped_count}
    |
    |  5. Redirect to entity list page
    v
GET /api/v1/{table}?q=...&field=value&date_from=...&date_to=...
    |  - SQL ILIKE for text search
    |  - WHERE clauses for enum/date/numeric filters
    |  - returns filtered rows as JSON
    |
    |  6a. User clicks "Export CSV"
    v
GET /api/v1/entities/{name}/export?q=...&(same filters)
    |  - StreamingResponse with CSV content-type
    |  - filename: entity-name-export-YYYY-MM-DD.csv
    v
User downloads file

    |  6b. User clicks "Export HTML" (report/plan pages only)
    v
GET /api/v1/entities/plan-export/{plan_id}
    |  - Returns stored html_content as download
    |  - Self-contained HTML file
    v
User downloads file
```

### Recommended Project Structure (new files only)

```
backend/app/
├── services/
│   └── import_service.py         # parse, validate, commit logic; Excel/CSV handling
├── api/v1/routes/
│   └── entities.py               # extend: add /import/parse, /import/validate,
│                                 #         /import/commit, /export endpoints
└── platform/
    └── crud_generator.py         # extend: add optional q/filter params to list route

frontend/src/
├── pages/
│   └── ImportWizardPage/
│       └── ImportWizardPage.jsx  # route: /entities/:name/import
├── components/
│   ├── ImportWizard/
│   │   └── ImportWizard.jsx      # step controller (Upload->Sheet->Map->Validate->Done)
│   ├── ColumnMapper/
│   │   └── ColumnMapper.jsx      # two-column mapping UI with preview rows
│   ├── ValidationSummary/
│   │   └── ValidationSummary.jsx # banner + error table
│   ├── SearchFilterBar/
│   │   └── SearchFilterBar.jsx   # text search + dynamic filter controls
│   ├── FilterControl/
│   │   └── FilterControl.jsx     # polymorphic: Select/date range/numeric range
│   └── ActionBar/
│       └── ActionBar.jsx         # Import button + Export DropdownMenu
└── api/
    └── entities.js               # extend: importEntity, exportEntityCSV, exportReportHTML
```

### Pattern 1: Two-Phase Import API

**What:** Import splits into parse -> validate -> commit. Never write to DB without user confirmation.

**When to use:** Any multi-step data operation requiring user review before commit.

**Backend pattern:**
```python
# Source: established FastAPI pattern + this codebase's route style

# Phase 1: parse file, return column list + sample rows + auto-mapping
@router.post("/{name}/import/parse")
async def import_parse(
    name: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    config = registry.get_config(name)
    if not config:
        raise HTTPException(status_code=404, detail=f"Entity '{name}' not found")
    content = await file.read()
    if file.filename.endswith((".xlsx", ".xls")):
        result = parse_excel(content, config)
    else:
        result = parse_csv(content, config)
    return result  # {sheets, columns, preview_rows, auto_mapping, selected_sheet}

# Phase 2: validate rows against entity config (no DB write)
@router.post("/{name}/import/validate")
def import_validate(
    name: str,
    payload: ImportValidateRequest,  # {mapping: {...}, rows: [...], duplicate_strategy: {...}}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...  # returns {valid_rows, error_rows, warning_rows}

# Phase 3: commit valid rows
@router.post("/{name}/import/commit")
def import_commit(
    name: str,
    payload: ImportCommitRequest,  # {valid_rows: [...], duplicate_decisions: {...}}
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ...  # returns {imported_count, skipped_count}
```

### Pattern 2: Column Auto-Mapping with difflib

**What:** Use `difflib.SequenceMatcher` to score header name similarity against entity field names.

**When to use:** Parse endpoint determines auto_mapping dict for frontend pre-fill.

```python
# Source: Python stdlib difflib — [VERIFIED: confirmed available, tested manually]
from difflib import SequenceMatcher

def normalize(s: str) -> str:
    """Normalize for comparison: lowercase, replace spaces/hyphens with underscore."""
    return s.lower().replace(" ", "_").replace("-", "_")

def auto_map_columns(file_columns: list[str], entity_fields: list[str]) -> dict[str, str | None]:
    """Return {file_column: entity_field_or_None} based on name similarity.

    Match threshold: 0.6 ratio. Fields already matched are not reused.
    """
    mapping = {}
    available = list(entity_fields)
    for col in file_columns:
        best_field = None
        best_score = 0.0
        for field in available:
            score = SequenceMatcher(None, normalize(col), normalize(field)).ratio()
            if score > best_score:
                best_score = score
                best_field = field
        if best_score >= 0.6:
            mapping[col] = best_field
            available.remove(best_field)
        else:
            mapping[col] = None
    return mapping
```

### Pattern 3: CSV Export via StreamingResponse

**What:** FastAPI `StreamingResponse` with `csv.writer` for memory-efficient export.

**When to use:** Any entity list export, error rows download.

```python
# Source: FastAPI StreamingResponse pattern — [ASSUMED] (standard FastAPI pattern)
import csv
import io
from fastapi.responses import StreamingResponse
from datetime import date

@router.get("/{name}/export")
def export_entity_csv(
    name: str,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    config = registry.get_config(name)
    rows = _query_entity_rows(name, q=q, db=db)  # applies search/filter
    field_names = [f.name for f in config.fields]

    def generate():
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=field_names, extrasaction="ignore")
        writer.writeheader()
        yield output.getvalue()
        for row in rows:
            output.seek(0)
            output.truncate(0)
            writer.writerow({f: getattr(row, f, "") for f in field_names})
            yield output.getvalue()

    filename = f"{name}-export-{date.today().isoformat()}.csv"
    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
```

### Pattern 4: Search/Filter Query Parameters

**What:** Add optional `q`, `field_name`, `date_from`/`date_to`, `min_val`/`max_val` to entity list endpoints.

**When to use:** Auto-CRUD list endpoint in `crud_generator.py`; also entity-specific routes if needed.

```python
# In build_crud_router, extend list_entities signature:
@router.get("", status_code=status.HTTP_200_OK)
def list_entities(
    q: str | None = None,           # text search across all string/text fields
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    **filter_kwargs,                # per-field filter params added dynamically
):
    query = db.query(model_cls)
    if q:
        # Build ILIKE OR across all string/text fields
        from sqlalchemy import or_
        ilike_clauses = [
            getattr(model_cls, f.name).ilike(f"%{q}%")
            for f in entity_config.fields
            if f.type in ("string", "text", "enum")
            if hasattr(model_cls, f.name)
        ]
        if ilike_clauses:
            query = query.filter(or_(*ilike_clauses))
    return query.all()
```

**Note:** Dynamic `**filter_kwargs` does not work cleanly with FastAPI's dependency injection. The recommended approach is to build per-field Query params explicitly in the generated router, or use a Depends helper that reads `request.query_params`. See Pitfall 4.

### Pattern 5: Frontend Debounced Search with TanStack Query

**What:** `useQuery` with dynamic `queryKey` including search string, triggered after 300ms debounce.

**When to use:** `SearchFilterBar` component driving `EntityListPage` data refresh.

```javascript
// Source: TanStack Query v5 pattern — [ASSUMED] (standard pattern for this version)
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

function useEntitySearch(entityName, tableName) {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({});

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(handle);
  }, [searchText]);

  const query = useQuery({
    queryKey: ['entities', entityName, debouncedSearch, filters],
    queryFn: () => getEntityList(tableName, { q: debouncedSearch, ...filters }),
  });

  return { searchText, setSearchText, filters, setFilters, ...query };
}
```

### Pattern 6: Import Wizard State Machine

**What:** Single React component managing step progression with state per step.

**Steps:** upload (0) -> sheetSelect (1, Excel only) -> columnMapping (2) -> validationPreview (3) -> done (4)

```javascript
// Pattern: local useState step machine — no router navigation between steps
// Wizard lives at /entities/:name/import (single route, single component)
const STEPS = ['upload', 'sheetSelect', 'columnMapping', 'validationPreview', 'done'];

export default function ImportWizard({ entityName, schema }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [parseResult, setParseResult] = useState(null);   // from /import/parse
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [mapping, setMapping] = useState({});
  const [validationResult, setValidationResult] = useState(null);

  const parseMutation = useMutation({ mutationFn: (f) => importParse(entityName, f) });
  const validateMutation = useMutation({ mutationFn: (p) => importValidate(entityName, p) });
  const commitMutation = useMutation({ mutationFn: (p) => importCommit(entityName, p) });

  // Step transitions: each step's "Next" advances to next step
  // "Back" retreats one step
}
```

### Pattern 7: openpyxl Excel Parsing

**What:** Read .xlsx bytes (from `UploadFile.read()`) without saving to disk.

```python
# Source: openpyxl docs pattern — [VERIFIED: openpyxl 3.0.9 confirmed available]
import io
import openpyxl

def parse_excel(content: bytes, config: EntityConfig) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet_names = wb.sheetnames  # list of sheet tab names
    # Return sheet list for picker; columns/rows loaded after sheet selection
    return {
        "format": "excel",
        "sheets": sheet_names,
        "selected_sheet": sheet_names[0] if sheet_names else None,
    }

def parse_excel_sheet(content: bytes, sheet_name: str, config: EntityConfig) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"columns": [], "preview_rows": [], "auto_mapping": {}}
    headers = [str(h) if h is not None else "" for h in rows[0]]
    entity_field_names = [f.name for f in config.fields]
    preview = [[str(c) if c is not None else "" for c in row] for row in rows[1:4]]
    return {
        "columns": headers,
        "preview_rows": preview,
        "auto_mapping": auto_map_columns(headers, entity_field_names),
    }
```

### Anti-Patterns to Avoid

- **Committing on parse:** Never write to the DB in the parse or validate endpoint. Only `/import/commit` touches the database.
- **Client-side CSV parsing:** Do not parse files in JavaScript. Large Excel files (5MB+) will exceed React memory limits and browser I/O. Always send file to backend.
- **Client-side error CSV generation:** Do not build error CSVs client-side via `URL.createObjectURL` on manually constructed strings. Use the backend `GET /{name}/export/errors` endpoint which uses `generate_error_csv()` for correct CSV formatting (handles commas in error messages, encoding, etc.).
- **Blocking import for all-or-nothing:** D-06 requires partial import support. Do not abort on first validation error.
- **Regex-only column matching:** Header "Student Name" vs "student_name" vs "StudentName" all need to match. Always normalize before comparing.
- **Dynamic query params with FastAPI's `**kwargs`:** FastAPI cannot introspect dynamically-added query params for docs or validation. Use explicit Query() parameters or a Depends helper that reads request.query_params directly.
- **ILIKE on non-indexed columns:** For SME scale (<10K rows), this is acceptable. Do not add a full-text search engine — it's out of scope per REQUIREMENTS.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel .xlsx parsing | Custom XML reader | `openpyxl` | .xlsx is a zip of XML; openpyxl handles encoding, merged cells, empty cells, date serial numbers |
| CSV dialect detection | Custom parser | `csv.Sniffer` or just `csv.DictReader` | Standard library handles quote chars, delimiters, BOM characters |
| Column similarity scoring | Edit distance from scratch | `difflib.SequenceMatcher` | stdlib; handles transpositions, case, partial matches in one call |
| Frontend file download trigger | `window.location.href` | Axios blob response + `URL.createObjectURL` | Auth header cannot be sent via `<a>` tag; must use Axios to include Bearer token |
| HTML escape in generated HTML | Manual string replace | `nh3` (already in requirements.txt) or `html.escape()` | SEC-05 requirement; hand-rolling misses edge cases like `&amp;` double-encoding |

**Key insight:** The CSV and openpyxl stdlib/library edge cases (BOM bytes, Excel date serials, mixed empty cells, Windows line endings) take days to get right. The libraries already handle them.

---

## Common Pitfalls

### Pitfall 1: File Not Sent in Import API — Axios Binary Upload

**What goes wrong:** Axios multipart upload sends file but backend receives empty bytes if Content-Type is not set correctly.

**Why it happens:** Axios with `FormData` sets the correct `multipart/form-data` header automatically only if you do NOT manually set `Content-Type`. Manually setting it overrides the boundary.

**How to avoid:**
```javascript
// Correct — let Axios set Content-Type with boundary:
const formData = new FormData();
formData.append('file', file);
await client.post(`/api/v1/entities/${name}/import/parse`, formData);
// Do NOT set: headers: { 'Content-Type': 'multipart/form-data' }
```

**Warning signs:** Backend logs show `UploadFile.read()` returning `b""`.

### Pitfall 2: Excel Date Serials — openpyxl `data_only=True` Required

**What goes wrong:** Date cells in Excel appear as integers (e.g., `45000`) instead of date strings when `data_only=False`.

**Why it happens:** openpyxl returns formula strings by default unless `data_only=True` is set on `load_workbook`.

**How to avoid:** Always open workbooks with `data_only=True`. Convert date cells explicitly:
```python
from openpyxl.utils.datetime import from_excel
# openpyxl with data_only=True usually returns datetime objects directly
# but check: isinstance(cell_value, int) and convert if needed
```

**Warning signs:** Date fields show 5-digit integers in preview rows.

### Pitfall 3: ILIKE with NULL Fields

**What goes wrong:** `ILIKE '%query%'` on a nullable column returns no rows even when the column is NULL (which is "matches nothing" — correct behavior), but also skips rows where the column is an empty string in PostgreSQL.

**Why it happens:** NULL != '' in PostgreSQL; ILIKE on NULL returns NULL (falsy).

**How to avoid:** Use `COALESCE(column, '')` in ILIKE, or accept that null-valued fields don't appear in text search results (acceptable for SME context).

**Warning signs:** Existing records with empty notes fields disappear from search results.

### Pitfall 4: FastAPI Dynamic Query Params in Auto-CRUD Router

**What goes wrong:** Attempting to add filter params dynamically via `**kwargs` or `request.query_params` bypasses FastAPI's validation/documentation.

**Why it happens:** FastAPI relies on function signature inspection to register query params. Dynamic kwargs are invisible to the framework.

**How to avoid:** For each filterable field type in the entity config, generate explicit `Query()` parameters in the router-building function:
```python
# In build_crud_router, for each numeric field, add:
from fastapi import Query
# Use a closure to capture field names in the generated function
```

Alternatively — and recommended for simplicity — add a single `filters: str = Query(None)` param that accepts a JSON-encoded filter dict, then parse it server-side. This avoids code generation complexity.

**Warning signs:** Filter params appear in requests but are silently ignored; no 422 validation on bad filter values.

### Pitfall 5: CSV Export via Axios — Bearer Auth + File Download

**What goes wrong:** Using `<a href="/api/v1/entities/x/export">` does not include the Bearer token, causing 401.

**Why it happens:** Browser-initiated downloads via anchor tags send cookies but not Authorization headers.

**How to avoid:** Trigger download via Axios (which has the auth interceptor), receive as blob, then trigger download:
```javascript
export const exportEntityCSV = async (name, params = {}) => {
  const resp = await client.get(`/api/v1/entities/${name}/export`, {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}-export-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Warning signs:** Export button triggers 401; file download never starts.

### Pitfall 6: openpyxl Memory with `read_only=False` on Large Files

**What goes wrong:** Opening large Excel files without `read_only=True` loads entire workbook into memory, potentially exceeding server RAM.

**Why it happens:** Default `read_only=False` materializes all cells in memory.

**How to avoid:** Always use `read_only=True` for imports. Only use `read_only=False` if writing (not needed here).

**Warning signs:** Server memory spikes on upload; OOM errors in logs.

### Pitfall 7: Import Commit Re-Validates Without Stored State

**What goes wrong:** The commit endpoint is called directly with the original file and mapping, bypassing the validate step.

**Why it happens:** If validate and commit both accept the raw file + mapping, nothing prevents a client from skipping validate.

**How to avoid:** Two approaches:
1. **Stateless (recommended for simplicity):** Commit endpoint re-runs validation internally and only commits valid rows. No session storage needed. Client sends the mapping + duplicate decisions; server re-validates.
2. **Session-based:** Store validation token in Redis/DB and require it in commit call. Overkill for SME scale.

Use option 1.

### Pitfall 8: shadcn `npx shadcn@latest add` in non-TypeScript project

**What goes wrong:** shadcn CLI may complain about missing tsconfig.json, which previously blocked Phase 3 initialization.

**Why it happens:** shadcn CLI looks for tsconfig.json for alias resolution by default.

**How to avoid:** The project already has `jsconfig.json` from Phase 3 that solved this. The `components.json` is already configured. Adding new components via `npx shadcn@latest add select` should work without re-running init. Verify with one component first before bulk-adding.

**Warning signs:** "No import alias found in tsconfig.json" error — means jsconfig.json may need the `@` alias reconfirmed.

---

## Code Examples

### CSV parsing (stdlib)

```python
# Source: Python stdlib csv module [VERIFIED: tested locally]
import csv, io

def parse_csv(content: bytes, config) -> dict:
    text = content.decode("utf-8-sig")  # utf-8-sig strips BOM if present
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    preview_rows = []
    all_rows = []
    for i, row in enumerate(reader):
        all_rows.append(dict(row))
        if i < 5:
            preview_rows.append(list(row.values()))
    entity_fields = [f.name for f in config.fields]
    return {
        "format": "csv",
        "sheets": None,
        "columns": list(headers),
        "preview_rows": preview_rows,
        "all_rows": all_rows,
        "auto_mapping": auto_map_columns(list(headers), entity_fields),
    }
```

### Pydantic row validation

```python
# Source: build_pydantic_schema in crud_generator.py (extended for validation)
def validate_rows(rows: list[dict], mapping: dict, config: EntityConfig) -> tuple[list, list]:
    """Apply column mapping and validate each row.

    Returns (valid_rows, error_rows) where error_rows include {row_index, errors}.
    """
    Schema = build_pydantic_schema(config, "ImportRow")
    valid, errors = [], []
    for i, raw_row in enumerate(rows):
        mapped = {entity_field: raw_row.get(file_col)
                  for file_col, entity_field in mapping.items()
                  if entity_field}
        try:
            Schema(**mapped)
            valid.append(mapped)
        except Exception as e:
            error_detail = str(e)
            errors.append({"row_index": i + 2, "data": mapped, "error_reason": error_detail})
    return valid, errors
```

### FilterControl — polymorphic filter component

```javascript
// Source: Phase 3 FIELD_COMPONENT_MAP pattern from PATTERNS.md
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function FilterControl({ field, value, onChange }) {
  if (field.type === 'enum') {
    return (
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={`All ${field.name}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All</SelectItem>
          {field.choices?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === 'date') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input type="date" value={value?.from ?? ''} onChange={e => onChange({ ...value, from: e.target.value })} />
        <Input type="date" value={value?.to ?? ''} onChange={e => onChange({ ...value, to: e.target.value })} />
      </div>
    );
  }
  if (field.type === 'int' || field.type === 'decimal') {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Input type="number" placeholder="Min" style={{ width: 80 }} value={value?.min ?? ''} onChange={e => onChange({ ...value, min: e.target.value })} />
        <Input type="number" placeholder="Max" style={{ width: 80 }} value={value?.max ?? ''} onChange={e => onChange({ ...value, max: e.target.value })} />
      </div>
    );
  }
  return null; // text fields: search only, no dedicated filter
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pandas for Excel parsing | openpyxl directly | openpyxl 3.0+ widely adopted | pandas is a 30MB dependency; openpyxl is 1MB and sufficient for SME file sizes |
| `window.location` for auth-gated downloads | Axios blob + `createObjectURL` | Auth-bearer-only APIs became common | Bearer token cannot be sent via anchor href; Axios must handle download |
| CSV export as string concatenation | `csv.DictWriter` + `io.StringIO` | Always | Manual concatenation breaks on values containing commas or quotes |

**Deprecated/outdated:**
- `xlrd` library: Previously used for .xls (old Excel format); only supports `.xls` not `.xlsx` in v2+. Do not use. openpyxl supports `.xlsx` (the standard since Excel 2007).
- `pandas.read_excel()`: Works but adds 30MB+ dependency. openpyxl does the same job for import with no overhead.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SequenceMatcher` similarity threshold of 0.6 gives acceptable auto-mapping quality | Pattern 2 | Users get poor auto-mapping; they still manually correct via dropdowns, so low risk |
| A2 | FastAPI `StreamingResponse` with `csv.writer` generator is memory-efficient for <10K rows | Pattern 3 | Negligible risk at SME scale |
| A3 | `shadcn@latest add` commands work without re-running `init` given existing jsconfig.json | Pitfall 8 | Wave 0 task should verify with one component first |
| A4 | openpyxl `data_only=True` returns Python datetime objects for date cells, not integers | Pitfall 2 | Date import would produce wrong values; Wave 0 test verifies this |
| A5 | Duplicate detection uses the first `required=True` string field as the key field when no explicit key_fields attribute exists on EntityConfig | General | Wrong field used for dedup; low risk — user sees duplicates in preview and resolves manually |
| A6 | `auto_crud=false` entities (student, school) will not need search/filter added to their hand-written routes in Phase 4 — only auto_crud entities need it | Architecture | If students/schools list pages need search/filter, those routes must be extended separately |

---

## Open Questions (RESOLVED)

1. **Where should search/filter params live in auto-CRUD route generation?** (RESOLVED)
   - What we know: `crud_generator.py` uses `build_crud_router()` to generate all list endpoints; FastAPI requires explicit `Query()` params in function signatures.
   - What's unclear: Whether to generate per-field Query params dynamically (complex, brittle) or use a single `filters=` JSON blob (simpler but less RESTful).
   - Recommendation: Use a `filters` query param that accepts a JSON-encoded dict, plus a standalone `q=` text search param. Simple, avoids code-generation complexity.
   - **RESOLVED:** Adopted single `filters: str = Query(None)` JSON blob + `q: str = Query(None)` text search. Implemented in Plan 02 Task 1 (crud_generator.py) and Plan 04 Task 2 (EntityListPage.jsx builds JSON filter params).

2. **Key field for duplicate detection when EntityConfig has no `key_fields` attribute** (RESOLVED)
   - What we know: `EntityConfig` dataclass (yaml_loader.py) has no `key_fields` or `unique_fields` attribute — only `name`, `table`, `fields`, `auto_crud`.
   - What's unclear: Whether to add `key_fields` to EntityConfig/YAML format, or infer from required fields.
   - Recommendation: Add an optional `key_fields: list[str]` to `EntityConfig` and the YAML format (e.g., `key_fields: [email]`). Fall back to first required field if absent. This is a YAML loader extension, not a DB schema change.
   - **RESOLVED:** Adopted recommendation. Plan 01 Task 1 adds `key_fields: list[str] = field(default_factory=list)` to EntityConfig and extends yaml_loader.py to parse it. Fallback to first required string field when key_fields is empty.

3. **HTML export: entity list vs. report/plan pages** (RESOLVED)
   - What we know: D-14 specifies HTML report export for reports/plans. DATA-06 covers this. The UI-SPEC places "Export HTML" on report/plan detail views, not entity list pages.
   - What's unclear: Whether any entity list can be exported as HTML, or only plan/report artifacts.
   - Recommendation: Phase 4 scope is plan/report HTML export only (follows existing `plan_generator.py` pattern). Entity list exports are CSV only (DATA-04, D-11). This is consistent with CONTEXT.md and UI-SPEC.
   - **RESOLVED:** Plan/report HTML export only. Plan 02 Task 2 adds `GET /plan-export/{plan_id}` endpoint returning stored `html_content`. Plan 04 Task 3 adds "Export HTML" button to AcademicPlan page calling `exportPlanHTML(planId)`. Entity lists export CSV only.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| openpyxl | DATA-02 Excel parsing | Yes (env) / No (requirements.txt) | 3.0.9 | Must add to requirements.txt |
| csv (stdlib) | DATA-01 CSV parsing, DATA-04 export | Yes | stdlib | -- |
| difflib (stdlib) | Column auto-mapping | Yes | stdlib | -- |
| FastAPI StreamingResponse | DATA-04 CSV export | Yes | FastAPI 0.111.0 | -- |
| shadcn Select | Column mapping dropdowns, filters | No (not yet added) | -- | Must run `npx shadcn@latest add select` |
| shadcn Table | Data preview, validation table | No (not yet added) | -- | Must run `npx shadcn@latest add table` |
| shadcn Badge | Summary banner counts | No (not yet added) | -- | Must run `npx shadcn@latest add badge` |
| shadcn Progress | Import progress bar | No (not yet added) | -- | Must run `npx shadcn@latest add progress` |
| shadcn Separator | Wizard step dividers | No (not yet added) | -- | Must run `npx shadcn@latest add separator` |
| shadcn DropdownMenu | Export options menu | No (not yet added) | -- | Must run `npx shadcn@latest add dropdown-menu` |
| shadcn Popover | Date range filter | No (not yet added) | -- | Must run `npx shadcn@latest add popover` |
| PostgreSQL 15 | All data operations | Yes | 15+ (Homebrew) | -- |
| lucide-react | Icons | Yes | ^1.11.0 | -- |

**Missing dependencies with no fallback:**
- `openpyxl` in `requirements.txt` — blocks Excel import (Wave 0 task: add to requirements.txt)

**Missing dependencies with fallback via install:**
- All 7 shadcn components: no fallback except building raw Radix UI wrappers; install is the path.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.2.0 (backend) / vitest ^4.1.5 (frontend) |
| Config file | `backend/pytest.ini` / `frontend/vite.config.js` (test block) |
| Quick run command | `cd backend && pytest tests/test_import_export.py -x` |
| Full suite command | `cd backend && pytest && cd ../frontend && npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Parse CSV file, return columns + preview + auto_mapping | unit | `pytest tests/test_import_export.py::test_parse_csv -x` | No Wave 0 |
| DATA-02 | Parse Excel .xlsx, return sheet list; parse selected sheet | unit | `pytest tests/test_import_export.py::test_parse_excel -x` | No Wave 0 |
| DATA-03 | Validate rows: valid count, error count, error_reason per row | unit | `pytest tests/test_import_export.py::test_validate_rows -x` | No Wave 0 |
| DATA-03 | Commit: only valid rows written; duplicates handled per decision | integration | `pytest tests/test_import_export.py::test_import_commit -x` | No Wave 0 |
| DATA-04 | Export CSV returns correct rows with auth | integration | `pytest tests/test_import_export.py::test_export_csv -x` | No Wave 0 |
| DATA-04 | Export CSV respects q= search param | integration | `pytest tests/test_import_export.py::test_export_csv_filtered -x` | No Wave 0 |
| DATA-06 | HTML export returns self-contained HTML file | integration | `pytest tests/test_import_export.py::test_export_html -x` | No Wave 0 |
| DATA-07 | Entity list q= param returns text-matching rows | integration | `pytest tests/test_entities.py::test_entity_list_search -x` | No Wave 0 |
| DATA-08 | Entity list filter params return field-matching rows | integration | `pytest tests/test_entities.py::test_entity_list_filter -x` | No Wave 0 |
| DATA-01-E2E | Upload CSV -> column map -> validate -> confirm -> rows appear | manual | Navigate to /entities/:name/import | -- |

### Sampling Rate

- **Per task commit:** `cd backend && pytest tests/test_import_export.py tests/test_entities.py -x`
- **Per wave merge:** `cd backend && pytest && cd ../frontend && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/test_import_export.py` — covers DATA-01, DATA-02, DATA-03, DATA-04, DATA-06
- [ ] Extend `backend/tests/test_entities.py` — add DATA-07, DATA-08 search/filter tests
- [ ] Add `openpyxl==3.0.9` to `backend/requirements.txt`
- [ ] Run `npx shadcn@latest add select table badge progress separator dropdown-menu popover` and verify components land in `frontend/src/components/ui/`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `Depends(get_current_user)` on ALL import/export endpoints |
| V3 Session Management | no | No session state introduced; import uses stateless two-phase approach |
| V4 Access Control | yes | All new endpoints require authenticated user; no role check needed in Phase 4 (RBAC deferred to Phase 6) |
| V5 Input Validation | yes | Pydantic validates all import row data; column names sanitized before SQL use |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns for Import/Export

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious Excel file (formula injection `=CMD()`) | Tampering | openpyxl `data_only=True` reads cell values only, never evaluates formulas |
| CSV injection (`=SUM(...)` in cell values) | Tampering | Values are stored as strings in PostgreSQL; frontend renders as text; SEC-05 (nh3/html.escape) covers HTML export |
| Path traversal via filename | Elevation of Privilege | Never use the uploaded filename to write to disk; parse from bytes in memory only |
| Oversized file upload (DoS) | DoS | FastAPI `UploadFile` streams by default; add size limit in endpoint (e.g., 10MB max) |
| SQL injection via search param | Tampering | Use SQLAlchemy ORM `.filter()` with parameterized queries; never string-interpolate `q` into SQL |
| HTML export XSS | Tampering | Consistent with existing `plan_generator.py`: use `html.escape()` on all user-provided content (SEC-05, BUG-04 already in codebase) |

---

## Project Constraints (from CLAUDE.md)

- No Docker — local dev only (uvicorn + Homebrew PostgreSQL 15)
- No external services — all logic in-house
- `preferences.md` is canonical for stack decisions
- Full implementations only — no truncated code
- Verification checklist must be completed before marking any task done
- All new backend endpoints require `Depends(get_current_user)` — no public import/export

---

## Sources

### Primary (HIGH confidence)
- Filesystem: `backend/requirements.txt` — confirmed openpyxl NOT listed; all other deps verified
- Filesystem: `frontend/package.json` — confirmed shadcn component gaps; lucide-react, sonner, TanStack Query v5 present
- Filesystem: `frontend/src/components/ui/` — confirmed only 6 components exist; 7 new ones required
- Filesystem: `backend/app/platform/crud_generator.py` — confirmed CRUD router pattern for search/filter extension
- Filesystem: `backend/app/platform/yaml_loader.py` — confirmed EntityConfig dataclass fields (no key_fields yet)
- Filesystem: `backend/app/platform/entity_registry.py` — confirmed registry singleton pattern
- Filesystem: `frontend/src/components/FileUpload/FileUpload.jsx` — confirmed component API for reuse
- Filesystem: `frontend/src/api/entities.js` — confirmed existing API functions to extend
- Runtime: `python3 -c "import openpyxl"` — confirmed openpyxl 3.0.9 available
- Runtime: `python3 -c "import difflib; SequenceMatcher..."` — confirmed difflib and similarity scoring
- Runtime: `python3 -c "import csv; ..."` — confirmed csv stdlib export pattern
- Runtime: `npm view @radix-ui/react-select version` etc. — confirmed Radix component versions

### Secondary (MEDIUM confidence)
- `04-UI-SPEC.md` (Phase 4 UI design contract) — component inventory, interaction contracts, copy
- `03-PATTERNS.md` (Phase 3 pattern map) — TanStack Query v5 mutation/query patterns for reuse

### Tertiary (LOW confidence)
- None — all claims verified against codebase or runtime tools

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against filesystem, requirements.txt, node_modules, runtime
- Architecture: HIGH — derived from existing codebase patterns (crud_generator.py, entity_registry.py, plan_generator.py)
- Pitfalls: MEDIUM — most from training knowledge (known Python/FastAPI/React patterns), some verified (Pitfall 5 Axios download, Pitfall 8 shadcn non-TS)
- New component inventory: HIGH — verified against `frontend/src/components/ui/` directory listing

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable stack; 30-day window)
