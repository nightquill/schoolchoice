"""
app/services/merge_service.py

Merge unaccounted student records into accounted ones.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import User
from app.modules.school_choice.models.models import Student
from app.db.models_v2 import StudentSubjectGrade, StudentSchoolTarget, CohortMembership


class MergeError(Exception):
    pass


# Profile fields to copy from source to target when target field is blank
_PROFILE_FIELDS = [
    "name_zh", "date_of_birth", "gender", "address", "phone",
    "email", "class_name", "year_of_study", "candidate_number",
]


def merge_student(source_id: str, target_id: str, db: Session) -> dict:
    """
    Merge source student into target student.

    Requirements:
    - Source must be unaccounted (no active User with student_id=source)
    - Target must have an account (active User with student_id=target)

    Transfers grades, targets, cohort memberships, and fills blank profile fields.
    Deletes source record after merge.
    """
    source = db.query(Student).filter(Student.id == source_id).first()
    if not source:
        raise MergeError("Source student not found")

    target = db.query(Student).filter(Student.id == target_id).first()
    if not target:
        raise MergeError("Target student not found")

    # Verify source is unaccounted
    source_user = db.query(User).filter(
        User.student_id == source_id,
        User.is_active.is_(True),
    ).first()
    if source_user:
        raise MergeError("Source student has an active account — cannot merge")

    # Verify target has account
    target_user = db.query(User).filter(
        User.student_id == target_id,
        User.is_active.is_(True),
    ).first()
    if not target_user:
        raise MergeError("Target student has no active account — cannot merge into")

    merged_grades = 0
    merged_targets = 0
    merged_cohorts = 0

    # Transfer StudentSubjectGrade rows
    grades = db.query(StudentSubjectGrade).filter(
        StudentSubjectGrade.student_id == source_id
    ).all()
    for g in grades:
        g.student_id = target_id
        merged_grades += 1

    # Transfer StudentSchoolTarget rows
    targets = db.query(StudentSchoolTarget).filter(
        StudentSchoolTarget.student_id == source_id
    ).all()
    for t in targets:
        t.student_id = target_id
        merged_targets += 1

    # Transfer CohortMembership rows (skip if already member of that cohort)
    existing_cohort_ids = {
        cm.cohort_id for cm in db.query(CohortMembership).filter(
            CohortMembership.student_id == target_id
        ).all()
    }
    memberships = db.query(CohortMembership).filter(
        CohortMembership.student_id == source_id
    ).all()
    for cm in memberships:
        if cm.cohort_id in existing_cohort_ids:
            db.delete(cm)  # Remove duplicate
        else:
            cm.student_id = target_id
            merged_cohorts += 1

    # Fill blank profile fields on target from source
    for field in _PROFILE_FIELDS:
        target_val = getattr(target, field, None)
        source_val = getattr(source, field, None)
        if not target_val and source_val:
            setattr(target, field, source_val)

    # Delete source record
    db.delete(source)
    db.commit()

    return {
        "merged_grades": merged_grades,
        "merged_targets": merged_targets,
        "merged_cohorts": merged_cohorts,
        "message": f"Merged student {source_id} into {target_id}",
    }
