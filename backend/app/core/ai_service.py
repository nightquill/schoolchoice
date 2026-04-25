"""
app/core/ai_service.py

LiteLLM-backed AI service wrapper. Single entry point for all AI calls.
Maps AI_PROVIDER + AI_MODEL settings to LiteLLM model string and
invokes litellm.completion() synchronously.
"""
from __future__ import annotations

import logging
from typing import Any

import litellm
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

_PROVIDER_DEFAULTS: dict[str, str] = {
    "openai": "gpt-4o",
    "anthropic": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.5-flash",
}


def _build_model_string() -> str:
    """Construct LiteLLM model string from AI_PROVIDER + AI_MODEL settings."""
    provider = settings.AI_PROVIDER
    model = settings.AI_MODEL or _PROVIDER_DEFAULTS.get(provider)
    if not model:
        raise HTTPException(
            status_code=503,
            detail=f"AI_MODEL must be set explicitly for '{provider}' provider.",
        )
    return f"{provider}/{model}"


def call_ai(messages: list[dict[str, str]], **kwargs: Any) -> str:
    """
    Call AI provider via LiteLLM. Returns response text.

    Raises:
        HTTPException(503) — AI_API_KEY not configured, provider unreachable, or auth failed
        HTTPException(502) — Provider returned bad/unexpected response
    """
    if not settings.AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI chat is not available: AI_API_KEY is not configured.",
        )

    model_string = _build_model_string()
    logger.info("Calling AI provider: %s", model_string)

    try:
        response = litellm.completion(
            model=model_string,
            messages=messages,
            api_key=settings.AI_API_KEY,
            api_base=settings.AI_BASE_URL or None,
            timeout=settings.AI_TIMEOUT,
            **kwargs,
        )
        content = response.choices[0].message.content
        if content is None:
            raise HTTPException(
                status_code=502,
                detail="AI provider returned an empty response.",
            )
        return content.strip()
    except litellm.AuthenticationError as exc:
        logger.error("AI provider authentication failed: %s", exc)
        raise HTTPException(status_code=503, detail=f"AI provider authentication failed: {exc}")
    except litellm.ServiceUnavailableError as exc:
        logger.error("AI provider unreachable: %s", exc)
        raise HTTPException(status_code=503, detail=f"AI provider unreachable: {exc}")
    except Exception as exc:
        logger.error("AI provider error: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}")
