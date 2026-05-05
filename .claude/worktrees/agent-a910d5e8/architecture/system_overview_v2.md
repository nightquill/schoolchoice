# System Overview — v2 Additions
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE
# Note: This file documents v2 changes to the system architecture. The v1 component
#       diagram and responsibility definitions in architecture/system_overview.md
#       remain valid. Read both documents together.

---

## REQ-IDs Covered

REQ-043, REQ-045, REQ-046, REQ-047, REQ-048, REQ-049, REQ-050, REQ-051, REQ-052

---

## 1. Updated Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER (Counsellor / Admin)                                           │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  React Frontend                                                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Pages: Login · Register · Dashboard · Student Profile           │   │
│  │         Target Schools · School Directory · School Profile       │   │
│  │         Academic Plan · Account Settings · Admin: Data Refresh   │   │
│  │  Async UI: polling loop for plan generation + transcript parse   │   │
│  │  All pages: WCAG AA · mobile-responsive (375px min viewport)     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS  JSON REST  JWT Bearer
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  APPLICATION SERVER                                                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  FastAPI Backend                                                 │   │
│  │                                                                  │   │
│  │  ┌─────────────────┐  ┌──────────────────────────────────────┐  │   │
│  │  │  Auth Module     │  │  RBAC Guard                          │  │   │
│  │  │  JWT issue/      │  │  role: counsellor | admin            │  │   │
│  │  │  verify          │  │  injected as FastAPI dependency      │  │   │
│  │  └─────────────────┘  └──────────────────────────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │  Student Module  │  │  School Module   │  │  Account Module  │  │   │
│  │  │  (expanded v2)   │  │  (expanded v2)   │  │  GET/PUT/DELETE  │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  ML Service Module                                        │    │   │
│  │  │  ─────────────────────────────────────────────────────   │    │   │
│  │  │  Input:  student feature vector                          │    │   │
│  │  │  Output: fit_score, ml_probability, shap_values dict     │    │   │
│  │  │                                                           │    │   │
│  │  │  Path A (model loaded):                                  │    │   │
│  │  │    eligibility_filter → weighted_scorer →                │    │   │
│  │  │    XGBoostClassifier → SHAP TreeExplainer →              │    │   │
│  │  │    preference_ranker                                      │    │   │
│  │  │                                                           │    │   │
│  │  │  Path B (no model — fallback):                           │    │   │
│  │  │    eligibility_filter → weighted_scorer →                │    │   │
│  │  │    preference_ranker                                      │    │   │
│  │  │    (shap_values = null)                                   │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐    │   │
│  │  │  Async Task Runner (in-process asyncio — not a service)  │    │   │
│  │  │  ─────────────────────────────────────────────────────   │    │   │
│  │  │  FastAPI BackgroundTasks                                  │    │   │
│  │  │                                                           │    │   │
│  │  │  Task A: Plan Generator                                  │    │   │
│  │  │    reads student + targets → Jinja2 HTML template →      │    │   │
│  │  │    AcademicPlan.html_content                             │    │   │
│  │  │    status tracked in: plan_generation_jobs table         │    │   │
│  │  │                                                           │    │   │
│  │  │  Task B: Transcript Parser                               │    │   │
│  │  │    reads file from UPLOAD_DIR → text extraction →        │    │   │
│  │  │    Transcript.parsed_data (suggestions only)             │    │   │
│  │  │    status tracked in: transcripts.parse_status field     │    │   │
│  │  └──────────────────────────────────────────────────────────┘    │   │
│  │                                                                  │   │
│  │  ┌─────────────────┐                                             │   │
│  │  │  Admin Module    │ POST /admin/data-refresh (stub MVP)        │   │
│  │  └─────────────────┘                                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌──────────────────────────┐                                           │
│  │  File Storage (Local)    │                                           │
│  │  ─────────────────────   │                                           │
│  │  UPLOAD_DIR volume       │                                           │
│  │  uploads/transcripts/    │                                           │
│  │  {student_id}/{file}     │                                           │
│  │                          │                                           │
│  │  ML model file           │                                           │
│  │  ML_MODEL_PATH           │                                           │
│  └──────────────────────────┘                                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ SQL (SQLAlchemy ORM)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DATA STORE                                                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL Database                                             │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  v1 tables: accounts · students · schools ·                     │   │
│  │             recommendations · action_plans                       │   │
│  │                                                                  │   │
│  │  v2 new tables: grade_systems · subjects ·                      │   │
│  │                 student_subject_grades · transcripts ·           │   │
│  │                 student_school_targets · academic_plans ·        │   │
│  │                 plan_generation_jobs                             │   │
│  │                                                                  │   │
│  │  Full-disk encryption at rest (see ADR-008)                     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  DATA AGENT (offline — NOT a live API service)                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Standalone Python script (runs out-of-process)                  │   │
│  │  ─────────────────────────────────────────────────────────────  │   │
│  │  Inputs: HKEAA published reports · JUPAS entry data ·           │   │
│  │          university admissions pages                             │   │
│  │                                                                  │   │
│  │  Outputs: data/raw/*.json · data/processed/*.json ·             │   │
│  │           data/seed/seed_schools.sql · seed_subjects.sql        │   │
│  │                                                                  │   │
│  │  Activation: manual run or triggered by admin (stub in MVP)     │   │
│  │  No inbound HTTP port. No shared memory with API process.       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                │                                                        │
│                │ Applies seed SQL (via migration or direct psql)        │
│                ▼                                                        │
│           PostgreSQL Database (same instance)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. New and Changed Component Responsibilities

### 2.1 React Frontend (v2 additions)

**New responsibilities:**
- Async polling loop: polls `/plan/status` and `/transcript` endpoints until
  status transitions to `complete` or `failed`. Recommended interval: 2 seconds.
- Plan render: displays `AcademicPlan.html_content` in an iframe or dedicated
  full-page route. Exposes a print button invoking the browser print dialog.
- SHAP display: renders `shap_explanation.top_features` as plain-English bullets
  on the Target Schools page and within the Plan view.
- Drag-to-reorder: Student Target Schools page supports drag-to-reorder with
  optimistic UI updates, persisted via POST /targets/reorder.
- WCAG AA: all components must meet WCAG AA contrast and keyboard navigation
  standards (REQ-051).
- Mobile-responsive: all pages usable at 375px viewport width (REQ-052).

**Boundary addition:** The frontend must never attempt to parse or interpret
`html_content` string contents. It renders the document opaquely in an iframe.

---

### 2.2 FastAPI Backend (v2 additions)

**New responsibilities:**

**RBAC enforcement (REQ-047, REQ-048):**
- All protected endpoints use an auth guard dependency that reads `account.role`
  from the JWT claims (or from the database if claims are not embedded).
- Admin-only endpoints (POST /schools, PUT /schools/{id}, POST /admin/data-refresh)
  return 403 if the caller's role is not `admin`.
- Counsellor-or-Admin endpoints accept either role; the role check is a single
  guard function injected as a FastAPI dependency.

**ML Service Module (REQ-046):**
- Loaded at startup if `ML_MODEL_PATH` is set and the file exists.
- Interface contract: `score(student_features: dict, school: SchoolRecord) ->
  MatchResult(fit_score, weighted_score, ml_probability, shap_top_features)`.
- Both scoring paths (ML and rule-only) implement this interface.
- The module is not a separate HTTP service; it is an internal Python module
  called synchronously within the match endpoint handler.

**Async Task Runner (REQ-049, ADR-005):**
- Not a separate process or service. Runs as FastAPI BackgroundTasks (in-process
  asyncio coroutines dispatched after the HTTP response is sent).
- Two task types: Plan Generator and Transcript Parser.
- Each task reads a timeout from the environment and wraps its work in
  `asyncio.wait_for()`.
- Status transitions are persisted to the database during task execution.

**HTML Plan Generator (ADR-007):**
- An internal module (not a service). Called by the Plan Generator background task.
- Uses Jinja2 to render the 7-section HTML document.
- Produces a self-contained HTML string: all CSS inline or embedded in `<style>`,
  `@media print` block included, no JavaScript, no external resource references.

**Performance SLA (REQ-049):**
- All read API endpoints must return in ≤ 500 ms under single-user local load.
- Match scoring (POST /match) is exempt if it exceeds 500 ms due to ML computation;
  it should be optimised to remain under 2 seconds.
- Plan generation and transcript parsing are exempt (background tasks).

---

### 2.3 PostgreSQL Database (v2 additions)

**New tables:**
- `grade_systems` — four-row reference table (HKDSE, A_LEVEL, IB, CUSTOM).
- `subjects` — HKDSE subject catalog seeded by Data Agent.
- `student_subject_grades` — structured grade records replacing v1 JSONB `grades`.
- `transcripts` — file metadata and parsed data.
- `student_school_targets` — student target list with match scores and SHAP data.
- `academic_plans` — replaces v1 `action_plans` for v2 full HTML plan.
- `plan_generation_jobs` — background task status tracking.

**Account table changes:**
- `role` column (string, enum-constrained, not null, default `counsellor`).
- `display_name`, `preferred_language`, `is_active` columns.

**Student table changes:**
- All fields defined in REQ-057 (see data_flow_v2.md §1.2).

**School table changes:**
- All fields defined in REQ-058 (see data_flow_v2.md §1.7).

**Encryption at rest (REQ-050, ADR-008):**
- Full-disk encryption on the PostgreSQL data volume (configured at infrastructure
  level; no schema changes required).
- Column-level encryption is documented as the future hardening path.

---

### 2.4 File Storage (new in v2)

**What it is:** A local directory on the application server, mounted as a Docker
named volume in Docker Compose. Configured via `UPLOAD_DIR` env var.

**What it stores:**
- Transcript files uploaded by counsellors (PDF and images).
- The trained XGBoost model file (if ML is active), located at `ML_MODEL_PATH`.

**What it is not:**
- Not a public static file server. Files in UPLOAD_DIR are never served directly
  by the web server.
- Not a remote object store (S3, GCS) in MVP. The architecture allows the backend
  to be refactored to write to a remote store in future by changing the storage
  adapter — the API contracts are unaffected.

**Access pattern:** The backend is the only process that reads or writes this
directory. Transcript files are read by the async parse task; model files are read
at startup only.

---

### 2.5 Data Agent (clarified in v2)

The Data Agent is an **offline, out-of-process script**. It is not:
- A running API service.
- A container in the normal application Docker Compose stack.
- Triggered in real time by API requests (the POST /admin/data-refresh endpoint
  is a stub in MVP that logs the request).

It is:
- A standalone Python script run manually or on a schedule (cron).
- Capable of connecting directly to the PostgreSQL database to apply seed data.
- The sole author of `grade_systems`, `subjects`, and `schools` seed data.

**Why offline (REQ-049, REQ-046):**
- Data gathering involves web scraping and large file processing. Running this
  within the live API process would violate the 500 ms SLA and introduce
  unreliable external HTTP dependencies into the API server.
- Keeping it offline preserves the "no external API calls from the live backend"
  constraint (REQ-023 from v1).

---

## 3. Connection Summary (v2)

| From | To | Protocol | Notes |
|------|----|----------|-------|
| Browser | FastAPI Backend | HTTPS JSON REST + JWT Bearer | Same as v1 |
| FastAPI Backend | PostgreSQL | SQL via SQLAlchemy ORM | Same as v1 |
| FastAPI Backend | UPLOAD_DIR | Local filesystem read/write | New in v2 |
| FastAPI Backend | ML_MODEL_PATH | Local filesystem read (startup) | New in v2; optional |
| Async Task (in-process) | PostgreSQL | SQL via SQLAlchemy ORM | Same connection pool |
| Async Task (in-process) | UPLOAD_DIR | Local filesystem read | Transcript parsing |
| Data Agent (offline) | PostgreSQL | SQL (direct connection) | Out-of-band; no HTTP |
| Data Agent (offline) | Internet | HTTP/HTTPS (scraping) | Offline only; never from live API process |

---

## 4. Non-Functional Requirements — Architecture Implementation

### 4.1 Performance SLA (REQ-049)

| Endpoint Category | SLA | Enforcement Mechanism |
|-------------------|-----|-----------------------|
| All read endpoints | ≤ 500 ms | Database indexes on foreign keys and frequent filter columns; ORM query review |
| POST /match | Target < 2 s | ML computation is synchronous but bounded; benchmarked at match module level |
| POST /plan (trigger) | ≤ 500 ms | Returns immediately with 202; generation is async |
| GET /plan/status (poll) | ≤ 500 ms | Simple primary key lookup on plan_generation_jobs |
| GET /plan | ≤ 500 ms | html_content is a pre-computed text field; no on-read computation |
| POST /transcript (upload) | ≤ 500 ms | File save is synchronous; parsing is async (202 response) |

### 4.2 WCAG AA (REQ-051)

Documented as a frontend constraint. The backend's contribution:
- All API responses include semantic field names suitable for aria-label mapping.
- `shap_explanation.top_features[].plain_text` is written as full sentences
  suitable for screen reader announcement.
- `eligibility_fail_reason` is a human-readable sentence, not a code.

### 4.3 Mobile-Responsive (REQ-052)

Documented as a frontend constraint. All 9 pages in the Pages list (preferences.md
§11) must be usable at 375 px viewport. The AcademicPlan HTML document template must
include mobile-responsive CSS (flexible grid, readable font sizes at narrow viewport).

---

## 5. v2 Requirement-to-Component Map (new requirements only)

| REQ-ID | Domain | Component | Summary |
|--------|--------|-----------|---------|
| REQ-043 | ARCH | ALL | Skills files maintained per agent |
| REQ-045 | ARCH | BACKEND+DB | GradeSystem, Subject entities; HKDSE full path |
| REQ-046 | ARCH | BACKEND | ML module boundary; swappable; rule fallback |
| REQ-047 | ARCH | BACKEND | Counsellor RBAC; role stored on account; guard dependency |
| REQ-048 | ARCH | BACKEND | Admin RBAC; admin-only route guard |
| REQ-049 | ARCH | BACKEND | 500 ms SLA; async exemptions; BackgroundTasks pattern |
| REQ-050 | ARCH | DATABASE | Full-disk encryption at rest (MVP); CLE future path |
| REQ-051 | ARCH | FRONTEND | WCAG AA on all UI components |
| REQ-052 | ARCH | FRONTEND | Mobile-responsive at 375 px viewport |
| REQ-053 | DATABASE | DATABASE | grade_systems table |
| REQ-054 | DATABASE | DATABASE | subjects table |
| REQ-055 | DATABASE | DATABASE | student_subject_grades table |
| REQ-056 | DATABASE | DATABASE | transcripts table |
| REQ-057 | DATABASE | DATABASE | students table expanded fields |
| REQ-058 | DATABASE | DATABASE | schools table expanded fields |
| REQ-059 | DATABASE | DATABASE | student_school_targets table |
| REQ-060 | DATABASE | DATABASE | academic_plans table (expanded) |
| REQ-061 | DATABASE | DATABASE | Schema rules: UUID PKs, timestamps, JSONB, nullable |
| REQ-062 | DATABASE | DATABASE | Relationship constraints enforced via FK |
| REQ-063 | BACKEND | BACKEND | HKDSE numeric grade mapping (5**=7 … U=0) |
| REQ-064 | BACKEND | BACKEND | 4 compulsory HKDSE subjects seeded |
| REQ-065 | BACKEND | BACKEND | Full HKDSE elective subject list seeded |
| REQ-066 | BACKEND | BACKEND | Predicted grade computation logic |
| REQ-067 | BACKEND | BACKEND | Transcript upload async parse; no auto-save |
| REQ-068 | BACKEND | BACKEND | CRUD endpoints for StudentSubjectGrade |
| REQ-069 | BACKEND | BACKEND | CRUD endpoints for StudentSchoolTarget |
| REQ-070 | BACKEND | BACKEND | School list with search/filter |
| REQ-071 | BACKEND | BACKEND | School full profile endpoint |
| REQ-072 | BACKEND | BACKEND | Eligibility filter hard rules |
| REQ-073 | BACKEND | BACKEND | Weighted scoring model (4 factors) |
| REQ-074 | ML | BACKEND | XGBoost classifier; admission probability |
| REQ-075 | ML | BACKEND | SHAP top-3 features per student–school pair |
| REQ-076 | BACKEND | BACKEND | Preference rank adjustment in matching |
| REQ-077 | BACKEND | BACKEND | 7-section HTML plan document generation |
| REQ-078 | BACKEND | BACKEND | Plan endpoints: trigger + poll + retrieve |
| REQ-079 | BACKEND | BACKEND | Account settings endpoints |
| REQ-080 | BACKEND | BACKEND | Admin data-refresh endpoint (stub) |
| REQ-081–REQ-087 | DATA | DATA AGENT | Data gathering; subject and school seed data |
| REQ-088–REQ-104 | FRONTEND/UI | FRONTEND | Pages, tabs, drag-reorder, async UI, plan render |
| REQ-105–REQ-108 | INTEGRATION | ALL | End-to-end async flows; performance validation |
