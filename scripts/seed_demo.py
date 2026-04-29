#!/usr/bin/env python3
"""Seed demo data for DataPilot school choice instance.

Usage: python scripts/seed_demo.py
Safe to re-run (idempotent) -- uses upsert pattern with fixed UUIDs.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Bootstrap: ensure backend/ is on sys.path so app.* imports work
# when running from the repository root (python scripts/seed_demo.py).
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND_DIR))

# Load .env before importing app modules (settings need DATABASE_URL etc.)
try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
except ImportError:
    pass  # dotenv is optional; env vars may already be set

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import Base, User
from app.db.session import SessionLocal, engine
from app.modules.school_choice.models.models import (
    AcademicPlan,
    ActionPlan,
    School,
    Student,
)

# ---------------------------------------------------------------------------
# Fixed UUIDs -- enables idempotent upsert (query by PK, insert-or-update)
# ---------------------------------------------------------------------------

DEMO_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_COUNSELLOR_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

DEMO_ADMIN_EMAIL = "admin@demo.example"
DEMO_COUNSELLOR_EMAIL = "counsellor@demo.example"

DEMO_STUDENT_IDS = [
    uuid.UUID("00000000-0000-0000-0000-000000000101"),
    uuid.UUID("00000000-0000-0000-0000-000000000102"),
    uuid.UUID("00000000-0000-0000-0000-000000000103"),
    uuid.UUID("00000000-0000-0000-0000-000000000104"),
    uuid.UUID("00000000-0000-0000-0000-000000000105"),
]

DEMO_ACTION_PLAN_ID = uuid.UUID("00000000-0000-0000-0000-000000000201")
DEMO_ACADEMIC_PLAN_ID = uuid.UUID("00000000-0000-0000-0000-000000000301")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def upsert_user(
    db: Session,
    user_id: uuid.UUID,
    email: str,
    password: str,
    display_name: str,
    role: str,
) -> User:
    """Insert a user if not present; update role/display_name if already exists."""
    existing = db.query(User).filter(User.email == email).first()
    if existing is None:
        user = User(
            id=user_id,
            email=email,
            hashed_password=get_password_hash(password),
            display_name=display_name,
            role=role,
            is_active=True,
        )
        db.add(user)
        print(f"  Created {role}: {email}")
    else:
        existing.display_name = display_name
        existing.role = role
        existing.is_active = True
        user = existing
        print(f"  Updated {role}: {email}")
    return user


def upsert_student(
    db: Session,
    student_id: uuid.UUID,
    user_id: uuid.UUID,
    **kwargs,
) -> Student:
    """Insert a student if not present; update fields if already exists."""
    existing = db.query(Student).filter(Student.id == student_id).first()
    if existing is None:
        student = Student(id=student_id, user_id=user_id, **kwargs)
        db.add(student)
        print(f"  Created student: {kwargs.get('name', '(unnamed)')}")
    else:
        for key, value in kwargs.items():
            setattr(existing, key, value)
        student = existing
        print(f"  Updated student: {kwargs.get('name', '(unnamed)')}")
    return student


# ---------------------------------------------------------------------------
# Reference data seeding (schools + subjects from SQL files)
# ---------------------------------------------------------------------------

def _split_sql_statements(sql: str) -> list[str]:
    """Split SQL text into individual statements, respecting quoted strings.

    Mirrors the logic in backend/app/main.py.
    """
    stmts: list[str] = []
    current: list[str] = []
    in_quote = False
    for char in sql:
        if char == "'" and not in_quote:
            in_quote = True
            current.append(char)
        elif char == "'" and in_quote:
            in_quote = False
            current.append(char)
        elif char == ";" and not in_quote:
            stmt = "".join(current).strip()
            if stmt and not stmt.startswith("--"):
                stmts.append(stmt)
            current = []
        else:
            current.append(char)
    # Trailing statement without semicolon
    remainder = "".join(current).strip()
    if remainder and not remainder.startswith("--"):
        stmts.append(remainder)
    return stmts


def seed_reference_data(db: Session) -> None:
    """Run seed SQL files for schools and subjects if the tables are empty.

    Uses raw SQL execution with savepoints for error isolation.
    On SQLite (used in tests), the ON CONFLICT syntax may not work for all
    forms -- we skip gracefully and rely on ORM for the demo data.
    """
    seed_dir = Path(__file__).parent.parent / "data" / "seed"
    is_sqlite = str(engine.url).startswith("sqlite")
    connection = db.connection()

    # --- Subjects / grade systems ---
    subject_count = db.execute(sql_text("SELECT COUNT(*) FROM subjects")).scalar()
    if subject_count == 0:
        subjects_path = seed_dir / "seed_subjects.sql"
        if subjects_path.exists():
            print("\n  Seeding subjects from SQL...")
            sql = subjects_path.read_text()
            stmts = _split_sql_statements(sql)
            loaded = 0
            if is_sqlite:
                # SQLite: skip raw SQL (uses PostgreSQL-specific ON CONFLICT syntax)
                print("  (SQLite detected -- skipping raw SQL for subjects)")
            else:
                raw_cursor = connection.connection.cursor()
                for stmt in stmts:
                    try:
                        raw_cursor.execute("SAVEPOINT seed_stmt")
                        raw_cursor.execute(stmt)
                        raw_cursor.execute("RELEASE SAVEPOINT seed_stmt")
                        loaded += 1
                    except Exception:
                        raw_cursor.execute("ROLLBACK TO SAVEPOINT seed_stmt")
                print(f"  Loaded {loaded}/{len(stmts)} subject statements")
        else:
            print("  No seed_subjects.sql found -- skipping")
    else:
        print(f"  Subjects already populated ({subject_count} rows)")

    # --- Schools ---
    school_count = db.execute(sql_text("SELECT COUNT(*) FROM schools")).scalar()
    if school_count == 0:
        schools_path = seed_dir / "seed_schools.sql"
        if schools_path.exists():
            print("  Seeding schools from SQL...")
            sql = schools_path.read_text()
            stmts = _split_sql_statements(sql)
            loaded = 0
            if is_sqlite:
                print("  (SQLite detected -- skipping raw SQL for schools)")
            else:
                raw_cursor = connection.connection.cursor()
                for stmt in stmts:
                    try:
                        raw_cursor.execute("SAVEPOINT seed_stmt")
                        raw_cursor.execute(stmt)
                        raw_cursor.execute("RELEASE SAVEPOINT seed_stmt")
                        loaded += 1
                    except Exception:
                        raw_cursor.execute("ROLLBACK TO SAVEPOINT seed_stmt")
                print(f"  Loaded {loaded}/{len(stmts)} school statements")
        else:
            print("  No seed_schools.sql found -- skipping")
    else:
        print(f"  Schools already populated ({school_count} rows)")


# ---------------------------------------------------------------------------
# Student data
# ---------------------------------------------------------------------------

def seed_students(db: Session, counsellor_id: uuid.UUID) -> None:
    """Create 5 sample students with varying data completeness."""

    # Student 1: Complete data -- "best case" for demos
    upsert_student(
        db,
        DEMO_STUDENT_IDS[0],
        counsellor_id,
        name="Chan Mei Ling",
        preferred_name="Mei Ling",
        target_region="local",
        grades={
            "CHLA": "5*",
            "ENGL": "5",
            "MATH": "5**",
            "CSD": "5",
            "PHYS": "5*",
            "CHEM": "5",
        },
        interests=["robotics", "debate", "piano", "data science"],
        strengths_weaknesses=(
            "Strong analytical thinker with excellent mathematical reasoning. "
            "Active debater with good public speaking skills. "
            "Needs improvement in Chinese essay writing and time management during exams."
        ),
        date_of_birth=date(2007, 3, 15),
        gender="Female",
        class_name="6A",
        year_of_study=6,
        candidate_number="2025-DSE-001234",
        preferred_language="en",
        ielts_score={
            "overall": 7.5,
            "listening": 8.0,
            "reading": 7.5,
            "writing": 7.0,
            "speaking": 7.5,
            "test_date": "2025-11-15",
        },
        extra_curricular=[
            {
                "activity": "School Robotics Team",
                "role": "Captain",
                "years": 3,
                "achievement": "1st place HKRC Regional 2025",
            },
            {
                "activity": "Debate Club",
                "role": "Vice President",
                "years": 4,
                "achievement": "Best Speaker, Inter-school Debate 2024",
            },
            {
                "activity": "Piano",
                "role": "Performer",
                "years": 8,
                "achievement": "ABRSM Grade 8 Distinction",
            },
        ],
        awards=[
            {
                "title": "Outstanding Student Award",
                "awarding_body": "HKSAR Education Bureau",
                "level": "Territory-wide",
                "year": 2025,
            },
            {
                "title": "Mathematics Olympiad Bronze",
                "awarding_body": "HKMO",
                "level": "National",
                "year": 2024,
            },
        ],
        notes="Top candidate for HKU or CUHK engineering/science programmes.",
    )

    # Student 2: Mostly complete, missing a few optional fields
    upsert_student(
        db,
        DEMO_STUDENT_IDS[1],
        counsellor_id,
        name="Wong Siu Ming",
        preferred_name="Simon",
        target_region="local",
        grades={
            "CHLA": "4",
            "ENGL": "4",
            "MATH": "4",
            "CSD": "3",
            "ECON": "5",
            "BAFS": "5*",
        },
        interests=["finance", "basketball", "entrepreneurship"],
        strengths_weaknesses=(
            "Excellent business acumen with strong interest in finance and economics. "
            "Good team player. Core subjects are average -- needs to improve English writing."
        ),
        gender="Male",
        class_name="6B",
        year_of_study=6,
        preferred_language="zh-HK",
        extra_curricular=[
            {
                "activity": "Young Entrepreneurs Programme",
                "role": "Team Lead",
                "years": 2,
                "achievement": "Runner-up, JA HK Business Plan Competition",
            },
            {
                "activity": "Basketball Team",
                "role": "Point Guard",
                "years": 3,
                "achievement": "Inter-school Division 1",
            },
        ],
        notes="Aiming for BBA programmes. Financial aid may be needed.",
        financial_aid_flag=True,
    )

    # Student 3: Minimal data -- shows confidence indicators at LOW
    upsert_student(
        db,
        DEMO_STUDENT_IDS[2],
        counsellor_id,
        name="Li Ka Yan",
        target_region="local",
        grades={
            "CHLA": "3",
            "ENGL": "3",
            "MATH": "3",
            "CSD": "2",
        },
        interests=[],
        strengths_weaknesses="",
        notes="New student -- profile data collection in progress.",
    )

    # Student 4: International track student
    upsert_student(
        db,
        DEMO_STUDENT_IDS[3],
        counsellor_id,
        name="Cheung Hoi Lam",
        preferred_name="Holly",
        target_region="international",
        grades={
            "CHLA": "5",
            "ENGL": "5**",
            "MATH": "5*",
            "CSD": "4",
            "BIOL": "5*",
            "CHEM": "5",
        },
        interests=["medicine", "volunteering", "swimming", "biology research"],
        strengths_weaknesses=(
            "Exceptional English skills. Strong science background. "
            "Passionate about medicine and healthcare. "
            "Active volunteer at local elderly care centre."
        ),
        date_of_birth=date(2007, 8, 22),
        gender="Female",
        class_name="6A",
        year_of_study=6,
        candidate_number="2025-DSE-005678",
        preferred_language="en",
        ielts_score={
            "overall": 8.0,
            "listening": 8.5,
            "reading": 8.0,
            "writing": 7.5,
            "speaking": 8.0,
            "test_date": "2025-10-20",
        },
        extra_curricular=[
            {
                "activity": "St John Ambulance Brigade",
                "role": "Corporal",
                "years": 4,
                "achievement": "Grand Prior Award nominee",
            },
            {
                "activity": "Swimming Team",
                "role": "Freestyle",
                "years": 5,
                "achievement": "Inter-school 100m silver",
            },
        ],
        awards=[
            {
                "title": "Biology Research Prize",
                "awarding_body": "HKUST Science Academy",
                "level": "Territory-wide",
                "year": 2025,
            },
        ],
        notes="Strong candidate for medicine (HKU/CUHK) or UK universities.",
    )

    # Student 5: Arts-oriented student
    upsert_student(
        db,
        DEMO_STUDENT_IDS[4],
        counsellor_id,
        name="Lau Tsz Hin",
        preferred_name="Terrence",
        target_region="local",
        grades={
            "CHLA": "5*",
            "ENGL": "4",
            "MATH": "3",
            "CSD": "4",
            "VART": "5**",
            "CHIS": "5",
        },
        interests=["visual arts", "film", "photography", "Chinese history"],
        strengths_weaknesses=(
            "Highly creative with strong visual arts portfolio. "
            "Excellent Chinese language skills. "
            "Mathematics is a weak area that limits some programme options."
        ),
        gender="Male",
        class_name="6C",
        year_of_study=6,
        preferred_language="zh-HK",
        extra_curricular=[
            {
                "activity": "Art Club",
                "role": "President",
                "years": 3,
                "achievement": "Youth Art Exhibition Gold Award 2025",
            },
            {
                "activity": "Film Society",
                "role": "Director",
                "years": 2,
                "achievement": "Youth Short Film Festival Best Director",
            },
        ],
        notes="Interested in architecture or design programmes. Portfolio ready.",
    )


# ---------------------------------------------------------------------------
# Pre-generated academic plan (for Student 1)
# ---------------------------------------------------------------------------

def seed_academic_plan(db: Session, student_id: uuid.UUID) -> None:
    """Create a pre-generated academic plan for demo student 1.

    This makes the demo feel lived-in by showing a complete workflow result.
    """
    existing = db.query(AcademicPlan).filter(
        AcademicPlan.student_id == student_id
    ).first()

    plan_html = """<div class="academic-plan">
<h1>Academic Plan: Chan Mei Ling</h1>
<p class="generated-date">Generated: 2026-04-28</p>

<section class="executive-summary">
<h2>Executive Summary</h2>
<p>Chan Mei Ling is a high-achieving student with exceptional HKDSE results
(predicted Best-5: 32/35) and a strong extracurricular profile in robotics,
debate, and music. She is well-positioned for admission to top-tier engineering
and science programmes at HKU and CUHK.</p>
</section>

<section class="recommended-schools">
<h2>Recommended Schools and Programmes</h2>
<ol>
<li><strong>HKU - Computer Science (JS6101)</strong> - Match Score: 92%<br>
Strong fit based on mathematics (5**) and physics (5*). Robotics team captaincy
demonstrates applied computing skills.</li>
<li><strong>CUHK - Computer Science (JS4408)</strong> - Match Score: 89%<br>
Excellent programme with AI research focus. Score exceeds average admitted (26).</li>
<li><strong>HKU - Data Science and Statistics (JS6912)</strong> - Match Score: 87%<br>
Interdisciplinary programme aligning with data science interest.</li>
<li><strong>HKUST - Computer Science (JS5201)</strong> - Match Score: 85%<br>
Strong engineering focus with industry partnerships.</li>
<li><strong>CUHK - Mathematics (JS4834)</strong> - Match Score: 83%<br>
Pure mathematics option with Olympiad background as advantage.</li>
</ol>
</section>

<section class="action-items">
<h2>Action Items</h2>
<ul>
<li><strong>Priority: HIGH</strong> - Complete JUPAS application by December deadline.
Focus on HKU CS and CUHK CS as Band A choices.</li>
<li><strong>Priority: HIGH</strong> - Prepare for HKU Engineering interview (Jan-Feb).
Practice technical questions on algorithms and data structures.</li>
<li><strong>Priority: MEDIUM</strong> - Strengthen Chinese essay writing.
Consider intensive revision classes for Chinese Language Paper 2.</li>
<li><strong>Priority: MEDIUM</strong> - Update personal statement to highlight
robotics team leadership and Olympiad achievement.</li>
<li><strong>Priority: LOW</strong> - Explore UK university options (Imperial, UCL)
as backup if considering international track later.</li>
</ul>
</section>
</div>"""

    plan_data = {
        "id": DEMO_ACADEMIC_PLAN_ID,
        "student_id": student_id,
        "generated_at": datetime(2026, 4, 28, 10, 0, 0, tzinfo=timezone.utc),
        "version": 1,
        "recommended_schools": [
            {
                "school_id": "20000000-0000-0000-0000-000000000001",
                "school_name": "The University of Hong Kong",
                "rationale": "Top match for CS/Engineering based on strong STEM scores",
            },
            {
                "school_id": "20000000-0000-0000-0000-000000000002",
                "school_name": "The Chinese University of Hong Kong",
                "rationale": "Excellent CS programme with AI research focus",
            },
            {
                "school_id": "20000000-0000-0000-0000-000000000003",
                "school_name": "HKUST",
                "rationale": "Strong engineering focus with industry partnerships",
            },
        ],
        "action_items": [
            {
                "task": "Complete JUPAS application",
                "deadline": "2026-12-15",
                "priority": "HIGH",
            },
            {
                "task": "Prepare for HKU Engineering interview",
                "deadline": "2026-01-31",
                "priority": "HIGH",
            },
            {
                "task": "Strengthen Chinese essay writing",
                "deadline": "2026-03-01",
                "priority": "MEDIUM",
            },
        ],
        "html_content": plan_html,
        "template_id": "professional",
    }

    if existing is None:
        plan = AcademicPlan(**plan_data)
        db.add(plan)
        print("  Created academic plan for Chan Mei Ling")
    else:
        for key, value in plan_data.items():
            if key != "id":
                setattr(existing, key, value)
        print("  Updated academic plan for Chan Mei Ling")

    # Also create an ActionPlan (v1 format) for backward compatibility
    existing_ap = db.query(ActionPlan).filter(
        ActionPlan.student_id == student_id
    ).first()
    if existing_ap is None:
        action_plan = ActionPlan(
            id=DEMO_ACTION_PLAN_ID,
            student_id=student_id,
            academic_targets=(
                "Maintain 5** in Mathematics, improve Chinese Language to 5** level. "
                "Target Best-5 aggregate of 33+."
            ),
            extracurricular_direction=(
                "Continue Robotics Team leadership through graduation. "
                "Consider entering HKRC National competition for additional recognition."
            ),
            preparation_steps=(
                "1. Submit JUPAS application with HKU CS as Band A1 choice.\n"
                "2. Attend HKU Engineering Faculty information session in November.\n"
                "3. Complete personal statement draft by mid-November.\n"
                "4. Schedule mock interview practice with school career counsellor."
            ),
        )
        db.add(action_plan)
        print("  Created action plan for Chan Mei Ling")
    else:
        print("  Action plan already exists for Chan Mei Ling")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    print("DataPilot Demo Seed")
    print("=" * 40)

    # Ensure all tables exist (safe no-op if already created)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Seed reference data (schools, subjects) from SQL files
        print("\nReference Data:")
        seed_reference_data(db)

        # Seed users
        print("\nUsers:")
        upsert_user(
            db,
            DEMO_ADMIN_ID,
            DEMO_ADMIN_EMAIL,
            "demo-admin-2024",
            "Demo Admin",
            "admin",
        )
        counsellor = upsert_user(
            db,
            DEMO_COUNSELLOR_ID,
            DEMO_COUNSELLOR_EMAIL,
            "demo-staff-2024",
            "Sarah Chen",
            "counsellor",
        )

        # Seed students (owned by the counsellor)
        print("\nStudents:")
        seed_students(db, counsellor.id)

        # Pre-generated academic plan for Student 1
        print("\nAcademic Plan:")
        seed_academic_plan(db, DEMO_STUDENT_IDS[0])

        db.commit()

        print("\n" + "=" * 40)
        print("Done. Demo data is ready.")
        print(f"  Admin login:    {DEMO_ADMIN_EMAIL} / demo-admin-2024")
        print(f"  Staff login:    {DEMO_COUNSELLOR_EMAIL} / demo-staff-2024")
        print(f"  Students:       5 sample students created")
        print(f"  Academic plan:  Pre-generated for Chan Mei Ling")
    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
