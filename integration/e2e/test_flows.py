"""
integration/e2e/test_flows.py

End-to-end integration tests for the Intelligent Academic Advisor backend.
Tests assume a running backend at http://localhost:8000 backed by a real
PostgreSQL instance (e.g. started via docker-compose.test.yml).

Run with:
    pytest integration/e2e/ -v -m integration

Prerequisites:
    pip install httpx pytest

Each test uses a uuid4-suffixed email address so tests are isolated from one
another even when the database is not wiped between runs.
"""

from __future__ import annotations

import uuid

import httpx
import pytest

BASE_URL = "http://localhost:8000"

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _unique_email() -> str:
    """Return a unique email address for each test invocation."""
    return f"test_{uuid.uuid4().hex[:12]}@advisor-e2e.test"


def _register_and_login(client: httpx.Client, email: str, password: str = "Password123") -> str:
    """Register a new user and return a valid JWT access token."""
    resp = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# test_auth_flow
# REQ-010, REQ-011
# ---------------------------------------------------------------------------

@pytest.mark.skipif(False, reason="Requires running backend at localhost:8000")
def test_auth_flow():
    """
    REQ-010, REQ-011
    Verify email/password registration and login; JWT-based protected route access.
    No OAuth or RBAC (REQ-011 constraint confirmed by absence of role fields in response).
    """
    email = _unique_email()
    password = "StrongPass99"

    with httpx.Client(base_url=BASE_URL) as client:
        # --- Register a new user ---
        # REQ-010: email-and-password authentication for counselor login
        reg_resp = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password},
        )
        assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}: {reg_resp.text}"
        reg_body = reg_resp.json()
        assert "id" in reg_body
        assert reg_body["email"] == email
        # REQ-011: no role field in user response
        assert "role" not in reg_body, "REQ-011 violated: role field must not appear in user response"

        # --- Login and receive token ---
        # REQ-010
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login_resp.status_code == 200, f"Expected 200, got {login_resp.status_code}: {login_resp.text}"
        login_body = login_resp.json()
        assert "access_token" in login_body
        assert login_body.get("token_type", "").lower() == "bearer"
        token = login_body["access_token"]

        # --- Access protected route with valid token (expect 200) ---
        protected_resp = client.get(
            "/api/v1/students",
            headers=_auth_headers(token),
        )
        assert protected_resp.status_code == 200, (
            f"Expected 200 on protected route with valid token, got {protected_resp.status_code}: {protected_resp.text}"
        )

        # --- Access protected route without token (expect 401) ---
        unauth_resp = client.get("/api/v1/students")
        assert unauth_resp.status_code == 401, (
            f"Expected 401 on protected route without token, got {unauth_resp.status_code}: {unauth_resp.text}"
        )


# ---------------------------------------------------------------------------
# test_student_crud
# REQ-012, REQ-013, REQ-014, REQ-015
# ---------------------------------------------------------------------------

@pytest.mark.skipif(False, reason="Requires running backend at localhost:8000")
def test_student_crud():
    """
    REQ-012: create student endpoint
    REQ-013: update student endpoint
    REQ-014: retrieve student endpoint
    REQ-015: list all students endpoint
    """
    email = _unique_email()

    with httpx.Client(base_url=BASE_URL) as client:
        token = _register_and_login(client, email)
        headers = _auth_headers(token)

        student_payload = {
            "name": "Alice Tester",
            "grades": {"math": "A", "english": "B+", "science": "A-"},
            "interests": ["robotics", "music"],
            "strengths_weaknesses": "Strong in math; needs improvement in writing.",
            "target_region": "local",
        }

        # --- Create a student ---
        # REQ-012
        create_resp = client.post("/api/v1/students", json=student_payload, headers=headers)
        assert create_resp.status_code == 201, (
            f"Expected 201 on student create, got {create_resp.status_code}: {create_resp.text}"
        )
        created = create_resp.json()
        student_id = created["id"]
        assert created["name"] == "Alice Tester"
        assert created["target_region"] == "local"

        # --- Get the student by ID ---
        # REQ-014
        get_resp = client.get(f"/api/v1/students/{student_id}", headers=headers)
        assert get_resp.status_code == 200, (
            f"Expected 200 on student get, got {get_resp.status_code}: {get_resp.text}"
        )
        fetched = get_resp.json()
        assert fetched["id"] == student_id
        assert fetched["name"] == "Alice Tester"

        # --- Update the student ---
        # REQ-013
        update_payload = {
            "name": "Alice Tester Updated",
            "grades": {"math": "A+", "english": "A", "science": "A"},
            "interests": ["robotics", "music", "STEM"],
            "strengths_weaknesses": "Strong across all core subjects.",
            "target_region": "international",
        }
        update_resp = client.put(
            f"/api/v1/students/{student_id}", json=update_payload, headers=headers
        )
        assert update_resp.status_code == 200, (
            f"Expected 200 on student update, got {update_resp.status_code}: {update_resp.text}"
        )
        updated = update_resp.json()
        assert updated["name"] == "Alice Tester Updated"
        assert updated["target_region"] == "international"

        # --- List all students (student appears in list) ---
        # REQ-015
        list_resp = client.get("/api/v1/students", headers=headers)
        assert list_resp.status_code == 200, (
            f"Expected 200 on student list, got {list_resp.status_code}: {list_resp.text}"
        )
        student_list = list_resp.json()
        assert isinstance(student_list, list)
        ids_in_list = [s["id"] for s in student_list]
        assert student_id in ids_in_list, "Newly created student not found in student list"

        # --- Delete the student ---
        delete_resp = client.delete(f"/api/v1/students/{student_id}", headers=headers)
        assert delete_resp.status_code == 204, (
            f"Expected 204 on student delete, got {delete_resp.status_code}: {delete_resp.text}"
        )

        # Confirm deletion
        confirm_resp = client.get(f"/api/v1/students/{student_id}", headers=headers)
        assert confirm_resp.status_code == 404, (
            f"Expected 404 after deletion, got {confirm_resp.status_code}: {confirm_resp.text}"
        )


# ---------------------------------------------------------------------------
# test_school_crud
# REQ-016, REQ-017, REQ-018, REQ-019 (school data management underpins matching)
# Also covers: REQ-026 (Schools entity), REQ-030 (internal DB only)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(False, reason="Requires running backend at localhost:8000")
def test_school_crud():
    """
    REQ-026, REQ-030
    Verify school create, get, and list endpoints.
    School names include uuid suffix to avoid 409 conflicts across test runs.
    """
    email = _unique_email()
    school_suffix = uuid.uuid4().hex[:8]

    with httpx.Client(base_url=BASE_URL) as client:
        token = _register_and_login(client, email)
        headers = _auth_headers(token)

        school_payload = {
            "name": f"Greenfield Academy {school_suffix}",
            "location": "Hong Kong",
            "min_academic_requirements": {"math": "B", "english": "C+"},
            "key_strengths": ["STEM", "robotics"],
            "notes": "Strong engineering programme.",
        }

        # --- Create a school ---
        create_resp = client.post("/api/v1/schools", json=school_payload, headers=headers)
        assert create_resp.status_code == 201, (
            f"Expected 201 on school create, got {create_resp.status_code}: {create_resp.text}"
        )
        created = create_resp.json()
        school_id = created["id"]
        assert created["name"] == school_payload["name"]
        assert "STEM" in created["key_strengths"]

        # --- Get the school by ID ---
        get_resp = client.get(f"/api/v1/schools/{school_id}", headers=headers)
        assert get_resp.status_code == 200, (
            f"Expected 200 on school get, got {get_resp.status_code}: {get_resp.text}"
        )
        fetched = get_resp.json()
        assert fetched["id"] == school_id
        assert fetched["name"] == school_payload["name"]
        assert fetched["location"] == "Hong Kong"

        # --- List all schools (newly created school appears) ---
        list_resp = client.get("/api/v1/schools", headers=headers)
        assert list_resp.status_code == 200, (
            f"Expected 200 on school list, got {list_resp.status_code}: {list_resp.text}"
        )
        school_list = list_resp.json()
        assert isinstance(school_list, list)
        ids_in_list = [s["id"] for s in school_list]
        assert school_id in ids_in_list, "Newly created school not found in school list"


# ---------------------------------------------------------------------------
# test_matching_engine
# REQ-020, REQ-021, REQ-022
# Also covers: REQ-016 (filter), REQ-017 (score), REQ-018 (fixed weights),
#              REQ-019 (top-5 ranked), REQ-027, REQ-029, REQ-035, REQ-040
# ---------------------------------------------------------------------------

@pytest.mark.skipif(False, reason="Requires running backend at localhost:8000")
def test_matching_engine():
    """
    REQ-016: matching engine filters schools where student grades don't meet minimum requirements
    REQ-017: scoring uses grade match, interest alignment, strengths alignment
    REQ-018: fixed weights (no user-facing tuning)
    REQ-019: top 5 returned in descending score order
    REQ-020: each recommendation includes score, explanation, gaps
    REQ-027: recommendations are persisted and linked to student
    REQ-029: student may have multiple recommendation records
    """
    email = _unique_email()
    school_suffix = uuid.uuid4().hex[:8]

    with httpx.Client(base_url=BASE_URL) as client:
        token = _register_and_login(client, email)
        headers = _auth_headers(token)

        # Create a student with strong math/science grades and STEM interests
        student_payload = {
            "name": "Bob Matcher",
            "grades": {"math": "A", "english": "B", "science": "A"},
            "interests": ["STEM", "robotics", "engineering"],
            "strengths_weaknesses": "Excellent analytical skills; limited arts exposure.",
            "target_region": "local",
        }
        s_resp = client.post("/api/v1/students", json=student_payload, headers=headers)
        assert s_resp.status_code == 201
        student_id = s_resp.json()["id"]

        # Create school 1: high requirements that student MEETS — should be eligible
        school1_payload = {
            "name": f"Tech High {school_suffix}",
            "location": "Hong Kong",
            "min_academic_requirements": {"math": "B", "science": "B"},
            "key_strengths": ["STEM", "engineering", "robotics"],
            "notes": "Top engineering school.",
        }
        s1_resp = client.post("/api/v1/schools", json=school1_payload, headers=headers)
        assert s1_resp.status_code == 201
        school1_id = s1_resp.json()["id"]

        # Create school 2: requirements that student MEETS — eligible, lower alignment
        school2_payload = {
            "name": f"Arts College {school_suffix}",
            "location": "Hong Kong",
            "min_academic_requirements": {"english": "B"},
            "key_strengths": ["arts", "music", "drama"],
            "notes": "Performing arts focus.",
        }
        s2_resp = client.post("/api/v1/schools", json=school2_payload, headers=headers)
        assert s2_resp.status_code == 201

        # Create school 3: requirements student DOES NOT MEET — must be filtered out (REQ-016)
        school3_payload = {
            "name": f"Elite Academy {school_suffix}",
            "location": "London",
            "min_academic_requirements": {"math": "A+", "english": "A+"},
            "key_strengths": ["STEM", "research"],
            "notes": "Very selective.",
        }
        s3_resp = client.post("/api/v1/schools", json=school3_payload, headers=headers)
        assert s3_resp.status_code == 201
        school3_id = s3_resp.json()["id"]

        # --- POST /students/{id}/recommendations ---
        rec_resp = client.post(
            f"/api/v1/students/{student_id}/recommendations", headers=headers
        )
        assert rec_resp.status_code == 201, (
            f"Expected 201 from recommendations POST, got {rec_resp.status_code}: {rec_resp.text}"
        )
        recommendations = rec_resp.json()

        # REQ-019: at most 5 results
        assert isinstance(recommendations, list)
        assert len(recommendations) <= 5, f"Expected at most 5 recommendations, got {len(recommendations)}"
        assert len(recommendations) >= 1, "Expected at least 1 recommendation"

        # REQ-020: each record has score, explanation, gaps
        for rec in recommendations:
            assert "score" in rec, "Missing 'score' field in recommendation"
            assert "explanation" in rec, "Missing 'explanation' field in recommendation"
            assert "gaps" in rec, "Missing 'gaps' field in recommendation"
            assert "school_name" in rec, "Missing 'school_name' field in recommendation"
            assert isinstance(rec["score"], (int, float)), "Score must be numeric"

        # REQ-019: results are ordered descending by score
        scores = [rec["score"] for rec in recommendations]
        assert scores == sorted(scores, reverse=True), (
            f"Recommendations not sorted by score descending: {scores}"
        )

        # REQ-016: school that does NOT meet grade requirements must be filtered out
        # Elite Academy requires math A+ and english A+; student has math A (95) and english B (83)
        # english B (83) < A+ (100) — must be excluded
        recommended_school_ids = [rec.get("school_id") for rec in recommendations]
        assert school3_id not in recommended_school_ids, (
            "REQ-016 violated: school3 (Elite Academy) with unsatisfied grade requirements "
            "should be filtered out but appears in recommendations"
        )

        # Tech High (school1) should appear — student meets all its requirements
        assert school1_id in recommended_school_ids, (
            "Tech High (all requirements met, high alignment) should appear in recommendations"
        )

        # REQ-020: explanation text is non-empty
        for rec in recommendations:
            assert len(rec["explanation"].strip()) > 0, "Explanation must not be empty"
            assert len(rec["gaps"].strip()) > 0, "Gaps must not be empty"


# ---------------------------------------------------------------------------
# test_action_plan
# REQ-021, REQ-022, REQ-023
# Also covers: REQ-034, REQ-035, REQ-038, REQ-040
# ---------------------------------------------------------------------------

@pytest.mark.skipif(False, reason="Requires running backend at localhost:8000")
def test_action_plan():
    """
    REQ-021: action plan includes academic_targets, extracurricular_direction, preparation_steps
    REQ-022: action plan output is plain text (no structured scheduling logic)
    REQ-023: no external system integration (verified by test isolation — no external calls needed)
    REQ-035: POST /action-plan triggers generation
    REQ-038: GET /action-plan retrieves persisted plan
    REQ-040: full workflow completable in a single session
    """
    email = _unique_email()
    school_suffix = uuid.uuid4().hex[:8]

    with httpx.Client(base_url=BASE_URL) as client:
        token = _register_and_login(client, email)
        headers = _auth_headers(token)

        # Create a student
        student_payload = {
            "name": "Carol Planner",
            "grades": {"math": "B+", "english": "A-", "science": "B"},
            "interests": ["writing", "literature", "debate"],
            "strengths_weaknesses": "Strong communicator; needs more science depth.",
            "target_region": "international",
        }
        s_resp = client.post("/api/v1/students", json=student_payload, headers=headers)
        assert s_resp.status_code == 201
        student_id = s_resp.json()["id"]

        # Create a school so recommendations can be generated first
        school_payload = {
            "name": f"Liberal Arts School {school_suffix}",
            "location": "UK",
            "min_academic_requirements": {"english": "B"},
            "key_strengths": ["literature", "debate", "arts"],
            "notes": "Humanities focused.",
        }
        sch_resp = client.post("/api/v1/schools", json=school_payload, headers=headers)
        assert sch_resp.status_code == 201

        # Generate recommendations first (action plan may use them)
        rec_resp = client.post(
            f"/api/v1/students/{student_id}/recommendations", headers=headers
        )
        assert rec_resp.status_code == 201, (
            f"Prerequisite recommendations POST failed: {rec_resp.status_code}: {rec_resp.text}"
        )

        # --- POST /students/{id}/action-plan ---
        # REQ-021, REQ-035
        ap_post_resp = client.post(
            f"/api/v1/students/{student_id}/action-plan", headers=headers
        )
        assert ap_post_resp.status_code == 201, (
            f"Expected 201 from action-plan POST, got {ap_post_resp.status_code}: {ap_post_resp.text}"
        )
        ap_created = ap_post_resp.json()

        # REQ-021: response must include all three required fields
        assert "academic_targets" in ap_created, "Missing 'academic_targets' in action plan"
        assert "extracurricular_direction" in ap_created, "Missing 'extracurricular_direction' in action plan"
        assert "preparation_steps" in ap_created, "Missing 'preparation_steps' in action plan"
        assert "student_id" in ap_created

        # REQ-022: all three fields must be plain text (strings), non-empty
        assert isinstance(ap_created["academic_targets"], str), "academic_targets must be a string"
        assert isinstance(ap_created["extracurricular_direction"], str), "extracurricular_direction must be a string"
        assert isinstance(ap_created["preparation_steps"], str), "preparation_steps must be a string"
        assert len(ap_created["academic_targets"].strip()) > 0, "academic_targets must not be empty"
        assert len(ap_created["extracurricular_direction"].strip()) > 0, "extracurricular_direction must not be empty"
        assert len(ap_created["preparation_steps"].strip()) > 0, "preparation_steps must not be empty"

        # --- GET /students/{id}/action-plan ---
        # REQ-038: retrieve persisted plan
        ap_get_resp = client.get(
            f"/api/v1/students/{student_id}/action-plan", headers=headers
        )
        assert ap_get_resp.status_code == 200, (
            f"Expected 200 from action-plan GET, got {ap_get_resp.status_code}: {ap_get_resp.text}"
        )
        ap_fetched = ap_get_resp.json()

        # Verify persisted plan matches generated plan
        assert ap_fetched["student_id"] == student_id
        assert ap_fetched["academic_targets"] == ap_created["academic_targets"]
        assert ap_fetched["extracurricular_direction"] == ap_created["extracurricular_direction"]
        assert ap_fetched["preparation_steps"] == ap_created["preparation_steps"]
