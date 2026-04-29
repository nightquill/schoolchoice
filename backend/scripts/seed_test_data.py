"""
Seed realistic HKDSE test data into SQLite for demo/testing.
Creates subjects, schools, and 3 differentiated students with full data.
Idempotent — checks by name before creating.

Usage: cd backend && python scripts/seed_test_data.py
"""
from __future__ import annotations

import sys
import os
import uuid
from datetime import datetime, timezone, date
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("DATABASE_URL", "sqlite:///./app.db")
os.environ.setdefault("SECRET_KEY", "local-dev-key-not-placeholder-safe-for-development")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

from app.db.session import SessionLocal, engine
from app.db.models import Student, User, School, Base
from app.db.models_v2 import Subject, GradeSystem, StudentSubjectGrade
from app.core.security import get_password_hash

# Create all tables (Base is shared across models and models_v2)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def upsert(model, filter_kwargs, defaults):
    """Get or create a record."""
    obj = db.query(model).filter_by(**filter_kwargs).first()
    if obj:
        return obj, False
    obj = model(**filter_kwargs, **defaults)
    db.add(obj)
    db.flush()
    return obj, True

print("=" * 60)
print("Seeding HKDSE test data")
print("=" * 60)

# ── 1. Grade System ──────────────────────────────────────────
gs, created = upsert(GradeSystem, {"name": "HKDSE"}, {
    "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
    "description": "Hong Kong Diploma of Secondary Education",
})
if created:
    print("  Created grade system: HKDSE")
else:
    print("  Grade system HKDSE exists")

# ── 2. Subjects ──────────────────────────────────────────────
SUBJECTS = [
    # Core (compulsory)
    ("CHLA", "Chinese Language", "CORE", True),
    ("ENGL", "English Language", "CORE", True),
    ("MATH", "Mathematics (Compulsory Part)", "CORE", True),
    ("CSD",  "Citizenship and Social Development", "CORE", True),
    # Electives
    ("PHYS", "Physics", "ELECTIVE", False),
    ("CHEM", "Chemistry", "ELECTIVE", False),
    ("BIOL", "Biology", "ELECTIVE", False),
    ("ECON", "Economics", "ELECTIVE", False),
    ("BAFS", "Business, Accounting and Financial Studies", "ELECTIVE", False),
    ("GEOG", "Geography", "ELECTIVE", False),
    ("HIST", "History", "ELECTIVE", False),
    ("CHIH", "Chinese History", "ELECTIVE", False),
    ("CHIL", "Chinese Literature", "ELECTIVE", False),
    ("VART", "Visual Arts", "ELECTIVE", False),
    ("MUSC", "Music", "ELECTIVE", False),
    ("ICT",  "Information and Communication Technology", "ELECTIVE", False),
    ("M1",   "Mathematics Extended Module 1 (Calculus and Statistics)", "ELECTIVE", False),
    ("M2",   "Mathematics Extended Module 2 (Algebra and Calculus)", "ELECTIVE", False),
]

subject_map = {}
count = 0
for code, name, cat, compulsory in SUBJECTS:
    subj, created = upsert(Subject, {"code": code}, {
        "name": name,
        "grade_system_id": gs.id,
        "category": cat,
        "is_compulsory": compulsory,
    })
    # Update name if subject was auto-created with wrong name
    if subj.name != name:
        subj.name = name
        subj.category = cat
        subj.is_compulsory = compulsory
        subj.grade_system_id = gs.id
    subject_map[code] = subj
    if created:
        count += 1
print(f"  Subjects: {count} created, {len(SUBJECTS) - count} existing")

# ── 3. Schools (Hong Kong universities) ─────────────────────
SCHOOLS = [
    {
        "name": "The University of Hong Kong (HKU)",
        "location": "Pok Fu Lam, Hong Kong",
        "type": "UNIVERSITY",
        "minimum_entry_score": 24,
        "average_admitted_score": 28.5,
        "required_subjects": [{"subject_code": "ENGL", "min_grade": "4"}],
        "language_requirements": {"ielts_minimum": 6.5},
        "notable_programs": ["Medicine", "Law", "Engineering", "Architecture", "Business"],
        "faculties": ["Arts", "Business and Economics", "Dentistry", "Education", "Engineering", "Law", "Medicine", "Science", "Social Sciences"],
        "acceptance_rate": 0.15,
        "scholarship_available": True,
        "description": "Oldest tertiary institution in Hong Kong. Globally top-ranked research university with strong professional programs.",
        "key_strengths": ["Research", "Global ranking", "Medicine", "Law"],
    },
    {
        "name": "The Chinese University of Hong Kong (CUHK)",
        "location": "Sha Tin, New Territories",
        "type": "UNIVERSITY",
        "minimum_entry_score": 22,
        "average_admitted_score": 26.0,
        "required_subjects": [{"subject_code": "ENGL", "min_grade": "3"}],
        "language_requirements": {"ielts_minimum": 6.0},
        "notable_programs": ["Medicine", "Business", "Translation", "Journalism", "Computer Science"],
        "faculties": ["Arts", "Business Administration", "Education", "Engineering", "Law", "Medicine", "Science", "Social Science"],
        "acceptance_rate": 0.20,
        "scholarship_available": True,
        "description": "Bilingual research university with college system. Strong in Chinese studies, business, and medicine.",
        "key_strengths": ["Bilingual education", "College system", "Chinese studies", "Business"],
    },
    {
        "name": "The Hong Kong University of Science and Technology (HKUST)",
        "location": "Clear Water Bay, Sai Kung",
        "type": "UNIVERSITY",
        "minimum_entry_score": 23,
        "average_admitted_score": 27.0,
        "required_subjects": [{"subject_code": "MATH", "min_grade": "4"}, {"subject_code": "ENGL", "min_grade": "4"}],
        "language_requirements": {"ielts_minimum": 6.5},
        "notable_programs": ["Computer Science", "Business Analytics", "Engineering", "Biotechnology", "Finance"],
        "faculties": ["Science", "Engineering", "Business and Management", "Humanities and Social Science"],
        "acceptance_rate": 0.18,
        "scholarship_available": True,
        "description": "Young research university excelling in STEM and business. Known for entrepreneurship and tech innovation.",
        "key_strengths": ["STEM", "Entrepreneurship", "Technology", "Business analytics"],
    },
    {
        "name": "The Hong Kong Polytechnic University (PolyU)",
        "location": "Hung Hom, Kowloon",
        "type": "UNIVERSITY",
        "minimum_entry_score": 18,
        "average_admitted_score": 22.0,
        "required_subjects": [],
        "language_requirements": {"ielts_minimum": 6.0},
        "notable_programs": ["Hotel Management", "Design", "Nursing", "Optometry", "Fashion", "Construction"],
        "faculties": ["Applied Science", "Business", "Construction and Environment", "Design", "Engineering", "Health and Social Sciences", "Hotel and Tourism Management", "Humanities"],
        "acceptance_rate": 0.30,
        "scholarship_available": True,
        "description": "Application-oriented university with industry partnerships. Strongest in hotel management, design, and applied sciences.",
        "key_strengths": ["Hotel management", "Design", "Applied learning", "Industry partnerships"],
    },
    {
        "name": "City University of Hong Kong (CityU)",
        "location": "Kowloon Tong, Kowloon",
        "type": "UNIVERSITY",
        "minimum_entry_score": 19,
        "average_admitted_score": 23.0,
        "required_subjects": [],
        "language_requirements": {"ielts_minimum": 6.0},
        "notable_programs": ["Creative Media", "Veterinary Medicine", "Data Science", "Law", "Energy and Environment"],
        "faculties": ["Business", "Engineering", "Liberal Arts and Social Sciences", "Science", "Veterinary Medicine", "Creative Media", "Data Science", "Energy and Environment", "Law"],
        "acceptance_rate": 0.25,
        "scholarship_available": True,
        "description": "Research-intensive university strong in creative media and emerging fields. First veterinary school in HK.",
        "key_strengths": ["Creative media", "Veterinary medicine", "Data science", "Innovation"],
    },
    {
        "name": "Hong Kong Baptist University (HKBU)",
        "location": "Kowloon Tong, Kowloon",
        "type": "UNIVERSITY",
        "minimum_entry_score": 17,
        "average_admitted_score": 20.0,
        "required_subjects": [],
        "language_requirements": {},
        "notable_programs": ["Journalism", "Chinese Medicine", "Film", "Music", "Social Work"],
        "faculties": ["Arts", "Business", "Chinese Medicine", "Communication", "Science", "Social Sciences", "Visual Arts"],
        "acceptance_rate": 0.35,
        "scholarship_available": True,
        "description": "Liberal arts-oriented university with strengths in communication, Chinese medicine, and creative arts.",
        "key_strengths": ["Journalism", "Chinese medicine", "Liberal arts", "Film"],
    },
    {
        "name": "The Education University of Hong Kong (EdUHK)",
        "location": "Tai Po, New Territories",
        "type": "UNIVERSITY",
        "minimum_entry_score": 15,
        "average_admitted_score": 18.5,
        "required_subjects": [],
        "language_requirements": {},
        "notable_programs": ["Education", "Social Sciences", "Creative Arts", "Language Studies"],
        "faculties": ["Education and Human Development", "Humanities", "Liberal Arts and Social Sciences"],
        "acceptance_rate": 0.40,
        "scholarship_available": True,
        "description": "Specialised university for teacher education and education research. Gateway to teaching profession in HK.",
        "key_strengths": ["Teacher education", "Education research", "Language studies"],
    },
    {
        "name": "Lingnan University",
        "location": "Tuen Mun, New Territories",
        "type": "UNIVERSITY",
        "minimum_entry_score": 15,
        "average_admitted_score": 17.5,
        "required_subjects": [],
        "language_requirements": {},
        "notable_programs": ["Liberal Arts", "Business", "Social Sciences", "Translation"],
        "faculties": ["Arts", "Business", "Social Sciences"],
        "acceptance_rate": 0.45,
        "scholarship_available": True,
        "description": "Hong Kong's liberal arts university. Small class sizes, whole-person education, strong exchange programs.",
        "key_strengths": ["Liberal arts", "Small class sizes", "Exchange programs"],
    },
]

school_count = 0
for s_data in SCHOOLS:
    name = s_data.pop("name")
    sch, created = upsert(School, {"name": name}, {
        "min_academic_requirements": {},
        **s_data,
    })
    if created:
        school_count += 1
    else:
        # Update fields on existing
        for k, v in s_data.items():
            if hasattr(sch, k):
                setattr(sch, k, v)
print(f"  Schools: {school_count} created, {len(SCHOOLS) - school_count} existing")

# ── 4. Admin user ────────────────────────────────────────────
admin, created = upsert(User, {"email": "admin@test.com"}, {
    "hashed_password": get_password_hash("admin123"),
    "display_name": "Test Admin",
    "role": "admin",
    "is_active": True,
})
if created:
    print("  Created admin user")
admin_id = admin.id

# ── 5. Three differentiated students ────────────────────────

STUDENTS = [
    {
        "name": "Chan Mei Ling",
        "gender": "Female",
        "year_of_study": 6,
        "target_region": "local",
        "date_of_birth": date(2008, 3, 15),
        "preferred_language": "en",
        "personal_statement": "I am passionate about biological sciences and healthcare. Volunteering at Queen Mary Hospital's paediatric ward taught me empathy and resilience. I want to study medicine to combine my academic strengths in science with my desire to help children. My long-term goal is paediatric oncology research.",
        "grades": {  # Best-5 target: 30+ (elite student)
            "CHLA": ("4", "OFFICIAL"),
            "ENGL": ("5*", "OFFICIAL"),
            "MATH": ("5**", "OFFICIAL"),
            "CSD":  ("A", "OFFICIAL"),
            "BIOL": ("5**", "OFFICIAL"),
            "CHEM": ("5*", "OFFICIAL"),
            "M2":   ("5", "OFFICIAL"),
        },
        "ielts": 7.5,
        "activities": [
            {"activity": "Hospital volunteer — Queen Mary Hospital paediatric ward (200+ hours)"},
            {"activity": "Biology Olympiad — Hong Kong representative, Bronze medal"},
            {"activity": "School debating team captain — inter-school champion 2025"},
            {"activity": "Red Cross Youth Unit leader"},
        ],
        "awards": [
            {"title": "Hong Kong Biology Olympiad Bronze Medal 2025"},
            {"title": "Outstanding Student Award — Diocesan Girls' School"},
            {"title": "Community Service Award — 200 hours"},
        ],
    },
    {
        "name": "Wong Siu Ming",
        "gender": "Male",
        "year_of_study": 6,
        "target_region": "local",
        "date_of_birth": date(2007, 11, 2),
        "preferred_language": "zh",
        "personal_statement": "我熱愛商業和金融。從中三開始參加模擬投資比賽，建立了對市場分析的興趣。父親經營小型貿易公司，我從小觀察生意運作，理解中小企業面對的挑戰。希望修讀商業分析，將來幫助香港中小企業數碼轉型。",
        "grades": {  # Best-5 target: 22-24 (solid middle)
            "CHLA": ("4", "OFFICIAL"),
            "ENGL": ("4", "OFFICIAL"),
            "MATH": ("5", "OFFICIAL"),
            "CSD":  ("A", "OFFICIAL"),
            "ECON": ("5", "OFFICIAL"),
            "BAFS": ("4", "OFFICIAL"),
            "ICT":  ("4", "MOCK"),
        },
        "ielts": None,
        "activities": [
            {"activity": "Junior Achievement Company Program — CEO of student mini-company"},
            {"activity": "School basketball team — regular player"},
            {"activity": "Mock investment competition — top 10% district level"},
        ],
        "awards": [
            {"title": "JA Best Student CEO Award 2025"},
            {"title": "District Mock Investment Top 10% Certificate"},
        ],
    },
    {
        "name": "Li Ka Yan",
        "gender": "Female",
        "year_of_study": 5,
        "target_region": "local",
        "date_of_birth": date(2009, 7, 20),
        "preferred_language": "en",
        "personal_statement": "I love visual storytelling. I've been drawing since age 5 and started making short films in Form 3. My YouTube channel documenting Hong Kong's vanishing neon signs has 8,000 subscribers. I want to study creative media or visual arts to preserve cultural heritage through digital media.",
        "grades": {  # Best-5 target: 17-19 (arts-focused, weaker academics)
            "CHLA": ("3", "MOCK"),
            "ENGL": ("4", "MOCK"),
            "MATH": ("3", "MOCK"),
            "CSD":  ("A", "MOCK"),
            "VART": ("5*", "MOCK"),
            "CHIL": ("4", "MOCK"),
        },
        "ielts": None,
        "activities": [
            {"activity": "YouTube channel — 'Neon HK' documenting vanishing neon signs (8,000 subscribers)"},
            {"activity": "School art club president — organised 3 exhibitions"},
            {"activity": "Short film festival — Best Student Documentary 2025"},
            {"activity": "Community mural painting project — Sham Shui Po"},
        ],
        "awards": [
            {"title": "Best Student Documentary — HK Youth Film Festival 2025"},
            {"title": "Visual Arts Excellence Award — school level"},
            {"title": "Young Artist Award — HK Arts Development Council shortlist"},
        ],
    },
]

for s_data in STUDENTS:
    name = s_data["name"]
    existing = db.query(Student).filter(Student.name == name, Student.user_id == admin_id).first()
    if existing:
        student = existing
        print(f"  Student '{name}' exists — updating")
    else:
        student = Student(
            name=name,
            user_id=admin_id,
            gender=s_data["gender"],
            year_of_study=s_data["year_of_study"],
            target_region=s_data["target_region"],
            preferred_language=s_data.get("preferred_language", "en"),
        )
        db.add(student)
        db.flush()
        print(f"  Created student: {name}")

    # Update fields
    student.date_of_birth = s_data.get("date_of_birth")
    student.personal_statement = s_data.get("personal_statement")
    student.extra_curricular = s_data.get("activities", [])
    student.awards = s_data.get("awards", [])
    if s_data.get("ielts"):
        student.ielts_score = s_data["ielts"]

    # Grades
    existing_grades = db.query(StudentSubjectGrade).filter(
        StudentSubjectGrade.student_id == student.id
    ).all()
    existing_subj_ids = {g.subject_id for g in existing_grades}

    for code, (grade, sitting) in s_data["grades"].items():
        subj = subject_map.get(code)
        if not subj:
            print(f"    WARNING: Subject {code} not found")
            continue
        if subj.id in existing_subj_ids:
            # Update existing grade
            g = next(g for g in existing_grades if g.subject_id == subj.id)
            g.raw_grade = grade
            g.sitting = sitting
        else:
            g = StudentSubjectGrade(
                student_id=student.id,
                subject_id=subj.id,
                raw_grade=grade,
                sitting=sitting,
                year_of_exam=2026 if sitting == "OFFICIAL" else 2025,
            )
            db.add(g)
    print(f"    Grades: {len(s_data['grades'])} subjects")

db.commit()

# Verify
print("\n" + "=" * 60)
print("Verification")
print("=" * 60)
print(f"  Subjects:  {db.query(Subject).count()}")
print(f"  Schools:   {db.query(School).count()}")
print(f"  Students:  {db.query(Student).count()}")
for s in db.query(Student).filter(Student.user_id == admin_id).all():
    grade_count = db.query(StudentSubjectGrade).filter(StudentSubjectGrade.student_id == s.id).count()
    print(f"    {s.name}: {grade_count} grades, DOB={s.date_of_birth}, IELTS={s.ielts_score}")

db.close()
print("\nDone. Login: admin@test.com / admin123")
