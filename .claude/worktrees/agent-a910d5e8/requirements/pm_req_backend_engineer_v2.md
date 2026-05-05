# PM → Backend Engineer — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

v1 delivered 17 FastAPI endpoints covering auth, student CRUD, school CRUD, matching engine (rule-based), and action plan (plain text). These are complete. Your task is to extend the backend with all new v2 endpoints and logic. Do not break or modify v1 endpoints unless a v2 requirement explicitly supersedes them.

---

## Owned Requirements (v2)

### REQ-063 [BACKEND] — HKDSE Grade Scale Utility
Implement a module `backend/services/hkdse.py` (or equivalent) that:
- Defines the grade-to-numeric mapping: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0, X=0
- Provides a function `grade_to_int(grade: str) -> int`
- Provides a function `compute_best5_aggregate(grades: list[dict]) -> int` — uses compulsory subjects first, then fills with highest elective scores
- This utility must be used by all scoring and eligibility logic

### REQ-064 [BACKEND] — HKDSE Compulsory Subjects Seed Validation
On application startup (or via a startup script), verify that the four compulsory subjects exist in the `subjects` table (CHLA, ENGL, MATH, CSD). If missing, insert them. This can be part of the Data Agent seed SQL or a startup fixture.

### REQ-065 [BACKEND] — Full HKDSE Elective Subject List
The backend must accept and validate subject entries against the full HKDSE elective list (see preferences.md §4.3). ApL subjects are stored as free-text entries with grade values "Attained" or "Attained with Distinction"; the scoring module must handle these gracefully (ApL grades do not count toward HKDSE aggregate but may contribute to extracurricular/program alignment scores).

### REQ-066 [BACKEND] — Predicted Grade Logic
Implement `compute_predicted_grade(student_id, subject_id) -> (grade: str, method: str)` in the HKDSE service module:
- Rule 1: If only one non-OFFICIAL sitting → return that grade, method="single_sitting"
- Rule 2: If multiple non-OFFICIAL sittings → return most recent, method="most_recent_sitting", include a note
- Rule 3: If teacher_evaluation in student record contains a rating for this subject → apply weighted average: 70% (numeric of latest sitting) + 30% (teacher rating mapped to grade: rating 1→1, 2→2, 3→3, 4→4, 5→5**), convert result back to grade string using nearest rounding
- If an OFFICIAL grade exists → do not compute prediction; return official grade
- Store result in StudentSubjectGrade.predicted_grade when triggered

### REQ-067 [BACKEND] — Transcript Upload and Async Parsing
Implement:
- `POST /api/v1/students/{id}/transcripts` — accepts multipart file upload (PDF or image), stores file to disk, creates Transcript record, triggers async parsing task
- `GET /api/v1/students/{id}/transcripts/{transcript_id}` — returns Transcript with parsed_data (null if parsing not yet complete) and a status field
- Async parsing task: extract subject names and grades from the document (use a text extraction library, e.g. pdfplumber for PDFs, pytesseract for images — SA to confirm in ADR). Store extracted data in Transcript.parsed_data as: `[{"subject_name": str, "grade": str, "confidence": float}]`
- Parsed grades are NEVER auto-saved to StudentSubjectGrade. They are suggestions only.

### REQ-068 [BACKEND] — StudentSubjectGrade CRUD
Implement:
- `POST /api/v1/students/{id}/grades` — create a StudentSubjectGrade
- `GET /api/v1/students/{id}/grades` — list all grades for a student (includes predicted_grade if applicable)
- `PATCH /api/v1/students/{id}/grades/{grade_id}` — update a grade record
- `DELETE /api/v1/students/{id}/grades/{grade_id}` — delete a grade record
- On any create or update to a non-OFFICIAL grade: recompute and store predicted_grade automatically

### REQ-069 [BACKEND] — StudentSchoolTarget CRUD
Implement:
- `POST /api/v1/students/{id}/targets` — add a school to the student's target list
- `GET /api/v1/students/{id}/targets` — list all targets with computed match_score, eligibility_pass, shap_explanation
- `PATCH /api/v1/students/{id}/targets/{target_id}` — update student_rank or status
- `DELETE /api/v1/students/{id}/targets/{target_id}` — remove a target school
- On GET: run eligibility filter and scoring for all targets and return fresh scores (or return cached scores if computed within last 24h — SA to decide caching strategy)

### REQ-070 [BACKEND] — School Directory Endpoint
Implement `GET /api/v1/schools`:
- Query params: `q` (name search, case-insensitive), `type` (enum filter), `location` (substring match), `min_score_gte` (integer), `min_score_lte` (integer)
- Returns paginated list (default page_size=20)
- Response includes: id, name, name_zh, type, location, minimum_entry_score, scholarship_available

### REQ-071 [BACKEND] — School Profile Endpoint
Implement `GET /api/v1/schools/{id}` — returns full school record including all JSONB fields.

### REQ-072 [BACKEND] — v2 Eligibility Filter
Extend/replace the v1 eligibility check with the full v2 logic:
- Compute student's best-5 aggregate using REQ-063 utility (compulsory + best electives)
- Fail if best-5 aggregate < school.minimum_entry_score (when set)
- Fail if student is missing any subject in school.required_subjects (exact subject code match or no equivalent)
- Fail if student.ielts_score < school.language_requirements.ielts_minimum (when both are set)
- Return: `eligibility_pass: bool`, `failing_criteria: list[str]` (plain-English reasons)
- Ineligible schools must still be returned with eligibility_pass=false

### REQ-073 [BACKEND] — v2 Weighted Scoring
Implement fit_score (0.0–1.0) computation:
- academic_fit = min(student_aggregate / (school.average_admitted_score or school.minimum_entry_score + 2), 1.0) × 0.50
- subject_alignment = (matching_elective_subjects / total_required_subjects or 1) × 0.20
- language_fit = (student_ielts / school.ielts_minimum if both set, else 1.0, capped at 1.0) × 0.15
- interest_alignment = keyword_overlap_score(student.extra_curricular + awards, school.notable_programs) × 0.15
- fit_score = sum of components
Store result in StudentSchoolTarget.match_score.

### REQ-074 [ML] — XGBoost Classifier (Should Have)
Implement `backend/services/ml_matchmaker.py`:
- Class `XGBoostAdmissionModel` with `.train(training_data)` and `.predict(student_features, school_features) -> (probability: float, shap_values: dict)`
- Features vector: [aggregate_score, chinese_grade, english_grade, math_grade, ielts_score, extracurricular_count, top_award_level (0–3), school_acceptance_rate, school_min_score_gap]
- When trained model file exists (backend/models/xgb_model.pkl): load and use it
- When model file is absent: return ml_probability=None (system falls back to rule-only score)
- Training entrypoint: `POST /admin/ml/train` (admin only) — triggers training on any available historical outcome data

### REQ-075 [ML] — SHAP Values
When ml_probability is computed:
- Run SHAP TreeExplainer on the XGBoost model for the specific student–school input
- Extract top 3 feature importance values (by absolute SHAP value)
- Map feature names to plain-English labels:
  - aggregate_score → "HKDSE aggregate score"
  - ielts_score → "English language proficiency"
  - extracurricular_count → "Extracurricular activities"
  - top_award_level → "Award achievements"
  - school_min_score_gap → "Gap to school minimum"
- Store as: `{"feature": str, "direction": "positive"|"negative", "plain_text": str}` array in shap_explanation JSONB

### REQ-076 [BACKEND] — Preference Rank Adjustment
In the ranking step after scoring:
- Sort eligible schools by fit_score descending (baseline ranking)
- For schools in the student's target list: compute median student_rank; for each school ranked above median, boost its display position by (median - student_rank) positions
- Return adjusted display order in the response (do not alter stored fit_score)

### REQ-077 [BACKEND] — Academic Plan HTML Generation
Implement `backend/services/plan_generator.py`:
- Accepts student_id, retrieves all related data (grades, targets, language scores, extracurriculars, awards)
- Generates HTML string with all 7 sections as defined in preferences.md §9.1
- Inline CSS only (no <link> tags, no external resources)
- Include `@media print { ... }` stylesheet section
- No JavaScript in the generated HTML
- Top N schools: default 5 (configurable per call)
- Per recommended school section: include gap analysis table (student score vs school requirement per subject)
- Store result in AcademicPlan.html_content, set generated_at, increment version

### REQ-078 [BACKEND] — Plan Generation Async Endpoints
Implement:
- `POST /api/v1/students/{id}/plan/generate` — enqueues plan generation as a background task, returns task_id
- `GET /api/v1/students/{id}/plan/status` — returns `{status: "pending"|"running"|"complete"|"error", generated_at: datetime|null}`
- `GET /api/v1/students/{id}/plan` — returns the HTML document (Content-Type: text/html) if complete; 404 if not yet generated

### REQ-079 [BACKEND] — Account Settings Endpoints
Implement:
- `GET /api/v1/account` — returns: email (read-only), display_name, preferred_language, notification_email_enabled
- `PATCH /api/v1/account` — updates display_name, preferred_language, notification_email_enabled
- `POST /api/v1/account/change-password` — requires current_password + new_password + confirm_new_password; validates current password hash; rejects if mismatch
- `DELETE /api/v1/account` — requires password confirmation; performs soft delete (sets account.is_active=false, records deleted_at)

### REQ-080 [BACKEND] — Admin Data Refresh Endpoint
Implement `POST /api/v1/admin/data-refresh`:
- Restricted to accounts with role="admin"
- Triggers the data-agent re-run as a background task (invoke data agent script or subprocess)
- Returns: `{task_id: str, triggered_at: datetime}`
- `GET /api/v1/admin/data-refresh/status` — returns last refresh timestamp, source counts, status

---

## Performance Requirements

- All read endpoints (GET) must return within 500ms under normal single-user load.
- Score computation for a student's full target list (up to 20 schools) must complete within 500ms when ML model is not used.
- Plan generation is exempt: run as background task, may take up to 10 seconds.
- Transcript parsing is exempt: run as background task, duration depends on file size.

---

## Deliverables

- `backend/services/hkdse.py` — grade utility module
- `backend/services/matchmaker_v2.py` — v2 eligibility + scoring
- `backend/services/ml_matchmaker.py` — XGBoost + SHAP module
- `backend/services/plan_generator.py` — HTML plan generator
- `backend/routers/grades.py` — StudentSubjectGrade endpoints
- `backend/routers/transcripts.py` — Transcript upload + parse endpoints
- `backend/routers/targets.py` — StudentSchoolTarget endpoints
- `backend/routers/schools_v2.py` — directory + profile endpoints
- `backend/routers/plan.py` — plan generate/status/retrieve endpoints
- `backend/routers/account.py` — account settings endpoints
- `backend/routers/admin.py` — admin data refresh + ML train endpoints
- Updated `backend/tests/` — unit tests for all new services and endpoints
- `skills/backend-engineer.md` — skills file (create or append)

---
*Packet owner: Backend Engineer. All items PENDING.*
