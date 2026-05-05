"""
app/services/action_plan_service.py

Action plan generation and retrieval.
REQ-021, REQ-022, REQ-035, REQ-038, REQ-040
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import ActionPlan
from app.services.student_service import get_student

# ---------------------------------------------------------------------------
# Generic preparation steps (REQ-021, REQ-022)
# ---------------------------------------------------------------------------
_PREPARATION_STEPS = (
    "Research application requirements for your target schools.\n"
    "Prepare a compelling personal statement that highlights your strengths and interests.\n"
    "Gather recommendation letters from teachers or mentors.\n"
    "Review financial aid and scholarship options available to you."
)

# ---------------------------------------------------------------------------
# Extracurricular suggestion mapping
# ---------------------------------------------------------------------------
_INTEREST_TO_ACTIVITIES: dict[str, list[str]] = {
    "stem": ["Join a science or robotics club", "Participate in coding competitions (e.g., hackathons)"],
    "science": ["Enter science fairs or Olympiads", "Volunteer for science outreach programmes"],
    "math": ["Join a mathematics competition team", "Tutor peers in mathematics"],
    "robotics": ["Participate in robotics competitions (e.g., VEX, FRC)", "Build personal robotics projects"],
    "coding": ["Contribute to open-source projects", "Complete online programming challenges"],
    "programming": ["Build a portfolio of software projects", "Attend developer meetups or coding boot camps"],
    "technology": ["Explore internship programmes at tech companies", "Join a technology entrepreneurship club"],
    "arts": ["Join the school's art society or drama club", "Submit work to local or national art competitions"],
    "music": ["Participate in school orchestra or choir", "Record and share original compositions"],
    "sports": ["Join competitive sports teams", "Pursue leadership roles in athletic associations"],
    "writing": ["Contribute to the school newspaper or literary magazine", "Enter essay competitions"],
    "literature": ["Lead a book club or reading group", "Submit creative writing to local publications"],
    "history": ["Participate in Model UN or history debate events", "Volunteer at museums or heritage sites"],
    "community": ["Organise community service initiatives", "Join a student government or council"],
    "leadership": ["Run for student government", "Organise school events or clubs"],
    "environment": ["Join an environmental sustainability club", "Participate in local conservation projects"],
    "business": ["Start a small entrepreneurial project", "Participate in business case competitions"],
    "medicine": ["Shadow a healthcare professional", "Volunteer at a hospital or clinic"],
    "law": ["Participate in mock trial or moot court", "Intern at a legal aid organisation"],
}


def _suggest_extracurriculars(interests: list[str]) -> str:
    """
    Suggest 2–3 extracurricular activities based on student interests.
    Falls back to generic suggestions if no interest mapping is found.
    """
    suggestions: list[str] = []
    for interest in interests:
        key = interest.strip().lower()
        for mapping_key, activities in _INTEREST_TO_ACTIVITIES.items():
            if mapping_key in key or key in mapping_key:
                for activity in activities:
                    if activity not in suggestions:
                        suggestions.append(activity)
                if len(suggestions) >= 3:
                    break
        if len(suggestions) >= 3:
            break

    if not suggestions:
        suggestions = [
            "Join a student club aligned with your academic interests",
            "Seek a part-time volunteer or internship placement in a field you enjoy",
            "Develop a personal project (creative, technical, or community-focused) to showcase initiative",
        ]

    return "\n".join(f"- {s}" for s in suggestions[:3])


def _build_academic_targets(grades: dict) -> str:
    """
    For each subject where the student's numeric grade is below 80,
    produce an improvement target. REQ-021
    """
    targets: list[str] = []
    for subject, grade_value in (grades or {}).items():
        numeric = _grade_to_numeric(grade_value)
        if numeric < 80:
            targets.append(f"Improve {subject} grade to 80+")

    if not targets:
        return "Maintain current strong academic performance across all subjects."
    return "\n".join(f"- {t}" for t in targets)


def _grade_to_numeric(grade_value) -> float:
    """Convert a grade value (int, float, or letter) to a 0–100 float."""
    _LETTER_MAP = {
        "a+": 100, "a": 95, "a-": 90,
        "b+": 87, "b": 83, "b-": 80,
        "c+": 77, "c": 73, "c-": 70,
        "d+": 67, "d": 63, "d-": 60,
        "f": 0,
    }
    if isinstance(grade_value, (int, float)):
        return float(grade_value)
    if isinstance(grade_value, str):
        return _LETTER_MAP.get(grade_value.strip().lower(), 0.0)
    return 0.0


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def generate_action_plan(db: Session, student_id: UUID, user_id: UUID) -> ActionPlan:
    """
    Generate (or replace) an action plan for the student.
    Raises HTTP 404 / 403 via get_student; HTTP 422 if profile is incomplete.
    REQ-021, REQ-022, REQ-035, REQ-040
    """
    student = get_student(db, student_id, user_id)

    academic_targets = _build_academic_targets(student.grades or {})
    extracurricular_direction = _suggest_extracurriculars(student.interests or [])
    preparation_steps = _PREPARATION_STEPS

    # UPSERT: update existing plan or insert new one
    existing: ActionPlan | None = (
        db.query(ActionPlan).filter(ActionPlan.student_id == student_id).first()
    )

    if existing is not None:
        existing.academic_targets = academic_targets
        existing.extracurricular_direction = extracurricular_direction
        existing.preparation_steps = preparation_steps
        db.commit()
        db.refresh(existing)
        return existing

    plan = ActionPlan(
        student_id=student_id,
        academic_targets=academic_targets,
        extracurricular_direction=extracurricular_direction,
        preparation_steps=preparation_steps,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def get_action_plan(db: Session, student_id: UUID, user_id: UUID) -> ActionPlan:
    """
    Return the existing action plan for a student.
    Raises HTTP 404 if none has been generated yet.
    REQ-021, REQ-022, REQ-034, REQ-038
    """
    get_student(db, student_id, user_id)  # ownership check + 404

    plan: ActionPlan | None = (
        db.query(ActionPlan).filter(ActionPlan.student_id == student_id).first()
    )
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No action plan has been generated for this student yet",
        )
    return plan
