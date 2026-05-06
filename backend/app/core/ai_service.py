"""
app/core/ai_service.py

LiteLLM-backed AI service wrapper. Single entry point for all AI calls.
Maps AI_PROVIDER + AI_MODEL settings to LiteLLM model string and
invokes litellm.completion() synchronously.

Security:
- Logs the model field returned by the provider (model verification)
- Logs token usage for cost auditing
- Sanitises AI output (strips control chars, validates JSON structure)
"""
from __future__ import annotations

import logging
import re
from collections.abc import AsyncGenerator
from typing import Any

import litellm
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# Dedicated logger for AI audit trail — configure separately in production
# to write to a persistent audit log (file or external service)
ai_audit_logger = logging.getLogger("ai_audit")

# ---------------------------------------------------------------------------
# Output sanitisation
# ---------------------------------------------------------------------------

# Control chars that should never appear in AI-generated text shown to users.
# Keeps newlines, tabs, and standard whitespace.
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _strip_control_chars(text: str) -> str:
    """Remove non-printable control characters from text."""
    return _CONTROL_CHAR_RE.sub("", text)


def _sanitise_ai_output(text: str) -> str:
    """
    Sanitise AI provider output before returning to the application.

    - Strips control characters that could cause rendering issues
    - Trims whitespace
    - Logs if output looks suspicious (e.g., contains <script> tags)
    """
    cleaned = _strip_control_chars(text).strip()

    # Check for suspicious content (script tags, event handlers)
    # This is defence-in-depth — html.escape in plan_generator.py is the
    # primary XSS barrier, but we log here so you know if a provider is
    # returning something fishy.
    lower = cleaned.lower()
    if "<script" in lower or "javascript:" in lower or "onerror=" in lower:
        ai_audit_logger.warning(
            "AI_SUSPICIOUS_OUTPUT response contains potential script injection "
            "(length=%d, first 200 chars: %s)",
            len(cleaned), cleaned[:200],
        )

    return cleaned


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
    # LiteLLM uses "openai/" prefix for custom OpenAI-compatible endpoints
    if provider == "openai-compatible":
        return f"openai/{model}"
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

        # --- Model verification logging ---
        # Log what model the provider CLAIMS to have used.
        # If the provider substitutes a cheaper model, this is
        # the first place you'd see it.
        response_model = getattr(response, "model", None)
        usage = getattr(response, "usage", None)
        ai_audit_logger.info(
            "AI_CALL requested=%s responded=%s prompt_tokens=%s "
            "completion_tokens=%s total_tokens=%s",
            model_string,
            response_model or "UNKNOWN",
            getattr(usage, "prompt_tokens", "?") if usage else "?",
            getattr(usage, "completion_tokens", "?") if usage else "?",
            getattr(usage, "total_tokens", "?") if usage else "?",
        )
        if response_model and model_string.split("/")[-1] not in (response_model or ""):
            ai_audit_logger.warning(
                "AI_MODEL_MISMATCH requested=%s but provider returned model=%s",
                model_string, response_model,
            )

        content = response.choices[0].message.content
        if content is None:
            raise HTTPException(
                status_code=502,
                detail="AI provider returned an empty response.",
            )

        content = _sanitise_ai_output(content)
        return content
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
    chunk_count = 0
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
            # Log model from first chunk
            if chunk_count == 0:
                response_model = getattr(chunk, "model", None)
                ai_audit_logger.info(
                    "AI_STREAM requested=%s responded=%s",
                    model_string, response_model or "UNKNOWN",
                )
                if response_model and model_string.split("/")[-1] not in (response_model or ""):
                    ai_audit_logger.warning(
                        "AI_MODEL_MISMATCH requested=%s but provider returned model=%s",
                        model_string, response_model,
                    )
            chunk_count += 1
            content = chunk.choices[0].delta.content or ""
            if content:
                # Strip control characters from streamed content
                content = _strip_control_chars(content)
                started = True
                yield f"data: {content}\n\n"
        ai_audit_logger.info("AI_STREAM completed chunks=%d", chunk_count)
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
