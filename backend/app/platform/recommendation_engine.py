"""
app/platform/recommendation_engine.py

Generic recommendation engine that evaluates YAML-defined eligibility rules,
applies weighted scoring via hook functions, optionally blends ML model
predictions, and computes confidence tiers with SHAP explainability.

Domain-agnostic: the school choice domain (or any other) passes its specific
hook functions when calling run_recommendations().

Per D-14, D-15, D-16, D-17 from Phase 5 CONTEXT.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class RuleDefinition:
    """A single eligibility rule parsed from YAML."""
    name: str
    field: str = ""
    operator: str = ""              # ">=", "<=", ">", "<", "==", "in"
    threshold_field: str = ""       # field on the target entity to compare against
    threshold_value: Any = None     # static threshold value (alternative to threshold_field)
    skip_when_null: bool = True     # skip rule if source field is null
    rule_type: str = "comparison"   # "comparison" or "custom" (custom delegates to Python hook)


@dataclass
class RecommendationResult:
    """Result of evaluating a single target entity through the engine."""
    entity_id: str
    entity_name: str
    eligibility_pass: bool
    failing_criteria: list[str]
    fit_score: float
    component_scores: dict
    ml_probability: Optional[float]
    final_score: float
    shap_explanation: Optional[dict]
    data_completeness: float
    confidence_tier: str            # "LOW", "MEDIUM", "HIGH"
    confidence_tooltip: str         # human-readable explanation


# ---------------------------------------------------------------------------
# Operator whitelist (T-05-05 mitigation)
# ---------------------------------------------------------------------------

_OPERATORS: dict[str, Callable[[Any, Any], bool]] = {
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
    ">":  lambda a, b: a > b,
    "<":  lambda a, b: a < b,
    "==": lambda a, b: a == b,
    "in": lambda a, b: a in b,
}


# ---------------------------------------------------------------------------
# RecommendationEngine
# ---------------------------------------------------------------------------

class RecommendationEngine:
    """
    Generic recommendation engine driven by a rules_config dict (parsed from
    a domain's rules.yaml via load_rules_yaml()).

    Expected rules_config keys:
        domain: str
        confidence_thresholds: {high: float, medium: float}   (optional)
        eligibility_rules: list[dict]                          (optional)
        scoring_weights: dict[str, float]                      (optional)
        ml_model: {blend_weight: float, shap_enabled: bool}   (optional)
    """

    def __init__(self, rules_config: dict) -> None:
        self.rules_config = rules_config

    # ------------------------------------------------------------------
    # Eligibility
    # ------------------------------------------------------------------

    def evaluate_eligibility(
        self,
        source_data: dict,
        target: dict,
        custom_hooks: dict[str, Callable] | None = None,
    ) -> tuple[bool, list[str]]:
        """Evaluate eligibility rules against source/target data.

        For each rule of type "comparison": extract source field value,
        extract threshold (from target via threshold_field or from
        threshold_value), apply operator comparison.

        For type "custom": call registered hook function from custom_hooks.

        Returns (all_passed, failing_criteria_list).
        """
        rules = self.rules_config.get("eligibility_rules", [])
        failing: list[str] = []

        for rule_dict in rules:
            rule = RuleDefinition(
                name=rule_dict.get("name", "unnamed"),
                field=rule_dict.get("field", ""),
                operator=rule_dict.get("operator", ""),
                threshold_field=rule_dict.get("threshold_field", ""),
                threshold_value=rule_dict.get("threshold_value"),
                skip_when_null=rule_dict.get("skip_when_null", True),
                rule_type=rule_dict.get("type", rule_dict.get("rule_type", "comparison")),
            )

            if rule.rule_type == "custom":
                if custom_hooks and rule.name in custom_hooks:
                    passed, msg = custom_hooks[rule.name](source_data, target)
                    if not passed:
                        failing.append(msg)
                continue

            # Comparison rule
            source_value = source_data.get(rule.field)

            if source_value is None and rule.skip_when_null:
                continue

            # Resolve threshold
            if rule.threshold_field:
                threshold = target.get(rule.threshold_field)
            else:
                threshold = rule.threshold_value

            if threshold is None:
                continue

            op_fn = _OPERATORS.get(rule.operator)
            if op_fn is None:
                raise ValueError(
                    f"Unknown operator '{rule.operator}' in rule '{rule.name}'. "
                    f"Supported operators: {', '.join(sorted(_OPERATORS.keys()))}"
                )

            if not op_fn(source_value, threshold):
                failing.append(
                    f"Rule '{rule.name}' failed: {rule.field}={source_value} "
                    f"{rule.operator} {threshold}"
                )

        return (len(failing) == 0, failing)

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def compute_weighted_score(
        self,
        source_data: dict,
        target: dict,
        scoring_hooks: dict[str, Callable],
    ) -> tuple[float, dict]:
        """Apply weighted scoring using domain-provided hook functions.

        Reads scoring_weights from rules_config. For each weight key, calls
        the corresponding function from scoring_hooks:
            scoring_hooks["academic_fit"](source_data, target) -> float (0.0-1.0)

        Multiplies each component score by its weight.
        Returns (total_weighted_score, component_scores_dict).
        """
        weights = self.rules_config.get("scoring_weights", {})
        component_scores: dict[str, float] = {}
        total = 0.0

        for key, weight in weights.items():
            hook = scoring_hooks.get(key)
            if hook is not None:
                score = float(hook(source_data, target))
                score = max(0.0, min(1.0, score))  # clamp to [0, 1]
            else:
                score = 0.0
            component_scores[key] = round(score, 4)
            total += score * float(weight)

        return (round(total, 4), component_scores)

    # ------------------------------------------------------------------
    # ML blending
    # ------------------------------------------------------------------

    def blend_ml_score(
        self,
        weighted_score: float,
        ml_probability: float | None,
    ) -> float:
        """Blend weighted score with ML probability if available.

        If ml_model config exists and ml_probability is not None:
            final = (1 - blend_weight) * weighted_score + blend_weight * ml_probability
        Otherwise returns weighted_score unchanged.
        """
        ml_config = self.rules_config.get("ml_model", {})
        if ml_config and ml_probability is not None:
            blend_weight = float(ml_config.get("blend_weight", 0.4))
            return round((1 - blend_weight) * weighted_score + blend_weight * ml_probability, 4)
        return weighted_score

    # ------------------------------------------------------------------
    # Confidence tier (D-15, D-16)
    # ------------------------------------------------------------------

    def compute_confidence_tier(
        self,
        data_completeness: float,
    ) -> tuple[str, str]:
        """Compute confidence tier from data completeness score.

        Reads thresholds from rules_config (default: high=0.7, medium=0.4).
        Returns (tier, tooltip) where tier is "HIGH", "MEDIUM", or "LOW".

        Tooltip text is generic per T-05-07: never reveals which specific
        fields exist or their values.
        """
        thresholds = self.rules_config.get(
            "confidence_thresholds", {"high": 0.7, "medium": 0.4}
        )
        high = float(thresholds.get("high", 0.7))
        medium = float(thresholds.get("medium", 0.4))

        if data_completeness > high:
            return ("HIGH", "All eligibility data complete.")
        elif data_completeness > medium:
            return ("MEDIUM", "Some data missing. Confidence reflects available data only.")
        else:
            return ("LOW", "Significant data missing. Confidence reflects available data only.")

    # ------------------------------------------------------------------
    # SHAP flag (D-17)
    # ------------------------------------------------------------------

    def is_shap_enabled(self) -> bool:
        """Check if SHAP explainability is enabled for this domain."""
        return bool(
            self.rules_config.get("ml_model", {}).get("shap_enabled", False)
        )

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def run_recommendations(
        self,
        source_data: dict,
        targets: list[dict],
        scoring_hooks: dict[str, Callable],
        completeness_fn: Callable[[dict], float],
        ml_score_fn: Callable[[dict, dict], tuple[Optional[float], Optional[dict]]] | None = None,
        shap_fn: Callable[[dict, dict], Optional[dict]] | None = None,
        entity_id_field: str = "id",
        entity_name_field: str = "name",
        custom_eligibility_hooks: dict[str, Callable] | None = None,
    ) -> list[RecommendationResult]:
        """Orchestrate the full recommendation pipeline for each target.

        Steps per target:
        1. Evaluate eligibility rules
        2. Compute weighted score via scoring_hooks
        3. Optionally get ML probability and SHAP explanation
        4. Blend ML score with weighted score
        5. Compute confidence tier from data completeness

        Returns list of RecommendationResult sorted by final_score descending.
        """
        data_completeness = completeness_fn(source_data)
        tier, tooltip = self.compute_confidence_tier(data_completeness)

        results: list[RecommendationResult] = []

        for target in targets:
            entity_id = str(target.get(entity_id_field, ""))
            entity_name = str(target.get(entity_name_field, "Unknown"))

            # 1. Eligibility
            passed, failing = self.evaluate_eligibility(
                source_data, target, custom_eligibility_hooks
            )

            if not passed:
                results.append(RecommendationResult(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    eligibility_pass=False,
                    failing_criteria=failing,
                    fit_score=0.0,
                    component_scores={},
                    ml_probability=None,
                    final_score=0.0,
                    shap_explanation=None,
                    data_completeness=data_completeness,
                    confidence_tier=tier,
                    confidence_tooltip=tooltip,
                ))
                continue

            # 2. Weighted scoring
            weighted, components = self.compute_weighted_score(
                source_data, target, scoring_hooks
            )

            # 3. ML scoring (optional)
            ml_prob: Optional[float] = None
            shap_explanation: Optional[dict] = None

            if ml_score_fn is not None:
                ml_prob, shap_explanation = ml_score_fn(source_data, target)

            if shap_fn is not None and shap_explanation is None:
                shap_explanation = shap_fn(source_data, target)

            # 4. Blend
            final = self.blend_ml_score(weighted, ml_prob)

            results.append(RecommendationResult(
                entity_id=entity_id,
                entity_name=entity_name,
                eligibility_pass=True,
                failing_criteria=[],
                fit_score=weighted,
                component_scores=components,
                ml_probability=ml_prob,
                final_score=final,
                shap_explanation=shap_explanation,
                data_completeness=data_completeness,
                confidence_tier=tier,
                confidence_tooltip=tooltip,
            ))

        # Sort by final_score descending
        results.sort(key=lambda r: r.final_score, reverse=True)

        return results
