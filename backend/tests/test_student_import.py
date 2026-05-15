"""
tests/test_student_import.py

Tests for the student CSV import service: parsing, validation, grade extraction.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

from datetime import datetime

import pytest

from app.services.student_import_service import (
    parse_student_csv,
    validate_file,
    ImportFileError,
    detect_encoding,
    map_headers,
    normalize_grade,
    merge_duplicate_rows,
    VALID_GRADES,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_csv(headers: list[str], rows: list[list[str]]) -> bytes:
    """Build CSV bytes from headers and rows."""
    lines = [",".join(headers)]
    for row in rows:
        lines.append(",".join(row))
    return "\n".join(lines).encode("utf-8")


# ---------------------------------------------------------------------------
# Tests: parse_student_csv
# ---------------------------------------------------------------------------

class TestParseStudentCsv:
    """Tests for parse_student_csv."""

    def test_basic_parsing(self):
        """Columns detected, grades extracted, row parsed correctly."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL", "MATH", "CHLA"],
            [["A001", "Alice Wong", "5*", "4", "3"]],
        )
        result = parse_student_csv(csv_bytes)

        assert result["subject_columns"] == ["ENGL", "MATH", "CHLA"]
        assert result["summary"]["total"] == 1
        assert result["summary"]["valid"] == 1
        assert result["summary"]["error"] == 0

        row = result["rows"][0]
        assert row["candidate_number"] == "A001"
        assert row["name"] == "Alice Wong"
        assert row["grades"] == {"ENGL": "5*", "MATH": "4", "CHLA": "3"}
        assert row["status"] == "valid"

    def test_missing_name_rejected(self):
        """Rows without a name get status=error."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["B001", "", "4"]],
        )
        result = parse_student_csv(csv_bytes)

        assert result["summary"]["error"] == 1
        row = result["rows"][0]
        assert row["status"] == "error"
        assert any("name is required" in e for e in row["errors"])

    def test_empty_candidate_number_gets_auto_prefix(self):
        """Empty candidate_number gets AUTO-<uuid> prefix."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["", "Bob Lee", "3"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["candidate_number"].startswith("AUTO-")
        assert len(row["candidate_number"]) == 13  # AUTO- + 8 hex chars
        assert row["status"] == "valid"
        assert any("auto-generated" in w.lower() for w in row["warnings"])

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

    def test_invalid_grade_skipped_with_warning(self):
        """Invalid grades are skipped and a warning is added."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL", "MATH"],
            [["C001", "Carol Chen", "5**", "X"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["grades"] == {"ENGL": "5**"}
        assert "MATH" not in row["grades"]
        assert any("Could not convert" in w and "MATH" in w for w in row["warnings"])

    def test_unknown_column_ignored(self):
        """Columns that are not subject codes or known fields are ignored."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "FAVORITE_COLOR", "ENGL"],
            [["D001", "Dan Li", "blue", "4"]],
        )
        result = parse_student_csv(csv_bytes)

        assert "FAVORITE_COLOR" not in result["subject_columns"]
        row = result["rows"][0]
        assert row["grades"] == {"ENGL": "4"}
        assert row["status"] == "valid"

    def test_default_sitting_official(self):
        """Default sitting is OFFICIAL when not specified."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["E001", "Eve Ng", "3"]],
        )
        result = parse_student_csv(csv_bytes)

        assert result["rows"][0]["sitting"] == "OFFICIAL"

    def test_default_year_current(self):
        """Default year_of_exam is the current year."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["F001", "Fiona Chan", "2"]],
        )
        result = parse_student_csv(csv_bytes)

        assert result["rows"][0]["year_of_exam"] == datetime.now().year

    def test_invalid_sitting_defaults_with_warning(self):
        """Invalid sitting value defaults to OFFICIAL with a warning."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "sitting", "ENGL"],
            [["G001", "George Ho", "MIDTERM", "4"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["sitting"] == "OFFICIAL"
        assert any("Invalid sitting" in w for w in row["warnings"])

    def test_candidate_number_sanitised(self):
        """Special characters stripped from candidate_number."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["A@#001!!", "Hana Lam", "5"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["candidate_number"] == "A001"

    def test_utf8_bom_handled(self):
        """UTF-8 BOM is handled correctly."""
        bom = b"\xef\xbb\xbf"
        csv_content = bom + _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["BOM01", "BOM Test", "4"]],
        )
        result = parse_student_csv(csv_content)

        assert result["summary"]["valid"] == 1
        row = result["rows"][0]
        assert row["candidate_number"] == "BOM01"
        assert row["name"] == "BOM Test"

    def test_profile_fields_extracted(self):
        """Profile fields (class_name, gender, etc.) are extracted."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "class_name", "gender", "target_region", "ENGL"],
            [["P001", "Patty Wu", "5A", "F", "international", "5"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["profile"]["class_name"] == "5A"
        assert row["profile"]["gender"] == "F"
        assert row["profile"]["target_region"] == "international"

    def test_multiple_valid_rows(self):
        """Multiple rows are parsed correctly."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL", "MATH"],
            [
                ["M001", "Student A", "5", "4"],
                ["M002", "Student B", "3", "2"],
                ["M003", "Student C", "5**", "5*"],
            ],
        )
        result = parse_student_csv(csv_bytes)

        assert result["summary"]["total"] == 3
        assert result["summary"]["valid"] == 3

    def test_all_valid_grades_accepted(self):
        """All valid grade values are accepted."""
        for grade in VALID_GRADES:
            csv_bytes = _make_csv(
                ["candidate_number", "name", "ENGL"],
                [[f"V{grade}", f"Grade {grade}", grade]],
            )
            result = parse_student_csv(csv_bytes)
            row = result["rows"][0]
            assert row["grades"].get("ENGL") == grade, f"Grade {grade} should be valid"

    def test_control_chars_stripped(self):
        """Control characters are removed from cell values."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["X001", "Test\x00Name\x01", "4"]],
        )
        result = parse_student_csv(csv_bytes)

        row = result["rows"][0]
        assert row["name"] == "TestName"

    def test_valid_sitting_values(self):
        """MOCK, TRIAL, OFFICIAL are all accepted as sitting values."""
        for sitting in ["MOCK", "TRIAL", "OFFICIAL"]:
            csv_bytes = _make_csv(
                ["candidate_number", "name", "sitting", "ENGL"],
                [[f"S-{sitting}", f"{sitting} Student", sitting, "3"]],
            )
            result = parse_student_csv(csv_bytes)
            assert result["rows"][0]["sitting"] == sitting

    def test_year_of_exam_parsed(self):
        """Explicit year_of_exam is parsed from CSV."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "year_of_exam", "ENGL"],
            [["Y001", "Year Student", "2025", "4"]],
        )
        result = parse_student_csv(csv_bytes)
        assert result["rows"][0]["year_of_exam"] == 2025


# ---------------------------------------------------------------------------
# Tests: validate_file
# ---------------------------------------------------------------------------

class TestFileValidation:
    """Tests for validate_file."""

    def test_pdf_rejected(self):
        content = b"%PDF-1.4 fake pdf content here"
        with pytest.raises(ImportFileError, match="PDF"):
            validate_file(content, "report.pdf")

    def test_png_rejected(self):
        content = b"\x89PNG\r\n\x1a\n fake png"
        with pytest.raises(ImportFileError, match="image"):
            validate_file(content, "photo.png")

    def test_jpeg_rejected(self):
        content = b"\xff\xd8\xff\xe0 fake jpeg"
        with pytest.raises(ImportFileError, match="image"):
            validate_file(content, "photo.jpg")

    def test_empty_csv_rejected(self):
        content = b"candidate_number,name,ENGL\n"
        with pytest.raises(ImportFileError, match="no data rows"):
            validate_file(content, "empty.csv")

    def test_valid_csv_accepted(self):
        content = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [["A001", "Alice", "5"]],
        )
        assert validate_file(content, "students.csv") is True

    def test_row_limit_exceeded(self):
        rows = [[f"X{i:04}", f"Student {i}", "4"] for i in range(2001)]
        content = _make_csv(["candidate_number", "name", "ENGL"], rows)
        with pytest.raises(ImportFileError, match="2000"):
            validate_file(content, "big.csv")

    def test_corrupt_xlsx_rejected(self):
        content = b"PK\x03\x04this is not a real xlsx"
        with pytest.raises(ImportFileError, match="corrupted"):
            validate_file(content, "bad.xlsx")


# ---------------------------------------------------------------------------
# Tests: detect_encoding
# ---------------------------------------------------------------------------

class TestEncodingDetection:
    """Tests for detect_encoding."""

    def test_utf8_detected(self):
        content = "candidate_number,name\nT001,Alice Wong\n".encode("utf-8")
        assert detect_encoding(content) == "utf-8"

    def test_utf8_bom_detected(self):
        content = b"\xef\xbb\xbf" + "candidate_number,name\nT001,Alice\n".encode("utf-8")
        enc = detect_encoding(content)
        assert enc.lower().replace("-", "") in ("utf8", "utf8sig")

    def test_big5_detected(self):
        content = "candidate_number,姓名\nT001,陳嘉偉\n".encode("big5")
        enc = detect_encoding(content)
        assert "big5" in enc.lower() or "ascii" not in enc.lower()

    def test_decode_with_detected_encoding(self):
        original = "candidate_number,姓名,英文\nT001,陳嘉偉,5*\nT002,黃美儀,5\n"
        content = original.encode("big5")
        enc = detect_encoding(content)
        decoded = content.decode(enc)
        assert "陳嘉偉" in decoded
        assert "黃美儀" in decoded


# ---------------------------------------------------------------------------
# Tests: Header Mapping
# ---------------------------------------------------------------------------

class TestHeaderMapping:
    """Tests for map_headers and Chinese/English header integration."""

    def test_chinese_profile_headers(self):
        headers = ["學號", "姓名", "班別", "性別"]
        mapped = map_headers(headers)
        assert mapped == {"學號": "candidate_number", "姓名": "name", "班別": "class_name", "性別": "gender"}

    def test_chinese_subject_headers(self):
        headers = ["中文", "英文", "數學", "物理", "公民科"]
        mapped = map_headers(headers)
        assert mapped == {"中文": "CHLA", "英文": "ENGL", "數學": "MATH", "物理": "PHYS", "公民科": "CSD"}

    def test_english_fullname_headers(self):
        headers = ["English Language", "Mathematics", "Chinese Language", "Physics"]
        mapped = map_headers(headers)
        assert mapped == {"English Language": "ENGL", "Mathematics": "MATH", "Chinese Language": "CHLA", "Physics": "PHYS"}

    def test_case_insensitive(self):
        headers = ["ENGLISH LANGUAGE", "mathematics", " Chinese Language "]
        mapped = map_headers(headers)
        assert mapped["ENGLISH LANGUAGE"] == "ENGL"
        assert mapped["mathematics"] == "MATH"
        assert mapped[" Chinese Language "] == "CHLA"

    def test_already_valid_codes_passthrough(self):
        headers = ["candidate_number", "name", "ENGL", "MATH"]
        mapped = map_headers(headers)
        assert "ENGL" not in mapped
        assert "MATH" not in mapped

    def test_unmapped_headers_excluded(self):
        headers = ["name", "favorite_color", "shoe_size"]
        mapped = map_headers(headers)
        assert "favorite_color" not in mapped
        assert "shoe_size" not in mapped

    def test_chinese_csv_parses_correctly(self):
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
        csv_content = "candidate_number,name,English Language,Mathematics,Physics\nT001,Alice,5*,4,5\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5*"
        assert row["grades"]["MATH"] == "4"
        assert row["grades"]["PHYS"] == "5"

    def test_unmapped_columns_reported(self):
        csv_content = "candidate_number,name,ENGL,favorite_color,shoe_size\nT001,Alice,5,blue,42\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert "favorite_color" in result.get("unmapped_columns", [])
        assert "shoe_size" in result.get("unmapped_columns", [])


# ---------------------------------------------------------------------------
# Tests: Grade Normalization
# ---------------------------------------------------------------------------

class TestGradeNormalization:
    """Tests for normalize_grade function."""

    def test_hkdse_passthrough(self):
        assert normalize_grade("5**") == ("5**", None)
        assert normalize_grade("5*") == ("5*", None)
        assert normalize_grade("5") == ("5", None)
        assert normalize_grade("4") == ("4", None)
        assert normalize_grade("U") == ("U", None)
        assert normalize_grade("A") == ("A", None)
        assert normalize_grade("AD") == ("AD", None)

    def test_percentage_to_hkdse(self):
        assert normalize_grade("85")[0] == "5"
        assert normalize_grade("92")[0] == "5"
        assert normalize_grade("72")[0] == "4"
        assert normalize_grade("55")[0] == "3"
        assert normalize_grade("40")[0] == "2"
        assert normalize_grade("25")[0] == "1"
        assert normalize_grade("15")[0] == "U"

    def test_percentage_has_conversion_note(self):
        grade, note = normalize_grade("85")
        assert grade == "5"
        assert note is not None
        assert "85" in note

    def test_letter_to_hkdse(self):
        assert normalize_grade("A+")[0] == "5"
        assert normalize_grade("B+")[0] == "4"
        assert normalize_grade("B")[0] == "4"
        assert normalize_grade("C")[0] == "3"
        assert normalize_grade("C+")[0] == "3"
        assert normalize_grade("D")[0] == "2"
        assert normalize_grade("E")[0] == "1"
        assert normalize_grade("F")[0] == "U"

    def test_whitespace_cleanup(self):
        assert normalize_grade("5 **")[0] == "5**"
        assert normalize_grade(" 4 ")[0] == "4"
        assert normalize_grade(" u ")[0] == "U"

    def test_case_insensitive(self):
        assert normalize_grade("u")[0] == "U"
        assert normalize_grade("ad")[0] == "AD"
        assert normalize_grade("a")[0] == "A"

    def test_csd_attained(self):
        assert normalize_grade("Attained")[0] == "A"
        assert normalize_grade("Attained with Distinction")[0] == "AD"
        assert normalize_grade("attained")[0] == "A"

    def test_numeric_string(self):
        assert normalize_grade("1")[0] == "1"
        assert normalize_grade("3")[0] == "3"
        assert normalize_grade("4.0")[0] == "4"
        assert normalize_grade("3.7")[0] == "4"

    def test_unconvertible_returns_none(self):
        grade, note = normalize_grade("XYZ")
        assert grade is None
        assert note is not None
        assert "XYZ" in note

    def test_empty_returns_none(self):
        assert normalize_grade("") == (None, None)
        assert normalize_grade("  ") == (None, None)

    def test_percentage_csv_parses_correctly(self):
        csv_content = "candidate_number,name,ENGL,MATH,CHLA\nT001,Alice,85,72,55\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5"
        assert row["grades"]["MATH"] == "4"
        assert row["grades"]["CHLA"] == "3"
        assert len(result.get("grade_conversions", [])) == 3

    def test_letter_csv_parses_correctly(self):
        csv_content = "candidate_number,name,ENGL,MATH\nT001,Alice,A+,B+\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5"
        assert row["grades"]["MATH"] == "4"

    def test_mixed_csv_parses_correctly(self):
        csv_content = "candidate_number,name,ENGL,MATH,CHLA,PHYS\nT001,Alice,5*,85,B,4\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        row = result["rows"][0]
        assert row["grades"]["ENGL"] == "5*"
        assert row["grades"]["MATH"] == "5"
        assert row["grades"]["CHLA"] == "4"
        assert row["grades"]["PHYS"] == "4"


# ---------------------------------------------------------------------------
# Tests: Row Merging
# ---------------------------------------------------------------------------

class TestRowMerging:
    def test_no_duplicates_unchanged(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5"}, "profile": {"class_name": "5A"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A002", "name": "Bob", "status": "valid", "grades": {"ENGL": "4"}, "profile": {"class_name": "5B"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result) == 2

    def test_profile_from_first_row(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {"class_name": "5A"}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice Updated", "status": "valid", "grades": {}, "profile": {"class_name": "5B"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result) == 1
        assert result[0]["name"] == "Alice"
        assert result[0]["profile"]["class_name"] == "5A"

    def test_profile_fills_blanks(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {}, "profile": {"class_name": "5A", "gender": "F"}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert result[0]["profile"]["class_name"] == "5A"
        assert result[0]["profile"]["gender"] == "F"

    def test_grades_merged_across_sittings(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4", "MATH": "3"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5*", "MATH": "4"}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result[0]["grade_entries"]) == 4  # 2 subjects x 2 sittings

    def test_same_sitting_last_row_wins(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "5"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 3, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        engl = [e for e in result[0]["grade_entries"] if e["code"] == "ENGL"]
        assert len(engl) == 1
        assert engl[0]["grade"] == "5"

    def test_merged_from_count(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"MATH": "3"}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"PHYS": "5"}, "profile": {}, "sitting": "TRIAL", "year_of_exam": 2025, "row_number": 4, "warnings": [], "errors": []},
        ]
        result = merge_duplicate_rows(rows)
        assert result[0]["merged_from"] == 3

    def test_error_rows_not_merged(self):
        rows = [
            {"candidate_number": "A001", "name": "Alice", "status": "valid", "grades": {"ENGL": "4"}, "profile": {}, "sitting": "MOCK", "year_of_exam": 2025, "row_number": 2, "warnings": [], "errors": []},
            {"candidate_number": "A001", "name": "", "status": "error", "grades": {}, "profile": {}, "sitting": "OFFICIAL", "year_of_exam": 2026, "row_number": 3, "warnings": [], "errors": ["name is required"]},
        ]
        result = merge_duplicate_rows(rows)
        assert len(result) == 2

    def test_duplicate_csv_parses_with_merge(self):
        csv_content = (
            "candidate_number,name,class_name,ENGL,MATH,sitting,year_of_exam\n"
            "T001,Chan Ka Wai,5A,4,3,MOCK,2025\n"
            "T001,Chan Ka Wai,,5*,4,OFFICIAL,2026\n"
        )
        result = parse_student_csv(csv_content.encode("utf-8"))
        valid_rows = [r for r in result["rows"] if r["status"] != "error"]
        assert len(valid_rows) == 1
        assert valid_rows[0]["merged_from"] == 2
        assert valid_rows[0]["profile"]["class_name"] == "5A"


# ---------------------------------------------------------------------------
# Tests: Partial Data Import
# ---------------------------------------------------------------------------

class TestPartialDataImport:
    def test_profile_only_csv(self):
        csv_content = "candidate_number,name,class_name,gender,year_of_study\nT001,Alice,5A,F,5\nT002,Bob,5B,M,5\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["subject_columns"] == []
        assert result["rows"][0]["grades"] == {}
        assert result["rows"][0]["profile"]["class_name"] == "5A"

    def test_name_only_minimum(self):
        csv_content = "name\nAlice Wong\nBob Lee\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["rows"][0]["name"] == "Alice Wong"
        assert result["rows"][0]["candidate_number"].startswith("AUTO-")

    def test_grades_only_no_name_is_error(self):
        csv_content = "candidate_number,ENGL,MATH,CHLA\nT001,5*,4,3\nT002,5,5,5*\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["error"] == 2

    def test_grades_with_name_no_profile(self):
        csv_content = "candidate_number,name,ENGL,MATH,CHLA\nT001,Alice,5*,4,3\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 1
        assert result["rows"][0]["profile"] == {}
        assert result["rows"][0]["grades"] == {"ENGL": "5*", "MATH": "4", "CHLA": "3"}

    def test_sparse_data_csv(self):
        csv_content = "candidate_number,name,class_name,ENGL,MATH,CHLA,PHYS,CHEM\nT001,Alice,,5*,,,,\nT002,Bob,5A,,,3,,\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert result["summary"]["valid"] == 2
        assert result["rows"][0]["grades"] == {"ENGL": "5*"}
        assert "class_name" not in result["rows"][0]["profile"]
        assert result["rows"][1]["grades"] == {"CHLA": "3"}
        assert result["rows"][1]["profile"]["class_name"] == "5A"

    def test_extra_columns_reported(self):
        csv_content = "candidate_number,name,ENGL,favorite_color,shoe_size\nT001,Alice,5,blue,42\n"
        result = parse_student_csv(csv_content.encode("utf-8"))
        assert "favorite_color" in result["unmapped_columns"]
        assert "shoe_size" in result["unmapped_columns"]
        assert result["summary"]["valid"] == 1
