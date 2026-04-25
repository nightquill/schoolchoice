---
status: partial
phase: 04-import-and-export
source: [04-VERIFICATION.md]
started: 2026-04-25T17:50:00Z
updated: 2026-04-25T17:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Import Wizard End-to-End
expected: Upload CSV, complete full wizard flow in browser — file upload, column mapping, validation review, import confirmation
result: [pending]

### 2. Search Debounce
expected: Type in search bar, verify 300ms debounce timing, empty state when no matches
result: [pending]

### 3. Schema-Driven Filters
expected: Polymorphic filter controls render correctly for enum/date/numeric field types
result: [pending]

### 4. CSV Export
expected: Blob downloads with correct content, filename pattern entity-export-YYYY-MM-DD.csv
result: [pending]

### 5. HTML Export
expected: Downloaded HTML renders correctly in browser with inline styling
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
