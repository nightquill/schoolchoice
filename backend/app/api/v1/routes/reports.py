"""
app/api/v1/routes/reports.py

Cohort report endpoints — target distribution, risk breakdown, subject performance.
Decision #15 — Cohort Reports.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.models_v2 import (
    CohortMembership,
    StudentCohort,
    StudentSchoolTarget,
    StudentSubjectGrade,
    Subject,
)
from app.db.session import get_db
from app.modules.school_choice.models.models import School, Student
from app.modules.school_choice.services.hkdse_service import grade_to_int
from app.services.permission_service import check_feature_permission

router = APIRouter(prefix="/reports", tags=["reports"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _org_id(user: User) -> UUID | None:
    return getattr(user, "active_organisation_id", None)


def _get_cohort_or_403(
    db: Session, cohort_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> StudentCohort:
    """Fetch cohort; raise 404 if not found or user lacks access."""
    query = db.query(StudentCohort).filter(StudentCohort.id == cohort_id)
    if organisation_id is not None:
        query = query.filter(StudentCohort.organisation_id == organisation_id)
    else:
        query = query.filter(StudentCohort.user_id == user_id)
    cohort = query.first()
    if not cohort:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cohort not found")
    return cohort


def _member_student_ids(cohort: StudentCohort) -> list[UUID]:
    return [m.student_id for m in cohort.memberships]


def _check_cohort_feature(db, user, cohort, feature):
    """Check permission on a cohort by testing against its first member."""
    if user.role == "admin":
        return
    member_ids = _member_student_ids(cohort)
    if not member_ids:
        return
    perm = check_feature_permission(user, db, student_id=member_ids[0], feature=feature)
    if perm == "none":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No {feature} access for this cohort.",
        )


# ---------------------------------------------------------------------------
# GET /reports/cohort/{cohort_id}/target-distribution
# ---------------------------------------------------------------------------

@router.get("/cohort/{cohort_id}/target-distribution")
def target_distribution(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """School target distribution across cohort members."""
    cohort = _get_cohort_or_403(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    _check_cohort_feature(db, current_user, cohort, "reports")
    member_ids = _member_student_ids(cohort)

    if not member_ids:
        return {"cohort_name": cohort.name, "distribution": []}

    rows = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.student_id.in_(member_ids))
        .all()
    )

    # Group by school_id
    school_groups: dict[UUID, list] = defaultdict(list)
    for row in rows:
        school_groups[row.school_id].append(row)

    distribution = []
    for school_id, targets in school_groups.items():
        school = db.query(School).filter(School.id == school_id).first()
        school_name = school.name if school else "Unknown"
        school_name_zh = getattr(school, 'name_zh', None) if school else None
        scores = [float(t.match_score) for t in targets if t.match_score is not None]
        avg_score = round(sum(scores) / len(scores), 4) if scores else None
        distribution.append({
            "school": school_name,
            "school_zh": school_name_zh,
            "count": len(targets),
            "avg_score": avg_score,
        })

    distribution.sort(key=lambda d: d["count"], reverse=True)

    return {"cohort_name": cohort.name, "distribution": distribution}


# ---------------------------------------------------------------------------
# GET /reports/cohort/{cohort_id}/risk-breakdown
# ---------------------------------------------------------------------------

@router.get("/cohort/{cohort_id}/risk-breakdown")
def risk_breakdown(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Risk breakdown by class — how many students have at-risk targets."""
    cohort = _get_cohort_or_403(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    _check_cohort_feature(db, current_user, cohort, "reports")
    member_ids = _member_student_ids(cohort)

    if not member_ids:
        return {"cohort_name": cohort.name, "breakdown": []}

    # Find students with any at_risk=True target
    at_risk_rows = (
        db.query(StudentSchoolTarget.student_id)
        .filter(
            StudentSchoolTarget.student_id.in_(member_ids),
            StudentSchoolTarget.at_risk == True,  # noqa: E712
        )
        .distinct()
        .all()
    )
    at_risk_ids = {r[0] for r in at_risk_rows}

    # Load students for class grouping
    students = db.query(Student).filter(Student.id.in_(member_ids)).all()

    class_groups: dict[str, dict] = defaultdict(lambda: {"total": 0, "at_risk": 0})
    for s in students:
        class_name = s.class_name or "Unassigned"
        class_groups[class_name]["total"] += 1
        if s.id in at_risk_ids:
            class_groups[class_name]["at_risk"] += 1

    breakdown = []
    for class_name, counts in sorted(class_groups.items()):
        total = counts["total"]
        at_risk = counts["at_risk"]
        breakdown.append({
            "class_name": class_name,
            "total_students": total,
            "at_risk_students": at_risk,
            "risk_pct": round(at_risk / total * 100, 1) if total > 0 else 0.0,
        })

    return {"cohort_name": cohort.name, "breakdown": breakdown}


# ---------------------------------------------------------------------------
# GET /reports/cohort/{cohort_id}/subject-performance
# ---------------------------------------------------------------------------

@router.get("/cohort/{cohort_id}/subject-performance")
def subject_performance(
    cohort_id: UUID,
    sitting: Optional[str] = Query("MOCK", description="MOCK | TRIAL | OFFICIAL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-subject performance stats for cohort members."""
    cohort = _get_cohort_or_403(db, cohort_id, current_user.id, organisation_id=_org_id(current_user))
    _check_cohort_feature(db, current_user, cohort, "reports")
    member_ids = _member_student_ids(cohort)

    if not member_ids:
        return {"cohort_name": cohort.name, "sitting": sitting, "subjects": []}

    grade_query = (
        db.query(StudentSubjectGrade)
        .filter(StudentSubjectGrade.student_id.in_(member_ids))
    )
    if sitting:
        grade_query = grade_query.filter(StudentSubjectGrade.sitting == sitting.upper())

    grade_rows = grade_query.all()

    # Group by subject_id
    subject_groups: dict[UUID, list[int]] = defaultdict(list)
    for row in grade_rows:
        raw = row.raw_grade or row.predicted_grade
        if raw:
            subject_groups[row.subject_id].append(grade_to_int(raw))

    subjects = []
    for subject_id, numerics in subject_groups.items():
        subj = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subj:
            continue
        count = len(numerics)
        mean = round(sum(numerics) / count, 2) if count else 0
        subjects.append({
            "code": subj.code,
            "name": subj.name,
            "count": count,
            "mean": mean,
            "min": min(numerics),
            "max": max(numerics),
        })

    subjects.sort(key=lambda s: s["code"])

    return {
        "cohort_name": cohort.name,
        "sitting": sitting,
        "subjects": subjects,
    }
