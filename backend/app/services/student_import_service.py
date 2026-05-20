"""
app/services/student_import_service.py

Student CSV import: parse HKDSE grade CSVs, validate rows, match students
by candidate_number, and upsert StudentSubjectGrade records.

Security:
- All cell values from user uploads treated as untrusted.
- Control characters stripped from every cell.
- candidate_number sanitised to alphanumeric + hyphens only.
"""
from __future__ import annotations

import csv
import io
import re
import secrets
import string
import uuid
from datetime import datetime
from typing import Any

import chardet
from sqlalchemy.orm import Session

from app.db.models import Student
from app.db.models_v2 import Subject, StudentSubjectGrade


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ImportFileError(Exception):
    """Raised when an uploaded file fails validation."""
    pass


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Known HKDSE subject codes that can appear as CSV column headers
HKDSE_SUBJECT_CODES: set[str] = {
    "CHLA", "ENGL", "MATH", "CSD",
    "PHYS", "CHEM", "BIOL", "ECON", "BAFS", "GEOG", "HIST",
    "CHIH", "CHIL", "VART", "MUSC", "ICT",
    "M1", "M2", "DAT", "HMSC", "TL", "PE", "ERS",
    "CSCI", "ISCI",
    "FREN", "GERM", "JAPA", "SPAN", "PTH",
    "TOUR",
    "APL_GENERIC", "APL_BML", "APL_CRST", "APL_ENGP",
    "APL_HMS", "APL_ITA", "APL_SERV", "APL_GEN",
}

# Valid HKDSE grades (including Applied Learning grades)
VALID_GRADES: set[str] = {"5**", "5*", "5", "4", "3", "2", "1", "U", "A", "AD"}

# Valid sitting values
VALID_SITTINGS: set[str] = {"MOCK", "TRIAL", "OFFICIAL"}

# Profile fields that can be extracted from CSV columns
PROFILE_FIELDS: set[str] = {
    "name_zh", "class_name", "year_of_study", "gender",
    "date_of_birth", "target_region", "preferred_language",
}

# ---------------------------------------------------------------------------
# Header mapping: Chinese + English full names → internal codes
# ---------------------------------------------------------------------------

_ZH_PROFILE_MAP: dict[str, str] = {
    "姓名": "name", "名稱": "name", "學生姓名": "name",
    "中文姓名": "name_zh", "Chinese Name": "name_zh", "中文名": "name_zh",
    "學號": "candidate_number", "考生編號": "candidate_number", "准考證號": "candidate_number",
    "班別": "class_name", "班級": "class_name",
    "年級": "year_of_study",
    "性別": "gender",
    "出生日期": "date_of_birth",
}

_ZH_SUBJECT_MAP: dict[str, str] = {
    "中文": "CHLA", "中國語文": "CHLA",
    "英文": "ENGL", "英國語文": "ENGL",
    "數學": "MATH",
    "公民科": "CSD", "公民與社會發展科": "CSD", "公社科": "CSD",
    "物理": "PHYS", "化學": "CHEM", "生物": "BIOL",
    "經濟": "ECON",
    "企會財": "BAFS", "企業會計與財務概論": "BAFS",
    "地理": "GEOG", "歷史": "HIST",
    "中史": "CHIH", "中國歷史": "CHIH",
    "中國文學": "CHIL",
    "視覺藝術": "VART", "視藝": "VART",
    "音樂": "MUSC",
    "資訊及通訊科技": "ICT",
    "體育": "PE",
}

_EN_SUBJECT_MAP: dict[str, str] = {
    "english language": "ENGL", "chinese language": "CHLA",
    "mathematics": "MATH", "citizenship and social development": "CSD",
    "physics": "PHYS", "chemistry": "CHEM", "biology": "BIOL",
    "economics": "ECON", "business, accounting and financial studies": "BAFS",
    "geography": "GEOG", "history": "HIST",
    "chinese history": "CHIH", "chinese literature": "CHIL",
    "visual arts": "VART", "music": "MUSC",
    "information and communication technology": "ICT",
    "physical education": "PE",
    "tourism and hospitality studies": "TOUR",
    "design and applied technology": "DAT",
    "health management and social care": "HMSC",
    "technology and living": "TL",
    "ethics and religious studies": "ERS",
    "combined science": "CSCI", "integrated science": "ISCI",
    "french": "FREN", "german": "GERM", "japanese": "JAPA",
    "spanish": "SPAN", "putonghua": "PTH",
}

# All known internal names (used by map_headers to skip already-valid headers)
_KNOWN_INTERNAL: set[str] = (
    {"name", "candidate_number", "sitting", "year_of_exam", "cohort"}
    | PROFILE_FIELDS
    | HKDSE_SUBJECT_CODES
)


# ---------------------------------------------------------------------------
# Smart name detection — Chinese ↔ English
# ---------------------------------------------------------------------------

def _is_chinese(text: str) -> bool:
    """Return True if text contains CJK Unified Ideographs."""
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _jyutping_to_hk(jyutping: str) -> str:
    """Convert a single Jyutping syllable to common HK romanization.

    Strips tones, then applies initial/final substitutions so the output
    matches names Hong Kong residents typically use on ID cards.
    """
    # Strip tone digit
    bare = re.sub(r"[0-9]+$", "", jyutping)
    if not bare:
        return jyutping

    # --- Initial substitutions ---
    # Order matters: longer prefixes first
    _INITIAL_MAP = [
        ("gw", "kw"), ("kw", "kw"),
        ("ng", "ng"),
        ("c", "ch"), ("z", "ch"),
        ("j", "y"),
        ("g", "k"),
        ("b", "p"),
        ("d", "t"),
    ]
    result = bare
    for old, new in _INITIAL_MAP:
        if result.startswith(old):
            result = new + result[len(old):]
            break

    # --- Final / vowel substitutions ---
    _FINAL_MAP = [
        ("eoi", "ui"), ("eot", "ut"), ("eon", "un"),
        ("oeng", "eung"), ("oek", "euk"),
        ("aai", "ai"), ("aau", "au"), ("aat", "at"),
        ("aan", "an"), ("aang", "ang"), ("aak", "ak"),
        ("aap", "ap"), ("aam", "am"),
        ("aa", "a"),
        ("oe", "eu"), ("eo", "eu"),
        ("ou", "o"),
        ("ei", "ei"),
        ("yu", "yu"),
    ]
    for old, new in _FINAL_MAP:
        if old in result:
            result = result.replace(old, new, 1)
            break

    return result


def _romanize_chinese_name(chinese: str) -> str:
    """
    Convert a Chinese name to Cantonese romanization using ToJyutping.
    Produces title-cased HK-style romanization, surname first.
    E.g. "陳美玲" → "Chan Mei Ling"
         "黃家豪" → "Wong Ka Ho"
    Falls back to Mandarin pypinyin if ToJyutping unavailable.
    """
    try:
        import ToJyutping
        pairs = ToJyutping.get_jyutping_list(chinese)
        if not pairs:
            return chinese
        syllables = [_jyutping_to_hk(jp) for _char, jp in pairs if jp]
        if not syllables:
            return chinese
        # HK convention: each syllable capitalised and space-separated
        # First char = surname
        return " ".join(s.capitalize() for s in syllables)
    except ImportError:
        pass

    # Fallback: Mandarin pinyin
    try:
        from pypinyin import pinyin, Style
        parts = pinyin(chinese, style=Style.NORMAL, heteronym=False)
        syllables = [p[0] for p in parts if p and p[0]]
        if not syllables:
            return chinese
        return " ".join(s.capitalize() for s in syllables)
    except ImportError:
        return chinese


def _smart_name_split(raw_name: str) -> tuple[str, str | None]:
    """
    Given a raw name string, detect whether it's Chinese or English and return
    (english_name, chinese_name).

    Rules:
    - If the name contains CJK characters and NO latin letters: treat as Chinese only.
      Auto-romanize to English.
    - If mixed or pure Latin: treat as English. Return (name, None).
    """
    has_cjk = _is_chinese(raw_name)
    has_latin = bool(re.search(r"[a-zA-Z]", raw_name))

    if has_cjk and not has_latin:
        # Pure Chinese name — auto-romanize for the English field
        english = _romanize_chinese_name(raw_name)
        return (english, raw_name)

    # Latin or mixed — treat as English
    return (raw_name, None)


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

    Returns (normalized_grade, conversion_note):
    - Already valid: (grade, None)
    - Converted: (grade, "original → converted")
    - Empty: (None, None)
    - Unconvertible: (None, error_message)
    """
    val = raw.strip()
    if not val:
        return (None, None)

    # Whitespace cleanup: "5 **" → "5**"
    collapsed = val.replace(" ", "")
    upper = collapsed.upper()

    # Already valid HKDSE grade
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
        # Percentage range (>7): convert to HKDSE
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
        # Decimal 0.5-5.5: round to nearest int if in range
        if 0.5 <= num <= 5.5:
            rounded = str(round(num))
            if rounded in VALID_GRADES:
                return (rounded, f"{val} → {rounded}" if rounded != collapsed else None)
        return (None, f"Could not convert grade '{val}'")
    except ValueError:
        pass

    # Letter grade
    if lower in _LETTER_TO_HKDSE:
        grade = _LETTER_TO_HKDSE[lower]
        return (grade, f"{val} → {grade}")

    return (None, f"Could not convert grade '{val}'")


def map_headers(headers: list[str]) -> dict[str, str]:
    """Map Chinese/English full-name headers to internal codes.

    Returns dict of original_header → mapped_name, only for headers that need remapping.
    Headers already using internal names are skipped.
    """
    mapping: dict[str, str] = {}
    for h in headers:
        stripped = h.strip()
        # Already a known internal name — skip
        if stripped in _KNOWN_INTERNAL or stripped.upper() in HKDSE_SUBJECT_CODES:
            continue
        # Chinese profile field
        if stripped in _ZH_PROFILE_MAP:
            mapping[h] = _ZH_PROFILE_MAP[stripped]
            continue
        # Chinese subject
        if stripped in _ZH_SUBJECT_MAP:
            mapping[h] = _ZH_SUBJECT_MAP[stripped]
            continue
        # English full name (case-insensitive)
        lower = stripped.lower()
        if lower in _EN_SUBJECT_MAP:
            mapping[h] = _EN_SUBJECT_MAP[lower]
            continue
    return mapping


# Regex: only alphanumeric and hyphens
_CANDIDATE_RE = re.compile(r"[^a-zA-Z0-9\-]")

# Regex: control characters — preserves \n \r \t for CSV structure
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Regex: all control characters including newline/tab (for individual cell values)
_CELL_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_control_chars(val: str) -> str:
    """Remove ASCII control characters from a cell value."""
    return _CELL_CONTROL_RE.sub("", val)


def _sanitise_candidate_number(raw: str) -> str:
    """Strip to alphanumeric + hyphens. Return empty string if nothing remains."""
    return _CANDIDATE_RE.sub("", raw).strip()


def _generate_initial_password(length: int = 8) -> str:
    """Generate a random initial password: uppercase + digits, no ambiguous chars."""
    alphabet = string.ascii_uppercase.replace("O", "").replace("I", "") + string.digits.replace("0", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ---------------------------------------------------------------------------
# File validation
# ---------------------------------------------------------------------------

# Magic bytes for rejected file types
_MAGIC_CHECKS: list[tuple[bytes, str]] = [
    (b"%PDF", "PDF files cannot be imported. Please upload a CSV file."),
    (b"\x89PNG", "This looks like an image file. Please upload a CSV file."),
    (b"\xff\xd8\xff", "This looks like an image file. Please upload a CSV file."),
    (b"GIF8", "This looks like an image file. Please upload a CSV file."),
    (b"\xd0\xcf\x11\xe0", "This looks like an old Office file (.xls/.doc). Please save as .xlsx or CSV and re-upload."),
]

MAX_DATA_ROWS = 2000


def validate_file(content: bytes, filename: str) -> bool:
    """Validate an uploaded file before parsing.

    Args:
        content: Raw file bytes.
        filename: Original filename (used for extension check).

    Returns:
        True if valid.

    Raises:
        ImportFileError: If the file is invalid.
    """
    if not content or not content.strip():
        raise ImportFileError("The file is empty. Please upload a CSV with data.")

    # Check magic bytes
    for magic, msg in _MAGIC_CHECKS:
        if content[:len(magic)] == magic:
            raise ImportFileError(msg)

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # Excel files: verify openpyxl can open them
    if ext in ("xlsx", "xls"):
        import openpyxl
        try:
            openpyxl.load_workbook(io.BytesIO(content), read_only=True)
        except Exception:
            raise ImportFileError(
                "The Excel file appears to be corrupted and cannot be opened. "
                "Please re-export it and try again."
            )
        return True

    # CSV validation
    encoding = detect_encoding(content)
    text = content.decode(encoding, errors="replace")
    if text and text[0] == "\ufeff":
        text = text[1:]

    lines = [l for l in text.splitlines() if l.strip()]
    if len(lines) < 2:
        raise ImportFileError(
            "The CSV file has no data rows. "
            "It must contain a header row and at least one data row."
        )
    if len(lines) - 1 > MAX_DATA_ROWS:
        raise ImportFileError(
            f"The CSV file has {len(lines) - 1} data rows, which exceeds "
            f"the limit of {MAX_DATA_ROWS}. Please split into smaller files."
        )

    return True


# ---------------------------------------------------------------------------
# Encoding detection
# ---------------------------------------------------------------------------

def detect_encoding(content: bytes) -> str:
    """Detect the encoding of raw bytes.

    Priority: UTF-8 BOM → UTF-8 → chardet → latin-1 fallback.
    """
    # UTF-8 BOM
    if content[:3] == b"\xef\xbb\xbf":
        return "utf-8-sig"

    # Try strict UTF-8
    try:
        content.decode("utf-8")
        return "utf-8"
    except UnicodeDecodeError:
        pass

    # chardet
    result = chardet.detect(content)
    if result and result.get("encoding") and (result.get("confidence", 0) > 0.5):
        return result["encoding"]

    # Common HK school encodings fallback
    for enc in ("big5", "gb2312"):
        try:
            content.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            pass

    return "latin-1"


# ---------------------------------------------------------------------------
# Row merging for duplicate candidate_numbers
# ---------------------------------------------------------------------------

def merge_duplicate_rows(rows: list[dict]) -> list[dict]:
    """Merge rows sharing the same candidate_number.

    Profile: first occurrence wins, blanks filled from later rows.
    Grades: collected across all rows as grade_entries.
    Same subject+sitting+year: last row wins.
    Error rows are never merged.
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
            r = group[0]
            r["grade_entries"] = [
                {"code": code, "grade": grade, "sitting": r["sitting"], "year_of_exam": r["year_of_exam"]}
                for code, grade in r.get("grades", {}).items()
            ]
            r["merged_from"] = 1
            merged.append(r)
            continue

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

        # Collect grades keyed by (code, sitting, year) — last wins
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
        result_row["grades"] = {e["code"]: e["grade"] for e in result_row["grade_entries"]}
        result_row["sitting"] = group[-1]["sitting"]
        result_row["year_of_exam"] = group[-1]["year_of_exam"]

        merged.append(result_row)

    return merged + error_rows


# ---------------------------------------------------------------------------
# parse_student_csv
# ---------------------------------------------------------------------------

def parse_student_csv(content: bytes) -> dict:
    """Parse a CSV file containing student profiles and HKDSE grades.

    Args:
        content: Raw CSV bytes (may have UTF-8 BOM).

    Returns:
        Dict with keys: rows, subject_columns, summary.
    """
    # Decode using detected encoding
    encoding = detect_encoding(content)
    text = content.decode(encoding, errors="replace")
    if text and text[0] == "\ufeff":
        text = text[1:]

    # Strip control characters from the entire text before CSV parsing
    # (csv.reader chokes on NUL bytes)
    text = _CONTROL_CHAR_RE.sub("", text)

    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])

    # Map Chinese/English full-name headers to internal codes
    header_mapping = map_headers(headers)

    # Track unmapped columns
    recognized: set[str] = set()
    for h in headers:
        mapped = header_mapping.get(h, h.strip())
        if mapped in _KNOWN_INTERNAL or mapped.upper() in HKDSE_SUBJECT_CODES:
            recognized.add(h)
    unmapped_columns = [h.strip() for h in headers if h not in recognized and h.strip()]

    # Detect which columns are subject codes (using mapped names)
    subject_columns: list[str] = []
    for h in headers:
        mapped = header_mapping.get(h, h.strip())
        if mapped.upper() in HKDSE_SUBJECT_CODES:
            subject_columns.append(h.strip())

    current_year = datetime.now().year

    rows: list[dict[str, Any]] = []
    grade_conversions: list[dict] = []

    for row_idx, raw_row in enumerate(reader, start=2):  # row 1 = header
        warnings: list[str] = []
        errors: list[str] = []

        # Clean all cell values (applying header mapping to keys)
        cleaned: dict[str, str] = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            val = str(v) if v is not None else ""
            mapped_key = header_mapping.get(k, k.strip())
            cleaned[mapped_key] = _strip_control_chars(val.strip())

        # --- name (required) ---
        raw_name = cleaned.get("name", "").strip()
        explicit_name_zh = cleaned.get("name_zh", "").strip()

        if not raw_name and not explicit_name_zh:
            errors.append("name is required")
            rows.append({
                "row_number": row_idx,
                "candidate_number": cleaned.get("candidate_number", ""),
                "name": "",
                "status": "error",
                "grades": {},
                "profile": {},
                "sitting": "OFFICIAL",
                "year_of_exam": current_year,
                "warnings": warnings,
                "errors": errors,
            })
            continue

        # Smart name detection: if raw_name is Chinese, split into
        # (romanized_english, chinese). If name_zh was provided explicitly
        # in a separate column, that takes priority.
        if raw_name:
            english_name, detected_zh = _smart_name_split(raw_name)
        elif explicit_name_zh:
            # Only Chinese name column provided, no "name" column
            english_name, detected_zh = _romanize_chinese_name(explicit_name_zh), explicit_name_zh
        else:
            english_name, detected_zh = raw_name, None

        name = english_name
        # Resolve name_zh: explicit column wins, then auto-detected
        name_zh = explicit_name_zh or detected_zh

        if detected_zh and not explicit_name_zh:
            warnings.append(f"Chinese name detected; auto-romanized to '{english_name}'")

        # --- candidate_number ---
        raw_cand = cleaned.get("candidate_number", "")
        cand = _sanitise_candidate_number(raw_cand)
        if not cand:
            cand = f"AUTO-{uuid.uuid4().hex[:8]}"
            warnings.append(f"Empty candidate_number; auto-generated {cand}")


        # --- sitting ---
        raw_sitting = cleaned.get("sitting", "OFFICIAL").strip().upper()
        if raw_sitting not in VALID_SITTINGS:
            warnings.append(f"Invalid sitting '{raw_sitting}'; defaulting to OFFICIAL")
            raw_sitting = "OFFICIAL"

        # --- year_of_exam ---
        raw_year = cleaned.get("year_of_exam", "").strip()
        try:
            year_of_exam = int(raw_year) if raw_year else current_year
        except ValueError:
            year_of_exam = current_year
            warnings.append(f"Invalid year_of_exam '{raw_year}'; defaulting to {current_year}")

        # --- grades ---
        grades: dict[str, str] = {}
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

        # --- profile fields ---
        profile: dict[str, Any] = {}
        for field in PROFILE_FIELDS:
            val = cleaned.get(field, "").strip()
            if val:
                if field == "year_of_study":
                    try:
                        profile[field] = int(val)
                    except ValueError:
                        warnings.append(f"Invalid year_of_study '{val}'; skipped")
                elif field == "date_of_birth":
                    try:
                        profile[field] = datetime.strptime(val, "%Y-%m-%d").date()
                    except ValueError:
                        warnings.append(f"Invalid date_of_birth '{val}'; skipped")
                else:
                    profile[field] = val

        # Inject auto-detected name_zh into profile if not already set
        if name_zh and "name_zh" not in profile:
            profile["name_zh"] = name_zh

        # --- cohort (optional) ---
        cohort_name = cleaned.get("cohort", "").strip()
        if cohort_name:
            profile["cohort"] = cohort_name

        rows.append({
            "row_number": row_idx,
            "candidate_number": cand,
            "name": name,
            "status": "valid",
            "grades": grades,
            "profile": profile,
            "sitting": raw_sitting,
            "year_of_exam": year_of_exam,
            "warnings": warnings,
            "errors": errors,
        })

    # Merge duplicate candidate_numbers
    rows = merge_duplicate_rows(rows)

    # Summary (recalculated after merge)
    valid_count = sum(1 for r in rows if r["status"] != "error")
    error_count = sum(1 for r in rows if r["status"] == "error")

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


# ---------------------------------------------------------------------------
# validate_rows — match against DB
# ---------------------------------------------------------------------------

def validate_rows(
    rows: list[dict],
    db: Session,
    user_id: Any,
    org_id: Any,
) -> list[dict]:
    """Enrich rows with create/update status by matching candidate_number in DB.

    Args:
        rows: Parsed rows from parse_student_csv.
        db: SQLAlchemy session.
        user_id: Current user's UUID.
        org_id: Current organisation's UUID.

    Returns:
        The same rows list, mutated with status and student_id where applicable.
    """
    for row in rows:
        if row["status"] == "error":
            continue

        cand = row["candidate_number"]
        existing = (
            db.query(Student)
            .filter(
                Student.candidate_number == cand,
                Student.organisation_id == org_id,
            )
            .first()
        )

        if existing:
            row["status"] = "update"
            row["student_id"] = existing.id
        else:
            row["status"] = "create"

    return rows


# ---------------------------------------------------------------------------
# commit_import — create/update students and upsert grades
# ---------------------------------------------------------------------------

def commit_import(
    rows: list[dict],
    db: Session,
    user_id: Any,
    org_id: Any,
) -> dict:
    """Persist parsed rows: create/update Students and upsert grades.

    Args:
        rows: Validated rows from validate_rows.
        db: SQLAlchemy session.
        user_id: Current user's UUID.
        org_id: Current organisation's UUID.

    Returns:
        Dict with keys: created, updated, grades_imported, skipped, warnings, errors.
    """
    # Build subject code -> Subject ORM mapping
    subjects = db.query(Subject).all()
    code_to_subject: dict[str, Subject] = {s.code.upper(): s for s in subjects}

    # Auto-create import cohort if no cohort column in CSV
    has_cohort_column = any(r.get("profile", {}).get("cohort") for r in rows if r["status"] != "error")
    auto_cohort = None
    if not has_cohort_column:
        from datetime import timezone as _tz
        from app.db.models_v2 import StudentCohort
        from app.db.models import User as UserModel
        user_obj = db.query(UserModel).filter(UserModel.id == user_id).first()
        auto_name = f"Import {datetime.now(_tz.utc).strftime('%Y-%m-%d')} by {user_obj.display_name or user_obj.email if user_obj else user_id}"
        auto_cohort = StudentCohort(
            user_id=user_id,
            organisation_id=org_id,
            name=auto_name,
            description="Auto-created from CSV import",
        )
        db.add(auto_cohort)
        db.flush()

        # Auto-create CohortPermission rows for ALL existing teacher groups
        from app.db.models import CohortPermission, TeacherGroup as _TG2
        org_groups = db.query(_TG2).filter(_TG2.organisation_id == org_id).all()
        for grp in org_groups:
            db.add(CohortPermission(
                group_id=grp.id, cohort_id=auto_cohort.id,
                visible=True,
                programme_choices="read_write",
                grades="read_write",
                plan_generation="read_write",
                submissions="read_write",
                reports="read_only",
                cohort_management="none",
                data_import="none",
                account_assignment="none",
                student_delete="none",
                student_profile="read_write",
            ))
        db.flush()

    created = 0
    updated = 0
    grades_imported = 0
    skipped = 0
    all_warnings: list[str] = []
    all_errors: list[str] = []

    for row in rows:
        if row["status"] == "error":
            skipped += 1
            continue

        try:
            # --- Student ---
            if row["status"] == "create":
                profile = row.get("profile", {})
                student = Student(
                    user_id=user_id,
                    organisation_id=org_id,
                    name=row["name"],
                    name_zh=profile.get("name_zh"),
                    candidate_number=row["candidate_number"],
                    target_region=profile.get("target_region", "local"),
                    class_name=profile.get("class_name"),
                    year_of_study=profile.get("year_of_study"),
                    gender=profile.get("gender"),
                    date_of_birth=profile.get("date_of_birth"),
                    preferred_language=profile.get("preferred_language"),
                )
                db.add(student)
                db.flush()  # get student.id
                # Student data record created — no user account.
                # Account linking happens separately via admin.
                created += 1

            elif row["status"] == "update":
                student = db.query(Student).get(row["student_id"])
                if student is None:
                    all_errors.append(f"Row {row['row_number']}: student not found for update")
                    skipped += 1
                    continue

                # Update non-empty profile fields
                profile = row.get("profile", {})
                for field, val in profile.items():
                    if val and hasattr(student, field):
                        setattr(student, field, val)

                if "name_zh" in profile:
                    student.name_zh = profile["name_zh"]

                updated += 1
            else:
                skipped += 1
                continue

            # --- Grades ---
            # Use grade_entries if available (merged rows), else build from flat grades
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

                subj = code_to_subject.get(code.upper())
                if subj is None:
                    all_warnings.append(
                        f"Row {row['row_number']}: subject code '{code}' not found in DB; skipped"
                    )
                    continue

                # Upsert: match on student_id + subject_id + sitting + year_of_exam
                existing_grade = (
                    db.query(StudentSubjectGrade)
                    .filter(
                        StudentSubjectGrade.student_id == student.id,
                        StudentSubjectGrade.subject_id == subj.id,
                        StudentSubjectGrade.sitting == sitting,
                        StudentSubjectGrade.year_of_exam == year_of_exam,
                    )
                    .first()
                )

                if existing_grade:
                    existing_grade.raw_grade = grade_val
                else:
                    ssg = StudentSubjectGrade(
                        student_id=student.id,
                        subject_id=subj.id,
                        sitting=sitting,
                        year_of_exam=year_of_exam,
                        raw_grade=grade_val,
                    )
                    db.add(ssg)

                grades_imported += 1

            # --- Cohort assignment (optional) ---
            cohort_name = row.get("profile", {}).get("cohort")
            if cohort_name:
                from app.db.models_v2 import StudentCohort, CohortMembership
                # Look up or create cohort within org
                cohort = db.query(StudentCohort).filter(
                    StudentCohort.name == cohort_name,
                    StudentCohort.organisation_id == org_id,
                ).first()
                if not cohort:
                    cohort = StudentCohort(
                        user_id=user_id,
                        organisation_id=org_id,
                        name=cohort_name,
                        description=f"Auto-created from CSV import",
                    )
                    db.add(cohort)
                    db.flush()

                    # Auto-create CohortPermission rows for ALL existing teacher groups
                    from app.db.models import CohortPermission as _CP, TeacherGroup as _TG
                    org_groups = db.query(_TG).filter(_TG.organisation_id == org_id).all()
                    for grp in org_groups:
                        existing_perm = db.query(_CP).filter(
                            _CP.group_id == grp.id, _CP.cohort_id == cohort.id
                        ).first()
                        if not existing_perm:
                            db.add(_CP(
                                group_id=grp.id, cohort_id=cohort.id,
                                visible=True,
                                programme_choices="read_write",
                                grades="read_write",
                                plan_generation="read_write",
                                submissions="read_write",
                                reports="read_only",
                                cohort_management="none",
                                data_import="none",
                                account_assignment="none",
                                student_delete="none",
                                student_profile="read_write",
                            ))
                    db.flush()

                # Check if membership exists
                existing_cm = db.query(CohortMembership).filter(
                    CohortMembership.cohort_id == cohort.id,
                    CohortMembership.student_id == student.id,
                ).first()
                if not existing_cm:
                    cm = CohortMembership(cohort_id=cohort.id, student_id=student.id)
                    db.add(cm)

            # --- Auto-cohort assignment (when no cohort column in CSV) ---
            if auto_cohort and not row.get("profile", {}).get("cohort"):
                from app.db.models_v2 import CohortMembership as CM
                existing_cm = db.query(CM).filter(
                    CM.cohort_id == auto_cohort.id,
                    CM.student_id == student.id,
                ).first()
                if not existing_cm:
                    db.add(CM(cohort_id=auto_cohort.id, student_id=student.id))

            # Collect per-row warnings
            all_warnings.extend(
                f"Row {row['row_number']}: {w}" for w in row.get("warnings", [])
            )

        except Exception as exc:
            all_errors.append(f"Row {row['row_number']}: {exc}")
            skipped += 1

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "grades_imported": grades_imported,
        "skipped": skipped,
        "warnings": all_warnings,
        "errors": all_errors,
    }
