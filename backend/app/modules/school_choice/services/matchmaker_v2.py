"""
app/modules/school_choice/services/matchmaker_v2.py

v2 matching engine — eligibility filter, weighted scoring, ML scoring, ranking.
REQ-072, REQ-073, REQ-074, REQ-075, REQ-076
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class MatchResult:
    school_id: str
    school_name: str
    major_name: Optional[str]          # None if no specific major
    major_jupas_code: Optional[str]    # None if no specific major
    eligibility_pass: bool
    failing_criteria: list[str]  # empty if eligible
    fit_score: float             # 0.0–1.0
    component_scores: dict       # {"academic_fit": 0.8, ...}
    ml_probability: Optional[float]    # None if no model
    final_score: float           # combined score
    shap_explanation: Optional[dict]   # top 3 features
    rationale: str               # one sentence plain English
    data_completeness: float = 0.0    # BUG-02: 0.0–1.0 fraction of expected grade fields present


# ---------------------------------------------------------------------------
# BUG-02: Data completeness indicator
# ---------------------------------------------------------------------------

def compute_data_completeness(student_data: dict) -> float:
    """
    Compute fraction of expected grade fields present for this student.
    Weights compulsory subjects (CHLA, ENGL, MATH, CSD) at 70% and
    elective subjects at 30%. Returns a float in [0.0, 1.0].
    """
    grades = student_data.get("grades_by_code", {})
    compulsory_present = sum(
        1 for c in ["CHLA", "ENGL", "MATH", "CSD"]
        if c in grades and grades[c]
    )
    compulsory_score = compulsory_present / 4
    elective_grades = [v for k, v in grades.items() if k not in {"CHLA", "ENGL", "MATH", "CSD"}]
    elective_score = min(len([g for g in elective_grades if g]) / 2, 1.0) if elective_grades else 0.0
    return round((compulsory_score * 0.7 + elective_score * 0.3), 2)


# ---------------------------------------------------------------------------
# REQ-072: Hard eligibility filter
# ---------------------------------------------------------------------------

def run_eligibility_filter(
    student_data: dict,
    school: dict,
) -> tuple[bool, list[str]]:
    """
    REQ-072: Hard eligibility rules.
    student_data: {best5_aggregate, grades_by_code, ielts_score}
    school: {minimum_entry_score, required_subjects, language_requirements}

    Rules:
    1. best5_aggregate < school.minimum_entry_score -> FAIL
    2. For each required_subject: if student grade < required min -> FAIL
    3. If school has IELTS requirement AND student has IELTS: if student IELTS < requirement -> FAIL

    Returns (pass: bool, failing_criteria: list[str])
    """
    failing: list[str] = []

    best5 = student_data.get("best5_aggregate", 0) or 0
    min_score = school.get("minimum_entry_score")
    # Only apply aggregate check when best5 > 0 (student has enough compulsory subjects).
    # best5 == 0 typically means partial MOCK grades — skip rather than failing everything.
    if min_score is not None and best5 > 0 and best5 < min_score:
        failing.append(
            f"Aggregate score below minimum (your best-5: {best5}, required: {min_score})"
        )

    required_subjects = school.get("required_subjects") or []
    grades_by_code = student_data.get("grades_by_code") or {}

    from app.modules.school_choice.services.hkdse_service import grade_to_int

    for req in required_subjects:
        code = req.get("subject_code", "")
        min_grade_str = req.get("min_grade", "1")
        min_grade_num = grade_to_int(min_grade_str)

        student_grade_str = grades_by_code.get(code)
        # If student has no grade for this subject yet (partial MOCK), skip the check.
        # Only fail if the student HAS a grade that is below the minimum.
        if student_grade_str is not None:
            student_grade_num = grade_to_int(student_grade_str)
            if student_grade_num < min_grade_num:
                failing.append(
                    f"{code} below required grade "
                    f"(your grade: {student_grade_str}, required: {min_grade_str})"
                )

    # IELTS check
    lang_req = school.get("language_requirements") or {}
    ielts_min = lang_req.get("ielts_minimum")
    student_ielts = student_data.get("ielts_score")
    if ielts_min is not None and student_ielts is not None:
        try:
            if float(student_ielts) < float(ielts_min):
                failing.append(
                    f"IELTS below requirement "
                    f"(your score: {student_ielts}, required: {ielts_min})"
                )
        except (TypeError, ValueError):
            pass

    return (len(failing) == 0, failing)


# ---------------------------------------------------------------------------
# REQ-073: Weighted multi-criteria score
# ---------------------------------------------------------------------------

def _keyword_overlap(items_a: list[str], items_b: list[str]) -> float:
    """Normalised keyword overlap between two token lists (0.0–1.0)."""
    if not items_a or not items_b:
        return 0.0
    tokens_a = set()
    for item in items_a:
        tokens_a.update(w.lower() for w in str(item).split())
    tokens_b = set()
    for item in items_b:
        tokens_b.update(w.lower() for w in str(item).split())
    if not tokens_b:
        return 0.0
    overlap = len(tokens_a & tokens_b)
    return min(1.0, overlap / len(tokens_b))


SUBJECT_KEYWORDS = {
    "PHYS": ["physics", "engineering", "science", "technology"],
    "CHEM": ["chemistry", "science", "medicine", "pharmacy", "biology"],
    "BIO": ["biology", "medicine", "science", "nursing", "health"],
    "ECON": ["economics", "business", "finance", "accounting", "commerce"],
    "HIST": ["history", "humanities", "social science", "arts", "law"],
    "GEOG": ["geography", "environmental", "earth", "urban", "planning"],
    "ICT": ["computer", "technology", "information", "it", "software", "data"],
    "MATH_EXT": ["mathematics", "statistics", "engineering", "science", "finance"],
    "BAFS": ["business", "accounting", "finance", "commerce", "management"],
    "DAT": ["design", "technology", "engineering", "architecture"],
    "VA": ["visual arts", "design", "arts", "creative", "media"],
    "MUSIC": ["music", "arts", "performing"],
    "PE": ["physical education", "sports", "health", "kinesiology"],
    "CHLIT": ["chinese", "literature", "arts", "humanities", "translation"],
    "ENLIT": ["english", "literature", "arts", "linguistics", "translation"],
    "ETHICS": ["philosophy", "ethics", "humanities", "social", "law"],
    "TOURISM": ["tourism", "hospitality", "business", "management"],
    "HLTH": ["health", "nursing", "medicine", "biology", "social work"],
}


def compute_weighted_score(student_data: dict, school: dict) -> dict:
    """
    REQ-073: Weighted multi-criteria score.

    - academic_fit (50%): differentiated by school selectivity using
      average_admitted_score or minimum_entry_score ratio
    - subject_alignment (20%): elective code -> program keyword mapping
    - language_fit (15%): IELTS ratio or ENGL grade proxy
    - interest_alignment (15%): keyword overlap between student activities
      and school notable_programs

    Returns dict with each component and total weighted_score
    """
    best5 = float(student_data.get("best5_aggregate") or 0)

    # Academic fit — differentiate by school selectivity
    avg_score = school.get("average_admitted_score")
    min_score = school.get("minimum_entry_score")

    if avg_score and float(avg_score) > 0:
        # How close is student to school's average admitted score?
        ratio = best5 / float(avg_score)
        if ratio >= 1.0:
            academic_fit = min(1.0, 0.95 + (ratio - 1.0) * 0.05)  # slight penalty for over-qualified
        else:
            academic_fit = max(0.0, ratio)
    elif min_score and float(min_score) > 0:
        # Estimate school target as min + 20% above min
        target = float(min_score) * 1.2
        ratio = best5 / target
        academic_fit = min(1.0, max(0.0, ratio))
    elif best5 > 0:
        # No benchmark — use absolute HKDSE scale (max=35)
        academic_fit = min(1.0, best5 / 35.0)
    else:
        academic_fit = 0.5  # unknown — neutral

    # Subject alignment — keyword mapping from elective code to program text
    student_electives: list[str] = student_data.get("elective_codes") or []
    notable_programs: list[str] = school.get("notable_programs") or []
    programs_text = " ".join(str(p) for p in notable_programs).lower()

    if student_electives and programs_text:
        matched = 0
        for code in student_electives:
            keywords = SUBJECT_KEYWORDS.get(code.upper(), [code.lower()])
            if any(kw in programs_text for kw in keywords):
                matched += 1
        subject_alignment = min(1.0, matched / len(student_electives))
    else:
        subject_alignment = 0.3  # neutral when no data (not 0)

    # Language fit — use ENGL grade as proxy when no IELTS requirement
    lang_req = school.get("language_requirements") or {}
    ielts_min = lang_req.get("ielts_minimum")
    student_ielts = student_data.get("ielts_score")
    grades_by_code = student_data.get("grades_by_code") or {}

    if ielts_min is not None:
        if student_ielts is None:
            language_fit = 0.5  # has requirement but no IELTS data
        else:
            try:
                language_fit = min(1.0, float(student_ielts) / float(ielts_min))
            except (TypeError, ValueError):
                language_fit = 0.5
    else:
        # No IELTS requirement — use ENGL grade as language proxy
        engl_grade = grades_by_code.get("ENGL") or grades_by_code.get("ENLA") or grades_by_code.get("ENLB")
        if engl_grade:
            from app.modules.school_choice.services.hkdse_service import grade_to_int as _gti
            engl_numeric = _gti(engl_grade)
            language_fit = engl_numeric / 7.0  # 5**=1.0, 5*=0.857, 5=0.714, 4=0.571, 3=0.429
        else:
            language_fit = 0.65  # default neutral (not 1.0)

    # Interest alignment — check extra_curricular and award_titles
    extra_curricular: list[str] = student_data.get("extra_curricular_activities") or []
    awards: list[str] = student_data.get("award_titles") or []
    student_activities = extra_curricular + awards
    if student_activities and notable_programs:
        interest_alignment = _keyword_overlap(student_activities, notable_programs)
    else:
        interest_alignment = 0.2  # base neutral (not 0)

    weighted_score = (
        academic_fit * 0.50
        + subject_alignment * 0.20
        + language_fit * 0.15
        + interest_alignment * 0.15
    )

    return {
        "academic_fit": round(academic_fit, 4),
        "subject_alignment": round(subject_alignment, 4),
        "language_fit": round(language_fit, 4),
        "interest_alignment": round(interest_alignment, 4),
        "weighted_score": round(weighted_score, 4),
    }


# ---------------------------------------------------------------------------
# REQ-074, REQ-075: XGBoost + SHAP (graceful fallback)
# ---------------------------------------------------------------------------

_FEATURE_NAMES = [
    "best5_aggregate",
    "ielts_score_or_0",
    "elective_count",
    "award_count",
    "extracurricular_count",
    "academic_fit",
    "subject_alignment",
]

_FEATURE_LABELS = {
    "best5_aggregate": "HKDSE aggregate score",
    "ielts_score_or_0": "English language proficiency",
    "elective_count": "Elective subject count",
    "award_count": "Award achievements",
    "extracurricular_count": "Extracurricular activities",
    "academic_fit": "Academic fit relative to school",
    "subject_alignment": "Subject alignment with school programs",
}


def _load_ml_model():
    """Load XGBoost model from ML_MODEL_PATH. Returns None if unavailable."""
    model_path = os.environ.get("ML_MODEL_PATH", "")
    if not model_path:
        return None
    # Path traversal guard
    if ".." in model_path:
        return None
    if not os.path.isfile(model_path):
        return None
    try:
        import joblib  # type: ignore
        return joblib.load(model_path)
    except Exception:
        return None


_CACHED_MODEL = None
_MODEL_LOAD_ATTEMPTED = False


def _get_model():
    """Return cached ML model (load once)."""
    global _CACHED_MODEL, _MODEL_LOAD_ATTEMPTED
    if not _MODEL_LOAD_ATTEMPTED:
        _CACHED_MODEL = _load_ml_model()
        _MODEL_LOAD_ATTEMPTED = True
    return _CACHED_MODEL


def try_ml_score(
    student_data: dict,
    school: dict,
    component_scores: dict | None = None,
) -> tuple[Optional[float], Optional[dict]]:
    """
    REQ-074, REQ-075: XGBoost scoring with SHAP.

    - Check if ML_MODEL_PATH env var is set and file exists
    - If not: return (None, None) — rule-only fallback
    - If yes: load model, build feature vector, predict probability
    - Compute SHAP values, return top 3 features as plain-English dict

    Feature vector: [best5_aggregate, ielts_score_or_0, elective_count,
                     award_count, extracurricular_count, academic_fit,
                     subject_alignment]
    """
    model = _get_model()
    if model is None:
        return (None, None)

    if component_scores is None:
        component_scores = {}

    ielts_raw = student_data.get("ielts_score")
    try:
        ielts_val = float(ielts_raw) if ielts_raw is not None else 0.0
    except (TypeError, ValueError):
        ielts_val = 0.0

    feature_vector = [
        float(student_data.get("best5_aggregate") or 0),
        ielts_val,
        float(len(student_data.get("elective_codes") or [])),
        float(len(student_data.get("award_titles") or [])),
        float(len(student_data.get("extra_curricular_activities") or [])),
        float(component_scores.get("academic_fit", 0)),
        float(component_scores.get("subject_alignment", 0)),
    ]

    try:
        import numpy as np  # type: ignore
        X = np.array([feature_vector])
        ml_prob = float(model.predict_proba(X)[0][1])

        # SHAP explanation
        try:
            import shap  # type: ignore
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X)
            # For binary classification, shap_values may be a list [class0, class1]
            if isinstance(shap_values, list):
                sv = shap_values[1][0]
            else:
                sv = shap_values[0]

            # Top 3 by absolute value
            feature_importance = sorted(
                zip(_FEATURE_NAMES, sv),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:3]

            shap_output = {
                "features": [
                    {
                        "feature": _FEATURE_LABELS.get(fname, fname),
                        "direction": "positive" if val > 0 else "negative",
                        "magnitude": round(abs(float(val)), 4),
                        "explanation": _build_shap_explanation(fname, val, student_data, school),
                    }
                    for fname, val in feature_importance
                ]
            }
        except Exception:
            shap_output = None

        return (ml_prob, shap_output)

    except Exception:
        return (None, None)


def _build_shap_explanation(
    feature_name: str,
    shap_val: float,
    student_data: dict,
    school: dict,
) -> str:
    """Generate a plain-English explanation for a SHAP feature."""
    direction = "positively" if shap_val > 0 else "negatively"
    label = _FEATURE_LABELS.get(feature_name, feature_name)
    magnitude = abs(shap_val)
    if magnitude > 0.1:
        strength = "strongly"
    elif magnitude > 0.05:
        strength = "moderately"
    else:
        strength = "slightly"
    return f"Your {label} {strength} contributes {direction} to this match."


# ---------------------------------------------------------------------------
# Rationale generator
# ---------------------------------------------------------------------------

def generate_rationale(result: MatchResult) -> str:
    """One-sentence plain English summary using the top scoring component."""
    scores = result.component_scores
    if not scores:
        if result.eligibility_pass:
            return f"This school is a good overall fit with a score of {result.fit_score:.0%}."
        return "This school does not meet the current eligibility criteria."

    top_component = max(
        (k for k in scores if k != "weighted_score"),
        key=lambda k: scores[k],
        default="academic_fit",
    )
    labels = {
        "academic_fit": "academic profile",
        "subject_alignment": "subject choices",
        "language_fit": "language proficiency",
        "interest_alignment": "extracurricular activities",
    }
    top_label = labels.get(top_component, top_component)
    school_name = result.school_name
    score_pct = f"{result.fit_score:.0%}"
    return (
        f"{school_name} is a {score_pct} fit for this student, "
        f"driven primarily by strong {top_label}."
    )


# ---------------------------------------------------------------------------
# REQ-076: Full matching pipeline
# ---------------------------------------------------------------------------

def run_matching(
    student_data: dict,
    schools: list[dict],
    student_targets: list[dict],
) -> list[MatchResult]:
    """
    REQ-076: Full pipeline: filter -> score -> ML -> rank -> preference adjustment.

    1. For each school: run_eligibility_filter
    2. For eligible schools: compute_weighted_score + try_ml_score
    3. final_score = weighted_score if no ML; 0.6*weighted + 0.4*ml_prob if ML available
    4. Sort by final_score descending
    5. Preference adjustment: for schools in student_targets, boost display rank
       by 1 position per preference rank point above median target rank
    6. Ineligible schools appended at end with eligibility_pass=False

    Returns ordered list[MatchResult]
    """
    eligible_results: list[MatchResult] = []
    ineligible_results: list[MatchResult] = []

    data_completeness = compute_data_completeness(student_data)

    for school in schools:
        school_id = str(school.get("id", ""))
        school_name = school.get("name", "Unknown")

        passes, failing = run_eligibility_filter(student_data, school)

        if not passes:
            ineligible_results.append(
                MatchResult(
                    school_id=school_id,
                    school_name=school_name,
                    major_name=None,
                    major_jupas_code=None,
                    eligibility_pass=False,
                    failing_criteria=failing,
                    fit_score=0.0,
                    component_scores={},
                    ml_probability=None,
                    final_score=0.0,
                    shap_explanation=None,
                    rationale=f"Not eligible: {'; '.join(failing)}",
                    data_completeness=data_completeness,
                )
            )
            continue

        # Compute weighted score
        comp_scores = compute_weighted_score(student_data, school)
        weighted = comp_scores.get("weighted_score", 0.0)

        # Try ML
        ml_prob, shap_out = try_ml_score(student_data, school, comp_scores)

        if ml_prob is not None:
            final_score = 0.6 * weighted + 0.4 * ml_prob
        else:
            final_score = weighted

        # If no shap output from ML, generate factor breakdown from component scores
        if shap_out is None:
            shap_out = {
                "features": [
                    {
                        "feature": "Academic Fit",
                        "direction": "positive" if comp_scores["academic_fit"] >= 0.5 else "negative",
                        "magnitude": round(comp_scores["academic_fit"], 4),
                        "explanation": f"Academic profile scores {round(comp_scores['academic_fit']*100)}% fit (Best-5: {student_data.get('best5_aggregate', 0)})",
                    },
                    {
                        "feature": "Subject Alignment",
                        "direction": "positive" if comp_scores["subject_alignment"] >= 0.3 else "negative",
                        "magnitude": round(comp_scores["subject_alignment"], 4),
                        "explanation": f"Elective subject choices are {round(comp_scores['subject_alignment']*100)}% aligned with school programs",
                    },
                    {
                        "feature": "Language Fit",
                        "direction": "positive" if comp_scores["language_fit"] >= 0.6 else "negative",
                        "magnitude": round(comp_scores["language_fit"], 4),
                        "explanation": f"Language proficiency scores {round(comp_scores['language_fit']*100)}% (English grade: {student_data.get('grades_by_code', {}).get('ENGL', 'not recorded')})",
                    },
                    {
                        "feature": "Interest Alignment",
                        "direction": "positive" if comp_scores["interest_alignment"] >= 0.3 else "negative",
                        "magnitude": round(comp_scores["interest_alignment"], 4),
                        "explanation": f"Extracurricular activities score {round(comp_scores['interest_alignment']*100)}% alignment with school programs",
                    },
                ]
            }

        # Expand into (school, major) pairs if major_requirements exist
        major_requirements = school.get("major_requirements") or []
        best5 = float(student_data.get("best5_aggregate") or 0)

        if major_requirements:
            for major in major_requirements:
                major_name = major.get("major")
                major_jupas_code = major.get("jupas_code")
                major_min_score = major.get("minimum_score")

                # Skip majors the student clearly cannot meet
                if major_min_score is not None and best5 > 0 and best5 < float(major_min_score):
                    continue

                # Major fit score: keyword alignment of student electives with major's required/preferred subjects
                major_required = major.get("required_subjects") or []
                student_electives = student_data.get("elective_codes") or []
                if major_required and student_electives:
                    matched = sum(
                        1 for code in student_electives
                        if code.upper() in [r.upper() for r in major_required]
                    )
                    major_fit = min(1.0, matched / len(major_required))
                else:
                    major_fit = 0.5  # neutral when no data

                # Blend school fit with major fit
                blended = round(0.7 * weighted + 0.3 * major_fit, 4)
                if ml_prob is not None:
                    major_final = round(0.6 * blended + 0.4 * ml_prob, 4)
                else:
                    major_final = blended

                result = MatchResult(
                    school_id=school_id,
                    school_name=school_name,
                    major_name=major_name,
                    major_jupas_code=major_jupas_code,
                    eligibility_pass=True,
                    failing_criteria=[],
                    fit_score=blended,
                    component_scores=comp_scores,
                    ml_probability=ml_prob,
                    final_score=major_final,
                    shap_explanation=shap_out,
                    rationale="",
                    data_completeness=data_completeness,
                )
                result.rationale = generate_rationale(result)
                eligible_results.append(result)
        else:
            # No major requirements — create one result with major_name=None
            result = MatchResult(
                school_id=school_id,
                school_name=school_name,
                major_name=None,
                major_jupas_code=None,
                eligibility_pass=True,
                failing_criteria=[],
                fit_score=round(weighted, 4),
                component_scores=comp_scores,
                ml_probability=ml_prob,
                final_score=round(final_score, 4),
                shap_explanation=shap_out,
                rationale="",
                data_completeness=data_completeness,
            )
            result.rationale = generate_rationale(result)
            eligible_results.append(result)

    # Sort eligible by final_score descending
    eligible_results.sort(key=lambda r: r.final_score, reverse=True)

    # Preference adjustment (REQ-076)
    if student_targets:
        target_map = {str(t.get("school_id", "")): t for t in student_targets}
        ranks = [
            t.get("student_rank")
            for t in student_targets
            if t.get("student_rank") is not None
        ]
        if ranks:
            median_rank = sorted(ranks)[len(ranks) // 2]

            boosts: dict[str, int] = {}
            for r in eligible_results:
                target = target_map.get(r.school_id)
                if target and target.get("student_rank") is not None:
                    rank = target["student_rank"]
                    boost = max(0, median_rank - rank)
                    boosts[r.school_id] = boost

            if boosts:
                # Apply boosts: for each school with a boost, move it up
                result_list = list(eligible_results)
                for school_id, boost in boosts.items():
                    idx = next(
                        (i for i, r in enumerate(result_list) if r.school_id == school_id),
                        None,
                    )
                    if idx is not None and boost > 0:
                        new_idx = max(0, idx - boost)
                        item = result_list.pop(idx)
                        result_list.insert(new_idx, item)
                eligible_results = result_list

    return eligible_results + ineligible_results
