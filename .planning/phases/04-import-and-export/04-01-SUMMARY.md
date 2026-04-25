---
phase: 04-import-and-export
plan: 01
subsystem: backend/import
tags: [import, csv, excel, parsing, validation, difflib, openpyxl]
dependency_graph:
  requires: []
  provides: [import_service, key_fields, openpyxl_dep, import_tests]
  affects: [backend/app/platform/yaml_loader.py, backend/app/services/import_service.py]
tech_stack:
  added: [openpyxl==3.0.9]
  patterns: [difflib SequenceMatcher for column auto-mapping, build_pydantic_schema for row validation]
key_files:
  created:
    - backend/app/services/import_service.py
    - backend/tests/test_import_export.py
  modified:
    - backend/requirements.txt
    - backend/app/platform/yaml_loader.py
decisions:
  - "auto_map_columns uses greedy first-best matching: each entity field assigned once to prevent double-assignment"
  - "normalize() is a standalone function so tests can verify it independently and import_service can reuse it internally"
  - "find_duplicates uses raw SQL text query so the service stays decoupled from specific ORM model classes"
  - "openpyxl read_only=True + data_only=True enforced in both parse_excel and parse_excel_sheet (T-04-01 mitigation)"
metrics:
  duration: ~15 minutes
  completed: "2026-04-25T16:29:48Z"
  tasks_completed: 3
  files_changed: 4
---

# Phase 04 Plan 01: Backend Import Service Summary

**One-liner:** CSV/Excel parsing pipeline with difflib auto-mapping, Pydantic row validation, and duplicate detection via EntityConfig.key_fields — no HTTP coupling, pure service layer.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add openpyxl dep and extend EntityConfig with key_fields | 8689417 | requirements.txt, yaml_loader.py |
| 2 | Create import_service.py with CSV/Excel parsing, auto-mapping, validation | dc1ed09 | app/services/import_service.py |
| 3 | Create test_import_export.py with 15 unit tests | 78bfaba | tests/test_import_export.py |

## What Was Built

### import_service.py (309 lines)

8 exported functions covering the full import pipeline:

- `normalize(s)` — lowercase + spaces/hyphens to underscores
- `auto_map_columns(file_columns, entity_fields)` — SequenceMatcher ratio >= 0.6 with greedy deduplication
- `parse_csv(content, config)` — utf-8-sig decode (BOM-safe), DictReader, returns columns/preview/all_rows/auto_mapping
- `parse_excel(content, config)` — sheet name discovery with read_only+data_only for security
- `parse_excel_sheet(content, sheet_name, config)` — full row extraction from named sheet
- `validate_rows(rows, mapping, config)` — Pydantic validation via build_pydantic_schema, error rows with row_index
- `find_duplicates(rows, config, db_session)` — key_fields-based DB lookup, falls back to first required string field
- `generate_error_csv(error_rows, config)` — DictWriter output with error_reason column appended

### EntityConfig.key_fields

Added `key_fields: list[str] = field(default_factory=list)` to EntityConfig dataclass and wired `key_fields=raw.get("key_fields", [])` in `load_entity_yaml()`. Enables per-entity duplicate detection configuration in YAML files.

### test_import_export.py (208 lines, 15 tests)

13 substantive tests + 2 export stubs for Plan 02:
- normalize, auto_map (exact, similar, no-match, no-double-assign)
- parse_csv (basic, BOM, preview limit)
- validate_rows (valid, with errors, row_index value)
- generate_error_csv (with rows, empty)

## Verification

```
pytest tests/test_import_export.py -x -v   → 15 passed
pytest tests/ -x -q                         → 151 passed, 0 regressions
```

Full suite went from 60 (pre-phase-04) to 151 tests, all passing.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Additional Tests Added

Added 6 extra tests beyond the plan's required 9 (plan required 9, delivered 13 substantive + 2 stubs = 15 total):
- `test_auto_map_no_double_assignment` — validates greedy deduplication property
- `test_parse_csv_preview_limit` — validates the 5-row preview cap
- `test_validate_rows_error_has_row_index` — validates row_index == 2 for first data row
- `test_generate_error_csv_empty` — validates header-only output for empty error list
- `test_export_csv_stub` and `test_export_html_stub` — stubs for Plan 02

## Known Stubs

- `test_export_csv_stub` and `test_export_html_stub` in test_import_export.py are intentional pass-only stubs. Plan 02 will implement and fill these in (DATA-04, DATA-06).
- `find_duplicates` is implemented but not tested here (requires a DB session with a real table). Plan 02 integration tests will cover it when the import endpoints are wired.

## Threat Surface Scan

No new network endpoints introduced. All threat mitigations from plan's threat_model applied:
- T-04-01: openpyxl `read_only=True, data_only=True` enforced in parse_excel and parse_excel_sheet
- T-04-02: `utf-8-sig` decode + `str(value) if value is not None else ""` normalization throughout
- T-04-03: `read_only=True` prevents full workbook memory load; endpoint-level size limits deferred to Plan 02
- T-04-04: Accepted (validation errors show field names — user uploaded the data)

## Self-Check: PASSED
