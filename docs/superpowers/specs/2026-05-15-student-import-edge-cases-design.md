# Student Data Import — Edge Case Hardening

**Date:** 2026-05-15
**Status:** Approved
**Approach:** Layer into existing parser (Approach A)

## Summary

Harden the existing student CSV/Excel import system (`student_import_service.py`) to handle real-world file variations from HK schools: wrong file types, Chinese headers, non-HKDSE grade formats, encoding issues, duplicate rows, partial data, and corrupted files.

The existing preview/commit flow is preserved. All changes are preprocessing stages that run before the current parse logic.

## Decisions

| Question | Decision |
|----------|----------|
| Chinese headers | Auto-map via lookup table |
| Non-HKDSE grade formats | Best-effort conversion with warnings in preview |
| Duplicate rows in file | Merge all rows (profile from first, grades from all) |
| Encoding detection | Auto-detect with chardet (UTF-8 → chardet sniff → Latin-1) |
| Grade conflicts with DB | Import wins (overwrite existing) |

## Section 1: File Validation Layer

Before any parsing, validate the uploaded file:

- **Magic byte check**: Read first 4-8 bytes. Reject PDF (`%PDF`), PNG (`\x89PNG`), JPEG (`\xFF\xD8`), Word docs, ZIP-that-isn't-xlsx. Return clear error: "This appears to be a PDF file, not a CSV or Excel spreadsheet."
- **Encoding detection**: Use `chardet` library. Try UTF-8 first (fast path), then sniff with chardet if UTF-8 decode fails. Decode file content before passing to CSV/Excel parser.
- **Size guard**: Reject files > 10MB (already exists). Add row count guard: warn at 500+ rows, hard limit at 2000.
- **Empty file check**: Reject if file has 0 data rows after headers.
- **Corrupted Excel**: Wrap openpyxl load in try/except, return "File appears corrupted" instead of a 500.

**New dependency:** `chardet` (pip install chardet)

## Section 2: Header Mapping

After parsing raw rows but before field extraction, normalize all column headers through a mapping layer.

### Chinese Header Lookup

| Chinese | Internal |
|---------|----------|
| 姓名, 名稱, 學生姓名 | name |
| 學號, 考生編號, 准考證號 | candidate_number |
| 班別, 班級 | class_name |
| 年級 | year_of_study |
| 性別 | gender |
| 出生日期 | date_of_birth |
| 中文, 中國語文 | CHLA |
| 英文, 英國語文 | ENGL |
| 數學 | MATH |
| 公民科, 公民與社會發展科, 公社科 | CSD |
| 物理 | PHYS |
| 化學 | CHEM |
| 生物 | BIOL |
| 經濟 | ECON |
| 企會財, 企業會計與財務概論 | BAFS |
| 地理 | GEOG |
| 歷史 | HIST |
| 中史, 中國歷史 | CHIH |
| 中國文學 | CHIL |
| 視覺藝術, 視藝 | VART |
| 音樂 | MUSC |
| 資訊及通訊科技, ICT | ICT |
| 體育 | PE |

### English Full-Name Mapping

| Full Name | Code |
|-----------|------|
| English Language | ENGL |
| Chinese Language | CHLA |
| Mathematics | MATH |
| Citizenship and Social Development | CSD |
| Physics | PHYS |
| Chemistry | CHEM |
| Biology | BIOL |
| Economics | ECON |
| Business, Accounting and Financial Studies | BAFS |
| Geography | GEOG |
| History | HIST |
| Chinese History | CHIH |
| Chinese Literature | CHIL |
| Visual Arts | VART |
| Music | MUSC |
| Information and Communication Technology | ICT |
| Physical Education | PE |

### Normalization Rules

- Strip whitespace, lowercase for comparison
- Unmapped columns: silently ignore but include in preview response as `unmapped_columns` list

## Section 3: Grade Normalization

After header mapping, normalize grade values before validation. Every conversion is flagged in the preview response.

### Conversion Rules

| Input Type | Detection | Mapping |
|------------|-----------|---------|
| HKDSE native (5**, 5*, 5-1, U) | Already valid | Passthrough |
| CSD grades (A, Attained, AD, Attained with Distinction) | String match | A → "A", AD/Attained with Distinction → "AD" |
| Percentage (0-100) | Numeric, > 7 | 80+→5, 70-79→4, 50-69→3, 35-49→2, 20-34→1, <20→U |
| Letter grade (A-F) | Single letter ± modifier | A/A+→5, B/B+→4, C/C+→3, D→2, E→1, F→U |
| GPA (0.0-4.3) | All grades in column ≤4.3 AND at least one contains a decimal point | ≥4.0→5, ≥3.5→4, ≥3.0→3, ≥2.0→2, ≥1.0→1, <1.0→U |
| Numeric string | "5", "4.0", "3.7" | Round to nearest int if 1-5, passthrough if valid |
| Whitespace/case | "5 **", "u" | Strip → "5**", uppercase → "U" |
| Unconvertible | None of the above | Skip cell, add warning |

### Preview Output

Each converted grade shows in preview:
```json
{"grade_conversions": [{"row": 3, "subject": "ENGL", "original": "85", "converted": "5"}]}
```

## Section 4: Row Merging & Duplicate Handling

When the same `candidate_number` appears multiple times in one file:

- **Detection**: After parsing all rows, group by candidate_number.
- **Profile merge**: Take profile fields from the first occurrence. If a later row has a field the first row left blank, fill it in.
- **Grade merge**: Collect grades from all rows. If same subject+sitting+year appears in multiple rows, last row wins. Different sittings/years accumulate.
- **Preview indication**: Merged rows show as single entry with `"merged_from": 3` count.
- **Cross-file duplicates (existing DB students)**: Handled by existing create/update logic. Import wins — overwrites profile fields and upserts grades.

## Section 5: Profile-Only & Partial Data Import

- **Profile-only**: If no subject code columns detected, import proceeds with profile fields only. Preview note: "No grade columns detected. Importing student profiles only."
- **Name-only minimum**: Only `name` is required. Auto-generates candidate_number if missing.
- **Grades-only update**: If file has candidate_number + grade columns but no profile fields, match existing students and update grades without touching profile.
- **Sparse data**: Empty cells silently skipped. Empty profile fields don't overwrite existing data with blanks during update.

## Section 6: Test Data & Test Plan

### Test Fixture Files (`backend/tests/fixtures/`)

| File | Purpose |
|------|---------|
| `valid_basic.csv` | Happy path, 5 students with grades |
| `chinese_headers.csv` | 姓名, 學號, 中文, 英文, 數學 headers |
| `english_fullnames.csv` | "English Language", "Mathematics" headers |
| `percentage_grades.csv` | Grades as 85, 72, 55 |
| `letter_grades.csv` | A, B+, C, D, F grades |
| `mixed_grades.csv` | Mix of HKDSE, percentages, letters |
| `profile_only.csv` | Name, class, gender, no grades |
| `grades_only.csv` | candidate_number + grade columns only |
| `duplicate_rows.csv` | Same student 3x with different sittings |
| `big5_encoded.csv` | Big5-encoded with Chinese names |
| `empty_file.csv` | Headers only, no data rows |
| `blank_rows.csv` | Scattered blank rows, leading blanks |
| `not_a_csv.pdf` | Actual PDF bytes |
| `corrupt.xlsx` | Truncated/invalid Excel |
| `sparse_data.csv` | Most cells empty, name + 1-2 grades |
| `extra_columns.csv` | Unknown columns mixed with valid |

### Test Cases (extend `test_student_import.py`)

- File validation: reject PDF, corrupt Excel, empty file
- Encoding: parse Big5 file correctly
- Header mapping: Chinese headers → correct fields, English full names → correct codes
- Grade conversion: percentage→HKDSE, letter→HKDSE, GPA→HKDSE, mixed
- Row merging: duplicate candidate_number → single merged row with all grades
- Profile-only: no grade columns → profiles imported, no errors
- Grades-only: existing student matched, grades updated
- Sparse data: mostly empty → only filled cells processed
- Row count limit: 2001 rows → rejection
- Unmapped columns: reported in response, not errors
- Grade conversion preview: original→converted pairs in response
- Overwrite: import grade replaces existing DB grade

## Files Modified

| File | Change |
|------|--------|
| `backend/app/services/student_import_service.py` | Add file validation, encoding detection, header mapping, grade normalization, row merging |
| `backend/app/api/v1/routes/student_import.py` | Pass through new preview fields (unmapped_columns, grade_conversions, merged_from) |
| `backend/requirements.txt` | Add `chardet` |
| `backend/tests/test_student_import.py` | Add ~20 new test cases |
| `backend/tests/fixtures/` | 16 test fixture files |
| `data/sample-students.csv` | Update if needed to reflect any format changes |
