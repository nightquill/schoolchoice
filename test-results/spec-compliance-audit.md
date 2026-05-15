# Spec Compliance Audit

Audited: 2026-05-13
Source specs: `docs/ux-walkthrough.html`, `docs/tech-stack.html`
Codebase: `apps/web/`, `packages/ui/`, `backend/`

---

## UX Walkthrough Compliance

### Journey 1: First-Time Setup

- Register & Login: **Implemented** — `LoginPage.jsx`, `RegisterPage.jsx`, backend `auth.py` with rate limiting (10/min register, 15/min login), JWT token, bcrypt
- Onboarding Wizard (4 steps): **Implemented** — `Onboarding.jsx` has all 4 steps: Welcome, School Info, Import, Ready
- Onboarding Step 2 — Organisation creation: **Partial** — Onboarding collects school name but does NOT call any API to create an Organisation. The school name input is purely cosmetic (stored nowhere). Spec says "creates Organisation for multi-tenancy isolation" but the onboarding code just sets `schoolName` in local state and moves to step 3. Organisation must be created separately (e.g., via admin or seed scripts).
- Onboarding Step 3 — Import Students: **Implemented** — Links to `/entities/student/import` (ImportWizardPage). Also has "Skip for now" button.
- Auto-redirect to onboarding on first login: **Implemented** — Dashboard checks `onboarding_complete` in localStorage and redirects if no students exist.
- Bulk Import (CSV/Excel): **Implemented** — `ImportWizardPage.jsx`, backend entity import endpoints (parse/validate/commit). Supports column mapping and validation preview.

### Journey 2: Daily Dashboard

- Metrics Row: **Partial** — Shows "Total Students", "Plans Generated", and "Pending Submissions" (not "Schools" as spec shows). Third metric differs from spec (spec says "Schools", code says "Pending Submissions"). Config-driven entity counts are appended dynamically.
- Alerts Panel: **Implemented** — `AlertsPanel.jsx` component fetches from `GET /alerts`. Backend `alert_service.py` generates alerts for: missing grades, missing targets, at-risk targets, stale data (>30 days). Categorized by severity (error/warning/info).
- Search by name: **Implemented** — Text search filters students client-side.
- Filter by Class dropdown: **Missing** — Spec shows "All Classes" and "All Years" filter dropdowns. Dashboard only has a text search bar. No class or year filter dropdowns exist.
- Student Cards (3-column grid): **Partial** — Students appear in search results (3-column grid), but the dashboard default view shows cohort cards, not student cards. Spec shows student cards always visible; implementation only shows them when searching.
- "View Profile" link on each card: **Implemented** — Each search result card navigates to `/students/{id}/profile`.
- Cohort-centric layout: **Divergence** — Dashboard is cohort-centric (shows cohort cards as primary navigation), which differs from the spec's student-card-centric layout. This is an intentional UX redesign per `project_ux_overhaul_pending.md`.

### Journey 3: Building a Student Profile

- 7-tab profile: **Partial (5 tabs instead of 7)** — Spec defines 7 tabs: Personal, Grades, Language, Teacher Evaluations, Activities, Notes, Plans. Implementation has 5 tabs: Programme Choices, Grades, Plans, Personal, Other. The "Language" tab content is embedded under the Grades tab. "Teacher Evaluations", "Activities", and "Notes" are collapsed into the "Other" tab with sub-toggles. "Programme Choices" is a new tab (not in spec) that embeds target school management inline.
- Personal tab fields: **Implemented** — Full name, preferred name, DOB (with age calc), gender, address, phone, email, class, year, candidate number, preferred language, financial aid flag, personal statement. All present in `PersonalTab.jsx` and `usePersonalTab.js`.
- Autosave for Personal tab: **Implemented** — `useAutosave.js` saves drafts to localStorage every 2s. Manual Save button commits to server.
- Grades tab: **Implemented** — Subject dropdown, sitting (MOCK/TRIAL/OFFICIAL), grade selection, notes. Shows grades table with predicted grade badges. Manual "Save Grade" per entry.
- Transcript upload & parse: **Implemented** — `FileUpload` component in `GradesTab.jsx`, backend `transcripts.py` with async parsing. Accept/dismiss parsed suggestions. PDF/image support.
- Language tab (IELTS): **Implemented** — Overall band, listening, reading, writing, speaking (number inputs), test date. Other language scores (dynamic rows). Embedded under Grades tab rather than separate tab.
- Teacher Evaluations: **Implemented** — `EvaluationsTab.jsx` with cards: subject code, teacher name, star rating (1-5), comment, date. "Add Evaluation" button. Embedded in "Other" tab.
- Activities & Awards: **Implemented** — `ActivitiesTab.jsx` with extracurricular activities (name, role, years, achievement) and awards (title, awarding body, level, year). Separate save buttons. Embedded in "Other" tab.
- Notes tab: **Implemented** — `NotesTab.jsx` with autosave (debounced via `useNotesTab`). Shows "Saving..." / "Saved" status. Embedded in "Other" tab.
- Plans tab: **Implemented** — `PlansTab.jsx` shows plan history with version, timestamp. Click to view HTML in iframe. Delete button. "Generate New Plan" button.
- "Target Schools" button in profile header: **Partial** — No separate "Target Schools" button. Instead, programme choices are embedded as the first tab (Programme Choices). The old `/students/{id}/targets` URL redirects to `profile?tab=programmes`.
- "Generate Plan" button: **Implemented** — In profile header, navigates to `/students/{id}/consultant?generate=true`.
- "Mark as Graduated" button: **Implemented** — Dialog with final school dropdown, final major text, graduation year. `graduateStudent` API call.

### Journey 4: Picking Target Schools

- View current targets (ranked list): **Implemented** — Both in `TargetSchools.jsx` (standalone page, now redirect) and `ProgrammeChoicesTab.jsx` (inline tab). Shows rank badges, school name, programme name, JUPAS code, match score, eligibility badge, at-risk flag, SHAP summary, status chip.
- Add new target (school search): **Implemented** — Modal with search across all programmes. `getAllProgrammes` from JUPAS API. Existing targets excluded.
- AI-powered recommendations: **Implemented** — `getAutoRecommendations` from `match.py` API. Shows fit score and match percentage for each recommendation.
- Eligibility & risk signals: **Implemented** — `EligibilityBadge` component (ELIGIBLE/INELIGIBLE). At-risk badge. Match score color coding (green >=70%, yellow 40-69%, red <40%). Failing criteria shown via tooltip.
- Reorder preferences (up/down): **Implemented** — ChevronUp/ChevronDown buttons. `reorderTargets` API call.
- Edit target details: **Implemented** — Edit modal with intended majors, year of entry, application status (CONSIDERING/APPLIED/ADMITTED/REJECTED/WITHDRAWN), confidence slider (1-5: Unsure to Decided).
- "By Major" view toggle: **Implemented in TargetSchools.jsx only** — `MajorView` component exists in standalone TargetSchools page. NOT present in `ProgrammeChoicesTab.jsx` (the tab that replaced it).
- Preference confidence labels: **Implemented** — Maps 1-5 to Unsure/Exploring/Interested/Strong/Decided.
- View / Edit / Remove actions: **Implemented** — View navigates to school profile, Edit opens modal, Remove deletes target.

### Journey 5: Generating an Academic Plan

- Trigger generation ("Generate Plan"): **Implemented** — Button in profile header navigates to ConsultantTask page with `?generate=true`.
- SSE streaming (real-time tokens): **Implemented** — `ConsultantTask.jsx` uses `EventSource` for SSE streaming from `GET /consultant/tasks/academic_plan/stream`. `SSEStreamDisplay` component renders tokens in real-time.
- "Stop Generation" button: **Implemented** — `handleStopGeneration` closes EventSource.
- Template switching (Professional/Modern/Minimal): **Implemented** — `TemplateSelector` component, `setPlanTemplate` API. 3 Jinja2 templates exist: `professional.html.j2`, `modern.html.j2`, `minimal.html.j2`.
- Per-section editing: **Implemented** — `PlanSectionEditor` component. Sections: student_summary, school_N_rationale, action_plan_notes. Save/Reset per section.
- AI Chat: **Implemented** — Chat panel in ConsultantTask with message history. `sendConsultantChat` API call. Rate limiting (20 req/plan/24h). Handles 429 and 503 errors gracefully.
- Export HTML: **Implemented** — `exportPlanHTML` function. Download button with loading state.
- Consultant Task page (split layout): **Implemented** — Two-column layout: plan output (left) + chat panel (right). Mobile chat toggle.
- Plan contents (header, metrics, assessment, schools, action items): **Implemented** — Plan generator builds all sections per spec. Templates include student header, key metrics, assessment, top 5 schools with SHAP features, action items, counselor-only section.

### Journey 6: Managing Cohorts

- Create cohorts: **Implemented** — Dashboard has "New Cohort" button with dialog. Also `CohortList` page (redirects to dashboard). Backend `POST /cohorts`.
- Add students to cohort: **Implemented** — `CohortDetail.jsx` has "Add Students" modal with search. Checkbox-select multiple students. Backend `POST /cohorts/{id}/members`.
- Bulk edit grades: **Implemented** — `BulkEdit.jsx` with `GradeGrid` component. Rows = students, columns = subjects. Tab switching between MOCK/TRIAL/OFFICIAL sittings.
- View cohort report: **Implemented** — `CohortReport.jsx` fetches all three report types:
  - Target Distribution: **Implemented** — Bar chart per school with student count and avg score.
  - Risk Breakdown: **Implemented** — Students with at-risk targets, grouped by class.
  - Subject Performance: **Implemented** — Mean grade, variance, distribution per subject. Filter by sitting.

### Journey 7: Data Analysis

- HKDSE Grade Trends tab: **Implemented** — `DataAnalysis.jsx` with `VerticalBarChart` component. Grade distribution per subject. Filter by sitting, cohort, category.
- Subject Combinations tab: **Implemented** — `getSubjectCombinations` (via analytics API — `subject_combinations` logic in `analytics.py`). Frequency analysis.
- Popular Majors tab: **Implemented** — `getPopularMajors` API. Most targeted JUPAS programmes.
- Student Directory tab: **Implemented** — `getStudentDirectory` API. Anonymised (SHA256 hash). Shows best-5 aggregates and target counts.
- Filters (Sitting, Cohort, Category): **Implemented** — All three filter dropdowns present in DataAnalysis page.

### Journey 8: School Directory

- Search & Filter: **Implemented** — `SchoolDirectory.jsx` with text search, type dropdown (University/etc.), location filter. Pagination (20 per page).
- Add custom school: **Implemented** — "Add School" button with modal form. `createSchool` API.
- School Profile: **Implemented** — `SchoolProfile.jsx` shows school details. "Add to Targets" button with student picker modal.
- CSV export: **Implemented** — Export filtered list and export all. `exportEntityCSV` function.
- School type filter includes HIGH_SCHOOL: **Missing** — Spec mentions "High School" as a type. DB model has `UNIVERSITY | POLYTECHNIC | COMMUNITY_COLLEGE | VOCATIONAL`. "HIGH_SCHOOL" type is not in the schema constraint.

### Journey 9: Graduation & Alumni

- Mark as Graduated: **Implemented** — Profile header button. Modal with final school (dropdown), final major (text), graduation year (number). Backend `graduateStudent` endpoint.
- Graduated badge: **Implemented** — Green "Graduated {year}" badge shown in profile header when `is_graduated` is true.
- Analytics enrichment: **Partial** — Student data feeds into Popular Majors via target distribution. SHA256 anonymisation exists in student directory. However, graduation outcome data (final_school, final_major) is NOT explicitly used in analytics queries — analytics only look at targets, not actual outcomes.

### Navigation Map

- Sidebar Navigation: **Divergence** — Spec shows sidebar navigation. Implementation uses a top navigation bar (`NavBarV2`) with links: Dashboard, School Directory, Data Analysis, Submissions. Not a sidebar. No "Cohorts" link in nav (cohorts are accessed via dashboard).
- Admin pages (Settings, Data Refresh, Entity Management): **Implemented** — `AdminManage`, `AdminDataRefresh`, `EntityListPage`. Admin-only route guard.
- Account Settings: **Implemented** — `AccountSettings.jsx` at `/account/settings`.
- Cohorts link in nav: **Missing** — No direct "Cohorts" nav link. Must navigate through Dashboard cohort cards. `/cohorts` redirects to `/dashboard`.

---

## Technical Architecture Compliance

### Database Schema (12 tables per spec)

| Table | Status | Detail |
|-------|--------|--------|
| `users` | **Implemented** | email, hashed_password, role (counsellor/admin/student), display_name, is_active, preferred_language, student_id FK, must_change_password, can_manage_cohorts |
| `organisations` | **Implemented** | name, slug (unique), is_active, metadata |
| `organisation_memberships` | **Implemented** | user_id, organisation_id, role (owner/admin/member), permission (read_write/read_only) |
| `students` | **Implemented** | All v1+v2 fields present: name, grades (JSON), interests (JSON), ielts_score (JSON), extra_curricular (JSON), class_name, year_of_study, is_graduated, final_school_id, final_major, graduation_year, personal_statement, notes, etc. |
| `subjects` | **Implemented** | code, name, category (CORE/ELECTIVE/OTHER_LANGUAGE/APPLIED_LEARNING), is_compulsory, hkdse_subject_code. FK to grade_systems. |
| `student_subject_grades` | **Implemented** | student_id, subject_id, raw_grade, predicted_grade, sitting (MOCK/TRIAL/OFFICIAL), year_of_exam, transcript_uploaded |
| `schools` | **Implemented** | name, type, location, min_academic_requirements (JSON), key_strengths (JSON), acceptance_rate, is_custom, minimum_entry_score, required_subjects (JSON), language_requirements (JSON), faculties, notable_programs |
| `student_school_targets` | **Implemented** | student_id, school_id, student_rank, match_score, eligibility_pass, shap_explanation (JSON), status, preference_confidence (1-5), jupas_code, programme_name, intended_majors (JSON), year_of_entry, at_risk, risk_reasons, is_pinned, is_dismissed |
| `academic_plans` | **Implemented** | student_id, html_content, recommended_schools (JSON), action_items (JSON), template_id, overrides (JSON), version, chat_request_counts (JSON) |
| `plan_generation_jobs` | **Implemented** | student_id, status (PENDING/RUNNING/DONE/FAILED), error_message |
| `student_cohorts` | **Implemented** | user_id, organisation_id, name, description, academic_year |
| `consent_records` | **Implemented** | `consent.py` model with student_id, consent_type, granted_at, revoked_at |

**Additional tables not in spec but present:**
- `grade_systems` — Grade framework lookup (HKDSE, A_LEVEL, IB, CUSTOM)
- `cohort_memberships` — Join table for students-to-cohorts
- `plan_history` — Historical plan snapshots (version, snapshot_data)
- `jupas_programmes` — Normalised JUPAS programme data (370+ programmes)
- `recommendations` — Legacy v1 recommendation results (rank 1-5, score 0-100)
- `action_plans` — Legacy v1 action plans
- `transcripts` — Transcript upload tracking
- `cohort_permissions` — Per-cohort access overrides

### API Endpoints

| Category | Spec Count | Status | Detail |
|----------|-----------|--------|--------|
| Auth | 2 | **Implemented (3)** | register, login, student-login (extra) |
| Students | 13 | **Implemented** | CRUD + profile + language/evaluations/extracurricular/awards/graduate. 29 route files total. |
| Grades | 5 | **Implemented** | List/Create/Update/Delete + subject lookup |
| Schools & Targets | 11 | **Implemented** | School CRUD (v2) + Target CRUD + reorder + pin/dismiss |
| Matching | 5 | **Implemented** | POST /match, GET /match, GET /recommendations/auto, JUPAS search |
| Plans | 11 | **Implemented** | Generate (async) + status + get + history + chat + template + section edit |
| Consultant | 4 | **Implemented** | SSE stream + save + status + chat |
| Cohorts | 9 | **Implemented** | CRUD + members + search + stats |
| Analytics | 8 | **Implemented** | HKDSE trends + population + majors + directory + combinations + reports |
| Entities | 9 | **Implemented** | Auto-CRUD + import (parse/validate/commit) + export CSV/HTML |
| Admin | 7 | **Implemented** | User CRUD + data refresh + preview |
| Other | 21 | **Implemented** | Account, organisations, consent, alerts, methodology, transcripts |

### Matching Pipeline

- Data Assembly (`build_student_data`): **Implemented** — `student_data_builder.py`
- Eligibility Filter (`run_eligibility_filter`): **Implemented** — `matchmaker_v2.py`
- JUPAS Parametric Scoring: **Implemented** — `jupas_scorer.py` with 370+ programmes across 10 institution files
- Heuristic Fallback: **Implemented** — `matchmaker_v2.py` weighted scoring (50% academic + 20% subject + 15% language + 15% interest)
- Persist & Return (upsert targets): **Implemented**
- SHAP explanations: **Implemented** — top features stored as JSON
- Data completeness indicator: **Implemented** — BUG-02 fix in matchmaker

### Plan Generation Flow

- Async background job: **Implemented** — `PlanGenerationJob` model, background task pattern
- LiteLLM AI integration: **Implemented** — `ai_service.py` with `call_ai_stream()`
- HTML template rendering (3 templates): **Implemented** — Jinja2 templates: professional, modern, minimal
- Plan chat with rate limiting: **Implemented** — 20 req/plan/24h via `chat_request_counts`
- Section editing with save/reset: **Implemented** — `editPlanSection`, `resetPlanSection` APIs
- Plan history: **Implemented** — `PlanHistory` model, `plan_history` table

### Consultant Task (SSE Streaming)

- Task YAML definition: **Implemented** — `academic_plan.yaml`
- Data slot resolution: **Implemented** — `task_engine.py`
- Jinja2 prompt rendering: **Implemented**
- PII scan (blocklist): **Implemented** — `pii_filter.py` service, called from `task_engine.py`
- Token guard: **Implemented** — In task engine
- SSE streaming: **Implemented** — `StreamingResponse` in `consultant.py`
- Frontend SSEStreamDisplay: **Implemented** — `SSEStreamDisplay.jsx`
- PlanSectionEditor: **Implemented** — With per-section save/reset
- TemplateSelector: **Implemented** — 3 template options

### Multi-Tenancy & Auth

- JWT (HS256) with org_id claim: **Implemented** — `security.py`
- bcrypt password hashing: **Implemented**
- Axios interceptor (auto-inject Bearer, 401 redirect): **Implemented** — In `@schoolchoice/ui/api/client`
- Organisation isolation (org_id on queries): **Implemented** — `get_current_user()` attaches `active_organisation_id`
- Rate limiting: **Implemented** — `slowapi` on auth + AI endpoints
- Role-based access (counsellor, admin, student): **Implemented**

### Platform Module System

- Manifest-based auto-discovery: **Implemented** — `module_loader.py`
- YAML entity definitions: **Implemented** — `school.yaml`, `student.yaml`
- Auto-CRUD generator: **Implemented** — `crud_generator.py`
- Health checks: **Implemented** — DB + ORM parity + module health
- Task engine (YAML task -> prompt -> AI): **Implemented**

### Security & Privacy

- PII Protection (PDPO): **Implemented** — PII blocklist in `pii_filter.py`, consent tracking in `consent_records`
- Output Sanitization: **Implemented** — `_esc()` in plan generator, `nh3` usage in `plan.py`
- XSS protection (script tag detection): **Implemented** — In plan generator

### Technology Stack

| Concern | Spec | Status |
|---------|------|--------|
| React 19 + Vite | React 19 + Vite | **Match** |
| TailwindCSS | TailwindCSS | **Match** |
| TanStack Query | TanStack Query | **Match** |
| React Router 7 | React Router (v7) | **Match** |
| Axios | Axios | **Match** |
| Sonner (toasts) | Sonner | **Match** |
| Lucide React | Lucide React | **Match** |
| @base-ui/react | @base-ui/react | **Match** |
| FastAPI | FastAPI | **Match** |
| SQLAlchemy 2.0 | SQLAlchemy 2.0 | **Match** |
| Pydantic | Pydantic | **Match** |
| LiteLLM | LiteLLM | **Match** |
| python-jose (JWT) | python-jose | **Match** |
| passlib (bcrypt) | passlib | **Match** |
| slowapi | slowapi | **Match** |
| Jinja2 | Jinja2 | **Match** |
| nh3 | nh3 | **Match** |
| SQLite (dev) / PostgreSQL (prod) | SQLite + PostgreSQL | **Match** |

### Key Data Files

| File | Status |
|------|--------|
| `backend/scripts/seed_test_data.py` | **Exists** |
| `backend/scripts/seed_demo_school.py` | **Exists** |
| `data/jupas/grade_scales.json` | **Exists** |
| `data/jupas/programmes/*.json` | **Exists** (10 institution files) |
| `backend/app/modules/school_choice/rules/matching_rules.yaml` | **Exists** |
| `backend/app/modules/school_choice/tasks/academic_plan.yaml` | **Exists** |
| `backend/app/modules/school_choice/templates/*.html.j2` | **Exists** (3 templates) |

---

## Critical Gaps

1. **Onboarding does NOT create Organisation** — Step 2 collects school name but never calls an API to create an Organisation entity. Multi-tenancy isolation requires an Organisation to be created during onboarding for new users. Currently, organisations must be set up externally. Path: `apps/web/src/pages/Onboarding/Onboarding.jsx`.

2. **Dashboard missing class/year filter dropdowns** — Spec shows "All Classes" and "All Years" dropdown filters alongside the search bar. Dashboard only has a text search. Path: `apps/web/src/pages/Dashboard/Dashboard.jsx`.

3. **Student profile has 5 tabs instead of 7** — Spec defines 7 distinct tabs (Personal, Grades, Language, Teacher Evaluations, Activities, Notes, Plans). Implementation consolidates to 5 tabs (Programme Choices, Grades, Plans, Personal, Other). Language is under Grades; Evaluations/Activities/Notes are under "Other". This is a deliberate UX restructuring but diverges from the documented spec.

4. **"By Major" view missing from ProgrammeChoicesTab** — The standalone `TargetSchools.jsx` has a `MajorView` toggle but the `ProgrammeChoicesTab.jsx` (which replaced it as the primary target management interface) does not have this feature. Path: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx`.

5. **Navigation is top-bar, not sidebar** — Spec shows a sidebar navigation layout. Implementation uses a horizontal top navigation bar. No "Cohorts" direct link in navigation (must go through Dashboard).

6. **Dashboard shows cohort cards, not student cards by default** — Spec shows student cards in a 3-column grid as the primary dashboard view. Implementation shows cohort cards by default; student cards only appear during search. This is an intentional UX redesign (cohort-centric dashboard).

7. **School type "HIGH_SCHOOL" not in schema** — Spec mentions High School as a school type. The DB model's check constraint only allows: UNIVERSITY, POLYTECHNIC, COMMUNITY_COLLEGE, VOCATIONAL. Path: `backend/app/modules/school_choice/models/models.py` line 336.

8. **Graduation outcome data not used in analytics** — While graduation fields exist (final_school_id, final_major, graduation_year), the analytics endpoints only query `student_school_targets` (intended targets), not actual outcomes. Popular Majors shows targeted programmes, not actual admission outcomes.

9. **Dashboard metrics don't match spec** — Spec shows "Total Students / Plans Generated / Schools". Implementation shows "Total Students / Plans Generated / Pending Submissions". The third metric differs.

---

## Minor Divergences (Non-Critical)

- Spec shows 28 page components; implementation has 30 page directories (extra: StudentDashboard, Submissions)
- Student portal role and StudentDashboard exist but are not in the UX spec (student-facing feature beyond spec scope)
- `CohortList` page exists but redirects to Dashboard (consolidation)
- Legacy v1 pages still exist (StudentListPage, RecommendationPage) alongside v2 pages
- "Submissions" feature exists in nav but not mentioned in spec
- `cohort_permissions` table exists but not in spec's 12-table list
- `plan_history` table provides richer history than the single `academic_plans` table described in spec
