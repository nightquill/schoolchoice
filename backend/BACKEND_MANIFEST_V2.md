# Backend Manifest — v2 New Endpoints
# Date: 2026-03-28 (updated)

All endpoints are prefixed `/api/v1/`. "Protected" = Bearer JWT required.

---

## Grades (REQ-068)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| GET | /students/{id}/grades | StudentSubjectGrade DB query | REQ-068 | Protected | DONE |
| POST | /students/{id}/grades | create grade + recompute predicted | REQ-068 | Protected | DONE |
| PUT | /students/{id}/grades/{grade_id} | update grade + recompute predicted | REQ-068 | Protected | DONE |
| DELETE | /students/{id}/grades/{grade_id} | delete grade record | REQ-068 | Protected | DONE |
| GET | /grades/subjects | list all HKDSE subjects (ordered by category, name) | — | Protected | DONE |

---

## Targets (REQ-069)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| GET | /students/{id}/targets | list targets with stored scores | REQ-069 | Protected | DONE |
| POST | /students/{id}/targets | add school to target list | REQ-069 | Protected | DONE |
| PUT | /students/{id}/targets/{target_id} | update status/rank | REQ-069 | Protected | DONE |
| DELETE | /students/{id}/targets/{target_id} | remove target | REQ-069 | Protected | DONE |
| POST | /students/{id}/targets/reorder | atomically reassign ranks | REQ-069 | Protected | DONE |

---

## Schools v2 (REQ-070, REQ-071)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| GET | /schools | search + filter paginated school list | REQ-070 | Protected | DONE |
| GET | /schools/{id} | full school profile | REQ-071 | Protected | DONE |

---

## Match (REQ-072–REQ-076)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| POST | /students/{id}/match | run matchmaker_v2 pipeline, save scores | REQ-072–076 | Protected | DONE |
| GET | /students/{id}/match | return stored match results | REQ-069 | Protected | DONE |
| GET | /students/{id}/recommendations/auto | top school+major recommendations; now returns major_name, major_jupas_code | REQ-076 | Protected | DONE |

Notes:
- POST /match and GET /recommendations/auto now return `major_name` and `major_jupas_code` fields.
- Schools with `major_requirements` are expanded into one MatchResult per eligible major.
- Schools without `major_requirements` emit a single MatchResult with `major_name=null`.

---

## Plan (REQ-078)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| POST | /students/{id}/plan | enqueue plan generation (BackgroundTask) | REQ-078 | Protected | DONE |
| GET | /students/{id}/plan/status | return latest job status | REQ-078 | Protected | DONE |
| GET | /students/{id}/plan | return HTML plan or 404 | REQ-078 | Protected | DONE |
| POST | /students/{id}/plan/chat | counsellor AI chat edit (Gemini 2.5 Flash) | — | Protected | DONE |
| PATCH | /students/{id}/plan/template | change visual template + regenerate HTML | — | Protected | DONE |
| PATCH | /students/{id}/plan/section | upsert per-section HTML override + regenerate | — | Protected | DONE |
| DELETE | /students/{id}/plan/section/{key} | remove section override + regenerate | — | Protected | DONE |

Notes:
- `POST /students/{id}/plan` accepts an optional JSON body: `{"plan_type": "UNIVERSITY"}` (default) or `{"plan_type": "HIGH_SCHOOL"}`.
- **UNIVERSITY plan** (default): 7-section plan with school fit scores, gap analysis, IELTS readiness, skill gaps, and action timeline. Each school card includes a "What drives this score" SHAP breakdown (top 4 features by magnitude, direction arrow, % contribution, explanation). SHAP section is skipped gracefully if `shap_explanation` is None.
- **Charts in UNIVERSITY plan** (Point 15): Chart.js v4 (CDN) is loaded in `<head>`. Each eligible school card shows a Subject Grade Profile (horizontal bar chart, 0–7 x-axis, red reference line at per-subject minimum) and a School Fit Radar (4 axes: Academic Fit, Subject Alignment, Language Fit, Program Alignment). An SVG Gantt timeline is rendered after all school cards, grouping action items by quarter (Q1–Q4 for current + next year), colour-coded by priority. `@media print { canvas { max-width: 100% !important; } }` included.
- **HIGH_SCHOOL plan**: 5-section plan. No Chart.js, no IELTS section, no major recommendations. Subject analysis shows grade, numeric value, Strength (≥5) / On Track (4) / Needs Improvement (<4). Title: "High School Academic Plan".
- **Plan Chat** (Point 16): `POST /plan/chat` sends counsellor message to Gemini 2.5 Flash with compact JSON plan context; Gemini returns a JSON patch which is applied to `recommended_schools` / `action_items` / `overrides`; HTML is regenerated; version is incremented. Returns 503 if `GEMINI_API_KEY` not set. Rate-limited: 20 requests per counsellor per plan per calendar day (stored in `chat_request_counts`).
- **Templates + overrides** (Point 17): `AcademicPlan` now has `template_id` (professional/modern/minimal) and `overrides` (per-section HTML). `generate_html_plan()` accepts `template_id` and `overrides` kwargs. Available templates inject CSS variable overrides: professional (navy/Georgia), modern (teal/Inter), minimal (black/Arial). Section keys: `student_summary`, `school_{N}_rationale`, `action_plan_notes`.

---

## Account (REQ-079)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| GET | /account | return current user info | REQ-079 | Protected | DONE |
| PATCH | /account | update display_name, preferred_language | REQ-079 | Protected | DONE |
| POST | /account/change-password | verify + update password | REQ-079 | Protected | DONE |
| DELETE | /account | soft-delete (is_active=False) | REQ-079 | Protected | DONE |

---

## Transcripts (REQ-067)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| POST | /students/{id}/transcript | multipart upload + async parse | REQ-067 | Protected | DONE |
| GET | /students/{id}/transcript | return parse status + suggestions | REQ-067 | Protected | DONE |

---

## Analytics

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| GET | /analytics/hkdse-trends | aggregate grade distributions; `?subject_code=` param added | — | Protected | DONE |
| GET | /analytics/hkdse-population | population-level HKDSE stats from hkdse_subject_stats.json; `?subject_code=` optional | — | Protected | DONE |
| GET | /analytics/popular-majors | most intended majors across targets + graduates | — | Protected | DONE |
| GET | /analytics/student-directory | anonymized past student outcomes | — | Protected | DONE |
| GET | /analytics/subject-combinations | elective combo frequencies | — | Protected | DONE |

---

## Admin (REQ-080)

| Method | Path | Service | REQ-ID | Auth | Status |
|--------|------|---------|--------|------|--------|
| POST | /admin/data-refresh | trigger data agent (stub) | REQ-080 | Admin only | DONE |
| GET | /admin/data-refresh/status | return last refresh status | REQ-080 | Admin only | DONE |

---

## New Service Modules

| Module | File | REQ-IDs |
|--------|------|---------|
| hkdse_service | app/services/hkdse_service.py | REQ-063, REQ-064, REQ-065, REQ-066 |
| matchmaker_v2 | app/services/matchmaker_v2.py | REQ-072, REQ-073, REQ-074, REQ-075, REQ-076 |
| plan_generator | app/services/plan_generator.py | REQ-077 |
| plan_chat_service | app/services/plan_chat_service.py | — (Point 16) |

## New Schema Files

| File | Purpose |
|------|---------|
| app/schemas/v2/plan_chat.py | PlanChatRequest / PlanChatResponse |
| app/schemas/v2/plan_edit.py | SetTemplateRequest / EditSectionRequest |

## New ORM Models

| Class | Table | REQ-IDs |
|-------|-------|---------|
| GradeSystem | grade_systems | REQ-053 |
| Subject | subjects | REQ-054, REQ-065 |
| StudentSubjectGrade | student_subject_grades | REQ-055, REQ-068 |
| Transcript | transcripts | REQ-056, REQ-067 |
| StudentSchoolTarget | student_school_targets | REQ-059, REQ-069 |
| AcademicPlan | academic_plans | REQ-060, REQ-077 |
| PlanGenerationJob | plan_generation_jobs | REQ-049, REQ-078 |

### AcademicPlan new columns (Points 16/17)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| template_id | VARCHAR(50) | 'professional' | Active visual template |
| overrides | JSON | {} | Per-section HTML overrides |
| chat_request_counts | JSON | {} | Daily rate-limit counters keyed by `{date}:{counsellor_id}:{plan_id}` |

## v1 Model Patches (additive only)

- User: added role, display_name, preferred_language, is_active columns
- Student: added 14 v2 columns (date_of_birth, gender, address, phone, email, class_name, year_of_study, candidate_number, preferred_language, ielts_score, other_language_scores, teacher_evaluation, extra_curricular, awards, financial_aid_flag, notes) + 5 relationships
- School: added 13 v2 columns (name_zh, type, website, description, minimum_entry_score, required_subjects, language_requirements, faculties, notable_programs, acceptance_rate, average_admitted_score, scholarship_available, data_source, data_last_updated) + 1 relationship
