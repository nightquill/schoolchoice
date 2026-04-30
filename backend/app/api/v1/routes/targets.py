"""
app/api/v1/routes/targets.py

StudentSchoolTarget CRUD endpoints.
REQ-069
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, User
from app.db.models_v2 import StudentSchoolTarget, Subject
from app.db.session import get_db
from app.schemas.v2.targets import (
    TargetCreate,
    TargetListResponse,
    TargetReorder,
    TargetResponse,
    TargetUpdate,
)
from app.services import student_service
from app.services.hkdse_service import compute_best5_aggregate, grade_to_int
from app.services.matchmaker_v2 import compute_weighted_score, run_eligibility_filter

router = APIRouter(prefix="/students", tags=["targets-v2"])


# ---------------------------------------------------------------------------
# Helper: build student_data dict for the matching engine
# ---------------------------------------------------------------------------

def _build_student_data(student, db: Session) -> dict:
    """Assemble the student_data dict used by run_eligibility_filter / compute_weighted_score."""
    grade_records = getattr(student, "subject_grades", None) or []
    grade_dicts_for_agg = []
    grades_by_code: dict[str, str] = {}
    elective_codes: list[str] = []

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

    best5 = compute_best5_aggregate(grade_dicts_for_agg)

    ielts_raw = getattr(student, "ielts_score", None)
    ielts_overall = None
    if isinstance(ielts_raw, dict):
        ielts_overall = ielts_raw.get("overall")
    elif ielts_raw is not None:
        try:
            ielts_overall = float(ielts_raw)
        except (TypeError, ValueError):
            pass

    extra = getattr(student, "extra_curricular", None) or []
    extra_activities: list[str] = [
        (ec.get("activity") or "") if isinstance(ec, dict) else str(ec)
        for ec in extra
    ]

    awards_raw = getattr(student, "awards", None) or []
    award_titles: list[str] = [
        (aw.get("title") or "") if isinstance(aw, dict) else str(aw)
        for aw in awards_raw
    ]

    return {
        "best5_aggregate": best5,
        "grades_by_code": grades_by_code,
        "ielts_score": ielts_overall,
        "elective_codes": elective_codes,
        "extra_curricular_activities": extra_activities,
        "award_titles": award_titles,
    }


def _school_to_dict(school: School) -> dict:
    """Convert a School ORM object to the dict expected by the matching engine."""
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
    }


def _get_target_or_404(
    db: Session, target_id: UUID, student_id: UUID
) -> StudentSchoolTarget:
    target = (
        db.query(StudentSchoolTarget)
        .filter(
            StudentSchoolTarget.id == target_id,
            StudentSchoolTarget.student_id == student_id,
        )
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")
    return target


# ---------------------------------------------------------------------------
# GET /students/{student_id}/targets
# ---------------------------------------------------------------------------

@router.get(
    "/{student_id}/targets",
    response_model=TargetListResponse,
    status_code=status.HTTP_200_OK,
)
def list_targets(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all target schools for a student with fresh eligibility/match scores. REQ-069"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    targets = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.student_id == student_id)
        .order_by(StudentSchoolTarget.student_rank.asc().nulls_last())
        .all()
    )

    # Re-run eligibility and scoring on every GET to keep scores fresh as grades are updated
    student_data = _build_student_data(student, db)

    target_responses = []
    for t in targets:
        school = t.school
        resp = TargetResponse.model_validate(t)

        if school is not None:
            resp.school_name = school.name
            school_dict = _school_to_dict(school)
            passes, failing = run_eligibility_filter(student_data, school_dict)
            comp_scores = compute_weighted_score(student_data, school_dict)
            match_score = comp_scores.get("weighted_score", 0.0)

            # Persist fresh values
            t.eligibility_pass = passes
            t.match_score = match_score
            t.shap_explanation = {
                **(t.shap_explanation or {}),
                "failing_criteria": failing,
            }

            resp.eligibility_pass = passes
            resp.match_score = match_score
            resp.failing_criteria = failing
            resp.intended_majors = t.intended_majors
            resp.year_of_entry = t.year_of_entry

        target_responses.append(resp)

    db.commit()
    return TargetListResponse(targets=target_responses, total=len(target_responses))


# ---------------------------------------------------------------------------
# POST /students/{student_id}/targets
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/targets",
    response_model=TargetResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_target(
    student_id: UUID,
    payload: TargetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a school to the student's target list. REQ-069"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    # Verify school exists
    school = db.query(School).filter(School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")

    # Check for duplicate
    existing = (
        db.query(StudentSchoolTarget)
        .filter(
            StudentSchoolTarget.student_id == student_id,
            StudentSchoolTarget.school_id == payload.school_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="School is already in the student's target list",
        )

    # Run eligibility and matching immediately
    student_data = _build_student_data(student, db)
    school_dict = _school_to_dict(school)
    passes, failing = run_eligibility_filter(student_data, school_dict)
    comp_scores = compute_weighted_score(student_data, school_dict)
    match_score = comp_scores.get("weighted_score", 0.0)

    target = StudentSchoolTarget(
        student_id=student_id,
        school_id=payload.school_id,
        student_rank=payload.student_rank,
        status=payload.status,
        eligibility_pass=passes,
        match_score=match_score,
        shap_explanation={"failing_criteria": failing},
        intended_majors=payload.intended_majors,
        year_of_entry=payload.year_of_entry,
        preference_confidence=payload.preference_confidence if payload.preference_confidence is not None else 3,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    resp = TargetResponse.model_validate(target)
    resp.school_name = school.name
    resp.eligibility_pass = passes
    resp.match_score = match_score
    resp.failing_criteria = failing
    return resp


# ---------------------------------------------------------------------------
# PUT /students/{student_id}/targets/{target_id}
# ---------------------------------------------------------------------------

@router.put(
    "/{student_id}/targets/{target_id}",
    response_model=TargetResponse,
    status_code=status.HTTP_200_OK,
)
def update_target(
    student_id: UUID,
    target_id: UUID,
    payload: TargetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update student_rank or status on a target. REQ-069"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    target = _get_target_or_404(db, target_id, student_id)

    if payload.student_rank is not None:
        target.student_rank = payload.student_rank
    if payload.status is not None:
        target.status = payload.status
    if payload.intended_majors is not None:
        target.intended_majors = payload.intended_majors
    if payload.year_of_entry is not None:
        target.year_of_entry = payload.year_of_entry
    if payload.preference_confidence is not None:
        target.preference_confidence = payload.preference_confidence

    db.commit()
    db.refresh(target)
    return target


# ---------------------------------------------------------------------------
# DELETE /students/{student_id}/targets/{target_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{student_id}/targets/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_target(
    student_id: UUID,
    target_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a school from the student's target list. REQ-069"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)
    target = _get_target_or_404(db, target_id, student_id)
    db.delete(target)
    db.commit()


# ---------------------------------------------------------------------------
# POST /students/{student_id}/targets/reorder
# ---------------------------------------------------------------------------

@router.post(
    "/{student_id}/targets/reorder",
    status_code=status.HTTP_200_OK,
)
def reorder_targets(
    student_id: UUID,
    payload: TargetReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atomically reassign student_rank 1..N for the given ordered target IDs. REQ-069"""
    student_service.get_student(db, student_id=student_id, user_id=current_user.id)

    if not payload.ordered_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ordered_ids must not be empty",
        )

    # Fetch all targets at once to validate ownership
    targets_by_id: dict[UUID, StudentSchoolTarget] = {}
    for tid in payload.ordered_ids:
        t = (
            db.query(StudentSchoolTarget)
            .filter(
                StudentSchoolTarget.id == tid,
                StudentSchoolTarget.student_id == student_id,
            )
            .first()
        )
        if not t:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target {tid} not found for this student",
            )
        targets_by_id[tid] = t

    # Assign ranks atomically — first clear all ranks to avoid unique constraint collision
    for t in targets_by_id.values():
        t.student_rank = None
    db.flush()

    for rank, tid in enumerate(payload.ordered_ids, start=1):
        targets_by_id[tid].student_rank = rank

    db.commit()
    return {"reordered": len(payload.ordered_ids)}
