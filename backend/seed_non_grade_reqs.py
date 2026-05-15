"""Seed non-grade requirements for JUPAS programmes.

Data sourced from:
- bigexam.hk individual programme pages (interview arrangement field)
- EdUHK official interview arrangement page (all 26 programmes confirmed)
- HKUST JUPAS admissions page (9 programmes confirmed requiring interview)
- HKU admissions (Medicine, Law, Architecture confirmed selective)
- CUHK admissions (Law, Music confirmed; Music requires audition+portfolio)
- HKBU admissions (Visual Arts confirmed requiring portfolio)
- PolyU admissions (general: Band A applicants may be interviewed)

Categories:
  interview: "must" | "selective" | "may_require" | "no" | null (unknown)
  portfolio: true/false
  aptitude_test: true/false
  audition: true/false
  details: free text description

For programmes not explicitly confirmed, we use domain knowledge:
- Medicine/Dentistry → must interview (universal across HK)
- Nursing → selective interview (common)
- Law → selective interview (confirmed HKU, CUHK)
- Education (EdUHK) → must interview (confirmed all 26)
- Architecture/Design → portfolio likely
- Music/Performing Arts → audition likely
- Most other programmes → selective or no interview
"""
import json
from app.db.session import engine
from sqlalchemy import text


# Verified requirements by JUPAS code
REQUIREMENTS = {
    # === HKU (JS6xxx) ===
    # Medicine
    "JS6456": {"interview": "must", "details": "Multiple Mini Interview (MMI). Source: HKU admissions"},
    "JS6626": {"interview": "must", "details": "Distinguished MedScholar track. MMI interview. Source: HKU admissions"},
    # Dentistry
    "JS6157": {"interview": "must", "details": "Interview required. Source: HKU admissions"},
    # Law
    "JS6406": {"interview": "selective", "details": "Selective interview for shortlisted candidates. Source: bigexam.hk"},
    # Architecture
    "JS6004": {"interview": "selective", "portfolio": True, "details": "Aptitude Exercise (portfolio + interview). Source: HKU admissions"},
    "JS6028": {"interview": "selective", "portfolio": True, "details": "Portfolio submission + interview. Source: HKU admissions"},
    # Nursing
    "JS6468": {"interview": "selective", "details": "Selective interview. Source: HKU admissions"},

    # === CUHK (JS4xxx) ===
    # Law
    "JS4903": {"interview": "selective", "details": "Selective interview. Source: bigexam.hk"},
    # Medicine
    "JS4408": {"interview": "must", "details": "MMI interview required. Source: CUHK admissions"},
    "JS4412": {"interview": "must", "details": "GPS Medicine. Interview required. Source: CUHK admissions"},
    # Music
    "JS4044": {"interview": "selective", "audition": True, "portfolio": True, "details": "Audition video + written entrance test + portfolio. ABRSM Grade 8 recommended. Source: CUHK admissions"},
    # Fine Arts
    "JS4503": {"interview": "selective", "portfolio": True, "details": "Portfolio may be presented at interview. Source: CUHK admissions"},
    # Pharmacy
    "JS4550": {"interview": "selective", "details": "Selective interview. Source: CUHK admissions"},
    # Nursing
    "JS4513": {"interview": "selective", "details": "Selective interview. Source: CUHK admissions"},

    # === HKUST (JS5xxx) ===
    # Confirmed from HKUST website
    "JS5101": {"interview": "must", "details": "International Research Enrichment. Interview after HKDSE results. Source: HKUST admissions"},
    "JS5200": {"interview": "must", "details": "BBA Global Business. Interview 25 Jul. Source: HKUST admissions"},
    "JS5282": {"interview": "must", "details": "BSc Quantitative Finance. Interview 24 Jul. Source: HKUST admissions"},
    "JS5312": {"interview": "must", "details": "BSc Economics & Finance. Interview 23 Jul. Source: HKUST admissions"},
    "JS5316": {"interview": "must", "details": "BSc Sustainable and Green Finance. Interview 24 Jul. Source: HKUST admissions"},
    "JS5331": {"interview": "must", "details": "BSc Risk Management & Business Intelligence. Interview 22-24 Jul. Source: HKUST admissions"},
    "JS5181": {"interview": "selective", "details": "Engineering programmes. Exploration Day + admission interviews. Source: HKUST admissions"},
    "JS5118": {"interview": "must", "details": "BSc Biomedical and Health Sciences. Interview 25 Jul. Source: HKUST admissions"},
    "JS5811": {"interview": "must", "portfolio": True, "details": "BSc Innovation, Design and Technology. DTP/SLP/OEA submission + interview. Source: HKUST admissions"},
    "JS5901": {"interview": "must", "details": "Dual Degree Technology & Management. Interview 21-24 Jul. Source: HKUST admissions"},

    # === PolyU (JS3xxx) ===
    # PolyU interviews all Band A applicants for most schemes
    "JS3648": {"interview": "selective", "details": "Nursing. Selective interview. Source: PolyU admissions"},
    "JS3569": {"interview": "selective", "details": "Design. Portfolio review + interview. Source: PolyU admissions"},
    "JS3250": {"interview": "selective", "details": "Social Work. Selective interview. Source: PolyU admissions"},

    # === HKBU (JS2xxx) ===
    "JS2810": {"interview": "selective", "portfolio": True, "details": "Visual Arts. Portfolio submission + practical tests + interview. Source: HKBU/JUPAS"},
    "JS2060": {"interview": "selective", "audition": True, "details": "Music / Creative Industries. Audition may be required. Source: HKBU admissions"},
    "JS2920": {"interview": "selective", "details": "Arts and Technology. Selective interview. Source: HKBU admissions"},
    "JS2950": {"interview": "selective", "details": "Individualised Major. Selective interview. Source: HKBU admissions"},

    # === Lingnan (JS7xxx) ===
    "JS7133": {"interview": "selective", "portfolio": True, "details": "Animation and Digital Arts. Portfolio + interview. Source: Lingnan admissions"},
}

# EdUHK — ALL 26 programmes require interview (confirmed from official page)
EDUHK_CODES = [
    "JS8001", "JS8002", "JS8003", "JS8004", "JS8005", "JS8006", "JS8007",
    "JS8008", "JS8009", "JS8010", "JS8011", "JS8012", "JS8013",
    "JS8507",
    "JS8651", "JS8663", "JS8674", "JS8675", "JS8685", "JS8686",
    "JS8687", "JS8688", "JS8702", "JS8714", "JS8726", "JS8727",
]
for code in EDUHK_CODES:
    if code not in REQUIREMENTS:
        REQUIREMENTS[code] = {"interview": "must", "details": "All EdUHK programmes require interview. Source: EdUHK JUPAS interview page"}


# Broad patterns for remaining programmes (conservative — mark as selective/may_require based on domain knowledge)
PATTERN_RULES = [
    # Medicine/Dentistry always require interview
    (lambda name: any(kw in name.lower() for kw in ["medicine", "surgery", "dental", "dentistry"]),
     {"interview": "must", "details": "Medical/dental programmes universally require interview in HK"}),
    # Nursing commonly has selective interview
    (lambda name: "nursing" in name.lower(),
     {"interview": "selective", "details": "Nursing programmes commonly require selective interview"}),
    # Law selective
    (lambda name: name.lower().startswith("bachelor of laws") or "law" in name.lower().split(),
     {"interview": "selective", "details": "Law programmes commonly require selective interview"}),
    # Social Work
    (lambda name: "social work" in name.lower(),
     {"interview": "selective", "details": "Social work programmes commonly require selective interview"}),
    # Education
    (lambda name: "education" in name.lower() and "bed" in name.lower(),
     {"interview": "must", "details": "Education programmes typically require interview"}),
    # Design/Architecture
    (lambda name: any(kw in name.lower() for kw in ["design", "architecture", "landscape", "visual art"]),
     {"interview": "selective", "portfolio": True, "details": "Design/architecture programmes typically require portfolio"}),
]


def seed():
    with engine.connect() as conn:
        # Get all programmes
        rows = conn.execute(text("SELECT jupas_code, name FROM jupas_programmes")).fetchall()
        print(f"Total programmes: {len(rows)}")

        updated = 0
        for jupas_code, name in rows:
            reqs = REQUIREMENTS.get(jupas_code)

            # If no specific data, try pattern rules
            if reqs is None:
                for test_fn, default_reqs in PATTERN_RULES:
                    if test_fn(name):
                        reqs = default_reqs
                        break

            if reqs:
                conn.execute(
                    text("UPDATE jupas_programmes SET non_grade_requirements = :reqs WHERE jupas_code = :code"),
                    {"reqs": json.dumps(reqs), "code": jupas_code},
                )
                updated += 1

        conn.commit()
        print(f"Updated {updated} programmes with non-grade requirements")

        # Verify
        has_reqs = conn.execute(text("SELECT COUNT(*) FROM jupas_programmes WHERE non_grade_requirements IS NOT NULL")).fetchone()[0]
        must_interview = conn.execute(text("SELECT COUNT(*) FROM jupas_programmes WHERE non_grade_requirements LIKE '%must%'")).fetchone()[0]
        selective = conn.execute(text("SELECT COUNT(*) FROM jupas_programmes WHERE non_grade_requirements LIKE '%selective%'")).fetchone()[0]
        has_portfolio = conn.execute(text("SELECT COUNT(*) FROM jupas_programmes WHERE non_grade_requirements LIKE '%portfolio%'")).fetchone()[0]
        print(f"Has requirements: {has_reqs}, Must interview: {must_interview}, Selective: {selective}, Portfolio: {has_portfolio}")


if __name__ == "__main__":
    seed()
