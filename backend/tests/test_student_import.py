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

    def test_duplicate_candidate_number_rejected(self):
        """Duplicate candidate_number in same CSV is rejected."""
        csv_bytes = _make_csv(
            ["candidate_number", "name", "ENGL"],
            [
                ["DUP01", "First Student", "4"],
                ["DUP01", "Second Student", "3"],
            ],
        )
        result = parse_student_csv(csv_bytes)

        assert result["summary"]["valid"] == 1
        assert result["summary"]["error"] == 1

        dup_row = result["rows"][1]
        assert dup_row["status"] == "error"
        assert any("Duplicate" in e for e in dup_row["errors"])

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
        assert any("Invalid grade" in w and "MATH" in w for w in row["warnings"])

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
