"""
tests/test_ai_service.py

Unit tests for the AI service wrapper (app.core.ai_service).
All LiteLLM calls are mocked — no real API keys needed.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


# ---------------------------------------------------------------------------
# Helper: build a mock settings object with sensible test defaults
# ---------------------------------------------------------------------------
def _make_settings(**overrides):
    defaults = {
        "AI_PROVIDER": "openai",
        "AI_API_KEY": "test-key-123",
        "AI_MODEL": "",
        "AI_BASE_URL": "",
        "AI_TIMEOUT": 30,
    }
    defaults.update(overrides)
    s = MagicMock()
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def _make_completion_response(content: str = "  Hello world  "):
    """Build a mock litellm.completion() return value."""
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


# ---------------------------------------------------------------------------
# Test: call_ai raises 503 when AI_API_KEY is empty
# ---------------------------------------------------------------------------
class TestCallAi:
    @patch("app.core.ai_service.settings", _make_settings(AI_API_KEY=""))
    def test_raises_503_when_api_key_empty(self):
        from app.core.ai_service import call_ai

        with pytest.raises(HTTPException) as exc_info:
            call_ai([{"role": "user", "content": "hi"}])
        assert exc_info.value.status_code == 503
        assert "AI_API_KEY" in exc_info.value.detail

    # ------------------------------------------------------------------
    # Provider default model strings
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings(AI_PROVIDER="openai", AI_MODEL=""))
    def test_openai_default_model(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response()
        call_ai([{"role": "user", "content": "hi"}])
        args, kwargs = mock_litellm.completion.call_args
        assert kwargs["model"] == "openai/gpt-4o"

    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings(AI_PROVIDER="anthropic", AI_MODEL=""))
    def test_anthropic_default_model(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response()
        call_ai([{"role": "user", "content": "hi"}])
        args, kwargs = mock_litellm.completion.call_args
        assert kwargs["model"] == "anthropic/claude-sonnet-4-20250514"

    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings(AI_PROVIDER="gemini", AI_MODEL=""))
    def test_gemini_default_model(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response()
        call_ai([{"role": "user", "content": "hi"}])
        args, kwargs = mock_litellm.completion.call_args
        assert kwargs["model"] == "gemini/gemini-2.5-flash"

    # ------------------------------------------------------------------
    # Explicit model override
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings(AI_PROVIDER="openai", AI_MODEL="gpt-4o-mini"))
    def test_explicit_model_override(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response()
        call_ai([{"role": "user", "content": "hi"}])
        args, kwargs = mock_litellm.completion.call_args
        assert kwargs["model"] == "openai/gpt-4o-mini"

    # ------------------------------------------------------------------
    # openai-compatible provider requires explicit model
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.settings", _make_settings(AI_PROVIDER="openai-compatible", AI_MODEL=""))
    def test_openai_compatible_requires_model(self):
        from app.core.ai_service import call_ai

        with pytest.raises(HTTPException) as exc_info:
            call_ai([{"role": "user", "content": "hi"}])
        assert exc_info.value.status_code == 503
        assert "AI_MODEL" in exc_info.value.detail

    # ------------------------------------------------------------------
    # api_base passed when AI_BASE_URL is set
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings(AI_BASE_URL="https://my-proxy.example.com"))
    def test_passes_api_base_when_set(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response()
        call_ai([{"role": "user", "content": "hi"}])
        args, kwargs = mock_litellm.completion.call_args
        assert kwargs["api_base"] == "https://my-proxy.example.com"

    # ------------------------------------------------------------------
    # Error handling
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings())
    def test_auth_error_raises_503(self, mock_litellm):
        from app.core.ai_service import call_ai
        import litellm as real_litellm

        mock_litellm.completion.side_effect = real_litellm.AuthenticationError(
            message="bad key", llm_provider="openai", model="gpt-4o"
        )
        mock_litellm.AuthenticationError = real_litellm.AuthenticationError

        with pytest.raises(HTTPException) as exc_info:
            call_ai([{"role": "user", "content": "hi"}])
        assert exc_info.value.status_code == 503
        assert "authentication" in exc_info.value.detail.lower()

    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings())
    def test_generic_error_raises_502(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.side_effect = RuntimeError("something broke")
        # Ensure AuthenticationError and ServiceUnavailableError don't match RuntimeError
        mock_litellm.AuthenticationError = type("AuthenticationError", (Exception,), {})
        mock_litellm.ServiceUnavailableError = type("ServiceUnavailableError", (Exception,), {})

        with pytest.raises(HTTPException) as exc_info:
            call_ai([{"role": "user", "content": "hi"}])
        assert exc_info.value.status_code == 502

    # ------------------------------------------------------------------
    # Success path: returns stripped content
    # ------------------------------------------------------------------
    @patch("app.core.ai_service.litellm")
    @patch("app.core.ai_service.settings", _make_settings())
    def test_returns_stripped_response(self, mock_litellm):
        from app.core.ai_service import call_ai

        mock_litellm.completion.return_value = _make_completion_response("  Hello world  ")
        mock_litellm.AuthenticationError = type("AuthenticationError", (Exception,), {})
        mock_litellm.ServiceUnavailableError = type("ServiceUnavailableError", (Exception,), {})

        result = call_ai([{"role": "user", "content": "hi"}])
        assert result == "Hello world"
