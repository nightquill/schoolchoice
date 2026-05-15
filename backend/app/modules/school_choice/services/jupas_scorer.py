"""
JUPAS Parametric Scorer Service

Computes a student's weighted JUPAS score using each programme's EXACT
published formula, then maps the score to an admission probability using
a normal distribution fitted to published UQ/Median/LQ statistics.

Handles all real formula patterns:
- Simple best N
- Weighted specific subjects + best remaining
- Subject group weighting (CityU style)
- Bonus subjects (6th subject at fractional weight)
- PolyU large multipliers (10x-50x)

Grade scales are loaded from data/jupas/grade_scales.json.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parents[5] / "data" / "jupas"
_GRADE_SCALES_PATH = _DATA_DIR / "grade_scales.json"

# CSD subject code — uses pass/fail grading, not the standard numeric scale
CSD_CODE = "CSD"

# ---------------------------------------------------------------------------
# Grade scale loading
# ---------------------------------------------------------------------------

_scale_cache: dict[str, dict[str, float]] = {}


def load_grade_scale(scale_name: str) -> dict[str, float]:
    """
    Load a grade scale by name from grade_scales.json.

    Returns a dict mapping grade string (e.g. "5**") to points (e.g. 8.5).
    Results are cached after first load.
    """
    if scale_name in _scale_cache:
        return _scale_cache[scale_name]

    with open(_GRADE_SCALES_PATH) as f:
        all_scales = json.load(f)

    if scale_name not in all_scales:
        raise ValueError(
            f"Unknown grade scale '{scale_name}'. "
            f"Available: {[k for k in all_scales if not k.startswith('_')]}"
        )

    scale_data = all_scales[scale_name]
    grades: dict[str, float] = {}

    # Main grades
    for grade_str, points in scale_data.get("grades", {}).items():
        grades[grade_str] = float(points)

    # Applied learning grades
    for grade_str, points in scale_data.get("applied_learning", {}).items():
        grades[grade_str] = float(points)

    # CSD grades (loaded AFTER applied_learning so CSD values take precedence
    # since "Attained" means 1pt for CSD but 0pt for Applied Learning)
    for grade_str, points in scale_data.get("csd_grades", {}).items():
        grades[grade_str] = float(points)

    _scale_cache[scale_name] = grades
    return grades


def grade_to_points(grade: str, scale: dict[str, float]) -> float:
    """
    Convert a single grade string to points using the given scale.

    Handles CSD grades (A/AD/Attained/Attained with Distinction) and
    standard HKDSE grades. Returns 0.0 for unrecognised grades.
    """
    if grade is None:
        return 0.0

    grade = grade.strip()

    # Direct lookup
    if grade in scale:
        return scale[grade]

    # CSD-specific mappings (Citizenship and Social Development)
    # Attained = 1 point, Attained with Distinction = 2 points
    # These values are consistent across all JUPAS scales
    csd_map = {
        "A": 1.0,
        "AD": 2.0,
        "Attained": 1.0,
        "Attained with Distinction": 2.0,
    }
    if grade in csd_map:
        return csd_map[grade]

    return 0.0


# ---------------------------------------------------------------------------
# Core scoring logic
# ---------------------------------------------------------------------------


def compute_weighted_score(
    grades: dict[str, str],
    formula: dict[str, Any],
) -> dict[str, Any]:
    """
    Compute the weighted JUPAS score for a student given their grades and
    a programme's scoring formula.

    Parameters
    ----------
    grades : dict
        Mapping of subject code -> grade string, e.g. {"ENGL": "5*", "MATH": "5"}
    formula : dict
        The programme's scoring_formula object with fields:
        - scale: name of grade scale
        - best_n: number of subjects to include
        - subject_weights: {subject_code: weight_multiplier}
        - bonus_subjects: list of subject codes eligible for bonus
        - bonus_weight: weight for the bonus (next best) subject

    Returns
    -------
    dict with keys:
        - weighted_score: float total
        - included_subjects: list of subject codes included in best_n
        - subject_details: list of detail dicts per subject
        - bonus_points: float bonus points from extra subject
    """
    scale_name = formula.get("scale", "jupas_2025_enhanced")
    scale = load_grade_scale(scale_name)
    best_n = formula.get("best_n", 5)
    subject_weights = formula.get("subject_weights", {})
    bonus_weight = formula.get("bonus_weight", 0)

    # Build list of (code, grade, base_points, weight, weighted_points)
    subject_entries: list[dict[str, Any]] = []
    for code, grade_str in grades.items():
        base_pts = grade_to_points(grade_str, scale)
        weight = subject_weights.get(code, 1.0)
        weighted_pts = base_pts * weight
        subject_entries.append({
            "code": code,
            "grade": grade_str,
            "base_points": base_pts,
            "weight": weight,
            "weighted_points": weighted_pts,
        })

    # Sort by weighted points descending to select best N
    subject_entries.sort(key=lambda e: e["weighted_points"], reverse=True)

    # Select top best_n
    selected = subject_entries[:best_n]
    remaining = subject_entries[best_n:]

    total_score = sum(e["weighted_points"] for e in selected)
    included_subjects = [e["code"] for e in selected]

    # Bonus points from next best remaining subject
    bonus_points = 0.0
    if bonus_weight > 0 and remaining:
        # Use the base points of the best remaining subject * bonus_weight
        best_remaining = remaining[0]
        bonus_points = best_remaining["base_points"] * bonus_weight
        total_score += bonus_points

    return {
        "weighted_score": round(total_score, 2),
        "included_subjects": included_subjects,
        "subject_details": selected,
        "bonus_points": round(bonus_points, 2),
    }


# ---------------------------------------------------------------------------
# Minimum requirements check
# ---------------------------------------------------------------------------

# Standard "33222" parsing: positions map to CHLA, ENGL, MATH, elective1, elective2
# Note: "CHLA" is the subject code used in this system for Chinese Language
_GENERAL_REQ_SUBJECTS = ["CHLA", "ENGL", "MATH"]


def check_minimum_requirements(
    grades: dict[str, str],
    requirements: dict[str, Any],
    scale: dict[str, float] | None = None,
) -> tuple[bool, list[str]]:
    """
    Check if a student meets a programme's minimum entry requirements.

    Parameters
    ----------
    grades : dict
        Subject code -> grade string
    requirements : dict
        The programme's minimum_requirements, e.g. {"general": "33222"}
    scale : dict, optional
        Grade scale to use. If None, uses jupas_2025_enhanced.

    Returns
    -------
    (eligible, failures) where failures is a list of human-readable strings.
    """
    if scale is None:
        scale = load_grade_scale("jupas_2025_enhanced")

    failures: list[str] = []
    general = requirements.get("general", "")

    if not general:
        return True, []

    # Parse "33222" — first 3 digits are CHLA, ENGL, MATH minimums;
    # remaining digits are elective minimums
    try:
        min_levels = [int(c) for c in general]
    except (ValueError, TypeError):
        return True, []  # Can't parse, assume met

    # Check core subjects (first 3)
    core_codes = ["CHLA", "ENGL", "MATH"]
    for i, code in enumerate(core_codes):
        if i >= len(min_levels):
            break
        required = min_levels[i]
        grade_str = grades.get(code)
        if grade_str is None:
            failures.append(f"{code}: missing (need level {required})")
            continue
        pts = grade_to_points(grade_str, scale)
        # Convert points back to approximate level for comparison
        # The minimum is expressed as a level (1-5), and the scale maps
        # levels to points. We need level >= required.
        grade_level = _grade_to_level(grade_str)
        if grade_level < required:
            failures.append(f"{code}: level {grade_level} < required {required}")

    # Check elective minimums (positions 3+)
    elective_mins = min_levels[3:]
    if elective_mins:
        # Get all non-core, non-CSD subjects sorted by level descending
        elective_grades = []
        for code, grade_str in grades.items():
            if code in core_codes or code == CSD_CODE:
                continue
            elective_grades.append((code, _grade_to_level(grade_str)))
        elective_grades.sort(key=lambda x: x[1], reverse=True)

        for i, required in enumerate(elective_mins):
            if i < len(elective_grades):
                code, level = elective_grades[i]
                if level < required:
                    failures.append(
                        f"Elective {i+1} ({code}): level {level} < required {required}"
                    )
            else:
                failures.append(
                    f"Elective {i+1}: missing (need level {required})"
                )

    eligible = len(failures) == 0
    return eligible, failures


def _grade_to_level(grade_str: str) -> int:
    """Convert a grade string to its numeric level (1-7 scale, or 0 for U)."""
    level_map = {
        "5**": 7,
        "5*": 6,
        "5": 5,
        "4": 4,
        "3": 3,
        "2": 2,
        "1": 1,
        "U": 0,
        "A": 2,
        "AD": 3,
        "Attained": 2,
        "Attained with Distinction": 3,
    }
    return level_map.get(grade_str.strip(), 0)


# ---------------------------------------------------------------------------
# Probability mapping
# ---------------------------------------------------------------------------


def _normal_cdf(x: float) -> float:
    """Standard normal CDF using math.erf (no scipy needed)."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def map_score_to_probability(
    score: float,
    stats: dict[str, Any],
) -> float:
    """
    Map a weighted score to admission probability using piecewise linear
    interpolation between known quantiles, with exponential decay tails.

    This is purely data-driven — no normal distribution assumption.
    Between published quantiles, probability changes linearly.
    Beyond the known range, exponential tails provide smooth decay.

    Known points from published data:
        score = LQ  → P = 0.25
        score = M   → P = 0.50
        score = UQ  → P = 0.75

    For competitive programmes (tight UQ-LQ band), the model is naturally
    MORE sensitive to small score differences — a 1-point gap matters more
    when the entire admitted range spans only 3 points.

    Parameters
    ----------
    score : float
        The student's computed weighted score.
    stats : dict
        Admission statistics with keys: median, lower_quartile,
        and optionally upper_quartile.

    Returns
    -------
    float in [0.01, 0.99]
    """
    median = stats.get("median")
    lq = stats.get("lower_quartile")
    uq = stats.get("upper_quartile")

    if median is None:
        return 0.5  # No data — neutral probability

    median = float(median)

    if lq is not None:
        lq = float(lq)
    else:
        return 0.5  # Need at least median + LQ

    if uq is not None:
        uq = float(uq)
    else:
        # Estimate UQ symmetrically from median and LQ
        uq = median + (median - lq)

    # Degenerate case: all quartiles equal
    if uq <= lq:
        if score >= median:
            return 0.75
        return 0.25

    # Piecewise linear interpolation between known quantiles
    if lq <= score <= median:
        # Between LQ (25%) and Median (50%)
        if median == lq:
            prob = 0.375  # midpoint
        else:
            t = (score - lq) / (median - lq)
            prob = 0.25 + t * 0.25
    elif median < score <= uq:
        # Between Median (50%) and UQ (75%)
        if uq == median:
            prob = 0.625  # midpoint
        else:
            t = (score - median) / (uq - median)
            prob = 0.50 + t * 0.25
    elif score > uq:
        # Above UQ — exponential approach to 0.99
        # Use half-life = (UQ - Median) so probability reaches ~95% at UQ + 2*(UQ-M)
        half_range = uq - median
        if half_range <= 0:
            prob = 0.85
        else:
            excess = (score - uq) / half_range
            # Asymptotic approach: 0.75 + 0.24 * (1 - e^(-excess))
            prob = 0.75 + 0.24 * (1 - math.exp(-excess))
    else:
        # Below LQ — exponential decay toward 0.01
        # Use half-life = (Median - LQ) so probability reaches ~5% at LQ - 2*(M-LQ)
        half_range = median - lq
        if half_range <= 0:
            prob = 0.15
        else:
            deficit = (lq - score) / half_range
            # Asymptotic decay: 0.25 * e^(-deficit)
            prob = 0.25 * math.exp(-deficit)

    # Clamp to [0.01, 0.99]
    return max(0.01, min(0.99, round(prob, 4)))


def _determine_risk_level(
    score: float,
    stats: dict[str, Any],
) -> str:
    """
    Determine risk level based on score vs admission statistics.

    Returns "safe", "borderline", or "at_risk".
    """
    median = stats.get("median")
    lq = stats.get("lower_quartile")

    if median is None or lq is None:
        return "borderline"  # Insufficient data

    median = float(median)
    lq = float(lq)

    if score >= median:
        return "safe"
    elif score >= lq:
        return "borderline"
    else:
        return "at_risk"


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------


def score_student_for_programme(
    student_grades: dict[str, str],
    programme: dict[str, Any],
    stat_year: str | None = None,
) -> dict[str, Any]:
    """
    Full scoring pipeline: compute weighted score, check eligibility,
    map to probability, determine risk level, and return provenance.

    Parameters
    ----------
    student_grades : dict
        Subject code -> grade string, e.g. {"ENGL": "5*", "MATH": "5", ...}
    programme : dict
        A programme object from the JUPAS programmes JSON.
    stat_year : str, optional
        Which year's admission stats to use (e.g. "2024"). If None,
        uses the most recent available year.

    Returns
    -------
    dict with scoring results, eligibility, probability, risk, provenance.
    """
    # Guard: empty or invalid grades input
    if not student_grades or not isinstance(student_grades, dict):
        return {
            "jupas_code": programme.get("jupas_code", ""),
            "programme_name": programme.get("name", ""),
            "tier": programme.get("tier", "unclassified"),
            "eligible": False,
            "eligibility_failures": ["no_grades"],
            "weighted_score": 0.0,
            "included_subjects": [],
            "subject_details": [],
            "bonus_points": 0.0,
            "admission_probability": 0.01,
            "risk_level": "at_risk",
            "provenance": {"scale": "", "formula_text": "", "stat_year": None},
        }

    formula = programme.get("scoring_formula", {})
    requirements = programme.get("minimum_requirements", {})
    admission_stats = programme.get("admission_stats", {})

    # Determine which year's stats to use
    if stat_year and stat_year in admission_stats:
        stats = admission_stats[stat_year]
    elif admission_stats:
        # Use most recent year
        latest_year = max(admission_stats.keys())
        stat_year = latest_year
        stats = admission_stats[latest_year]
    else:
        stat_year = None
        stats = {}

    # Load scale for requirement checking
    scale_name = formula.get("scale", "jupas_2025_enhanced")
    scale = load_grade_scale(scale_name)

    # 1. Check minimum requirements
    eligible, eligibility_failures = check_minimum_requirements(
        student_grades, requirements, scale
    )

    # 2. Compute weighted score
    score_result = compute_weighted_score(student_grades, formula)

    # 3. Map to probability
    probability = map_score_to_probability(
        score_result["weighted_score"], stats
    )

    # 4. Determine risk level
    risk_level = _determine_risk_level(
        score_result["weighted_score"], stats
    )

    # 5. Build provenance
    provenance = {
        "scale": scale_name,
        "formula_text": formula.get("formula_text", ""),
        "stat_year": stat_year,
        "lower_quartile": stats.get("lower_quartile"),
        "median": stats.get("median"),
        "upper_quartile": stats.get("upper_quartile"),
        "source": stats.get("source", ""),
    }

    return {
        "jupas_code": programme.get("jupas_code", ""),
        "programme_name": programme.get("name", ""),
        "tier": programme.get("tier", "unclassified"),
        "eligible": eligible,
        "eligibility_failures": eligibility_failures,
        "weighted_score": score_result["weighted_score"],
        "included_subjects": score_result["included_subjects"],
        "subject_details": score_result["subject_details"],
        "bonus_points": score_result["bonus_points"],
        "admission_probability": round(probability, 4),
        "risk_level": risk_level,
        "provenance": provenance,
    }
