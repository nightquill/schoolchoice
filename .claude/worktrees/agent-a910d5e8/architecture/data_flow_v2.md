# Data Flow — v2 Additions
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE
# Note: This file documents NEW and CHANGED data flows only. All v1 flows in
#       architecture/data_flow.md remain valid. Read both documents together.

---

## 1. New and Expanded Entity Definitions

### 1.1 Account (replaces User — field additions)

The v1 `users` table is renamed/extended to `accounts` with the following new fields.
Existing fields (id, email, hashed_password, created_at, updated_at) are unchanged.

**REQ-IDs:** REQ-047, REQ-048, REQ-079

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| role | string | No | Enum: `counsellor`, `admin`. Default: `counsellor` |
| display_name | string | Yes | Editable display name; distinct from email |
| preferred_language | string | Yes | `en` or `zh-HK`; default `en` |
| is_active | boolean | No | `true` until soft-deleted. Default: `true` |

**Constraints:**
- `role` is checked on every protected request by the auth guard dependency.
- Soft-delete sets `is_active = false`; the row is retained for audit.

---

### 1.2 Student (expanded)

The v1 `students` table gains the following columns. The legacy `grades`,
`interests`, `strengths_weaknesses` JSONB columns remain for backward compatibility
but are superseded by the structured sub-entities below.

**REQ-IDs:** REQ-057, REQ-062

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| full_name | string | Yes | Replaces v1 `name` as the canonical full name |
| date_of_birth | date | Yes | PII — encrypted at rest (see ADR-008) |
| gender | string | Yes | Free text |
| address | text | Yes | PII — encrypted at rest |
| phone | string | Yes | PII — encrypted at rest |
| email | string | Yes | Student contact email; PII |
| class_name | string | Yes | E.g. `5A` |
| year_of_study | integer | Yes | Academic year |
| candidate_number | string | Yes | HKDSE candidate number |
| preferred_language | string | Yes | `en` or `zh-HK` |
| ielts_score | float | Yes | Overall IELTS band |
| ielts_listening | float | Yes | |
| ielts_reading | float | Yes | |
| ielts_writing | float | Yes | |
| ielts_speaking | float | Yes | |
| ielts_date | date | Yes | IELTS test date |
| other_language_scores | JSONB | Yes | `[{label, score, date}]` |
| teacher_evaluation | JSONB | Yes | `[{subject_code, teacher_name, rating, comment, date}]` |
| extra_curricular | JSONB | Yes | `[{activity, role, years, achievement}]` |
| awards | JSONB | Yes | `[{title, awarding_body, level, year}]` |
| financial_aid_flag | boolean | Yes | |
| notes | text | Yes | Counsellor free text |

---

### 1.3 GradeSystem

**REQ-IDs:** REQ-045, REQ-053

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| name | string | No | Enum: `HKDSE`, `A_LEVEL`, `IB`, `CUSTOM`; unique |
| description | text | Yes | |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

**Seed data:** Four rows inserted at migration time. HKDSE is the only fully
implemented path; A_LEVEL, IB, CUSTOM are structurally present.

---

### 1.4 Subject

**REQ-IDs:** REQ-045, REQ-054, REQ-064, REQ-065

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| grade_system_id | UUID | No | FK → grade_systems.id |
| name | string | No | Display name (e.g. `English Language`) |
| code | string | No | Subject code (e.g. `ENGL`); unique within grade system |
| category | string | No | Enum: `CORE`, `ELECTIVE`, `OTHER_LANGUAGE`, `APPLIED_LEARNING` |
| is_compulsory | boolean | No | Default `false`; `true` for the 4 HKDSE core subjects |
| hkdse_subject_code | string | Yes | Official HKDSE code; null for non-HKDSE subjects |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

**Constraints:**
- `(grade_system_id, code)` is unique.
- HKDSE compulsory subjects (CHLA, ENGL, MATH, CSD) are seeded by the Data Agent
  (REQ-064). The full HKDSE elective list is also seeded (REQ-065).

---

### 1.5 StudentSubjectGrade

**REQ-IDs:** REQ-055, REQ-062

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| student_id | UUID | No | FK → students.id; cascade delete |
| subject_id | UUID | No | FK → subjects.id |
| year_of_exam | integer | Yes | |
| sitting | string | No | Enum: `MOCK`, `TRIAL`, `OFFICIAL` |
| raw_grade | string | No | Grade string (e.g. `5**`, `4`, `A`) |
| predicted_grade | string | Yes | Computed by backend; never set for OFFICIAL sitting |
| transcript_uploaded | boolean | No | Default `false` |
| transcript_file_path | string | Yes | Internal path; not a public URL |
| notes | text | Yes | |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

**Predicted grade rule (REQ-066):**
- If `sitting == OFFICIAL`: `predicted_grade` is always null.
- If `sitting != OFFICIAL` and only one non-official sitting exists: use `raw_grade`
  as predicted.
- If multiple mock/trial sittings exist: use the most recent `raw_grade`.
- If `teacher_evaluation` for the subject's code is present: apply weighted average:
  70% × latest sitting numeric equivalent + 30% × teacher rating mapped to HKDSE
  scale.

---

### 1.6 Transcript

**REQ-IDs:** REQ-056, REQ-062

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| student_id | UUID | No | FK → students.id; cascade delete |
| file_path | string | No | Path relative to UPLOAD_DIR |
| uploaded_at | timestamp with timezone | No | Set at INSERT |
| parse_status | string | No | Enum: `pending`, `running`, `complete`, `failed`; default `pending` |
| parsed_data | JSONB | Yes | Populated when parse_status = `complete` |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

**parsed_data structure:**
```
{
  "suggested_grades": [
    {"subject_name": "English Language", "raw_grade": "5*"},
    ...
  ],
  "parser_confidence": 0.87,
  "raw_text_excerpt": "..."
}
```

**Constraint:** Parsed data is never automatically written to StudentSubjectGrade.
It is presented to the user as suggestions only (REQ-067).

---

### 1.7 School (expanded)

**REQ-IDs:** REQ-058, REQ-062

The v1 `schools` table is extended. Existing columns remain. New columns:

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| name_zh | string | Yes | Chinese name |
| type | string | Yes | Enum: `UNIVERSITY`, `POLYTECHNIC`, `COMMUNITY_COLLEGE`, `VOCATIONAL` |
| website | string | Yes | |
| description | text | Yes | |
| minimum_entry_score | integer | Yes | HKDSE best-5 aggregate threshold |
| required_subjects | JSONB | Yes | `[{subject_code, min_grade}]` |
| language_requirements | JSONB | Yes | E.g. `{ielts_minimum: 6.5}` |
| faculties | JSONB | Yes | Array of faculty name strings |
| notable_programs | JSONB | Yes | Array of program description strings |
| acceptance_rate | float | Yes | 0.0–1.0 |
| average_admitted_score | float | Yes | JUPAS median admitted score |
| scholarship_available | boolean | Yes | Default `false` |
| data_source | string | Yes | Source URL or reference |
| data_last_updated | date | Yes | |

---

### 1.8 StudentSchoolTarget

**REQ-IDs:** REQ-059, REQ-062

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| student_id | UUID | No | FK → students.id; cascade delete |
| school_id | UUID | No | FK → schools.id |
| student_rank | integer | Yes | Student preference order; unique per student |
| match_score | float | Yes | Combined fit score (0.0–1.0); null before first match run |
| eligibility_pass | boolean | Yes | null before first match run |
| eligibility_fail_reason | string | Yes | Specific failing criterion |
| shap_explanation | JSONB | Yes | `{top_features: [{feature, value, direction, plain_text}]}` |
| status | string | No | Enum: `CONSIDERING`, `APPLIED`, `ADMITTED`, `REJECTED`, `WITHDRAWN`; default `CONSIDERING` |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

**Constraint:** `(student_id, school_id)` is unique (no duplicate school in a target list).

---

### 1.9 AcademicPlan (expanded)

**REQ-IDs:** REQ-060, REQ-062

Replaces the v1 `action_plans` table for v2. The v1 structure is preserved as a
migration starting point.

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key |
| student_id | UUID | No | FK → students.id; unique (one plan per student) |
| generated_at | timestamp with timezone | No | Set when generation completes |
| version | integer | No | Starts at 1; incremented on regeneration |
| recommended_schools | JSONB | Yes | Ordered list: `[{school_id, school_name, rationale}]` |
| action_items | JSONB | Yes | `[{task, deadline, related_school_id, priority}]` |
| html_content | text | Yes | Full rendered HTML document; null until complete |
| created_at | timestamp with timezone | No | |
| updated_at | timestamp with timezone | No | |

---

### 1.10 PlanGenerationJob

An in-process job tracking table for the async plan generation pattern (see ADR-005).

**REQ-IDs:** REQ-049, REQ-078

| Field | Type | Nullable | Notes |
|-------|------|----------|-------|
| id | UUID | No | Primary key; used as `job_id` in API responses |
| student_id | UUID | No | FK → students.id; cascade delete |
| status | string | No | Enum: `pending`, `running`, `complete`, `failed` |
| submitted_at | timestamp with timezone | No | |
| completed_at | timestamp with timezone | Yes | Set on completion or failure |
| error_message | text | Yes | Set on failure |
| created_at | timestamp with timezone | No | |

---

## 2. Updated Entity Relationships

```
accounts (1) ────────────── (many) students
students (1) ────────────── (many) student_subject_grades
students (1) ────────────── (many) transcripts
students (1) ────────────── (many) student_school_targets
students (1) ────────────── (0 or 1) academic_plans
students (1) ────────────── (many) plan_generation_jobs

grade_systems (1) ─────────── (many) subjects
subjects (1) ──────────────── (many) student_subject_grades

schools (1) ───────────────── (many) student_school_targets

(v1 — retained)
students (1) ────────────── (many) recommendations
students (1) ────────────── (0 or 1) action_plans [v1 — superseded by academic_plans in v2]
```

---

## 3. Data Flows — New and Changed

### 3.1 Grade Data Entry Flow

```
FRONTEND                    BACKEND                     DATABASE
  │                            │                            │
  │ POST /students/{id}/grades  │                            │
  │ {subject_id, sitting,       │                            │
  │  year_of_exam, raw_grade} ─►│                            │
  │                            │ Validate JWT, ownership     │
  │                            │ SELECT subject → grade_sys ►│
  │                            │◄─────── subject row         │
  │                            │ Validate raw_grade format   │
  │                            │ Compute predicted_grade     │
  │                            │ (if sitting != OFFICIAL)    │
  │                            │ INSERT student_subject_     │
  │                            │ grades ───────────────────►│
  │                            │◄─────── grade row           │
  │◄── 201 {grade} ────────────│                            │
```

**Predicted grade computation** runs in the backend service layer, not in SQL.
The backend reads the student's full grade and evaluation data, applies the
REQ-066 weighting formula, and writes the result to `predicted_grade`.

---

### 3.2 Transcript Upload and Async Parse Flow

```
FRONTEND              BACKEND                              DATABASE
  │                      │                                    │
  │ POST /transcript      │                                    │
  │ (multipart file) ────►│                                    │
  │                      │ Validate file type/size             │
  │                      │ Save file to UPLOAD_DIR             │
  │                      │ INSERT transcripts                  │
  │                      │ (parse_status="pending") ─────────►│
  │                      │◄──────── transcript row             │
  │                      │ Enqueue background parse task       │
  │◄── 202 {job_id} ─────│                                    │
  │                      │                                    │
  │   [background task — asyncio]                             │
  │                      │ UPDATE transcripts                  │
  │                      │ SET parse_status="running" ───────►│
  │                      │ Parse file (text extraction)        │
  │                      │ UPDATE transcripts                  │
  │                      │ SET parse_status="complete"         │
  │                      │ parsed_data={suggested_grades} ───►│
  │                      │                                    │
  │                      │  ─ ─ ─ ─ OR ON FAILURE ─ ─ ─ ─ ─ │
  │                      │ UPDATE transcripts                  │
  │                      │ SET parse_status="failed" ────────►│
  │                      │                                    │
  │ GET /transcript ─────►│                                    │
  │                      │ SELECT transcripts ───────────────►│
  │                      │◄──────── transcript row             │
  │◄── 200 {                │                                  │
  │  parse_status,          │                                  │
  │  parsed_data}           │                                  │
```

**Key constraint (REQ-067):** `parsed_data.suggested_grades` is NEVER automatically
written to `student_subject_grades`. The frontend presents suggestions; the user
accepts or discards each individually before a POST /grades is issued.

---

### 3.3 Matchmaking Data Flow

```
FRONTEND              BACKEND                              DATABASE
  │                      │                                    │
  │ POST /students/{id}/  │                                    │
  │  match ──────────────►│                                    │
  │                      │ SELECT students (full profile) ───►│
  │                      │◄──────── student row                │
  │                      │ SELECT student_subject_grades ────►│
  │                      │◄──────── [grade rows]               │
  │                      │ SELECT schools ───────────────────►│
  │                      │◄──────── [school rows]              │
  │                      │                                    │
  │                      │ ┌──────────────────────────────┐   │
  │                      │ │ ML Service Module            │   │
  │                      │ │                              │   │
  │                      │ │ 1. ELIGIBILITY FILTER        │   │
  │                      │ │    For each school:          │   │
  │                      │ │    • best-5 aggregate ≥ min? │   │
  │                      │ │    • required subjects met?  │   │
  │                      │ │    • IELTS ≥ requirement?    │   │
  │                      │ │    → eligibility_pass + reason│   │
  │                      │ │                              │   │
  │                      │ │ 2. WEIGHTED SCORING          │   │
  │                      │ │    academic fit 50%          │   │
  │                      │ │    subject alignment 20%     │   │
  │                      │ │    language fit 15%          │   │
  │                      │ │    program alignment 15%     │   │
  │                      │ │    → weighted_score          │   │
  │                      │ │                              │   │
  │                      │ │ 3. ML SCORING (if trained)   │   │
  │                      │ │    XGBoost predict_proba()   │   │
  │                      │ │    → ml_probability          │   │
  │                      │ │    SHAP explainer.shap_values│   │
  │                      │ │    → shap_values dict        │   │
  │                      │ │    final = 0.6×weighted      │   │
  │                      │ │          + 0.4×ml_prob       │   │
  │                      │ │                              │   │
  │                      │ │ 4. PREFERENCE RANKING        │   │
  │                      │ │    Apply student_rank boost  │   │
  │                      │ │    → display_rank            │   │
  │                      │ └──────────────────────────────┘   │
  │                      │                                    │
  │                      │ UPSERT student_school_targets ────►│
  │                      │ (match_score, eligibility_pass,    │
  │                      │  shap_explanation per school)       │
  │                      │◄──────── updated rows               │
  │◄── 200 {results} ────│                                    │
```

**ML Model Fallback (REQ-046):** If `ML_MODEL_PATH` is unset or the model file does
not exist, `ml_probability` is null for all schools and `weighted_score` is used
directly as `fit_score`. The module interface is identical in both paths; the caller
cannot distinguish which path ran except via the `ml_model_used` flag in the response.

**SHAP values (REQ-075):** Computed for every student–school pair when the ML model
is active. The top 3 features by absolute SHAP value are extracted, mapped to a
plain-English sentence, and stored in `StudentSchoolTarget.shap_explanation`.

---

### 3.4 Async Plan Generation Flow

See ADR-005 for the justification of the async pattern.

```
FRONTEND              BACKEND                              DATABASE
  │                      │                                    │
  │ POST /students/{id}/  │                                    │
  │  plan ───────────────►│                                    │
  │                      │ Validate JWT, ownership             │
  │                      │ INSERT plan_generation_jobs         │
  │                      │ (status="pending") ───────────────►│
  │                      │◄──────── job row                    │
  │                      │ Dispatch background task            │
  │◄── 202 {job_id} ─────│                                    │
  │                      │                                    │
  │ [Frontend polls]      │ [Background task — asyncio]        │
  │ GET /plan/status?      │                                    │
  │  job_id=X ───────────►│ SELECT plan_gen_jobs ────────────►│
  │◄── 200 {status:        │◄──────── job row                  │
  │  "pending"} ──────────│                                    │
  │                      │                                    │
  │   [background task continues]                             │
  │                      │ UPDATE plan_gen_jobs                │
  │                      │ SET status="running" ─────────────►│
  │                      │ SELECT student (full) ────────────►│
  │                      │ SELECT student_subject_grades ────►│
  │                      │ SELECT student_school_targets ────►│
  │                      │                                    │
  │                      │ ┌──────────────────────────────┐   │
  │                      │ │ Plan Generator Module         │   │
  │                      │ │ Build 7-section HTML document │   │
  │                      │ │ (inline CSS, @media print,    │   │
  │                      │ │  no JavaScript)               │   │
  │                      │ └──────────────────────────────┘   │
  │                      │                                    │
  │                      │ UPSERT academic_plans              │
  │                      │ (html_content, version++) ────────►│
  │                      │ UPDATE plan_gen_jobs               │
  │                      │ SET status="complete" ─────────────►│
  │                      │◄──────── updated rows               │
  │                      │                                    │
  │ GET /plan/status ─────►│ SELECT plan_gen_jobs ────────────►│
  │◄── 200 {status:        │◄──────── job row                  │
  │  "complete"} ──────────│                                   │
  │                      │                                    │
  │ GET /students/{id}/   │                                    │
  │  plan ───────────────►│ SELECT academic_plans ────────────►│
  │                      │◄──────── plan row                   │
  │◄── 200 {html_content} │                                    │
```

**Timeout (REQ-049):** If the background task does not complete within
`PLAN_GENERATION_TIMEOUT_SECONDS`, it is marked `failed` with an appropriate
error message.

---

### 3.5 Data Agent (Offline) Flow

The Data Agent is an out-of-process script; it does not run as part of the live
API service. This is a deliberate architectural boundary (see system_overview_v2.md).

```
DATA AGENT (offline process)       DATABASE
  │                                   │
  │ Fetch HKEAA / JUPAS sources        │
  │ Write data/raw/<source>.json       │
  │ Process → data/processed/          │
  │ Generate data/seed/seed_*.sql      │
  │                                   │
  │ [When admin triggers via API]      │
  │ POST /api/v1/admin/data-refresh    │
  │ → Backend logs trigger in DB ────►│
  │ → Out-of-band: agent runs          │
  │                                   │
  │ UPSERT grade_systems ────────────►│
  │ UPSERT subjects ─────────────────►│
  │ UPSERT schools ──────────────────►│
```

The Data Agent writes SQL seed files; these are applied via database migration or
manual seeding. The admin trigger endpoint (POST /api/v1/admin/data-refresh) is a
stub in MVP that records the request; actual re-seeding is a manual operation.

---

## 4. Data That Crosses Component Boundaries (v2 additions)

### What the Frontend sends to the Backend (new in v2):
- Student profile sub-resource payloads (grades, language scores, evaluations,
  extracurricular, awards).
- `multipart/form-data` for transcript file upload.
- Target school management: school_id, student_rank, status.
- Match trigger (empty POST body).
- Plan generation trigger (empty POST body).
- Account settings updates (display_name, preferred_language).
- Password change form (current + new + confirm).

### What the Backend returns to the Frontend (new in v2):
- GradeSystem and Subject catalog data (for dropdowns).
- StudentSubjectGrade records including computed `predicted_grade`.
- Transcript record with `parse_status` and `parsed_data.suggested_grades`.
- School full profile (expanded fields).
- StudentSchoolTarget records with `match_score`, `eligibility_pass`,
  `shap_explanation.top_features` as plain-English summaries.
- Match results with per-school eligibility detail and SHAP features.
- `job_id` and status for async operations (transcript parse, plan generation).
- AcademicPlan including `html_content` (full HTML document as a string).
- Account profile.

### What never crosses component boundaries (updated):
- `hashed_password` — same rule as v1.
- Raw SHAP value arrays — only the top 3 plain-English summaries are sent to the
  frontend; full `shap_values` arrays stay in the database JSONB field.
- `ML_MODEL_PATH` — backend env var only; never exposed via API.
- `UPLOAD_DIR` file paths — internal storage paths; the API returns logical IDs,
  not raw file system paths as navigable URLs.
- PII fields (date_of_birth, address, phone) — returned in API responses to
  authenticated counsellors only; never included in public responses.
