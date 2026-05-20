"""
app/services/default_cohort.py

Utility for the auto-created "All Students" default cohort.
Every organisation gets one; every new student is auto-added.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models_v2 import CohortMembership, StudentCohort

ALL_STUDENTS_NAME_EN = "All Students"
ALL_STUDENTS_NAME_ZH = "所有學生"


def get_or_create_default_cohort(
    db: Session, *, organisation_id: UUID, user_id: UUID,
) -> StudentCohort:
    """Return the default 'All Students' cohort, creating it if needed."""
    cohort = (
        db.query(StudentCohort)
        .filter(
            StudentCohort.organisation_id == organisation_id,
            StudentCohort.is_default == True,  # noqa: E712
        )
        .first()
    )
    if cohort:
        return cohort

    cohort = StudentCohort(
        user_id=user_id,
        organisation_id=organisation_id,
        name=ALL_STUDENTS_NAME_EN,
        description="Auto-created default cohort",
        is_default=True,
    )
    db.add(cohort)
    db.flush()
    return cohort


def ensure_student_in_default_cohort(
    db: Session, *, student_id: UUID, organisation_id: UUID, user_id: UUID,
) -> None:
    """Add a student to the default cohort if not already a member."""
    cohort = get_or_create_default_cohort(
        db, organisation_id=organisation_id, user_id=user_id,
    )
    exists = (
        db.query(CohortMembership)
        .filter(
            CohortMembership.cohort_id == cohort.id,
            CohortMembership.student_id == student_id,
        )
        .first()
    )
    if not exists:
        db.add(CohortMembership(cohort_id=cohort.id, student_id=student_id))
