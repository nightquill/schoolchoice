"""
Seed a 150-student demo school into the database.

Creates:
- Demo user (demo@school.hk / demo123)
- Organisation "Demo International School" (slug: demo-school)
- OrganisationMembership (owner)
- 5 cohorts (5A-5E, academic year 2025-26)
- 150 students with random HK names, grades, and target schools
- CohortMemberships, StudentSubjectGrades, StudentSchoolTargets

Idempotent — skips if demo user already exists.

Usage: cd backend && python3 -m scripts.seed_demo_school
"""
from __future__ import annotations

import sys
import os
import uuid
import random
from datetime import date
from decimal import Decimal
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DATABASE_URL", "sqlite:///./app.db")
os.environ.setdefault("SECRET_KEY", "local-dev-key-not-placeholder-safe-for-development")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from app.db.session import SessionLocal, engine
from app.db.models import Base, User, Organisation, OrganisationMembership
from app.db.models_v2 import (
    Subject, StudentSubjectGrade, StudentSchoolTarget,
    StudentCohort, CohortMembership,
)
from app.modules.school_choice.models.models import Student, School
from app.core.security import get_password_hash

# Ensure all tables exist (create_all only adds missing tables, not columns)
Base.metadata.create_all(bind=engine)

# Patch missing columns in SQLite — compare ORM definitions vs actual DB schema
from sqlalchemy import text as _text, inspect as _inspect
with engine.connect() as _conn:
    _inspector = _inspect(engine)
    _existing_tables = _inspector.get_table_names()
    for _table_obj in Base.metadata.sorted_tables:
        _tname = _table_obj.name
        if _tname not in _existing_tables:
            continue
        _existing_cols = {c["name"] for c in _inspector.get_columns(_tname)}
        for _col_obj in _table_obj.columns:
            if _col_obj.name not in _existing_cols:
                _ctype = _col_obj.type.compile(engine.dialect)
                try:
                    _conn.execute(_text(f"ALTER TABLE {_tname} ADD COLUMN {_col_obj.name} {_ctype}"))
                    _conn.commit()
                    print(f"  [migrate] Added {_tname}.{_col_obj.name}")
                except Exception:
                    pass  # column may already exist in a concurrent run

db = SessionLocal()

# ── Config ───────────────────────────────────────────────────────────────────

DEMO_EMAIL = "demo@school.hk"
DEMO_PASSWORD = "demo123"
ORG_NAME = "Demo International School"
ORG_SLUG = "demo-school"
NUM_STUDENTS = 150
CLASSES = ["5A", "5B", "5C", "5D", "5E"]
ACADEMIC_YEAR = "2025-26"

# HKDSE grade distribution — weighted toward middle grades
HKDSE_GRADES = ["5**", "5*", "5", "4", "3", "2", "1", "U"]
HKDSE_WEIGHTS = [2, 4, 8, 20, 30, 20, 10, 6]  # weighted toward 3-4

# Compulsory subject codes
COMPULSORY_CODES = ["CHLA", "ENGL", "MATH", "CSD"]
# Elective subject codes
ELECTIVE_CODES = [
    "PHYS", "CHEM", "BIOL", "ECON", "BAFS", "GEOG",
    "HIST", "CHIH", "CHIL", "VART", "MUSC", "ICT", "M1", "M2",
]

# HK name pools
SURNAMES = [
    "Chan", "Lee", "Wong", "Cheung", "Lau", "Ho", "Ng",
    "Tam", "Yuen", "Kwok", "Yeung", "Cheng", "Leung",
    "Fung", "Tsang", "Lo", "Chow", "Mak", "Liu", "Tse",
]
MALE_FIRST_NAMES = [
    "Ka Ho", "Tsz Him", "Hoi Lam", "Chi Kin", "Wai Hung",
    "Siu Ming", "Ka Wai", "Ting Fung", "Lok Yin", "Ming Hin",
    "Chun Kit", "Yat Long", "Pak Hei", "Ho Yin", "Tsz Hin",
    "Ka Long", "Wai Lun", "Siu Fung", "Tsz Lok", "Man Ho",
]
FEMALE_FIRST_NAMES = [
    "Mei Ling", "Ka Yan", "Wing Sze", "Hoi Yan", "Sze Wan",
    "Tsz Ching", "Yee Man", "Ka Man", "Pui Shan", "Siu Wai",
    "Wing Yan", "Hoi Ching", "Sum Yi", "Lok Yan", "Sze Ki",
    "Ka Yi", "Man Wai", "Wing Lam", "Tsz Yan", "Pui Yi",
]
GENDERS = ["Male", "Female"]
LANGUAGES = ["en", "zh-HK"]
REGIONS = ["local", "international"]

INTERESTS_POOL = [
    "robotics", "music", "basketball", "swimming", "debate",
    "photography", "chess", "coding", "art", "drama",
    "volleyball", "badminton", "reading", "community service",
    "environmental conservation", "creative writing", "dance",
    "film-making", "entrepreneurship", "cooking",
]


# ── Helpers ──────────────────────────────────────────────────────────────────

def random_dob() -> date:
    """Random DOB for a year-5 student (born 2008-2009)."""
    year = random.choice([2008, 2009])
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(year, month, day)


def random_hk_name(gender: str) -> str:
    surname = random.choice(SURNAMES)
    if gender == "Male":
        first = random.choice(MALE_FIRST_NAMES)
    else:
        first = random.choice(FEMALE_FIRST_NAMES)
    return f"{surname} {first}"


def weighted_grade() -> str:
    return random.choices(HKDSE_GRADES, weights=HKDSE_WEIGHTS, k=1)[0]


def csd_grade() -> str:
    """CSD uses Attained/Not Attained, not numeric grades."""
    return random.choices(["A", "NA"], weights=[85, 15], k=1)[0]


# ── Main ─────────────────────────────────────────────────────────────────────

print("=" * 60)
print("Seeding 150-student demo school")
print("=" * 60)

# Check if demo user already exists
existing_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
if existing_user:
    print(f"  Demo user '{DEMO_EMAIL}' already exists. Skipping seed.")
    db.close()
    sys.exit(0)

# ── 1. Demo user ─────────────────────────────────────────────────────────
print("  Creating demo user...")
demo_user = User(
    email=DEMO_EMAIL,
    hashed_password=get_password_hash(DEMO_PASSWORD),
    display_name="Demo Counsellor",
    role="counsellor",
    is_active=True,
)
db.add(demo_user)
db.flush()
print(f"    User: {demo_user.email} (id={demo_user.id})")

# ── 2. Organisation ─────────────────────────────────────────────────────
print("  Creating organisation...")
org = Organisation(
    name=ORG_NAME,
    slug=ORG_SLUG,
    is_active=True,
)
db.add(org)
db.flush()
print(f"    Org: {org.name} (slug={org.slug})")

# ── 3. OrganisationMembership ───────────────────────────────────────────
membership = OrganisationMembership(
    organisation_id=org.id,
    user_id=demo_user.id,
    role="owner",
)
db.add(membership)
db.flush()
print(f"    Membership: user -> org as owner")

# ── 4. Load existing subjects and schools ────────────────────────────────
subjects = db.query(Subject).all()
subject_map = {s.code: s for s in subjects}
if not subject_map:
    print("  ERROR: No subjects found. Run seed_test_data.py first.")
    db.close()
    sys.exit(1)

schools = db.query(School).all()
if not schools:
    print("  ERROR: No schools found. Run seed_test_data.py first.")
    db.close()
    sys.exit(1)

print(f"    Found {len(subject_map)} subjects, {len(schools)} schools")

# ── 5. Cohorts (5A-5E) ──────────────────────────────────────────────────
print("  Creating cohorts...")
cohort_map = {}
for class_name in CLASSES:
    cohort = StudentCohort(
        user_id=demo_user.id,
        organisation_id=org.id,
        name=f"{class_name} {ACADEMIC_YEAR}",
        description=f"Form 5 class {class_name}, academic year {ACADEMIC_YEAR}",
        academic_year=ACADEMIC_YEAR,
    )
    db.add(cohort)
    db.flush()
    cohort_map[class_name] = cohort
    print(f"    Cohort: {cohort.name}")

# ── 6. Students ──────────────────────────────────────────────────────────
print(f"  Creating {NUM_STUDENTS} students...")
students_created = []

for i in range(NUM_STUDENTS):
    gender = random.choice(GENDERS)
    name = random_hk_name(gender)
    class_name = CLASSES[i % len(CLASSES)]  # round-robin
    region = random.choices(REGIONS, weights=[80, 20], k=1)[0]  # mostly local
    lang = random.choices(LANGUAGES, weights=[60, 40], k=1)[0]
    num_interests = random.randint(2, 4)
    interests = random.sample(INTERESTS_POOL, num_interests)

    student = Student(
        name=name,
        user_id=demo_user.id,
        organisation_id=org.id,
        gender=gender,
        year_of_study=5,
        target_region=region,
        class_name=class_name,
        date_of_birth=random_dob(),
        preferred_language=lang,
        interests=interests,
    )
    db.add(student)
    db.flush()
    students_created.append((student, class_name))

    if (i + 1) % 30 == 0:
        print(f"    ... {i + 1}/{NUM_STUDENTS} students created")

print(f"    All {NUM_STUDENTS} students created")

# ── 7. CohortMemberships ────────────────────────────────────────────────
print("  Creating cohort memberships...")
for student, class_name in students_created:
    cm = CohortMembership(
        cohort_id=cohort_map[class_name].id,
        student_id=student.id,
    )
    db.add(cm)

db.flush()
print(f"    {NUM_STUDENTS} cohort memberships created")

# ── 8. Subject grades ───────────────────────────────────────────────────
print("  Creating subject grades...")
grade_count = 0

for student, _ in students_created:
    # All compulsory subjects
    for code in COMPULSORY_CODES:
        subj = subject_map.get(code)
        if not subj:
            continue
        grade_val = csd_grade() if code == "CSD" else weighted_grade()
        g = StudentSubjectGrade(
            student_id=student.id,
            subject_id=subj.id,
            raw_grade=grade_val,
            sitting="MOCK",
            year_of_exam=2025,
        )
        db.add(g)
        grade_count += 1

    # 2-4 random electives
    num_electives = random.randint(2, 4)
    chosen_electives = random.sample(ELECTIVE_CODES, num_electives)
    for code in chosen_electives:
        subj = subject_map.get(code)
        if not subj:
            continue
        g = StudentSubjectGrade(
            student_id=student.id,
            subject_id=subj.id,
            raw_grade=weighted_grade(),
            sitting="MOCK",
            year_of_exam=2025,
        )
        db.add(g)
        grade_count += 1

db.flush()
print(f"    {grade_count} subject grades created")

# ── 9. Target schools ───────────────────────────────────────────────────
print("  Creating target schools...")
target_count = 0

for student, _ in students_created:
    num_targets = random.randint(2, 4)
    chosen_schools = random.sample(schools, min(num_targets, len(schools)))

    for rank, school in enumerate(chosen_schools, 1):
        match_score = Decimal(str(round(random.uniform(0.20, 0.95), 4)))
        eligibility = match_score >= Decimal("0.40")

        target = StudentSchoolTarget(
            student_id=student.id,
            school_id=school.id,
            student_rank=rank,
            match_score=match_score,
            eligibility_pass=eligibility,
            status="CONSIDERING",
            preference_confidence=random.randint(1, 5),
        )
        db.add(target)
        target_count += 1

db.flush()
print(f"    {target_count} target schools created")

# ── Commit ───────────────────────────────────────────────────────────────
db.commit()

# ── Verify ───────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("Verification")
print("=" * 60)

user = db.query(User).filter(User.email == DEMO_EMAIL).first()
student_count = db.query(Student).filter(Student.user_id == user.id).count()
cohort_count = db.query(StudentCohort).filter(StudentCohort.user_id == user.id).count()
total_grades = (
    db.query(StudentSubjectGrade)
    .join(Student, Student.id == StudentSubjectGrade.student_id)
    .filter(Student.user_id == user.id)
    .count()
)
total_targets = (
    db.query(StudentSchoolTarget)
    .join(Student, Student.id == StudentSchoolTarget.student_id)
    .filter(Student.user_id == user.id)
    .count()
)

print(f"  User:       {user.email} ({user.display_name})")
print(f"  Org:        {ORG_NAME} ({ORG_SLUG})")
print(f"  Cohorts:    {cohort_count}")
print(f"  Students:   {student_count}")
print(f"  Grades:     {total_grades}")
print(f"  Targets:    {total_targets}")

db.close()
print(f"\nDone. Login: {DEMO_EMAIL} / {DEMO_PASSWORD}")
