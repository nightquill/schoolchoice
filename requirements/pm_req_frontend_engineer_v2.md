# PM → Frontend Engineer — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

v1 delivered: Login, Register, StudentList, StudentDetail, RecommendationPage (basic). These pages exist and work. Your task is to build all new v2 pages and extend the existing Student pages. Follow UI Designer specs (design/page_layouts_v2.md, design/component_specs_v2.md) once published; if not yet available, build to the field-level requirements below.

---

## Owned Requirements (v2)

### REQ-088 [FRONTEND] — Dashboard Page
Build `/dashboard`:
- Authenticated route (redirect to login if no valid JWT)
- Fetches `GET /api/v1/students` and renders student summary cards
- Each card: student full_name, year_of_study, last_updated, link to `/students/{id}`
- Summary stats bar: total students, plans generated count
- Navigation header present on all authenticated pages (links to Dashboard, School Directory, Account Settings; admin link to Data Refresh if role=admin)

### REQ-089 [FRONTEND] — Tabbed Student Profile Page
Extend the existing StudentDetail page into a full tabbed interface at `/students/{id}`:
- 6 tabs: Personal, Grades, Language, Teacher Evaluations, Activities, Notes
- Each tab fetches only its relevant data on activation (lazy loading preferred)
- All fields from preferences.md §5 must be editable via inline forms or modal dialogs
- Save button per tab section; optimistic UI update on success

**Personal tab:** full_name, preferred_name, date_of_birth, age (auto-calculated from DOB, display only), gender, address, phone, email, candidate_number, year_of_study, class_name, grade_system selector

**Language tab:** IELTS: overall + 4 subscores + test_date. Additional scores: dynamically add rows (label + score + date).

**Teacher Evaluations tab:** add/edit/delete rows (subject dropdown, teacher name, star rating 1–5, comment textarea, date).

**Activities tab:** two sub-tables — Extracurricular (activity, role, years, achievement) and Awards (title, awarding body, level dropdown, year). Add/delete rows for each.

### REQ-090 [FRONTEND] — Subject Grade Entry Table
Build the Grades tab on the Student Profile:
- Fetches `GET /api/v1/students/{id}/grades`
- Table with columns: Subject (dropdown populated from `GET /api/v1/subjects?grade_system=HKDSE`), Sitting, Grade, Predicted Grade, Transcript Uploaded, Notes, Actions
- "Add Grade" button appends a new empty row; saves via `POST /api/v1/students/{id}/grades`
- Edit/delete per row via `PATCH`/`DELETE`
- Grade dropdown values change based on selected grade system (HKDSE: 5**, 5*, 5, 4, 3, 2, 1, U, X; others: placeholder)
- Multiple sittings for the same subject are separate rows, grouped visually by subject

### REQ-091 [FRONTEND] — Predicted Grade Visual Treatment
- Predicted grade cells: italic text, grey background (`#f5f5f5`), or a `~` prefix
- Tooltip on hover: "Predicted — based on mock/trial sitting(s)"
- Official grades: normal font weight, no background treatment
- This treatment applies in the grade table and in any summary views

### REQ-092 [FRONTEND] — Student Target Schools Page
Build `/students/{id}/targets`:
- Fetches `GET /api/v1/students/{id}/targets`
- Renders a card list of StudentSchoolTarget items
- Each card: school name (EN + ZH), match score as % (colour-coded: ≥70% green, 40–69% yellow, <40% red), ELIGIBLE/INELIGIBLE badge, SHAP explanation (3 bullet points from shap_explanation JSONB), preference rank number, status chip with colour per state, Edit status dropdown
- "Add School" button → navigates to School Directory with current student in context
- "Generate Plan" button → triggers `POST /api/v1/students/{id}/plan/generate`, polls status, navigates to plan page on completion

### REQ-093 [FRONTEND] — Drag-to-Reorder
Implement drag-to-reorder on the Target Schools list:
- Use a React drag-and-drop library (e.g. @dnd-kit/core or react-beautiful-dnd)
- Drag handle (≡ icon) on left of each card
- On drop: recompute student_rank for all cards (1-indexed, continuous), then PATCH each changed rank to `PATCH /api/v1/students/{id}/targets/{target_id}`
- Optimistic update: show new order immediately; revert on API error with toast notification
- Keyboard fallback: up/down arrow buttons per card (increment/decrement rank, same PATCH call)

### REQ-094 [FRONTEND] — School Directory Page
Build `/schools`:
- Fetches `GET /api/v1/schools` with query params bound to filter controls
- Search bar: live search (debounced 300ms) bound to `q` param
- Filter panel: Type (multi-select checkboxes), Location (text input), Min Entry Score range (two number inputs or range slider)
- Results: table or card grid with school name (EN + ZH), type badge, location, min entry score, scholarship indicator
- Clicking a school → navigates to `/schools/{id}`
- Pagination controls

### REQ-095 [FRONTEND] — School Profile Page
Build `/schools/{id}`:
- Fetches `GET /api/v1/schools/{id}`
- Displays all school fields: name, name_zh, type, location, website (external link), description, minimum_entry_score, required_subjects (formatted list), language_requirements, faculties, notable_programs, acceptance_rate, average_admitted_score, scholarship_available, data_source, data_last_updated
- "Add to My Target List" button: if student context is available (via URL param or global state), calls `POST /api/v1/students/{id}/targets`; otherwise prompts to select a student
- "Back to Directory" link

### REQ-096 [FRONTEND] — Academic Plan Page
Build `/students/{id}/plan`:
- On load: fetches `GET /api/v1/students/{id}/plan/status`
- If status = "complete": fetches `GET /api/v1/students/{id}/plan` (HTML) and renders in `<iframe>` or sets innerHTML of a sandboxed container
- If status = "pending" or "running": show spinner + "Generating your academic plan..." message, poll status every 3 seconds
- If status = "error": show error message with retry button (re-triggers generate)
- "Print" button: `window.print()` or opens plan HTML in new tab
- Plan page is full-width; hide main navigation during iframe display (or use a minimal header)

### REQ-097 [FRONTEND] — Account Settings Page
Build `/account`:
- Fetches `GET /api/v1/account` on load
- Sections rendered as collapsible cards or separate form groups:
  1. Email: display-only field with note
  2. Display Name: text input + Save button → `PATCH /api/v1/account`
  3. Password: 3-field form → `POST /api/v1/account/change-password`
  4. Preferences: Language selector (English/中文) + notifications toggle → `PATCH /api/v1/account`
  5. Delete Account: red button → confirmation modal (password input) → `DELETE /api/v1/account` → clear JWT → redirect to Login
- Show success/error toast after each action

### REQ-098 [FRONTEND] — Admin Data Refresh Page
Build `/admin/data-refresh` (role guard: redirect non-admins to Dashboard):
- Fetches `GET /api/v1/admin/data-refresh/status` on load
- Displays: last refresh timestamp, per-source status (HKEAA, JUPAS, Universities — from status response)
- "Trigger Refresh" button → confirmation modal → `POST /api/v1/admin/data-refresh` → show progress spinner
- Poll `GET /api/v1/admin/data-refresh/status` every 5 seconds while running

### REQ-099 [FRONTEND] — Async Plan Generation Flow
The plan generation UX (across Target Schools page and Plan page):
- Show a persistent loading state while background task status is "pending" or "running"
- Do not block the rest of the UI while plan is generating (user can navigate away)
- On completion: show a toast notification "Plan ready — view it here" with a link
- On error: show a toast notification with a retry action

### REQ-100 [FRONTEND] — Transcript Upload UI
In the Grades tab of the Student Profile:
- "Upload Transcript" button → file picker (accept PDF, JPEG, PNG)
- On file select: `POST /api/v1/students/{id}/transcripts` (multipart)
- Show upload progress indicator
- After upload: poll `GET /api/v1/students/{id}/transcripts/{id}` every 2 seconds until parsed_data is populated
- When parsing complete: show "Parsed Grades Review" panel listing all extracted entries: Subject (parsed name), Grade, Confidence
- Each entry has Accept (adds to grade table via `POST /api/v1/students/{id}/grades`) and Dismiss (removes from review panel) buttons
- No grades are auto-saved without explicit user confirmation per entry

---

## Technical Constraints

- All authenticated routes must check for valid JWT; redirect to `/login` if absent/expired
- Role guard: admin-only routes must check `account.role === "admin"` (decoded from JWT or fetched from `/api/v1/account`)
- State management: extend existing approach (Context API or Redux — whatever v1 uses); do not switch paradigm
- Follow existing component naming conventions from v1
- All forms must show validation errors inline (not only as alerts)
- Error boundaries: wrap each page in a React error boundary; unexpected errors show a fallback message not a blank screen

---

## Deliverables

- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/StudentProfile.jsx` (extended with tabs)
- `frontend/src/pages/TargetSchools.jsx`
- `frontend/src/pages/SchoolDirectory.jsx`
- `frontend/src/pages/SchoolProfile.jsx`
- `frontend/src/pages/AcademicPlan.jsx`
- `frontend/src/pages/AccountSettings.jsx`
- `frontend/src/pages/AdminDataRefresh.jsx`
- New components as needed (GradeTable, TargetSchoolCard, ShapPanel, PlanViewer, TranscriptReviewer, DragList, etc.)
- Updated routing in `frontend/src/App.jsx` (add all new routes)
- `skills/frontend-engineer.md` — skills file (create or append)

---
*Packet owner: Frontend Engineer. All items PENDING.*
