# Student Import Edge Case Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the student CSV/Excel import to handle real-world file variations from HK schools — wrong file types, Chinese headers, non-HKDSE grade formats, encoding issues, duplicate-row merging, and partial data.

**Architecture:** Layer new preprocessing stages into the existing `student_import_service.py` before the current parse logic. The preview/commit flow and route layer stay unchanged. New stages: file validation → encoding detection → header mapping → grade normalization → row merging.

**Tech Stack:** Python, chardet (new dep), openpyxl (existing), pytest

**Spec:** `docs/superpowers/specs/2026-05-15-student-import-edge-cases-design.md`

---

## File Structure

| File | Role |
|------|------|
| `backend/app/services/student_import_service.py` | Modify: add file validation, encoding detection, header mapping, grade normalization, row merging |
| `backend/app/api/v1/routes/student_import.py` | Modify: pass through new preview fields (unmapped_columns, grade_conversions, merge info) |
| `backend/requirements.txt` | Modify: add chardet |
| `backend/tests/test_student_import.py` | Modify: add ~20 new test cases |
| `backend/tests/fixtures/` | Create: 16 test fixture files |

---

### Task 1: Add chardet dependency and create test fixtures directory

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/fixtures/` (directory)
- Create: 16 fixture files

- [ ] **Step 1: Add chardet to requirements.txt**

Add this line after `openpyxl==3.0.9` in `backend/requirements.txt`:

```
chardet>=5.0
```

- [ ] **Step 2: Install chardet**

Run: `pip install chardet`
Expected: Successfully installed chardet

- [ ] **Step 3: Create fixtures directory and test files**

```bash
mkdir -p backend/tests/fixtures
```

Create `backend/tests/fixtures/valid_basic.csv`:
```csv
candidate_number,name,class_name,ENGL,MATH,CHLA,CSD
T001,Chan Ka Wai,5A,5*,4,3,A
T002,Wong Mei Yi,5A,5,5,5*,A
T003,Lee Tsz Him,5B,4,4,3,A
T004,Cheung Wing Sze,5B,5*,5,4,A
T005,Ho Siu Ming,5C,3,3,2,A
```

Create `backend/tests/fixtures/chinese_headers.csv`:
```csv
學號,姓名,班別,中文,英文,數學,公民科
T001,陳嘉偉,5A,3,5*,4,A
T002,黃美儀,5A,5*,5,5,A
```

Create `backend/tests/fixtures/english_fullnames.csv`:
```csv
candidate_number,name,English Language,Mathematics,Chinese Language,Physics
T001,Alice Wong,5*,4,3,5
T002,Bob Lee,4,3,5,4
```

Create `backend/tests/fixtures/percentage_grades.csv`:
```csv
candidate_number,name,ENGL,MATH,CHLA
T001,Chan Ka Wai,85,72,55
T002,Wong Mei Yi,92,60,78
```

Create `backend/tests/fixtures/letter_grades.csv`:
```csv
candidate_number,name,ENGL,MATH,CHLA
T001,Chan Ka Wai,A,B+,C
T002,Wong Mei Yi,A+,B,D
```

Create `backend/tests/fixtures/mixed_grades.csv`:
```csv
candidate_number,name,ENGL,MATH,CHLA,PHYS
T001,Chan Ka Wai,5*,85,B,4
T002,Wong Mei Yi,A,4,72,5**
```

Create `backend/tests/fixtures/profile_only.csv`:
```csv
candidate_number,name,class_name,gender,year_of_study
T001,Chan Ka Wai,5A,Male,5
T002,Wong Mei Yi,5A,Female,5
```

Create `backend/tests/fixtures/grades_only.csv`:
```csv
candidate_number,ENGL,MATH,CHLA
T001,5*,4,3
T002,5,5,5*
```

Create `backend/tests/fixtures/duplicate_rows.csv`:
```csv
candidate_number,name,class_name,ENGL,MATH,sitting,year_of_exam
T001,Chan Ka Wai,5A,4,3,MOCK,2025
T001,Chan Ka Wai,,5*,4,OFFICIAL,2026
T001,Chan Ka Wai,,,5**,TRIAL,2025
```

Create `backend/tests/fixtures/big5_encoded.csv` (Python script to generate):
```python
import os
content = "candidate_number,姓名,英文,數學\nT001,陳嘉偉,5*,4\nT002,黃美儀,5,5\n"
path = os.path.join(os.path.dirname(__file__), "fixtures", "big5_encoded.csv")
with open(path, "wb") as f:
    f.write(content.encode("big5"))
```

Create `backend/tests/fixtures/empty_file.csv`:
```csv
candidate_number,name,ENGL,MATH
```

Create `backend/tests/fixtures/blank_rows.csv`:
```csv

candidate_number,name,ENGL,MATH

T001,Chan Ka Wai,5*,4

T002,Wong Mei Yi,5,5

```

Create `backend/tests/fixtures/not_a_csv.pdf` (4 bytes):
```python
with open("backend/tests/fixtures/not_a_csv.pdf", "wb") as f:
    f.write(b"%PDF-1.4 fake pdf content")
```

Create `backend/tests/fixtures/corrupt.xlsx`:
```python
with open("backend/tests/fixtures/corrupt.xlsx", "wb") as f:
    f.write(b"PK\x03\x04this is not a real xlsx")
```

Create `backend/tests/fixtures/sparse_data.csv`:
```csv
candidate_number,name,class_name,ENGL,MATH,CHLA,PHYS,CHEM
T001,Chan Ka Wai,,5*,,,,
T002,Wong Mei Yi,5A,,,3,,
T003,Lee Tsz Him,,,,,4,
```

Create `backend/tests/fixtures/extra_columns.csv`:
```csv
candidate_number,name,ENGL,favorite_color,shoe_size,MATH,hobby
T001,Chan Ka Wai,5*,blue,42,4,basketball
T002,Wong Mei Yi,5,red,37,5,piano
```

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/tests/fixtures/
git commit -m "chore: add chardet dep and import test fixtures"
```

---

### Task 2: File validation layer

**Files:**
- Modify: `backend/app/services/student_import_service.py`
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing tests for file validation**

Add to `backend/tests/test_student_import.py`:

```python
from app.services.student_import_service import validate_file, ImportError as ImportFileError

class TestFileValidation:
    """Tests for file validation layer."""

    def test_pdf_rejected(self):
        """PDF file is rejected with clear error."""
        content = b"%PDF-1.4 fake pdf content here"
        with pytest.raises(ImportFileError, match="PDF"):
            validate_file(content, "report.pdf")

    def test_png_rejected(self):
        """PNG file is rejected."""
        content = b"\x89PNG\r\n\x1a\n fake png"
        with pytest.raises(ImportFileError, match="image"):
            validate_file(content, "photo.png")

    def test_jpeg_rejected(self):
        """JPEG file is rejected."""
        content = b"\xff\xd8\xff\xe0 fake jpeg"
        with pytest.raises(ImportFileError, match="image"):
            validate_file(content, "photo.jpg")

    def test_empty_csv_rejected(self):
        """CSV with only headers and no data rows is rejected."""
        content = b"candidate_number,name,ENGL\n"
        with pytest.raises(ImportFileError, match="no data rows"):
            validate_file(content, "empty.csv")

    def test_valid_csv_accepted(self):
        """Valid CSV passes validation."""
        content = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["A001", "Alice", "5"]],
        )
        result = validate_file(content, "students.csv")
        assert result is True

    def test_row_limit_exceeded(self):
        """Files with >2000 data rows are rejected."""
        rows = [[f"X{i:04}", f"Student {i}", "4"] for i in range(2001)]
        content = _make_csv(["candidate_number", "name", "ENGL"], rows)
        with pytest.raises(ImportFileError, match="2000"):
            validate_file(content, "big.csv")

    def test_corrupt_xlsx_rejected(self):
        """Corrupted Excel file is rejected."""
        content = b"PK\x03\x04this is not a real xlsx"
        with pytest.raises(ImportFileError, match="corrupted"):
            validate_file(content, "bad.xlsx")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestFileValidation -v`
Expected: FAIL — `validate_file` and `ImportFileError` don't exist yet

- [ ] **Step 3: Implement file validation**

Add to `backend/app/services/student_import_service.py` after the existing constants section (~line 62):

```python
# ---------------------------------------------------------------------------
# File validation
# ---------------------------------------------------------------------------

class ImportFileError(Exception):
    """Raised when an uploaded file fails validation."""
    pass


# Magic bytes for common non-CSV/Excel file types
_MAGIC_BYTES = [
    (b"%PDF", "This appears to be a PDF file, not a CSV or Excel spreadsheet."),
    (b"\x89PNG", "This appears to be an image file (PNG), not a CSV or Excel spreadsheet."),
    (b"\xff\xd8\xff", "This appears to be an image file (JPEG), not a CSV or Excel spreadsheet."),
    (b"GIF8", "This appears to be an image file (GIF), not a CSV or Excel spreadsheet."),
    (b"\xd0\xcf\x11\xe0", "This appears to be a Microsoft Office document (.doc/.xls), not a CSV. Please save as .xlsx or .csv first."),
]

MAX_IMPORT_ROWS = 2000


def validate_file(content: bytes, filename: str) -> bool:
    """Validate an uploaded file before parsing.

    Raises ImportFileError with a user-friendly message if the file is invalid.
    Returns True if the file passes all checks.
    """
    # 1. Magic byte check
    for magic, message in _MAGIC_BYTES:
        if content[:len(magic)] == magic:
            raise ImportFileError(message)

    # 2. Excel file — check openpyxl can open it
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xlsx", "xls"):
        if content[:2] == b"PK":
            try:
                import openpyxl
                openpyxl.load_workbook(io.BytesIO(content), read_only=True).close()
            except Exception:
                raise ImportFileError(
                    "This Excel file appears to be corrupted and cannot be read. "
                    "Please try saving it again or export as CSV."
                )
        else:
            raise ImportFileError(
                "This file has an Excel extension but is not a valid Excel file. "
                "Please save as .xlsx or .csv."
            )
        return True

    # 3. CSV: check for data rows
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1", errors="replace")

    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    if len(lines) < 2:
        raise ImportFileError("File contains headers but no data rows.")

    # 4. Row count limit
    if len(lines) - 1 > MAX_IMPORT_ROWS:
        raise ImportFileError(
            f"File contains {len(lines) - 1} rows, which exceeds the maximum of {MAX_IMPORT_ROWS}. "
            "Please split the file into smaller batches."
        )

    return True
```

Also add `io` to the existing imports if not already there (it is — line 14).

- [ ] **Step 4: Update imports in test file**

Update the import block at the top of `tests/test_student_import.py`:

```python
from app.services.student_import_service import (
    parse_student_csv,
    validate_file,
    ImportFileError,
    VALID_GRADES,
)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestFileValidation -v`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: add file validation layer for student import"
```

---

### Task 3: Encoding detection with chardet

**Files:**
- Modify: `backend/app/services/student_import_service.py`
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing test for encoding detection**

Add to `backend/tests/test_student_import.py`:

```python
from app.services.student_import_service import detect_encoding

class TestEncodingDetection:
    """Tests for encoding detection."""

    def test_utf8_detected(self):
        """UTF-8 content is detected correctly."""
        content = "candidate_number,name\nT001,Alice Wong\n".encode("utf-8")
        assert detect_encoding(content) == "utf-8"

    def test_utf8_bom_detected(self):
        """UTF-8 with BOM is detected correctly."""
        content = b"\xef\xbb\xbf" + "candidate_number,name\nT001,Alice\n".encode("utf-8")
        enc = detect_encoding(content)
        assert enc.lower().replace("-", "") in ("utf8", "utf8sig")

    def test_big5_detected(self):
        """Big5-encoded file with Chinese is detected."""
        content = "candidate_number,姓名\nT001,陳嘉偉\n".encode("big5")
        enc = detect_encoding(content)
        # chardet may return 'Big5' or 'big5' or similar
        assert "big5" in enc.lower() or "ascii" not in enc.lower()

    def test_decode_with_detected_encoding(self):
        """Big5 content can be decoded after detection."""
        original = "candidate_number,姓名,英文\nT001,陳嘉偉,5*\nT002,黃美儀,5\n"
        content = original.encode("big5")
        enc = detect_encoding(content)
        decoded = content.decode(enc)
        assert "陳嘉偉" in decoded
        assert "黃美儀" in decoded
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestEncodingDetection -v`
Expected: FAIL — `detect_encoding` doesn't exist

- [ ] **Step 3: Implement encoding detection**

Add to `backend/app/services/student_import_service.py` after the `validate_file` function:

```python
# ---------------------------------------------------------------------------
# Encoding detection
# ---------------------------------------------------------------------------

def detect_encoding(content: bytes) -> str:
    """Detect the encoding of file content.

    Tries UTF-8 first (fast path), then uses chardet for detection.
    Falls back to latin-1 if detection fails.
    """
    # Fast path: try UTF-8 (covers UTF-8-BOM too)
    if content[:3] == b"\xef\xbb\xbf":
        return "utf-8-sig"
    try:
        content.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    # Use chardet for non-UTF-8 files
    try:
        import chardet
        result = chardet.detect(content)
        if result and result.get("encoding") and result.get("confidence", 0) > 0.5:
            return result["encoding"]
    except Exception:
        pass

    return "latin-1"
```

- [ ] **Step 4: Integrate into parse_student_csv**

Replace the encoding block in `parse_student_csv` (lines 92-96):

Old:
```python
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
```

New:
```python
    encoding = detect_encoding(content)
    text = content.decode(encoding, errors="replace")
    # Strip BOM if present after decoding
    if text and text[0] == "\ufeff":
        text = text[1:]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestEncodingDetection tests/test_student_import.py::TestParseStudentCsv -v`
Expected: All PASS (new encoding tests + existing tests still pass)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: add chardet encoding detection for student import"
```

---

### Task 4: Header mapping (Chinese + English full names)

**Files:**
- Modify: `backend/app/services/student_import_service.py`
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing tests for header mapping**

Add to `backend/tests/test_student_import.py`:

```python
from app.services.student_import_service import map_headers

class TestHeaderMapping:
    """Tests for header mapping."""

    def test_chinese_profile_headers(self):
        """Chinese profile headers are mapped to internal names."""
        headers = ["學號", "姓名", "班別", "性別"]
        mapped = map_headers(headers)
        assert mapped == {"學號": "candidate_number", "姓名": "name", "班別": "class_name", "性別": "gender"}

    def test_chinese_subject_headers(self):
        """Chinese subject headers are mapped to HKDSE codes."""
        headers = ["中文", "英文", "數學", "物理", "公民科"]
        mapped = map_headers(headers)
        assert mapped == {"中文": "CHLA", "英文": "ENGL", "數學": "MATH", "物理": "PHYS", "公民科": "CSD"}

    def test_english_fullname_headers(self):
        """English full subject names are mapped to codes."""
        headers = ["English Language", "Mathematics", "Chinese Language", "Physics"]
        mapped = map_headers(headers)
        assert mapped == {
            "English Language": "ENGL",
            "Mathematics": "MATH",
            "Chinese Language": "CHLA",
            "Physics": "PHYS",
        }

    def test_case_insensitive(self):
        """Header matching is case-insensitive."""
        headers = ["ENGLISH LANGUAGE", "mathematics", " Chinese Language "]
        mapped = map_headers(headers)
        assert mapped["ENGLISH LANGUAGE"] == "ENGL"
        assert mapped["mathematics"] == "MATH"
        assert mapped[" Chinese Language "] == "CHLA"

    def test_already_valid_codes_passthrough(self):
        """Headers that are already valid codes are not remapped."""
        headers = ["candidate_number", "name", "ENGL", "MATH"]
        mapped = map_headers(headers)
        # Already-valid headers should NOT appear in the mapping (no remap needed)
        assert "ENGL" not in mapped
        assert "MATH" not in mapped

    def test_unmapped_headers_excluded(self):
        """Unknown headers are not included in mapping."""
        headers = ["name", "favorite_color", "shoe_size"]
        mapped = map_headers(headers)
        assert "favorite_color" not in mapped
        assert "shoe_size" not in mapped

    def test_chinese_csv_parses_correctly(self):
        """Full parse of a CSV with Chinese headers produces correct results."""
        csv_content = "學號,姓名,班別,中文,英文,數學,公民科\nT001,陳嘉偉,5A,3,5*,4,A\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["name"] == "陳嘉偉"
        assert row["candidate_number"] == "T001"
        assert row["grades"]["CHLA"] == "3"
        assert row["grades"]["ENGL"] == "5*"
        assert row["grades"]["MATH"] == "4"
        assert row["profile"]["class_name"] == "5A"

    def test_english_fullname_csv_parses_correctly(self):
        """Full parse of CSV with English full-name headers."""
        csv_content = "candidate_number,name,English Language,Mathematics,Physics\nT001,Alice,5*,4,5\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5*"
        assert row["grades"]["MATH"] == "4"
        assert row["grades"]["PHYS"] == "5"

    def test_unmapped_columns_reported(self):
        """Unmapped columns are reported in parse result."""
        csv_content = "candidate_number,name,ENGL,favorite_color,shoe_size\nT001,Alice,5,blue,42\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert "favorite_color" in result.get("unmapped_columns", [])
        assert "shoe_size" in result.get("unmapped_columns", [])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestHeaderMapping -v`
Expected: FAIL — `map_headers` doesn't exist

- [ ] **Step 3: Implement header mapping**

Add to `backend/app/services/student_import_service.py` after the encoding detection section:

```python
# ---------------------------------------------------------------------------
# Header mapping: Chinese + English full names → internal field/code
# ---------------------------------------------------------------------------

# Chinese profile field names → internal field names
_ZH_PROFILE_MAP: dict[str, str] = {
    "姓名": "name", "名稱": "name", "學生姓名": "name",
    "學號": "candidate_number", "考生編號": "candidate_number", "准考證號": "candidate_number",
    "班別": "class_name", "班級": "class_name",
    "年級": "year_of_study",
    "性別": "gender",
    "出生日期": "date_of_birth",
}

# Chinese subject names → HKDSE codes
_ZH_SUBJECT_MAP: dict[str, str] = {
    "中文": "CHLA", "中國語文": "CHLA",
    "英文": "ENGL", "英國語文": "ENGL",
    "數學": "MATH",
    "公民科": "CSD", "公民與社會發展科": "CSD", "公社科": "CSD",
    "物理": "PHYS",
    "化學": "CHEM",
    "生物": "BIOL",
    "經濟": "ECON",
    "企會財": "BAFS", "企業會計與財務概論": "BAFS",
    "地理": "GEOG",
    "歷史": "HIST",
    "中史": "CHIH", "中國歷史": "CHIH",
    "中國文學": "CHIL",
    "視覺藝術": "VART", "視藝": "VART",
    "音樂": "MUSC",
    "資訊及通訊科技": "ICT",
    "體育": "PE",
}

# English full subject names → HKDSE codes
_EN_SUBJECT_MAP: dict[str, str] = {
    "english language": "ENGL",
    "chinese language": "CHLA",
    "mathematics": "MATH",
    "citizenship and social development": "CSD",
    "physics": "PHYS",
    "chemistry": "CHEM",
    "biology": "BIOL",
    "economics": "ECON",
    "business, accounting and financial studies": "BAFS",
    "geography": "GEOG",
    "history": "HIST",
    "chinese history": "CHIH",
    "chinese literature": "CHIL",
    "visual arts": "VART",
    "music": "MUSC",
    "information and communication technology": "ICT",
    "physical education": "PE",
    "tourism and hospitality studies": "TOUR",
    "design and applied technology": "DAT",
    "health management and social care": "HMSC",
    "technology and living": "TL",
    "ethics and religious studies": "ERS",
    "combined science": "CSCI",
    "integrated science": "ISCI",
    "french": "FREN",
    "german": "GERM",
    "japanese": "JAPA",
    "spanish": "SPAN",
    "putonghua": "PTH",
}

# Known internal field/code names that need no remapping
_KNOWN_INTERNAL = (
    {"name", "candidate_number", "sitting", "year_of_exam", "cohort"}
    | PROFILE_FIELDS
    | HKDSE_SUBJECT_CODES
)


def map_headers(headers: list[str]) -> dict[str, str]:
    """Map non-standard column headers to internal field names or subject codes.

    Args:
        headers: Raw header strings from the CSV/Excel file.

    Returns:
        Dict mapping original header → internal name, ONLY for headers that need remapping.
        Headers already in internal format are excluded.
    """
    mapping: dict[str, str] = {}

    for h in headers:
        stripped = h.strip()
        # Already a known internal name/code — skip
        if stripped in _KNOWN_INTERNAL or stripped.upper() in HKDSE_SUBJECT_CODES:
            continue

        normalized = stripped.strip().lower()

        # Check Chinese profile map
        if stripped in _ZH_PROFILE_MAP:
            mapping[h] = _ZH_PROFILE_MAP[stripped]
            continue

        # Check Chinese subject map
        if stripped in _ZH_SUBJECT_MAP:
            mapping[h] = _ZH_SUBJECT_MAP[stripped]
            continue

        # Check English full-name map (case-insensitive)
        if normalized in _EN_SUBJECT_MAP:
            mapping[h] = _EN_SUBJECT_MAP[normalized]
            continue

    return mapping
```

- [ ] **Step 4: Integrate header mapping into parse_student_csv**

In `parse_student_csv`, after `reader = csv.DictReader(...)` and `headers = list(reader.fieldnames or [])`, add header remapping:

```python
    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])

    # --- Header mapping ---
    header_mapping = map_headers(headers)
    # Build set of all recognized column names (after mapping)
    recognized_columns = set()
    for h in headers:
        mapped = header_mapping.get(h, h.strip())
        if mapped in _KNOWN_INTERNAL or mapped.upper() in HKDSE_SUBJECT_CODES:
            recognized_columns.add(h)
    unmapped_columns = [h.strip() for h in headers if h not in recognized_columns and h.strip()]
```

Then when detecting subject columns, use mapped names:

Replace the subject column detection block:
```python
    # Detect which columns are subject codes
    subject_columns: list[str] = []
    for h in headers:
        h_upper = h.strip().upper()
        if h_upper in HKDSE_SUBJECT_CODES:
            subject_columns.append(h.strip())
```

With:
```python
    # Detect which columns are subject codes (after mapping)
    subject_columns: list[str] = []
    for h in headers:
        mapped = header_mapping.get(h, h.strip())
        if mapped.upper() in HKDSE_SUBJECT_CODES:
            subject_columns.append(h.strip())
```

In the row processing loop, when reading cell values, apply the header mapping. Replace:
```python
        cleaned: dict[str, str] = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            val = str(v) if v is not None else ""
            cleaned[k.strip()] = _strip_control_chars(val.strip())
```

With:
```python
        cleaned: dict[str, str] = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            val = str(v) if v is not None else ""
            mapped_key = header_mapping.get(k, k.strip())
            cleaned[mapped_key] = _strip_control_chars(val.strip())
```

When reading grade values, use the mapped column name:
Replace:
```python
        for col in subject_columns:
            grade_val = cleaned.get(col, "").strip()
            ...
                grades[col.upper()] = grade_val
```

With:
```python
        for col in subject_columns:
            mapped_col = header_mapping.get(col, col.strip())
            grade_val = cleaned.get(mapped_col, "").strip()
            if not grade_val:
                continue
            if grade_val in VALID_GRADES:
                grades[mapped_col.upper()] = grade_val
            else:
                warnings.append(f"Invalid grade '{grade_val}' for {mapped_col}; skipped")
```

Add `unmapped_columns` to the return dict:

```python
    return {
        "rows": rows,
        "subject_columns": subject_columns,
        "unmapped_columns": unmapped_columns,
        "summary": {
            "total": len(rows),
            "valid": valid_count,
            "error": error_count,
        },
    }
```

- [ ] **Step 5: Run all tests**

Run: `cd backend && python -m pytest tests/test_student_import.py -v`
Expected: All existing + new header mapping tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: add Chinese and English header mapping for student import"
```

---

### Task 5: Grade normalization (percentage, letter, GPA → HKDSE)

**Files:**
- Modify: `backend/app/services/student_import_service.py`
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing tests for grade normalization**

Add to `backend/tests/test_student_import.py`:

```python
from app.services.student_import_service import normalize_grade

class TestGradeNormalization:
    """Tests for grade normalization."""

    def test_hkdse_passthrough(self):
        """Valid HKDSE grades pass through unchanged."""
        assert normalize_grade("5**") == ("5**", None)
        assert normalize_grade("5*") == ("5*", None)
        assert normalize_grade("5") == ("5", None)
        assert normalize_grade("4") == ("4", None)
        assert normalize_grade("U") == ("U", None)
        assert normalize_grade("A") == ("A", None)
        assert normalize_grade("AD") == ("AD", None)

    def test_percentage_to_hkdse(self):
        """Percentages are converted to HKDSE grades."""
        assert normalize_grade("85")[0] == "5"
        assert normalize_grade("92")[0] == "5"
        assert normalize_grade("72")[0] == "4"
        assert normalize_grade("55")[0] == "3"
        assert normalize_grade("40")[0] == "2"
        assert normalize_grade("25")[0] == "1"
        assert normalize_grade("15")[0] == "U"

    def test_percentage_has_conversion_note(self):
        """Percentage conversion includes original value."""
        grade, note = normalize_grade("85")
        assert grade == "5"
        assert note is not None
        assert "85" in note

    def test_letter_to_hkdse(self):
        """Letter grades are converted to HKDSE."""
        assert normalize_grade("A+")[0] == "5"
        assert normalize_grade("B+")[0] == "4"
        assert normalize_grade("B")[0] == "4"
        assert normalize_grade("C")[0] == "3"
        assert normalize_grade("C+")[0] == "3"
        assert normalize_grade("D")[0] == "2"
        assert normalize_grade("E")[0] == "1"
        assert normalize_grade("F")[0] == "U"

    def test_whitespace_cleanup(self):
        """Whitespace in grades is cleaned up."""
        assert normalize_grade("5 **")[0] == "5**"
        assert normalize_grade(" 4 ")[0] == "4"
        assert normalize_grade(" u ")[0] == "U"

    def test_case_insensitive(self):
        """Grade matching is case-insensitive."""
        assert normalize_grade("u")[0] == "U"
        assert normalize_grade("ad")[0] == "AD"
        assert normalize_grade("a")[0] == "A"

    def test_csd_attained(self):
        """CSD-specific values are mapped."""
        assert normalize_grade("Attained")[0] == "A"
        assert normalize_grade("Attained with Distinction")[0] == "AD"
        assert normalize_grade("attained")[0] == "A"

    def test_numeric_string(self):
        """Numeric strings 1-5 are treated as HKDSE levels."""
        assert normalize_grade("1")[0] == "1"
        assert normalize_grade("3")[0] == "3"
        assert normalize_grade("4.0")[0] == "4"
        assert normalize_grade("3.7")[0] == "4"

    def test_unconvertible_returns_none(self):
        """Unconvertible values return (None, error_message)."""
        grade, note = normalize_grade("XYZ")
        assert grade is None
        assert note is not None
        assert "XYZ" in note

    def test_empty_returns_none(self):
        """Empty string returns (None, None) — not an error, just empty."""
        assert normalize_grade("") == (None, None)
        assert normalize_grade("  ") == (None, None)

    def test_percentage_csv_parses_correctly(self):
        """Full parse of CSV with percentage grades."""
        csv_content = "candidate_number,name,ENGL,MATH,CHLA\nT001,Alice,85,72,55\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5"
        assert row["grades"]["MATH"] == "4"
        assert row["grades"]["CHLA"] == "3"
        assert len(result.get("grade_conversions", [])) == 3

    def test_letter_csv_parses_correctly(self):
        """Full parse of CSV with letter grades."""
        csv_content = "candidate_number,name,ENGL,MATH\nT001,Alice,A,B+\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5"
        assert row["grades"]["MATH"] == "4"

    def test_mixed_csv_parses_correctly(self):
        """Full parse of CSV with mixed grade formats."""
        csv_content = "candidate_number,name,ENGL,MATH,CHLA,PHYS\nT001,Alice,5*,85,B,4\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5*"
        assert row["grades"]["MATH"] == "5"
        assert row["grades"]["CHLA"] == "4"
        assert row["grades"]["PHYS"] == "4"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestGradeNormalization -v`
Expected: FAIL — `normalize_grade` doesn't exist

- [ ] **Step 3: Implement grade normalization**

Add to `backend/app/services/student_import_service.py` after the header mapping section:

```python
# ---------------------------------------------------------------------------
# Grade normalization
# ---------------------------------------------------------------------------

_LETTER_TO_HKDSE: dict[str, str] = {
    "a+": "5", "a": "5", "a-": "5",
    "b+": "4", "b": "4", "b-": "3",
    "c+": "3", "c": "3", "c-": "2",
    "d+": "2", "d": "2", "d-": "1",
    "e": "1",
    "f": "U",
}

_CSD_MAP: dict[str, str] = {
    "attained": "A",
    "attained with distinction": "AD",
    "att": "A",
}


def normalize_grade(raw: str) -> tuple[str | None, str | None]:
    """Normalize a grade value to HKDSE format.

    Returns:
        (normalized_grade, conversion_note)
        - If already valid: (grade, None)
        - If converted: (grade, "original → converted")
        - If empty: (None, None)
        - If unconvertible: (None, error_message)
    """
    val = raw.strip()
    if not val:
        return (None, None)

    # Whitespace cleanup: "5 **" → "5**"
    collapsed = val.replace(" ", "")

    # Case-insensitive check against valid HKDSE grades
    upper = collapsed.upper()
    if upper in VALID_GRADES:
        return (upper, None)

    # CSD string values
    lower = val.lower().strip()
    if lower in _CSD_MAP:
        mapped = _CSD_MAP[lower]
        return (mapped, f"{val} → {mapped}")

    # Try numeric parse
    try:
        num = float(collapsed)

        # Integer 1-5: treat as HKDSE level directly
        if num == int(num) and 1 <= int(num) <= 5:
            return (str(int(num)), None)

        # Percentage range (8-100): convert to HKDSE
        if num > 7:
            if num >= 80:
                grade = "5"
            elif num >= 70:
                grade = "4"
            elif num >= 50:
                grade = "3"
            elif num >= 35:
                grade = "2"
            elif num >= 20:
                grade = "1"
            else:
                grade = "U"
            return (grade, f"{val} → {grade}")

        # Decimal 1.0-7.0: round to nearest int if in HKDSE range
        if 0.5 <= num <= 5.5:
            rounded = str(round(num))
            if rounded in VALID_GRADES:
                return (rounded, f"{val} → {rounded}" if rounded != collapsed else None)

        # Unrecognised numeric
        return (None, f"Could not convert grade '{val}'")

    except ValueError:
        pass

    # Letter grade
    if lower in _LETTER_TO_HKDSE:
        grade = _LETTER_TO_HKDSE[lower]
        return (grade, f"{val} → {grade}")

    return (None, f"Could not convert grade '{val}'")
```

- [ ] **Step 4: Integrate grade normalization into parse_student_csv**

In the grade extraction loop inside `parse_student_csv`, replace the simple validation with normalization. Also track conversions.

Add a `grade_conversions` list before the row loop:
```python
    grade_conversions: list[dict] = []
```

Replace the grade extraction block:
```python
        for col in subject_columns:
            mapped_col = header_mapping.get(col, col.strip())
            grade_val = cleaned.get(mapped_col, "").strip()
            if not grade_val:
                continue
            if grade_val in VALID_GRADES:
                grades[mapped_col.upper()] = grade_val
            else:
                warnings.append(f"Invalid grade '{grade_val}' for {mapped_col}; skipped")
```

With:
```python
        for col in subject_columns:
            mapped_col = header_mapping.get(col, col.strip())
            grade_val = cleaned.get(mapped_col, "").strip()
            if not grade_val:
                continue
            normalized, note = normalize_grade(grade_val)
            if normalized is not None:
                grades[mapped_col.upper()] = normalized
                if note:
                    grade_conversions.append({
                        "row": row_idx,
                        "subject": mapped_col.upper(),
                        "original": grade_val,
                        "converted": normalized,
                    })
            else:
                if note:
                    warnings.append(f"{note} for {mapped_col}; skipped")
```

Add `grade_conversions` to the return dict:
```python
    return {
        "rows": rows,
        "subject_columns": subject_columns,
        "unmapped_columns": unmapped_columns,
        "grade_conversions": grade_conversions,
        "summary": {
            "total": len(rows),
            "valid": valid_count,
            "error": error_count,
        },
    }
```

- [ ] **Step 5: Run all tests**

Run: `cd backend && python -m pytest tests/test_student_import.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: add grade normalization (percentage, letter, GPA → HKDSE)"
```

---

### Task 6: Row merging for duplicate candidate numbers

**Files:**
- Modify: `backend/app/services/student_import_service.py`
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing tests for row merging**

Add to `backend/tests/test_student_import.py`:

```python
from app.services.student_import_service import merge_duplicate_rows

class TestRowMerging:
    """Tests for duplicate row merging."""

    def test_no_duplicates_unchanged(self):
        """Rows with unique candidate_numbers pass through unchanged."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5"}, "profile": {"class_name": "5A"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A002", "name": "Bob", "status": "valid", "grades": {"ENGL": "4"}, "profile": {"class_name": "5B"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result) == 2

    def test_profile_from_first_row(self):
        """Profile fields come from first occurrence."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {"class_name": "5A"}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice Updated", "status": "valid", "grades": {}, "profile": {"class_name": "5B"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result) == 1
        assert result[0]["name"] == "Alice"
        assert result[0]["profile"]["class_name"] == "5A"

    def test_profile_fills_blanks_from_later_rows(self):
        """Blank profile fields in first row are filled from later rows."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {"class_name": "5A", "gender": "F"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert result[0]["profile"]["class_name"] == "5A"
        assert result[0]["profile"]["gender"] == "F"

    def test_grades_merged_across_sittings(self):
        """Grades from different sittings are all collected."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4", "MATH": "3"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5*", "MATH": "4"}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        merged = result[0]
        # Should have grade entries for both sittings
        assert len(merged["grade_entries"]) == 4  # 2 subjects × 2 sittings

    def test_same_sitting_last_row_wins(self):
        """Same subject+sitting+year: last row's grade wins."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        merged = result[0]
        engl_entries = [e for e in merged["grade_entries"] if e["code"] == "ENGL"]
        assert len(engl_entries) == 1
        assert engl_entries[0]["grade"] == "5"

    def test_merged_from_count(self):
        """Merged rows show merged_from count."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"MATH": "3"}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"PHYS": "5"}, "profile": {}, "sitting": "TRIAL", "year_of_exam": 2025, "row_number": 4, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert result[0]["merged_from"] == 3

    def test_error_rows_excluded_from_merge(self):
        """Rows with status=error are not merged, kept as-is."""
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "", "status": "error", "grades": {}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": ["name is required"]},
        ]
        result = merge_duplicate_rows(rows)
        # The valid row stays, the error row stays separately
        assert len(result) == 2

    def test_duplicate_csv_parses_with_merge(self):
        """Full parse of CSV with duplicate rows produces merged result."""
        csv_content = (
            "candidate_number,name,class_name,ENGL,MATH,sitting,year_of_exam\n"
            "T001,Chan Ka Wai,5A,4,3,MOCK,2025\n"
            "T001,Chan Ka Wai,,5*,4,OFFICIAL,2026\n"
        )
        result = parse_student_csv(csv_content.encode("utf-8"))
        # Should be 1 merged row, not 2
        valid_rows = [r for r in result["rows"] if r["status"] != "error"]
        assert len(valid_rows) == 1
        assert valid_rows[0]["merged_from"] == 2
        assert valid_rows[0]["profile"]["class_name"] == "5A"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestRowMerging -v`
Expected: FAIL — `merge_duplicate_rows` doesn't exist

- [ ] **Step 3: Implement row merging**

Add to `backend/app/services/student_import_service.py`:

```python
# ---------------------------------------------------------------------------
# Row merging for duplicate candidate numbers
# ---------------------------------------------------------------------------

def merge_duplicate_rows(rows: list[dict]) -> list[dict]:
    """Merge rows that share the same candidate_number.

    Profile fields: first occurrence wins, blanks filled from later rows.
    Grades: collected across all rows. Same subject+sitting+year = last row wins.

    Error rows are never merged — kept as-is.

    Returns a new list with merged rows.
    """
    from collections import OrderedDict

    groups: OrderedDict[str, list[dict]] = OrderedDict()
    error_rows: list[dict] = []

    for row in rows:
        if row["status"] == "error":
            error_rows.append(row)
            continue
        cand = row["candidate_number"]
        if cand not in groups:
            groups[cand] = []
        groups[cand].append(row)

    merged: list[dict] = []
    for cand, group in groups.items():
        if len(group) == 1:
            # Single row — convert grades to grade_entries format
            r = group[0]
            r["grade_entries"] = [
                {"code": code, "grade": grade, "sitting": r["sitting"], "year_of_exam": r["year_of_exam"]}
                for code, grade in r.get("grades", {}).items()
            ]
            r["merged_from"] = 1
            merged.append(r)
            continue

        # Multiple rows — merge
        first = group[0]
        result_row = {
            "row_number": first["row_number"],
            "candidate_number": cand,
            "name": first["name"],
            "status": first["status"],
            "profile": dict(first.get("profile", {})),
            "warnings": [],
            "errors": [],
            "merged_from": len(group),
        }

        # Fill blank profile fields from later rows
        for later in group[1:]:
            for key, val in later.get("profile", {}).items():
                if val and key not in result_row["profile"]:
                    result_row["profile"][key] = val

        # Collect all grades keyed by (code, sitting, year) — last wins
        grade_map: dict[tuple, dict] = {}
        for r in group:
            sitting = r["sitting"]
            year = r["year_of_exam"]
            for code, grade in r.get("grades", {}).items():
                grade_map[(code, sitting, year)] = {
                    "code": code, "grade": grade, "sitting": sitting, "year_of_exam": year,
                }
            result_row["warnings"].extend(r.get("warnings", []))

        result_row["grade_entries"] = list(grade_map.values())
        # Keep a flat grades dict for backward compatibility (latest sitting)
        result_row["grades"] = {e["code"]: e["grade"] for e in result_row["grade_entries"]}
        result_row["sitting"] = group[-1]["sitting"]
        result_row["year_of_exam"] = group[-1]["year_of_exam"]

        merged.append(result_row)

    return merged + error_rows
```

- [ ] **Step 4: Integrate into parse_student_csv**

In `parse_student_csv`, remove the duplicate-rejection logic (lines 154-170) that currently errors on duplicates. Replace:

```python
        # Duplicate check within this CSV
        if cand in seen_candidates:
            errors.append(f"Duplicate candidate_number '{cand}' in CSV")
            rows.append({...})
            continue
        seen_candidates.add(cand)
```

With nothing — just remove the block entirely (and the `seen_candidates` set declaration on line 115).

Then at the end of `parse_student_csv`, before the return, add merging:

```python
    # Merge duplicate candidate_numbers
    rows = merge_duplicate_rows(rows)

    # Recalculate summary after merge
    valid_count = sum(1 for r in rows if r["status"] != "error")
    error_count = sum(1 for r in rows if r["status"] == "error")
```

- [ ] **Step 5: Update commit_import to handle grade_entries**

In `commit_import`, update the grade processing loop to use `grade_entries` when available. Replace:

```python
            sitting = row["sitting"]
            year_of_exam = row["year_of_exam"]

            for code, grade_val in row.get("grades", {}).items():
```

With:

```python
            # Use grade_entries if available (from merged rows), else flat grades
            grade_entries = row.get("grade_entries")
            if grade_entries is None:
                sitting = row["sitting"]
                year_of_exam = row["year_of_exam"]
                grade_entries = [
                    {"code": code, "grade": grade, "sitting": sitting, "year_of_exam": year_of_exam}
                    for code, grade in row.get("grades", {}).items()
                ]

            for entry in grade_entries:
                code = entry["code"]
                grade_val = entry["grade"]
                sitting = entry["sitting"]
                year_of_exam = entry["year_of_exam"]
```

And update the upsert block to use per-entry sitting/year_of_exam (the variables are already set in the loop above).

- [ ] **Step 6: Run all tests**

Run: `cd backend && python -m pytest tests/test_student_import.py -v`
Expected: All tests PASS. Note: the old `test_duplicate_candidate_number_rejected` test needs updating — duplicates are now merged, not rejected.

Update the old test:
```python
    def test_duplicate_candidate_number_merged(self):
        """Duplicate candidate_number in same CSV is merged, not rejected."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [
                ["DUP01", "First Student", "4"],
                ["DUP01", "Second Student", "3"],
            ],
        )
        result = parse_student_csv(csv_bytes)
        valid_rows = [r for r in result["rows"] if r["status"] != "error"]
        assert len(valid_rows) == 1
        assert valid_rows[0]["merged_from"] == 2
        assert valid_rows[0]["name"] == "First Student"  # first row wins
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: merge duplicate rows in student import instead of rejecting"
```

---

### Task 7: Profile-only and partial data support

**Files:**
- Modify: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write tests for profile-only and sparse data**

Add to `backend/tests/test_student_import.py`:

```python
class TestPartialDataImport:
    """Tests for profile-only, grades-only, and sparse data."""

    def test_profile_only_csv(self):
        """CSV with no grade columns imports profiles without error."""
        csv_content = "candidate_number,name,class_name,gender,year_of_study\nT001,Alice,5A,F,5\nT002,Bob,5B,M,5\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["subject_columns"] == []
        assert result["rows"][0]["grades"] == {}
        assert result["rows"][0]["profile"]["class_name"] == "5A"

    def test_name_only_minimum(self):
        """CSV with only name column is valid."""
        csv_content = "name\nAlice Wong\nBob Lee\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["rows"][0]["name"] == "Alice Wong"
        assert result["rows"][0]["candidate_number"].startswith("AUTO-")

    def test_grades_only_csv(self):
        """CSV with candidate_number + grades but no profile fields."""
        csv_content = "candidate_number,ENGL,MATH,CHLA\nT001,5*,4,3\nT002,5,5,5*\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        # name is required — these should be errors
        assert result["summary"]["error"] == 2

    def test_grades_only_with_name(self):
        """CSV with name + candidate_number + grades but no profile."""
        csv_content = "candidate_number,name,ENGL,MATH,CHLA\nT001,Alice,5*,4,3\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 1
        assert result["rows"][0]["profile"] == {}  # no profile fields
        assert result["rows"][0]["grades"] == {"ENGL": "5*", "MATH": "4", "CHLA": "3"}

    def test_sparse_data_csv(self):
        """CSV with mostly empty cells — only filled cells processed."""
        csv_content = "candidate_number,name,class_name,ENGL,MATH,CHLA,PHYS,CHEM\nT001,Alice,,5*,,,,\nT002,Bob,5A,,,3,,\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["rows"][0]["grades"] == {"ENGL": "5*"}
        assert result["rows"][0]["profile"] == {}  # empty class_name not stored
        assert result["rows"][1]["grades"] == {"CHLA": "3"}
        assert result["rows"][1]["profile"]["class_name"] == "5A"

    def test_blank_rows_skipped(self):
        """Blank rows in CSV are silently skipped."""
        csv_content = "\ncandidate_number,name,ENGL\n\nT001,Alice,5\n\nT002,Bob,4\n\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        valid_rows = [r for r in result["rows"] if r["status"] != "error"]
        assert len(valid_rows) == 2

    def test_extra_columns_reported(self):
        """Unknown columns are listed in unmapped_columns."""
        csv_content = "candidate_number,name,ENGL,favorite_color,shoe_size\nT001,Alice,5,blue,42\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert "favorite_color" in result["unmapped_columns"]
        assert "shoe_size" in result["unmapped_columns"]
        assert result["summary"]["valid"] == 1
```

- [ ] **Step 2: Run tests**

Run: `cd backend && python -m pytest tests/test_student_import.py::TestPartialDataImport -v`
Expected: Most should PASS already (the implementation from Tasks 2-6 handles these cases). Fix any failures.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_student_import.py
git commit -m "test: add partial data and edge case import tests"
```

---

### Task 8: Wire file validation into route layer and pass new fields

**Files:**
- Modify: `backend/app/api/v1/routes/student_import.py`

- [ ] **Step 1: Update preview endpoint to use file validation and pass new fields**

Update `backend/app/api/v1/routes/student_import.py`:

```python
from app.services.student_import_service import (
    parse_student_csv,
    validate_file,
    ImportFileError,
    validate_rows,
    commit_import,
)


async def _read_and_validate_file(file: UploadFile) -> bytes:
    """Read uploaded file bytes with size, emptiness, and format checks."""
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)} MB",
        )

    # File validation (magic bytes, corruption, row count)
    try:
        validate_file(content, file.filename or "upload.csv")
    except ImportFileError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return content
```

Update the preview response to include new fields:

```python
    return {
        "rows": validated,
        "subject_columns": parsed["subject_columns"],
        "unmapped_columns": parsed.get("unmapped_columns", []),
        "grade_conversions": parsed.get("grade_conversions", []),
        "summary": summary,
    }
```

- [ ] **Step 2: Verify existing endpoints still work**

Run:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test with the sample CSV
curl -s -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data/sample-students.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Total: {d[\"summary\"][\"total\"]}')
print(f'Create: {d[\"summary\"][\"create\"]}')
print(f'Unmapped: {d.get(\"unmapped_columns\", [])}')
print(f'Conversions: {len(d.get(\"grade_conversions\", []))}')
"
```

Expected: Preview returns successfully with correct counts

- [ ] **Step 3: Test file rejection**

```bash
# Test PDF rejection
echo "%PDF-1.4 fake" > /tmp/fake.csv
curl -s -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/fake.csv" | python3 -m json.tool
```

Expected: 400 error with "PDF" in the detail message

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/student_import.py
git commit -m "feat: wire file validation and new preview fields into import routes"
```

---

### Task 9: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all import tests**

Run: `cd backend && python -m pytest tests/test_student_import.py -v`
Expected: All tests PASS (should be ~35+ tests)

- [ ] **Step 2: Run existing test suite**

Run: `cd backend && python -m pytest tests/ -v --timeout=30`
Expected: All existing tests still PASS (no regressions)

- [ ] **Step 3: Manual API test with Chinese CSV**

```bash
# Create a Chinese-header CSV
cat > /tmp/chinese-test.csv << 'EOF'
學號,姓名,班別,中文,英文,數學,公民科
TEST-ZH-001,陳嘉偉,5A,4,5*,5**,A
TEST-ZH-002,黃美儀,5A,5*,5,4,A
EOF

curl -s -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/chinese-test.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Summary: {d[\"summary\"]}')
for r in d['rows']:
    if r['status'] != 'error':
        print(f'  {r[\"name\"]} grades={r[\"grades\"]}')
"
```

Expected: Names parsed correctly, grades mapped to CHLA/ENGL/MATH/CSD codes

- [ ] **Step 4: Manual API test with percentage grades**

```bash
cat > /tmp/pct-test.csv << 'EOF'
candidate_number,name,ENGL,MATH,CHLA
TEST-PCT-001,Alice,85,72,55
TEST-PCT-002,Bob,92,60,40
EOF

curl -s -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/pct-test.csv" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for r in d['rows']:
    if r['status'] != 'error':
        print(f'  {r[\"name\"]} grades={r[\"grades\"]}')
print(f'Conversions: {d.get(\"grade_conversions\", [])}')
"
```

Expected: 85→5, 72→4, 55→3, 92→5, 60→3, 40→2 with conversion notes

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify full import edge case suite passes"
```
