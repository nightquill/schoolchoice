"""
app/api/v1/routes/targets.py

StudentSchoolTarget CRUD endpoints.
REQ-069
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.db.models import School, Student, User
from app.services.permission_service import check_feature_permission
from app.db.models_v2 import StudentSchoolTarget
from app.db.session import get_db
from app.schemas.v2.targets import (
    TargetCreate,
    TargetListResponse,
    TargetReorder,
    TargetResponse,
    TargetUpdate,
)
from app.services import student_service
from app.services.matching_service import attach_jupas_programmes
from app.services.student_data_builder import build_school_dict, build_student_data
from app.modules.school_choice.services.matchmaker_v2 import compute_weighted_score, run_eligibility_filter

router = APIRouter(prefix="/students", tags=["targets-v2"])

# Secondary router for flat /targets/{target_id} endpoints (counselor agency)
targets_flat_router = APIRouter(prefix="/targets", tags=["targets-v2"])


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
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    targets = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.student_id == student_id)
        .order_by(StudentSchoolTarget.student_rank.asc().nulls_last())
        .all()
    )

    # Re-run eligibility and scoring on every GET to keep scores fresh as grades are updated
    student_data = build_student_data(student, db)

    # Pre-build school dicts with JUPAS programmes attached
    school_dict_map: dict[str, dict] = {}
    for t in targets:
        if t.school is not None and str(t.school_id) not in school_dict_map:
            school_dict_map[str(t.school_id)] = build_school_dict(t.school)
    if school_dict_map:
        attach_jupas_programmes(db, list(school_dict_map.values()))

    target_responses = []
    for t in targets:
        school = t.school
        resp = TargetResponse.model_validate(t)

        if school is not None:
            resp.school_name = school.name
            resp.school_name_zh = getattr(school, 'name_zh', None)
            resp.jupas_code = t.jupas_code
            resp.programme_name = t.programme_name
            # Look up programme_name_zh from JUPAS data
            if t.jupas_code:
                from app.modules.school_choice.models.models import JupasProgramme
                jp = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == t.jupas_code).first()
                if jp:
                    resp.programme_name_zh = getattr(jp, 'name_zh', None)
            school_dict = school_dict_map.get(str(t.school_id), build_school_dict(school))

            # If target has a JUPAS programme, use programme-level scoring
            if t.jupas_code and school_dict.get("jupas_programmes"):
                from app.modules.school_choice.services.jupas_scorer import score_student_for_programme
                prog = next((p for p in school_dict["jupas_programmes"] if p.get("jupas_code") == t.jupas_code), None)
                if prog:
                    student_grades = student_data.get("grades_by_code", {})
                    result = score_student_for_programme(student_grades, prog)
                    match_score = result.get("admission_probability", 0.0)
                    passes = result.get("eligible", True)
                    failing = list(result.get("eligibility_failures", []))

                    # Also run school-level eligibility (aggregate check)
                    school_passes, school_failing = run_eligibility_filter(student_data, school_dict)
                    if not school_passes:
                        passes = False
                        failing.extend(school_failing)

                    t.eligibility_pass = passes
                    t.match_score = match_score
                    t.at_risk = result.get("risk_level") == "at_risk"
                    t.risk_reasons = [result.get("risk_level", "")] if t.at_risk else []
                else:
                    # Programme not found — fallback to heuristic
                    passes, failing = run_eligibility_filter(student_data, school_dict)
                    comp_scores = compute_weighted_score(student_data, school_dict)
                    match_score = comp_scores.get("weighted_score", 0.0)
                    t.eligibility_pass = passes
                    t.match_score = match_score
            else:
                # No JUPAS code — use heuristic scoring
                passes, failing = run_eligibility_filter(student_data, school_dict)
                comp_scores = compute_weighted_score(student_data, school_dict)
                match_score = comp_scores.get("weighted_score", 0.0)
                t.eligibility_pass = passes
                t.match_score = match_score
                failing = failing

            t.shap_explanation = {
                **(t.shap_explanation or {}),
                "failing_criteria": failing if 'failing' in dir() else [],
            }

            resp.eligibility_pass = t.eligibility_pass
            resp.match_score = float(t.match_score) if t.match_score else 0.0
            resp.failing_criteria = failing if 'failing' in dir() else []
            resp.at_risk = t.at_risk
            resp.risk_reasons = t.risk_reasons or []
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
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="programme_choices")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Programme choices write permission required.")
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

    # Verify school exists
    school = db.query(School).filter(School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School not found")

    # Check for duplicate (same school + same programme)
    dup_filter = [
        StudentSchoolTarget.student_id == student_id,
        StudentSchoolTarget.school_id == payload.school_id,
    ]
    if payload.jupas_code:
        dup_filter.append(StudentSchoolTarget.jupas_code == payload.jupas_code)
    else:
        dup_filter.append(StudentSchoolTarget.jupas_code.is_(None))
    existing = db.query(StudentSchoolTarget).filter(*dup_filter).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This programme is already in the student's target list",
        )

    # Run eligibility and matching immediately
    student_data = build_student_data(student, db)
    school_dict = build_school_dict(school)
    attach_jupas_programmes(db, [school_dict])

    at_risk = False
    risk_reasons = []

    # Use JUPAS programme-level scoring if jupas_code provided
    if payload.jupas_code and school_dict.get("jupas_programmes"):
        from app.modules.school_choice.services.jupas_scorer import score_student_for_programme
        prog = next((p for p in school_dict["jupas_programmes"] if p.get("jupas_code") == payload.jupas_code), None)
        if prog:
            student_grades = student_data.get("grades_by_code", {})
            result = score_student_for_programme(student_grades, prog)
            match_score = result.get("admission_probability", 0.0)
            passes = result.get("eligible", True)
            failing = list(result.get("eligibility_failures", []))
            # Also run school-level eligibility (aggregate check)
            school_passes, school_failing = run_eligibility_filter(student_data, school_dict)
            if not school_passes:
                passes = False
                failing.extend(school_failing)
            at_risk = result.get("risk_level") == "at_risk"
            risk_reasons = [result.get("risk_level", "")] if at_risk else []
        else:
            passes, failing = run_eligibility_filter(student_data, school_dict)
            comp_scores = compute_weighted_score(student_data, school_dict)
            match_score = comp_scores.get("weighted_score", 0.0)
    else:
        passes, failing = run_eligibility_filter(student_data, school_dict)
        comp_scores = compute_weighted_score(student_data, school_dict)
        match_score = comp_scores.get("weighted_score", 0.0)

    target = StudentSchoolTarget(
        student_id=student_id,
        school_id=payload.school_id,
        jupas_code=payload.jupas_code,
        programme_name=payload.programme_name,
        student_rank=payload.student_rank,
        status=payload.status,
        eligibility_pass=passes,
        match_score=match_score,
        at_risk=at_risk,
        risk_reasons=risk_reasons,
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
    resp.school_name_zh = getattr(school, 'name_zh', None)
    resp.jupas_code = payload.jupas_code
    resp.programme_name = payload.programme_name
    if payload.jupas_code:
        from app.modules.school_choice.models.models import JupasProgramme
        jp = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == payload.jupas_code).first()
        if jp:
            resp.programme_name_zh = getattr(jp, 'name_zh', None)
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
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="programme_choices")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Programme choices write permission required.")
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
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
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="programme_choices")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Programme choices write permission required.")
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
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
    student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )

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


# ---------------------------------------------------------------------------
# Pydantic model for counselor target updates
# ---------------------------------------------------------------------------

class TargetCounselorUpdate(BaseModel):
    is_pinned: bool | None = None
    is_dismissed: bool | None = None
    counselor_notes: str | None = None
    status: str | None = None
    preference_confidence: int | None = None


# ---------------------------------------------------------------------------
# PATCH /targets/{target_id}  (counselor pin / dismiss / notes)
# ---------------------------------------------------------------------------

@targets_flat_router.patch("/{target_id}", status_code=200)
def update_target_counselor(
    target_id: UUID,
    payload: TargetCounselorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update counselor-specific fields on a target (pin, dismiss, notes). Decision #11."""
    target = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.id == target_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

    # Verify the current user owns the student
    student = db.query(Student).filter(Student.id == target.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    user_owns = str(student.user_id) == str(current_user.id)
    org_owns = (
        getattr(current_user, "active_organisation_id", None) is not None
        and getattr(student, "organisation_id", None) is not None
        and str(student.organisation_id) == str(current_user.active_organisation_id)
    )
    if not user_owns and not org_owns:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorised to modify this target")

    # Apply only the fields that were explicitly sent
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(target, field, value)

    db.commit()
    db.refresh(target)

    return TargetResponse.model_validate(target)
