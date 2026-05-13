# Student Import Pipeline + Student Choice App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CSV student+grades import with candidate_number matching, plus a lightweight student-facing app for JUPAS programme choice entry with counsellor approval workflow.

**Architecture:** Two features sharing one backend. Feature 1 adds a dedicated import endpoint (`/api/v1/import/students`) with two-phase preview→commit flow. Feature 2 adds a `student` auth role, a new `student_choice_submissions` table, student-facing API routes, a separate Vite SPA (`apps/student/`), and counsellor approval pages in the existing app.

**Tech Stack:** Python/FastAPI (backend), React 19/Vite (frontend), SQLAlchemy (ORM), SQLite/PostgreSQL (DB), pnpm workspaces (monorepo), `@schoolchoice/ui` (shared components).

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `backend/app/api/v1/routes/student_import.py` | CSV import preview + commit endpoints |
| `backend/app/services/student_import_service.py` | CSV parsing, validation, student matching, grade upsert logic |
| `backend/app/api/v1/routes/student_portal.py` | Student-facing API (grades, choices, submit) |
| `backend/app/api/v1/routes/submissions.py` | Counsellor submission review endpoints |
| `backend/app/modules/school_choice/models/submissions.py` | StudentChoiceSubmission ORM model |
| `backend/app/api/v1/routes/jupas_search.py` | JUPAS programme search endpoint |
| `backend/tests/test_student_import.py` | Import pipeline tests |
| `backend/tests/test_student_portal.py` | Student portal API tests |
| `backend/tests/test_submissions.py` | Submission workflow tests |
| `apps/student/package.json` | Student app package config |
| `apps/student/vite.config.js` | Vite config for student app |
| `apps/student/index.html` | SPA entry HTML |
| `apps/student/src/main.jsx` | React entry point |
| `apps/student/src/App.jsx` | Router with 3 routes |
| `apps/student/src/pages/Login.jsx` | Student login page |
| `apps/student/src/pages/MyGrades.jsx` | Read-only grades display |
| `apps/student/src/pages/MyChoices.jsx` | Programme choice entry (core feature) |
| `apps/student/src/components/ProgrammeSearch.jsx` | JUPAS programme autocomplete |
| `apps/student/src/components/ChoiceList.jsx` | Ranked choice list with bands |
| `apps/student/src/api/student.js` | Student API client functions |
| `apps/web/src/pages/Submissions/SubmissionList.jsx` | Counsellor: list pending submissions |
| `apps/web/src/pages/Submissions/SubmissionDetail.jsx` | Counsellor: review + approve/revise |
| `apps/web/src/api/submissions.js` | Submissions API client |

### Modified Files

| File | Change |
|------|--------|
| `backend/app/db/models.py` | Add `student_id`, `must_change_password` to User; update role comment |
| `backend/app/core/dependencies.py` | Add `get_current_student()` dependency |
| `backend/app/main.py` | Register 4 new routers |
| `backend/app/core/security.py` | Add `student_id` to JWT claims |
| `apps/web/src/App.jsx` | Add `/submissions` routes |
| `apps/web/src/pages/Dashboard/Dashboard.jsx` | Add pending submissions metric; rewire import button |
| `apps/web/src/components/NavBarV2/NavBarV2.jsx` | Add "Submissions" nav link |
| `pnpm-workspace.yaml` | Already includes `apps/*` — no change needed |

---

## Task 1: Student Import Service (backend logic)

**Files:**
- Create: `backend/app/services/student_import_service.py`
- Create: `backend/tests/test_student_import.py`

- [ ] **Step 1: Write failing tests for CSV parsing and student matching**

```python
# backend/tests/test_student_import.py
"""Tests for dedicated student+grades CSV import service."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
from app.services.student_import_service import parse_student_csv, validate_rows, commit_import


class TestParseStudentCSV:
    def test_basic_csv_parsing(self):
        csv_content = b'candidate_number,name,class_name,CHLA,ENGL,sitting\nHK001,Chan Ka Wai,5A,4,5*,MOCK\n'
        result = parse_student_csv(csv_content)
        assert len(result["rows"]) == 1
        assert result["rows"][0]["candidate_number"] == "HK001"
        assert result["rows"][0]["name"] == "Chan Ka Wai"
        assert result["subject_columns"] == ["CHLA", "ENGL"]
        assert result["rows"][0]["grades"]["CHLA"] == "4"
        assert result["rows"][0]["grades"]["ENGL"] == "5*"

    def test_missing_name_rejected(self):
        csv_content = b'candidate_number,name,CHLA\nHK001,,4\n'
        result = parse_student_csv(csv_content)
        assert result["rows"][0]["status"] == "error"
        assert "name" in result["rows"][0]["errors"][0].lower()

    def test_empty_candidate_number_generates_auto(self):
        csv_content = b'candidate_number,name\n,Chan Ka Wai\n'
        result = parse_student_csv(csv_content)
        assert result["rows"][0]["candidate_number"].startswith("AUTO-")

    def test_duplicate_candidate_number_in_csv(self):
        csv_content = b'candidate_number,name\nHK001,Chan\nHK001,Wong\n'
        result = parse_student_csv(csv_content)
        assert result["rows"][1]["status"] == "error"
        assert "duplicate" in result["rows"][1]["errors"][0].lower()

    def test_invalid_grade_skipped_with_warning(self):
        csv_content = b'candidate_number,name,CHLA\nHK001,Chan,INVALID\n'
        result = parse_student_csv(csv_content)
        assert "CHLA" not in result["rows"][0]["grades"]
        assert len(result["rows"][0]["warnings"]) > 0

    def test_unknown_column_ignored(self):
        csv_content = b'candidate_number,name,FAKE_SUBJECT\nHK001,Chan,5\n'
        result = parse_student_csv(csv_content)
        assert "FAKE_SUBJECT" not in result["subject_columns"]

    def test_default_sitting_and_year(self):
        csv_content = b'candidate_number,name,CHLA\nHK001,Chan,4\n'
        result = parse_student_csv(csv_content)
        assert result["rows"][0]["sitting"] == "OFFICIAL"
        assert result["rows"][0]["year_of_exam"] == 2026  # current year

    def test_invalid_sitting_defaults_to_official(self):
        csv_content = b'candidate_number,name,sitting\nHK001,Chan,BLAH\n'
        result = parse_student_csv(csv_content)
        assert result["rows"][0]["sitting"] == "OFFICIAL"
        assert len(result["rows"][0]["warnings"]) > 0

    def test_candidate_number_sanitised(self):
        csv_content = b'candidate_number,name\n"HK<script>001",Chan\n'
        result = parse_student_csv(csv_content)
        assert "<" not in result["rows"][0]["candidate_number"]

    def test_utf8_bom_handled(self):
        csv_content = b'\xef\xbb\xbfcandidate_number,name\nHK001,Chan\n'
        result = parse_student_csv(csv_content)
        assert len(result["rows"]) == 1
        assert result["rows"][0]["candidate_number"] == "HK001"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_student_import.py -v
```
Expected: ImportError — `student_import_service` doesn't exist yet.

- [ ] **Step 3: Implement the import service**

```python
# backend/app/services/student_import_service.py
"""
Dedicated student + grades CSV import service.

Handles: CSV/Excel parsing, candidate_number matching, grade column detection,
validation, and two-phase preview→commit flow.
"""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import User
from app.modules.school_choice.models.models import Student, StudentSubjectGrade
from app.db.models_v2 import Subject

# Valid HKDSE grades
VALID_GRADES = {"5**", "5*", "5", "4", "3", "2", "1", "U", "A", "AD"}
VALID_SITTINGS = {"MOCK", "TRIAL", "OFFICIAL"}

# Student profile fields (non-grade columns)
PROFILE_FIELDS = {
    "name", "class_name", "year_of_study", "gender", "date_of_birth",
    "target_region", "preferred_language", "candidate_number",
}
CONTEXT_FIELDS = {"sitting", "year_of_exam"}

_SANITISE_RE = re.compile(r"[^a-zA-Z0-9\-_]")


def _sanitise_candidate_number(val: str) -> str:
    """Remove non-alphanumeric chars except hyphens and underscores."""
    return _SANITISE_RE.sub("", val.strip())


def _strip_control_chars(val: str) -> str:
    """Remove control characters from cell values."""
    return "".join(c for c in val if c >= " " or c in ("\n", "\t"))


def parse_student_csv(content: bytes) -> dict:
    """Parse CSV content and return structured preview data.

    Returns:
        {
            rows: [{candidate_number, name, status, grades: {code: grade}, warnings, errors, profile: {...}, sitting, year_of_exam}],
            subject_columns: [str],
            summary: {total, valid, error}
        }
    """
    # Decode with BOM handling
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return {"rows": [], "subject_columns": [], "summary": {"total": 0, "valid": 0, "error": 0}}

    # Detect subject code columns
    all_subject_codes = _get_all_subject_codes()
    subject_columns = [col for col in reader.fieldnames if col.upper() in all_subject_codes]

    rows = []
    seen_candidates = set()
    current_year = datetime.now().year

    for i, raw_row in enumerate(reader):
        row_data = {
            "row_number": i + 2,  # 1-indexed, skip header
            "candidate_number": "",
            "name": "",
            "status": "valid",
            "grades": {},
            "profile": {},
            "sitting": "OFFICIAL",
            "year_of_exam": current_year,
            "warnings": [],
            "errors": [],
        }

        # Extract and sanitise candidate_number
        cand = _strip_control_chars(raw_row.get("candidate_number", "").strip())
        if cand:
            cand = _sanitise_candidate_number(cand)
        if not cand:
            cand = f"AUTO-{uuid.uuid4().hex[:8]}"
            row_data["warnings"].append("No candidate_number provided — auto-generated.")
        row_data["candidate_number"] = cand

        # Check for duplicate within CSV
        if cand in seen_candidates:
            row_data["status"] = "error"
            row_data["errors"].append(f"Duplicate candidate_number '{cand}' in this file.")
            rows.append(row_data)
            continue
        seen_candidates.add(cand)

        # Extract name (required)
        name = _strip_control_chars(raw_row.get("name", "").strip())
        if not name:
            row_data["status"] = "error"
            row_data["errors"].append("Missing required field: name.")
            rows.append(row_data)
            continue
        row_data["name"] = name

        # Extract profile fields
        for field in PROFILE_FIELDS - {"candidate_number", "name"}:
            val = _strip_control_chars(raw_row.get(field, "").strip())
            if val:
                if field == "year_of_study":
                    try:
                        row_data["profile"][field] = int(val)
                    except ValueError:
                        row_data["warnings"].append(f"Invalid year_of_study '{val}', skipped.")
                else:
                    row_data["profile"][field] = val

        # Extract sitting
        sitting_raw = _strip_control_chars(raw_row.get("sitting", "").strip().upper())
        if sitting_raw:
            if sitting_raw in VALID_SITTINGS:
                row_data["sitting"] = sitting_raw
            else:
                row_data["sitting"] = "OFFICIAL"
                row_data["warnings"].append(f"Invalid sitting '{sitting_raw}', defaulting to OFFICIAL.")

        # Extract year_of_exam
        year_raw = raw_row.get("year_of_exam", "").strip()
        if year_raw:
            try:
                row_data["year_of_exam"] = int(year_raw)
            except ValueError:
                row_data["warnings"].append(f"Invalid year_of_exam '{year_raw}', using {current_year}.")

        # Extract grades
        for col in subject_columns:
            val = _strip_control_chars(raw_row.get(col, "").strip())
            if not val:
                continue
            # Normalise: uppercase, handle common variants
            val_upper = val.upper().replace(" ", "")
            if val_upper in VALID_GRADES:
                row_data["grades"][col.upper()] = val_upper
            else:
                row_data["warnings"].append(f"Invalid grade '{val}' for {col.upper()}, skipped.")

        # Check for empty row (only candidate_number, no useful data)
        has_data = bool(name) or bool(row_data["grades"]) or bool(row_data["profile"])
        if not has_data:
            row_data["status"] = "skip"
            row_data["warnings"].append("Row has no useful data, skipped.")

        rows.append(row_data)

    total = len(rows)
    error_count = sum(1 for r in rows if r["status"] == "error")
    return {
        "rows": rows,
        "subject_columns": [c.upper() for c in subject_columns],
        "summary": {"total": total, "valid": total - error_count, "error": error_count},
    }


def validate_rows(rows: list[dict], db: Session, user_id, org_id) -> list[dict]:
    """Enrich rows with create/update status by checking DB for existing students."""
    for row in rows:
        if row["status"] == "error":
            continue
        existing = (
            db.query(Student)
            .filter(
                Student.candidate_number == row["candidate_number"],
                Student.organisation_id == org_id,
            )
            .first()
        )
        if existing:
            row["status"] = "update"
            row["student_id"] = str(existing.id)
        else:
            row["status"] = "create"
    return rows


def commit_import(
    rows: list[dict],
    db: Session,
    user_id,
    org_id,
) -> dict:
    """Commit validated rows to DB within a single transaction.

    Returns summary dict with counts and any errors/warnings.
    """
    # Load subject code → ID mapping
    subjects = {s.code: s for s in db.query(Subject).all()}

    created = 0
    updated = 0
    grades_imported = 0
    skipped = 0
    warnings = []
    errors = []

    for row in rows:
        if row["status"] in ("error", "skip"):
            skipped += 1
            continue

        try:
            if row["status"] == "create":
                student = Student(
                    name=row["name"],
                    candidate_number=row["candidate_number"],
                    user_id=user_id,
                    organisation_id=org_id,
                    target_region=row["profile"].get("target_region", "local"),
                    class_name=row["profile"].get("class_name"),
                    year_of_study=row["profile"].get("year_of_study"),
                    gender=row["profile"].get("gender"),
                    date_of_birth=row["profile"].get("date_of_birth"),
                    preferred_language=row["profile"].get("preferred_language", "en"),
                )
                db.add(student)
                db.flush()
                created += 1
            else:
                # Update existing
                student = (
                    db.query(Student)
                    .filter(
                        Student.candidate_number == row["candidate_number"],
                        Student.organisation_id == org_id,
                    )
                    .first()
                )
                if not student:
                    errors.append(f"Row {row['row_number']}: student {row['candidate_number']} not found on commit.")
                    skipped += 1
                    continue
                # Update non-empty profile fields
                if row["name"]:
                    student.name = row["name"]
                for field, val in row["profile"].items():
                    if val and hasattr(student, field):
                        setattr(student, field, val)
                updated += 1

            # Import grades
            sitting = row["sitting"]
            year_of_exam = row["year_of_exam"]

            for code, grade_val in row.get("grades", {}).items():
                subj = subjects.get(code)
                if not subj:
                    warnings.append(f"Row {row['row_number']}: subject code '{code}' not found in DB.")
                    continue

                # Upsert: find existing grade for this student+subject+sitting+year
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
                    existing_grade.updated_at = datetime.now(timezone.utc)
                else:
                    new_grade = StudentSubjectGrade(
                        student_id=student.id,
                        subject_id=subj.id,
                        raw_grade=grade_val,
                        sitting=sitting,
                        year_of_exam=year_of_exam,
                    )
                    db.add(new_grade)

                grades_imported += 1

        except Exception as e:
            errors.append(f"Row {row['row_number']}: {str(e)[:100]}")
            skipped += 1

    db.commit()

    return {
        "created": created,
        "updated": updated,
        "grades_imported": grades_imported,
        "skipped": skipped,
        "warnings": warnings,
        "errors": errors,
    }


def _get_all_subject_codes() -> set[str]:
    """Return all known HKDSE subject codes."""
    return {
        "CHLA", "ENGL", "MATH", "CSD", "PHYS", "CHEM", "BIOL", "ECON",
        "BAFS", "GEOG", "HIST", "CHIH", "CHIL", "VART", "MUSC", "ICT",
        "M1", "M2", "DAT", "HMSC", "TL", "PE", "ERS", "CSCI", "ISCI",
        "FREN", "GERM", "JAPA", "SPAN", "PTH", "TOUR",
        "APL_GENERIC", "APL_BML", "APL_CRST", "APL_ENGP", "APL_HMS",
        "APL_ITA", "APL_SERV", "APL_GEN",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_student_import.py -v
```
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/student_import_service.py backend/tests/test_student_import.py
git commit -m "feat: student import service with CSV parsing, matching, grade upsert"
```

---

## Task 2: Student Import API Endpoints

**Files:**
- Create: `backend/app/api/v1/routes/student_import.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the import router with preview + commit endpoints**

```python
# backend/app/api/v1/routes/student_import.py
"""
Dedicated student + grades CSV import endpoints.
Two-phase: preview (parse + validate) then commit.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.db.models import User
from app.services.student_import_service import parse_student_csv, validate_rows, commit_import

router = APIRouter(prefix="/import/students", tags=["student-import"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse CSV/Excel and return preview of what will be created/updated."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10MB limit.")
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")

    result = parse_student_csv(content)
    if not result["rows"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No data rows found in file.")

    org_id = getattr(current_user, "active_organisation_id", None)
    result["rows"] = validate_rows(result["rows"], db, current_user.id, org_id)

    # Recompute summary after validation
    creates = sum(1 for r in result["rows"] if r["status"] == "create")
    updates = sum(1 for r in result["rows"] if r["status"] == "update")
    errs = sum(1 for r in result["rows"] if r["status"] == "error")
    grade_count = sum(len(r.get("grades", {})) for r in result["rows"] if r["status"] != "error")
    result["summary"] = {"create": creates, "update": updates, "error": errs, "grade_count": grade_count}

    return result


@router.post("/commit")
async def commit_student_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse, validate, and commit student+grades import in one transaction."""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10MB limit.")
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")

    result = parse_student_csv(content)
    if not result["rows"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No data rows found in file.")

    org_id = getattr(current_user, "active_organisation_id", None)
    result["rows"] = validate_rows(result["rows"], db, current_user.id, org_id)

    summary = commit_import(result["rows"], db, current_user.id, org_id)
    return summary
```

- [ ] **Step 2: Register router in main.py**

Add to `backend/app/main.py` after other router imports:

```python
from app.api.v1.routes.student_import import router as student_import_router
```

And in the router registration section:

```python
app.include_router(student_import_router, prefix="/api/v1")
```

- [ ] **Step 3: Restart backend and test with curl**

```bash
# Restart backend
kill $(lsof -ti :8000) 2>/dev/null; sleep 1
cd backend && python3.10 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 4

# Get token
TK=$(curl -s http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3.10 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Test preview with sample CSV
curl -s -X POST http://localhost:8000/api/v1/import/students/preview \
  -H "Authorization: Bearer $TK" \
  -F "file=@../data/sample-students.csv" | python3.10 -m json.tool | head -30
```

Expected: JSON with `rows` array showing "create" status for each student, detected subject columns, grade values.

- [ ] **Step 4: Test commit**

```bash
curl -s -X POST http://localhost:8000/api/v1/import/students/commit \
  -H "Authorization: Bearer $TK" \
  -F "file=@../data/sample-students.csv" | python3.10 -m json.tool
```

Expected: `{"created": 10, "updated": 0, "grades_imported": N, ...}`

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/student_import.py backend/app/main.py
git commit -m "feat: student import API endpoints (preview + commit)"
```

---

## Task 3: Import Wizard Frontend (Dashboard Integration)

**Files:**
- Create: `apps/web/src/pages/StudentImport/StudentImport.jsx`
- Modify: `apps/web/src/App.jsx` — add route
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx` — rewire import button
- Create: `apps/web/src/api/studentImport.js`

- [ ] **Step 1: Create API client**

```javascript
// apps/web/src/api/studentImport.js
import client from '@schoolchoice/ui/api/client';

export const previewImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/api/v1/import/students/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

export const commitImport = (file) => {
  const form = new FormData();
  form.append('file', file);
  return client.post('/api/v1/import/students/commit', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
```

- [ ] **Step 2: Create StudentImport page with upload → preview → commit flow**

```jsx
// apps/web/src/pages/StudentImport/StudentImport.jsx
import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { LoadingSpinner } from '@schoolchoice/ui';
import { toast } from 'sonner';
import { getAccount } from '@schoolchoice/ui/api/account';
import { previewImport, commitImport } from '../../api/studentImport';

const STATUS_COLORS = {
  create: { bg: '#ecfdf5', color: '#059669', label: 'New' },
  update: { bg: '#eff6ff', color: '#2563eb', label: 'Update' },
  error: { bg: '#fef2f2', color: '#dc2626', label: 'Error' },
  skip: { bg: '#f3f4f6', color: '#6b7280', label: 'Skip' },
};

export default function StudentImport() {
  const { data: account } = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('File exceeds 10MB limit.'); return; }
    setFile(f);
    setLoading(true);
    try {
      const data = await previewImport(f);
      setPreview(data);
      setStep('preview');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const data = await commitImport(file);
      setResult(data);
      setStep('done');
      toast.success(`Import complete: ${data.created} created, ${data.updated} updated, ${data.grades_imported} grades.`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100vh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={account} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '960px', margin: '0 auto' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
          Import Students &amp; Grades
        </h1>

        {/* Info box */}
        <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', fontSize: 'var(--font-size-sm)' }}>
          <p style={{ margin: '0 0 var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}>
            Accepted: <strong>CSV</strong> (.csv) and <strong>Excel</strong> (.xlsx)
          </p>
          <p style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text-secondary)' }}>
            <strong>Required:</strong> candidate_number, name
          </p>
          <p style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text-secondary)' }}>
            <strong>Profile:</strong> class_name, year_of_study, gender, date_of_birth, target_region
          </p>
          <p style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text-secondary)' }}>
            <strong>Grades:</strong> CHLA, ENGL, MATH, CSD, PHYS, CHEM, BIOL, ECON, HIST, ... (any HKDSE subject code)
          </p>
          <p style={{ margin: '0 0 var(--space-2)', color: 'var(--color-text-secondary)' }}>
            <strong>Context:</strong> sitting (MOCK/TRIAL/OFFICIAL, default: OFFICIAL), year_of_exam (default: {new Date().getFullYear()})
          </p>
          <p style={{ margin: '0 0 var(--space-1)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
            Students matched by candidate_number. New numbers auto-create students. Existing numbers update data.
          </p>
          <a href="/data/sample-students.csv" download style={{ color: 'var(--color-primary)', fontWeight: 'var(--font-weight-medium)', textDecoration: 'underline', fontSize: 'var(--font-size-sm)' }}>
            Download sample CSV
          </a>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)', border: '2px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)', background: 'var(--color-surface)' }}>
            {loading ? <LoadingSpinner label="Parsing file..." /> : (
              <>
                <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>Select a CSV or Excel file</p>
                <input ref={inputRef} type="file" accept=".csv,.xlsx" onChange={handleFileSelect} style={{ display: 'none' }} />
                <Button onClick={() => inputRef.current?.click()}>Choose File</Button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              {[
                { label: 'New Students', value: preview.summary.create, color: '#059669' },
                { label: 'Updates', value: preview.summary.update, color: '#2563eb' },
                { label: 'Errors', value: preview.summary.error, color: '#dc2626' },
                { label: 'Grades', value: preview.summary.grade_count, color: '#7c3aed' },
              ].map((m) => (
                <div key={m.label} style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-md)', flex: 1, minWidth: '100px', textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Subject columns detected */}
            {preview.subject_columns.length > 0 && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
                Grade columns detected: <strong>{preview.subject_columns.join(', ')}</strong>
              </p>
            )}

            {/* Row preview table */}
            <div style={{ overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-background)' }}>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Row</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Status</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Candidate #</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Name</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Grades</th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'left', borderBottom: '2px solid var(--color-border)' }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => {
                    const sc = STATUS_COLORS[row.status] || STATUS_COLORS.skip;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{row.row_number}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <span style={{ background: sc.bg, color: sc.color, padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>{sc.label}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2)', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.candidate_number}</td>
                        <td style={{ padding: 'var(--space-2)' }}>{row.name}</td>
                        <td style={{ padding: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          {Object.entries(row.grades || {}).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}
                        </td>
                        <td style={{ padding: 'var(--space-2)', fontSize: '0.75rem' }}>
                          {[...row.errors, ...row.warnings].map((w, j) => (
                            <div key={j} style={{ color: row.errors.includes(w) ? '#dc2626' : '#d97706' }}>{w}</div>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button onClick={handleCommit} disabled={loading || preview.summary.create + preview.summary.update === 0}>
                {loading ? 'Importing...' : `Import ${preview.summary.create + preview.summary.update} Students`}
              </Button>
              <Button variant="secondary" onClick={() => { setStep('upload'); setPreview(null); setFile(null); }}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && result && (
          <div style={{ padding: 'var(--space-6)', background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', textAlign: 'center' }}>
            <h2 style={{ color: '#059669', marginBottom: 'var(--space-3)' }}>Import Complete</h2>
            <p>{result.created} students created, {result.updated} updated, {result.grades_imported} grades imported.</p>
            {result.warnings.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)', textAlign: 'left', fontSize: 'var(--font-size-xs)', color: '#d97706' }}>
                {result.warnings.map((w, i) => <div key={i}>{w}</div>)}
              </div>
            )}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Button onClick={() => window.location.href = '/dashboard'}>Back to Dashboard</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.jsx and rewire dashboard import button**

In `apps/web/src/App.jsx`, add the import for StudentImport and a route:

```jsx
import StudentImport from './pages/StudentImport/StudentImport';
// In routes:
<Route path="/import/students" element={<ProtectedRoute><StudentImport /></ProtectedRoute>} />
```

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, change the import button navigate target:

```jsx
// Change: navigate('/entities/student/import')
// To: navigate('/import/students')
```

- [ ] **Step 4: Verify end-to-end in browser**

1. Login as verify@test.com
2. Click "Import (CSV / Excel)" on dashboard
3. Upload sample CSV
4. Verify preview shows 10 rows with correct statuses and grade counts
5. Click Import
6. Verify success message with counts
7. Navigate to a newly created student's profile → Grades tab → verify grades appear

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/StudentImport/ apps/web/src/api/studentImport.js apps/web/src/App.jsx apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "feat: student import wizard with preview, grade detection, commit"
```

---

## Task 4: Student Auth + Choice Submission Model

**Files:**
- Modify: `backend/app/db/models.py` — add `student_id`, `must_change_password` to User
- Create: `backend/app/modules/school_choice/models/submissions.py` — StudentChoiceSubmission model
- Modify: `backend/app/core/dependencies.py` — add `get_current_student()`
- Modify: `backend/app/core/security.py` — add `student_id` to JWT
- Create: `backend/app/api/v1/routes/jupas_search.py` — JUPAS programme search
- Create: `backend/tests/test_student_portal.py`

- [ ] **Step 1: Add student_id and must_change_password to User model**

In `backend/app/db/models.py`, after the `is_active` column on User, add:

```python
student_id = Column(
    PortableUUID(),
    ForeignKey("students.id", ondelete="SET NULL", name="fk_user_student_id"),
    nullable=True,
    comment="FK to students.id — links student user to their student record",
)
must_change_password = Column(
    Boolean, nullable=False, default=False, server_default="false",
    comment="Force password change on next login",
)
```

Update the role comment:
```python
comment="Enum: counsellor | admin | student. Default: counsellor",
```

- [ ] **Step 2: Create StudentChoiceSubmission model**

```python
# backend/app/modules/school_choice/models/submissions.py
"""StudentChoiceSubmission — tracks student JUPAS programme choices through approval workflow."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, CheckConstraint, ForeignKey, Integer, String, Text,
    TIMESTAMP, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from app.db.models import Base, PortableUUID

_utcnow = lambda: datetime.now(timezone.utc)

# Use JSON for SQLite compat, JSONB for PostgreSQL
_JsonType = JSON


class StudentChoiceSubmission(Base):
    """One active submission per student. Tracks ranked JUPAS choices through approval."""

    __tablename__ = "student_choice_submissions"

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'pending', 'approved', 'revision_requested', 'rejected')",
            name="ck_scs_status",
        ),
    )

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(
        PortableUUID(),
        ForeignKey("students.id", ondelete="CASCADE", name="fk_scs_student_id"),
        nullable=False, index=True,
    )
    status = Column(
        String(20), nullable=False, default="draft", server_default="'draft'",
        comment="draft | pending | approved | revision_requested | rejected",
    )
    choices = Column(
        _JsonType, nullable=False, server_default="'[]'",
        comment="[{rank, jupas_code, programme_name, school_name, notes}]",
    )
    counsellor_notes = Column(Text, nullable=True)
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_by = Column(
        PortableUUID(),
        ForeignKey("users.id", ondelete="SET NULL", name="fk_scs_reviewed_by"),
        nullable=True,
    )
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)

    student = relationship("Student")
```

- [ ] **Step 3: Add get_current_student() dependency**

In `backend/app/core/dependencies.py`, add:

```python
def get_current_student(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate JWT and return User with role='student'. Raises 401/403."""
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token")
    user = _resolve_user_from_token(credentials.credentials, db)
    if user.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student access required")
    if not user.student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No student record linked")
    return user
```

- [ ] **Step 4: Update JWT to include student_id**

In `backend/app/services/auth_service.py`, in `login_for_access_token()`, add `student_id` to token data when role is student:

```python
token_data = {"sub": str(user.id), "org_id": str(membership.organisation_id) if membership else None}
if user.role == "student" and user.student_id:
    token_data["student_id"] = str(user.student_id)
```

- [ ] **Step 5: Create JUPAS search endpoint**

```python
# backend/app/api/v1/routes/jupas_search.py
"""JUPAS programme search — used by student choice autocomplete."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.school_choice.models.models import JupasProgramme, School

router = APIRouter(prefix="/jupas", tags=["jupas"])


@router.get("/search")
def search_programmes(
    q: str = Query(..., min_length=1, description="Search by JUPAS code or programme name"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Search JUPAS programmes by code or name. No auth required — public data."""
    query = db.query(JupasProgramme).join(School, JupasProgramme.school_id == School.id)

    if q.upper().startswith("JS"):
        query = query.filter(JupasProgramme.jupas_code.ilike(f"{q}%"))
    else:
        query = query.filter(JupasProgramme.name.ilike(f"%{q}%"))

    programmes = query.limit(limit).all()

    return [
        {
            "jupas_code": p.jupas_code,
            "name": p.name,
            "school_id": str(p.school_id),
            "school_name": p.school.name if p.school else None,
            "faculty": p.faculty,
        }
        for p in programmes
    ]
```

- [ ] **Step 6: Register models and routers in main.py**

Add import and registration:
```python
from app.modules.school_choice.models.submissions import StudentChoiceSubmission  # noqa: F401
from app.api.v1.routes.jupas_search import router as jupas_search_router
app.include_router(jupas_search_router, prefix="/api/v1")
```

- [ ] **Step 7: Run migration for new columns/table, restart, test JUPAS search**

```bash
# Migrate SQLite
cd backend && python3.10 -c "
from app.db.session import engine
from app.db.models import Base
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from sqlalchemy import text, inspect
Base.metadata.create_all(bind=engine)
# Add new User columns
insp = inspect(engine)
cols = {c['name'] for c in insp.get_columns('users')}
with engine.connect() as conn:
    if 'student_id' not in cols:
        conn.execute(text('ALTER TABLE users ADD COLUMN student_id CHAR(32)'))
        conn.commit()
        print('Added users.student_id')
    if 'must_change_password' not in cols:
        conn.execute(text('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 0'))
        conn.commit()
        print('Added users.must_change_password')
"

# Restart backend
kill $(lsof -ti :8000) 2>/dev/null; sleep 1
python3.10 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 4

# Test JUPAS search
curl -s "http://localhost:8000/api/v1/jupas/search?q=HKU" | python3.10 -m json.tool | head -20
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/db/models.py backend/app/core/dependencies.py backend/app/modules/school_choice/models/submissions.py backend/app/api/v1/routes/jupas_search.py backend/app/main.py backend/app/services/auth_service.py
git commit -m "feat: student auth model, choice submission table, JUPAS search endpoint"
```

---

## Task 5: Student Portal API (choices CRUD + submit)

**Files:**
- Create: `backend/app/api/v1/routes/student_portal.py`
- Create: `backend/tests/test_student_portal.py`

- [ ] **Step 1: Create student portal routes**

```python
# backend/app/api/v1/routes/student_portal.py
"""Student-facing API: read grades, manage JUPAS choices, submit for approval."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_student, get_db
from app.db.models import User
from app.db.models_v2 import StudentSubjectGrade, Subject
from app.modules.school_choice.models.models import Student, JupasProgramme
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme
from app.services.student_data_builder import build_student_data

router = APIRouter(prefix="/student", tags=["student-portal"])


# --- Grades (read-only) ---

@router.get("/grades")
def get_my_grades(
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Get authenticated student's grades (read-only)."""
    grades = (
        db.query(StudentSubjectGrade)
        .join(Subject, StudentSubjectGrade.subject_id == Subject.id)
        .filter(StudentSubjectGrade.student_id == current_user.student_id)
        .order_by(Subject.code, StudentSubjectGrade.year_of_exam.desc())
        .all()
    )
    return {
        "grades": [
            {
                "subject_code": g.subject.code if g.subject else None,
                "subject_name": g.subject.name if g.subject else None,
                "sitting": g.sitting,
                "year_of_exam": g.year_of_exam,
                "raw_grade": g.raw_grade,
                "predicted_grade": g.predicted_grade,
            }
            for g in grades
        ]
    }


# --- Choices ---

class ChoiceItem(BaseModel):
    rank: int
    jupas_code: str
    programme_name: str
    school_name: str | None = None
    notes: str | None = None

class ChoicesPayload(BaseModel):
    choices: list[ChoiceItem]


@router.get("/choices")
def get_my_choices(
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Get current draft/pending submission."""
    sub = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == current_user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "pending", "revision_requested"]),
        )
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not sub:
        return {"submission": None}
    return {
        "submission": {
            "id": str(sub.id),
            "status": sub.status,
            "choices": sub.choices or [],
            "counsellor_notes": sub.counsellor_notes,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
        }
    }


@router.put("/choices")
def save_my_choices(
    payload: ChoicesPayload,
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Save choices as draft or update revision."""
    # Validate: no duplicate JUPAS codes
    codes = [c.jupas_code for c in payload.choices]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=400, detail="Duplicate programme in choices.")
    if len(payload.choices) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 choices allowed.")

    # Validate JUPAS codes exist
    for c in payload.choices:
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == c.jupas_code).first()
        if not prog:
            raise HTTPException(status_code=400, detail=f"Unknown JUPAS code: {c.jupas_code}")

    # Find or create submission
    sub = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == current_user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .first()
    )
    if not sub:
        sub = StudentChoiceSubmission(student_id=current_user.student_id, status="draft")
        db.add(sub)

    if sub.status == "pending":
        raise HTTPException(status_code=409, detail="Submission is pending approval. Cannot edit.")

    sub.choices = [c.model_dump() for c in payload.choices]
    sub.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sub)

    return {"id": str(sub.id), "status": sub.status, "choices": sub.choices}


@router.post("/choices/submit")
def submit_choices(
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Submit current draft for counsellor approval."""
    sub = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == current_user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="No draft submission found.")

    sub.status = "pending"
    sub.submitted_at = datetime.now(timezone.utc)
    sub.counsellor_notes = None  # Clear previous counsellor notes on resubmit
    db.commit()

    return {"id": str(sub.id), "status": "pending"}


@router.get("/choices/match")
def get_match_scores(
    current_user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Compute real-time JUPAS match scores for student's current choices."""
    student = db.query(Student).filter(Student.id == current_user.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    sub = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == current_user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "pending", "revision_requested"]),
        )
        .first()
    )
    if not sub or not sub.choices:
        return {"scores": []}

    student_data = build_student_data(student, db)
    student_grades = student_data.get("subject_grades_detail", [])

    scores = []
    for choice in sub.choices:
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == choice["jupas_code"]).first()
        if not prog:
            scores.append({"jupas_code": choice["jupas_code"], "match_score": None, "error": "Programme not found"})
            continue

        prog_dict = {
            "jupas_code": prog.jupas_code,
            "name": prog.name,
            "scoring_formula": prog.scoring_formula,
            "minimum_requirements": prog.minimum_requirements,
            "admission_stats": prog.admission_stats,
        }
        try:
            result = score_student_for_programme(student_grades, prog_dict)
            scores.append({
                "jupas_code": choice["jupas_code"],
                "match_score": result.get("admission_probability"),
                "eligible": result.get("eligible", True),
                "risk_level": result.get("risk_level"),
            })
        except Exception:
            scores.append({"jupas_code": choice["jupas_code"], "match_score": None, "error": "Scoring failed"})

    return {"scores": scores}
```

- [ ] **Step 2: Register router in main.py**

```python
from app.api.v1.routes.student_portal import router as student_portal_router
app.include_router(student_portal_router, prefix="/api/v1")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/student_portal.py backend/app/main.py
git commit -m "feat: student portal API (grades, choices CRUD, submit, match scores)"
```

---

## Task 6: Counsellor Submission Review API

**Files:**
- Create: `backend/app/api/v1/routes/submissions.py`

- [ ] **Step 1: Create submissions review endpoints**

```python
# backend/app/api/v1/routes/submissions.py
"""Counsellor-facing submission review: list, detail, approve, revise, reject."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.db.models import User
from app.modules.school_choice.models.models import Student, StudentSchoolTarget, JupasProgramme, School
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme
from app.services.student_data_builder import build_student_data

router = APIRouter(prefix="/submissions", tags=["submissions"])


@router.get("")
def list_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List pending submissions for counsellor's org."""
    org_id = getattr(current_user, "active_organisation_id", None)
    query = (
        db.query(StudentChoiceSubmission)
        .join(Student, StudentChoiceSubmission.student_id == Student.id)
    )
    if org_id:
        query = query.filter(Student.organisation_id == org_id)

    subs = query.filter(StudentChoiceSubmission.status == "pending").order_by(StudentChoiceSubmission.submitted_at.desc()).all()

    return {
        "submissions": [
            {
                "id": str(s.id),
                "student_id": str(s.student_id),
                "student_name": s.student.name if s.student else "Unknown",
                "class_name": s.student.class_name if s.student else None,
                "status": s.status,
                "choice_count": len(s.choices) if s.choices else 0,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
            }
            for s in subs
        ],
        "total": len(subs),
    }


@router.get("/{submission_id}")
def get_submission_detail(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full submission with match scores."""
    sub = db.query(StudentChoiceSubmission).filter(StudentChoiceSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")

    student = db.query(Student).filter(Student.id == sub.student_id).first()
    student_data = build_student_data(student, db) if student else {}
    student_grades = student_data.get("subject_grades_detail", [])

    choices_with_scores = []
    for choice in (sub.choices or []):
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == choice.get("jupas_code")).first()
        match_score = None
        risk_level = None
        if prog:
            try:
                result = score_student_for_programme(student_grades, {
                    "jupas_code": prog.jupas_code, "name": prog.name,
                    "scoring_formula": prog.scoring_formula,
                    "minimum_requirements": prog.minimum_requirements,
                    "admission_stats": prog.admission_stats,
                })
                match_score = result.get("admission_probability")
                risk_level = result.get("risk_level")
            except Exception:
                pass

        rank = choice.get("rank", 0)
        band = "A" if rank <= 3 else "B" if rank <= 6 else "C" if rank <= 10 else "D" if rank <= 14 else "E"

        choices_with_scores.append({
            **choice,
            "band": band,
            "match_score": match_score,
            "risk_level": risk_level,
        })

    return {
        "id": str(sub.id),
        "student_id": str(sub.student_id),
        "student_name": student.name if student else "Unknown",
        "class_name": student.class_name if student else None,
        "status": sub.status,
        "choices": choices_with_scores,
        "counsellor_notes": sub.counsellor_notes,
        "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
    }


class ApproveRequest(BaseModel):
    pass  # No body needed

class ReviseRequest(BaseModel):
    notes: str

class RejectRequest(BaseModel):
    reason: str


@router.post("/{submission_id}/approve")
def approve_submission(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve submission — creates StudentSchoolTarget entries with JUPAS scoring."""
    sub = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.id == submission_id,
        StudentChoiceSubmission.status == "pending",
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Pending submission not found.")

    student = db.query(Student).filter(Student.id == sub.student_id).first()
    student_data = build_student_data(student, db) if student else {}
    student_grades = student_data.get("subject_grades_detail", [])

    # Band → preference_confidence mapping
    def rank_to_confidence(rank):
        if rank <= 3: return 5
        if rank <= 6: return 4
        if rank <= 10: return 3
        if rank <= 14: return 2
        return 1

    for choice in (sub.choices or []):
        jupas_code = choice.get("jupas_code")
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == jupas_code).first()
        school = db.query(School).filter(School.id == prog.school_id).first() if prog else None

        # Score with JUPAS
        match_score = 0.0
        eligibility = True
        at_risk = False
        if prog:
            try:
                result = score_student_for_programme(student_grades, {
                    "jupas_code": prog.jupas_code, "name": prog.name,
                    "scoring_formula": prog.scoring_formula,
                    "minimum_requirements": prog.minimum_requirements,
                    "admission_stats": prog.admission_stats,
                })
                match_score = result.get("admission_probability", 0.0)
                eligibility = result.get("eligible", True)
                at_risk = result.get("risk_level") == "at_risk"
            except Exception:
                pass

        rank = choice.get("rank", 0)

        # Upsert target
        existing = (
            db.query(StudentSchoolTarget)
            .filter(
                StudentSchoolTarget.student_id == sub.student_id,
                StudentSchoolTarget.jupas_code == jupas_code,
            )
            .first()
        )
        if existing:
            existing.student_rank = rank
            existing.match_score = match_score
            existing.eligibility_pass = eligibility
            existing.at_risk = at_risk
            existing.programme_name = choice.get("programme_name")
            existing.preference_confidence = rank_to_confidence(rank)
            existing.status = "CONSIDERING"
        else:
            target = StudentSchoolTarget(
                student_id=sub.student_id,
                school_id=prog.school_id if prog else None,
                jupas_code=jupas_code,
                programme_name=choice.get("programme_name"),
                student_rank=rank,
                match_score=match_score,
                eligibility_pass=eligibility,
                at_risk=at_risk,
                preference_confidence=rank_to_confidence(rank),
                status="CONSIDERING",
                intended_majors=[choice.get("programme_name")] if choice.get("programme_name") else None,
            )
            if target.school_id:
                db.add(target)

    sub.status = "approved"
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = current_user.id
    db.commit()

    return {"status": "approved", "targets_created": len(sub.choices or [])}


@router.post("/{submission_id}/revise")
def revise_submission(
    submission_id: UUID,
    body: ReviseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send submission back to student for revision."""
    sub = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.id == submission_id,
        StudentChoiceSubmission.status == "pending",
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Pending submission not found.")

    sub.status = "revision_requested"
    sub.counsellor_notes = body.notes
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = current_user.id
    db.commit()

    return {"status": "revision_requested"}


@router.post("/{submission_id}/reject")
def reject_submission(
    submission_id: UUID,
    body: RejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject submission."""
    sub = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.id == submission_id,
        StudentChoiceSubmission.status == "pending",
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Pending submission not found.")

    sub.status = "rejected"
    sub.counsellor_notes = body.reason
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reviewed_by = current_user.id
    db.commit()

    return {"status": "rejected"}
```

- [ ] **Step 2: Register in main.py**

```python
from app.api.v1.routes.submissions import router as submissions_router
app.include_router(submissions_router, prefix="/api/v1")
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/submissions.py backend/app/main.py
git commit -m "feat: counsellor submission review API (approve, revise, reject)"
```

---

## Task 7: Student App Frontend (Vite SPA)

**Files:**
- Create: `apps/student/` (entire app — package.json, vite.config.js, index.html, src/*)

- [ ] **Step 1: Scaffold student app**

```bash
mkdir -p apps/student/src/pages apps/student/src/components apps/student/src/api
```

Create `apps/student/package.json`:
```json
{
  "name": "@schoolchoice/student",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "@schoolchoice/ui": "workspace:*",
    "sonner": "^2.0.7",
    "lucide-react": "^1.11.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.6.0",
    "vite": "^8.0.0"
  }
}
```

Create `apps/student/vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
```

Create `apps/student/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SchoolChoice — Student Portal</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

Create `apps/student/.env.example`:
```
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 2: Create main.jsx, App.jsx, and API client**

Create `apps/student/src/main.jsx`, `apps/student/src/App.jsx`, and `apps/student/src/api/student.js` — the Login, MyGrades, and MyChoices pages with programme search autocomplete, band-coloured ranked list, real-time match scores, and submit-for-approval flow.

The student app is a lightweight 3-page SPA: Login → MyGrades (read-only) → MyChoices (core feature). It shares `@schoolchoice/ui` for primitives and uses the same JWT auth pattern as the counsellor app but with `candidate_number` as the login field.

- [ ] **Step 3: Install dependencies and verify app starts**

```bash
cd apps/student && pnpm install
pnpm dev
# Should start on a free port (5176 or similar)
```

- [ ] **Step 4: Commit**

```bash
git add apps/student/
git commit -m "feat: student choice app (login, grades, programme selection with bands)"
```

---

## Task 8: Counsellor Submission Review UI

**Files:**
- Create: `apps/web/src/pages/Submissions/SubmissionList.jsx`
- Create: `apps/web/src/pages/Submissions/SubmissionDetail.jsx`
- Create: `apps/web/src/api/submissions.js`
- Modify: `apps/web/src/App.jsx` — add routes
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx` — add pending count metric
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx` — add nav link

- [ ] **Step 1: Create submissions API client**

```javascript
// apps/web/src/api/submissions.js
import client from '@schoolchoice/ui/api/client';

export const getSubmissions = () => client.get('/api/v1/submissions').then(r => r.data);
export const getSubmission = (id) => client.get(`/api/v1/submissions/${id}`).then(r => r.data);
export const approveSubmission = (id) => client.post(`/api/v1/submissions/${id}/approve`).then(r => r.data);
export const reviseSubmission = (id, notes) => client.post(`/api/v1/submissions/${id}/revise`, { notes }).then(r => r.data);
export const rejectSubmission = (id, reason) => client.post(`/api/v1/submissions/${id}/reject`, { reason }).then(r => r.data);
```

- [ ] **Step 2: Create SubmissionList and SubmissionDetail pages**

SubmissionList shows pending student submissions with: student name, class, choice count, submitted date. Click navigates to detail.

SubmissionDetail shows all 25 choices in a table with: rank, band (colour-coded: A=pink, B=yellow, C=green, D=blue, E=grey), programme name, JUPAS code, match %, risk level. Three action buttons: Approve, Send Back (with notes modal), Reject (with reason modal).

- [ ] **Step 3: Add routes + nav link + dashboard metric**

Add `/submissions` and `/submissions/:id` routes in App.jsx. Add "Submissions" link in NavBarV2. Add "Pending Submissions: N" metric card on dashboard using `getSubmissions` query.

- [ ] **Step 4: Test end-to-end: student submits → counsellor sees → approves → targets created**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Submissions/ apps/web/src/api/submissions.js apps/web/src/App.jsx apps/web/src/pages/Dashboard/Dashboard.jsx apps/web/src/components/NavBarV2/NavBarV2.jsx
git commit -m "feat: counsellor submission review UI (list, detail, approve/revise/reject)"
```

---

## Execution Summary

| Task | What It Builds | Dependencies |
|------|---------------|-------------|
| 1 | Import service (parse, validate, commit) | None |
| 2 | Import API endpoints | Task 1 |
| 3 | Import wizard frontend | Task 2 |
| 4 | Student auth + submission model + JUPAS search | None |
| 5 | Student portal API (grades, choices, submit) | Task 4 |
| 6 | Counsellor submission review API | Task 4 |
| 7 | Student app frontend (3 pages) | Task 5 |
| 8 | Counsellor submission review UI | Task 6 |

Tasks 1–3 (CSV import) and Tasks 4–8 (student choice app) are independent streams. Within each stream, tasks are sequential.
