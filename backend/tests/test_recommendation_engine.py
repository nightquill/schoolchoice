"""
tests/test_recommendation_engine.py

Unit tests for the generic RecommendationEngine.
Pure unit tests — no database connection required.
"""

import pytest
from app.platform.recommendation_engine import (
    RecommendationEngine,
    RecommendationResult,
    RuleDefinition,
)


# ---------------------------------------------------------------------------
# Confidence Tiers (D-15, D-16)
# ---------------------------------------------------------------------------

class TestConfidenceTier:
    """Test compute_confidence_tier with default and custom thresholds."""

    def test_confidence_tier_high(self):
        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, tooltip = engine.compute_confidence_tier(0.85)
        assert tier == "HIGH"
        assert "complete" in tooltip.lower()

    def test_confidence_tier_medium(self):
        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, tooltip = engine.compute_confidence_tier(0.55)
        assert tier == "MEDIUM"
        assert "some data missing" in tooltip.lower()

    def test_confidence_tier_low(self):
        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
        })
        tier, tooltip = engine.compute_confidence_tier(0.3)
        assert tier == "LOW"
        assert "significant data missing" in tooltip.lower()

    def test_confidence_custom_thresholds(self):
        """Custom thresholds: high=0.9, medium=0.6. Completeness 0.75 -> MEDIUM."""
        engine = RecommendationEngine({
            "domain": "test",
            "confidence_thresholds": {"high": 0.9, "medium": 0.6},
        })
        tier, tooltip = engine.compute_confidence_tier(0.75)
        assert tier == "MEDIUM"

    def test_confidence_default_thresholds(self):
        """When no thresholds in config, defaults apply (high=0.7, medium=0.4)."""
        engine = RecommendationEngine({"domain": "test"})
        tier, _ = engine.compute_confidence_tier(0.85)
        assert tier == "HIGH"
        tier, _ = engine.compute_confidence_tier(0.55)
        assert tier == "MEDIUM"
        tier, _ = engine.compute_confidence_tier(0.3)
        assert tier == "LOW"


# ---------------------------------------------------------------------------
# Eligibility (D-14)
# ---------------------------------------------------------------------------

class TestEligibility:
    """Test evaluate_eligibility with comparison and custom rules."""

    def test_evaluate_eligibility_pass(self):
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "min_score",
                    "field": "best5_aggregate",
                    "operator": ">=",
                    "threshold_field": "minimum_entry_score",
                    "skip_when_null": True,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        passed, failing = engine.evaluate_eligibility(
            {"best5_aggregate": 25}, {"minimum_entry_score": 20}
        )
        assert passed is True
        assert len(failing) == 0

    def test_evaluate_eligibility_fail(self):
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "min_score",
                    "field": "best5_aggregate",
                    "operator": ">=",
                    "threshold_field": "minimum_entry_score",
                    "skip_when_null": True,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        passed, failing = engine.evaluate_eligibility(
            {"best5_aggregate": 15}, {"minimum_entry_score": 20}
        )
        assert passed is False
        assert len(failing) == 1
        assert "min_score" in failing[0]

    def test_evaluate_eligibility_skip_null(self):
        """When source field is None and skip_when_null=True, rule is skipped -> passes."""
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "min_score",
                    "field": "best5_aggregate",
                    "operator": ">=",
                    "threshold_field": "minimum_entry_score",
                    "skip_when_null": True,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        passed, failing = engine.evaluate_eligibility(
            {"best5_aggregate": None}, {"minimum_entry_score": 20}
        )
        assert passed is True
        assert len(failing) == 0

    def test_evaluate_eligibility_unknown_operator(self):
        """Unknown operator raises ValueError (T-05-05 threat mitigation)."""
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "bad_rule",
                    "field": "score",
                    "operator": "~=",
                    "threshold_value": 10,
                    "skip_when_null": False,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        with pytest.raises(ValueError, match="Unknown operator"):
            engine.evaluate_eligibility({"score": 5}, {})

    def test_evaluate_eligibility_static_threshold(self):
        """threshold_value (static) works when threshold_field is not set."""
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "min_age",
                    "field": "age",
                    "operator": ">=",
                    "threshold_value": 18,
                    "skip_when_null": False,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        passed, _ = engine.evaluate_eligibility({"age": 20}, {})
        assert passed is True
        passed, _ = engine.evaluate_eligibility({"age": 16}, {})
        assert passed is False

    def test_evaluate_eligibility_custom_hook(self):
        """Custom rule type delegates to a Python hook function."""
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {"name": "special_check", "type": "custom"},
            ],
        }

        def special_check(source, target):
            if source.get("flag"):
                return (True, "")
            return (False, "Flag not set")

        engine = RecommendationEngine(rules_config)
        passed, failing = engine.evaluate_eligibility(
            {"flag": False}, {}, custom_hooks={"special_check": special_check}
        )
        assert passed is False
        assert "Flag not set" in failing[0]

    def test_evaluate_eligibility_in_operator(self):
        """The 'in' operator checks list membership."""
        rules_config = {
            "domain": "test",
            "eligibility_rules": [
                {
                    "name": "category_check",
                    "field": "category",
                    "operator": "in",
                    "threshold_value": ["A", "B", "C"],
                    "skip_when_null": False,
                    "type": "comparison",
                },
            ],
        }
        engine = RecommendationEngine(rules_config)
        passed, _ = engine.evaluate_eligibility({"category": "A"}, {})
        assert passed is True
        passed, failing = engine.evaluate_eligibility({"category": "D"}, {})
        assert passed is False


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

class TestScoring:
    """Test weighted scoring and ML blending."""

    def test_weighted_scoring(self):
        rules_config = {
            "domain": "test",
            "scoring_weights": {
                "academic_fit": 0.50,
                "subject_alignment": 0.20,
                "language_fit": 0.15,
                "interest_alignment": 0.15,
            },
        }
        scoring_hooks = {
            "academic_fit": lambda s, t: 0.8,
            "subject_alignment": lambda s, t: 0.6,
            "language_fit": lambda s, t: 0.7,
            "interest_alignment": lambda s, t: 0.5,
        }
        engine = RecommendationEngine(rules_config)
        total, components = engine.compute_weighted_score({}, {}, scoring_hooks)

        # Manual: 0.8*0.50 + 0.6*0.20 + 0.7*0.15 + 0.5*0.15
        #       = 0.40 + 0.12 + 0.105 + 0.075 = 0.70
        assert abs(total - 0.70) < 0.001
        assert components["academic_fit"] == 0.8
        assert components["subject_alignment"] == 0.6
        assert components["language_fit"] == 0.7
        assert components["interest_alignment"] == 0.5

    def test_blend_ml_score(self):
        engine = RecommendationEngine({
            "domain": "test",
            "ml_model": {"blend_weight": 0.4},
        })
        result = engine.blend_ml_score(0.8, 0.6)
        # (1 - 0.4) * 0.8 + 0.4 * 0.6 = 0.48 + 0.24 = 0.72
        assert abs(result - 0.72) < 0.001

    def test_blend_ml_score_no_ml(self):
        """When ml_probability is None, return weighted_score unchanged."""
        engine = RecommendationEngine({
            "domain": "test",
            "ml_model": {"blend_weight": 0.4},
        })
        result = engine.blend_ml_score(0.8, None)
        assert result == 0.8

    def test_blend_ml_score_no_config(self):
        """When no ml_model in config, return weighted_score unchanged."""
        engine = RecommendationEngine({"domain": "test"})
        result = engine.blend_ml_score(0.8, 0.6)
        assert result == 0.8


# ---------------------------------------------------------------------------
# SHAP (D-17)
# ---------------------------------------------------------------------------

class TestShap:
    """Test SHAP enablement flag."""

    def test_shap_enabled(self):
        engine = RecommendationEngine({
            "domain": "test",
            "ml_model": {"shap_enabled": True},
        })
        assert engine.is_shap_enabled() is True

    def test_shap_disabled_default(self):
        """When no ml_model in config, SHAP is disabled."""
        engine = RecommendationEngine({"domain": "test"})
        assert engine.is_shap_enabled() is False

    def test_shap_disabled_explicit(self):
        engine = RecommendationEngine({
            "domain": "test",
            "ml_model": {"shap_enabled": False},
        })
        assert engine.is_shap_enabled() is False


# ---------------------------------------------------------------------------
# Full pipeline: run_recommendations
# ---------------------------------------------------------------------------

class TestRunRecommendations:
    """Integration-level tests for the full recommendation pipeline."""

    def test_run_recommendations_basic(self):
        rules_config = {
            "domain": "test",
            "confidence_thresholds": {"high": 0.7, "medium": 0.4},
            "eligibility_rules": [
                {
                    "name": "min_score",
                    "field": "score",
                    "operator": ">=",
                    "threshold_field": "min_score",
                    "skip_when_null": True,
                    "type": "comparison",
                },
            ],
            "scoring_weights": {"fit": 1.0},
        }
        targets = [
            {"id": "1", "name": "Target A", "min_score": 50},
            {"id": "2", "name": "Target B", "min_score": 90},
        ]
        engine = RecommendationEngine(rules_config)
        results = engine.run_recommendations(
            source_data={"score": 75},
            targets=targets,
            scoring_hooks={"fit": lambda s, t: 0.8},
            completeness_fn=lambda d: 0.85,
        )
        assert len(results) == 2
        # Target A passes, Target B fails
        passing = [r for r in results if r.eligibility_pass]
        failing = [r for r in results if not r.eligibility_pass]
        assert len(passing) == 1
        assert len(failing) == 1
        assert passing[0].entity_name == "Target A"
        assert passing[0].confidence_tier == "HIGH"
        assert failing[0].entity_name == "Target B"

    def test_run_recommendations_sorted_by_score(self):
        """Results are sorted by final_score descending."""
        rules_config = {
            "domain": "test",
            "scoring_weights": {"fit": 1.0},
        }
        targets = [
            {"id": "1", "name": "Low"},
            {"id": "2", "name": "High"},
        ]
        engine = RecommendationEngine(rules_config)
        # Use scoring hook that returns different values per target
        def fit_hook(source, target):
            return 0.3 if target["name"] == "Low" else 0.9

        results = engine.run_recommendations(
            source_data={},
            targets=targets,
            scoring_hooks={"fit": fit_hook},
            completeness_fn=lambda d: 0.5,
        )
        assert results[0].entity_name == "High"
        assert results[1].entity_name == "Low"
        assert results[0].final_score > results[1].final_score
