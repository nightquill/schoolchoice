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
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Student
from app.db.models_v2 import Subject, StudentSubjectGrade


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
    "class_name", "year_of_study", "gender",
    "date_of_birth", "target_region", "preferred_language",
}

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
    # Decode: prefer utf-8-sig (strips BOM), fall back to latin-1
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    # Strip control characters from the entire text before CSV parsing
    # (csv.reader chokes on NUL bytes)
    text = _CONTROL_CHAR_RE.sub("", text)

    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])

    # Detect which columns are subject codes
    subject_columns: list[str] = []
    for h in headers:
        h_upper = h.strip().upper()
        if h_upper in HKDSE_SUBJECT_CODES:
            subject_columns.append(h.strip())

    current_year = datetime.now().year

    rows: list[dict[str, Any]] = []
    seen_candidates: set[str] = set()

    for row_idx, raw_row in enumerate(reader, start=2):  # row 1 = header
        warnings: list[str] = []
        errors: list[str] = []

        # Clean all cell values
        cleaned: dict[str, str] = {}
        for k, v in raw_row.items():
            if k is None:
                continue
            val = str(v) if v is not None else ""
            cleaned[k.strip()] = _strip_control_chars(val.strip())

        # --- name (required) ---
        name = cleaned.get("name", "").strip()
        if not name:
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

        # --- candidate_number ---
        raw_cand = cleaned.get("candidate_number", "")
        cand = _sanitise_candidate_number(raw_cand)
        if not cand:
            cand = f"AUTO-{uuid.uuid4().hex[:8]}"
            warnings.append(f"Empty candidate_number; auto-generated {cand}")

        # Duplicate check within this CSV
        if cand in seen_candidates:
            errors.append(f"Duplicate candidate_number '{cand}' in CSV")
            rows.append({
                "row_number": row_idx,
                "candidate_number": cand,
                "name": name,
                "status": "error",
                "grades": {},
                "profile": {},
                "sitting": "OFFICIAL",
                "year_of_exam": current_year,
                "warnings": warnings,
                "errors": errors,
            })
            continue
        seen_candidates.add(cand)

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
            grade_val = cleaned.get(col, "").strip()
            if not grade_val:
                continue
            if grade_val in VALID_GRADES:
                grades[col.upper()] = grade_val
            else:
                warnings.append(f"Invalid grade '{grade_val}' for {col}; skipped")

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

    # Summary
    valid_count = sum(1 for r in rows if r["status"] == "valid")
    error_count = sum(1 for r in rows if r["status"] == "error")

    return {
        "rows": rows,
        "subject_columns": subject_columns,
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

                # Auto-create student user account
                from app.core.security import get_password_hash
                from app.db.models import User as UserModel, OrganisationMembership
                existing_user = db.query(UserModel).filter(
                    UserModel.student_id == student.id
                ).first()
                if not existing_user:
                    student_user = UserModel(
                        email=f"{row['candidate_number']}@student.local",
                        hashed_password=get_password_hash(row["candidate_number"]),
                        role="student",
                        student_id=student.id,
                        display_name=row["name"],
                        is_active=True,
                        must_change_password=True,
                    )
                    db.add(student_user)
                    db.flush()
                    # Add org membership
                    if org_id:
                        mem = OrganisationMembership(
                            user_id=student_user.id,
                            organisation_id=org_id,
                            role="member",
                        )
                        db.add(mem)
                        db.flush()

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

                # Ensure student user account exists (may have been created before this feature)
                from app.core.security import get_password_hash
                from app.db.models import User as UserModel, OrganisationMembership
                existing_user = db.query(UserModel).filter(
                    UserModel.student_id == student.id
                ).first()
                if not existing_user:
                    student_user = UserModel(
                        email=f"{row['candidate_number']}@student.local",
                        hashed_password=get_password_hash(row["candidate_number"]),
                        role="student",
                        student_id=student.id,
                        display_name=row["name"],
                        is_active=True,
                        must_change_password=True,
                    )
                    db.add(student_user)
                    db.flush()
                    if org_id:
                        mem = OrganisationMembership(
                            user_id=student_user.id,
                            organisation_id=org_id,
                            role="member",
                        )
                        db.add(mem)
                        db.flush()

                updated += 1
            else:
                skipped += 1
                continue

            # --- Grades ---
            sitting = row["sitting"]
            year_of_exam = row["year_of_exam"]

            for code, grade_val in row.get("grades", {}).items():
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

                # Check if membership exists
                existing_cm = db.query(CohortMembership).filter(
                    CohortMembership.cohort_id == cohort.id,
                    CohortMembership.student_id == student.id,
                ).first()
                if not existing_cm:
                    cm = CohortMembership(cohort_id=cohort.id, student_id=student.id)
                    db.add(cm)

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
