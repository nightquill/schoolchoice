# API Contracts
# Intelligent Academic Advisor — MVP
# Document Owner: System Architect
# Date: 2026-03-27
# Status: BASELINE

---

## Conventions

- All paths are prefixed `/api/v1/` (see ADR-004).
- All request and response bodies are `application/json`.
- Dates and timestamps use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`.
- UUIDs are lowercase hyphenated strings (see ADR-003).
- **Protected** endpoints require the `Authorization: Bearer <token>` header. The token is a JWT issued by `POST /api/v1/auth/login`. Absence or invalidity returns `401`.
- **Public** endpoints require no authentication header.
- Field notation: `field_name: Type [required|optional]`

---

## Auth Endpoints

### POST /api/v1/auth/register

**REQ-IDs:** REQ-010, REQ-011, REQ-024

**Auth:** Public

**Purpose:** Register a new counselor account with email and password.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | required | Must be a valid email address; must be unique |
| password | string | required | Minimum 8 characters |

**Response — 201 Created:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Newly created user ID |
| email | string | The registered email |
| created_at | string (ISO 8601) | Account creation timestamp |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed or missing required fields |
| 409 | A user with this email address already exists |
| 422 | Validation error (e.g., email format invalid, password too short) |

---

### POST /api/v1/auth/login

**REQ-IDs:** REQ-010, REQ-011, REQ-031

**Auth:** Public

**Purpose:** Authenticate a counselor and receive a JWT access token.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | required | Registered email address |
| password | string | required | Plaintext password (transmitted over HTTPS) |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| access_token | string | Signed JWT |
| token_type | string | Always `"bearer"` |
| expires_in | integer | Seconds until token expiry |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed or missing required fields |
| 401 | Email not found or password is incorrect |
| 422 | Validation error (e.g., missing field) |

---

## Student Endpoints

### GET /api/v1/students

**REQ-IDs:** REQ-015, REQ-032

**Auth:** Protected

**Purpose:** List all student profiles owned by the authenticated counselor.

**Query Parameters:** None (MVP; no pagination or filtering required).

**Response — 200 OK:**

Returns a JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Student ID |
| name | string | Student full name |
| target_region | string | `"local"` or `"international"` |
| created_at | string (ISO 8601) | Profile creation timestamp |
| updated_at | string (ISO 8601) | Last modification timestamp |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |

---

### POST /api/v1/students

**REQ-IDs:** REQ-012, REQ-025, REQ-028, REQ-033

**Auth:** Protected

**Purpose:** Create a new student profile owned by the authenticated counselor.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | required | Student full name |
| grades | object | required | Map of subject name (string) to grade value (string or number). Example: `{"math": "A", "english": "B+"}` |
| interests | array of strings | required | List of interest tags. Example: `["robotics", "music"]` |
| strengths_weaknesses | string | required | Free-text description |
| target_region | string | required | Exactly `"local"` or `"international"` |

**Response — 201 Created:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Newly created student ID |
| user_id | string (UUID) | ID of the owning counselor |
| name | string | |
| grades | object | As submitted |
| interests | array of strings | As submitted |
| strengths_weaknesses | string | As submitted |
| target_region | string | As submitted |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 422 | Validation error (e.g., invalid target_region value) |

---

### GET /api/v1/students/{id}

**REQ-IDs:** REQ-014, REQ-033

**Auth:** Protected

**Purpose:** Retrieve the full profile of a single student by ID.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| user_id | string (UUID) | Owning counselor ID |
| name | string | |
| grades | object | |
| interests | array of strings | |
| strengths_weaknesses | string | |
| target_region | string | |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |

---

### PUT /api/v1/students/{id}

**REQ-IDs:** REQ-013, REQ-033

**Auth:** Protected

**Purpose:** Replace the editable fields of an existing student profile (full update).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:** Same schema as POST /api/v1/students. All fields required.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | required | |
| grades | object | required | |
| interests | array of strings | required | |
| strengths_weaknesses | string | required | |
| target_region | string | required | `"local"` or `"international"` |

**Response — 200 OK:** Full updated student object (same schema as GET /api/v1/students/{id} response).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |
| 422 | Validation error |

---

### DELETE /api/v1/students/{id}

**REQ-IDs:** REQ-025, REQ-028

**Auth:** Protected

**Purpose:** Permanently delete a student profile and all associated recommendations and action plans.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |

---

## School Endpoints

### GET /api/v1/schools

**REQ-IDs:** REQ-026, REQ-030

**Auth:** Protected

**Purpose:** List all schools stored in the system.

**Query Parameters:** None (MVP).

**Response — 200 OK:**

Returns a JSON array. Each element:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | School ID |
| name | string | School name |
| location | string | Geographic location string |
| key_strengths | array of strings | E.g., `["STEM", "arts"]` |
| created_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |

---

### POST /api/v1/schools

**REQ-IDs:** REQ-026, REQ-030

**Auth:** Protected

**Purpose:** Add a new school record to the system database.

**Request Body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | required | School name |
| location | string | required | Geographic location |
| min_academic_requirements | object | required | Map of subject name to minimum grade. Example: `{"math": "B", "english": "C+"}` |
| key_strengths | array of strings | required | Strength tags |
| notes | string | optional | Free-text notes; defaults to empty string |

**Response — 201 Created:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Newly created school ID |
| name | string | |
| location | string | |
| min_academic_requirements | object | |
| key_strengths | array of strings | |
| notes | string | |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 409 | A school with this name already exists |
| 422 | Validation error |

---

### GET /api/v1/schools/{id}

**REQ-IDs:** REQ-026, REQ-030

**Auth:** Protected

**Purpose:** Retrieve the full record of a single school by ID.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | School ID |

**Response — 200 OK:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | |
| name | string | |
| location | string | |
| min_academic_requirements | object | |
| key_strengths | array of strings | |
| notes | string | |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 404 | No school found with this ID |

---

### PUT /api/v1/schools/{id}

**REQ-IDs:** REQ-026, REQ-030

**Auth:** Protected

**Purpose:** Replace all editable fields of an existing school record (full update).

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | School ID |

**Request Body:** Same schema as POST /api/v1/schools (all fields required except `notes` which remains optional).

**Response — 200 OK:** Full updated school object (same schema as GET /api/v1/schools/{id} response).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 400 | Request body is malformed |
| 401 | Missing or invalid JWT |
| 404 | No school found with this ID |
| 422 | Validation error |

---

### DELETE /api/v1/schools/{id}

**REQ-IDs:** REQ-026, REQ-030

**Auth:** Protected

**Purpose:** Permanently delete a school record from the system.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | School ID |

**Response — 204 No Content:** Empty body.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 404 | No school found with this ID |

---

## Recommendation Endpoints

### POST /api/v1/students/{id}/recommendations

**REQ-IDs:** REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040

**Auth:** Protected

**Purpose:** Trigger the matching engine for the specified student. The backend runs the full pipeline: filter → score → rank → generate recommendation records. Any previously stored recommendation records for this student are replaced. Returns the newly generated recommendations.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:** Empty (no body required; all inputs are derived from the stored student profile and the schools table).

**Response — 201 Created:**

Returns a JSON array of up to 5 recommendation objects, ordered by score descending.

Each recommendation object:

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Recommendation record ID |
| student_id | string (UUID) | |
| school_id | string (UUID) | |
| school_name | string | Denormalized for display convenience |
| score | number (float) | Computed match score; range 0.0–1.0 |
| explanation | string | Plain-text description of why this school matches: which factors contributed and their weights |
| gaps | string | Plain-text description of what the student is missing relative to this school |
| created_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |
| 422 | Student profile is incomplete; matching cannot run |

---

### GET /api/v1/students/{id}/recommendations

**REQ-IDs:** REQ-020, REQ-027, REQ-034, REQ-037

**Auth:** Protected

**Purpose:** Retrieve the most recently generated recommendation records for the specified student without re-running the matching engine.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:**

JSON array of recommendation objects (same schema as POST response above). Returns an empty array `[]` if recommendations have never been generated.

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |

---

## Action Plan Endpoints

### POST /api/v1/students/{id}/action-plan

**REQ-IDs:** REQ-021, REQ-022, REQ-035, REQ-040

**Auth:** Protected

**Purpose:** Generate and persist an action plan for the specified student. If an action plan already exists for this student, it is replaced. The action plan is generated from the student's profile and current recommendation records.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Request Body:** Empty.

**Response — 201 Created:**

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Action plan record ID |
| student_id | string (UUID) | |
| academic_targets | string | Plain-text academic improvement targets |
| extracurricular_direction | string | Plain-text suggested extracurricular focus |
| preparation_steps | string | Plain-text general preparation guidance |
| created_at | string (ISO 8601) | |
| updated_at | string (ISO 8601) | |

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID |
| 422 | Student profile is incomplete; action plan cannot be generated |

---

### GET /api/v1/students/{id}/action-plan

**REQ-IDs:** REQ-021, REQ-022, REQ-034, REQ-038

**Auth:** Protected

**Purpose:** Retrieve the most recently generated action plan for the specified student without re-generating it.

**Path Parameters:**

| Parameter | Type | Notes |
|-----------|------|-------|
| id | string (UUID) | Student ID |

**Response — 200 OK:** Action plan object (same schema as POST response above).

**Error Codes:**

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Authenticated user does not own this student record |
| 404 | No student found with this ID, or no action plan has been generated yet |

---

## Endpoint Summary Table

| Method | Path | Auth | REQ-IDs |
|--------|------|------|---------|
| POST | /api/v1/auth/register | Public | REQ-010, REQ-011, REQ-024 |
| POST | /api/v1/auth/login | Public | REQ-010, REQ-011, REQ-031 |
| GET | /api/v1/students | Protected | REQ-015, REQ-032 |
| POST | /api/v1/students | Protected | REQ-012, REQ-025, REQ-028, REQ-033 |
| GET | /api/v1/students/{id} | Protected | REQ-014, REQ-033 |
| PUT | /api/v1/students/{id} | Protected | REQ-013, REQ-033 |
| DELETE | /api/v1/students/{id} | Protected | REQ-025, REQ-028 |
| GET | /api/v1/schools | Protected | REQ-026, REQ-030 |
| POST | /api/v1/schools | Protected | REQ-026, REQ-030 |
| GET | /api/v1/schools/{id} | Protected | REQ-026, REQ-030 |
| PUT | /api/v1/schools/{id} | Protected | REQ-026, REQ-030 |
| DELETE | /api/v1/schools/{id} | Protected | REQ-026, REQ-030 |
| POST | /api/v1/students/{id}/recommendations | Protected | REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040 |
| GET | /api/v1/students/{id}/recommendations | Protected | REQ-020, REQ-027, REQ-034, REQ-037 |
| POST | /api/v1/students/{id}/action-plan | Protected | REQ-021, REQ-022, REQ-035, REQ-040 |
| GET | /api/v1/students/{id}/action-plan | Protected | REQ-021, REQ-022, REQ-034, REQ-038 |
