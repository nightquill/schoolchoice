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
from app.modules.school_choice.models.models import JupasProgramme
from app.schemas.v2.targets import TargetListResponse
from app.services import student_service
from app.services.matching_service import attach_jupas_programmes
from app.services.student_data_builder import build_school_dict, build_student_data
from app.modules.school_choice.services.matchmaker_v2 import run_matching

router = APIRouter(prefix="/students", tags=["match-v2"])


def _build_zh_lookups(db: Session, results):
    """Build school_id->name_zh and jupas_code->name_zh lookup dicts from results."""
    school_ids = {r.school_id for r in results if r.school_id}
    jupas_codes = {r.major_jupas_code for r in results if r.major_jupas_code}

    school_zh = {}
    if school_ids:
        rows = db.query(School.id, School.name_zh).filter(School.id.in_(school_ids)).all()
        school_zh = {str(row.id): row.name_zh for row in rows}

    programme_zh = {}
    if jupas_codes:
        rows = (
            db.query(JupasProgramme.jupas_code, JupasProgramme.name_zh)
            .filter(JupasProgramme.jupas_code.in_(jupas_codes))
            .all()
        )
        programme_zh = {row.jupas_code: row.name_zh for row in rows}

    return school_zh, programme_zh


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
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    student_data = build_student_data(student, db)

    # Load all schools
    all_schools = db.query(School).all()
    school_dicts = [build_school_dict(s) for s in all_schools]

    # Attach JUPAS programmes for scorer integration
    school_dicts = attach_jupas_programmes(db, school_dicts)

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
            # Danger flag: mark at_risk if score below programme LQ
            is_at_risk = result.component_scores.get("risk_level") == "at_risk" if result.component_scores else False
            existing.at_risk = is_at_risk
            existing.risk_reasons = [f"Score below LQ for {result.major_name or result.school_name}"] if is_at_risk else []
        else:
            # Do not auto-add schools not in the target list during match run
            pass

    db.commit()

    # Build Chinese name lookups
    school_zh, programme_zh = _build_zh_lookups(db, results)

    # Return serialisable list
    return [
        {
            "school_id": r.school_id,
            "school_name": r.school_name,
            "school_name_zh": school_zh.get(r.school_id),
            "major_name": r.major_name,
            "name_zh": programme_zh.get(r.major_jupas_code),
            "major_jupas_code": r.major_jupas_code,
            "eligibility_pass": r.eligibility_pass,
            "failing_criteria": r.failing_criteria,
            "fit_score": r.fit_score,
            "component_scores": r.component_scores,
            "ml_probability": r.ml_probability,
            "final_score": r.final_score,
            "shap_explanation": r.shap_explanation,
            "rationale": r.rationale,
            "data_completeness": r.data_completeness,
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
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
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
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    student_data = build_student_data(student, db)

    all_schools = db.query(School).all()
    school_dicts = [build_school_dict(s) for s in all_schools]

    # Attach JUPAS programmes for scorer integration
    school_dicts = attach_jupas_programmes(db, school_dicts)

    # No existing target preference context
    results = run_matching(student_data, school_dicts, [])

    # Only use results that have admission_probability from the JUPAS scorer.
    # Results from the old heuristic path (no scorer) use stale major_requirements
    # data and don't have real probability estimates.
    scored = [
        r for r in results
        if r.eligibility_pass
        and r.component_scores.get("admission_probability") is not None
    ]

    # Strategy: "ambitious but achievable" — prefer 70-90% admission probability
    # This targets programmes where the student has a strong but not guaranteed chance.
    def get_prob(r):
        return r.component_scores.get("admission_probability", 0)

    # Tier 1: Sweet spot (70-90% probability) — ambitious but achievable
    sweet_spot = [r for r in scored if 0.30 <= get_prob(r) <= 0.90]
    sweet_spot.sort(key=lambda r: get_prob(r), reverse=True)

    # Tier 2: Achievable (50-70%) — moderate reach
    moderate = [r for r in scored if 0.50 <= get_prob(r) < 0.70 and r not in sweet_spot]
    moderate.sort(key=lambda r: get_prob(r), reverse=True)

    # Tier 3: Safe (>90%) — backup options
    safe = [r for r in scored if get_prob(r) > 0.90]
    safe.sort(key=lambda r: get_prob(r))

    # Build recommendation list: prioritise sweet spot, fill from moderate, then safe
    candidates = sweet_spot + moderate + safe
    top = candidates[:limit]

    # Fallback: if no scorer results, use heuristic results (better than nothing)
    if not top:
        fallback = [r for r in results if r.eligibility_pass]
        fallback.sort(key=lambda r: r.final_score, reverse=True)
        top = fallback[:limit]

    # Build Chinese name lookups
    school_zh, programme_zh = _build_zh_lookups(db, top)

    return [
        {
            "school_id": r.school_id,
            "school_name": r.school_name,
            "school_name_zh": school_zh.get(r.school_id),
            "major_name": r.major_name,
            "name_zh": programme_zh.get(r.major_jupas_code),
            "major_jupas_code": r.major_jupas_code,
            "admission_probability": r.component_scores.get("admission_probability"),
            "risk_level": r.component_scores.get("risk_level"),
            "fit_score": round(r.fit_score, 3),
            "final_score": round(r.final_score, 3),
            "rationale": r.rationale,
        }
        for r in top
    ]
