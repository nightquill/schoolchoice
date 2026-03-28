# PM Master Requirements Register — v2 Delta
# Intelligent Academic Advisor — v2 Pipeline
# Parsed from: preferences.md (v2)
# Date: 2026-03-27
# Status: BASELINE
# Note: REQ-001 through REQ-042 are defined in pm_master_requirements.md and are DONE.
#       This file registers NEW requirements only, starting at REQ-043.

---

## Legend

| Domain Tag | Meaning |
|---|---|
| [ARCH] | System architecture and structural constraints |
| [BACKEND] | FastAPI / Python server-side logic |
| [DATABASE] | PostgreSQL schema and data persistence |
| [FRONTEND] | React client-side application |
| [UI] | Page layout, user interaction, and display requirements |
| [INTEGRATION] | Wiring between layers; end-to-end workflow |
| [DATA] | Data Agent: gathering, structuring, and seeding external data |
| [ML] | Machine learning matchmaking pipeline (XGBoost + SHAP) |

---

## REQ-043 [ARCH]
**Description:** Every agent in the system must maintain a skills file at `skills/<agent-name>.md`. Skills files are append-only, never deleted, and must document reusable patterns, mistakes, efficient approaches, tool usage insights, and domain knowledge acquired.
**Source:** preferences.md §0
**Priority:** Must Have (process constraint)

---

## REQ-044 [ARCH]
**Description:** The product manager must read all agent skills files at the start of every pipeline run.
**Source:** preferences.md §0
**Priority:** Must Have (process constraint)

---

## REQ-045 [ARCH]
**Description:** The system must support multiple grade systems in the data model: HKDSE, A-Level, IB, and Custom. HKDSE is the only fully implemented path for the MVP; the others must be present in the UI as selectable options but may show placeholder content.
**Source:** preferences.md §1, §5
**Priority:** Must Have

---

## REQ-046 [ARCH]
**Description:** Matchmaking and ML scoring must live entirely within the backend as a Python service module. No LLM may be used in the matching pipeline.
**Source:** preferences.md §8
**Priority:** Must Have (constraint)

---

## REQ-047 [ARCH]
**Description:** The system must implement a Counsellor user role. Counsellors may view and edit any student profile, generate plans, and see all students.
**Source:** preferences.md §12
**Priority:** Must Have

---

## REQ-048 [ARCH]
**Description:** An Admin role must exist with the ability to trigger a data-agent refresh. Admin-only pages must be access-controlled.
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-049 [ARCH]
**Description:** All API read responses must complete in under 500ms. Plan generation (up to 10 seconds) and transcript parsing are explicitly exempted and must use background tasks with polling.
**Source:** preferences.md §13
**Priority:** Must Have (non-functional)

---

## REQ-050 [ARCH]
**Description:** All user data must be encrypted at rest. The System Architect must evaluate PostgreSQL column-level encryption versus full-disk encryption and document the decision in an Architecture Decision Record (ADR).
**Source:** preferences.md §13
**Priority:** Must Have

---

## REQ-051 [ARCH]
**Description:** All UI components must conform to WCAG AA accessibility standards.
**Source:** preferences.md §13
**Priority:** Must Have (non-functional)

---

## REQ-052 [ARCH]
**Description:** All pages must be mobile-responsive.
**Source:** preferences.md §13
**Priority:** Must Have (non-functional)

---

## REQ-053 [DATABASE]
**Description:** The database must store a GradeSystem entity with fields: id (UUID), name (enum: HKDSE, A_LEVEL, IB, CUSTOM), description. Timestamps (created_at, updated_at) required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-054 [DATABASE]
**Description:** The database must store a Subject entity with fields: id (UUID), grade_system_id (FK → GradeSystem), name, code, category (enum: CORE, ELECTIVE, OTHER_LANGUAGE, APPLIED_LEARNING), is_compulsory (boolean), hkdse_subject_code (nullable). Timestamps required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-055 [DATABASE]
**Description:** The database must store a StudentSubjectGrade entity with fields: id (UUID), student_id (FK), subject_id (FK), year_of_exam, sitting (enum: MOCK, TRIAL, OFFICIAL), raw_grade (string), predicted_grade (string, nullable), transcript_uploaded (boolean), transcript_file_path (nullable), notes. Timestamps required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-056 [DATABASE]
**Description:** The database must store a Transcript entity with fields: id (UUID), student_id (FK), file_path, uploaded_at, parsed_data (JSONB). Timestamps required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-057 [DATABASE]
**Description:** The Student entity must be expanded to include all fields defined in preferences.md §3.1: personal (full_name, date_of_birth, gender, address, phone, email), academic (class_name, year_of_study, candidate_number), language (preferred_language, ielts_score, ielts_date, other_language_scores JSONB), teacher_evaluation (JSONB), extra_curricular (JSONB), awards (JSONB), financial_aid_flag (boolean), notes. All new fields are nullable except primary key and account_id FK.
**Source:** preferences.md §3.1, §5
**Priority:** Must Have

---

## REQ-058 [DATABASE]
**Description:** The School entity must be expanded to include: name_zh (Chinese name), type (enum: UNIVERSITY, POLYTECHNIC, COMMUNITY_COLLEGE, VOCATIONAL), website, description, minimum_entry_score (integer, nullable), required_subjects (JSONB), language_requirements (JSONB), faculties (JSONB), notable_programs (JSONB), acceptance_rate (float, nullable), average_admitted_score (float, nullable), scholarship_available (boolean), data_source, data_last_updated. All nullable except PK.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-059 [DATABASE]
**Description:** The database must store a StudentSchoolTarget entity with fields: id (UUID), student_id (FK), school_id (FK), student_rank (integer), match_score (float), eligibility_pass (boolean), shap_explanation (JSONB), status (enum: CONSIDERING, APPLIED, ADMITTED, REJECTED, WITHDRAWN). Timestamps required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-060 [DATABASE]
**Description:** The AcademicPlan entity must be expanded to include: id (UUID), student_id (FK), generated_at, recommended_schools (JSONB ordered list with rationale), action_items (JSONB array with task/deadline/related_school_id/priority), html_content (text — full rendered HTML document), version (integer). Timestamps required.
**Source:** preferences.md §3.1
**Priority:** Must Have

---

## REQ-061 [DATABASE]
**Description:** All mutable tables must carry created_at and updated_at timestamps. All primary keys must be UUID. JSONB must be used for all variable-structure data fields. No field may be removed without a migration and a PM ruling.
**Source:** preferences.md §3.3
**Priority:** Must Have (schema rules)

---

## REQ-062 [DATABASE]
**Description:** The database relationships must be enforced: Student →[has many]→ StudentSubjectGrade; Student →[has many]→ StudentSchoolTarget →[references]→ School; Student →[has one]→ AcademicPlan; Subject →[belongs to]→ GradeSystem; StudentSubjectGrade →[references]→ Subject.
**Source:** preferences.md §3.2
**Priority:** Must Have

---

## REQ-063 [BACKEND]
**Description:** The backend must implement the HKDSE grading scale with numeric equivalents: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0, X=0. This mapping must be used in all scoring and aggregate calculations.
**Source:** preferences.md §4.1
**Priority:** Must Have

---

## REQ-064 [BACKEND]
**Description:** The backend must seed or validate that the four HKDSE compulsory subjects exist: Chinese Language (CHLA), English Language (ENGL), Mathematics Compulsory Part (MATH), Liberal Studies / Citizenship and Social Development (CSD).
**Source:** preferences.md §4.2
**Priority:** Must Have

---

## REQ-065 [BACKEND]
**Description:** The backend must support the full HKDSE elective subject list as defined in preferences.md §4.3, including Arts & Humanities, Business & Economics, STEM, Languages, and Applied Learning (ApL) subjects. ApL subjects are stored as free-text with grades: Attained or Attained with Distinction.
**Source:** preferences.md §4.3
**Priority:** Must Have

---

## REQ-066 [BACKEND]
**Description:** The backend must implement predicted grade logic: (1) if only one non-official sitting exists, use that grade as predicted; (2) if multiple mock/trial sittings exist, use the most recent with a note; (3) if teacher_evaluation contains a rating for that subject, apply weighted average: 70% latest sitting grade + 30% teacher rating mapped to grade scale. Predicted grades must never overwrite official grades.
**Source:** preferences.md §4.4
**Priority:** Must Have

---

## REQ-067 [BACKEND]
**Description:** The backend must expose an API endpoint to upload a transcript file (PDF or image) for a student. The parsing must be performed asynchronously. Parsed grades must be returned as suggestions only — the system must never auto-save parsed grades to StudentSubjectGrade.
**Source:** preferences.md §4.5
**Priority:** Must Have

---

## REQ-068 [BACKEND]
**Description:** The backend must expose CRUD endpoints for StudentSubjectGrade: create, read (by student), update, delete. Endpoints must accept all fields defined in REQ-055.
**Source:** preferences.md §3.1, §5
**Priority:** Must Have

---

## REQ-069 [BACKEND]
**Description:** The backend must expose CRUD endpoints for StudentSchoolTarget: create, read (by student), update (including student_rank for reordering and status), delete.
**Source:** preferences.md §3.1, §6
**Priority:** Must Have

---

## REQ-070 [BACKEND]
**Description:** The backend must expose an endpoint to list all schools in the database with search and filter support (by name, type, location, minimum_entry_score range).
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-071 [BACKEND]
**Description:** The backend must expose an endpoint to retrieve a single school's full profile.
**Source:** preferences.md §6, §11
**Priority:** Must Have

---

## REQ-072 [BACKEND]
**Description:** The backend must implement the v2 eligibility filter: a school fails eligibility if (a) student's best HKDSE aggregate (best 5 subjects including compulsory) is below school's minimum_entry_score, (b) student is missing a required subject, or (c) student's IELTS score is below school's language requirement. Ineligible schools must still be returned, marked INELIGIBLE with the specific failing criterion.
**Source:** preferences.md §8.1
**Priority:** Must Have

---

## REQ-073 [BACKEND]
**Description:** The backend must implement the v2 weighted scoring model (fit_score 0.0–1.0): academic fit 50% (aggregate vs average_admitted_score), subject alignment 20%, language fit 15%, interest/program alignment 15%. If average_admitted_score is null, use minimum_entry_score + 2 as proxy.
**Source:** preferences.md §8.2
**Priority:** Must Have

---

## REQ-074 [ML]
**Description:** The backend must implement an XGBoost classifier for ML-based admission probability. Features: aggregate score, subject grades, IELTS score, extracurricular count, award level. Output: probability 0–1. Final score when ML model is trained: 0.6 × weighted_score + 0.4 × ml_probability.
**Source:** preferences.md §8.2
**Priority:** Should Have

---

## REQ-075 [ML]
**Description:** SHAP values must be computed for every student–school pair scored by the ML model. The top 3 contributing SHAP features must be stored as shap_explanation JSONB on StudentSchoolTarget and displayed to the user in plain English.
**Source:** preferences.md §8.2, §8.4
**Priority:** Should Have

---

## REQ-076 [BACKEND]
**Description:** The matching engine must apply a preference adjustment in the ranking step: if a student has ranked a school in their target list, boost that school's display rank by one position per preference rank point above median (Gale-Shapley preference reflection).
**Source:** preferences.md §8.3
**Priority:** Should Have

---

## REQ-077 [BACKEND]
**Description:** The backend must generate the AcademicPlan as a fully rendered HTML document (stored in AcademicPlan.html_content) containing all 7 sections: (1) Student Summary, (2) Academic Profile, (3) Recommended Schools with gap analysis, (4) Action Plan Timeline grouped by quarter, (5) Skill & Activity Gaps, (6) Language Readiness, (7) Appendix. HTML must use inline CSS only, include @media print stylesheet, and contain no JavaScript.
**Source:** preferences.md §9.1, §9.2
**Priority:** Must Have

---

## REQ-078 [BACKEND]
**Description:** The backend must expose GET /api/v1/students/{id}/plan which returns the rendered HTML academic plan document. Plan generation must run as a background task; a polling endpoint must be provided to check generation status.
**Source:** preferences.md §9.2, §13
**Priority:** Must Have

---

## REQ-079 [BACKEND]
**Description:** The backend must expose account settings endpoints: GET and PATCH for display name, preferred language, and notification preferences. Password change must require current password verification. Account deletion must be soft-delete only (sets account inactive), requiring password confirmation.
**Source:** preferences.md §10
**Priority:** Must Have

---

## REQ-080 [BACKEND]
**Description:** The backend must expose an admin-only endpoint to trigger a data-agent refresh run. This endpoint must be restricted to accounts with admin role.
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-081 [DATA]
**Description:** The Data Agent must gather real HKDSE subject lists with official subject codes and grade distributions from HKEAA published reports.
**Source:** preferences.md §7.1, §7.2
**Priority:** Must Have

---

## REQ-082 [DATA]
**Description:** The Data Agent must gather Hong Kong university and tertiary institution profiles including admission requirements (minimum HKDSE scores, required subjects, language requirements) from JUPAS entry score data and individual university admissions pages.
**Source:** preferences.md §7.1, §7.2
**Priority:** Must Have

---

## REQ-083 [DATA]
**Description:** The Data Agent must gather JUPAS historical median and lower quartile entry scores per program.
**Source:** preferences.md §7.2
**Priority:** Must Have

---

## REQ-084 [DATA]
**Description:** The Data Agent must document every source URL, access date, and data freshness in data/sources.md. Any data that is estimated or inferred rather than officially published must be flagged as such.
**Source:** preferences.md §7.2
**Priority:** Must Have

---

## REQ-085 [DATA]
**Description:** The Data Agent must produce the following output files: data/sources.md, data/raw/<source>.json (per source), data/processed/schools.json, data/processed/subjects.json, data/processed/jupas_scores.json, data/seed/seed_schools.sql, data/seed/seed_subjects.sql.
**Source:** preferences.md §7.4
**Priority:** Must Have

---

## REQ-086 [DATA]
**Description:** The Data Agent must follow token-efficient fetch rules: fetch index pages first, use CSS selectors for targeted extraction, cache fetched content to data/cache/ before processing, never re-fetch a cached URL in the same run, write extracted data to data/raw/ incrementally, and never fetch the same URL twice in one run.
**Source:** preferences.md §7.3
**Priority:** Must Have (process constraint)

---

## REQ-087 [DATA]
**Description:** The Data Agent must refresh its data when preferences.md indicates a new academic year.
**Source:** preferences.md §7.2
**Priority:** Should Have

---

## REQ-088 [FRONTEND]
**Description:** The frontend must provide a Dashboard page showing an overview of all students for a Counsellor, including quick-access links to each student profile.
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-089 [FRONTEND]
**Description:** The frontend must provide a fully tabbed Student Profile page with tabs: Personal Information, Grades, Language Scores, Teacher Evaluations, Extracurricular & Awards, Notes. All fields defined in preferences.md §5 must be exposed.
**Source:** preferences.md §5, §11
**Priority:** Must Have

---

## REQ-090 [FRONTEND]
**Description:** The Grades tab on the Student Profile must display a subject grade entry table with columns: Subject (dropdown), Sitting (Mock/Trial/Official), Grade (dropdown matching selected grade system), Predicted Grade (auto-calculated or manual override), Transcript Uploaded (checkbox), Notes. Multiple sittings for the same subject must be supported.
**Source:** preferences.md §5
**Priority:** Must Have

---

## REQ-091 [FRONTEND]
**Description:** Predicted grades must be visually distinguished from official grades in the UI (e.g., italics, colour indicator, or badge).
**Source:** preferences.md §4.4
**Priority:** Must Have

---

## REQ-092 [FRONTEND]
**Description:** The frontend must provide a Student Target Schools page displaying each StudentSchoolTarget with: match score, eligibility pass/fail indicator, SHAP explanation summary (top 3 features in plain English), student preference rank, and current application status.
**Source:** preferences.md §6
**Priority:** Must Have

---

## REQ-093 [FRONTEND]
**Description:** The Student Target Schools page must support drag-to-reorder preference ranking. Reordering must persist to the backend via a PATCH to StudentSchoolTarget.student_rank.
**Source:** preferences.md §6
**Priority:** Must Have

---

## REQ-094 [FRONTEND]
**Description:** The frontend must provide a School Directory page with a searchable and filterable list of all schools (filter by name, type, location, minimum entry score range).
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-095 [FRONTEND]
**Description:** The frontend must provide a School Profile page displaying: English and Chinese name, type, location, website, minimum HKDSE entry requirements, language requirements, notable programs/faculties, acceptance rate, average admitted score, scholarship information, data source, and last updated date.
**Source:** preferences.md §6, §11
**Priority:** Must Have

---

## REQ-096 [FRONTEND]
**Description:** The frontend must provide an Academic Plan page that renders the HTML plan document from AcademicPlan.html_content in an iframe or dedicated full-page route. The rendered plan must be printable.
**Source:** preferences.md §9.2, §11
**Priority:** Must Have

---

## REQ-097 [FRONTEND]
**Description:** The frontend must provide an Account Settings page with: email display (read-only), display name (editable), password change form (current + new + confirm), preferred language selector (English / 中文), notification preferences toggle (placeholder), and delete account button (requires password confirmation).
**Source:** preferences.md §10, §11
**Priority:** Must Have

---

## REQ-098 [FRONTEND]
**Description:** The frontend must provide an Admin: Data Refresh page (admin-only, access-controlled) that triggers the data-agent re-run via the admin endpoint and shows the current status of the last refresh.
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-099 [FRONTEND]
**Description:** The frontend must implement the plan generation trigger as an async flow: show a loading/polling state while the background task runs, then display the completed plan when ready.
**Source:** preferences.md §13
**Priority:** Must Have

---

## REQ-100 [FRONTEND]
**Description:** The frontend must provide a transcript upload UI on the Student Profile Grades tab: a file upload control accepting PDF or image, and a review/confirm interface for parsed grades (show suggested grades from parsed_data, allow the user to accept or discard each suggestion individually before saving).
**Source:** preferences.md §4.5
**Priority:** Must Have

---

## REQ-101 [UI]
**Description:** The School Directory page must include filter controls: text search by name, type dropdown, location filter, and minimum entry score range slider or numeric inputs.
**Source:** preferences.md §11
**Priority:** Must Have

---

## REQ-102 [UI]
**Description:** The SHAP explanation for each student–school pair must be displayed as a short plain-English summary (top 3 features) on both the Student Target Schools page and within the Academic Plan Recommended Schools section.
**Source:** preferences.md §8.2, §9.1
**Priority:** Must Have

---

## REQ-103 [UI]
**Description:** Ineligible schools in the Student Target Schools list must be visually distinguished (e.g., greyed out or badged INELIGIBLE) and must display the specific failing criterion.
**Source:** preferences.md §8.1
**Priority:** Must Have

---

## REQ-104 [UI]
**Description:** The Student Profile page grade system selector (HKDSE / A-Level / IB / Custom) must default to HKDSE. Selecting a non-HKDSE system may show a placeholder indicating partial support.
**Source:** preferences.md §5
**Priority:** Must Have

---

## REQ-105 [INTEGRATION]
**Description:** The integration engineer must validate the end-to-end async plan generation flow: trigger plan generation, poll for completion, verify HTML content is stored and retrievable, and verify the frontend renders it correctly.
**Source:** preferences.md §9.2, §13
**Priority:** Must Have

---

## REQ-106 [INTEGRATION]
**Description:** The integration engineer must validate the transcript upload and async parsing flow: upload a file, verify async parsing is triggered, verify parsed_data is stored in Transcript, verify suggestions are presented to the user without auto-saving.
**Source:** preferences.md §4.5, §13
**Priority:** Must Have

---

## REQ-107 [INTEGRATION]
**Description:** The integration engineer must validate that all API read endpoints respond within 500ms under normal load conditions (single-user, local environment).
**Source:** preferences.md §13
**Priority:** Must Have

---

## REQ-108 [INTEGRATION]
**Description:** The integration engineer must validate drag-to-reorder on the Student Target Schools page persists correctly to the database.
**Source:** preferences.md §6
**Priority:** Must Have

---

---
*End of Master Requirements Register v2 Delta — REQ-043 through REQ-108 (66 new requirements).*
