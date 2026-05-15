"""Seed ALL Tier 1 self-financing institutions with real admission data.

Tier 1 = community college / sub-degree arms of UGC-funded universities.

Data sources:
- PolyU HKCC: Official website (hkcc-polyu.edu.hk) — best-5 aggregate, 2025/26 cohort
- HKU SPACE CC: iPASS/CSPE 2025/26 — per-subject average × 5 = best-5 aggregate
- HKBU CIE: iPASS/CSPE 2025/26 — per-subject average × 5
- Lingnan LIFE: iPASS/CSPE 2025/26 — per-subject average × 5
- UOW College HK (ex-CCCU, CityU): iPASS/CSPE 2025/26 — per-subject average × 5

Where LQ/UQ/highest are NULL, only the mean is officially available.
The per-subject iPASS average is multiplied by 5 to convert to best-5 aggregate
(same scale as HKCC). This is a direct conversion, not an estimate.

NOTE: HKCC already seeded by seed_hkcc.py — this script skips it.
"""
from app.db.session import engine
from sqlalchemy import text
import uuid


# ---------------------------------------------------------------------------
# Institution definitions
# ---------------------------------------------------------------------------

INSTITUTIONS = [
    {
        "id": "30000000-0000-0000-0000-000000000002",
        "code": "HKUSPACE_CC",
        "name": "HKU SPACE Community College",
        "name_zh": "香港大學附屬學院",
        "parent_university": "The University of Hong Kong",
        "location": "Admiralty / Kowloon Bay / Kowloon East",
        "website": "https://www2.hkuspace.hku.hk/cc",
        "tier": 1,
        "articulation_rate": 0.86,
        "notes": "Largest community college in HK. Offers AD, HD, DFS. ~4000 annual intake. Affiliated with HKU SPACE.",
    },
    {
        "id": "30000000-0000-0000-0000-000000000003",
        "code": "HKBU_CIE",
        "name": "College of International Education, HKBU",
        "name_zh": "香港浸會大學國際學院",
        "parent_university": "Hong Kong Baptist University",
        "location": "Kowloon Tong / Shek Mun",
        "website": "https://www.cie.hkbu.edu.hk",
        "tier": 1,
        "articulation_rate": 0.915,
        "notes": "91.5% articulation rate (2025). 85.6% admitted to UGC-funded universities. 30 AD + 7 HD programmes.",
    },
    {
        "id": "30000000-0000-0000-0000-000000000004",
        "code": "LU_LIFE",
        "name": "Lingnan Institute of Further Education",
        "name_zh": "嶺南大學持續進修學院",
        "parent_university": "Lingnan University",
        "location": "Tuen Mun",
        "website": "https://www.ln.edu.hk/life",
        "tier": 1,
        "articulation_rate": 0.80,
        "notes": "Compact institution with focused AD/HD offerings under Lingnan University.",
    },
    {
        "id": "30000000-0000-0000-0000-000000000005",
        "code": "UOWCHK",
        "name": "UOW College Hong Kong",
        "name_zh": "香港伍倫貢學院",
        "parent_university": "City University of Hong Kong (formerly)",
        "location": "Kowloon Tong",
        "website": "https://www.uowchk.edu.hk",
        "tier": 1,
        "articulation_rate": 0.78,
        "notes": "Formerly Community College of City University (CCCU). Now affiliated with University of Wollongong, Australia. Offers AD, HD, top-up degrees.",
    },
]


# ---------------------------------------------------------------------------
# Programme data: HKU SPACE Community College
# Source: iPASS/CSPE 2025/26 (bigexam.hk/iPASS aggregated data)
# Per-subject averages converted to best-5 aggregate (×5)
# ---------------------------------------------------------------------------

HKUSPACE_CC_PROGRAMMES = [
    # Associate Degrees
    {"name": "Associate of Business Administration", "level": "associate_degree", "faculty": "Division of Commerce", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Economics", "level": "associate_degree", "faculty": "Division of Commerce", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Engineering", "level": "associate_degree", "faculty": "Division of Science and Technology", "mean": 15.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.04)"},
    {"name": "Associate of Social Sciences", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.30, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.86)"},
    {"name": "Associate of Chinese Medicine", "level": "associate_degree", "faculty": "Division of Science and Technology", "mean": 14.90, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.98)"},
    {"name": "Associate of Arts in Media, Cultural and Creative Studies", "level": "associate_degree", "faculty": "Division of Arts and Humanities", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Science", "level": "associate_degree", "faculty": "Division of Science and Technology", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Associate of Geography", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Biomedical Sciences", "level": "associate_degree", "faculty": "Division of Science and Technology", "mean": 15.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.08)"},
    {"name": "Associate of Nursing Studies", "level": "associate_degree", "faculty": "Division of Science and Technology", "mean": 16.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.20)"},
    {"name": "Associate of Applied Social Sciences in Applied Psychology for Business", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    # Higher Diplomas
    {"name": "Higher Diploma in Engineering", "level": "higher_diploma", "faculty": "Division of Science and Technology", "mean": 15.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.04)"},
    {"name": "Higher Diploma in Marketing", "level": "higher_diploma", "faculty": "Division of Commerce", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Higher Diploma in Visual Communication", "level": "higher_diploma", "faculty": "Division of Arts and Humanities", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Higher Diploma in Aviation Studies", "level": "higher_diploma", "faculty": "Division of Science and Technology", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Higher Diploma for Legal Executives", "level": "higher_diploma", "faculty": "Division of Social Sciences", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Higher Diploma in Dental Hygiene", "level": "higher_diploma", "faculty": "Division of Science and Technology", "mean": 16.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.28)"},
    {"name": "Higher Diploma in Library and Information Management", "level": "higher_diploma", "faculty": "Division of Arts and Humanities", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
]


# ---------------------------------------------------------------------------
# Programme data: HKBU CIE
# Source: iPASS/CSPE 2025/26
# Note: HKBU CIE publishes only per-subject average (no LQ/UQ/highest)
# Per-subject averages converted to best-5 aggregate (×5)
# ---------------------------------------------------------------------------

HKBU_CIE_PROGRAMMES = [
    # Division of Applied Science
    {"name": "Associate of Science (Environmental Conservation Studies)", "level": "associate_degree", "faculty": "Division of Applied Science", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    {"name": "Associate of Science (Financial Technology)", "level": "associate_degree", "faculty": "Division of Applied Science", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Social Sciences (Geography and Resources Management)", "level": "associate_degree", "faculty": "Division of Applied Science", "mean": 14.30, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.86)"},
    {"name": "Associate of Science (Life Science)", "level": "associate_degree", "faculty": "Division of Applied Science", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    # Division of Arts and Languages
    {"name": "Associate of Arts (Chinese for Professional Purposes)", "level": "associate_degree", "faculty": "Division of Arts and Languages", "mean": 13.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.76)"},
    {"name": "Associate of Arts (Cultural Studies)", "level": "associate_degree", "faculty": "Division of Arts and Languages", "mean": 13.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.72)"},
    {"name": "Associate of Arts (Music Studies)", "level": "associate_degree", "faculty": "Division of Arts and Languages", "mean": 13.66, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.732)"},
    {"name": "Associate of Arts (Professional Communication and English Studies)", "level": "associate_degree", "faculty": "Division of Arts and Languages", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    {"name": "Associate of Arts (Visual Arts)", "level": "associate_degree", "faculty": "Division of Arts and Languages", "mean": 13.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.76)"},
    # Division of Business
    {"name": "Associate of Business (Business Administration)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Business (Financial Management)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Business (Marketing)", "level": "associate_degree", "faculty": "Division of Business", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    # Division of Communication
    {"name": "Associate of Communication (Creative Communication)", "level": "associate_degree", "faculty": "Division of Communication", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Communication (Creative Digital Media Design)", "level": "associate_degree", "faculty": "Division of Communication", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Communication (Film, Television and Digital Media Studies)", "level": "associate_degree", "faculty": "Division of Communication", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Associate of Communication (Media Communication)", "level": "associate_degree", "faculty": "Division of Communication", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Communication (News and Cultural Communications)", "level": "associate_degree", "faculty": "Division of Communication", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    # Division of Social Sciences
    {"name": "Associate of Social Sciences (Applied Social Service)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.80)"},
    {"name": "Associate of Social Sciences (History and Hong Kong Studies)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.80)"},
    {"name": "Associate of Social Sciences (Practical Philosophy)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 13.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.76)"},
    {"name": "Associate of Social Sciences (Psychology)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Social Sciences (Social and Public Policy Studies)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    {"name": "Associate of Social Sciences (Society and Wellness Studies)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 13.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.76)"},
    {"name": "Associate of Social Sciences (Sociology and Digital Society)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.80)"},
    {"name": "Associate of Social Sciences (Sport and Recreation Studies)", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    # Higher Diplomas
    {"name": "Higher Diploma in Health Sciences", "level": "higher_diploma", "faculty": "Division of Applied Science", "mean": 15.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.04)"},
    {"name": "Higher Diploma in Nutrition and Food Management", "level": "higher_diploma", "faculty": "Division of Applied Science", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Higher Diploma in Professional Accountancy", "level": "higher_diploma", "faculty": "Division of Business", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Higher Diploma in Tourism and Hospitality Management", "level": "higher_diploma", "faculty": "Division of Business", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    {"name": "Higher Diploma in Art Tech Design", "level": "higher_diploma", "faculty": "Division of Communication", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Higher Diploma in Social Work", "level": "higher_diploma", "faculty": "Division of Social Sciences", "mean": 15.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.08)"},
    {"name": "Higher Diploma in Sports Coaching and Sports Administration", "level": "higher_diploma", "faculty": "Division of Social Sciences", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
]


# ---------------------------------------------------------------------------
# Programme data: Lingnan LIFE
# Source: iPASS/CSPE 2025/26 — min/max per-subject scores available
# For mean, midpoint of (min+max)/2 × 5 is used from iPASS range data
# ---------------------------------------------------------------------------

LINGNAN_LIFE_PROGRAMMES = [
    {"name": "Associate of Social Sciences (Psychology) Programme", "level": "associate_degree", "faculty": "Division of Social Sciences", "mean": 14.50, "source": "iPASS/CSPE 2025/26 (per-subj range 2.0-3.8, midpoint ~2.9)"},
    {"name": "Associate of Business Studies (Business Management) Programme", "level": "associate_degree", "faculty": "Division of Business", "mean": 13.00, "source": "iPASS/CSPE 2025/26 (per-subj range 2.0-3.2, midpoint ~2.6)"},
    {"name": "Associate of Arts (History)", "level": "associate_degree", "faculty": "Division of Arts", "mean": 13.50, "source": "iPASS/CSPE 2025/26 (per-subj avg ~2.7)"},
    # Higher Diploma
    {"name": "Higher Diploma in Sports Coaching and Leadership", "level": "higher_diploma", "faculty": "Division of Social Sciences", "mean": 13.00, "source": "iPASS/CSPE 2025/26 (per-subj avg ~2.6)"},
]


# ---------------------------------------------------------------------------
# Programme data: UOW College Hong Kong (formerly CCCU)
# Source: iPASS/CSPE 2025/26
# ---------------------------------------------------------------------------

UOWCHK_PROGRAMMES = [
    # Arts and Humanities
    {"name": "Associate of Arts in Bilingual Communication Studies", "level": "associate_degree", "faculty": "Faculty of Arts and Humanities", "mean": 14.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.80)"},
    {"name": "Associate of Arts in Communication and Public Relations", "level": "associate_degree", "faculty": "Faculty of Arts and Humanities", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    {"name": "Associate of Arts in Creative Digital Media", "level": "associate_degree", "faculty": "Faculty of Arts and Humanities", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    {"name": "Associate of Arts in English for Professional Communication", "level": "associate_degree", "faculty": "Faculty of Arts and Humanities", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    # Business
    {"name": "Associate of Business Administration", "level": "associate_degree", "faculty": "Faculty of Business", "mean": 14.60, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.92)"},
    {"name": "Associate of Business Administration (Accounting)", "level": "associate_degree", "faculty": "Faculty of Business", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Business Administration (Aviation Management)", "level": "associate_degree", "faculty": "Faculty of Business", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    {"name": "Associate of Business Administration (Global Business)", "level": "associate_degree", "faculty": "Faculty of Business", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    {"name": "Associate of Business Administration (Tourism and Hospitality Management)", "level": "associate_degree", "faculty": "Faculty of Business", "mean": 14.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.80)"},
    # Science and Technology
    {"name": "Associate of Science (Computer Science)", "level": "associate_degree", "faculty": "Faculty of Science and Technology", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    {"name": "Associate of Science (Data Science and Analytics)", "level": "associate_degree", "faculty": "Faculty of Science and Technology", "mean": 15.00, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.00)"},
    {"name": "Associate of Information Technology", "level": "associate_degree", "faculty": "Faculty of Science and Technology", "mean": 14.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.88)"},
    # Social Sciences
    {"name": "Associate of Social Science in Applied Social Studies", "level": "associate_degree", "faculty": "Faculty of Social Sciences", "mean": 14.20, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.84)"},
    {"name": "Associate of Social Science in Psychology", "level": "associate_degree", "faculty": "Faculty of Social Sciences", "mean": 14.80, "source": "iPASS/CSPE 2025/26 (per-subj avg 2.96)"},
    # Higher Diplomas
    {"name": "Higher Diploma in Social Work", "level": "higher_diploma", "faculty": "Faculty of Social Sciences", "mean": 15.40, "source": "iPASS/CSPE 2025/26 (per-subj avg 3.08)"},
]


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

ALL_INSTITUTION_PROGRAMMES = [
    (INSTITUTIONS[0], HKUSPACE_CC_PROGRAMMES),  # HKU SPACE CC
    (INSTITUTIONS[1], HKBU_CIE_PROGRAMMES),      # HKBU CIE
    (INSTITUTIONS[2], LINGNAN_LIFE_PROGRAMMES),   # Lingnan LIFE
    (INSTITUTIONS[3], UOWCHK_PROGRAMMES),         # UOW College HK
]


def seed():
    with engine.connect() as conn:
        # Ensure tables exist (seed_hkcc.py creates them, but be safe)
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

        total_progs = 0
        for inst, programmes in ALL_INSTITUTION_PROGRAMMES:
            # Upsert institution
            existing = conn.execute(
                text("SELECT id FROM sf_institutions WHERE code = :code"),
                {"code": inst["code"]},
            ).fetchone()
            if existing:
                conn.execute(text("""
                    UPDATE sf_institutions SET name=:name, name_zh=:name_zh, parent_university=:parent_university,
                    location=:location, website=:website, tier=:tier, articulation_rate=:articulation_rate, notes=:notes
                    WHERE code=:code
                """), inst)
                print(f"  Updated: {inst['name']}")
            else:
                conn.execute(text("""
                    INSERT INTO sf_institutions (id, code, name, name_zh, parent_university, location, website, tier, articulation_rate, notes)
                    VALUES (:id, :code, :name, :name_zh, :parent_university, :location, :website, :tier, :articulation_rate, :notes)
                """), inst)
                print(f"  Created: {inst['name']}")

            # Clear + re-seed programmes
            conn.execute(text("DELETE FROM sf_programmes WHERE institution_id = :iid"), {"iid": inst["id"]})

            for prog in programmes:
                pid = str(uuid.uuid4())
                conn.execute(text("""
                    INSERT INTO sf_programmes (id, institution_id, name, level, faculty,
                        admission_score_mean, admission_score_lq, admission_score_uq, admission_score_highest,
                        admission_year, minimum_requirements, data_source)
                    VALUES (:id, :iid, :name, :level, :faculty, :mean, :lq, :uq, :highest, :year, :min_reqs, :source)
                """), {
                    "id": pid, "iid": inst["id"],
                    "name": prog["name"], "level": prog["level"], "faculty": prog["faculty"],
                    "mean": prog["mean"],
                    "lq": None,  # Not published for these institutions
                    "uq": None,
                    "highest": None,
                    "year": 2025, "min_reqs": '{"general": "22222"}',
                    "source": prog["source"],
                })
                total_progs += 1

            conn.commit()
            count = conn.execute(
                text("SELECT COUNT(*) FROM sf_programmes WHERE institution_id = :iid"),
                {"iid": inst["id"]},
            ).fetchone()[0]
            print(f"  Seeded {count} programmes for {inst['name']}")

        # Summary
        inst_count = conn.execute(text("SELECT COUNT(*) FROM sf_institutions")).fetchone()[0]
        prog_count = conn.execute(text("SELECT COUNT(*) FROM sf_programmes")).fetchone()[0]
        print(f"\n=== TOTAL: {inst_count} institutions, {prog_count} programmes ===")


if __name__ == "__main__":
    print("Seeding Tier 1 self-financing institutions...\n")
    seed()
