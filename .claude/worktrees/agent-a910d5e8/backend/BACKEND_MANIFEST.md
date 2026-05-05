# Backend Manifest
# Intelligent Academic Advisor — MVP
# Date: 2026-03-27

Every implemented endpoint: method, path, service function, REQ-IDs, auth required, test status.

---

## Endpoint Inventory

| # | Method | Path | Service Function | REQ-IDs | Auth Required | Test Status |
|---|--------|------|-----------------|---------|---------------|-------------|
| 1 | POST | /api/v1/auth/register | `auth_service.register_user` | REQ-010, REQ-011, REQ-024 | No (Public) | PASS |
| 2 | POST | /api/v1/auth/login | `auth_service.login_for_access_token` | REQ-010, REQ-011, REQ-031 | No (Public) | PASS |
| 3 | GET | /api/v1/students | `student_service.get_students` | REQ-015, REQ-032 | Yes | PASS |
| 4 | POST | /api/v1/students | `student_service.create_student` | REQ-012, REQ-025, REQ-028, REQ-033 | Yes | NOT_TESTED |
| 5 | GET | /api/v1/students/{id} | `student_service.get_student` | REQ-014, REQ-033 | Yes | NOT_TESTED |
| 6 | PUT | /api/v1/students/{id} | `student_service.update_student` | REQ-013, REQ-033 | Yes | NOT_TESTED |
| 7 | DELETE | /api/v1/students/{id} | `student_service.delete_student` | REQ-025, REQ-028 | Yes | NOT_TESTED |
| 8 | GET | /api/v1/schools | `school_service.get_schools` | REQ-026, REQ-030 | Yes | NOT_TESTED |
| 9 | POST | /api/v1/schools | `school_service.create_school` | REQ-026, REQ-030 | Yes | NOT_TESTED |
| 10 | GET | /api/v1/schools/{id} | `school_service.get_school` | REQ-026, REQ-030 | Yes | NOT_TESTED |
| 11 | PUT | /api/v1/schools/{id} | `school_service.update_school` | REQ-026, REQ-030 | Yes | NOT_TESTED |
| 12 | DELETE | /api/v1/schools/{id} | `school_service.delete_school` | REQ-026, REQ-030 | Yes | NOT_TESTED |
| 13 | POST | /api/v1/students/{id}/recommendations | `matching_service.generate_recommendations` | REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040 | Yes | NOT_TESTED |
| 14 | GET | /api/v1/students/{id}/recommendations | `matching_service.get_recommendations` | REQ-020, REQ-027, REQ-034, REQ-037 | Yes | NOT_TESTED |
| 15 | POST | /api/v1/students/{id}/action-plan | `action_plan_service.generate_action_plan` | REQ-021, REQ-022, REQ-035, REQ-040 | Yes | NOT_TESTED |
| 16 | GET | /api/v1/students/{id}/action-plan | `action_plan_service.get_action_plan` | REQ-021, REQ-022, REQ-034, REQ-038 | Yes | NOT_TESTED |
| 17 | GET | /health | *(inline handler)* | — | No (Public) | NOT_TESTED |

---

## File Index

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, CORS middleware, router registration, /health |
| `app/core/config.py` | Pydantic BaseSettings loading env vars |
| `app/core/security.py` | bcrypt password hashing, JWT create/verify |
| `app/core/dependencies.py` | `get_current_user` FastAPI dependency |
| `app/db/session.py` | SQLAlchemy engine, SessionLocal, `get_db` dependency |
| `app/db/models.py` | SQLAlchemy ORM models (User, Student, School, Recommendation, ActionPlan) |
| `app/schemas/user.py` | UserCreate, UserResponse, Token, TokenData |
| `app/schemas/student.py` | StudentCreate, StudentUpdate, StudentResponse, StudentListItem |
| `app/schemas/school.py` | SchoolCreate, SchoolUpdate, SchoolResponse, SchoolListItem |
| `app/schemas/recommendation.py` | RecommendationResponse, RecommendationListResponse |
| `app/schemas/action_plan.py` | ActionPlanResponse, ActionPlanCreate |
| `app/services/auth_service.py` | authenticate_user, register_user, login_for_access_token |
| `app/services/student_service.py` | CRUD functions for student profiles |
| `app/services/school_service.py` | CRUD functions for school records |
| `app/services/matching_service.py` | Rule-based matching engine (filter→score→rank→persist) |
| `app/services/action_plan_service.py` | Action plan generation and retrieval |
| `app/api/v1/routes/auth.py` | POST /auth/register, POST /auth/login |
| `app/api/v1/routes/students.py` | Full CRUD for /students |
| `app/api/v1/routes/schools.py` | Full CRUD for /schools |
| `app/api/v1/routes/recommendations.py` | POST+GET /students/{id}/recommendations |
| `app/api/v1/routes/action_plan.py` | POST+GET /students/{id}/action-plan |
| `tests/conftest.py` | SQLite in-memory DB, get_db override, TestClient fixture |
| `tests/test_auth.py` | 5 auth tests (register, login, protected route) |

---

## Matching Engine Design (REQ-016 through REQ-019, REQ-008, REQ-007)

The matching engine in `matching_service.py` is fully modular and swappable:

1. **Filter** (`_passes_filter`): Removes schools where any required subject grade is not met. Missing subjects default to 0. Handles both numeric grades (int/float) and letter grades (A+, B, C-, etc.).

2. **Score** (`_score_school`): Three weighted components (fixed weights, REQ-018):
   - `grade_match_score` (40%): average of (student_grade / 100) per required subject
   - `interest_alignment_score` (30%): fraction of student interests matching school strengths (case-insensitive partial match)
   - `strengths_alignment_score` (30%): fraction of school strengths covered by student interests

3. **Rank**: Top 5 by total score descending (REQ-019).

4. **Persist**: Deletes existing recommendations for the student before inserting new ones (REQ-027).

5. **Score representation**: DB stores 0–100 (NUMERIC 5,2); API returns 0.0–1.0 (REQ-020, schema_spec note).

6. **Transparency** (REQ-009): `explanation` field enumerates all three factor scores and their weights in plain text; `gaps` field details grade deficits and unmatched strengths.
