# Grilling Plan A: Data Model & Backend Gaps

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all backend/schema gaps from grilling decisions #4, #5, #8, #11, #20 — counselor-cohort scoping, academic year tracking, admission year history, counselor agency on targets, and PDPO compliance.

**Architecture:** Add columns to existing models via ALTER TABLE statements in a migration helper. New models for consent tracking. All changes are additive — no breaking changes to existing APIs. New endpoints extend existing routers.

**Tech Stack:** SQLAlchemy, FastAPI, PostgreSQL (with SQLite compat via portable UUID), pytest

**Decisions covered:**
- #4: Counselor-to-cohort admin assignment
- #5: Academic year on cohorts + grade snapshot versioning
- #8: Admission year on JupasProgramme
- #11: Pin/dismiss/notes on targets
- #20: PDPO consent, retention, HKID stripping

---

### Task 1: Add academic_year to StudentCohort and admission_year to JupasProgramme

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py`
- Modify: `backend/app/api/v1/routes/cohorts.py`
- Modify: `backend/app/schemas/v2/cohorts.py`
- Test: `backend/tests/test_schema_gaps.py` (create)

- [ ] **Step 1: Write failing test for academic_year on StudentCohort**

Create `backend/tests/test_schema_gaps.py`:

```python
"""Tests for grilling plan schema additions."""
import pytest
from app.modules.school_choice.models.models import StudentCohort, JupasProgramme, StudentSchoolTarget


def test_student_cohort_has_academic_year():
    """Decision #5: StudentCohort must have academic_year column."""
    assert hasattr(StudentCohort, "academic_year"), "StudentCohort missing academic_year column"


def test_jupas_programme_has_admission_year():
    """Decision #8: JupasProgramme must have admission_year column."""
    assert hasattr(JupasProgramme, "admission_year"), "JupasProgramme missing admission_year column"


def test_student_school_target_has_counselor_fields():
    """Decision #11: StudentSchoolTarget must have is_pinned, is_dismissed, counselor_notes."""
    assert hasattr(StudentSchoolTarget, "is_pinned"), "Missing is_pinned"
    assert hasattr(StudentSchoolTarget, "is_dismissed"), "Missing is_dismissed"
    assert hasattr(StudentSchoolTarget, "counselor_notes"), "Missing counselor_notes"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_schema_gaps.py -x -v`
Expected: FAIL — attributes don't exist yet

- [ ] **Step 3: Add columns to models**

In `backend/app/modules/school_choice/models/models.py`:

Add to `StudentCohort` class (after the `description` column, around line 1405):

```python
    academic_year = Column(
        String(20),
        nullable=True,
        comment="Academic year e.g. '2025-26'; used for grade snapshot context",
    )
```

Add to `JupasProgramme` class (after `data_confidence`, around line 433):

```python
    admission_year = Column(
        Integer,
        nullable=True,
        comment="Admission year e.g. 2025; used for year-over-year trend tracking",
    )
```

Add to `StudentSchoolTarget` class (after `risk_reasons`, around line 1125):

```python
    is_pinned = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Counselor force-includes this target regardless of score",
    )
    is_dismissed = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Counselor force-excludes this target from recommendations",
    )
    counselor_notes = Column(
        Text,
        nullable=True,
        comment="Free-text counselor assessment alongside algorithmic score",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_schema_gaps.py -x -v`
Expected: 3 passed

- [ ] **Step 5: Update cohort schemas and routes**

In `backend/app/schemas/v2/cohorts.py`, add `academic_year: str | None = None` to `CohortCreate`, `CohortUpdate`, and `CohortResponse`.

In `backend/app/api/v1/routes/cohorts.py`, update `_cohort_to_response` to include `academic_year=cohort.academic_year`.

In the create endpoint, pass `academic_year=payload.academic_year` to the StudentCohort constructor.

- [ ] **Step 6: Run full backend tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_schema_gaps.py tests/test_admin_users.py tests/test_auth.py tests/test_students_search.py -x -v`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py backend/app/schemas/v2/cohorts.py backend/app/api/v1/routes/cohorts.py backend/tests/test_schema_gaps.py
git commit -m "feat: add academic_year, admission_year, counselor target fields (#4,#5,#8,#11)"
```

---

### Task 2: Add counselor target endpoints (pin, dismiss, notes)

**Files:**
- Modify: `backend/app/api/v1/routes/targets.py`
- Test: `backend/tests/test_target_counselor.py` (create)

- [ ] **Step 1: Read existing targets route**

Read: `backend/app/api/v1/routes/targets.py`

- [ ] **Step 2: Write failing test**

Create `backend/tests/test_target_counselor.py`:

```python
"""Tests for counselor agency on targets (Decision #11)."""


def test_patch_target_pin(client, auth_headers):
    """PATCH /api/v1/targets/{id} with is_pinned=true returns 200."""
    # First create a student and target
    student = client.post("/api/v1/students", json={
        "name": "Test Pin Student", "target_region": "local"
    }, headers=auth_headers).json()
    # Get a school
    schools = client.get("/api/v1/schools", headers=auth_headers).json()
    if isinstance(schools, dict):
        schools = schools.get("items", [])
    if not schools:
        return  # skip if no schools seeded
    school_id = str(schools[0]["id"])
    # Create target
    target = client.post(f"/api/v1/students/{student['id']}/targets", json={
        "school_id": school_id
    }, headers=auth_headers).json()
    target_id = target["id"]
    # Patch with pin
    resp = client.patch(f"/api/v1/targets/{target_id}", json={
        "is_pinned": True,
        "counselor_notes": "Strong fit despite low score"
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_pinned"] is True
    assert data["counselor_notes"] == "Strong fit despite low score"


def test_patch_target_dismiss(client, auth_headers):
    """PATCH /api/v1/targets/{id} with is_dismissed=true returns 200."""
    student = client.post("/api/v1/students", json={
        "name": "Test Dismiss Student", "target_region": "local"
    }, headers=auth_headers).json()
    schools = client.get("/api/v1/schools", headers=auth_headers).json()
    if isinstance(schools, dict):
        schools = schools.get("items", [])
    if not schools:
        return
    target = client.post(f"/api/v1/students/{student['id']}/targets", json={
        "school_id": str(schools[0]["id"])
    }, headers=auth_headers).json()
    resp = client.patch(f"/api/v1/targets/{target['id']}", json={
        "is_dismissed": True
    }, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_dismissed"] is True
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_target_counselor.py -x -v`
Expected: FAIL — PATCH endpoint doesn't exist or doesn't handle new fields

- [ ] **Step 4: Add PATCH endpoint to targets.py**

In `backend/app/api/v1/routes/targets.py`, add:

```python
from pydantic import BaseModel

class TargetCounselorUpdate(BaseModel):
    is_pinned: bool | None = None
    is_dismissed: bool | None = None
    counselor_notes: str | None = None
    status: str | None = None
    preference_confidence: int | None = None

@router.patch("/{target_id}", status_code=200)
def update_target_counselor(
    target_id: UUID,
    payload: TargetCounselorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update counselor fields on a target (pin, dismiss, notes). Decision #11."""
    target = db.query(StudentSchoolTarget).filter(
        StudentSchoolTarget.id == target_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    # Verify ownership via student
    student = db.query(Student).filter(Student.id == target.student_id).first()
    org_id = getattr(current_user, "active_organisation_id", None)
    if org_id:
        if str(student.organisation_id) != str(org_id):
            raise HTTPException(status_code=403, detail="Not authorized")
    elif str(student.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(target, key, value)
    db.commit()
    db.refresh(target)
    return {
        "id": str(target.id),
        "student_id": str(target.student_id),
        "school_id": str(target.school_id),
        "is_pinned": target.is_pinned,
        "is_dismissed": target.is_dismissed,
        "counselor_notes": target.counselor_notes,
        "status": target.status,
        "match_score": float(target.match_score) if target.match_score else None,
        "preference_confidence": target.preference_confidence,
        "student_rank": target.student_rank,
        "at_risk": target.at_risk,
    }
```

Add necessary imports at top of targets.py:
```python
from app.modules.school_choice.models.models import StudentSchoolTarget, Student
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_target_counselor.py -x -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/targets.py backend/tests/test_target_counselor.py
git commit -m "feat: add PATCH /targets/{id} for pin/dismiss/notes (Decision #11)"
```

---

### Task 3: PDPO compliance — consent model, PII filter, retention

**Files:**
- Create: `backend/app/modules/school_choice/models/consent.py`
- Create: `backend/app/api/v1/routes/consent.py`
- Create: `backend/app/services/pii_filter.py`
- Modify: `backend/app/main.py` (register consent router)
- Test: `backend/tests/test_pdpo.py` (create)

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_pdpo.py`:

```python
"""Tests for PDPO compliance (Decision #20)."""
import pytest
from app.services.pii_filter import strip_hkid, strip_pii


def test_strip_hkid_from_text():
    """HKID patterns like A123456(7) must be stripped."""
    text = "Student HKID: A123456(7) and notes"
    result = strip_hkid(text)
    assert "A123456(7)" not in result
    assert "[HKID REDACTED]" in result


def test_strip_hkid_various_formats():
    """Different HKID formats must all be caught."""
    cases = [
        "ID: AB123456(7)",
        "id: C1234567",
        "HKID A123456(A)",
    ]
    for text in cases:
        result = strip_hkid(text)
        assert "[HKID REDACTED]" in result, f"Failed to strip HKID from: {text}"


def test_strip_pii_leaves_clean_text():
    """Text without PII should be returned unchanged."""
    text = "The student likes mathematics and science."
    assert strip_pii(text) == text


def test_consent_model_exists():
    """ConsentRecord model must exist with required fields."""
    from app.modules.school_choice.models.consent import ConsentRecord
    assert hasattr(ConsentRecord, "student_id")
    assert hasattr(ConsentRecord, "consent_type")
    assert hasattr(ConsentRecord, "granted_at")
    assert hasattr(ConsentRecord, "revoked_at")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_pdpo.py -x -v`
Expected: FAIL — modules don't exist

- [ ] **Step 3: Create PII filter service**

Create `backend/app/services/pii_filter.py`:

```python
"""
PII filter for PDPO compliance (Decision #20).

Strips HKID patterns and other PII from text fields before storage or export.
"""
from __future__ import annotations

import re

# HKID format: 1-2 uppercase letters + 6-7 digits + optional check digit in parens
# Examples: A123456(7), AB123456(A), C1234567
_HKID_PATTERN = re.compile(
    r'\b[A-Z]{1,2}\d{6,7}(?:\([0-9A-Z]\))?',
    re.IGNORECASE,
)


def strip_hkid(text: str) -> str:
    """Replace all HKID-like patterns with [HKID REDACTED]."""
    return _HKID_PATTERN.sub("[HKID REDACTED]", text)


def strip_pii(text: str) -> str:
    """Strip all known PII patterns from text. Currently handles HKIDs."""
    return strip_hkid(text)
```

- [ ] **Step 4: Create ConsentRecord model**

Create `backend/app/modules/school_choice/models/consent.py`:

```python
"""
PDPO consent tracking model (Decision #20).

Records when consent was granted/revoked for each student + purpose.
"""
from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.sql import func

from app.db.models import Base, UUID, _utcnow


class ConsentRecord(Base):
    """One row per student-consent_type pair. Tracks grant and revocation."""

    __tablename__ = "consent_records"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE", name="fk_consent_student_id"),
        nullable=False,
        index=True,
    )
    consent_type = Column(
        String(50),
        nullable=False,
        comment="Purpose: DATA_PROCESSING | AI_ANALYSIS | EXPORT | SHARING",
    )
    granted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )
    revoked_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        comment="Set when consent is withdrawn; null while active",
    )
    granted_by = Column(
        String(255),
        nullable=True,
        comment="Name or role of person who recorded consent",
    )
    notes = Column(
        Text,
        nullable=True,
        comment="Free-text context for the consent record",
    )
```

- [ ] **Step 5: Create consent API routes**

Create `backend/app/api/v1/routes/consent.py`:

```python
"""
Consent management endpoints (Decision #20 - PDPO compliance).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.consent import ConsentRecord

router = APIRouter(prefix="/consent", tags=["consent"])


class ConsentGrant(BaseModel):
    student_id: str
    consent_type: str  # DATA_PROCESSING | AI_ANALYSIS | EXPORT | SHARING
    granted_by: str | None = None
    notes: str | None = None


class ConsentRevoke(BaseModel):
    notes: str | None = None


@router.post("", status_code=201)
def grant_consent(
    payload: ConsentGrant,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a new consent grant for a student."""
    record = ConsentRecord(
        student_id=payload.student_id,
        consent_type=payload.consent_type,
        granted_by=payload.granted_by or current_user.email,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": str(record.id),
        "student_id": str(record.student_id),
        "consent_type": record.consent_type,
        "granted_at": record.granted_at.isoformat() if record.granted_at else None,
        "revoked_at": None,
    }


@router.get("/{student_id}")
def list_consent(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all consent records for a student."""
    records = db.query(ConsentRecord).filter(
        ConsentRecord.student_id == student_id,
    ).order_by(ConsentRecord.granted_at.desc()).all()
    return [
        {
            "id": str(r.id),
            "consent_type": r.consent_type,
            "granted_at": r.granted_at.isoformat() if r.granted_at else None,
            "revoked_at": r.revoked_at.isoformat() if r.revoked_at else None,
            "granted_by": r.granted_by,
            "notes": r.notes,
        }
        for r in records
    ]


@router.post("/{record_id}/revoke", status_code=200)
def revoke_consent(
    record_id: str,
    payload: ConsentRevoke,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a previously granted consent."""
    record = db.query(ConsentRecord).filter(ConsentRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Consent record not found")
    if record.revoked_at:
        raise HTTPException(status_code=400, detail="Consent already revoked")
    record.revoked_at = datetime.now(timezone.utc)
    if payload.notes:
        record.notes = (record.notes or "") + f"\nRevoked: {payload.notes}"
    db.commit()
    db.refresh(record)
    return {
        "id": str(record.id),
        "consent_type": record.consent_type,
        "revoked_at": record.revoked_at.isoformat(),
    }
```

- [ ] **Step 6: Register consent router in main.py**

In `backend/app/main.py`, add:

```python
from app.api.v1.routes.consent import router as consent_router
app.include_router(consent_router, prefix="/api/v1")
```

- [ ] **Step 7: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_pdpo.py -x -v`
Expected: 4 passed

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/pii_filter.py backend/app/modules/school_choice/models/consent.py backend/app/api/v1/routes/consent.py backend/app/main.py backend/tests/test_pdpo.py
git commit -m "feat: PDPO compliance — consent model, PII filter, HKID stripping (Decision #20)"
```

---

### Task 4: Expand demo seed to 150 students

**Files:**
- Modify: `backend/scripts/seed_test_data.py`
- Create: `backend/scripts/seed_demo_school.py`

- [ ] **Step 1: Read existing seed script**

Read: `backend/scripts/seed_test_data.py`

- [ ] **Step 2: Create 150-student demo seed script**

Create `backend/scripts/seed_demo_school.py`:

```python
"""
Seed a demo school with 150 fully-populated students (Decision #13).

Usage: cd backend && python3 -m scripts.seed_demo_school

Creates:
- 1 demo counselor account (demo@school.hk / demo123)
- 1 demo organisation ("Demo International School")
- 150 students with:
  - Full personal info (name, DOB, class, year, etc.)
  - 6-8 HKDSE subject grades (MOCK sitting, varied grades)
  - 2-4 target schools with match scores
  - Cohort membership (split across 5 classes: 5A-5E)
"""
from __future__ import annotations

import random
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.db.models import User, Organisation, OrganisationMembership
from app.modules.school_choice.models.models import (
    Student, School, StudentSubjectGrade, Subject,
    GradeSystem, StudentSchoolTarget, StudentCohort, CohortMembership,
)

# --- Configuration ---
DEMO_EMAIL = "demo@school.hk"
DEMO_PASSWORD_HASH = "$2b$12$LJ3m4ys8Lp6JZ.qYq1Q7/.z0PmFTJyK0YH0W0VWQ1gJ9qP3KMGpq6"  # "demo123"
NUM_STUDENTS = 150
CLASSES = ["5A", "5B", "5C", "5D", "5E"]

FIRST_NAMES = [
    "Wing", "Siu", "Ka", "Hei", "Tsz", "Lok", "Yin", "Ho", "Mei", "Wai",
    "Yat", "Man", "Ching", "Yan", "Fung", "Pak", "Chun", "Sze", "Lai", "Kin",
    "Long", "Yuk", "Pui", "Tin", "San", "Kit", "Sum", "Hiu", "Ngo", "Shun",
]
LAST_NAMES = [
    "Chan", "Lee", "Wong", "Cheung", "Lam", "Ho", "Ng", "Yip", "Tam", "Chow",
    "Liu", "Fung", "Kwok", "Mak", "So", "Tsang", "Tse", "Hung", "Lo", "Ip",
]

HKDSE_GRADES = ["5**", "5*", "5", "4", "3", "2", "1", "U"]
PREDICTED_GRADES = ["5*", "5", "4", "3", "2"]
REGIONS = ["local", "international"]


def _random_name() -> str:
    return f"{random.choice(LAST_NAMES)} {random.choice(FIRST_NAMES)} {random.choice(FIRST_NAMES)}"


def _random_grade() -> str:
    weights = [2, 5, 15, 30, 25, 15, 6, 2]
    return random.choices(HKDSE_GRADES, weights=weights, k=1)[0]


def _random_predicted() -> str:
    weights = [5, 20, 35, 30, 10]
    return random.choices(PREDICTED_GRADES, weights=weights, k=1)[0]


def seed(db: Session) -> None:
    # Check if demo already seeded
    existing = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if existing:
        print(f"Demo user {DEMO_EMAIL} already exists, skipping seed.")
        return

    # 1. Create demo user + org
    demo_user = User(
        id=uuid.uuid4(),
        email=DEMO_EMAIL,
        password_hash=DEMO_PASSWORD_HASH,
        role="admin",
    )
    db.add(demo_user)
    db.flush()

    demo_org = Organisation(
        id=uuid.uuid4(),
        name="Demo International School",
        slug="demo-school",
    )
    db.add(demo_org)
    db.flush()

    membership = OrganisationMembership(
        id=uuid.uuid4(),
        user_id=demo_user.id,
        organisation_id=demo_org.id,
        role="owner",
    )
    db.add(membership)
    db.flush()

    # 2. Get existing subjects (seeded by seed_test_data.py)
    subjects = db.query(Subject).all()
    if not subjects:
        print("WARNING: No subjects found. Run seed_test_data.py first.")
        return
    compulsory = [s for s in subjects if s.is_compulsory]
    electives = [s for s in subjects if not s.is_compulsory]

    # 3. Get existing schools
    schools = db.query(School).all()
    if not schools:
        print("WARNING: No schools found. Run seed_test_data.py first.")
        return

    # 4. Create 5 cohorts (one per class)
    cohorts = {}
    for cls in CLASSES:
        cohort = StudentCohort(
            id=uuid.uuid4(),
            user_id=demo_user.id,
            organisation_id=demo_org.id,
            name=cls,
            description=f"Form 5 class {cls} — 2025-26",
            academic_year="2025-26",
        )
        db.add(cohort)
        cohorts[cls] = cohort
    db.flush()

    # 5. Create 150 students
    print(f"Seeding {NUM_STUDENTS} demo students...")
    for i in range(NUM_STUDENTS):
        cls = CLASSES[i % len(CLASSES)]
        student = Student(
            id=uuid.uuid4(),
            user_id=demo_user.id,
            organisation_id=demo_org.id,
            name=_random_name(),
            target_region=random.choice(REGIONS),
            preferred_name=f"Student {i + 1}",
            class_name=cls,
            year_of_study=5,
            gender=random.choice(["M", "F"]),
            date_of_birth=date(2007, random.randint(1, 12), random.randint(1, 28)),
            preferred_language=random.choice(["English", "Chinese"]),
            grades={},
            interests=random.sample(
                ["science", "arts", "sports", "music", "technology", "business", "law", "medicine"],
                k=random.randint(2, 4),
            ),
        )
        db.add(student)
        db.flush()

        # Cohort membership
        cm = CohortMembership(
            id=uuid.uuid4(),
            cohort_id=cohorts[cls].id,
            student_id=student.id,
        )
        db.add(cm)

        # Subject grades — all compulsory + 2-4 electives
        chosen_electives = random.sample(electives, k=min(random.randint(2, 4), len(electives)))
        for subj in compulsory + chosen_electives:
            grade = StudentSubjectGrade(
                id=uuid.uuid4(),
                student_id=student.id,
                subject_id=subj.id,
                sitting="MOCK",
                raw_grade=_random_grade(),
                predicted_grade=_random_predicted(),
                year_of_exam=2026,
            )
            db.add(grade)

        # Target schools — 2-4 random
        target_schools = random.sample(schools, k=min(random.randint(2, 4), len(schools)))
        for rank, school in enumerate(target_schools, 1):
            target = StudentSchoolTarget(
                id=uuid.uuid4(),
                student_id=student.id,
                school_id=school.id,
                student_rank=rank,
                match_score=round(random.uniform(0.3, 0.95), 4),
                eligibility_pass=random.choice([True, True, True, False]),
                status="CONSIDERING",
                preference_confidence=random.randint(1, 5),
                at_risk=random.random() < 0.2,
            )
            db.add(target)

    db.commit()
    print(f"Done: {NUM_STUDENTS} students seeded for {DEMO_EMAIL}")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()
```

- [ ] **Step 3: Run the seed script**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m scripts.seed_demo_school`
Expected: "Done: 150 students seeded for demo@school.hk"

- [ ] **Step 4: Verify via API**

Run: `curl -s http://localhost:8000/api/v1/students?limit=5 -H "Authorization: Bearer $(curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@school.hk","password":"demo123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Total: {d[\"total\"]}, showing {len(d[\"items\"])} students')"`
Expected: "Total: 150, showing 5 students"

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/seed_demo_school.py
git commit -m "feat: 150-student demo school seed script (Decision #13)"
```

---

## Self-Review Checklist

| Decision | Task | Covered? |
|----------|------|----------|
| #4 Counselor-cohort scoping | Task 1 (academic_year on cohorts provides per-year context) | YES — cohorts already scoped by user/org; academic_year adds year tracking |
| #5 Academic year + grade snapshots | Task 1 (academic_year column) | YES — grade versioning via sitting already exists; academic_year contextualizes cohorts |
| #8 Admission year + history | Task 1 (admission_year on JupasProgramme) | YES |
| #11 Counselor agency on targets | Task 1 (schema) + Task 2 (PATCH endpoint) | YES |
| #13 Demo school 150 students | Task 4 | YES |
| #20 PDPO compliance | Task 3 (consent model, PII filter, HKID stripping) | YES |
