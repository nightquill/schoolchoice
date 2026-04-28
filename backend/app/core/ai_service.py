"""
app/core/ai_service.py

LiteLLM-backed AI service wrapper. Single entry point for all AI calls.
Maps AI_PROVIDER + AI_MODEL settings to LiteLLM model string and
invokes litellm.completion() synchronously.
"""
from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
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
        raise HTTPException(status_code=503, detail="AI provider authentication failed.")
    except litellm.ServiceUnavailableError as exc:
        logger.error("AI provider unreachable: %s", exc)
        raise HTTPException(status_code=503, detail="AI provider is temporarily unavailable.")
    except Exception as exc:
        logger.error("AI provider error: %s", exc)
        raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")


async def call_ai_stream(
    messages: list[dict[str, str]],
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    """
    Async streaming variant of call_ai(). Yields SSE-formatted text chunks.
    Returns an async generator — wrap in FastAPI StreamingResponse.

    Raises HTTPException(503) if AI_API_KEY is not configured or auth fails.
    Raises HTTPException(502) on unexpected provider error.
    """
    if not settings.AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI chat is not available: AI_API_KEY is not configured.",
        )

    model_string = _build_model_string()
    logger.info("Streaming AI call: %s", model_string)

    started = False  # Track whether any chunks have been sent
    try:
        response = await litellm.acompletion(
            model=model_string,
            messages=messages,
            api_key=settings.AI_API_KEY,
            api_base=settings.AI_BASE_URL or None,
            timeout=settings.AI_TIMEOUT,
            stream=True,
            **kwargs,
        )
        async for chunk in response:
            content = chunk.choices[0].delta.content or ""
            if content:
                started = True
                yield f"data: {content}\n\n"
        yield "event: done\ndata: \n\n"
    except litellm.AuthenticationError as exc:
        logger.error("AI auth failed: %s", exc)
        if started:
            yield "event: error\ndata: AI provider authentication failed.\n\n"
            return
        raise HTTPException(status_code=503, detail="AI provider authentication failed.")
    except litellm.ServiceUnavailableError as exc:
        logger.error("AI provider unreachable: %s", exc)
        if started:
            yield "event: error\ndata: AI provider is temporarily unavailable.\n\n"
            return
        raise HTTPException(status_code=503, detail="AI provider is temporarily unavailable.")
    except Exception as exc:
        logger.error("AI streaming error: %s", exc)
        if started:
            yield "event: error\ndata: Unexpected error communicating with AI provider.\n\n"
            return
        raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")
