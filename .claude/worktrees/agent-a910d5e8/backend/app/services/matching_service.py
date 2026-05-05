"""
app/services/matching_service.py

Rule-based matching engine: filter → score → rank → persist recommendations.
No ML models; logic is modular for future replacement (REQ-007, REQ-008).

REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import Recommendation, School, Student
from app.services.student_service import get_student

# ---------------------------------------------------------------------------
# Scoring weights (fixed; REQ-018)
# ---------------------------------------------------------------------------
_WEIGHT_GRADE = 0.4
_WEIGHT_INTEREST = 0.3
_WEIGHT_STRENGTH = 0.3


# ---------------------------------------------------------------------------
# Grade normalisation helpers
# ---------------------------------------------------------------------------

# Letter-grade → numeric mapping for filtering and scoring when grades are strings.
_LETTER_TO_NUMERIC: dict[str, float] = {
    "a+": 100,
    "a": 95,
    "a-": 90,
    "b+": 87,
    "b": 83,
    "b-": 80,
    "c+": 77,
    "c": 73,
    "c-": 70,
    "d+": 67,
    "d": 63,
    "d-": 60,
    "f": 0,
}


def _to_numeric(grade_value) -> float:
    """
    Convert a grade value (int, float, or letter string) to a 0–100 float.
    Unknown strings default to 0.
    """
    if isinstance(grade_value, (int, float)):
        return float(grade_value)
    if isinstance(grade_value, str):
        return _LETTER_TO_NUMERIC.get(grade_value.strip().lower(), 0.0)
    return 0.0


# ---------------------------------------------------------------------------
# Step 1 — Filter
# REQ-016
# ---------------------------------------------------------------------------


def _passes_filter(student: Student, school: School) -> bool:
    """
    Return True if the student meets ALL of the school's minimum grade requirements.
    A missing subject is treated as grade 0.
    """
    requirements: dict = school.min_academic_requirements or {}
    student_grades: dict = student.grades or {}

    for subject, minimum in requirements.items():
        student_grade = _to_numeric(student_grades.get(subject, 0))
        required_grade = _to_numeric(minimum)
        if student_grade < required_grade:
            return False
    return True


# ---------------------------------------------------------------------------
# Step 2 — Score
# REQ-017, REQ-018
# ---------------------------------------------------------------------------


def _score_school(student: Student, school: School) -> dict:
    """
    Compute a composite score (0.0–1.0) and supporting breakdown for a school
    that has passed the filter step.

    Returns a dict with keys:
        total_score        float 0.0–1.0
        grade_match_score  float 0.0–1.0
        interest_alignment float 0.0–1.0
        strength_alignment float 0.0–1.0
    """
    requirements: dict = school.min_academic_requirements or {}
    student_grades: dict = student.grades or {}
    student_interests: list[str] = [i.lower() for i in (student.interests or [])]
    school_strengths: list[str] = [s.lower() for s in (school.key_strengths or [])]

    # --- grade_match_score ---
    if requirements:
        grade_total = sum(
            _to_numeric(student_grades.get(subj, 0)) / 100.0
            for subj in requirements
        )
        grade_match = grade_total / len(requirements)
    else:
        grade_match = 1.0  # No requirements → perfect grade match

    # --- interest_alignment_score ---
    # Fraction of student interests that partially match any school strength (case-insensitive)
    if student_interests:
        matched_interests = sum(
            1
            for interest in student_interests
            if any(interest in strength or strength in interest for strength in school_strengths)
        )
        interest_alignment = matched_interests / len(student_interests)
    else:
        interest_alignment = 0.0

    # --- strengths_alignment_score ---
    # Fraction of school strengths that appear in student interests (case-insensitive)
    if school_strengths:
        matched_strengths = sum(
            1
            for strength in school_strengths
            if any(strength in interest or interest in strength for interest in student_interests)
        )
        strength_alignment = matched_strengths / len(school_strengths)
    else:
        strength_alignment = 1.0  # No declared strengths → no penalty

    total = (
        _WEIGHT_GRADE * grade_match
        + _WEIGHT_INTEREST * interest_alignment
        + _WEIGHT_STRENGTH * strength_alignment
    )

    return {
        "total_score": round(total, 4),
        "grade_match_score": round(grade_match, 4),
        "interest_alignment": round(interest_alignment, 4),
        "strength_alignment": round(strength_alignment, 4),
    }


# ---------------------------------------------------------------------------
# Explanation and gaps generation
# REQ-020, REQ-009
# ---------------------------------------------------------------------------


def _build_explanation(student: Student, school: School, scores: dict) -> str:
    """
    Build a plain-text explanation of why the school matches the student.
    Exposes contributing factors and their weights (REQ-009).
    """
    lines = [f"Match score: {scores['total_score']:.2f} / 1.00"]
    lines.append(
        f"Grade match (weight {int(_WEIGHT_GRADE * 100)}%): "
        f"{scores['grade_match_score']:.2f} — "
        "student meets or exceeds minimum academic requirements."
    )
    lines.append(
        f"Interest alignment (weight {int(_WEIGHT_INTEREST * 100)}%): "
        f"{scores['interest_alignment']:.2f} — "
        f"student interests overlap with school strengths."
    )
    lines.append(
        f"Strengths alignment (weight {int(_WEIGHT_STRENGTH * 100)}%): "
        f"{scores['strength_alignment']:.2f} — "
        f"school strengths align with student interest profile."
    )
    return "\n".join(lines)


def _build_gaps(student: Student, school: School) -> str:
    """
    Build a plain-text description of what the student is missing relative to
    this school (grade deficits and unmatched interests).
    """
    requirements: dict = school.min_academic_requirements or {}
    student_grades: dict = student.grades or {}
    student_interests: list[str] = [i.lower() for i in (student.interests or [])]
    school_strengths: list[str] = school.key_strengths or []

    # Grade deficits (subjects where student is below minimum)
    grade_gaps: list[str] = []
    for subject, minimum in requirements.items():
        student_val = _to_numeric(student_grades.get(subject, 0))
        required_val = _to_numeric(minimum)
        if student_val < required_val:
            deficit = required_val - student_val
            grade_gaps.append(
                f"{subject}: student has {student_val:.0f}, requires {required_val:.0f} "
                f"(deficit: {deficit:.0f})"
            )

    # School strengths not covered by student interests
    unmatched_strengths: list[str] = [
        s
        for s in school_strengths
        if not any(s.lower() in i or i in s.lower() for i in student_interests)
    ]

    parts: list[str] = []
    if grade_gaps:
        parts.append("Grade gaps: " + "; ".join(grade_gaps))
    else:
        parts.append("No grade gaps — student meets all academic requirements.")

    if unmatched_strengths:
        parts.append(
            "School strengths not reflected in student interests: "
            + ", ".join(unmatched_strengths)
        )
    else:
        parts.append("Student interests cover all school strength areas.")

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Step 3 — Rank and persist
# REQ-019, REQ-027
# ---------------------------------------------------------------------------


def generate_recommendations(
    db: Session, student_id: UUID, user_id: UUID
) -> list[Recommendation]:
    """
    Run the full matching pipeline for a student.
    Deletes existing recommendations, persists top-5, returns them.

    REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029
    """
    student = get_student(db, student_id, user_id)

    if not student.grades:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Student profile is incomplete: grades are required for matching",
        )

    schools: list[School] = db.query(School).all()

    # Step 1 — Filter
    eligible: list[School] = [s for s in schools if _passes_filter(student, s)]

    # Step 2 — Score
    scored: list[tuple[School, dict]] = [
        (school, _score_school(student, school)) for school in eligible
    ]

    # Step 3 — Rank (descending by total_score), take top 5
    scored.sort(key=lambda x: x[1]["total_score"], reverse=True)
    top5 = scored[:5]

    # Delete existing recommendations for this student
    db.query(Recommendation).filter(Recommendation.student_id == student_id).delete()
    db.flush()

    # Persist new recommendations
    new_recs: list[Recommendation] = []
    for rank, (school, scores) in enumerate(top5, start=1):
        explanation = _build_explanation(student, school, scores)
        gaps = _build_gaps(student, school)
        # Convert 0.0–1.0 score to 0–100 for DB storage (Numeric 5,2)
        db_score = round(scores["total_score"] * 100, 2)
        rec = Recommendation(
            student_id=student_id,
            school_id=school.id,
            school_name=school.name,
            score=db_score,
            explanation=explanation,
            gaps=gaps,
            rank=rank,
        )
        db.add(rec)
        new_recs.append(rec)

    db.commit()
    for rec in new_recs:
        db.refresh(rec)

    return new_recs


def get_recommendations(
    db: Session, student_id: UUID, user_id: UUID
) -> list[Recommendation]:
    """
    Return existing recommendations for a student ordered by rank.
    Raises HTTP 404 if student not found or not owned by user.
    REQ-020, REQ-027, REQ-034, REQ-037
    """
    get_student(db, student_id, user_id)  # ownership check + 404
    return (
        db.query(Recommendation)
        .filter(Recommendation.student_id == student_id)
        .order_by(Recommendation.rank)
        .all()
    )
