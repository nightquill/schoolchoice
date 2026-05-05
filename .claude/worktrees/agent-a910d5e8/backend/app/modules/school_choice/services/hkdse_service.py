"""
app/modules/school_choice/services/hkdse_service.py

HKDSE domain logic — grade scale, best-5 aggregate, predicted grade.
REQ-063, REQ-064, REQ-065, REQ-066
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Grade scale
# ---------------------------------------------------------------------------

GRADE_MAP: dict[str, int] = {
    "5**": 7,
    "5*": 6,
    "5": 5,
    "4": 4,
    "3": 3,
    "2": 2,
    "1": 1,
    "U": 0,
    "X": 0,
}

# Reverse map: numeric -> canonical grade string (picks highest grade for ties)
_INT_TO_GRADE: dict[int, str] = {
    7: "5**",
    6: "5*",
    5: "5",
    4: "4",
    3: "3",
    2: "2",
    1: "1",
    0: "U",
}

COMPULSORY_CODES: set[str] = {"CHLA", "ENGL", "MATH", "CSD"}
APL_CATEGORY: str = "APPLIED_LEARNING"


def grade_to_int(grade: str) -> int:
    """Convert HKDSE grade string to numeric value. Returns 0 for unknown."""
    if grade is None:
        return 0
    return GRADE_MAP.get(grade.strip(), 0)


def _int_to_grade(numeric: float) -> str:
    """Convert a numeric value back to the nearest HKDSE grade string."""
    rounded = round(numeric)
    rounded = max(0, min(7, rounded))
    return _INT_TO_GRADE.get(rounded, "U")


def compute_best5_aggregate(grades: list[dict]) -> int:
    """
    Given list of {subject_code, numeric_value, is_compulsory, category},
    return best-5 aggregate:
    - Must include all 4 compulsory subjects (CHLA, ENGL, MATH, CSD)
    - Add best elective score(s) to reach 5 total
    - ApL grades NOT included in aggregate
    - Returns 0 if fewer than 4 compulsory subjects present
    REQ-063
    """
    compulsory_scores: dict[str, int] = {}
    elective_scores: list[int] = []

    for g in grades:
        code = g.get("subject_code", "")
        value = int(g.get("numeric_value", 0))
        category = g.get("category", "")
        is_compulsory = g.get("is_compulsory", False)

        # Skip ApL subjects — they don't count toward aggregate
        if category == APL_CATEGORY:
            continue

        if is_compulsory or code in COMPULSORY_CODES:
            # Keep the highest score if multiple sittings
            if code not in compulsory_scores or value > compulsory_scores[code]:
                compulsory_scores[code] = value
        else:
            elective_scores.append(value)

    # Must have all 4 compulsory subjects
    if len(compulsory_scores) < 4 or not all(c in compulsory_scores for c in COMPULSORY_CODES):
        return 0

    base = sum(compulsory_scores.values())

    # Add best elective(s) to reach 5 total
    elective_scores.sort(reverse=True)
    electives_needed = 1  # need 5 total, have 4 compulsory
    best_electives = elective_scores[:electives_needed]

    return base + sum(best_electives)


def compute_predicted_grade(
    sittings: list[dict],
    teacher_rating: int | None,
) -> str | None:
    """
    REQ-066: Predicted grade logic.
    sittings: list of {sitting_type, raw_grade, year_of_exam} sorted by year_of_exam desc
    teacher_rating: 1-5 integer or None

    Logic:
    - If no sittings: return None
    - If only one sitting: return that grade
    - If multiple sittings: use most recent
    - If teacher_rating present: weighted avg 70% latest sitting + 30% teacher_rating
      (teacher_rating 1-5 maps to grades 1-5 approximately)
    - Return grade string
    """
    if not sittings:
        return None

    # Filter out OFFICIAL sittings — predicted grade never set for official
    non_official = [s for s in sittings if s.get("sitting_type", "") != "OFFICIAL"]
    if not non_official:
        return None

    # Sort by year_of_exam descending (most recent first); None years go last
    sorted_sittings = sorted(
        non_official,
        key=lambda s: s.get("year_of_exam") or 0,
        reverse=True,
    )

    latest = sorted_sittings[0]
    latest_grade = latest.get("raw_grade", "U")
    latest_numeric = grade_to_int(latest_grade)

    if teacher_rating is None:
        return latest_grade

    # teacher_rating 1-5 maps directly to grade numeric 1-5
    teacher_numeric = max(1, min(5, int(teacher_rating)))
    blended = 0.7 * latest_numeric + 0.3 * teacher_numeric
    return _int_to_grade(blended)
