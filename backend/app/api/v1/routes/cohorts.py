"""
app/api/v1/routes/cohorts.py

StudentCohort CRUD + stats endpoints.
"""
from __future__ import annotations

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import Student, User
from app.db.models_v2 import (
    CohortMembership,
    StudentCohort,
    StudentSubjectGrade,
    Subject,
)
from app.db.session import get_db
from app.schemas.v2.cohorts import (
    CohortAddMembers,
    CohortCreate,
    CohortDetailResponse,
    CohortListResponse,
    CohortMemberResponse,
    CohortResponse,
    CohortStatsResponse,
    CohortUpdate,
    StudentSearchResponse,
    StudentSearchResult,
    SubjectStatEntry,
)
from app.modules.school_choice.services.hkdse_service import grade_to_int

router = APIRouter(prefix="/cohorts", tags=["cohorts"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _org_id(user: User) -> UUID | None:
    """Extract the active organisation ID from the user, if set."""
    return getattr(user, "active_organisation_id", None)


def _get_cohort_or_404(
    db: Session, cohort_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> StudentCohort:
    query = db.query(StudentCohort).filter(StudentCohort.id == cohort_id)
    if organisation_id is not None:
        query = query.filter(StudentCohort.organisation_id == organisation_id)
    else:
        query = query.filter(StudentCohort.user_id == user_id)
    cohort = query.first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return cohort


def _cohort_to_response(cohort: StudentCohort) -> CohortResponse:
    return CohortResponse(
        id=cohort.id,
        name=cohort.name,
        description=cohort.description,
        academic_year=cohort.academic_year,
        member_count=len(cohort.memberships),
        created_at=cohort.created_at,
        updated_at=cohort.updated_at,
    )


def _member_to_response(student: Student) -> CohortMemberResponse:
    return CohortMemberResponse(
        id=student.id,
        full_name=student.name or "",
        class_name=getattr(student, "class_name", None),
        year_of_study=getattr(student, "year_of_study", None),
    )


# ---------------------------------------------------------------------------
# GET /cohorts  — list all cohorts for the current user
# ---------------------------------------------------------------------------

@router.get("", response_model=CohortListResponse, status_code=status.HTTP_200_OK)
def list_cohorts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all cohorts owned by the current counsellor."""
    org_id = _org_id(current_user)
    q = db.query(StudentCohort)
    if org_id is not None:
        q = q.filter(StudentCohort.organisation_id == org_id)
    else:
        q = q.filter(StudentCohort.user_id == current_user.id)
    cohorts = q.order_by(StudentCohort.created_at.desc()).all()
    return CohortListResponse(
        cohorts=[_cohort_to_response(c) for c in cohorts],
        total=len(cohorts),
    )


# ---------------------------------------------------------------------------
# POST /cohorts  — create a cohort
# ---------------------------------------------------------------------------

@router.post("", response_model=CohortResponse, status_code=status.HTTP_201_CREATED)
def create_cohort(
    payload: CohortCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new student cohort."""
    cohort = StudentCohort(
        user_id=current_user.id,
        organisation_id=_org_id(current_user),
        name=payload.name,
        description=payload.description,
        academic_year=payload.academic_year,
    )
    db.add(cohort)
    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(cohort)


# ---------------------------------------------------------------------------
# GET /cohorts/students/search  — search students to add to a cohort
# Must be declared BEFORE /{cohort_id} to avoid route shadowing
# ---------------------------------------------------------------------------

@router.get(
    "/students/search",
    response_model=StudentSearchResponse,
    status_code=status.HTTP_200_OK,
)
def search_students(
    q: Optional[str] = Query(None, description="Name substring filter"),
    class_name: Optional[str] = Query(None),
    year_of_study: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search students owned by the current counsellor.
    Filterable by name, class, and year of study.
    """
    org_id = _org_id(current_user)
    if org_id is not None:
        query = db.query(Student).filter(Student.organisation_id == org_id)
    else:
        query = db.query(Student).filter(Student.user_id == current_user.id)

    if q:
        query = query.filter(Student.name.ilike(f"%{q}%"))
    if class_name:
        query = query.filter(Student.class_name == class_name)
    if year_of_study is not None:
        query = query.filter(Student.year_of_study == year_of_study)

    students = query.order_by(Student.name).limit(50).all()

    return StudentSearchResponse(
        students=[
            StudentSearchResult(
                id=s.id,
                full_name=s.name or "",
                class_name=getattr(s, "class_name", None),
                year_of_study=getattr(s, "year_of_study", None),
                candidate_number=getattr(s, "candidate_number", None),
            )
            for s in students
        ],
        total=len(students),
    )


# ---------------------------------------------------------------------------
# GET /cohorts/{cohort_id}  — get cohort detail with members
# ---------------------------------------------------------------------------

@router.get(
    "/{cohort_id}",
    response_model=CohortDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_cohort(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a cohort with its full member list."""
    cohort = _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    members = [_member_to_response(m.student) for m in cohort.memberships if m.student]
    return CohortDetailResponse(
        id=cohort.id,
        name=cohort.name,
        description=cohort.description,
        members=members,
        created_at=cohort.created_at,
        updated_at=cohort.updated_at,
    )


# ---------------------------------------------------------------------------
# PUT /cohorts/{cohort_id}  — update cohort name/description
# ---------------------------------------------------------------------------

@router.put(
    "/{cohort_id}",
    response_model=CohortResponse,
    status_code=status.HTTP_200_OK,
)
def update_cohort(
    cohort_id: UUID,
    payload: CohortUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update cohort name or description."""
    cohort = _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    if payload.name is not None:
        cohort.name = payload.name
    if payload.description is not None:
        cohort.description = payload.description
    if payload.academic_year is not None:
        cohort.academic_year = payload.academic_year
    db.commit()
    db.refresh(cohort)
    return _cohort_to_response(cohort)


# ---------------------------------------------------------------------------
# DELETE /cohorts/{cohort_id}  — delete cohort
# ---------------------------------------------------------------------------

@router.delete("/{cohort_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cohort(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a cohort (members are unlinked, not deleted)."""
    cohort = _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    db.delete(cohort)
    db.commit()


# ---------------------------------------------------------------------------
# POST /cohorts/{cohort_id}/members  — add students
# ---------------------------------------------------------------------------

@router.post(
    "/{cohort_id}/members",
    response_model=CohortDetailResponse,
    status_code=status.HTTP_200_OK,
)
def add_members(
    cohort_id: UUID,
    payload: CohortAddMembers,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add one or more students to a cohort. Duplicates are silently ignored."""
    cohort = _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))

    existing_ids = {m.student_id for m in cohort.memberships}
    for sid in payload.student_ids:
        if sid in existing_ids:
            continue
        org_id = _org_id(current_user)
        if org_id is not None:
            student = (
                db.query(Student)
                .filter(Student.id == sid, Student.organisation_id == org_id)
                .first()
            )
        else:
            student = (
                db.query(Student)
                .filter(Student.id == sid, Student.user_id == current_user.id)
                .first()
            )
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student {sid} not found",
            )
        db.add(CohortMembership(cohort_id=cohort_id, student_id=sid))

    db.commit()
    db.refresh(cohort)
    members = [_member_to_response(m.student) for m in cohort.memberships if m.student]
    return CohortDetailResponse(
        id=cohort.id,
        name=cohort.name,
        description=cohort.description,
        members=members,
        created_at=cohort.created_at,
        updated_at=cohort.updated_at,
    )


# ---------------------------------------------------------------------------
# DELETE /cohorts/{cohort_id}/members/{student_id}  — remove a student
# ---------------------------------------------------------------------------

@router.delete("/{cohort_id}/members/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    cohort_id: UUID,
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a student from a cohort."""
    _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    membership = (
        db.query(CohortMembership)
        .filter(
            CohortMembership.cohort_id == cohort_id,
            CohortMembership.student_id == student_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    db.delete(membership)
    db.commit()


# ---------------------------------------------------------------------------
# GET /cohorts/{cohort_id}/stats  — aggregate subject statistics
# ---------------------------------------------------------------------------

@router.get(
    "/{cohort_id}/stats",
    response_model=CohortStatsResponse,
    status_code=status.HTTP_200_OK,
)
def get_cohort_stats(
    cohort_id: UUID,
    sitting: Optional[str] = Query(None, description="Filter by sitting: MOCK | TRIAL | OFFICIAL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute per-subject aggregate statistics (mean, variance, distribution)
    across all students in the cohort.
    """
    cohort = _get_cohort_or_404(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    member_ids = [m.student_id for m in cohort.memberships]

    if not member_ids:
        return CohortStatsResponse(
            cohort_id=cohort.id,
            cohort_name=cohort.name,
            member_count=0,
            subject_stats=[],
        )

    # Collect all grades for cohort members
    grade_query = (
        db.query(StudentSubjectGrade)
        .filter(StudentSubjectGrade.student_id.in_(member_ids))
    )
    if sitting:
        grade_query = grade_query.filter(StudentSubjectGrade.sitting == sitting.upper())

    grade_rows = grade_query.all()

    # Group by (subject_id, sitting)
    from collections import defaultdict
    groups: dict[tuple, list] = defaultdict(list)
    for row in grade_rows:
        raw = row.raw_grade or row.predicted_grade
        if raw:
            groups[(row.subject_id, row.sitting)].append(raw)

    # Build stats per group
    stats: list[SubjectStatEntry] = []
    for (subject_id, sitting_val), grades in groups.items():
        subj = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subj:
            continue

        numerics = [grade_to_int(g) for g in grades]
        count = len(numerics)
        mean = sum(numerics) / count if count else 0.0
        variance = (
            sum((x - mean) ** 2 for x in numerics) / count
            if count else 0.0
        )

        dist: dict[str, int] = {}
        for g in grades:
            dist[g] = dist.get(g, 0) + 1

        stats.append(SubjectStatEntry(
            subject_code=subj.code,
            subject_name=subj.name,
            sitting=sitting_val,
            count=count,
            mean=round(mean, 3),
            variance=round(variance, 3),
            grade_distribution=dist,
        ))

    # Sort by subject code then sitting
    stats.sort(key=lambda s: (s.subject_code, s.sitting))

    return CohortStatsResponse(
        cohort_id=cohort.id,
        cohort_name=cohort.name,
        member_count=len(member_ids),
        subject_stats=stats,
    )
