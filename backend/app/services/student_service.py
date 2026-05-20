"""
app/services/student_service.py

Student profile CRUD business logic.
REQ-012, REQ-013, REQ-014, REQ-015, REQ-025, REQ-028, REQ-032, REQ-033
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Student
from app.schemas.student import StudentCreate, StudentUpdate
from app.services.student_data_builder import build_student_data, build_student_dict_for_plan


# HKDSE grade-to-numeric mapping for best-5 computation
GRADE_TO_NUMERIC = {"5**": 7, "5*": 6, "5": 5, "4": 4, "3": 3, "2": 2, "1": 1, "U": 0}


def compute_best5(grades_dict: dict | None) -> int | None:
    """Compute best-5 score from MOCK grades. Returns None if insufficient data."""
    if not grades_dict or not isinstance(grades_dict, dict):
        return None
    mock = grades_dict.get("MOCK")
    if not mock or not isinstance(mock, dict):
        return None
    numerics = []
    for grade_str in mock.values():
        val = GRADE_TO_NUMERIC.get(str(grade_str).strip())
        if val is not None:
            numerics.append(val)
    if len(numerics) < 5:
        return None
    numerics.sort(reverse=True)
    return sum(numerics[:5])


def get_students(
    db: Session, user_id: UUID, *, organisation_id: UUID | None = None,
    q: str | None = None, unaccounted: bool = False,
    class_name: str | None = None, year_of_study: int | None = None,
    subject_code: str | None = None, best5_min: int | None = None,
    best5_max: int | None = None,
) -> list[Student]:
    """
    Return all student profiles owned by the given counselor.
    When *organisation_id* is set, scope by organisation instead of user.
    When *q* is provided, filter by student name (case-insensitive).
    When *unaccounted* is True, filter to students with no active linked User account.
    Additional filters: class_name, year_of_study, subject_code, best5_min, best5_max.
    REQ-015, REQ-032
    """
    if organisation_id is not None:
        query = db.query(Student).filter(Student.organisation_id == organisation_id, Student.deleted_at.is_(None))
    else:
        query = db.query(Student).filter(Student.user_id == user_id, Student.deleted_at.is_(None))
    if q:
        from sqlalchemy import or_
        pattern = f"%{q}%"
        query = query.filter(or_(
            Student.name.ilike(pattern),
            Student.email.ilike(pattern),
            Student.candidate_number.ilike(pattern),
        ))
    if unaccounted:
        from sqlalchemy import select
        from app.db.models import User as UserModel
        linked_ids_subq = db.query(UserModel.student_id).filter(
            UserModel.student_id.isnot(None),
            UserModel.is_active.is_(True),
        ).subquery()
        query = query.filter(~Student.id.in_(select(linked_ids_subq)))
    if class_name:
        query = query.filter(Student.class_name == class_name)
    if year_of_study is not None:
        query = query.filter(Student.year_of_study == year_of_study)

    results = query.all()

    # Post-filter for JSON-based fields (subject_code, best5 range)
    if subject_code:
        def _has_subject(s):
            grades = s.grades
            if not grades or not isinstance(grades, dict):
                return False
            for exam_type_grades in grades.values():
                if isinstance(exam_type_grades, dict) and subject_code in exam_type_grades:
                    return True
            return False
        results = [s for s in results if _has_subject(s)]

    if best5_min is not None or best5_max is not None:
        def _in_best5_range(s):
            score = compute_best5(s.grades)
            if score is None:
                return False
            if best5_min is not None and score < best5_min:
                return False
            if best5_max is not None and score > best5_max:
                return False
            return True
        results = [s for s in results if _in_best5_range(s)]

    return results


def get_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> Student:
    """
    Return a single student profile by ID, enforcing ownership.
    When *organisation_id* is set, check org-level access first.
    Raises HTTP 404 if not found, HTTP 403 if access denied.
    REQ-014, REQ-033
    """
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this ID",
        )
    # Org-level access check takes precedence when available
    if organisation_id is not None:
        if student.organisation_id is None or str(student.organisation_id) != str(organisation_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Student does not belong to the active organisation",
            )
        return student
    # Fallback: user-level ownership check
    if str(student.user_id) != str(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user does not own this student record",
        )
    return student


def create_student(
    db: Session, user_id: UUID, data: StudentCreate, *, organisation_id: UUID | None = None
) -> Student:
    """
    Create a new student profile owned by user_id.
    When *organisation_id* is set, the student is also associated with the org.
    REQ-012, REQ-025, REQ-028, REQ-033
    """
    # Prevent duplicate candidate_number within org
    cand = getattr(data, "candidate_number", None)
    if cand:
        dup_filter = [Student.candidate_number == cand]
        if organisation_id:
            dup_filter.append(Student.organisation_id == organisation_id)
        else:
            dup_filter.append(Student.organisation_id.is_(None))
        dup = db.query(Student).filter(*dup_filter).first()
        if dup:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=409,
                detail=f"A student with candidate number '{cand}' already exists.",
            )

    student = Student(
        user_id=user_id,
        organisation_id=organisation_id,
        name=data.name,
        candidate_number=cand,
        grades=data.grades,
        interests=data.interests,
        strengths_weaknesses=data.strengths_weaknesses,
        target_region=data.target_region,
    )
    db.add(student)
    db.flush()

    # Auto-add to "All Students" default cohort
    if organisation_id:
        from app.services.default_cohort import ensure_student_in_default_cohort
        ensure_student_in_default_cohort(
            db, student_id=student.id, organisation_id=organisation_id, user_id=user_id,
        )

    db.commit()
    db.refresh(student)
    return student


def update_student(
    db: Session, student_id: UUID, user_id: UUID, data: StudentUpdate,
    *, organisation_id: UUID | None = None,
) -> Student:
    """
    Full update (replace all editable fields) of a student profile.
    Raises HTTP 404 or HTTP 403 as appropriate.
    REQ-013, REQ-033
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    student.name = data.name
    student.grades = data.grades
    student.interests = data.interests
    student.strengths_weaknesses = data.strengths_weaknesses
    student.target_region = data.target_region
    db.commit()
    db.refresh(student)
    return student


def get_student_match_data(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> dict:
    """
    Return the student's data in the format expected by the matching engine.
    Enforces ownership, then delegates to the canonical builder.
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    return build_student_data(student, db)


def get_student_plan_data(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> tuple:
    """
    Return (student_orm, student_data, student_dict) for plan generation.
    Enforces ownership, builds both match data and plan-formatted dict.
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    student_data = build_student_data(student, db)
    student_dict = build_student_dict_for_plan(student, student_data)
    return student, student_data, student_dict


def delete_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> None:
    """
    Delete a student record.
    - Data-only (no account): hard delete with cascade.
    - Has account: reject — must archive/delete the account first.
    """
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)

    if student.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student has a login account. Archive or delete the account first.",
        )

    # Hard delete — cascade removes grades, plans, targets, submissions
    from app.modules.school_choice.models.models import StudentSubjectGrade, Recommendation
    from app.db.models_v2 import StudentSchoolTarget, AcademicPlan

    db.query(StudentSubjectGrade).filter(StudentSubjectGrade.student_id == student_id).delete()
    db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student_id).delete()
    db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).delete()
    db.query(Recommendation).filter(Recommendation.student_id == student_id).delete()

    # StudentChoiceSubmission may or may not exist
    try:
        from app.modules.school_choice.models.submissions import StudentChoiceSubmission
        db.query(StudentChoiceSubmission).filter(StudentChoiceSubmission.student_id == student_id).delete()
    except Exception:
        pass

    db.delete(student)
    db.commit()
