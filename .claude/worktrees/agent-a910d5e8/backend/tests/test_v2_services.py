"""
tests/test_v2_services.py

Unit tests for v2 service modules:
- hkdse_service
- matchmaker_v2
- plan_generator
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import pytest

from app.services.hkdse_service import (
    COMPULSORY_CODES,
    GRADE_MAP,
    compute_best5_aggregate,
    compute_predicted_grade,
    grade_to_int,
)
from app.services.matchmaker_v2 import (
    MatchResult,
    compute_weighted_score,
    generate_rationale,
    run_eligibility_filter,
    run_matching,
)
from app.services.plan_generator import _build_action_items, generate_html_plan


# ---------------------------------------------------------------------------
# hkdse_service tests
# ---------------------------------------------------------------------------


class TestGradeToInt:
    def test_all_grades(self):
        assert grade_to_int("5**") == 7
        assert grade_to_int("5*") == 6
        assert grade_to_int("5") == 5
        assert grade_to_int("4") == 4
        assert grade_to_int("3") == 3
        assert grade_to_int("2") == 2
        assert grade_to_int("1") == 1
        assert grade_to_int("U") == 0
        assert grade_to_int("X") == 0

    def test_unknown_grade(self):
        assert grade_to_int("Z") == 0
        assert grade_to_int("") == 0

    def test_none_grade(self):
        assert grade_to_int(None) == 0

    def test_whitespace_stripped(self):
        assert grade_to_int("  5** ") == 7


class TestComputeBest5Aggregate:
    def _make_grade(self, code: str, numeric: int, is_compulsory: bool, category: str = "ELECTIVE") -> dict:
        return {
            "subject_code": code,
            "numeric_value": numeric,
            "is_compulsory": is_compulsory,
            "category": category,
        }

    def test_all_compulsory_one_elective(self):
        grades = [
            self._make_grade("CHLA", 4, True, "CORE"),
            self._make_grade("ENGL", 5, True, "CORE"),
            self._make_grade("MATH", 4, True, "CORE"),
            self._make_grade("CSD", 3, True, "CORE"),
            self._make_grade("BIOL", 5, False, "ELECTIVE"),
        ]
        result = compute_best5_aggregate(grades)
        # 4+5+4+3 = 16, best elective = 5, total = 21
        assert result == 21

    def test_missing_compulsory_returns_0(self):
        # Only 3 compulsory subjects
        grades = [
            self._make_grade("CHLA", 4, True, "CORE"),
            self._make_grade("ENGL", 5, True, "CORE"),
            self._make_grade("MATH", 4, True, "CORE"),
            self._make_grade("BIOL", 5, False, "ELECTIVE"),
        ]
        result = compute_best5_aggregate(grades)
        assert result == 0

    def test_apl_excluded(self):
        grades = [
            self._make_grade("CHLA", 4, True, "CORE"),
            self._make_grade("ENGL", 5, True, "CORE"),
            self._make_grade("MATH", 4, True, "CORE"),
            self._make_grade("CSD", 3, True, "CORE"),
            self._make_grade("APL01", 5, False, "APPLIED_LEARNING"),
            self._make_grade("BIOL", 3, False, "ELECTIVE"),
        ]
        # APL not counted; best elective = BIOL(3)
        result = compute_best5_aggregate(grades)
        assert result == 16 + 3  # 19

    def test_empty_grades(self):
        assert compute_best5_aggregate([]) == 0


class TestComputePredictedGrade:
    def test_no_sittings(self):
        assert compute_predicted_grade([], None) is None

    def test_single_sitting(self):
        sittings = [{"sitting_type": "MOCK", "raw_grade": "4", "year_of_exam": 2025}]
        result = compute_predicted_grade(sittings, None)
        assert result == "4"

    def test_multiple_sittings_most_recent(self):
        sittings = [
            {"sitting_type": "MOCK", "raw_grade": "3", "year_of_exam": 2024},
            {"sitting_type": "MOCK", "raw_grade": "4", "year_of_exam": 2025},
        ]
        result = compute_predicted_grade(sittings, None)
        assert result == "4"

    def test_official_sittings_excluded(self):
        sittings = [
            {"sitting_type": "OFFICIAL", "raw_grade": "5", "year_of_exam": 2025},
        ]
        result = compute_predicted_grade(sittings, None)
        assert result is None

    def test_with_teacher_rating(self):
        # 70% of grade 4 (numeric 4) + 30% of teacher rating 5 = 2.8 + 1.5 = 4.3 → round → 4
        sittings = [{"sitting_type": "MOCK", "raw_grade": "4", "year_of_exam": 2025}]
        result = compute_predicted_grade(sittings, teacher_rating=5)
        # 0.7 * 4 + 0.3 * 5 = 2.8 + 1.5 = 4.3 → round to 4 → "4"
        assert result == "4"


# ---------------------------------------------------------------------------
# matchmaker_v2 tests
# ---------------------------------------------------------------------------


class TestRunEligibilityFilter:
    def test_passes_when_no_requirements(self):
        student_data = {"best5_aggregate": 20, "grades_by_code": {}, "ielts_score": None}
        school = {"minimum_entry_score": None, "required_subjects": None, "language_requirements": None}
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is True
        assert failing == []

    def test_fails_below_min_score(self):
        student_data = {"best5_aggregate": 15, "grades_by_code": {}, "ielts_score": None}
        school = {"minimum_entry_score": 20, "required_subjects": None, "language_requirements": None}
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is False
        assert len(failing) == 1
        assert "Aggregate score below minimum" in failing[0]

    def test_fails_required_subject_below_minimum(self):
        # Student HAS a BIOL grade but it is below the required minimum
        student_data = {
            "best5_aggregate": 22,
            "grades_by_code": {"BIOL": "2"},  # grade 2, requirement is 3
            "ielts_score": None,
        }
        school = {
            "minimum_entry_score": 20,
            "required_subjects": [{"subject_code": "BIOL", "min_grade": "3"}],
            "language_requirements": None,
        }
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is False
        assert any("BIOL" in f for f in failing)

    def test_no_grade_for_required_subject_is_not_failing(self):
        # Student has no BIOL grade yet (partial MOCK) — filter skips the check
        student_data = {
            "best5_aggregate": 22,
            "grades_by_code": {},
            "ielts_score": None,
        }
        school = {
            "minimum_entry_score": 20,
            "required_subjects": [{"subject_code": "BIOL", "min_grade": "3"}],
            "language_requirements": None,
        }
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is True

    def test_fails_ielts_below_requirement(self):
        student_data = {"best5_aggregate": 22, "grades_by_code": {}, "ielts_score": 5.5}
        school = {
            "minimum_entry_score": None,
            "required_subjects": None,
            "language_requirements": {"ielts_minimum": 6.5},
        }
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is False
        assert any("IELTS" in f for f in failing)

    def test_passes_ielts_meets_requirement(self):
        student_data = {"best5_aggregate": 22, "grades_by_code": {}, "ielts_score": 7.0}
        school = {
            "minimum_entry_score": None,
            "required_subjects": None,
            "language_requirements": {"ielts_minimum": 6.5},
        }
        passes, failing = run_eligibility_filter(student_data, school)
        assert passes is True


class TestComputeWeightedScore:
    def test_basic_scoring(self):
        student_data = {
            "best5_aggregate": 20,
            "ielts_score": 7.0,
            "elective_codes": ["BIOL"],
            "extra_curricular_activities": ["science", "robotics"],
            "award_titles": ["STEM Award"],
        }
        school = {
            "minimum_entry_score": 18,
            "average_admitted_score": 20,
            "required_subjects": None,
            "language_requirements": {"ielts_minimum": 6.5},
            "notable_programs": ["science engineering robotics"],
        }
        result = compute_weighted_score(student_data, school)
        assert "weighted_score" in result
        assert 0.0 <= result["weighted_score"] <= 1.0
        # ratio == 1.0 → slight over-qualified penalty: 0.95 + (1.0-1.0)*0.05 = 0.95
        assert result["academic_fit"] == 0.95

    def test_no_ielts_requirement_neutral_language_fit(self):
        # No IELTS requirement and no ENGL grade → neutral default (0.65)
        student_data = {
            "best5_aggregate": 18,
            "ielts_score": None,
            "elective_codes": [],
            "extra_curricular_activities": [],
            "award_titles": [],
            "grades_by_code": {},
        }
        school = {
            "minimum_entry_score": 18,
            "average_admitted_score": None,
            "required_subjects": None,
            "language_requirements": None,
            "notable_programs": [],
        }
        result = compute_weighted_score(student_data, school)
        assert result["language_fit"] == 0.65

    def test_no_ielts_requirement_uses_engl_grade_as_proxy(self):
        # No IELTS requirement but student has ENGL grade → used as proxy
        student_data = {
            "best5_aggregate": 20,
            "ielts_score": None,
            "elective_codes": [],
            "extra_curricular_activities": [],
            "award_titles": [],
            "grades_by_code": {"ENGL": "5**"},
        }
        school = {
            "minimum_entry_score": 18,
            "average_admitted_score": None,
            "required_subjects": None,
            "language_requirements": None,
            "notable_programs": [],
        }
        result = compute_weighted_score(student_data, school)
        assert result["language_fit"] == 1.0  # 5**=7, 7/7=1.0

    def test_missing_ielts_gives_neutral_score(self):
        student_data = {
            "best5_aggregate": 18,
            "ielts_score": None,
            "elective_codes": [],
            "extra_curricular_activities": [],
            "award_titles": [],
        }
        school = {
            "minimum_entry_score": 18,
            "average_admitted_score": None,
            "required_subjects": None,
            "language_requirements": {"ielts_minimum": 6.5},
            "notable_programs": [],
        }
        result = compute_weighted_score(student_data, school)
        assert result["language_fit"] == 0.5


class TestRunMatching:
    def _make_student(self):
        return {
            "best5_aggregate": 20,
            "grades_by_code": {"BIOL": "4"},
            "ielts_score": 7.0,
            "elective_codes": ["BIOL"],
            "extra_curricular_activities": ["science"],
            "award_titles": [],
        }

    def _make_school(self, school_id: str, name: str, min_score: int | None = 18):
        return {
            "id": school_id,
            "name": name,
            "minimum_entry_score": min_score,
            "average_admitted_score": None,
            "required_subjects": [],
            "language_requirements": {},
            "notable_programs": [],
        }

    def test_eligible_school_in_results(self):
        student = self._make_student()
        schools = [self._make_school("s1", "Test University")]
        results = run_matching(student, schools, [])
        assert len(results) == 1
        assert results[0].eligibility_pass is True
        assert results[0].school_id == "s1"

    def test_ineligible_school_at_end(self):
        student = self._make_student()
        schools = [
            self._make_school("s1", "Easy School", min_score=10),
            self._make_school("s2", "Hard School", min_score=30),
        ]
        results = run_matching(student, schools, [])
        assert len(results) == 2
        eligible = [r for r in results if r.eligibility_pass]
        ineligible = [r for r in results if not r.eligibility_pass]
        assert len(eligible) == 1
        assert len(ineligible) == 1
        # Ineligible school should be last
        assert results[-1].eligibility_pass is False

    def test_sorted_by_score(self):
        student = self._make_student()
        schools = [
            self._make_school("s1", "School A", min_score=10),
            self._make_school("s2", "School B", min_score=5),
        ]
        results = run_matching(student, schools, [])
        eligible = [r for r in results if r.eligibility_pass]
        if len(eligible) >= 2:
            assert eligible[0].final_score >= eligible[1].final_score


# ---------------------------------------------------------------------------
# plan_generator tests
# ---------------------------------------------------------------------------


class TestGenerateHtmlPlan:
    def _make_result(self) -> MatchResult:
        return MatchResult(
            school_id="school-1",
            school_name="Test University",
            major_name=None,
            major_jupas_code=None,
            eligibility_pass=True,
            failing_criteria=[],
            fit_score=0.85,
            component_scores={
                "academic_fit": 0.9,
                "subject_alignment": 0.8,
                "language_fit": 1.0,
                "interest_alignment": 0.7,
                "weighted_score": 0.85,
            },
            ml_probability=None,
            final_score=0.85,
            shap_explanation=None,
            rationale="Test University is a good fit.",
        )

    def test_generates_html_string(self):
        student = {
            "name": "Test Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": {"overall": 7.0},
            "extra_curricular": [],
            "awards": [],
        }
        results = [self._make_result()]
        html = generate_html_plan(student, results, [])
        assert isinstance(html, str)
        assert "<!DOCTYPE html>" in html
        assert "Test Student" in html
        assert "@media print" in html

    def test_all_7_sections_present(self):
        student = {
            "name": "Chan Tai Man",
            "year_of_study": 2026,
            "subject_grades": [
                {
                    "subject_code": "ENGL",
                    "subject_name": "English Language",
                    "sitting": "MOCK",
                    "raw_grade": "4",
                    "predicted_grade": "4",
                    "year_of_exam": 2026,
                    "is_compulsory": True,
                    "category": "CORE",
                }
            ],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }
        html = generate_html_plan(student, [self._make_result()], [])
        for section_num in range(1, 8):
            assert f"{section_num}." in html

    def test_university_plan_has_chartjs_cdn(self):
        """UNIVERSITY plan now embeds Chart.js CDN script tag in <head>."""
        student = {"name": "Test", "year_of_study": 2026, "subject_grades": [], "ielts_score": None, "extra_curricular": [], "awards": []}
        html = generate_html_plan(student, [], [])
        assert "chart.js" in html.lower() or "cdn.jsdelivr.net" in html

    def test_inline_css_only(self):
        student = {"name": "Test", "year_of_study": 2026, "subject_grades": [], "ielts_score": None, "extra_curricular": [], "awards": []}
        html = generate_html_plan(student, [], [])
        assert "<link" not in html.lower()


class TestHighSchoolPlan:
    def _make_student(self):
        return {
            "name": "Lee Siu Ming",
            "year_of_study": 2026,
            "subject_grades": [
                {
                    "subject_code": "ENGL",
                    "subject_name": "English Language",
                    "sitting": "MOCK",
                    "raw_grade": "5",
                    "predicted_grade": "5",
                    "year_of_exam": 2026,
                    "is_compulsory": True,
                    "category": "CORE",
                },
                {
                    "subject_code": "MATH",
                    "subject_name": "Mathematics",
                    "sitting": "MOCK",
                    "raw_grade": "2",
                    "predicted_grade": "2",
                    "year_of_exam": 2026,
                    "is_compulsory": True,
                    "category": "CORE",
                },
            ],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }

    def test_high_school_plan_title(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "High School Academic Plan" in html

    def test_high_school_plan_no_ielts_section(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "Language Readiness" not in html
        assert "IELTS" not in html

    def test_high_school_plan_subject_analysis_present(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "Subject Strength" in html
        assert "Strength" in html
        assert "Needs Improvement" in html

    def test_high_school_plan_no_javascript(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "<script" not in html.lower()

    def test_high_school_plan_media_print(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "@media print" in html

    def test_university_plan_default(self):
        # Default plan_type should produce University plan
        student = self._make_student()
        html = generate_html_plan(student, [], [])
        assert "University Academic Plan" in html
        assert "High School Academic Plan" not in html


class TestShapExplanation:
    def _make_result_with_shap(self) -> MatchResult:
        return MatchResult(
            school_id="school-shap",
            school_name="SHAP University",
            major_name=None,
            major_jupas_code=None,
            eligibility_pass=True,
            failing_criteria=[],
            fit_score=0.75,
            component_scores={
                "academic_fit": 0.8,
                "subject_alignment": 0.7,
                "language_fit": 0.9,
                "interest_alignment": 0.6,
                "weighted_score": 0.75,
            },
            ml_probability=None,
            final_score=0.75,
            shap_explanation={
                "features": [
                    {"feature": "Academic Fit", "direction": "positive", "magnitude": 0.182, "explanation": "Your grades align well."},
                    {"feature": "Language", "direction": "negative", "magnitude": 0.05, "explanation": "IELTS slightly below target."},
                    {"feature": "Interest", "direction": "positive", "magnitude": 0.12, "explanation": "Strong activity match."},
                    {"feature": "Awards", "direction": "positive", "magnitude": 0.08, "explanation": "Awards add weight."},
                    {"feature": "Extra", "direction": "negative", "magnitude": 0.01, "explanation": "Minor factor."},
                ]
            },
            rationale="SHAP University is a good fit for testing.",
        )

    def test_shap_section_present_in_university_plan(self):
        student = {
            "name": "Test Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }
        result = self._make_result_with_shap()
        html = generate_html_plan(student, [result], [])
        assert "What drives this score" in html
        assert "Academic Fit" in html
        assert "18.2%" in html

    def test_shap_top_4_only(self):
        student = {
            "name": "Test Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }
        result = self._make_result_with_shap()
        html = generate_html_plan(student, [result], [])
        # The 5th feature "Extra" has magnitude 0.01 and should be excluded
        assert "Minor factor" not in html

    def test_shap_none_gracefully_skipped(self):
        student = {
            "name": "Test Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }
        result = MatchResult(
            school_id="s1",
            school_name="No SHAP School",
            major_name=None,
            major_jupas_code=None,
            eligibility_pass=True,
            failing_criteria=[],
            fit_score=0.7,
            component_scores={},
            ml_probability=None,
            final_score=0.7,
            shap_explanation=None,
            rationale="No SHAP here.",
        )
        html = generate_html_plan(student, [result], [])
        assert "What drives this score" not in html

    def test_shap_not_in_high_school_plan(self):
        student = {
            "name": "Test Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }
        result = self._make_result_with_shap()
        html = generate_html_plan(student, [result], [], plan_type="HIGH_SCHOOL")
        assert "What drives this score" not in html


class TestBuildActionItems:
    def test_generates_items(self):
        student = {
            "name": "Test",
            "subject_grades": [
                {
                    "subject_code": "MATH",
                    "subject_name": "Mathematics",
                    "sitting": "MOCK",
                    "raw_grade": "2",
                    "predicted_grade": "2",
                    "is_compulsory": True,
                    "category": "CORE",
                }
            ],
            "ielts_score": None,
        }
        items = _build_action_items(student, [])
        assert len(items) > 0
        # Should have improvement task for grade 2 subject
        tasks = [i["task"] for i in items]
        assert any("Mathematics" in t or "Grade 4" in t for t in tasks)

    def test_generic_items_always_present(self):
        student = {"name": "Test", "subject_grades": [], "ielts_score": None}
        items = _build_action_items(student, [])
        tasks = [i["task"] for i in items]
        assert any("personal statement" in t.lower() for t in tasks)


# ---------------------------------------------------------------------------
# Chart.js chart tests (Point 15)
# ---------------------------------------------------------------------------


class TestChartsInUniversityPlan:
    def _make_result_eligible(self):
        from app.services.matchmaker_v2 import MatchResult
        return MatchResult(
            school_id="school-chart",
            school_name="Chart University",
            major_name=None,
            major_jupas_code=None,
            eligibility_pass=True,
            failing_criteria=[],
            fit_score=0.8,
            component_scores={
                "academic_fit": 0.85,
                "subject_alignment": 0.75,
                "language_fit": 0.9,
                "interest_alignment": 0.65,
                "weighted_score": 0.8,
            },
            ml_probability=None,
            final_score=0.8,
            shap_explanation=None,
            rationale="Good fit for testing charts.",
        )

    def _make_student_with_grades(self):
        return {
            "name": "Chart Student",
            "year_of_study": 2026,
            "subject_grades": [
                {
                    "subject_code": "ENGL",
                    "subject_name": "English Language",
                    "sitting": "MOCK",
                    "raw_grade": "5",
                    "predicted_grade": "5",
                    "year_of_exam": 2026,
                    "is_compulsory": True,
                    "category": "CORE",
                },
                {
                    "subject_code": "MATH",
                    "subject_name": "Mathematics",
                    "sitting": "MOCK",
                    "raw_grade": "4",
                    "predicted_grade": "4",
                    "year_of_exam": 2026,
                    "is_compulsory": True,
                    "category": "CORE",
                },
            ],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }

    def test_university_plan_contains_chartjs_cdn(self):
        """UNIVERSITY plan <head> includes Chart.js CDN."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [self._make_result_eligible()], [])
        assert "cdn.jsdelivr.net/npm/chart.js" in html

    def test_university_plan_has_grade_chart_canvas(self):
        """UNIVERSITY plan contains a grade chart canvas for eligible school."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [self._make_result_eligible()], [])
        assert 'id="chart-grade-1"' in html

    def test_university_plan_has_radar_chart_canvas(self):
        """UNIVERSITY plan contains a radar chart canvas for eligible school."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [self._make_result_eligible()], [])
        assert 'id="chart-radar-1"' in html

    def test_university_plan_has_gantt_svg(self):
        """UNIVERSITY plan contains the SVG Gantt timeline."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [self._make_result_eligible()], [])
        assert "<svg" in html
        assert "Timeline Overview" in html

    def test_university_plan_has_print_canvas_rule(self):
        """UNIVERSITY plan @media print includes canvas rule."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [self._make_result_eligible()], [])
        assert "canvas" in html and "@media print" in html

    def test_high_school_plan_has_no_chart(self):
        """HIGH_SCHOOL plan must NOT contain Chart.js canvas elements."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [], [], plan_type="HIGH_SCHOOL")
        assert "chart-grade" not in html
        assert "chart-radar" not in html
        assert "cdn.jsdelivr.net/npm/chart.js" not in html

    def test_no_eligible_schools_produces_no_chart_canvas(self):
        """With no eligible schools, no chart canvases are emitted."""
        student = self._make_student_with_grades()
        html = generate_html_plan(student, [], [])
        # No eligible schools → no school chart canvases
        assert "chart-grade-1" not in html
        assert "chart-radar-1" not in html


# ---------------------------------------------------------------------------
# Template tests (Point 17)
# ---------------------------------------------------------------------------


class TestPlanTemplates:
    def _make_student(self):
        return {
            "name": "Template Student",
            "year_of_study": 2026,
            "subject_grades": [],
            "ielts_score": None,
            "extra_curricular": [],
            "awards": [],
        }

    def test_default_template_is_professional(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [])
        # professional template uses Georgia serif
        assert "Georgia" in html

    def test_modern_template_uses_teal(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], template_id="modern")
        assert "#0d9488" in html

    def test_minimal_template_uses_black_heading(self):
        student = self._make_student()
        html = generate_html_plan(student, [], [], template_id="minimal")
        assert "#000000" in html

    def test_unknown_template_falls_back_to_professional(self):
        student = self._make_student()
        # Unknown template should not raise; defaults to professional
        html = generate_html_plan(student, [], [], template_id="nonexistent")
        assert "<!DOCTYPE html>" in html

    def test_student_summary_override_applied(self):
        student = self._make_student()
        overrides = {"student_summary": "<p>Custom summary content</p>"}
        html = generate_html_plan(student, [], [], overrides=overrides)
        assert "Custom summary content" in html

    def test_action_plan_notes_override_applied(self):
        student = self._make_student()
        overrides = {"action_plan_notes": "<p>Counsellor note here</p>"}
        html = generate_html_plan(student, [], [], overrides=overrides)
        assert "Counsellor note here" in html

    def test_reset_override_removes_custom_content(self):
        student = self._make_student()
        # First confirm override works
        overrides = {"student_summary": "<p>Override text</p>"}
        html_with = generate_html_plan(student, [], [], overrides=overrides)
        assert "Override text" in html_with
        # Then reset (empty overrides)
        html_without = generate_html_plan(student, [], [], overrides={})
        assert "Override text" not in html_without
