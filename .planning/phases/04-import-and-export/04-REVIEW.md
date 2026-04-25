---
phase: 04-import-and-export
reviewed: 2026-04-25T12:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - backend/app/api/v1/routes/entities.py
  - backend/app/platform/crud_generator.py
  - backend/app/platform/yaml_loader.py
  - backend/app/services/import_service.py
  - backend/tests/test_entities.py
  - backend/tests/test_import_export.py
  - frontend/src/api/entities.js
  - frontend/src/components/ActionBar/ActionBar.jsx
  - frontend/src/components/ColumnMapper/ColumnMapper.jsx
  - frontend/src/components/FilterControl/FilterControl.jsx
  - frontend/src/components/ImportWizard/ImportWizard.jsx
  - frontend/src/components/SearchFilterBar/SearchFilterBar.jsx
  - frontend/src/components/ValidationSummary/ValidationSummary.jsx
  - frontend/src/pages/AcademicPlan/AcademicPlan.jsx
  - frontend/src/pages/EntityListPage/EntityListPage.jsx
  - frontend/src/pages/ImportWizardPage/ImportWizardPage.jsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-25T12:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The import/export pipeline introduces CSV/Excel parsing, column auto-mapping, validation, duplicate detection, and export functionality. The architecture is well-structured with clear separation between the service layer and API routes. Security measures (auth on all endpoints, file size limits, `read_only=True` for openpyxl, BOM stripping) are solid.

However, two critical bugs were found: (1) the parse endpoints strip `all_rows` from the response, making the entire import validation flow non-functional since the frontend has no row data to send for validation, and (2) the `find_duplicates` function constructs SQL with unparameterized table and column names, creating a SQL injection vector via entity config. Four warnings address data loss risks in the commit flow and API design issues.

## Critical Issues

### CR-01: Import validation flow broken -- `all_rows` never returned to frontend

**File:** `backend/app/api/v1/routes/entities.py:181-187`
**Issue:** Both the `/import/parse` and `/import/parse-sheet` endpoints compute `all_rows` but only return `total_rows` (the count). The frontend `ImportWizard.jsx:148` sends `parseResult?.all_rows ?? []` to the validate endpoint, but `parseResult.all_rows` is always `undefined` because it was never included in the API response. This means the validate step always validates zero rows, and the entire import pipeline silently produces empty results.
**Fix:**
```python
# In both import_parse and import_parse_sheet, include all_rows in the response:
all_rows = result.get("all_rows", [])
return {
    "columns": result["columns"],
    "preview_rows": result["preview_rows"],
    "total_rows": len(all_rows),
    "all_rows": all_rows,  # <-- ADD THIS LINE
    "auto_mapping": result.get("auto_mapping", {}),
}
```

### CR-02: SQL injection via unparameterized table and column names in `find_duplicates`

**File:** `backend/app/services/import_service.py:271-273`
**Issue:** The `find_duplicates` function constructs a SQL query using f-string interpolation for both the table name (`config.table`) and column name (`key_field`). While these values come from YAML config files (developer-controlled), SQL identifiers cannot be parameterized via bind parameters, and this pattern is fragile: if a YAML config file is ever loaded from an untrusted source (e.g., user-uploaded config), or if a `key_fields` entry contains special characters, this becomes a SQL injection vulnerability.
```python
text(f"SELECT id FROM {config.table} WHERE {key_field} = :val LIMIT 1")
```
**Fix:** Validate table and column names against a strict allowlist pattern before interpolation:
```python
import re

def _safe_identifier(name: str) -> str:
    """Validate that a SQL identifier contains only safe characters."""
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")
    return name

# Then in find_duplicates:
safe_table = _safe_identifier(config.table)
safe_field = _safe_identifier(key_field)
result = db_session.execute(
    text(f"SELECT id FROM {safe_table} WHERE {safe_field} = :val LIMIT 1"),
    {"val": key_value},
).fetchone()
```

## Warnings

### WR-01: Import commit does not pass duplicate decisions from the UI

**File:** `frontend/src/components/ImportWizard/ImportWizard.jsx:157-160`
**Issue:** The `commitMutation` always sends `duplicate_decisions: {}`, ignoring the duplicate resolution choices the user makes in `ValidationSummary`. The `ValidationSummary` component tracks `rowDuplicateChoices` and `globalDuplicateChoice` state internally but never exposes them to the parent `ImportWizard`. This means duplicate rows will always be treated as "new" (the backend default), potentially creating unwanted duplicates.
**Fix:** Add an `onConfirm` callback in `ValidationSummary` that passes the resolved duplicate decisions back to `ImportWizard`:
```jsx
// ValidationSummary.jsx: pass decisions to onConfirm
<Button onClick={() => onConfirm(buildDuplicateDecisions())} ...>

// ImportWizard.jsx: accept and forward decisions
const commitMutation = useMutation({
  mutationFn: (decisions) =>
    importCommit(entityName, {
      valid_rows: validationResult?.valid_rows ?? [],
      mapping,
      duplicate_decisions: decisions ?? {},
    }),
  ...
});
```

### WR-02: Error rows passed via GET query string may exceed URL length limits

**File:** `backend/app/api/v1/routes/entities.py:330-358` and `frontend/src/api/entities.js:96-107`
**Issue:** The `/export/errors` endpoint receives the full error rows array as a JSON-encoded query parameter. For large imports with many errors, this can easily exceed browser URL length limits (typically 2KB-8KB depending on browser). The endpoint should accept error rows via POST body instead.
**Fix:** Change the endpoint from GET to POST and accept error rows in the request body:
```python
@router.post("/{name}/export/errors")
def export_error_csv(
    name: str,
    body: dict,  # { "error_rows": [...] }
    current_user: User = Depends(get_current_user),
):
    rows = body.get("error_rows", [])
    ...
```

### WR-03: Missing `entityName` input validation in frontend import API functions

**File:** `frontend/src/api/entities.js:44-65`
**Issue:** The import API functions (`importParse`, `importParseSheet`, `importValidate`, `importCommit`) do not validate the `entityName` parameter before interpolating it into URL paths. The CRUD functions (lines 17-40) correctly validate table names via `validateTableName()`, but the import functions skip this check. A malicious or malformed entity name could cause unexpected API calls.
**Fix:** Add validation to each import function:
```javascript
export const importParse = (entityName, file) => {
  validateTableName(entityName);
  // ... rest of function
};
```

### WR-04: `ilike` text search allows SQL wildcard injection

**File:** `backend/app/api/v1/routes/entities.py:394` and `backend/app/platform/crud_generator.py:79`
**Issue:** The `q` search parameter is interpolated directly into an ILIKE pattern via `f"%{q}%"`. While the ORM parameterizes the value (preventing SQL injection), the `%` and `_` characters in the user input are treated as SQL wildcards. A user searching for `%` or `_` would match all rows or get unexpected results. This is a minor functional issue rather than a security vulnerability.
**Fix:** Escape ILIKE special characters before building the pattern:
```python
def escape_ilike(q: str) -> str:
    return q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

# Then: .ilike(f"%{escape_ilike(q)}%")
```

## Info

### IN-01: Import placement after function definition creates confusing module structure

**File:** `backend/app/api/v1/routes/entities.py:54-61`
**Issue:** The `from app.services.import_service import ...` statement appears at line 54, after the `_resolve_model` function definition at line 36. This breaks the standard convention of placing all top-level imports at the top of the file, making the module harder to scan.
**Fix:** Move the import statement to the top of the file with the other imports (after line 30).

### IN-02: Unused `Separator` import in ColumnMapper

**File:** `frontend/src/components/ColumnMapper/ColumnMapper.jsx:9`
**Issue:** The `Separator` component is imported from `../ui/separator` and used on line 162. This is actually used -- disregard if confirmed.

### IN-03: StepIndicator numbering is misleading when sheetSelect is hidden

**File:** `frontend/src/components/ImportWizard/ImportWizard.jsx:19-24`
**Issue:** The `STEPS` array assigns `number: 2` to `sheetSelect` and `number: 3` to `columnMapping`. When `sheetSelect` is filtered out of the visible steps (line 74), the step numbers shown to the user jump from 1 to 3 to 4. The step circles display the `number` property, which creates a confusing UX with a missing "Step 2".
**Fix:** Compute display numbers dynamically based on the filtered visible steps rather than using the static `number` property:
```jsx
const visibleSteps = STEPS.filter((s) => s.key !== 'sheetSelect');
// In the map, use idx + 1 instead of step.number:
<div style={stepCircleStyle(isActive, isComplete)}>{idx + 1}</div>
```

---

_Reviewed: 2026-04-25T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
