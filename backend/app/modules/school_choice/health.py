"""
app/modules/school_choice/health.py

Health callback for the school_choice module.
Reports XGBoost model status (BUG-05) and AI provider status (D-13).
"""
import logging

logger = logging.getLogger(__name__)


def check_health() -> dict:
    """Report XGBoost model and AI provider status for the school_choice module.

    Called by platform health check via registered callback.
    Imports lazily to avoid circular imports.
    """
    result: dict = {}

    # XGBoost model check (unchanged from Phase 1)
    try:
        from app.modules.school_choice.services.matchmaker_v2 import _get_model
        model = _get_model()
        if model is None:
            logger.warning(
                "[school_choice] XGBoost model not loaded — ML_MODEL_PATH not set or file not found. "
                "Matchmaker will use rule-only scoring (no ML component)."
            )
            result["xgboost_model"] = "unavailable"
            result["scoring_mode"] = "rule_only"
        else:
            logger.info("[school_choice] XGBoost model loaded successfully.")
            result["xgboost_model"] = "loaded"
            result["scoring_mode"] = "hybrid"
    except Exception as e:
        result["xgboost_model"] = "error"
        result["xgboost_detail"] = str(e)

    # AI provider check (D-13)
    try:
        from app.core.config import settings
        result["ai_provider"] = settings.AI_PROVIDER
        if not settings.AI_API_KEY:
            result["ai_status"] = "unconfigured"
        else:
            result["ai_status"] = "configured"
            result["ai_model"] = settings.AI_MODEL or f"default ({settings.AI_PROVIDER})"
    except Exception as e:
        result["ai_provider"] = "unknown"
        result["ai_status"] = "error"
        result["ai_detail"] = str(e)

    return result
