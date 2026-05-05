# Skills File — System Architect
# Intelligent Academic Advisor Project
# Agent: System Architect
# Created: 2026-03-27
# Protocol: Append-only. Never delete entries. Add new sections at the bottom.

---

## Session 1 — v2 Architecture Design (2026-03-27)

### 1. Additive API Versioning: v2 Files Alongside v1

**Pattern: never modify existing versioned architecture files. Always create new ones.**

In this project, v1 API contracts live in `architecture/api_contracts.md`. When v2
requirements arrived, a new file `architecture/api_contracts_v2.md` was created.
Both files are valid simultaneously. The v1 file was never modified.

Rules to carry forward:
- Every architecture file that constitutes a "contract" (api_contracts, data_flow,
  environment_spec, system_overview) gets a v2 counterpart rather than being edited.
- Each v2 file opens with an explicit note: "Read this alongside api_contracts.md.
  Do not modify api_contracts.md."
- ADRs are never versioned — they are numbered sequentially. ADR-001 through ADR-004
  exist from v1. v2 ADRs start at ADR-005.
- This pattern allows any reader to reconstruct the system at any version by reading
  the appropriate set of files. It prevents accidental regression of v1 decisions.

**Practical rule:** Before editing any existing architecture file, ask: "Is this a
breaking change or an addition?" If it is an addition, create a v2 file. Only edit
an existing file if a v2 requirement explicitly supersedes a v1 decision (rare).

---

### 2. Async Endpoint Design: The Trigger + Poll Pattern

When an operation exceeds 500 ms, the HTTP endpoint must not block. The pattern is:

**Step 1 — Trigger endpoint (POST)**
- Accepts the request.
- Validates all preconditions synchronously (auth, ownership, data completeness).
- Creates a job/status record in the database with `status = "pending"`.
- Dispatches the background task (FastAPI BackgroundTasks for MVP;
  Celery for multi-process scale).
- Returns 202 Accepted with `{job_id, status: "pending", submitted_at}`.
- Must return in < 500 ms.

**Step 2 — Status endpoint (GET)**
- Simple primary key lookup on the job table.
- Returns `{status, submitted_at, completed_at, error_message}`.
- No computation. Always returns in < 50 ms.
- Frontend polls at 2-second intervals.

**Step 3 — Result endpoint (GET)**
- Called only after status == "complete".
- Returns the pre-computed result (html_content, parsed_data, etc.).
- No computation at read time. Always returns in < 500 ms.

**Key learnings:**
- Keep trigger, status, and result as three separate endpoints. Do not combine
  trigger and status — it couples async timing to API semantics.
- The job record in the database is the single source of truth for task status.
  Do not rely on in-memory state.
- Always handle the `"failed"` status explicitly in the frontend. Always set
  `error_message` in the job record on failure.
- Wrap the background task body in `asyncio.wait_for()` with a configurable
  timeout from environment variables. Never hard-code timeouts.
- FastAPI BackgroundTasks run in the same event loop as the API server. If the
  task does CPU-heavy work (e.g., large template rendering), consider
  `asyncio.get_event_loop().run_in_executor()` to avoid blocking the event loop.

**Upgrade path:** FastAPI BackgroundTasks → Celery. The migration requires only:
(1) replace `background_tasks.add_task(fn, args)` with `celery_task.delay(args)`,
(2) add a Celery worker and broker to Docker Compose. The job table schema and
all API contracts remain unchanged.

---

### 3. HKDSE Domain Knowledge — Relevant to API Design

**Grade scale:** 5**, 5*, 5, 4, 3, 2, 1, U, X
Numeric mapping: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0, X=0

**Key implication for API design:** `raw_grade` must be stored as a string, not an
integer. The string grade ("5**") is the canonical representation; the numeric
equivalent is derived on read. Never store "7" when the student's grade is "5**".

**Compulsory subjects (4):** Chinese Language (CHLA), English Language (ENGL),
Mathematics Compulsory Part (MATH), Liberal Studies / Citizenship and Social
Development (CSD). Any eligibility or aggregate calculation must verify these 4 are
present.

**Best-5 aggregate:** The standard HKDSE aggregate score is the best 5 subjects,
which must include the 4 compulsory subjects (or 3 of them in some programmes).
When computing eligibility against `minimum_entry_score`, use the best-5 aggregate.
When a school's `minimum_entry_score` is expressed as an aggregate, it refers to this
best-5 sum (maximum possible: 7×5 = 35, but practical range is 14–30 for competitive
universities).

**Applied Learning (ApL) subjects:** Graded as "Attained" or "Attained with
Distinction" only — not on the 5** scale. They do not contribute to the standard
aggregate. Store raw_grade as a string ("Attained" / "Attained with Distinction").
The category enum `APPLIED_LEARNING` distinguishes these in the subjects table.

**Multiple sittings:** A student may sit a subject more than once (Mock, Trial,
Official). Each sitting is a separate StudentSubjectGrade row with a `sitting` enum.
OFFICIAL grades are definitive and must never have a predicted_grade set.

**Sitting enum logic (predicted_grade):**
- `OFFICIAL` → predicted_grade is always null
- `MOCK` or `TRIAL` without teacher evaluation → use raw_grade as predicted_grade
- `MOCK` or `TRIAL` with teacher evaluation for the same subject →
  weighted_average(70% × latest_sitting_numeric, 30% × teacher_rating_mapped)

**Subject categories and codes:** When designing subject dropdowns, always filter
`subjects` by `grade_system_id` AND optionally by `category`. The UI should show
CORE subjects first (they are always required), then ELECTIVE, then OTHER_LANGUAGE,
then APPLIED_LEARNING. The `is_compulsory` flag on subjects is a faster filter
than relying on category alone for the 4 compulsory subjects.

**HKDSE vs other grade systems in the API:** Every `StudentSubjectGrade` references
a `Subject`, which in turn references a `GradeSystem`. The grade validation rules
depend on the grade system. When a student switches grade system in the UI, the
grade dropdown values change (e.g., IB uses 1–7 integers; A-Level uses A*,A,B,C,D,E).
The API does not validate `raw_grade` format against the grade system — this is a
frontend responsibility for MVP. The backend stores whatever string is supplied.

---

### 4. RBAC Design — Two-Role System

This project uses a simple two-role model (counsellor, admin) stored as a string
field on the account table. Key decisions:

- Roles are stored in the database, not only in the JWT. The JWT may contain the
  role as a claim (for performance), but the database value is the authoritative
  source. If a role changes, the next token refresh picks up the new value.
- The auth guard is a FastAPI dependency injected at the route level. Two guards:
  `require_authenticated` (any valid JWT) and `require_admin` (role == "admin").
- Counsellors can access ANY student profile (not just students they created).
  This is a v2 change from v1's ownership model. The v1 `user_id` FK on students
  remains (for data provenance), but the v2 access check is role-based, not
  ownership-based.
- Admin role is additive: admins can do everything counsellors can do, plus
  admin-only endpoints.

---

### 5. ML Module Boundary Design

When adding an ML module to an existing API, the cleanest pattern is:
- Define a pure function interface before writing any ML code:
  `score(student_features, school) -> MatchResult`
- Implement two versions: one with ML, one rule-only.
- Load the correct implementation at startup based on environment configuration.
- The rest of the codebase calls the interface; it cannot tell which version is
  running (except via the `ml_model_used` flag).

This allows:
- The ML model to be absent during development without breaking anything.
- The rule-only path to be tested independently of the ML model.
- Future model updates without changing the API contract.

**Feature vector discipline:** Define the feature vector schema explicitly as a
dataclass or TypedDict before training. The feature names in the vector must match
the SHAP plain-English template keys exactly. If a feature is renamed, both the
model must be retrained and the template updated. Document this dependency.

---

### 6. Data Agent as Offline Process — Why and How

The Data Agent is deliberately excluded from the live API container. This is not
just a deployment choice; it is an architectural boundary that prevents:
- Web scraping latency from affecting API response times.
- Unreliable external HTTP calls from causing API failures.
- Schema changes in scraped data sources from breaking the live system.

The boundary is enforced by: the Data Agent writes to files (JSON, SQL), not
directly to the database during scraping. Only when the data has been processed and
validated does it apply seed SQL to the database. The admin trigger endpoint is a
stub that logs the request; the actual run is a manual or scheduled operation.

This pattern works well for any "data enrichment" agent that pulls from external
sources. It separates concerns: the API serves data, the agent maintains data.

---

### 7. Encryption ADR — Lessons

When writing an encryption ADR:
- Lead with the threat model, not the technology options. Enumerate the threats
  (physical disk theft, credential compromise, insider access, backup exfiltration)
  before evaluating options. This makes the trade-off analysis concrete.
- FDE vs CLE is not a binary choice — they address different threats. FDE addresses
  physical/offline threats. CLE addresses credential-compromise threats. Document
  both as a stack, not as mutually exclusive.
- For MVP, defer CLE complexity. Document the migration path explicitly so the next
  architect can implement it without research: what column type changes, what new
  env vars, what ORM mixin pattern, what key rotation procedure.

---

### 8. Sub-Resource API Design (JSONB vs Structured Endpoints)

v1 stored `grades`, `interests`, `teacher_evaluation` as flat JSONB on the student
row. v2 introduces structured sub-resource endpoints for grades
(student_subject_grades table) while retaining JSONB for variable-length arrays
(teacher_evaluation, extra_curricular, awards) that don't need individual-row
operations.

The rule: use a structured table (and CRUD endpoints) when:
- Individual records need to be updated or deleted independently.
- Records have relationships to other entities (e.g., StudentSubjectGrade → Subject).
- Records need to be queried or filtered independently.

Use JSONB array (and array-level endpoints: GET/POST/DELETE on the whole array) when:
- Records are always read and written as a batch.
- No FK relationships to other entities.
- The array structure may evolve without schema migrations.

For JSONB array endpoints: use POST to append, DELETE to clear the whole array.
Individual-item operations within JSONB arrays are not exposed at the API level
(too complex for MVP). The frontend replaces the whole array if an individual item
needs to be edited.
