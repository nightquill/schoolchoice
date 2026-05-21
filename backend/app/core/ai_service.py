"""
app/core/ai_service.py

Direct OpenAI-compatible API client. Single model: gpt-5.4-nano.
No litellm dependency — just HTTP calls.
"""
from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)
ai_audit_logger = logging.getLogger("ai_audit")

_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

MODEL = "gpt-5.4-nano"


def _strip_control_chars(text: str) -> str:
    return _CONTROL_CHAR_RE.sub("", text)


def _sanitise_ai_output(text: str) -> str:
    cleaned = _strip_control_chars(text).strip()
    lower = cleaned.lower()
    if "<script" in lower or "javascript:" in lower or "onerror=" in lower:
        ai_audit_logger.warning(
            "AI_SUSPICIOUS_OUTPUT length=%d first_200=%s", len(cleaned), cleaned[:200],
        )
    return cleaned


def _api_url() -> str:
    base = (settings.AI_BASE_URL or "https://api.openai.com").rstrip("/")
    return f"{base}/v1/chat/completions"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }


def call_ai(messages: list[dict[str, str]], **kwargs: Any) -> str:
    """Call AI provider. Returns response text."""
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI_API_KEY is not configured.")

    logger.info("Calling AI: %s", MODEL)

    body = {"model": MODEL, "messages": messages, **kwargs}
    body.pop("api_key", None)
    body.pop("api_base", None)
    body.pop("timeout", None)

    try:
        resp = httpx.post(
            _api_url(),
            headers=_headers(),
            json=body,
            timeout=settings.AI_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        response_model = data.get("model")
        usage = data.get("usage", {})
        ai_audit_logger.info(
            "AI_CALL model=%s prompt_tokens=%s completion_tokens=%s",
            response_model, usage.get("prompt_tokens", "?"), usage.get("completion_tokens", "?"),
        )

        content = data["choices"][0]["message"]["content"]
        if content is None:
            raise HTTPException(status_code=502, detail="AI provider returned empty response.")

        return _sanitise_ai_output(content)

    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise HTTPException(status_code=503, detail="AI provider authentication failed.")
        logger.error("AI HTTP error: %s %s", exc.response.status_code, exc.response.text[:200])
        raise HTTPException(status_code=502, detail="AI provider error.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI provider timed out.")
    except Exception as exc:
        logger.error("AI error: %s", exc)
        raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")


async def call_ai_stream(
    messages: list[dict[str, str]],
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    """Async streaming. Yields SSE-formatted text chunks."""
    if not settings.AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI_API_KEY is not configured.")

    logger.info("Streaming AI: %s", MODEL)

    body = {"model": MODEL, "messages": messages, "stream": True, **kwargs}
    body.pop("api_key", None)
    body.pop("api_base", None)
    body.pop("timeout", None)

    started = False
    chunk_count = 0

    try:
        async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT) as client:
            async with client.stream("POST", _api_url(), headers=_headers(), json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue

                    if chunk_count == 0:
                        ai_audit_logger.info("AI_STREAM model=%s", chunk.get("model"))
                    chunk_count += 1

                    content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if content:
                        content = _strip_control_chars(content)
                        started = True
                        yield f"data: {content}\n\n"

        ai_audit_logger.info("AI_STREAM completed chunks=%d", chunk_count)
        yield "event: done\ndata: \n\n"

    except httpx.HTTPStatusError as exc:
        msg = "AI provider error."
        if exc.response.status_code == 401:
            msg = "AI provider authentication failed."
        if started:
            yield f"event: error\ndata: {msg}\n\n"
            return
        raise HTTPException(status_code=503, detail=msg)
    except Exception as exc:
        logger.error("AI streaming error: %s", exc)
        if started:
            yield "event: error\ndata: Unexpected error.\n\n"
            return
        raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")
