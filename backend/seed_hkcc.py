"""Seed PolyU HKCC with REAL admission data from 2025/26 cohort.
Source: https://www.hkcc-polyu.edu.hk/en/admission/key-information-for-application/admission-score-for-2025-26-cohort/
All scores are best-5 HKDSE subjects (including Chinese + English).
"""
from app.db.session import engine
from sqlalchemy import text
import uuid

HKCC_ID = "30000000-0000-0000-0000-000000000001"

INSTITUTION = {
    "id": HKCC_ID,
    "code": "HKCC",
    "name": "Hong Kong Community College",
    "name_zh": "香港專上學院",
    "parent_university": "The Hong Kong Polytechnic University",
    "location": "Hung Hom, Kowloon",
    "website": "https://www.hkcc-polyu.edu.hk",
    "tier": 1,
    "articulation_rate": 0.903,
    "notes": "Largest community college arm of PolyU. ~3000 annual intake. 90.3% articulation to degree.",
}

# Real data from PolyU HKCC Admission Score for 2025/26 Cohort
# Scores = best-5 HKDSE subjects
PROGRAMMES = [
    # Associate Degree — Humanities & Languages
    {"name": "Associate in Chinese Language and Literature", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.87, "lq": 13, "uq": 16, "highest": 20},
    {"name": "Associate in English for Professional Communication", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.92, "lq": 13, "uq": 16.25, "highest": 19},
    {"name": "Associate in Language and Culture", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.40, "lq": 12, "uq": 16.25, "highest": 19},
    {"name": "Associate in Language and Digital Communication", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.39, "lq": 12, "uq": 16, "highest": 20},
    {"name": "Associate in Public Relations and Communication", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 13.90, "lq": 12, "uq": 16, "highest": 19},
    {"name": "Associate in Translation and Interpretation", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 13.96, "lq": 13, "uq": 15, "highest": 19},
    {"name": "Associate of Arts", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.68, "lq": 13, "uq": 16, "highest": 20},
    # Associate Degree — Science & Engineering
    {"name": "Associate in Engineering", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 15.42, "lq": 14, "uq": 17, "highest": 20},
    {"name": "Associate in Information Technology", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 14.67, "lq": 13, "uq": 16, "highest": 21},
    {"name": "Associate in Statistics and Data Science", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 15.38, "lq": 13, "uq": 17, "highest": 20},
    {"name": "Associate of Science", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 15.42, "lq": 14, "uq": 17, "highest": 20},
    {"name": "Associate in Health Studies", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 15.60, "lq": 14, "uq": 17, "highest": 21},
    {"name": "Associate in Surveying and Built Environment", "level": "associate_degree", "faculty": "Division of Science, Engineering and Health Studies", "mean": 14.72, "lq": 13, "uq": 17, "highest": 19},
    # Associate Degree — Social Sciences
    {"name": "Associate in Applied Social Sciences", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.10, "lq": 13, "uq": 15.75, "highest": 19},
    {"name": "Associate in Applied Social Sciences (Counselling)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.36, "lq": 12, "uq": 16, "highest": 21},
    {"name": "Associate in Applied Social Sciences (Psychology)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.20, "lq": 12, "uq": 16, "highest": 25},
    {"name": "Associate in Applied Social Sciences (Social Policy)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.50, "lq": 13, "uq": 17, "highest": 19},
    {"name": "Associate in Applied Social Sciences (Sociology)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.28, "lq": 12.25, "uq": 16, "highest": 18},
    # Associate Degree — Business
    {"name": "Associate in Business", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.76, "lq": 13, "uq": 16, "highest": 20},
    {"name": "Associate in Business (Accounting)", "level": "associate_degree", "faculty": "Division of Business", "mean": 15.35, "lq": 14, "uq": 17, "highest": 21},
    {"name": "Associate in Business (Business Management)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.22, "lq": 12.25, "uq": 16, "highest": 19},
    {"name": "Associate in Business (Finance)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.77, "lq": 13, "uq": 17, "highest": 20},
    {"name": "Associate in Business (Hospitality Management)", "level": "associate_degree", "faculty": "Division of Business", "mean": 13.83, "lq": 12, "uq": 16, "highest": 19},
    {"name": "Associate in Business (Human Resources)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.21, "lq": 12, "uq": 16, "highest": 19},
    {"name": "Associate in Business (International Business)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.77, "lq": 13, "uq": 17, "highest": 20},
    {"name": "Associate in Business (Logistics)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.71, "lq": 12.25, "uq": 17, "highest": 19},
    {"name": "Associate in Business (Marketing)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.40, "lq": 13, "uq": 16, "highest": 19},
    {"name": "Associate in Business (Tourism Management)", "level": "associate_degree", "faculty": "Division of Business", "mean": 13.53, "lq": 12, "uq": 15, "highest": 18},
    # Associate Degree — Design
    {"name": "Associate in Design (Advertising Design)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.63, "lq": 13, "uq": 16, "highest": 18},
    {"name": "Associate in Design (Environment and Interior)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 14.62, "lq": 13, "uq": 16, "highest": 19},
    {"name": "Associate in Design (Moving Image)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 15.15, "lq": 13.25, "uq": 16.75, "highest": 19},
    {"name": "Associate in Design (Visual Communication)", "level": "associate_degree", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 15.79, "lq": 15, "uq": 17, "highest": 18},
    # Higher Diploma
    {"name": "Higher Diploma in Social Work", "level": "higher_diploma", "faculty": "Division of Humanities, Design and Social Sciences", "mean": 16.01, "lq": 15, "uq": 17, "highest": 22},
    {"name": "Higher Diploma in Mechanical Engineering", "level": "higher_diploma", "faculty": "Division of Science, Engineering and Health Studies", "mean": 15.25, "lq": 14, "uq": 17, "highest": 19},
    {"name": "Higher Diploma in Electrical Engineering", "level": "higher_diploma", "faculty": "Division of Science, Engineering and Health Studies", "mean": 14.35, "lq": 13, "uq": 16, "highest": 18},
    {"name": "Higher Diploma in Aircraft Services Engineering", "level": "higher_diploma", "faculty": "Division of Science, Engineering and Health Studies", "mean": 13.74, "lq": 12, "uq": 16.5, "highest": 19},
]


def seed():
    with engine.connect() as conn:
        # Create tables if not exist
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sf_institutions (
                id VARCHAR(36) PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                name_zh VARCHAR(255),
                parent_university VARCHAR(255),
                location VARCHAR(255),
                website VARCHAR(500),
                tier INTEGER,
                articulation_rate REAL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sf_programmes (
                id VARCHAR(36) PRIMARY KEY,
                institution_id VARCHAR(36) NOT NULL REFERENCES sf_institutions(id) ON DELETE CASCADE,
                programme_code VARCHAR(30),
                name VARCHAR(255) NOT NULL,
                name_zh VARCHAR(255),
                level VARCHAR(30) NOT NULL,
                faculty VARCHAR(255),
                admission_score_mean REAL,
                admission_score_lq REAL,
                admission_score_uq REAL,
                admission_score_highest REAL,
                admission_year INTEGER,
                minimum_requirements JSON,
                data_source VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sf_prog_inst ON sf_programmes(institution_id)"))
        conn.commit()

        # Upsert institution
        existing = conn.execute(text("SELECT id FROM sf_institutions WHERE code = :code"), {"code": INSTITUTION["code"]}).fetchone()
        if existing:
            conn.execute(text("""
                UPDATE sf_institutions SET name=:name, name_zh=:name_zh, parent_university=:parent_university,
                location=:location, website=:website, tier=:tier, articulation_rate=:articulation_rate, notes=:notes
                WHERE code=:code
            """), INSTITUTION)
            print(f"Updated institution: {INSTITUTION['name']}")
        else:
            conn.execute(text("""
                INSERT INTO sf_institutions (id, code, name, name_zh, parent_university, location, website, tier, articulation_rate, notes)
                VALUES (:id, :code, :name, :name_zh, :parent_university, :location, :website, :tier, :articulation_rate, :notes)
            """), INSTITUTION)
            print(f"Created institution: {INSTITUTION['name']}")

        # Clear existing programmes for this institution and re-seed
        conn.execute(text("DELETE FROM sf_programmes WHERE institution_id = :iid"), {"iid": HKCC_ID})

        for prog in PROGRAMMES:
            pid = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO sf_programmes (id, institution_id, name, level, faculty,
                    admission_score_mean, admission_score_lq, admission_score_uq, admission_score_highest,
                    admission_year, minimum_requirements, data_source)
                VALUES (:id, :iid, :name, :level, :faculty, :mean, :lq, :uq, :highest, :year, :min_reqs, :source)
            """), {
                "id": pid, "iid": HKCC_ID,
                "name": prog["name"], "level": prog["level"], "faculty": prog["faculty"],
                "mean": prog["mean"], "lq": prog["lq"], "uq": prog["uq"], "highest": prog["highest"],
                "year": 2025, "min_reqs": '{"general": "22222"}',
                "source": "PolyU HKCC Admission Score 2025/26 Cohort (hkcc-polyu.edu.hk)",
            })

        conn.commit()
        print(f"Seeded {len(PROGRAMMES)} programmes for {INSTITUTION['name']}")

        # Verify
        count = conn.execute(text("SELECT COUNT(*) FROM sf_programmes WHERE institution_id = :iid"), {"iid": HKCC_ID}).fetchone()[0]
        print(f"Verified: {count} programmes in DB")


if __name__ == "__main__":
    seed()
