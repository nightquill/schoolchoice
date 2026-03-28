"""
app/api/v1/routes/match.py

v2 Match endpoints — run matchmaker_v2 pipeline, persist results.
REQ-072, REQ-073, REQ-074, REQ-075, REQ-076
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, User
from app.db.models_v2 import StudentSchoolTarget
from app.db.session import get_db
from app.schemas.v2.targets import TargetListResponse
from app.services import student_service
from app.services.hkdse_service import compute_best5_aggregate, grade_to_int
from app.services.matchmaker_v2 import run_matching

router = APIRouter(prefix="/students", tags=["match-v2"])


def _build_student_data(student: object, db: Session) -> dict:
    """
    Assemble the student_data dict that the matchmaker expects.
    Reads grades, IELTS, extra-curricular, awards from the student ORM object.
    """
    # Gather subject grades
    grade_records = getattr(student, "subject_grades") or []
    grades_by_code: dict[str, str] = {}
    grade_dicts_for_agg = []
    elective_codes: list[str] = []

    for g in grade_records:
        from app.db.models_v2 import Subject
        subject = db.query(Subject).filter(Subject.id == g.subject_id).first()
        if not subject:
            continue
        code = subject.code
        raw = g.raw_grade or g.predicted_grade or "U"
        numeric = grade_to_int(raw)
        grades_by_code[code] = raw
        grade_dicts_for_agg.append({
            "subject_code": code,
            "numeric_value": numeric,
            "is_compulsory": subject.is_compulsory,
            "category": subject.category,
        })
        if not subject.is_compulsory and subject.category != "APPLIED_LEARNING":
            elective_codes.append(code)

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

    # Extra-curricular
    extra = getattr(student, "extra_curricular") or []
    extra_activities: list[str] = []
    for ec in extra:
        if isinstance(ec, dict):
            extra_activities.append(ec.get("activity") or "")
        else:
            extra_activities.append(str(ec))

    # Awards
    awards_raw = getattr(student, "awards") or []
    award_titles: list[str] = []
    for aw in awards_raw:
        if isinstance(aw, dict):
            award_titles.append(aw.get("title") or "")
        else:
            award_titles.append(str(aw))

    return {
        "best5_aggregate": best5,
        "grades_by_code": grades_by_code,
        "ielts_score": ielts_overall,
        "elective_codes": elective_codes,
        "extra_curricular_activities": extra_activities,
        "award_titles": award_titles,
    }


def _build_school_dict(school: object) -> dict:
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


# ---------------------------------------------------------------------------
# POST /students/{student_id}/match
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/match",
    status_code=status.HTTP_200_OK,
)
def run_match(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run the v2 matching pipeline for a student against all schools.
    Saves/updates StudentSchoolTarget records with scores.
    Returns ordered MatchResult list. REQ-072–REQ-076
    """
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    student_data = _build_student_data(student, db)

    # Load all schools
    all_schools = db.query(School).all()
    school_dicts = [_build_school_dict(s) for s in all_schools]

    # Load existing targets for preference adjustment
    existing_targets = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.student_id == student_id)
        .all()
    )
    target_dicts = [
        {
            "school_id": str(t.school_id),
            "student_rank": t.student_rank,
        }
        for t in existing_targets
    ]

    results = run_matching(student_data, school_dicts, target_dicts)

    # Upsert StudentSchoolTarget records for eligible schools
    existing_by_school: dict[str, StudentSchoolTarget] = {
        str(t.school_id): t for t in existing_targets
    }

    for result in results:
        if not result.eligibility_pass:
            # Still update eligibility on existing targets
            existing = existing_by_school.get(result.school_id)
            if existing:
                existing.eligibility_pass = False
                shap = existing.shap_explanation or {}
                shap["failing_criteria"] = result.failing_criteria
                existing.shap_explanation = shap
            continue

        existing = existing_by_school.get(result.school_id)
        if existing:
            existing.match_score = result.final_score
            existing.eligibility_pass = result.eligibility_pass
            existing.shap_explanation = result.shap_explanation
        else:
            # Do not auto-add schools not in the target list during match run
            pass

    db.commit()

    # Return serialisable list
    return [
        {
            "school_id": r.school_id,
            "school_name": r.school_name,
            "major_name": r.major_name,
            "major_jupas_code": r.major_jupas_code,
            "eligibility_pass": r.eligibility_pass,
            "failing_criteria": r.failing_criteria,
            "fit_score": r.fit_score,
            "component_scores": r.component_scores,
            "ml_probability": r.ml_probability,
            "final_score": r.final_score,
            "shap_explanation": r.shap_explanation,
            "rationale": r.rationale,
        }
        for r in results
    ]


# ---------------------------------------------------------------------------
# GET /students/{student_id}/match
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/match",
    response_model=TargetListResponse,
    status_code=status.HTTP_200_OK,
)
def get_match_results(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current StudentSchoolTarget records with stored scores. REQ-069"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    targets = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.student_id == student_id)
        .order_by(StudentSchoolTarget.match_score.desc().nulls_last())
        .all()
    )
    return TargetListResponse(targets=targets, total=len(targets))


# ---------------------------------------------------------------------------
# GET /students/{student_id}/recommendations — top school recommendations
# before the student has added any targets
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/recommendations/auto",
    status_code=status.HTTP_200_OK,
)
def get_auto_recommendations(
    student_id: UUID,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return top recommended schools based on the student's grade profile,
    even before the student has added any target schools.
    Runs a full match against all schools and returns the top `limit` eligible ones.
    """
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    student_data = _build_student_data(student, db)

    all_schools = db.query(School).all()
    school_dicts = [_build_school_dict(s) for s in all_schools]

    # No existing target preference context
    results = run_matching(student_data, school_dicts, [])

    # Sort by final_score descending, eligibility first
    eligible = [r for r in results if r.eligibility_pass]
    eligible.sort(key=lambda r: r.final_score, reverse=True)

    top = eligible[:limit]
    return [
        {
            "school_id": r.school_id,
            "school_name": r.school_name,
            "major_name": r.major_name,
            "major_jupas_code": r.major_jupas_code,
            "fit_score": round(r.fit_score, 3),
            "final_score": round(r.final_score, 3),
            "rationale": r.rationale,
        }
        for r in top
    ]
