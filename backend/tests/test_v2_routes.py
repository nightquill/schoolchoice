"""
tests/test_v2_routes.py

Integration tests for v2 API endpoints.
Covers: grades, targets, schools_v2, account, admin.
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures — imported from conftest via pytest discovery
# ---------------------------------------------------------------------------


def test_health_check(client):
    """Smoke test — verify app boots with v2 routes."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    # Extended health check includes these fields
    assert "db" in data
    assert "cors_origin" in data
    assert "schema_parity" in data
    assert "modules" in data


# ---------------------------------------------------------------------------
# Account endpoints
# ---------------------------------------------------------------------------


class TestAccountEndpoints:
    def test_get_account_unauthenticated(self, client):
        resp = client.get("/api/v1/account")
        # FastAPI HTTPBearer returns 403 when no credentials, 401 when invalid
        assert resp.status_code in (401, 403)

    def test_get_account_authenticated(self, client, auth_headers):
        resp = client.get("/api/v1/account", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "email" in data
        assert "id" in data

    def test_update_account(self, client, auth_headers):
        resp = client.patch(
            "/api/v1/account",
            json={"display_name": "Test Counsellor", "preferred_language": "en"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Test Counsellor"

    def test_update_account_invalid_language(self, client, auth_headers):
        resp = client.patch(
            "/api/v1/account",
            json={"preferred_language": "fr"},  # not allowed
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_change_password_wrong_current(self, client, auth_headers):
        resp = client.post(
            "/api/v1/account/change-password",
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123",
                "confirm_new_password": "newpassword123",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_change_password_mismatch(self, client, auth_headers):
        resp = client.post(
            "/api/v1/account/change-password",
            json={
                "current_password": "testpassword123",
                "new_password": "newpass123",
                "confirm_new_password": "differentpass",
            },
            headers=auth_headers,
        )
        # Should fail at Pydantic validation or route handler
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Schools v2 endpoints
# ---------------------------------------------------------------------------


class TestSchoolsV2Endpoints:
    def test_list_schools_unauthenticated(self, client):
        resp = client.get("/api/v1/schools")
        assert resp.status_code in (401, 403)

    def test_list_schools_empty(self, client, auth_headers):
        resp = client.get("/api/v1/schools", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    def test_get_school_not_found(self, client, auth_headers):
        import uuid
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/api/v1/schools/{fake_id}", headers=auth_headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Grades endpoints (requires a student first)
# ---------------------------------------------------------------------------


class TestGradesEndpoints:
    def _create_student(self, client, auth_headers):
        resp = client.post(
            "/api/v1/students",
            json={
                "name": "Test Student",
                "grades": {},
                "interests": [],
                "strengths_weaknesses": "",
                "target_region": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def _create_grade_system_and_subject(self, client, auth_headers, db):
        """Directly insert a GradeSystem and Subject into the test DB."""
        import uuid
        from app.db.models_v2 import GradeSystem, Subject

        gs = GradeSystem(
            id=uuid.uuid4(),
            name="HKDSE",
            description="Hong Kong Diploma of Secondary Education",
        )
        db.add(gs)
        db.commit()

        subj = Subject(
            id=uuid.uuid4(),
            grade_system_id=gs.id,
            name="English Language",
            code="ENGL",
            category="CORE",
            is_compulsory=True,
        )
        db.add(subj)
        db.commit()
        db.refresh(subj)
        return str(subj.id)

    def test_list_grades_empty(self, client, auth_headers):
        student_id = self._create_student(client, auth_headers)
        resp = client.get(f"/api/v1/students/{student_id}/grades", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["grades"] == []

    def test_create_grade_invalid_subject(self, client, auth_headers):
        import uuid
        student_id = self._create_student(client, auth_headers)
        fake_subject_id = str(uuid.uuid4())
        resp = client.post(
            f"/api/v1/students/{student_id}/grades",
            json={
                "subject_id": fake_subject_id,
                "sitting": "MOCK",
                "raw_grade": "4",
                "year_of_exam": 2025,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_grades_require_auth(self, client):
        import uuid
        resp = client.get(f"/api/v1/students/{uuid.uuid4()}/grades")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Targets endpoints
# ---------------------------------------------------------------------------


class TestTargetsEndpoints:
    def _create_student(self, client, auth_headers):
        resp = client.post(
            "/api/v1/students",
            json={
                "name": "Target Student",
                "grades": {},
                "interests": [],
                "strengths_weaknesses": "",
                "target_region": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_list_targets_empty(self, client, auth_headers):
        student_id = self._create_student(client, auth_headers)
        resp = client.get(f"/api/v1/students/{student_id}/targets", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0

    def test_add_target_invalid_school(self, client, auth_headers):
        import uuid
        student_id = self._create_student(client, auth_headers)
        fake_school_id = str(uuid.uuid4())
        resp = client.post(
            f"/api/v1/students/{student_id}/targets",
            json={"school_id": fake_school_id},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_targets_require_auth(self, client):
        import uuid
        resp = client.get(f"/api/v1/students/{uuid.uuid4()}/targets")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


class TestAdminEndpoints:
    def test_data_refresh_requires_auth(self, client):
        resp = client.post("/api/v1/admin/data-refresh")
        assert resp.status_code in (401, 403)

    def test_data_refresh_requires_admin_role(self, client, auth_headers):
        # Default user has 'counsellor' role → should be 403
        resp = client.post("/api/v1/admin/data-refresh", headers=auth_headers)
        assert resp.status_code == 403

    def test_data_refresh_status_requires_admin(self, client, auth_headers):
        resp = client.get("/api/v1/admin/data-refresh/status", headers=auth_headers)
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Plan endpoints
# ---------------------------------------------------------------------------


class TestPlanEndpoints:
    def _create_student(self, client, auth_headers):
        resp = client.post(
            "/api/v1/students",
            json={
                "name": "Plan Student",
                "grades": {},
                "interests": [],
                "strengths_weaknesses": "",
                "target_region": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def test_get_plan_not_found(self, client, auth_headers):
        student_id = self._create_student(client, auth_headers)
        resp = client.get(f"/api/v1/students/{student_id}/plan", headers=auth_headers)
        assert resp.status_code == 404

    def test_get_plan_status_not_found(self, client, auth_headers):
        student_id = self._create_student(client, auth_headers)
        resp = client.get(f"/api/v1/students/{student_id}/plan/status", headers=auth_headers)
        assert resp.status_code == 404

    def test_create_plan_job(self, client, auth_headers):
        student_id = self._create_student(client, auth_headers)
        resp = client.post(f"/api/v1/students/{student_id}/plan", headers=auth_headers)
        assert resp.status_code == 202
        data = resp.json()
        assert "job_id" in data
        assert data["status"] == "PENDING"


# ---------------------------------------------------------------------------
# Plan chat endpoint tests (Point 16)
# ---------------------------------------------------------------------------


class TestPlanChatEndpoints:
    def _create_student(self, client, auth_headers):
        resp = client.post(
            "/api/v1/students",
            json={
                "name": "Chat Student",
                "grades": {},
                "interests": [],
                "strengths_weaknesses": "",
                "target_region": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def _seed_plan(self, db, student_id: str):
        """Directly insert an AcademicPlan row for the student."""
        import uuid
        from app.db.models_v2 import AcademicPlan
        from datetime import datetime, timezone

        plan = AcademicPlan(
            id=uuid.uuid4(),
            student_id=uuid.UUID(student_id),
            version=1,
            html_content="<html><body>Test Plan</body></html>",
            recommended_schools=[{"school_name": "HKU", "rationale": "Good fit.", "fit_score": 0.8}],
            action_items=[{"task": "Apply early", "deadline": "Q4 2026", "priority": "High"}],
            generated_at=datetime.now(timezone.utc),
            template_id="professional",
            overrides={},
            chat_request_counts={},
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan

    def test_plan_chat_no_api_key(self, client, auth_headers, db):
        """POST /plan/chat returns 503 when GEMINI_API_KEY is not set."""
        import os
        # Ensure key is absent
        os.environ.pop("GEMINI_API_KEY", None)

        student_id = self._create_student(client, auth_headers)
        self._seed_plan(db, student_id)

        resp = client.post(
            f"/api/v1/students/{student_id}/plan/chat",
            json={"message": "Make the plan more concise."},
            headers=auth_headers,
        )
        assert resp.status_code == 503
        assert "GEMINI_API_KEY" in resp.json()["detail"]

    def test_plan_chat_no_plan_returns_404(self, client, auth_headers):
        """POST /plan/chat returns 404 if no plan exists."""
        import os
        os.environ.pop("GEMINI_API_KEY", None)
        student_id = self._create_student(client, auth_headers)
        # No plan seeded
        resp = client.post(
            f"/api/v1/students/{student_id}/plan/chat",
            json={"message": "Test message"},
            headers=auth_headers,
        )
        # 404 (no plan) is raised before API key check
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Plan template/section endpoints tests (Point 17)
# ---------------------------------------------------------------------------


class TestPlanTemplateEndpoints:
    def _create_student(self, client, auth_headers):
        resp = client.post(
            "/api/v1/students",
            json={
                "name": "Template Student",
                "grades": {},
                "interests": [],
                "strengths_weaknesses": "",
                "target_region": "local",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()["id"]

    def _seed_plan(self, db, student_id: str):
        import uuid
        from app.db.models_v2 import AcademicPlan
        from datetime import datetime, timezone

        plan = AcademicPlan(
            id=uuid.uuid4(),
            student_id=uuid.UUID(student_id),
            version=1,
            html_content="<html><body>Test Plan</body></html>",
            recommended_schools=[],
            action_items=[],
            generated_at=datetime.now(timezone.utc),
            template_id="professional",
            overrides={},
            chat_request_counts={},
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan

    def test_set_plan_template_changes_template_id(self, client, auth_headers, db):
        """PATCH /plan/template changes template_id and regenerates HTML."""
        student_id = self._create_student(client, auth_headers)
        self._seed_plan(db, student_id)

        resp = client.patch(
            f"/api/v1/students/{student_id}/plan/template",
            json={"template_id": "modern"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        # version should be incremented
        assert data["version"] >= 2
        # HTML should be regenerated (contain something)
        assert data["html_content"] is not None
        assert "<!DOCTYPE html>" in data["html_content"]

    def test_set_plan_template_invalid_returns_422(self, client, auth_headers, db):
        """PATCH /plan/template with invalid template_id returns 422."""
        student_id = self._create_student(client, auth_headers)
        self._seed_plan(db, student_id)

        resp = client.patch(
            f"/api/v1/students/{student_id}/plan/template",
            json={"template_id": "invalid_template"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_set_plan_template_no_plan_returns_404(self, client, auth_headers):
        """PATCH /plan/template returns 404 if no plan exists."""
        student_id = self._create_student(client, auth_headers)
        resp = client.patch(
            f"/api/v1/students/{student_id}/plan/template",
            json={"template_id": "modern"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_edit_plan_section(self, client, auth_headers, db):
        """PATCH /plan/section upserts override and regenerates HTML."""
        student_id = self._create_student(client, auth_headers)
        self._seed_plan(db, student_id)

        resp = client.patch(
            f"/api/v1/students/{student_id}/plan/section",
            json={
                "section_key": "student_summary",
                "html_content": "<p>Custom summary text</p>",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["version"] >= 2
        assert data["html_content"] is not None
        assert "Custom summary text" in data["html_content"]

    def test_reset_plan_section(self, client, auth_headers, db):
        """DELETE /plan/section/{key} removes override and regenerates HTML."""
        student_id = self._create_student(client, auth_headers)
        plan = self._seed_plan(db, student_id)

        # First set an override
        resp = client.patch(
            f"/api/v1/students/{student_id}/plan/section",
            json={
                "section_key": "student_summary",
                "html_content": "<p>Override to remove</p>",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200

        # Now reset it
        resp2 = client.delete(
            f"/api/v1/students/{student_id}/plan/section/student_summary",
            headers=auth_headers,
        )
        assert resp2.status_code == 200
        data = resp2.json()
        assert "Override to remove" not in (data["html_content"] or "")

    def test_reset_nonexistent_section_is_noop(self, client, auth_headers, db):
        """DELETE /plan/section/{key} for missing key is safe and returns 200."""
        student_id = self._create_student(client, auth_headers)
        self._seed_plan(db, student_id)

        resp = client.delete(
            f"/api/v1/students/{student_id}/plan/section/nonexistent_section",
            headers=auth_headers,
        )
        assert resp.status_code == 200
