# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:**
- Backend: Pytest 8.2.0
- Config: `conftest.py` at `tests/conftest.py`
- Frontend: No test framework configured (no Jest, Vitest, or similar in `package.json`)

**Assertion Library:**
- Pytest built-in assertions (no additional assertion library)

**Run Commands:**
```bash
# Backend — from /backend directory
pytest                          # Run all tests
pytest -v                       # Run with verbose output
pytest tests/test_auth.py       # Run specific test file
pytest -k test_register         # Run tests matching pattern
```

Frontend has no test infrastructure configured.

## Test File Organization

**Backend Location:**
- Tests: `tests/` directory at root of `/backend` (sibling to `app/`)
- Naming: `test_*.py` pattern
- Files: `tests/conftest.py`, `tests/test_auth.py`, `tests/test_v2_services.py`, `tests/test_v2_routes.py`

**Structure:**
```
backend/
├── app/                        # Source code
├── tests/                      # Tests
│   ├── conftest.py            # Pytest fixtures and configuration
│   ├── test_auth.py           # Authentication endpoint tests
│   ├── test_v2_services.py    # Service layer unit tests
│   └── test_v2_routes.py      # API integration tests
└── requirements.txt           # Dependencies including pytest
```

**Frontend:**
- No test files present
- No test framework installed
- No test directory

## Test Structure

**Suite Organization (Backend):**
```python
class TestClassNameForFeature:
    def test_specific_behavior(self):
        """Docstring explaining what is tested."""
        # Arrange
        response = client.post(...)

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "..."
```

**Patterns:**
- Classes group related tests (e.g., `TestAccountEndpoints`, `TestGradeToInt`, `TestComputeBest5Aggregate`)
- Test functions: `test_` prefix followed by descriptive name
- Docstrings: Describe expected behavior and any requirements (e.g., `REQ-010, REQ-024`)
- Comments: Optional but used to explain non-obvious setup (e.g., fixture comments)

## Test Setup & Teardown

**conftest.py Structure (from `tests/conftest.py`):**

```python
# Environment variables set BEFORE any app imports
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("UPLOAD_DIR", "/tmp/test_advisor_uploads")
os.environ.setdefault("PLAN_GENERATION_TIMEOUT_SECONDS", "30")
```

**Database Setup:**
- In-memory SQLite (`sqlite:///:memory:`) for test isolation
- SQLite PRAGMA `foreign_keys=ON` enabled via event listener
- Alembic migrations: NOT used; tables created directly via `Base.metadata.create_all(bind=test_engine)`
- Scope: Session-level table creation (`@pytest.fixture(scope="session", autouse=True)`)

**Fixtures Provided:**

1. **`client` fixture:**
   - Yields `FastAPI.TestClient(app)` for HTTP testing
   - Provides `.get()`, `.post()`, `.patch()` methods
   - Returns response objects with `.status_code`, `.json()` methods

2. **`db` fixture:**
   - Yields SQLAlchemy `Session` for direct database access
   - Used when direct DB manipulation needed in tests
   - Automatically closed after test

3. **`auth_headers` fixture:**
   - Creates a test user via `User(email="test@example.com", password="testpassword123")`
   - Returns `{"Authorization": "Bearer <token>"}` dict for protected route testing
   - Overrides `get_current_user` dependency to return the test user directly
   - Workaround for SQLite UUID query issues in pytest

**Example from `conftest.py`:**
```python
@pytest.fixture
def auth_headers(client, db):
    """Register a user via the API, then override get_current_user..."""
    email = "test@example.com"
    password = "testpassword123"

    # Create user directly in DB
    user = User(
        id=_uuid.uuid4(),
        email=email,
        hashed_password=get_password_hash(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Override dependency
    def _override_get_current_user():
        return user
    app.dependency_overrides[get_current_user] = _override_get_current_user

    # Create real JWT
    token = create_access_token(data={"sub": str(user.id)})

    yield {"Authorization": f"Bearer {token}"}

    # Restore
    del app.dependency_overrides[get_current_user]
```

## Mocking

**Framework:** No mocking library installed; uses FastAPI dependency override pattern (`app.dependency_overrides`)

**Patterns:**
- Override dependencies via `app.dependency_overrides[dependency_function] = custom_implementation`
- Used to bypass `get_current_user` in protected route tests
- SQLite in-memory database serves as mock for real database

**What to Mock:**
- External HTTP calls (not currently tested — no mocking setup)
- Database queries (use in-memory SQLite instead)
- Authentication dependencies (override `get_current_user`)

**What NOT to Mock:**
- ORM models and database operations (use real in-memory SQLite)
- Pydantic schema validation (test as-is)
- Business logic in service functions (test with real data)

## Fixtures and Factories

**Test Data:**
- Inline data creation in tests
- Example from `test_auth.py`:
```python
def test_register_success(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "newuser@example.com", "password": "securepass1"},
    )
    assert response.status_code == 201
```

- Service-level helper: `_make_grade()` helper in `test_v2_services.py`:
```python
def _make_grade(self, code: str, numeric: int, is_compulsory: bool, category: str = "ELECTIVE") -> dict:
    return {
        "subject_code": code,
        "numeric_value": numeric,
        "is_compulsory": is_compulsory,
        "category": category,
    }
```

**Location:**
- No separate fixture files; fixtures defined in test classes as helper methods or in `conftest.py`
- Common fixtures in `conftest.py`: `client`, `db`, `auth_headers`

## Coverage

**Requirements:** No coverage enforcement configured or mentioned

**View Coverage:**
- Run pytest with coverage flag:
```bash
pip install pytest-cov
pytest --cov=app --cov-report=html
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and methods
- Example from `test_v2_services.py`: `TestGradeToInt` class tests `grade_to_int()` function in isolation
- Approach: Create test data, call function, assert output
- No external dependencies (or mocked)

```python
class TestGradeToInt:
    def test_all_grades(self):
        assert grade_to_int("5**") == 7
        assert grade_to_int("5*") == 6
        assert grade_to_int("U") == 0
```

**Integration Tests:**
- Scope: Full API endpoints with database
- Example from `test_v2_routes.py`: `TestAccountEndpoints` class tests account endpoints end-to-end
- Approach: Make HTTP request via `client`, verify response status and body
- Uses real in-memory SQLite database and real dependency injection

```python
def test_get_account_authenticated(self, client, auth_headers):
    resp = client.get("/api/v1/account", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data
```

**E2E Tests:**
- Not configured; frontend has no test infrastructure

## Common Patterns

**Async Testing:**
- Backend: FastAPI TestClient handles async routes automatically
- No explicit async/await in test code; TestClient is synchronous

**HTTP Testing (Backend):**
```python
# POST with JSON body
response = client.post(
    "/api/v1/auth/register",
    json={"email": "user@example.com", "password": "password123"}
)

# GET with headers
response = client.get("/api/v1/account", headers=auth_headers)

# PATCH with JSON body
response = client.patch(
    "/api/v1/account",
    json={"display_name": "Test Counsellor"},
    headers=auth_headers
)
```

**Error Testing:**
```python
def test_login_wrong_password(client):
    """Logging in with the wrong password returns 401 Unauthorized."""
    payload = {"email": "wrongpass@example.com", "password": "correctpass1"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpass@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect password" in response.json()["detail"]
```

**Status Code Assertions:**
- Specific assertions for expected codes: `201` (Created), `200` (OK), `401` (Unauthorized), `409` (Conflict), `422` (Unprocessable Entity)
- Some tests allow multiple codes when behavior varies: `assert resp.status_code in (401, 403)`

## Database Isolation

**Strategy:**
- Each test runs against fresh in-memory SQLite database
- Database state NOT reset between tests in same session (persistent within session)
- Session-level fixture creates tables once; tests share database
- Some tests may depend on prior test state (potential fragility)

**Cleanup:**
- No explicit rollback or cleanup in fixtures
- All data cleared when pytest session ends (in-memory DB destroyed)

## Test Data Organization

**Naming:**
- Test payloads named descriptively: `payload`, `json`, `response`
- Test assertions read naturally: `assert response.status_code == 201`

**Reuse:**
- Auth flow often repeated: register user, then login or use `auth_headers` fixture
- No factory pattern; direct object construction in tests

---

*Testing analysis: 2026-04-24*
