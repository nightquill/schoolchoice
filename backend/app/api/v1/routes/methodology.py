"""Methodology Report API — consultant-readable scoring methodology documentation."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db

router = APIRouter(tags=["methodology"])


@router.get("/methodology")
def get_methodology_report(db: Session = Depends(get_db)):
    """Returns the scoring methodology as structured JSON for frontend rendering."""

    # Count programmes and institutions from DB
    try:
        stats = db.execute(text(
            "SELECT COUNT(*) as total, COUNT(DISTINCT institution_code) as institutions "
            "FROM jupas_programmes"
        )).fetchone()
        total_programmes = stats.total if stats else 0
        total_institutions = stats.institutions if stats else 0
    except Exception:
        total_programmes = 0
        total_institutions = 0

    return {
        "title": "School Choice Recommendation Methodology",
        "version": "2.0 — Parametric Statistical Model",
        "summary": (
            "This system computes admission probability for each JUPAS programme "
            "by applying the programme's published scoring formula to the student's "
            "HKDSE grades, then mapping the resulting weighted score against the "
            "published admission statistics (upper quartile, median, lower quartile) "
            "of previously admitted students."
        ),
        "data_coverage": {
            "total_programmes": total_programmes,
            "total_institutions": total_institutions,
            "data_source": "Official JUPAS 2024/2025 Admissions Scores PDFs",
        },
        "methodology_steps": [
            {
                "step": 1,
                "title": "Grade Conversion",
                "description": (
                    "Student HKDSE grades (U through 5**) are converted to numerical "
                    "points using the programme's specific scale. From 2025, all JUPAS "
                    "institutions use the enhanced scale: 5**=8.5, 5*=7, 5=5.5, 4=4, "
                    "3=3, 2=2, 1=1."
                ),
            },
            {
                "step": 2,
                "title": "Subject Weighting",
                "description": (
                    "Each programme applies specific multipliers to relevant subjects. "
                    "For example, HKU Business applies \u00d71.5 to English and Mathematics. "
                    "CityU applies \u00d72 to core programme subjects. PolyU uses absolute "
                    "weights (5-10 per subject). These weightings are sourced from "
                    "official university scoring formula documents."
                ),
            },
            {
                "step": 3,
                "title": "Best-N Selection",
                "description": (
                    "The system selects the student's best N subjects (typically 5) "
                    "by weighted score. Some programmes include bonus points for "
                    "additional subjects (e.g., 0.2\u00d7 the 6th best subject at HKU)."
                ),
            },
            {
                "step": 4,
                "title": "Admission Probability",
                "description": (
                    "The student's total weighted score is compared against published "
                    "admission statistics. Using a normal distribution fitted to the "
                    "published quartiles (LQ=25th percentile, Median=50th, UQ=75th), "
                    "the system computes the student's percentile position as the "
                    "admission probability estimate."
                ),
            },
            {
                "step": 5,
                "title": "Risk Assessment",
                "description": (
                    "Students scoring below the lower quartile of admitted students "
                    "are flagged as 'at risk'. Between LQ and median is 'borderline'. "
                    "Above median is 'safe'. This triggers visual warnings in the UI."
                ),
            },
        ],
        "data_sources": [
            {
                "source": "JUPAS 2025 Admissions Scores (9 institutions)",
                "url": "https://www.jupas.edu.hk/en/page/detail/3667/",
                "description": "Official median and lower quartile per programme",
            },
            {
                "source": "JUPAS 2024 Admissions Scores",
                "url": "https://www.jupas.edu.hk/f/page/3667/af_2024_JUPAS.pdf",
                "description": "Previous year data for trend comparison",
            },
            {
                "source": "HKU Programme Scoring Formulas",
                "url": "https://admissions.hku.hk/apply/jupas/score-calculator",
                "description": "Exact subject weightings and formula per programme",
            },
            {
                "source": "PolyU Subject Weighting PDFs",
                "url": "https://www.polyu.edu.hk/study/ug/admissions/jupas/jupas-score-calculator",
                "description": "Per-programme absolute subject weights (5-10)",
            },
        ],
        "limitations": [
            "Individual student outcome data is not publicly available — the model uses aggregate statistics only.",
            "Non-academic factors (interviews, portfolios, SLP) are not modelled.",
            "Some HKUST/PolyU subject weights are estimated conservatively where exact multipliers are not published.",
            "The normal distribution assumption may not perfectly fit all programme admission distributions.",
            "Year-to-year variation means past statistics are indicative, not deterministic.",
        ],
        "confidence_levels": {
            "verified_from_jupas_2025_pdf": "Scores extracted directly from official JUPAS 2025 PDF",
            "verified_from_polyu_pdf": "Weights extracted from PolyU individual programme PDFs",
            "estimated_conservative": "Conservative estimate based on published preferred subjects",
            "estimated_pending_pdf_verification": "Estimated, awaiting manual verification against source",
        },
    }
