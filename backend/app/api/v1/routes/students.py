"""
app/api/v1/routes/students.py

Student profile CRUD endpoints — all protected.
"""
from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import Student, User
from app.services.permission_service import check_feature_permission
from app.db.models_v2 import AcademicPlan, StudentSchoolTarget
from app.db.session import get_db
from app.schemas.student import (
    StudentCreate,
    StudentFullResponse,
    StudentGraduateRequest,
    StudentLanguageScoresUpdate,
    StudentListItem,
    StudentProfileUpdate,
    StudentResponse,
    StudentUpdate,
)
from app.schemas.v2.jsonb_models import (
    AwardSchema,
    ExtracurricularSchema,
    TeacherEvaluationSchema,
)
from app.services import student_service

router = APIRouter(prefix="/students", tags=["students"])


def _org_id(user: User) -> UUID | None:
    """Extract the active organisation ID from the user, if set."""
    return getattr(user, "active_organisation_id", None)


def _build_full_response(student: Student) -> dict:
    """Build a StudentFullResponse-compatible dict from a Student ORM object."""
    ielts = student.ielts_score or {}
    if not isinstance(ielts, dict):
        ielts = {}
    return {
        "id": student.id,
        "user_id": student.user_id,
        "name": student.name,
        "grades": student.grades or {},
        "interests": student.interests or [],
        "strengths_weaknesses": student.strengths_weaknesses or "",
        "target_region": student.target_region or "local",
        "created_at": student.created_at,
        "updated_at": student.updated_at,
        # v2 identity
        "full_name": student.name,  # name is the canonical full name
        "preferred_name": student.preferred_name,
        "date_of_birth": student.date_of_birth,
        "gender": student.gender,
        "address": student.address,
        "phone": student.phone,
        "email": student.email,
        "class_name": student.class_name,
        "year_of_study": student.year_of_study,
        "candidate_number": student.candidate_number,
        "financial_aid_flag": student.financial_aid_flag or False,
        "preferred_language": student.preferred_language or "en",
        "notes": student.notes,
        "personal_statement": student.personal_statement,
        "is_graduated": student.is_graduated or False,
        "graduation_year": student.graduation_year,
        "final_school_id": student.final_school_id,
        "final_major": student.final_major,
        # Flat IELTS fields
        "ielts_score": ielts.get("overall"),
        "ielts_listening": ielts.get("listening"),
        "ielts_reading": ielts.get("reading"),
        "ielts_writing": ielts.get("writing"),
        "ielts_speaking": ielts.get("speaking"),
        "ielts_date": ielts.get("test_date"),
        "other_language_scores": student.other_language_scores or [],
        # v2 JSONB arrays
        "teacher_evaluation": student.teacher_evaluation or [],
        "extra_curricular": student.extra_curricular or [],
        "awards": student.awards or [],
    }


# REQ-015, REQ-032
@router.get("", status_code=status.HTTP_200_OK)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    q: str | None = Query(None, description="Text search across student name"),
    unaccounted: bool = Query(False, description="Filter to students with no active user account"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List student profiles owned by the authenticated counselor (paginated). REQ-015, REQ-032"""
    from sqlalchemy import select
    from app.db.models import User as UserModel

    all_students = student_service.get_students(
        db, user_id=current_user.id, organisation_id=_org_id(current_user),
        q=q, unaccounted=unaccounted,
    )
    from app.services.permission_service import get_visible_student_ids
    visible_ids = get_visible_student_ids(current_user, db)
    if visible_ids is not None:
        all_students = [s for s in all_students if s.id in visible_ids]
    total = len(all_students)
    students = all_students[skip : skip + limit]

    # Build a map of student_ids -> plan generated_at — single query, no N+1
    student_ids = [s.id for s in students]
    plan_map = {}
    at_risk_set: set = set()
    account_sids: set = set()
    if student_ids:
        rows = db.execute(
            select(AcademicPlan.student_id, AcademicPlan.generated_at).where(
                AcademicPlan.student_id.in_(student_ids),
                AcademicPlan.generated_at.isnot(None),
            )
        ).fetchall()
        plan_map = {row[0]: row[1] for row in rows}

        # Check for at-risk targets
        risk_rows = db.execute(
            select(StudentSchoolTarget.student_id).where(
                StudentSchoolTarget.student_id.in_(student_ids),
                StudentSchoolTarget.at_risk.is_(True),
            ).distinct()
        ).fetchall()
        at_risk_set = {row[0] for row in risk_rows}

        # Account status lookup
        acct_rows = db.execute(
            select(UserModel.student_id).where(
                UserModel.student_id.in_(student_ids),
                UserModel.is_active.is_(True),
            )
        ).fetchall()
        account_sids = {row[0] for row in acct_rows}

    result = []
    for s in students:
        item = StudentListItem.model_validate(s)
        item.has_plan = s.id in plan_map
        item.plan_generated_at = plan_map.get(s.id)
        item.full_name = s.name
        item.has_at_risk_targets = s.id in at_risk_set
        item_dict = item.model_dump()
        item_dict["has_account"] = s.id in account_sids
        item_dict["invite_status"] = (
            "accepted" if getattr(s, "invite_accepted_at", None)
            else "invited" if getattr(s, "invite_sent_at", None)
            else "none"
        )
        item_dict["email"] = getattr(s, "email", None)
        result.append(item_dict)
    return {"items": result, "total": total}


# REQ-012, REQ-025, REQ-028, REQ-033
@router.post("", response_model=StudentFullResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new student profile. REQ-012, REQ-025, REQ-028, REQ-033"""
    student = student_service.create_student(db, user_id=current_user.id, data=payload, organisation_id=_org_id(current_user))
    return _build_full_response(student)


# REQ-014, REQ-033
@router.get("/{student_id}", response_model=StudentFullResponse, status_code=status.HTTP_200_OK)
def get_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a full student profile by ID. REQ-014, REQ-033"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    return _build_full_response(student)


# Alias: GET /{student_id}/profile — same as GET /{student_id}
@router.get("/{student_id}/profile", response_model=StudentFullResponse, status_code=status.HTTP_200_OK)
def get_student_profile(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a full student profile. REQ-014, REQ-033"""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    return _build_full_response(student)


# REQ-013, REQ-033
@router.put("/{student_id}", response_model=StudentResponse, status_code=status.HTTP_200_OK)
def update_student(
    student_id: UUID,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full update of a student profile (v1 fields). REQ-013, REQ-033"""
    from fastapi import HTTPException
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
    return student_service.update_student(
        db, student_id=student_id, user_id=current_user.id, data=payload,
        organisation_id=_org_id(current_user),
    )


# v2 full profile update
@router.put("/{student_id}/profile", response_model=StudentFullResponse, status_code=status.HTTP_200_OK)
def update_student_profile(
    student_id: UUID,
    payload: StudentProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update all v2 student profile fields. REQ-057"""
    from fastapi import HTTPException as _HTTPException
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
    if perm != "read_write":
        raise _HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))

    update_fields: dict[str, Any] = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None
    }

    # `full_name` in request → `name` in model
    if "full_name" in update_fields:
        student.name = update_fields.pop("full_name")

    for field, value in update_fields.items():
        if hasattr(student, field):
            setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return _build_full_response(student)


# Language scores
@router.post("/{student_id}/language-scores", response_model=StudentFullResponse, status_code=status.HTTP_200_OK)
def update_language_scores(
    student_id: UUID,
    payload: StudentLanguageScoresUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save IELTS and other language scores for a student."""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))

    # Pack flat IELTS fields into the JSONB structure
    existing_ielts = student.ielts_score or {}
    if not isinstance(existing_ielts, dict):
        existing_ielts = {}
    new_ielts = dict(existing_ielts)

    mapping = {
        "ielts_score": "overall",
        "ielts_listening": "listening",
        "ielts_reading": "reading",
        "ielts_writing": "writing",
        "ielts_speaking": "speaking",
        "ielts_date": "test_date",
    }
    data = payload.model_dump(exclude_unset=True)
    for flat_key, jsonb_key in mapping.items():
        if flat_key in data and data[flat_key] is not None:
            new_ielts[jsonb_key] = data[flat_key]

    student.ielts_score = new_ielts or None

    if payload.other_language_scores is not None:
        student.other_language_scores = payload.other_language_scores

    db.commit()
    db.refresh(student)
    return _build_full_response(student)


# Teacher evaluations
@router.get("/{student_id}/teacher-evaluations", status_code=status.HTTP_200_OK)
def get_teacher_evaluations(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return teacher evaluation array for a student."""
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    return student.teacher_evaluation or []


@router.put("/{student_id}/teacher-evaluations", status_code=status.HTTP_200_OK)
def update_teacher_evaluations(
    student_id: UUID,
    payload: list = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the teacher evaluation array for a student."""
    # Validate each item against TeacherEvaluationSchema — reject truly malformed data
    try:
        validated = [TeacherEvaluationSchema(**item).model_dump() if isinstance(item, dict) else item for item in payload]
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid teacher evaluation data: {exc}")
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    student.teacher_evaluation = validated
    db.commit()
    db.refresh(student)
    return student.teacher_evaluation or []


# Extracurricular activities
@router.post("/{student_id}/extracurricular", status_code=status.HTTP_200_OK)
def update_extracurricular(
    student_id: UUID,
    payload: list = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the extracurricular activities array for a student."""
    # Validate each item against ExtracurricularSchema — reject truly malformed data
    try:
        validated = [ExtracurricularSchema(**item).model_dump() if isinstance(item, dict) else item for item in payload]
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid extracurricular data: {exc}")
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    student.extra_curricular = validated
    db.commit()
    db.refresh(student)
    return student.extra_curricular or []


# Awards
@router.post("/{student_id}/awards", status_code=status.HTTP_200_OK)
def update_awards(
    student_id: UUID,
    payload: list = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the awards array for a student."""
    # Validate each item against AwardSchema — reject truly malformed data
    try:
        validated = [AwardSchema(**item).model_dump() if isinstance(item, dict) else item for item in payload]
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid award data: {exc}")
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    student.awards = validated
    db.commit()
    db.refresh(student)
    return student.awards or []


# Graduate a student — marks is_graduated=True and records final destination
@router.post("/{student_id}/graduate", response_model=StudentFullResponse, status_code=status.HTTP_200_OK)
def graduate_student(
    student_id: UUID,
    payload: StudentGraduateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a student as graduated with their final school and major. Feeds the analytics data store."""
    from datetime import date as _date
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    student.is_graduated = True
    if payload.final_school_id is not None:
        student.final_school_id = payload.final_school_id
    if payload.final_major is not None:
        student.final_major = payload.final_major
    student.graduation_year = payload.graduation_year or _date.today().year

    # Auto-unbind the student's user account on graduation
    linked_user = db.query(User).filter(User.student_id == student.id, User.is_active == True).first()  # noqa: E712
    if linked_user:
        linked_user.student_id = None
        linked_user.is_active = False

    db.commit()
    db.refresh(student)
    return _build_full_response(student)


# REQ-025, REQ-028
@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a student profile. Requires student_delete permission. REQ-025, REQ-028"""
    from fastapi import HTTPException
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_delete")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student delete permission required.")
    student_service.delete_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
