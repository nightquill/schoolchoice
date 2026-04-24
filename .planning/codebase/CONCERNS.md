# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**Test Coverage Gaps in Backend (v1 Endpoints):**
- Issue: 14 of 17 v1 backend endpoints have no unit test coverage. Only auth endpoints (5/5) and v2 routes/services have comprehensive testing. v1 endpoints in `backend/app/api/v1/routes/action_plan.py`, `recommendations.py`, `schools.py` are untested at the unit level.
- Files: `backend/tests/test_auth.py` (5 tests), `backend/tests/test_v2_routes.py` (22 tests), `backend/tests/test_v2_services.py` (32 tests)
- Impact: v1 endpoints are covered only by E2E integration tests. Any regression in v1 endpoints would be discovered only at integration time, not caught during development. Incompatibilities between v1 and v2 data models have high risk of escape.
- Fix approach: Create `backend/tests/test_v1_routes.py` with unit test coverage for all v1 endpoints (action_plan CRUD, recommendations, school CRUD). Scope: test request/response shape, error cases, auth guards. Target: 40+ new tests to achieve >80% statement coverage on v1 routes.

**Frontend Component Size & Re-render Overhead:**
- Issue: StudentProfile.jsx is 1,450 lines with 46+ instances of `useEffect`/`useState`/`useCallback`. This is a monolithic component combining 7 tabs (personal, grades, language, evaluations, activities, notes, plans). The component likely re-renders excessively as state changes in unrelated tabs trigger full reconciliation.
- Files: `frontend/src/pages/StudentProfile/StudentProfile.jsx` (1,450 LOC)
- Impact: Slow response to user input, especially on low-end devices. Adding/removing a grade would re-render all 7 tabs and their child components. Performance degrades with deeper student profiles (many grades, evaluations, activities).
- Fix approach: Refactor StudentProfile into 7 independent sub-components (PersonalTab, GradesTab, etc.), each with its own local state. Extract tab navigation logic to a lightweight container. Estimated reduction: ~200 LOC per tab, ~1/7th re-render cost per tab change. Assign to Frontend Engineer in next phase.

**AcademicPlan Component Iframe Sandbox Restrictions:**
- Issue: AcademicPlan.jsx embeds plan HTML in an iframe with `sandbox="allow-same-origin allow-scripts"`. The `allow-scripts` was required to execute Chart.js code embedded in the plan HTML. This allows arbitrary script execution within the iframe context. If plan HTML content is ever user-generated or concatenated unsafely, XSS is possible.
- Files: `frontend/src/pages/AcademicPlan/AcademicPlan.jsx`; `backend/app/services/plan_generator.py` (generates HTML)
- Impact: Chart.js is currently the only script in plan HTML, controlled by backend. But if HTML ever includes dynamic user content (e.g., student notes, custom sections), those notes could contain malicious script payloads. XSS in iframe would allow exfiltration of plan data or session tokens.
- Fix approach: (1) Always escape user-provided content in plan HTML using `html.escape()` before embedding. (2) Validate that only approved, CSP-safe scripts (Chart.js CDN pinned by SRI hash) are loaded. (3) Remove `allow-scripts` if a non-script-executing alternative for charts can be used (e.g., SVG-only output). Current state is safe (no user input in HTML), but fragile.

**Missing Runtime Validations in Plan Generation:**
- Issue: `plan_generator.py` generates 1,300+ lines of HTML via Python f-strings. Templates are defined as dicts with CSS variables. If a school name or student name contains special HTML characters (e.g., "&", "<", ">"), they are not escaped when inserted into the HTML document. The `html.escape()` utility is imported but not consistently applied to all user-provided content.
- Files: `backend/app/services/plan_generator.py`
- Impact: If a school is named "Test & Co." or a student is named "O'Brien", the HTML might not render correctly or could break formatting. Low risk of XSS (schema validation enforces string types), but high risk of malformed HTML output.
- Fix approach: Add a pass at the end of `generate_html_plan()` that HTML-escapes all user-facing strings (school_name, student_name, action_item text, notes). Or refactor to use an HTML templating engine (e.g., Jinja2) that auto-escapes by default.

**Seed SQL Hardcoded in Python Startup Logic:**
- Issue: Seeding of subjects and schools is performed in `main.py` using raw SQL files (`data/seed_subjects.sql`, `data/seed_schools.sql`). If either file is deleted or the data directory is moved, the app fails at startup with a cryptic file-not-found error and no graceful fallback.
- Files: `backend/app/main.py` (lines 90–130), `data/seed/`
- Impact: Deployment to a new environment without copying the `data/` directory results in startup failure. Difficulty onboarding new developers or deploying to cloud platforms with strict file layouts. No clear error message guides the operator to the root cause.
- Fix approach: (1) Load seed SQL content from a Python module rather than files (embed as `""" ... """` strings in a `seeds.py` module). (2) Wrap seed execution in try/except with a clear log message: "Seed data not found; continuing with empty database." (3) Add a one-time admin endpoint to re-seed if needed. Estimated effort: 2 hours.

**Incomplete ORM Column Parity Between Models and Migrations:**
- Issue: v2 schema columns are added via `ALTER TABLE IF NOT EXISTS` migrations at startup, but the ORM models (`models.py`, `models_v2.py`) must be manually kept in sync. Previous versions had BUG-V2-010, BUG-V2-011, BUG-V2-012 where ORM models were missing columns that existed in the database, causing runtime errors (AttributeError when accessing missing columns).
- Files: `backend/app/db/models.py`, `backend/app/db/models_v2.py`, `database/migrations/versions/0002_v2_schema.py`
- Impact: Any new ALTER TABLE without corresponding ORM column declaration will cause 500 errors when that column is accessed at runtime. The gap is not caught until the code path is exercised.
- Fix approach: (1) Write a startup validation that queries `information_schema.columns` and compares against ORM `__table__.columns`. Log a warning if a database column is missing from the ORM. (2) Or, use Alembic for all schema changes (including runtime migrations) rather than raw ALTER TABLE, so ORM and schema are always generated together. Estimated effort: 4–6 hours.

## Known Bugs

**Plan History Chat Request Rate Limiting Edge Case:**
- Symptoms: Chat request count rate limit `chat_request_counts` is a JSON dict keyed by calendar date. If the time-zone logic differs between server and client, requests might exceed the 20/day limit unintentionally, or be rejected when they should succeed.
- Files: `backend/app/api/v1/routes/plan.py` (chat endpoint), `backend/app/services/plan_chat_service.py`
- Trigger: Plan chat on a student's plan near midnight UTC vs. local time in Hong Kong (UTC+8 or +9 depending on DST).
- Workaround: Use a `created_at` timestamp instead of just the date key; track total requests in the last 24 hours. Current implementation uses only `strftime("%Y-%m-%d")` which is UTC.
- Fix approach: Change rate limit tracking to use rolling 24-hour window with `datetime.now(timezone.utc)` instead of date strings. Estimated effort: 1–2 hours.

**Matchmaker Lenient Eligibility for Partial MOCK Grades:**
- Symptoms: Eligibility filter intentionally skips students with no grade for a required subject (lenient MOCK behavior, per test `test_no_grade_for_required_subject_is_not_failing`). A student with missing required subjects will pass eligibility and get a match score, even though they don't have enough evidence to be admitted.
- Files: `backend/app/services/matchmaker_v2.py` (lines 76–80), `backend/tests/test_v2_services.py` (test case `test_no_grade_for_required_subject_is_not_failing`)
- Impact: Students in MOCK sitting will receive "eligible" scores for schools they are actually ineligible for. Academic plans generated at this stage may suggest unachievable targets. This is a deliberate MOCK accommodation, not a bug, but it surprises counselors if not documented clearly.
- Fix approach: Add a prominent field `eligibility_confidence` (e.g., "official_grades", "trial_grades", "mock_grades") to each MatchResult. The frontend should display a disclaimer: "Eligibility based on mock grades — verify with official exam results." Estimated effort: 2–3 hours.

**School Name Duplication in Backend Responses:**
- Symptoms: `TargetResponse` schema includes `school_name` (added in BUG-V2-006), but the `school` object relationship is also present in some endpoints. Frontend receives both `school_name` (string) and `school` (full object), which is redundant and can cause confusion if they differ.
- Files: `backend/app/schemas/v2/targets.py`, `backend/app/api/v1/routes/targets.py`
- Impact: Frontend code must decide which `school_name` to use (the string or the object's name). If the school is updated after the target is created, the cached `school_name` string might become stale.
- Workaround: Frontend code uses `school_name` string; the full `school` object is ignored.
- Fix approach: Remove the `school_name` string field from `TargetResponse`. Require frontend to access `target.school.name` via the relationship. Or, if string duplication is intentional for API backward compatibility, document it explicitly. Estimated effort: 1 hour.

**Python 3.9 Compatibility Shims in 3.11 Environment:**
- Symptoms: Backend code uses `from __future__ import annotations` (PEP 563 / Python 3.9 compatibility) on all modules. Dockerfile uses `python:3.11-slim`. The shims are harmless on 3.11 (no-op), but they add cognitive overhead and suggest the code wasn't fully validated on the target runtime.
- Files: All `*.py` files have `from __future__ import annotations` at top
- Impact: Low risk. Compatibility is forward and backward. But if the project migrates to Python 3.9 in production (edge case), subtle incompatibilities might emerge.
- Fix approach: Run `pytest` suite inside the Docker container after build to validate 3.11 compatibility. Current setup relies on local development using Python 3.9. Estimated effort: 1 hour (mostly waiting for container build).

## Security Considerations

**CORS Configuration Hardcoded to Localhost:**
- Risk: `docker-compose.yml` sets `CORS_ORIGINS: http://localhost:5173`. Frontend build arg is `VITE_API_BASE_URL: http://localhost:8000`. In production, these should be parameterized with environment variables or secrets.
- Files: `docker-compose.yml`, `frontend/Dockerfile`, `backend/app/main.py`
- Current mitigation: Frontend is deployed alongside backend in the same container network, so `localhost` works. But if frontend and backend are ever deployed to different hosts (e.g., CDN vs. API), CORS will fail.
- Recommendations: (1) Add `FRONTEND_ORIGIN` and `API_BASE_URL` environment variables to `docker-compose.yml`. (2) Update `backend/app/main.py` to read CORS origins from `settings.CORS_ORIGINS` (environment variable). (3) Frontend Dockerfile should accept `VITE_API_BASE_URL` as build-time arg passed from `docker-compose.yml`. Current setup is safe for local dev but will require changes for production deployment.

**Incomplete Input Validation on Language Scores:**
- Risk: Student profile accepts `other_language_scores` as a free-form JSONB array. There is no validation of the structure (must have score, must be in range, must be for a valid language). A malformed entry could break the profile view or cause errors in downstream analyses.
- Files: `backend/app/schemas/student.py`, `frontend/src/pages/StudentProfile/StudentProfile.jsx`
- Current mitigation: Low risk in practice (only counselors can edit profiles), but if an API key is compromised or a junior counselor makes a typo, bad data persists.
- Recommendations: (1) Define a `LanguageScoreSchema` with fields `language: str`, `score: float`, `date: str` and enforce via Pydantic validation. (2) Add a max-items constraint to prevent accidental over-submission. (3) Test error case: POST invalid language score structure and confirm 422 rejection with clear error message.

**Unencrypted Secrets in .env Example Files:**
- Risk: `docker-compose.yml` has example values for `POSTGRES_PASSWORD` and `SECRET_KEY` that are not meant for production. If someone copies this file directly to production without changing the defaults, the system is vulnerable to credential exposure.
- Files: `docker-compose.yml`, `.gitignore` (should exclude `.env`)
- Current mitigation: Defaults are present in the YAML (e.g., `${POSTGRES_PASSWORD:-advisorsecret}`), which is acceptable for local dev. `.env` files are in `.gitignore`, so they won't be committed.
- Recommendations: (1) Add a `docker-compose.prod.yml` with explicit requirements (no defaults, all secrets sourced from environment). (2) Document in `DEPLOYMENT.md` that production must override all secrets via env vars.

## Performance Bottlenecks

**Plan Generation HTML Concatenation:**
- Problem: `plan_generator.py` builds a 1,300+ line HTML document via Python f-strings and string concatenation. No streaming or incremental rendering. The entire document is held in memory before being returned.
- Files: `backend/app/services/plan_generator.py`, `backend/app/api/v1/routes/plan.py`
- Cause: Straightforward implementation; no optimization attempted. For students with 50+ target schools, the HTML document could exceed 500KB.
- Improvement path: (1) Implement streaming response using `StreamingResponse` if the document exceeds 100KB. (2) Or, cache generated HTML and serve from a CDN if regeneration is expensive. (3) For now, monitor response times; if >1s, profile and optimize template rendering.

**N+1 Query in Student List (Partial Mitigation):**
- Problem: `list_students()` endpoint fetches all students, then queries AcademicPlan table to find which students have plans. If the query is not optimized, this becomes N queries (1 for students, N for each student's latest plan).
- Files: `backend/app/api/v1/routes/students.py` (lines 83–110)
- Cause: Current code uses `AcademicPlan.student_id.in_(student_ids)` which is a single query, so N+1 is avoided. But if code changes to `for student in students: get_latest_plan(student.id)`, the N+1 reappears.
- Improvement path: (1) Keep the current single-query approach for all student list endpoints. (2) Add a database index on `(student_id, generated_at)` to speed up plan lookups. (3) Test endpoint response time with 1,000+ students; if >500ms, add pagination.

**Transcript Upload Parsing (No Timeout):**
- Problem: Transcript upload triggers async parsing via OpenAI. If parsing stalls or OpenAI times out, the request hangs indefinitely. No timeout is set on the OpenAI call.
- Files: `backend/app/services/` (transcript parsing logic)
- Cause: Async task launched with `BackgroundTasks` but no timeout or error recovery.
- Improvement path: (1) Set a hard timeout of 30s on OpenAI calls. (2) Return a 503 Service Unavailable if OpenAI is unreachable. (3) Log all parsing errors and expose them via a `GET /students/{id}/transcripts/parse-status` endpoint so frontend can display progress and errors.

## Fragile Areas

**Matchmaker Hybrid Score Calculation (XGBoost + Weighted Scoring):**
- Files: `backend/app/services/matchmaker_v2.py`, `backend/app/services/matching_service.py`, `backend/app/services/hkdse_service.py`
- Why fragile: The final score combines (1) weighted hand-coded scores (academic_fit 50%, subject_alignment 20%, language_fit 15%, program_alignment 15%), (2) XGBoost ML probability, and (3) SHAP feature importance. If the ML model is retrained with different data, the scale/distribution of scores changes, but the weighted formula doesn't auto-calibrate.
- Safe modification: (1) Any change to the hand-coded scoring weights must be tested against a fixed test dataset to ensure rank order doesn't flip unexpectedly. (2) If the XGBoost model is retrained, re-validate the top 10 recommendations for 5+ representative students. (3) Add a `--explain-score` flag to CLI matching script to inspect individual scores and SHAP values for debugging.
- Test coverage: `test_basic_scoring` validates a single student–school pair. But no integration test validates that recommendations remain stable across model retraining.

**Plan Chat Service (Gemini Integration):**
- Files: `backend/app/services/plan_chat_service.py`, `backend/app/api/v1/routes/plan.py`
- Why fragile: Chat service sends the entire plan structure (recommended_schools, action_items, overrides) as context to Gemini 2.5 Flash. Gemini returns a JSON patch. If Gemini's output format changes or if a patch is invalid JSON, the patch-apply logic will fail silently or throw an error.
- Safe modification: (1) Always validate the returned JSON structure before applying. (2) Add unit tests that mock Gemini responses with valid and invalid patches. (3) Log the received patch for debugging; if a patch fails to apply, log the error and return HTTP 422 with details.
- Test coverage: `TestPlanChatEndpoints` has 2 tests (success case and rate limit). No test for invalid Gemini output or malformed patch.

**Student Profile Multi-Tab State Management:**
- Files: `frontend/src/pages/StudentProfile/StudentProfile.jsx`
- Why fragile: Component uses a single `student` state object that is mutated across 7 independent tabs. Tabs call various API functions (`updateProfile`, `createGrade`, `uploadTranscript`, etc.), each of which updates the parent `student` state. If one tab's save operation fails partway through, the state is left inconsistent (e.g., grade is saved to DB but not reflected in UI, or vice versa).
- Safe modification: (1) Refactor to use a state manager (Redux, Context) or local mutation with a clear commit/rollback pattern. (2) Each tab should have its own `isSaving` flag; do not allow overlapping saves. (3) Add error recovery: if a save fails, offer "retry" or "revert to last saved" options.
- Test coverage: No unit tests for StudentProfile. Manual testing is the only verification that state consistency holds across tab operations.

## Scaling Limits

**Database Connection Pool (Implicit Limit):**
- Current capacity: FastAPI uses SQLAlchemy with a default pool size. Exact limit is not documented in code.
- Files: `backend/app/db/session.py`
- Limit: With default pool size (~5 connections), a spike of >5 concurrent requests will queue or block. No documented backpressure or circuit breaker.
- Scaling path: (1) Explicitly configure `pool_size` and `max_overflow` in `Session` initialization. (2) Monitor pool exhaustion using Prometheus metrics. (3) If needed, migrate to a connection pooler like PgBouncer.

**Frontend Data Fetching (No Pagination on Large Lists):**
- Current capacity: StudentProfile loads all grades, all evaluations, all activities into memory. Dashboard loads all students and plans.
- Limit: With >500 students or >1,000 grades per student, the page becomes slow and memory-intensive.
- Scaling path: (1) Implement cursor-based pagination for StudentList and GradesList. (2) Lazy-load tabs: only fetch a tab's data when the tab is clicked. (3) Use React Query or Axios interceptors to cache and re-use data.

**Plan HTML Document Size (No Compression):**
- Current capacity: Plan HTML is generated as a full string and returned as `text/html`. No gzip or brotli compression applied.
- Limit: For a student with 50 schools and 20 charts, the HTML could be 1–2 MB, taking 5–10s to transfer on a 1 Mbps connection.
- Scaling path: (1) Enable gzip compression in FastAPI middleware. (2) Implement server-side caching of plan HTML (invalidate only when student data or schools change). (3) Allow frontend to request plan PDF instead of HTML (server-side HTML-to-PDF conversion).

## Dependencies at Risk

**XGBoost Model Fallback Assumption:**
- Risk: Matchmaker assumes XGBoost model is available at `data/models/match_model.joblib`. If the file is missing, the code falls back to hand-coded scoring. This fallback is silent; no warning is logged.
- Impact: If the model file is deleted or not deployed, recommendations will use only weighted scores, which may be less accurate. Counselors won't know the model is missing.
- Migration plan: (1) Log a warning at startup if model is missing. (2) Alternatively, embed a default/minimal model in the codebase and use that as fallback. (3) Add a `GET /api/v1/ml-status` endpoint that reports whether the ML model is available.

**Gemini API Key Optional (but not documented):**
- Risk: `plan_chat_service.py` returns HTTP 503 if `GEMINI_API_KEY` is not set. This is correct behavior, but it's not documented in the API spec. Frontend might not distinguish between a temporary service outage and a missing key.
- Migration plan: (1) Document in API spec that POST /chat returns 503 if Gemini is not configured. (2) Add a feature flag `chat_enabled` to the `/health` response. (3) Frontend should check `/health` before showing the Chat button.

**Chart.js CDN Dependency:**
- Risk: Plan HTML loads Chart.js from CDN (`https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js`). If the CDN is unreachable or the file is removed, charts won't render.
- Migration plan: (1) Bundle Chart.js in the Docker image or serve from a local static directory. (2) Use an SRI (Subresource Integrity) hash to verify the CDN file hasn't been tampered with. Current code does not validate the CDN source.

## Missing Critical Features

**Plan Export (No PDF or Docx Support):**
- Problem: Plans are generated as HTML and embedded in an iframe. There is no way to export to PDF, Word, or other formats. Counselors must use browser print-to-PDF or take screenshots.
- Blocks: Sharing academic plans with students via email, archiving in institutional records, compliance with document retention policies.
- Workaround: Students can manually print from browser, but formatting may be lossy.

**Bulk Student Import (No CSV Upload):**
- Problem: Students are created via the web UI one at a time. There is no bulk import from CSV or other data source. For organizations with 50+ students, this is tedious and error-prone.
- Blocks: Onboarding of large student cohorts, data migration from legacy systems.
- Workaround: Manual creation or API scripting by the organization's IT team.

**Role-Based Access Control (Limited Scope):**
- Problem: The system has a single "counselor" role. All counselors can see all students and all schools. There is no restriction by cohort, class, or organizational unit.
- Blocks: Multi-organizational deployments (e.g., a service provider supporting multiple schools), where each school's counselors should only see their own students.
- Workaround: Requires careful user management; if misdeployed, data leakage between organizations is possible.

## Test Coverage Gaps

**Frontend Components (No Unit Tests):**
- What's not tested: React components (StudentProfile, Dashboard, TargetSchools, etc.). No tests using React Testing Library or Vitest.
- Files: All files in `frontend/src/pages/` and `frontend/src/components/`
- Risk: Refactoring of component state or props could break the UI without detection. Regressions in form handling, error boundaries, loading states are not caught until manual testing.
- Priority: High
- Recommendation: Implement Vitest + React Testing Library setup. Target: 50+ component tests covering the 5 most-used pages (StudentProfile, Dashboard, TargetSchools, SchoolDirectory, AcademicPlan).

**v1 Endpoint Integration (No Unit Tests):**
- What's not tested: v1 routes (action_plan, recommendations, schools, students endpoints that don't have v2 equivalents). Only covered by E2E integration tests.
- Files: `backend/app/api/v1/routes/` (except auth)
- Risk: A breaking change to v1 endpoints could escape to production if E2E test skips that path.
- Priority: Medium
- Recommendation: Add 40+ unit tests to `backend/tests/test_v1_routes.py`, focusing on request validation, response shape, error cases.

**Matchmaker Edge Cases (Partial Coverage):**
- What's not tested: (1) Student with zero grades (should be rejected early). (2) School with no minimum_entry_score (should default to 0 or skip check). (3) Mixed OFFICIAL + MOCK grades in same student (which grades are used for eligibility?). (4) Duplicate targets for same school (should merge or error?).
- Files: `backend/tests/test_v2_services.py`, `backend/app/services/matchmaker_v2.py`
- Risk: Unexpected behavior when matching logic encounters unusual data states.
- Priority: Medium
- Recommendation: Add 10+ test cases covering these edge cases. Ensure eligibility filter documents its behavior clearly.

**Chat Service Gemini Integration (No Mocking):**
- What's not tested: Plan chat service assumes Gemini is always available and returns valid JSON. No tests for network errors, timeout, or invalid JSON response.
- Files: `backend/app/services/plan_chat_service.py`
- Risk: A Gemini outage will crash the chat endpoint with an unclear error message.
- Priority: Medium
- Recommendation: Mock Gemini API calls in tests. Add tests for 503, timeout, and JSON parsing errors.

---

*Concerns audit: 2026-04-24*
