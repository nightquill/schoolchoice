"""
tests/test_consultant_routes.py

Integration tests for consultant API endpoints (stream, save, status).
Mocks AI calls and TaskEngine internals since we cannot call real AI providers.
"""
from __future__ import annotations

import json
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
os.environ.setdefault("AI_PROVIDER", "gemini")
os.environ.setdefault("AI_API_KEY", "")

import pytest
from unittest.mock import patch, MagicMock

from app.core.dependencies import get_current_user_or_query_token
from app.main import app as fastapi_app

# Reusable mock helper
_RATE_LIMIT_PATCH = "app.api.v1.routes.consultant._check_consultant_rate_limit"
_STREAM_PATCH = "app.api.v1.routes.consultant.call_ai_stream"
_ENGINE_PATCH = "app.api.v1.routes.consultant.TaskEngine"
_CHAT_SERVICE_PATCH = "app.api.v1.routes.consultant.plan_chat_service"


@pytest.fixture
def auth_token(auth_headers):
    """Extract raw JWT token string from auth_headers for query param tests."""
    header_val = auth_headers["Authorization"]
    return header_val.replace("Bearer ", "")


@pytest.fixture
def override_query_token_auth(auth_headers, db):
    """
    Override get_current_user_or_query_token to bypass UUID/SQLite issues.
    Use explicitly on tests that call the stream endpoint (uses query token auth).
    """
    from app.db.models import User

    user = db.query(User).filter(User.email == "test@example.com").first()
    if user:
        fastapi_app.dependency_overrides[get_current_user_or_query_token] = lambda: user
        yield
        fastapi_app.dependency_overrides.pop(get_current_user_or_query_token, None)
    else:
        yield


def _mock_task():
    """Create a mock TaskDefinition with standard fields."""
    mock = MagicMock()
    mock.max_tokens = 4096
    mock.temperature = 0.3
    mock.jinja2_template = "professional.html.j2"
    mock.output_schema = {
        "type": "object",
        "required": ["student_summary", "recommended_schools"],
        "properties": {
            "student_summary": {"type": "string"},
            "recommended_schools": {"type": "array"},
        },
    }
    return mock


# ---------------------------------------------------------------------------
# Stream endpoint tests
# ---------------------------------------------------------------------------

class TestConsultantStream:
    def test_stream_endpoint_returns_sse(self, client, auth_headers, override_query_token_auth):
        """Verify the stream endpoint returns SSE content type."""
        async def mock_stream(*args, **kwargs):
            yield "data: hello\n\n"
            yield "data: world\n\n"
            yield "event: done\ndata: \n\n"

        with patch(_RATE_LIMIT_PATCH), \
             patch(_STREAM_PATCH, side_effect=mock_stream), \
             patch(_ENGINE_PATCH) as MockEngine:
            MockEngine.return_value.load_task.return_value = _mock_task()
            MockEngine.return_value.build_messages.return_value = [
                {"role": "user", "content": "test"}
            ]

            response = client.get(
                "/api/v1/consultant/tasks/academic_plan/stream?entity_id=test-id",
                headers=auth_headers,
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")

    def test_stream_requires_auth(self, client):
        """Stream endpoint returns 401 without authentication."""
        response = client.get(
            "/api/v1/consultant/tasks/academic_plan/stream?entity_id=test-id"
        )
        assert response.status_code == 401

    def test_stream_accepts_query_token(self, client, auth_token, auth_headers, override_query_token_auth):
        """Verify stream endpoint accepts token as query parameter."""
        async def fake_stream(*args, **kwargs):
            yield "data: test\n\n"
            yield "event: done\ndata: \n\n"

        with patch(_RATE_LIMIT_PATCH), \
             patch(_STREAM_PATCH, side_effect=fake_stream), \
             patch(_ENGINE_PATCH) as MockEngine:
            MockEngine.return_value.load_task.return_value = _mock_task()
            MockEngine.return_value.build_messages.return_value = [
                {"role": "user", "content": "test"}
            ]

            response = client.get(
                f"/api/v1/consultant/tasks/academic_plan/stream?entity_id=test-id&token={auth_token}",
            )
            assert response.status_code == 200

    def test_stream_has_sse_headers(self, client, auth_headers, override_query_token_auth):
        """Verify SSE stream includes Cache-Control and X-Accel-Buffering headers."""
        async def mock_stream(*args, **kwargs):
            yield "data: ok\n\n"
            yield "event: done\ndata: \n\n"

        with patch(_RATE_LIMIT_PATCH), \
             patch(_STREAM_PATCH, side_effect=mock_stream), \
             patch(_ENGINE_PATCH) as MockEngine:
            MockEngine.return_value.load_task.return_value = _mock_task()
            MockEngine.return_value.build_messages.return_value = [
                {"role": "user", "content": "test"}
            ]

            response = client.get(
                "/api/v1/consultant/tasks/academic_plan/stream?entity_id=test-id",
                headers=auth_headers,
            )
            assert response.headers.get("cache-control") == "no-cache"
            assert response.headers.get("x-accel-buffering") == "no"

    def test_stream_404_for_unknown_task(self, client, auth_headers, override_query_token_auth):
        """Stream returns 404 for nonexistent task_id."""
        with patch(_RATE_LIMIT_PATCH), \
             patch(_ENGINE_PATCH) as MockEngine:
            MockEngine.return_value.load_task.side_effect = ValueError(
                "No task definition found for task_id='nonexistent'"
            )

            response = client.get(
                "/api/v1/consultant/tasks/nonexistent/stream?entity_id=test-id",
                headers=auth_headers,
            )
            assert response.status_code == 404

    def test_stream_400_for_bad_entity(self, client, auth_headers, override_query_token_auth):
        """Stream returns 400 when build_messages raises ValueError (PII, missing entity)."""
        with patch(_RATE_LIMIT_PATCH), \
             patch(_ENGINE_PATCH) as MockEngine:
            MockEngine.return_value.load_task.return_value = _mock_task()
            MockEngine.return_value.build_messages.side_effect = ValueError(
                "Student not-found not found"
            )

            response = client.get(
                "/api/v1/consultant/tasks/academic_plan/stream?entity_id=not-found",
                headers=auth_headers,
            )
            assert response.status_code == 400


# ---------------------------------------------------------------------------
# Save endpoint tests
# ---------------------------------------------------------------------------

class TestConsultantSave:
    def test_save_requires_auth(self, client):
        """Save endpoint returns 401 without authentication."""
        response = client.post(
            "/api/v1/consultant/tasks/academic_plan/save",
            json={
                "task_id": "academic_plan",
                "entity_id": "test",
                "ai_output_json": "{}",
            },
        )
        assert response.status_code == 401

    def test_save_rejects_invalid_json(self, client, auth_headers):
        """Save endpoint returns 400 for malformed JSON string."""
        response = client.post(
            "/api/v1/consultant/tasks/academic_plan/save",
            json={
                "task_id": "academic_plan",
                "entity_id": "test",
                "ai_output_json": "not valid json {{{",
            },
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "Invalid JSON" in response.json()["detail"]

    def test_save_rejects_schema_mismatch(self, client, auth_headers):
        """Save returns 400 when AI output fails jsonschema validation."""
        with patch(_ENGINE_PATCH) as MockEngine:
            task = _mock_task()
            MockEngine.return_value.load_task.return_value = task

            # Missing required field 'student_summary'
            response = client.post(
                "/api/v1/consultant/tasks/academic_plan/save",
                json={
                    "task_id": "academic_plan",
                    "entity_id": "test",
                    "ai_output_json": json.dumps({"recommended_schools": []}),
                },
                headers=auth_headers,
            )
            assert response.status_code == 400
            assert "schema validation" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Status endpoint tests
# ---------------------------------------------------------------------------

class TestConsultantStatus:
    def test_status_requires_auth(self, client):
        """Status endpoint returns 401 without authentication."""
        response = client.get(
            "/api/v1/consultant/tasks/academic_plan/status?entity_id=test-id"
        )
        assert response.status_code == 401

    def test_status_404_for_missing_plan(self, client, auth_headers):
        """Status returns 404 when no plan exists for entity_id."""
        import uuid
        fake_id = str(uuid.uuid4())
        response = client.get(
            f"/api/v1/consultant/tasks/academic_plan/status?entity_id={fake_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# Chat endpoint tests
# ---------------------------------------------------------------------------

class TestConsultantChat:
    def test_chat_requires_auth(self, client):
        """Chat endpoint returns 401 without authentication."""
        response = client.post(
            "/api/v1/consultant/tasks/academic_plan/chat",
            json={"entity_id": "test-id", "message": "change the summary"},
        )
        assert response.status_code == 401

    def test_chat_404_for_missing_plan(self, client, auth_headers):
        """Chat returns 404 when no plan exists for entity_id."""
        import uuid
        fake_id = str(uuid.uuid4())
        with patch(_RATE_LIMIT_PATCH):
            response = client.post(
                "/api/v1/consultant/tasks/academic_plan/chat",
                json={"entity_id": fake_id, "message": "update summary"},
                headers=auth_headers,
            )
        assert response.status_code == 404

    def test_chat_returns_message(self, client, auth_headers, db):
        """Chat returns AI response message when plan exists."""
        import uuid
        from app.db.models import User
        from app.db.models_v2 import AcademicPlan
        from app.modules.school_choice.models.models import Student
        from datetime import datetime, timezone

        # Get the test user for FK
        user = db.query(User).filter(User.email == "test@example.com").first()

        # Create a student row (AcademicPlan FK -> students.id)
        student_id = uuid.uuid4()
        student = Student(
            id=student_id,
            user_id=user.id,
            name="Test Student",
            target_region="local",
        )
        db.add(student)
        db.flush()

        # Create a plan row
        plan = AcademicPlan(
            id=uuid.uuid4(),
            student_id=student_id,
            version=1,
            html_content="<p>test</p>",
            generated_at=datetime.now(timezone.utc),
        )
        db.add(plan)
        db.commit()

        mock_result = MagicMock()
        mock_result.message = "Done. Updated: student_summary."
        mock_result.plan_id = str(plan.id)
        mock_result.version = 2
        mock_result.html_content = "<p>updated</p>"

        with patch(_RATE_LIMIT_PATCH), \
             patch(_CHAT_SERVICE_PATCH) as mock_svc:
            mock_svc.handle_chat.return_value = mock_result

            response = client.post(
                "/api/v1/consultant/tasks/academic_plan/chat",
                json={"entity_id": str(student_id), "message": "shorten the summary"},
                headers=auth_headers,
            )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Done. Updated: student_summary."
        assert data["plan_id"] == str(plan.id)
        assert data["version"] == 2

    def test_chat_400_for_invalid_entity_id(self, client, auth_headers):
        """Chat returns 400 for malformed entity_id."""
        response = client.post(
            "/api/v1/consultant/tasks/academic_plan/chat",
            json={"entity_id": "not-a-uuid", "message": "test"},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "Invalid entity_id" in response.json()["detail"]
