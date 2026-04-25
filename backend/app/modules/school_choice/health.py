"""
app/modules/school_choice/health.py

Health callback for the school_choice module.
Reports XGBoost model status (BUG-05).
"""
import logging

logger = logging.getLogger(__name__)


def check_health() -> dict:
    """Report XGBoost model availability for the school_choice module.

    Called by platform health check via registered callback.
    Imports _get_model lazily to avoid circular imports.
    """
    try:
        from app.services.matchmaker_v2 import _get_model
        model = _get_model()
        if model is None:
            logger.warning(
                "[school_choice] XGBoost model not loaded — ML_MODEL_PATH not set or file not found. "
                "Matchmaker will use rule-only scoring (no ML component)."
            )
            return {"xgboost_model": "unavailable", "scoring_mode": "rule_only"}
        logger.info("[school_choice] XGBoost model loaded successfully.")
        return {"xgboost_model": "loaded", "scoring_mode": "hybrid"}
    except Exception as e:
        return {"xgboost_model": "error", "detail": str(e)}
