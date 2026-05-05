# INTEGRATION REPORT — v2.2 | Date: 2026-03-28

## Verdict: PASSED — 60/60 tests

---

## Test Results

| Version | Tests | Result |
|---------|-------|--------|
| v2.1    | 59    | PASSED |
| **v2.2**    | **60**    | **PASSED** |

**New test added (+1):** `test_login_email_not_found`

All 60 tests passed. No failures, no skips.

---

## Infrastructure Changes

Docker has been removed from the development workflow. The backend now runs via:

- **Application server:** `uvicorn` (direct invocation)
- **Database:** Homebrew PostgreSQL 15 (local service)

The `backend/data` directory is a symlink pointing to `../data` (project-root `data/`) so that seed files and processed data are accessible locally with the same relative paths that were previously used inside the container.

**Test runner invocation:**
```
DATABASE_URL=postgresql+psycopg2://... python3 -m pytest tests/ -q
```

---

## Features Implemented

All five features below were validated live against the running backend before this report was filed.

---

### 1. Login Error Differentiation

**Problem:** Previously, both "email not found" and "wrong password" scenarios returned a generic HTTP 401 with no distinction, making it impossible for the frontend to show actionable error messages.

**Solution:**
- `POST /api/v1/auth/login` now returns:
  - **HTTP 404** when no account exists for the submitted email. Response body: `"No account found with this email address. Please register."`
  - **HTTP 401** when the email exists but the password is incorrect. Response body: `"Incorrect password. Please try again."`
- Frontend catch block in the login flow distinguishes 404 vs 401 and renders the appropriate message in the UI.

**Test added:** `test_login_email_not_found` — submits a login request for an email that does not exist in the database and asserts HTTP 404.

---

### 2. Grade Save Fix — Subjects Seeded at Startup

**Problem:** The subjects table was empty on a fresh database, causing `POST /api/v1/students/{id}/grades` to return HTTP 422 because subject_name could not be resolved.

**Solution:**
- Backend seed routine runs at startup: if the subjects table contains 0 rows, 39 HKDSE subjects are inserted automatically.
- New endpoint `GET /api/v1/grades/subjects` returns the live subject list from the database (39 subjects). Frontend GradesTab fetches from this endpoint and falls back to a hardcoded list only if the request fails.
- Grade save now resolves `subject_name` against the seeded subjects table successfully.

**Subjects seeded:** 39 HKDSE subjects (compulsory core + electives).

---

### 3. Canonical Universities Restored

**Problem:** The schools table was empty on a fresh database, breaking school directory, recommendations, and matching.

**Solution:**
- Backend seed routine runs at startup: if the count of non-custom schools is 0, 10 canonical HK universities with 113 major programs are inserted automatically.
- Seed runs unconditionally on non-custom count = 0, so it is idempotent and safe to restart.

**Universities seeded (10):**
HKU, CUHK, HKUST, PolyU, CityU, HKBU, Lingnan, HKMU, HSUHK, EdUHK

**Major programs seeded:** 113 across all 10 institutions.

---

### 4. HKDSE Population Stats Endpoint

**Problem:** The DataAnalysis and SubjectDetail pages had no data to display when no student records existed in the database, because all analytics relied on student-owned grade rows.

**Solution:**
- New endpoint: `GET /api/v1/analytics/hkdse-population?subject_code=X`
  - Without `subject_code`: returns summary cards for all 33 subjects.
  - With `subject_code`: returns per-sitting data (grade distributions, mean, variance) for that subject.
- Data source: `data/processed/hkdse_subject_stats.json` — 33 subjects × 3 sitting years.
- **DataAnalysis page:** when no student data is present, subject cards are populated from the population endpoint.
- **SubjectDetail page:** population sittings are displayed with grade distribution bars, mean, and variance.

---

### 5. Recommendations by School+Major Pair

**Problem:** Auto-recommendations returned one result per school, making it impossible to distinguish which major at a school was recommended or to show JUPAS codes to the student.

**Solution:**
- `MatchResult` schema extended with two new fields: `major_name` (string) and `major_jupas_code` (string).
- `run_matching` now emits one `MatchResult` per eligible `(school, major)` pair rather than one per school.
- `GET /api/v1/students/{id}/recommendations/auto?limit=N` returns up to N `(school, major)` pairs, each with match score, major name, and JUPAS code.
- **TargetSchools add-school modal:** the "Recommended for this student" panel now shows major name + JUPAS code alongside each school recommendation.

---

## Bug Fixes

### SQL Splitter Rewrite

`_run_sql_file()` was rewritten with a proper SQL statement splitter (`_split_sql_statements()`) that tracks whether the parser is inside a single-quoted string literal. Previously, semicolons embedded in JSON string values (e.g., inside `notes` fields of `major_requirements` JSONB) caused the splitter to cut a single `INSERT` statement in half, producing a syntax error. This was the root cause of school seeding failures.

The new splitter advances character-by-character, toggles an `in_string` flag on unescaped single quotes, and only treats a semicolon as a statement boundary when `in_string` is false.

### Raw psycopg2 Cursor for Seed Execution

SQLAlchemy's `text()` mechanism interprets `:identifier` patterns inside SQL strings as named bind parameters. Seed SQL for school records contained JSON with colon-prefixed keys (e.g., `":value"`), which caused SQLAlchemy to raise `CompileError: bind parameter not found`. Fixed by obtaining a raw `psycopg2` cursor via `db.connection().connection.cursor()` for all seed SQL execution, bypassing SQLAlchemy's parameter interpolation entirely.

---

## Endpoints Validated

| Method | Path | Expected Result | Status |
|--------|------|-----------------|--------|
| POST | `/api/v1/auth/login` (unknown email) | HTTP 404 | PASS |
| POST | `/api/v1/auth/login` (wrong password) | HTTP 401 | PASS |
| GET | `/api/v1/grades/subjects` | 39 subjects | PASS |
| GET | `/api/v1/schools?page=1&page_size=10` | 10 canonical universities | PASS |
| GET | `/api/v1/analytics/hkdse-population?subject_code=ENGL` | 3 sittings | PASS |
| GET | `/api/v1/students/{id}/recommendations/auto?limit=5` | 5 (school, major) pairs with JUPAS codes | PASS |
| POST | `/api/v1/students/{id}/grades` (with subject_name) | Saves correctly | PASS |

---

## Process Note

Per standing pipeline requirement, all new features documented in this report were also documented by the responsible agent (Backend / Frontend / Data) in their respective manifests, and are recorded in `CHANGELOG.md` under `[2.2.0] — 2026-03-28`.
