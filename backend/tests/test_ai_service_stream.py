"""
tests/test_ai_service_stream.py

Behavioral tests for call_ai_stream() SSE streaming.
Verifies SSE format, done sentinel, empty content filtering, and error handling.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException

from app.core.ai_service import call_ai_stream


class MockChunk:
    """Mock a litellm streaming chunk."""

    def __init__(self, content):
        self.choices = [MagicMock()]
        self.choices[0].delta.content = content


class MockAsyncIterator:
    """Mock async iterator for litellm streaming response."""

    def __init__(self, chunks):
        self._chunks = iter(chunks)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._chunks)
        except StopIteration:
            raise StopAsyncIteration


class TestCallAiStream:
    @pytest.mark.asyncio
    async def test_stream_yields_sse_format(self):
        chunks = [MockChunk("Hello"), MockChunk(" world")]
        mock_response = MockAsyncIterator(chunks)
        with patch("app.core.ai_service.litellm") as mock_litellm, \
             patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = "test-key"
            mock_settings.AI_BASE_URL = ""
            mock_settings.AI_TIMEOUT = 30
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.AI_MODEL = "gpt-4o"
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            results = []
            async for chunk in call_ai_stream([{"role": "user", "content": "test"}]):
                results.append(chunk)
            assert results[0] == "data: Hello\n\n"
            assert results[1] == "data:  world\n\n"

    @pytest.mark.asyncio
    async def test_stream_yields_done_sentinel(self):
        chunks = [MockChunk("token")]
        mock_response = MockAsyncIterator(chunks)
        with patch("app.core.ai_service.litellm") as mock_litellm, \
             patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = "test-key"
            mock_settings.AI_BASE_URL = ""
            mock_settings.AI_TIMEOUT = 30
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.AI_MODEL = "gpt-4o"
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            results = []
            async for chunk in call_ai_stream([{"role": "user", "content": "test"}]):
                results.append(chunk)
            assert results[-1] == "event: done\ndata: \n\n"

    @pytest.mark.asyncio
    async def test_stream_skips_empty_content(self):
        chunks = [MockChunk("Hello"), MockChunk(""), MockChunk(None), MockChunk(" end")]
        mock_response = MockAsyncIterator(chunks)
        with patch("app.core.ai_service.litellm") as mock_litellm, \
             patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = "test-key"
            mock_settings.AI_BASE_URL = ""
            mock_settings.AI_TIMEOUT = 30
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.AI_MODEL = "gpt-4o"
            mock_litellm.acompletion = AsyncMock(return_value=mock_response)
            results = []
            async for chunk in call_ai_stream([{"role": "user", "content": "test"}]):
                results.append(chunk)
            # Only non-empty content + done sentinel
            assert len(results) == 3  # "Hello", " end", done
            assert results[0] == "data: Hello\n\n"
            assert results[1] == "data:  end\n\n"

    @pytest.mark.asyncio
    async def test_stream_raises_503_without_api_key(self):
        with patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = ""
            with pytest.raises(HTTPException) as exc_info:
                async for _ in call_ai_stream([{"role": "user", "content": "test"}]):
                    pass
            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_stream_raises_503_on_auth_error(self):
        import litellm as real_litellm
        with patch("app.core.ai_service.litellm") as mock_litellm, \
             patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = "test-key"
            mock_settings.AI_BASE_URL = ""
            mock_settings.AI_TIMEOUT = 30
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.AI_MODEL = "gpt-4o"
            mock_litellm.AuthenticationError = real_litellm.AuthenticationError
            mock_litellm.ServiceUnavailableError = real_litellm.ServiceUnavailableError
            mock_litellm.acompletion = AsyncMock(
                side_effect=real_litellm.AuthenticationError(
                    message="bad key", llm_provider="openai", model="gpt-4o"
                )
            )
            with pytest.raises(HTTPException) as exc_info:
                async for _ in call_ai_stream([{"role": "user", "content": "test"}]):
                    pass
            assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_stream_raises_502_on_generic_error(self):
        with patch("app.core.ai_service.litellm") as mock_litellm, \
             patch("app.core.ai_service.settings") as mock_settings:
            mock_settings.AI_API_KEY = "test-key"
            mock_settings.AI_BASE_URL = ""
            mock_settings.AI_TIMEOUT = 30
            mock_settings.AI_PROVIDER = "openai"
            mock_settings.AI_MODEL = "gpt-4o"
            # Make exception types not match auth/service errors
            mock_litellm.AuthenticationError = type("AuthenticationError", (Exception,), {})
            mock_litellm.ServiceUnavailableError = type("ServiceUnavailableError", (Exception,), {})
            mock_litellm.acompletion = AsyncMock(side_effect=RuntimeError("network fail"))
            with pytest.raises(HTTPException) as exc_info:
                async for _ in call_ai_stream([{"role": "user", "content": "test"}]):
                    pass
            assert exc_info.value.status_code == 502
