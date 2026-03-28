# API Contracts — v2 Additions
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE
# Note: This file defines NEW endpoints only. All v1 endpoints remain unchanged in
#       architecture/api_contracts.md. Do not modify api_contracts.md.

---

## Conventions (inherited from v1)

- All paths are prefixed `/api/v1/` (see ADR-004).
- All request and response bodies are `application/json` unless noted otherwise.
- Dates and timestamps use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`.
- UUIDs are lowercase hyphenated strings (see ADR-003).
- **Protected** endpoints require the `Authorization: Bearer <token>` header.
- **Admin-only** endpoints require Protected auth AND `account.role == "admin"`.
  Failure returns `403 Forbidden`.
- **Counsellor-or-Admin** endpoints accept either role; see REQ-047 and REQ-048.
- Field notation: `field_name: Type [required|optional]`
- JSONB fields are represented as JSON objects or arrays in the request/response body.

---

## RBAC Summary

| Role | Description | Stored As |
|------|-------------|-----------|
| counsellor | Default role. Views and edits any student profile, generates plans, sees all students. | `account.role = "counsellor"` |
| admin | All counsellor permissions plus admin-only endpoints (data refresh). | `account.role = "admin"` |

Role is stored on the `account` table as the `role` field (string enum). The backend
enforces role checks on protected routes via a dependency-injected auth guard.
REQ-IDs: REQ-047, REQ-048.

---

## Grade Systems & Subjects

### GET /api/v1/grade-systems

**REQ-IDs:** REQ-045, REQ-053

**Auth:** Protected (Counsellor or Admin)

**Purpose:** List all grade systems supported by the platform. Used to populate the
grade system selector on the Student Profile page.

**Query Parameters:** None.

**Response — 200 OK:**

JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Grade system ID |
| name | string | Enum: `HKDSE`, `A_LEVEL`, `IB`, `CUSTOM` |
| description | string | Human-readable description |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |

---

### GET /api/v1/subjects

**REQ-IDs:** REQ-045, REQ-054, REQ-064, REQ-065

**Auth:** Protected (Counsellor or Admin)

**Purpose:** List subjects, optionally filtered by grade system. Used to populate
subject dropdowns in the grade entry table.

**Query Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| grade_system_id | string (UUID) | optional | If omitted, returns subjects for all grade systems. |

**Response — 200 OK:**

JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Subject ID |
| grade_system_id | string (UUID) | FK to GradeSystem |
| name | string | Subject display name |
| code | string | Subject code (e.g. `ENGL`, `MATH`, `BIOL`) |
| category | string | Enum: `CORE`, `ELECTIVE`, `OTHER_LANGUAGE`, `APPLIED_LEARNING` |
| is_compulsory | boolean | `true` for the 4 HKDSE compulsory subjects |
| hkdse_subject_code | string or null | Official HKDSE code; null for non-HKDSE subjects |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 404 | Supplied `grade_system_id` does not match any GradeSystem |

---

## Student — Expanded Profile

### PUT /api/v1/students/{id}/profile

**REQ-IDs:** REQ-057, REQ-079 (partial), REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Update the expanded personal and academic fields on a student profile.
This endpoint updates non-grade fields only. Grade records are managed via
`/students/{id}/grades`. All body fields are optional; only supplied fields are updated
(partial update semantics even though the method is PUT, as the full profile is large
and split across sub-resources).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body (all fields optional):**

| Field | Type | Notes |
|-------|------|-------|
| full_name | string | Student legal full name |
| date_of_birth | string (ISO 8601 date) | `YYYY-MM-DD` |
| gender | string | Free text; no enum enforced |
| address | string | Residential address |
| phone | string | Contact phone number |
| email | string | Student email (distinct from account email) |
| class_name | string | E.g. `5A`, `Form 6B` |
| year_of_study | integer | Academic year (e.g. `2026`) |
| candidate_number | string | HKDSE candidate number; nullable |
| financial_aid_flag | boolean | Whether student is on financial aid |
| notes | string | Counsellor free-text notes |
| preferred_language | string | `en` or `zh-HK` |

**Response — 200 OK:** Full updated student object. All fields from the student entity
(expanded schema per REQ-057), excluding hashed credentials.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error (e.g., invalid date format) |

---

## Student — Grades (StudentSubjectGrade)

### GET /api/v1/students/{id}/grades

**REQ-IDs:** REQ-055, REQ-068, REQ-090

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve all StudentSubjectGrade records for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Grade record ID |
| student_id | string (UUID) | |
| subject_id | string (UUID) | FK to Subject |
| subject_name | string | Denormalized for display |
| subject_code | string | Denormalized for display |
| year_of_exam | integer | Exam year |
| sitting | string | Enum: `MOCK`, `TRIAL`, `OFFICIAL` |
| raw_grade | string | E.g. `5**`, `4`, `A` |
| predicted_grade | string or null | Computed by backend per REQ-066; never overwrites OFFICIAL grades |
| transcript_uploaded | boolean | Whether a transcript file backs this grade |
| transcript_file_path | string or null | Internal storage path; not a public URL |
| notes | string | |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/grades

**REQ-IDs:** REQ-055, REQ-068, REQ-090

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Create a new grade record for a student. Multiple sittings for the same
subject are permitted; each is a distinct row.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| subject_id | string (UUID) | required | Must reference an existing Subject |
| year_of_exam | integer | required | |
| sitting | string | required | `MOCK`, `TRIAL`, or `OFFICIAL` |
| raw_grade | string | required | Grade string matching the subject's grade system |
| predicted_grade | string | optional | Override predicted grade; if omitted, computed by backend |
| transcript_uploaded | boolean | optional | Defaults to `false` |
| notes | string | optional | |

**Response — 201 Created:** The created StudentSubjectGrade object (same schema as
GET response above).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or Subject not found |
| 422 | Validation error |

---

### PUT /api/v1/students/{id}/grades/{grade_id}

**REQ-IDs:** REQ-055, REQ-068

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Replace all editable fields on an existing grade record (full update).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |
| grade_id | string (UUID) | StudentSubjectGrade ID |

**Request Body:** Same schema as POST /api/v1/students/{id}/grades. All non-key fields
are accepted; `subject_id` may not be changed after creation (omit or echo the existing
value).

**Response — 200 OK:** Updated StudentSubjectGrade object.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or grade record not found |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}/grades/{grade_id}

**REQ-IDs:** REQ-055, REQ-068

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Delete a single grade record. Does not cascade to the Transcript entity.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |
| grade_id | string (UUID) | StudentSubjectGrade ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or grade record not found |

---

## Student — Language Scores

### GET /api/v1/students/{id}/language-scores

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve IELTS and other language scores for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| ielts_score | float or null | Overall IELTS band |
| ielts_listening | float or null | |
| ielts_reading | float or null | |
| ielts_writing | float or null | |
| ielts_speaking | float or null | |
| ielts_date | string (ISO 8601 date) or null | Test date |
| other_language_scores | array of objects | Each: `{label, score, date}` — TOEFL, SAT, etc. |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/language-scores

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Set or replace language score data for a student. This endpoint performs
an upsert — there is one language score record per student; calling POST again
replaces all language score fields.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body (all fields optional):**

| Field | Type | Notes |
|-------|------|-------|
| ielts_score | float | Overall IELTS band (0.0–9.0) |
| ielts_listening | float | |
| ielts_reading | float | |
| ielts_writing | float | |
| ielts_speaking | float | |
| ielts_date | string (ISO 8601 date) | |
| other_language_scores | array of objects | Each: `{label: string, score: string, date: string}` |

**Response — 200 OK:** The updated language score object (same schema as GET).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}/language-scores

**REQ-IDs:** REQ-057

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Clear all language score data for a student (set all fields to null).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |

---

## Student — Teacher Evaluations

### GET /api/v1/students/{id}/teacher-evaluations

**REQ-IDs:** REQ-057, REQ-066, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve all per-subject teacher evaluation entries for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array stored as the student's `teacher_evaluation` JSONB field. Each element:

| Field | Type | Notes |
|-------|------|-------|
| subject_code | string | HKDSE subject code or free text |
| teacher_name | string | |
| rating | integer | 1–5 |
| comment | string | |
| date | string (ISO 8601 date) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/teacher-evaluations

**REQ-IDs:** REQ-057, REQ-066, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Add a teacher evaluation entry. Appends to the existing JSONB array.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| subject_code | string | required | |
| teacher_name | string | optional | |
| rating | integer | required | 1–5 |
| comment | string | optional | |
| date | string (ISO 8601 date) | optional | Defaults to today |

**Response — 201 Created:** The full updated `teacher_evaluation` array.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error (e.g., rating out of range) |

---

### DELETE /api/v1/students/{id}/teacher-evaluations

**REQ-IDs:** REQ-057

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Clear all teacher evaluations for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |

---

## Student — Extracurricular Activities

### GET /api/v1/students/{id}/extracurricular

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve extracurricular activity entries for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array from the student's `extra_curricular` JSONB field. Each element:

| Field | Type | Notes |
|-------|------|-------|
| activity | string | Activity name |
| role | string | Student's role |
| years | string | Duration or year range |
| achievement | string | Achievement description |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/extracurricular

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Add an extracurricular activity entry.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| activity | string | required | |
| role | string | optional | |
| years | string | optional | |
| achievement | string | optional | |

**Response — 201 Created:** The full updated `extra_curricular` array.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}/extracurricular

**REQ-IDs:** REQ-057

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Clear all extracurricular entries for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |

---

## Student — Awards

### GET /api/v1/students/{id}/awards

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve awards for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array from the student's `awards` JSONB field. Each element:

| Field | Type | Notes |
|-------|------|-------|
| title | string | Award title |
| awarding_body | string | Issuing organisation |
| level | string | `school`, `district`, `regional`, or `international` |
| year | integer | Year awarded |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/awards

**REQ-IDs:** REQ-057, REQ-089

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Add an award entry.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | required | |
| awarding_body | string | optional | |
| level | string | optional | `school`, `district`, `regional`, `international` |
| year | integer | optional | |

**Response — 201 Created:** The full updated `awards` array.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}/awards

**REQ-IDs:** REQ-057

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Clear all award entries for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |

---

## Student — Transcript

### POST /api/v1/students/{id}/transcript

**REQ-IDs:** REQ-056, REQ-067, REQ-106

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Upload a transcript file (PDF or image) for a student. The upload is
received synchronously (the file is saved to UPLOAD_DIR). Parsing is dispatched as a
background task and runs asynchronously. This endpoint returns immediately with a
`job_id` for polling.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Content-Type:** `multipart/form-data`

| Part | Type | Required | Notes |
|------|------|----------|-------|
| file | binary | required | PDF or image (PNG, JPG). Max 10 MB. |

**Response — 202 Accepted:**

| Field | Type | Notes |
|-------|------|-------|
| transcript_id | string (UUID) | Newly created Transcript record ID |
| job_id | string (UUID) | Identifier for polling parse status |
| status | string | Always `"pending"` on initial response |
| uploaded_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | No file part in request, or unsupported file type |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 413 | File exceeds 10 MB limit |
| 422 | Validation error |

---

### GET /api/v1/students/{id}/transcript

**REQ-IDs:** REQ-056, REQ-067, REQ-106

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve the most recent Transcript record for a student, including
`parsed_data` (if parsing is complete). Parsed grades are returned as suggestions only;
they must never be written to StudentSubjectGrade by the backend automatically.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Transcript ID |
| student_id | string (UUID) | |
| file_path | string | Internal storage path |
| uploaded_at | string (ISO 8601) | |
| parse_status | string | `pending`, `complete`, or `failed` |
| parsed_data | object or null | JSONB; populated when parse is complete. Contains `suggested_grades`: array of `{subject_name, raw_grade}` |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student or no transcript found for this student |

---

## School — Expanded Directory

### GET /api/v1/schools (v2 — replaces v1 for extended fields)

**REQ-IDs:** REQ-058, REQ-070, REQ-094, REQ-101

**Auth:** Protected (Counsellor or Admin)

**Purpose:** List schools with search and filter support. This endpoint extends the
v1 GET /api/v1/schools by adding query parameters and returning the expanded school
schema. The v1 response shape is a strict subset; clients already using v1 are
unaffected.

**Query Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| q | string | optional | Full-text search on `name` and `name_zh` |
| type | string | optional | Filter by type enum: `UNIVERSITY`, `POLYTECHNIC`, `COMMUNITY_COLLEGE`, `VOCATIONAL` |
| location | string | optional | Partial match on `location` field |
| min_score_gte | integer | optional | Filter: `minimum_entry_score >= value` |
| min_score_lte | integer | optional | Filter: `minimum_entry_score <= value` |
| limit | integer | optional | Max results to return. Default 50, max 200. |
| offset | integer | optional | Pagination offset. Default 0. |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| total | integer | Total matching records (before limit/offset) |
| items | array | Array of school summary objects (see below) |

Each school summary object:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | English name |
| name_zh | string or null | Chinese name |
| type | string | Type enum |
| location | string | |
| minimum_entry_score | integer or null | HKDSE aggregate |
| acceptance_rate | float or null | |
| scholarship_available | boolean | |
| data_last_updated | string (ISO 8601 date) or null | |
| created_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 422 | Invalid query parameter value |

---

### GET /api/v1/schools/{id} (v2 — full profile)

**REQ-IDs:** REQ-058, REQ-071, REQ-095

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve the full expanded profile of a single school. Extends the v1
response with all new fields from REQ-058.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | School ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | English name |
| name_zh | string or null | Chinese name |
| type | string | Type enum |
| location | string | |
| website | string or null | |
| description | string or null | |
| minimum_entry_score | integer or null | HKDSE best-5 aggregate |
| required_subjects | array or null | JSONB: `[{subject_code, min_grade}]` |
| language_requirements | object or null | JSONB: e.g. `{ielts_minimum: 6.5}` |
| faculties | array or null | JSONB array of faculty name strings |
| notable_programs | array or null | JSONB array of program description strings |
| acceptance_rate | float or null | |
| average_admitted_score | float or null | JUPAS median or lower quartile |
| scholarship_available | boolean | |
| data_source | string or null | Source URL or description |
| data_last_updated | string (ISO 8601 date) or null | |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 404 | No school found with this ID |

---

### POST /api/v1/schools (v2 — admin)

**REQ-IDs:** REQ-058, REQ-080

**Auth:** Admin-only

**Purpose:** Create a new school record with the expanded v2 school schema. Restricted
to admin role; data is normally seeded by the Data Agent, not entered via UI.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | required | English name; must be unique |
| name_zh | string | optional | Chinese name |
| type | string | required | Type enum |
| location | string | required | |
| website | string | optional | |
| description | string | optional | |
| minimum_entry_score | integer | optional | |
| required_subjects | array | optional | `[{subject_code, min_grade}]` |
| language_requirements | object | optional | |
| faculties | array | optional | |
| notable_programs | array | optional | |
| acceptance_rate | float | optional | 0.0–1.0 |
| average_admitted_score | float | optional | |
| scholarship_available | boolean | optional | Defaults to `false` |
| data_source | string | optional | |
| data_last_updated | string (ISO 8601 date) | optional | |

**Response — 201 Created:** Full school profile object (same schema as GET
/api/v1/schools/{id}).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have admin role |
| 409 | A school with this name already exists |
| 422 | Validation error |

---

### PUT /api/v1/schools/{id} (v2 — admin)

**REQ-IDs:** REQ-058, REQ-080

**Auth:** Admin-only

**Purpose:** Replace all editable fields of an existing school record with the expanded
v2 schema. Restricted to admin role.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | School ID |

**Request Body:** Same schema as POST /api/v1/schools (v2). All non-key fields optional.

**Response — 200 OK:** Full updated school profile object.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have admin role |
| 404 | No school found with this ID |
| 422 | Validation error |

---

## Student School Targets

### GET /api/v1/students/{id}/targets

**REQ-IDs:** REQ-059, REQ-069, REQ-092, REQ-103

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve the student's target school list, ordered by `student_rank`
ascending.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | StudentSchoolTarget ID |
| student_id | string (UUID) | |
| school_id | string (UUID) | |
| school_name | string | Denormalized |
| school_name_zh | string or null | Denormalized |
| student_rank | integer | Student's own preference order (1 = top choice) |
| match_score | float or null | 0.0–1.0; null if matching has not run |
| eligibility_pass | boolean or null | null if matching has not run |
| eligibility_fail_reason | string or null | Human-readable reason for ineligibility (REQ-072) |
| shap_explanation | object or null | JSONB: `{top_features: [{feature, value, direction, plain_text}]}` |
| status | string | Enum: `CONSIDERING`, `APPLIED`, `ADMITTED`, `REJECTED`, `WITHDRAWN` |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to view this student |
| 404 | No student found with this ID |

---

### POST /api/v1/students/{id}/targets

**REQ-IDs:** REQ-059, REQ-069

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Add a school to the student's target list.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| school_id | string (UUID) | required | Must reference an existing School |
| student_rank | integer | optional | Preference rank; defaults to appending at the end |
| status | string | optional | Defaults to `CONSIDERING` |

**Response — 201 Created:** The created StudentSchoolTarget object (same schema as
GET list items above).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or School not found |
| 409 | This school is already in the student's target list |
| 422 | Validation error |

---

### PUT /api/v1/students/{id}/targets/{target_id}

**REQ-IDs:** REQ-059, REQ-069, REQ-093, REQ-108

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Update a single target entry (status or rank).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |
| target_id | string (UUID) | StudentSchoolTarget ID |

**Request Body (all fields optional):**

| Field | Type | Notes |
|-------|------|-------|
| student_rank | integer | New preference rank |
| status | string | New status enum value |

**Response — 200 OK:** Updated StudentSchoolTarget object.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or target record not found |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}/targets/{target_id}

**REQ-IDs:** REQ-059, REQ-069

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Remove a school from the student's target list.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |
| target_id | string (UUID) | StudentSchoolTarget ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | Student or target record not found |

---

### POST /api/v1/students/{id}/targets/reorder

**REQ-IDs:** REQ-059, REQ-069, REQ-093, REQ-108

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Bulk reorder all target entries by providing a new ordered array of
target IDs. The backend assigns `student_rank` values 1, 2, 3, … in the order
supplied. All existing targets for this student must be included in the array or the
request is rejected.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| ordered_target_ids | array of strings (UUID) | required | All target IDs for this student in desired preference order |

**Response — 200 OK:** Full updated targets array (same schema as GET /api/v1/students/{id}/targets).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Array does not contain all existing target IDs, or contains unknown IDs |
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission to edit this student |
| 404 | No student found with this ID |
| 422 | Validation error |

---

## Matchmaking

### POST /api/v1/students/{id}/match

**REQ-IDs:** REQ-046, REQ-072, REQ-073, REQ-074, REQ-075, REQ-076

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Run the matching engine for the student. The engine executes:
(1) eligibility filter, (2) weighted scoring + optional ML scoring, (3) SHAP
computation, (4) preference-adjusted ranking. Results are persisted to
StudentSchoolTarget records (updating `match_score`, `eligibility_pass`,
`eligibility_fail_reason`, and `shap_explanation`). Returns the ordered result list.

This endpoint may also add schools to the target list if they are not already present
(configurable via request body). If a trained ML model is not available, the engine
falls back to the weighted scoring model only (REQ-046 fallback rule).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| include_all_schools | boolean | optional | If `true`, match against all schools in database (not just target list). Defaults to `false`. |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| student_id | string (UUID) | |
| ml_model_used | boolean | Whether the XGBoost model contributed to scoring |
| generated_at | string (ISO 8601) | |
| results | array | Ordered list of match result objects |

Each result object:

| Field | Type | Notes |
|-------|------|-------|
| school_id | string (UUID) | |
| school_name | string | |
| fit_score | float | 0.0–1.0; final combined score |
| weighted_score | float | Rule-based component |
| ml_probability | float or null | XGBoost output; null if model not used |
| eligibility_pass | boolean | |
| eligibility_fail_reason | string or null | Specific failing criterion (REQ-072) |
| shap_top_features | array or null | Top 3 SHAP features: `[{feature, plain_text}]` |
| display_rank | integer | Preference-adjusted rank |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission for this student |
| 404 | No student found with this ID |
| 422 | Student profile has insufficient data to run matching |

---

### GET /api/v1/students/{id}/match

**REQ-IDs:** REQ-046, REQ-072, REQ-073

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve the last stored match results for the student without re-running
the engine. Returns 404 if matching has never been run.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:** Same schema as POST /api/v1/students/{id}/match response.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission for this student |
| 404 | No student found, or matching has never been run |

---

## Academic Plan

### POST /api/v1/students/{id}/plan

**REQ-IDs:** REQ-060, REQ-077, REQ-078, REQ-105

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Trigger asynchronous generation of the AcademicPlan HTML document for
a student. The task is enqueued as a background job. The endpoint returns immediately
with a `job_id` for polling. If a plan already exists, it is superseded when the new
generation completes (version is incremented). See ADR-005 for the async task pattern.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:** Empty.

**Response — 202 Accepted:**

| Field | Type | Notes |
|-------|------|-------|
| job_id | string (UUID) | Use with GET /plan/status to poll |
| student_id | string (UUID) | |
| status | string | Always `"pending"` on this response |
| submitted_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission for this student |
| 404 | No student found with this ID |
| 422 | Student profile has insufficient data to generate a plan |

---

### GET /api/v1/students/{id}/plan/status

**REQ-IDs:** REQ-049, REQ-078, REQ-099, REQ-105

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Poll the status of the most recently triggered plan generation background
task for a student.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Query Parameters:**

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| job_id | string (UUID) | optional | If supplied, checks a specific job; otherwise returns status of the latest job. |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| job_id | string (UUID) | |
| student_id | string (UUID) | |
| status | string | `pending`, `running`, `complete`, `failed` |
| submitted_at | string (ISO 8601) | |
| completed_at | string (ISO 8601) or null | Set when status is `complete` or `failed` |
| error_message | string or null | Present only when status is `failed` |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission for this student |
| 404 | No student found or no plan generation job found |

---

### GET /api/v1/students/{id}/plan

**REQ-IDs:** REQ-060, REQ-078, REQ-096, REQ-105

**Auth:** Protected (Counsellor or Admin)

**Purpose:** Retrieve the stored AcademicPlan record including the full rendered
`html_content`. Returns 404 if no plan has been generated yet. The `html_content`
field contains a complete, self-contained HTML document (inline CSS, @media print,
no JavaScript; see REQ-077).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | AcademicPlan ID |
| student_id | string (UUID) | |
| generated_at | string (ISO 8601) | |
| version | integer | Incremented on each successful regeneration |
| recommended_schools | array | JSONB ordered list with rationale per school |
| action_items | array | JSONB array: `[{task, deadline, related_school_id, priority}]` |
| html_content | string | Full rendered HTML document |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have permission for this student |
| 404 | No student found or no plan has been generated yet |

---

## Account Settings

### GET /api/v1/account

**REQ-IDs:** REQ-079, REQ-097

**Auth:** Protected (any authenticated role)

**Purpose:** Retrieve the current authenticated user's account profile.

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Account ID |
| email | string | Read-only; cannot be changed via this API |
| display_name | string or null | Editable display name |
| preferred_language | string | `en` or `zh-HK` |
| role | string | `counsellor` or `admin` |
| is_active | boolean | `false` if soft-deleted |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |

---

### PUT /api/v1/account

**REQ-IDs:** REQ-079, REQ-097

**Auth:** Protected (any authenticated role)

**Purpose:** Update editable account fields.

**Request Body (all fields optional):**

| Field | Type | Notes |
|-------|------|-------|
| display_name | string | |
| preferred_language | string | `en` or `zh-HK` |

**Response — 200 OK:** Updated account object (same schema as GET /api/v1/account).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 422 | Validation error |

---

### PUT /api/v1/account/password

**REQ-IDs:** REQ-079, REQ-097

**Auth:** Protected (any authenticated role)

**Purpose:** Change the current user's password. Requires current password
verification before accepting the new password.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| current_password | string | required | Existing password for verification |
| new_password | string | required | Minimum 8 characters |
| confirm_new_password | string | required | Must match `new_password` |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| message | string | `"Password updated successfully"` |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT, or `current_password` is incorrect |
| 422 | Validation error (new password too short, or confirm does not match) |

---

### DELETE /api/v1/account

**REQ-IDs:** REQ-079, REQ-097

**Purpose:** Soft-delete the current user's account. Sets `account.is_active = false`.
The account record and all associated student data are retained in the database for
audit purposes; the user cannot log in after deletion. Password confirmation is
required.

**Auth:** Protected (any authenticated role)

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| password | string | required | Current password for confirmation |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| message | string | `"Account deactivated"` |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT, or password is incorrect |

---

## Admin

### POST /api/v1/admin/data-refresh

**REQ-IDs:** REQ-048, REQ-080, REQ-098

**Auth:** Admin-only

**Purpose:** Trigger a data-agent re-run. For MVP this is a stub that records the
request in the database and returns immediately; the actual agent runs out-of-band.
In a future iteration this may dispatch an out-of-process job.

**Request Body:** Empty.

**Response — 202 Accepted:**

| Field | Type | Notes |
|-------|------|-------|
| message | string | `"Data refresh triggered"` |
| triggered_at | string (ISO 8601) | |
| triggered_by | string (UUID) | Account ID of the admin who triggered it |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Caller does not have admin role |

---

## v2 Endpoint Summary Table

| Method | Path | Auth | REQ-IDs |
|--------|------|------|---------|
| GET | /api/v1/grade-systems | Protected | REQ-045, REQ-053 |
| GET | /api/v1/subjects | Protected | REQ-045, REQ-054, REQ-064, REQ-065 |
| PUT | /api/v1/students/{id}/profile | Protected | REQ-057, REQ-079, REQ-089 |
| GET | /api/v1/students/{id}/grades | Protected | REQ-055, REQ-068, REQ-090 |
| POST | /api/v1/students/{id}/grades | Protected | REQ-055, REQ-068, REQ-090 |
| PUT | /api/v1/students/{id}/grades/{grade_id} | Protected | REQ-055, REQ-068 |
| DELETE | /api/v1/students/{id}/grades/{grade_id} | Protected | REQ-055, REQ-068 |
| GET | /api/v1/students/{id}/language-scores | Protected | REQ-057, REQ-089 |
| POST | /api/v1/students/{id}/language-scores | Protected | REQ-057, REQ-089 |
| DELETE | /api/v1/students/{id}/language-scores | Protected | REQ-057 |
| GET | /api/v1/students/{id}/teacher-evaluations | Protected | REQ-057, REQ-066, REQ-089 |
| POST | /api/v1/students/{id}/teacher-evaluations | Protected | REQ-057, REQ-066, REQ-089 |
| DELETE | /api/v1/students/{id}/teacher-evaluations | Protected | REQ-057 |
| GET | /api/v1/students/{id}/extracurricular | Protected | REQ-057, REQ-089 |
| POST | /api/v1/students/{id}/extracurricular | Protected | REQ-057, REQ-089 |
| DELETE | /api/v1/students/{id}/extracurricular | Protected | REQ-057 |
| GET | /api/v1/students/{id}/awards | Protected | REQ-057, REQ-089 |
| POST | /api/v1/students/{id}/awards | Protected | REQ-057, REQ-089 |
| DELETE | /api/v1/students/{id}/awards | Protected | REQ-057 |
| POST | /api/v1/students/{id}/transcript | Protected | REQ-056, REQ-067, REQ-106 |
| GET | /api/v1/students/{id}/transcript | Protected | REQ-056, REQ-067, REQ-106 |
| GET | /api/v1/schools | Protected (extended) | REQ-058, REQ-070, REQ-094, REQ-101 |
| GET | /api/v1/schools/{id} | Protected (extended) | REQ-058, REQ-071, REQ-095 |
| POST | /api/v1/schools | Admin-only | REQ-058, REQ-080 |
| PUT | /api/v1/schools/{id} | Admin-only | REQ-058, REQ-080 |
| GET | /api/v1/students/{id}/targets | Protected | REQ-059, REQ-069, REQ-092, REQ-103 |
| POST | /api/v1/students/{id}/targets | Protected | REQ-059, REQ-069 |
| PUT | /api/v1/students/{id}/targets/{target_id} | Protected | REQ-059, REQ-069, REQ-093, REQ-108 |
| DELETE | /api/v1/students/{id}/targets/{target_id} | Protected | REQ-059, REQ-069 |
| POST | /api/v1/students/{id}/targets/reorder | Protected | REQ-059, REQ-069, REQ-093, REQ-108 |
| POST | /api/v1/students/{id}/match | Protected | REQ-046, REQ-072–REQ-076 |
| GET | /api/v1/students/{id}/match | Protected | REQ-046, REQ-072, REQ-073 |
| POST | /api/v1/students/{id}/plan | Protected | REQ-060, REQ-077, REQ-078, REQ-105 |
| GET | /api/v1/students/{id}/plan/status | Protected | REQ-049, REQ-078, REQ-099, REQ-105 |
| GET | /api/v1/students/{id}/plan | Protected | REQ-060, REQ-078, REQ-096, REQ-105 |
| GET | /api/v1/account | Protected | REQ-079, REQ-097 |
| PUT | /api/v1/account | Protected | REQ-079, REQ-097 |
| PUT | /api/v1/account/password | Protected | REQ-079, REQ-097 |
| DELETE | /api/v1/account | Protected | REQ-079, REQ-097 |
| POST | /api/v1/admin/data-refresh | Admin-only | REQ-048, REQ-080, REQ-098 |
