# Phase 4: Import and Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 04-import-and-export
**Areas discussed:** Column mapping UX, Validation & error flow, Search & filter controls, Export triggers & scope

---

## Column Mapping UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-map + override | System auto-matches columns by header name similarity, user reviews and adjusts via dropdowns | ✓ |
| Manual dropdown only | User manually selects the target field for each column from a dropdown | |
| Drag-and-drop | User drags file columns onto entity fields visually | |

**User's choice:** Auto-map + override
**Notes:** Recommended as fastest for well-formatted files

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show sample rows | Display first 3-5 rows under each column during mapping | ✓ |
| Column headers only | Just show column names from the file | |

**User's choice:** Show sample rows
**Notes:** Helps catch off-by-one or encoding issues

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sheet picker before mapping | After upload, show dropdown/list of sheets, user picks one | ✓ |
| Import all sheets | Each sheet maps to a separate entity import | |
| First sheet only | Always import the first sheet | |

**User's choice:** Sheet picker before mapping

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show as 'skipped' with option to map | Unmapped columns in separate section, user can still assign | ✓ |
| Silently ignore | Extra columns dropped without mention | |
| Warn and block | Warning for each unmapped column, require acknowledgment | |

**User's choice:** Show as 'skipped' with option to map

---

## Validation & Error Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + row-level detail | Banner with counts, table highlighting error rows with field and reason | ✓ |
| Summary only | Aggregate counts and error types only | |
| Full table with inline markers | Entire dataset with red highlighting on error cells | |

**User's choice:** Summary + row-level detail

---

| Option | Description | Selected |
|--------|-------------|----------|
| Import valid + download errors | Approve importing valid rows, failed rows downloadable as CSV with error_reason column | ✓ |
| All or nothing | All rows pass or nothing imports | |
| Let user choose per batch | Three-button choice after summary | |

**User's choice:** Import valid + download errors

---

| Option | Description | Selected |
|--------|-------------|----------|
| Flag duplicates by key fields | Detect existing records by key fields, show as warnings, user chooses: skip/overwrite/import as new | ✓ |
| No duplicate checking | Import all rows as new records | |
| You decide | Claude picks based on entity schema | |

**User's choice:** Flag duplicates by key fields

---

## Search & Filter Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent bar above table | Search box + filter dropdowns always visible above entity list | ✓ |
| Collapsible filter panel | 'Filters' button expands a panel above the table | |
| Sidebar filters | Filter controls in a left sidebar | |

**User's choice:** Persistent bar above table

---

| Option | Description | Selected |
|--------|-------------|----------|
| As-you-type with debounce | Results filter live with 300ms debounce | ✓ |
| Submit on Enter | User types and presses Enter to search | |
| You decide | Claude picks based on dataset sizes | |

**User's choice:** As-you-type with debounce

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from field type | Enum→dropdown, date→date range, numeric→range inputs. Driven by YAML schema | ✓ |
| Manual filter config | Developer specifies filterable fields in YAML | |
| You decide | Claude determines best approach | |

**User's choice:** Auto from field type

---

## Export Triggers & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Export filtered rows | Export what user sees, plus 'Export all' option available | ✓ |
| Always export all | Complete dataset regardless of filters | |
| You decide | Claude picks most intuitive approach | |

**User's choice:** Export filtered rows

---

| Option | Description | Selected |
|--------|-------------|----------|
| Action bar above table | Import/Export buttons alongside each other, always visible | ✓ |
| Dropdown menu | '...' or 'Actions' dropdown with all options | |
| You decide | Claude determines based on layout | |

**User's choice:** Action bar above table

---

| Option | Description | Selected |
|--------|-------------|----------|
| Defer PDF to v2, HTML only | HTML export covers need, users print-to-PDF from browser | ✓ |
| Include PDF export | Server-side PDF generation | |
| Client-side PDF only | JS library (html2pdf, jsPDF) | |

**User's choice:** Defer PDF to v2

---

| Option | Description | Selected |
|--------|-------------|----------|
| Self-contained HTML | All styles and scripts embedded inline | ✓ |
| External stylesheet reference | Links to hosted CSS file | |

**User's choice:** Self-contained HTML

---

## Claude's Discretion

- Backend library choice for CSV/Excel parsing
- Auto-mapping algorithm for column name similarity
- Exact debounce timing and search implementation
- Validation rule ordering and error message formatting
- Action bar layout and button styling
- Duplicate key field determination per entity

## Deferred Ideas

- PDF export (DATA-05) — deferred to v2
