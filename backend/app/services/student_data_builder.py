"""
app/services/student_data_builder.py

Single source of truth for assembling the student_data dict
consumed by the matching engine, plan generator, and target scoring.

Consolidates the duplicated _build_student_data() from match.py,
targets.py, and plan.py into one canonical implementation.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import School
from app.db.models_v2 import Subject
from app.modules.school_choice.services.hkdse_service import (
    compute_best5_aggregate,
    grade_to_int,
)


def build_student_data(student, db: Session) -> dict:
    """
    Assemble the student_data dict that the matchmaker expects.
    Reads grades, IELTS, extra-curricular, awards, interests from the ORM object.

    Returns dict with keys:
        best5_aggregate, grades_by_code, ielts_score, elective_codes,
        extra_curricular_activities, award_titles, interests,
        subject_grades_detail (full grade records for plan generator)
    """
    grade_records = getattr(student, "subject_grades", None) or []
    grades_by_code: dict[str, str] = {}
    grade_dicts_for_agg: list[dict] = []
    elective_codes: list[str] = []
    subject_grades_detail: list[dict] = []

    for g in grade_records:
        subj = db.query(Subject).filter(Subject.id == g.subject_id).first()
        if not subj:
            continue
        raw = g.raw_grade or g.predicted_grade or "U"
        numeric = grade_to_int(raw)
        grades_by_code[subj.code] = raw
        grade_dicts_for_agg.append({
            "subject_code": subj.code,
            "numeric_value": numeric,
            "is_compulsory": subj.is_compulsory,
            "category": subj.category,
        })
        if not subj.is_compulsory and subj.category != "APPLIED_LEARNING":
            elective_codes.append(subj.code)
        subject_grades_detail.append({
            "subject_code": subj.code,
            "subject_name": subj.name,
            "sitting": g.sitting,
            "raw_grade": g.raw_grade,
            "predicted_grade": g.predicted_grade,
            "year_of_exam": g.year_of_exam,
            "is_compulsory": subj.is_compulsory,
            "category": subj.category,
        })

    best5 = compute_best5_aggregate(grade_dicts_for_agg)

    # IELTS overall score (could be dict or float)
    ielts_raw = getattr(student, "ielts_score", None)
    ielts_overall = None
    if isinstance(ielts_raw, dict):
        ielts_overall = ielts_raw.get("overall")
    elif ielts_raw is not None:
        try:
            ielts_overall = float(ielts_raw)
        except (TypeError, ValueError):
            pass

    # Extra-curricular activities
    extra = getattr(student, "extra_curricular", None) or []
    extra_activities: list[str] = [
        (ec.get("activity") or "") if isinstance(ec, dict) else str(ec)
        for ec in extra
    ]

    # Awards
    awards_raw = getattr(student, "awards", None) or []
    award_titles: list[str] = [
        (aw.get("title") or "") if isinstance(aw, dict) else str(aw)
        for aw in awards_raw
    ]

    # Student interests
    raw_interests = getattr(student, "interests", None)
    interests = raw_interests if isinstance(raw_interests, list) else []

    return {
        "best5_aggregate": best5,
        "grades_by_code": grades_by_code,
        "ielts_score": ielts_overall,
        "elective_codes": elective_codes,
        "extra_curricular_activities": extra_activities,
        "award_titles": award_titles,
        "interests": interests,
        "subject_grades_detail": subject_grades_detail,
    }


def build_school_dict(school) -> dict:
    """Convert School ORM object to plain dict for matchmaker."""
    return {
        "id": str(school.id),
        "name": school.name or "",
        "minimum_entry_score": getattr(school, "minimum_entry_score", None),
        "average_admitted_score": (
            float(school.average_admitted_score)
            if getattr(school, "average_admitted_score", None) is not None
            else None
        ),
        "required_subjects": getattr(school, "required_subjects", None) or [],
        "language_requirements": getattr(school, "language_requirements", None) or {},
        "notable_programs": getattr(school, "notable_programs", None) or [],
        "major_requirements": getattr(school, "major_requirements", None) or [],
    }


def build_student_dict_for_plan(student, student_data: dict) -> dict:
    """
    Build the student dict expected by generate_html_plan().
    Uses the already-assembled student_data to avoid duplicate DB queries.
    """
    return {
        "name": student.name,
        "year_of_study": getattr(student, "year_of_study", None),
        "subject_grades": student_data["subject_grades_detail"],
        "ielts_score": getattr(student, "ielts_score", None),
        "extra_curricular": getattr(student, "extra_curricular", None) or [],
        "awards": getattr(student, "awards", None) or [],
    }
