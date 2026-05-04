"""
Tests for the JUPAS Parametric Scorer Service.

Uses real HKU BBA data:
- Formula: 1.5 x Eng + 1.5 x Math + Best 3 Subjects + 0.2 x 6th Best Subject
- Scale: hku_enhanced (5**=8.5, 5*=7, 5=5.5, 4=4, 3=3, 2=2, 1=1, U=0)
- 2024 stats: Median=33, LQ=32
"""

import math
import pytest

from app.modules.school_choice.services.jupas_scorer import (
    load_grade_scale,
    grade_to_points,
    compute_weighted_score,
    map_score_to_probability,
    check_minimum_requirements,
    score_student_for_programme,
    _normal_cdf,
    _determine_risk_level,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def enhanced_scale():
    return load_grade_scale("jupas_2025_enhanced")


@pytest.fixture
def standard_scale():
    return load_grade_scale("standard_7pt")


@pytest.fixture
def hku_bba_programme():
    """Real HKU BBA programme data."""
    return {
        "jupas_code": "JS6755",
        "name": "Bachelor of Business Administration",
        "faculty": "HKU Business School",
        "scoring_formula": {
            "scale": "hku_enhanced",
            "formula_text": "1.5 x Eng + 1.5 x Math + Best 3 Subjects + 0.2 x 6th Best Subject",
            "best_n": 5,
            "subject_weights": {"ENGL": 1.5, "MATH": 1.5},
            "bonus_subjects": [],
            "bonus_weight": 0.2,
        },
        "minimum_requirements": {"general": "33222"},
        "admission_stats": {
            "2024": {
                "upper_quartile": 34,
                "median": 33,
                "lower_quartile": 32,
                "source": "JUPAS 2024 Admissions Scores PDF",
            }
        },
    }


@pytest.fixture
def simple_best5_programme():
    """Programme with simple best-5, no weights."""
    return {
        "jupas_code": "JS6004",
        "name": "Bachelor of Arts in Architectural Studies",
        "scoring_formula": {
            "scale": "hku_enhanced",
            "formula_text": "Best 5 Subjects",
            "best_n": 5,
            "subject_weights": {},
            "bonus_subjects": [],
            "bonus_weight": 0,
        },
        "minimum_requirements": {"general": "33222"},
        "admission_stats": {
            "2024": {
                "upper_quartile": 31,
                "median": 29,
                "lower_quartile": 28,
                "source": "JUPAS 2024 Admissions Scores PDF",
            }
        },
    }


@pytest.fixture
def strong_student_grades():
    """A strong student: mostly 5* and 5 grades."""
    return {
        "CHIN": "5",
        "ENGL": "5*",
        "MATH": "5*",
        "CSD": "A",
        "ECON": "5",
        "BAFS": "5",
        "M1": "4",
    }


@pytest.fixture
def weak_student_grades():
    """A weak student: mostly level 3-4."""
    return {
        "CHIN": "3",
        "ENGL": "3",
        "MATH": "3",
        "CSD": "A",
        "HIST": "3",
        "GEOG": "2",
    }


# ---------------------------------------------------------------------------
# 1. Grade scale loading
# ---------------------------------------------------------------------------

class TestGradeScaleLoading:

    def test_load_enhanced_scale(self, enhanced_scale):
        assert enhanced_scale["5**"] == 8.5
        assert enhanced_scale["5*"] == 7
        assert enhanced_scale["5"] == 5.5
        assert enhanced_scale["4"] == 4
        assert enhanced_scale["3"] == 3
        assert enhanced_scale["U"] == 0

    def test_load_standard_7pt_scale(self, standard_scale):
        assert standard_scale["5**"] == 7
        assert standard_scale["5*"] == 6
        assert standard_scale["5"] == 5
        assert standard_scale["4"] == 4

    def test_load_hku_enhanced_alias(self):
        scale = load_grade_scale("hku_enhanced")
        assert scale["5**"] == 8.5
        assert scale["5*"] == 7

    def test_unknown_scale_raises(self):
        with pytest.raises(ValueError, match="Unknown grade scale"):
            load_grade_scale("nonexistent_scale")

    def test_applied_learning_grades_loaded(self, enhanced_scale):
        assert enhanced_scale["Attained with Distinction (II)"] == 4
        assert enhanced_scale["Attained with Distinction"] == 3


# ---------------------------------------------------------------------------
# 2. Grade to points conversion
# ---------------------------------------------------------------------------

class TestGradeToPoints:

    def test_standard_grades(self, enhanced_scale):
        assert grade_to_points("5**", enhanced_scale) == 8.5
        assert grade_to_points("5*", enhanced_scale) == 7
        assert grade_to_points("5", enhanced_scale) == 5.5
        assert grade_to_points("4", enhanced_scale) == 4
        assert grade_to_points("U", enhanced_scale) == 0

    def test_csd_grades(self, enhanced_scale):
        # CSD uses short codes A/AD in student records
        assert grade_to_points("A", enhanced_scale) == 2.0
        assert grade_to_points("AD", enhanced_scale) == 3.0

    def test_applied_learning_grades(self, enhanced_scale):
        # Applied Learning uses full strings; "Attained" = 0 (not counted)
        assert grade_to_points("Attained", enhanced_scale) == 0.0
        assert grade_to_points("Attained with Distinction", enhanced_scale) == 3.0

    def test_unknown_grade_returns_zero(self, enhanced_scale):
        assert grade_to_points("Z", enhanced_scale) == 0.0
        assert grade_to_points("", enhanced_scale) == 0.0

    def test_none_grade_returns_zero(self, enhanced_scale):
        assert grade_to_points(None, enhanced_scale) == 0.0

    def test_whitespace_stripped(self, enhanced_scale):
        assert grade_to_points("  5*  ", enhanced_scale) == 7


# ---------------------------------------------------------------------------
# 3. Simple best-5 scoring (no weights)
# ---------------------------------------------------------------------------

class TestSimpleBest5:

    def test_best_5_no_weights(self, strong_student_grades):
        formula = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {},
            "bonus_weight": 0,
        }
        result = compute_weighted_score(strong_student_grades, formula)

        # Best 5 should be: ENGL(7) + MATH(7) + CHIN(5.5) + ECON(5.5) + BAFS(5.5) = 30.5
        assert result["weighted_score"] == 30.5
        assert len(result["included_subjects"]) == 5
        assert result["bonus_points"] == 0

    def test_fewer_than_n_subjects(self):
        grades = {"ENGL": "5", "MATH": "4"}
        formula = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {},
            "bonus_weight": 0,
        }
        result = compute_weighted_score(grades, formula)
        # Only 2 subjects: 5.5 + 4 = 9.5
        assert result["weighted_score"] == 9.5
        assert len(result["included_subjects"]) == 2


# ---------------------------------------------------------------------------
# 4. Weighted scoring (subject weights)
# ---------------------------------------------------------------------------

class TestWeightedScoring:

    def test_hku_bba_formula(self, strong_student_grades):
        """
        HKU BBA: 1.5 x Eng + 1.5 x Math + Best 3 + 0.2 x 6th
        ENGL=5*(7), MATH=5*(7), weighted: 10.5, 10.5
        CHIN=5(5.5), ECON=5(5.5), BAFS=5(5.5)
        Best 5 by weighted: ENGL(10.5), MATH(10.5), CHIN(5.5), ECON(5.5), BAFS(5.5) = 37.5
        Bonus: M1(4) * 0.2 = 0.8; CSD(2) is lower
        Total = 37.5 + 0.8 = 38.3
        """
        formula = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {"ENGL": 1.5, "MATH": 1.5},
            "bonus_weight": 0.2,
        }
        result = compute_weighted_score(strong_student_grades, formula)

        assert result["weighted_score"] == 38.3
        assert "ENGL" in result["included_subjects"]
        assert "MATH" in result["included_subjects"]
        assert result["bonus_points"] == 0.8

    def test_subject_weight_boosts_selection(self):
        """Weighted subjects should be selected even with lower base points."""
        grades = {
            "ENGL": "4",   # base 4, weight 2 -> 8
            "MATH": "4",   # base 4, weight 2 -> 8
            "HIST": "5",   # base 5.5, weight 1 -> 5.5
            "GEOG": "5",   # base 5.5, weight 1 -> 5.5
            "ECON": "5",   # base 5.5, weight 1 -> 5.5
        }
        formula = {
            "scale": "hku_enhanced",
            "best_n": 3,
            "subject_weights": {"ENGL": 2, "MATH": 2},
            "bonus_weight": 0,
        }
        result = compute_weighted_score(grades, formula)

        # ENGL(8) + MATH(8) + best of HIST/GEOG/ECON(5.5) = 21.5
        assert result["weighted_score"] == 21.5
        assert "ENGL" in result["included_subjects"]
        assert "MATH" in result["included_subjects"]


# ---------------------------------------------------------------------------
# 5. Bonus subject scoring
# ---------------------------------------------------------------------------

class TestBonusSubject:

    def test_bonus_uses_base_points(self, strong_student_grades):
        """Bonus should use base_points, not weighted_points."""
        formula = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {"ENGL": 1.5, "MATH": 1.5},
            "bonus_weight": 0.2,
        }
        result = compute_weighted_score(strong_student_grades, formula)
        # Best remaining after top 5 is M1(4 base pts), CSD(2 base pts)
        # Bonus = 4 * 0.2 = 0.8
        assert result["bonus_points"] == 0.8

    def test_no_bonus_when_no_remaining(self):
        grades = {"ENGL": "5", "MATH": "5", "CHIN": "4"}
        formula = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {},
            "bonus_weight": 0.2,
        }
        result = compute_weighted_score(grades, formula)
        # Only 3 subjects, best_n=5, no remaining for bonus
        assert result["bonus_points"] == 0


# ---------------------------------------------------------------------------
# 6. Enhanced scale values
# ---------------------------------------------------------------------------

class TestEnhancedScale:

    def test_5_double_star_is_8_5(self, enhanced_scale):
        assert enhanced_scale["5**"] == 8.5

    def test_enhanced_differs_from_standard(self, enhanced_scale, standard_scale):
        assert enhanced_scale["5**"] == 8.5
        assert standard_scale["5**"] == 7
        assert enhanced_scale["5*"] == 7
        assert standard_scale["5*"] == 6

    def test_score_with_enhanced_vs_standard(self):
        grades = {"ENGL": "5**", "MATH": "5*", "CHIN": "5", "ECON": "4", "HIST": "3"}
        formula_enhanced = {
            "scale": "hku_enhanced",
            "best_n": 5,
            "subject_weights": {},
            "bonus_weight": 0,
        }
        formula_standard = {
            "scale": "standard_7pt",
            "best_n": 5,
            "subject_weights": {},
            "bonus_weight": 0,
        }
        r_enh = compute_weighted_score(grades, formula_enhanced)
        r_std = compute_weighted_score(grades, formula_standard)

        # Enhanced: 8.5+7+5.5+4+3 = 28
        assert r_enh["weighted_score"] == 28
        # Standard: 7+6+5+4+3 = 25
        assert r_std["weighted_score"] == 25


# ---------------------------------------------------------------------------
# 7-9. Probability mapping
# ---------------------------------------------------------------------------

class TestProbabilityMapping:

    def test_probability_at_median_approx_50(self):
        stats = {"median": 33, "lower_quartile": 32, "upper_quartile": 34}
        prob = map_score_to_probability(33, stats)
        assert 0.45 <= prob <= 0.55

    def test_probability_above_uq_gt_75(self):
        stats = {"median": 33, "lower_quartile": 32, "upper_quartile": 34}
        prob = map_score_to_probability(35, stats)
        assert prob > 0.75

    def test_probability_below_lq_lt_25(self):
        stats = {"median": 33, "lower_quartile": 32, "upper_quartile": 34}
        prob = map_score_to_probability(31, stats)
        assert prob < 0.25

    def test_probability_clamped_high(self):
        stats = {"median": 33, "lower_quartile": 32, "upper_quartile": 34}
        prob = map_score_to_probability(100, stats)
        assert prob == 0.99

    def test_probability_clamped_low(self):
        stats = {"median": 33, "lower_quartile": 32, "upper_quartile": 34}
        prob = map_score_to_probability(0, stats)
        assert prob == 0.01

    def test_probability_no_stats_returns_neutral(self):
        prob = map_score_to_probability(33, {})
        assert prob == 0.5

    def test_probability_only_median_and_lq(self):
        """When no UQ, IQR estimated as 2*(median - LQ)."""
        stats = {"median": 33, "lower_quartile": 32}
        prob = map_score_to_probability(33, stats)
        assert 0.45 <= prob <= 0.55

    def test_probability_equal_quartiles(self):
        """When all quartiles equal, use binary outcome."""
        stats = {"median": 33, "lower_quartile": 33, "upper_quartile": 33}
        prob_high = map_score_to_probability(34, stats)
        prob_low = map_score_to_probability(32, stats)
        assert prob_high == 0.75
        assert prob_low == 0.25


# ---------------------------------------------------------------------------
# 10. Minimum requirements
# ---------------------------------------------------------------------------

class TestMinimumRequirements:

    def test_meets_33222(self, strong_student_grades):
        requirements = {"general": "33222"}
        eligible, failures = check_minimum_requirements(
            strong_student_grades, requirements
        )
        assert eligible is True
        assert failures == []

    def test_fails_english(self):
        grades = {
            "CHIN": "3",
            "ENGL": "2",  # Below required 3
            "MATH": "3",
            "ECON": "3",
            "HIST": "3",
        }
        eligible, failures = check_minimum_requirements(
            grades, {"general": "33222"}
        )
        assert eligible is False
        assert any("ENGL" in f for f in failures)

    def test_missing_subject(self):
        grades = {"CHIN": "3", "MATH": "3", "ECON": "3"}
        eligible, failures = check_minimum_requirements(
            grades, {"general": "33222"}
        )
        assert eligible is False
        assert any("ENGL" in f for f in failures)

    def test_fails_elective(self):
        grades = {
            "CHIN": "3",
            "ENGL": "3",
            "MATH": "3",
            "ECON": "1",  # Below required 2
            "HIST": "2",
        }
        eligible, failures = check_minimum_requirements(
            grades, {"general": "33222"}
        )
        assert eligible is False
        assert any("Elective" in f for f in failures)

    def test_no_requirements(self):
        eligible, failures = check_minimum_requirements(
            {"ENGL": "3"}, {}
        )
        assert eligible is True
        assert failures == []


# ---------------------------------------------------------------------------
# 11. Risk level
# ---------------------------------------------------------------------------

class TestRiskLevel:

    def test_safe_at_median(self):
        stats = {"median": 33, "lower_quartile": 32}
        assert _determine_risk_level(33, stats) == "safe"

    def test_safe_above_median(self):
        stats = {"median": 33, "lower_quartile": 32}
        assert _determine_risk_level(35, stats) == "safe"

    def test_borderline(self):
        stats = {"median": 33, "lower_quartile": 32}
        assert _determine_risk_level(32, stats) == "borderline"

    def test_at_risk(self):
        stats = {"median": 33, "lower_quartile": 32}
        assert _determine_risk_level(31, stats) == "at_risk"


# ---------------------------------------------------------------------------
# 12. Full pipeline (score_student_for_programme)
# ---------------------------------------------------------------------------

class TestFullPipeline:

    def test_strong_student_hku_bba(
        self, hku_bba_programme, strong_student_grades
    ):
        result = score_student_for_programme(
            strong_student_grades, hku_bba_programme, stat_year="2024"
        )

        assert result["jupas_code"] == "JS6755"
        assert result["programme_name"] == "Bachelor of Business Administration"
        assert result["eligible"] is True
        assert result["eligibility_failures"] == []
        assert result["weighted_score"] == 38.3
        assert result["bonus_points"] == 0.8
        assert result["admission_probability"] > 0.5
        assert result["risk_level"] == "safe"
        assert result["provenance"]["scale"] == "hku_enhanced"
        assert result["provenance"]["stat_year"] == "2024"
        assert result["provenance"]["median"] == 33

    def test_weak_student_hku_bba(
        self, hku_bba_programme, weak_student_grades
    ):
        result = score_student_for_programme(
            weak_student_grades, hku_bba_programme, stat_year="2024"
        )

        # Weak student meets 33222 (3/3/3 + HIST=3>=2, GEOG=2>=2)
        # but has very low weighted score vs median=33
        assert result["risk_level"] == "at_risk"
        assert result["admission_probability"] < 0.25

    def test_ineligible_student(self, hku_bba_programme):
        """Student who fails minimum requirements."""
        grades = {
            "CHIN": "2",  # Below required 3
            "ENGL": "2",  # Below required 3
            "MATH": "2",
            "CSD": "A",
            "HIST": "1",
            "GEOG": "1",
        }
        result = score_student_for_programme(
            grades, hku_bba_programme, stat_year="2024"
        )
        assert result["eligible"] is False
        assert len(result["eligibility_failures"]) > 0

    def test_uses_latest_year_when_no_stat_year(
        self, hku_bba_programme, strong_student_grades
    ):
        result = score_student_for_programme(
            strong_student_grades, hku_bba_programme
        )
        assert result["provenance"]["stat_year"] == "2024"

    def test_no_stats_returns_neutral(self, strong_student_grades):
        programme = {
            "jupas_code": "JS9999",
            "name": "Test Programme",
            "scoring_formula": {
                "scale": "hku_enhanced",
                "best_n": 5,
                "subject_weights": {},
                "bonus_weight": 0,
            },
            "minimum_requirements": {},
            "admission_stats": {},
        }
        result = score_student_for_programme(strong_student_grades, programme)
        assert result["admission_probability"] == 0.5
        assert result["risk_level"] == "borderline"

    def test_simple_best5_programme(
        self, simple_best5_programme, strong_student_grades
    ):
        result = score_student_for_programme(
            strong_student_grades, simple_best5_programme, stat_year="2024"
        )
        # Best 5: ENGL(7) + MATH(7) + CHIN(5.5) + ECON(5.5) + BAFS(5.5) = 30.5
        assert result["weighted_score"] == 30.5
        assert result["bonus_points"] == 0
        assert result["eligible"] is True
        assert result["risk_level"] == "safe"

    def test_result_has_all_required_keys(
        self, hku_bba_programme, strong_student_grades
    ):
        result = score_student_for_programme(
            strong_student_grades, hku_bba_programme
        )
        required_keys = {
            "jupas_code", "programme_name", "eligible",
            "eligibility_failures", "weighted_score", "included_subjects",
            "subject_details", "bonus_points", "admission_probability",
            "risk_level", "provenance",
        }
        assert required_keys.issubset(set(result.keys()))

        provenance_keys = {
            "scale", "formula_text", "stat_year",
            "lower_quartile", "median", "upper_quartile", "source",
        }
        assert provenance_keys.issubset(set(result["provenance"].keys()))

    def test_subject_details_structure(
        self, hku_bba_programme, strong_student_grades
    ):
        result = score_student_for_programme(
            strong_student_grades, hku_bba_programme
        )
        for detail in result["subject_details"]:
            assert "code" in detail
            assert "grade" in detail
            assert "base_points" in detail
            assert "weight" in detail
            assert "weighted_points" in detail

    def test_cityu_group_weighting(self):
        """CityU pattern: best 5 with certain subjects at 2x weight."""
        programme = {
            "jupas_code": "JS1211",
            "name": "BEng Biomedical Engineering",
            "scoring_formula": {
                "scale": "jupas_2025_enhanced",
                "best_n": 5,
                "subject_weights": {
                    "ENGL": 2, "MATH": 2, "BIOL": 2,
                    "CHEM": 2, "PHYS": 2,
                },
                "bonus_weight": 0,
            },
            "minimum_requirements": {"general": "33222"},
            "admission_stats": {
                "2024": {
                    "upper_quartile": 37,
                    "median": 36,
                    "lower_quartile": 35,
                    "source": "JUPAS 2024",
                }
            },
        }
        grades = {
            "CHIN": "5",    # 5.5 * 1 = 5.5
            "ENGL": "5",    # 5.5 * 2 = 11
            "MATH": "5",    # 5.5 * 2 = 11
            "CSD": "A",     # 2 * 1 = 2
            "CHEM": "4",    # 4 * 2 = 8
            "PHYS": "4",    # 4 * 2 = 8
        }
        result = score_student_for_programme(grades, programme, "2024")
        # Best 5 by weighted: ENGL(11), MATH(11), CHEM(8), PHYS(8), CHIN(5.5)
        assert result["weighted_score"] == 43.5
        assert "CSD" not in result["included_subjects"]
