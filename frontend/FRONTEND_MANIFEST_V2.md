# Frontend Manifest — v2
# Intelligent Academic Advisor
# Date: 2026-03-27

## Pages

| Name | Route | File | REQ-IDs | Build Status |
|---|---|---|---|---|
| Dashboard | `/dashboard` | `src/pages/Dashboard/Dashboard.jsx` | REQ-088 | PASS |
| Student Profile (tabbed) | `/students/:id/profile` | `src/pages/StudentProfile/StudentProfile.jsx` | REQ-089, REQ-090, REQ-091, REQ-100 | PASS |
| Target Schools | `/students/:id/targets` | `src/pages/TargetSchools/TargetSchools.jsx` | REQ-092, REQ-093 | PASS |
| School Directory | `/schools` | `src/pages/SchoolDirectory/SchoolDirectory.jsx` | REQ-094 | PASS |
| School Profile | `/schools/:id` | `src/pages/SchoolProfile/SchoolProfile.jsx` | REQ-095 | PASS |
| Academic Plan | `/students/:id/plan` | `src/pages/AcademicPlan/AcademicPlan.jsx` | REQ-096, REQ-099 | PASS |
| Account Settings | `/account/settings` | `src/pages/AccountSettings/AccountSettings.jsx` | REQ-097 | PASS |
| Admin Data Refresh | `/admin/data-refresh` | `src/pages/AdminDataRefresh/AdminDataRefresh.jsx` | REQ-098 | PASS |

## Components

| Name | File | REQ-IDs | Build Status |
|---|---|---|---|
| Tabs | `src/components/Tabs/Tabs.jsx` | REQ-089 | PASS |
| EligibilityBadge | `src/components/EligibilityBadge/EligibilityBadge.jsx` | REQ-092 | PASS |
| StatusChip | `src/components/StatusChip/StatusChip.jsx` | REQ-092 | PASS |
| ShapSummary | `src/components/ShapSummary/ShapSummary.jsx` | REQ-092 | PASS |
| PredictedGradeBadge | `src/components/PredictedGradeBadge/PredictedGradeBadge.jsx` | REQ-091 | PASS |
| Toast | `src/components/Toast/Toast.jsx` | REQ-097, REQ-099 | PASS |
| Modal | `src/components/Modal/Modal.jsx` | REQ-092, REQ-097 | PASS |
| StarRating | `src/components/StarRating/StarRating.jsx` | REQ-089 | PASS |
| FileUpload | `src/components/FileUpload/FileUpload.jsx` | REQ-100 | PASS |
| SchoolCard | `src/components/SchoolCard/SchoolCard.jsx` | REQ-094 | PASS |
| NavBarV2 | `src/components/NavBarV2/NavBarV2.jsx` | REQ-088 | PASS |

## Hooks

| Name | File | Notes |
|---|---|---|
| useToast | `src/hooks/useToast.js` | Toast state management hook |

## API Layer

| File | Functions | Endpoints |
|---|---|---|
| `src/api/grades.js` | getGrades, createGrade, updateGrade, deleteGrade, getSubjects | GET/POST/PUT/DELETE `/students/{id}/grades`; GET `/grades/subjects` |
| `src/api/targets.js` | getTargets, addTarget, updateTarget, deleteTarget, reorderTargets | GET/POST/PUT/DELETE `/students/{id}/targets` |
| `src/api/schoolsV2.js` | searchSchools, getSchoolV2 | GET `/schools`, GET `/schools/{id}` |
| `src/api/match.js` | runMatch, getMatch | POST/GET `/students/{id}/match` |
| `src/api/plan.js` | generatePlan, getPlanStatus, getPlan, sendPlanChat, setPlanTemplate, editPlanSection, resetPlanSection | POST/GET `/students/{id}/plan`; POST `/plan/chat`; PATCH `/plan/template`; PATCH/DELETE `/plan/section` |
| `src/api/account.js` | getAccount, updateAccount, changePassword, deleteAccount | GET/PUT/DELETE `/account` |
| `src/api/transcripts.js` | uploadTranscript, getTranscript | POST/GET `/students/{id}/transcript` |

## Route Table

| URL Pattern | Component | Auth | Role |
|---|---|---|---|
| `/dashboard` | Dashboard | Protected | Any |
| `/students/:id/profile` | StudentProfile | Protected | Any |
| `/students/:id/targets` | TargetSchools | Protected | Any |
| `/students/:id/plan` | AcademicPlan | Protected | Any |
| `/schools` | SchoolDirectory | Protected | Any |
| `/schools/:id` | SchoolProfile | Protected | Any |
| `/account/settings` | AccountSettings | Protected | Any |
| `/admin/data-refresh` | AdminDataRefresh | Protected | Admin only (role guard in component) |

## Changelog — 2026-03-28 (second batch)

- **LoginPage**: Differentiated error handling for HTTP 404 (email not found) vs 401 (wrong password), using server-provided `detail` message.
- **grades.js**: Added `getSubjects()` function calling `GET /api/v1/grades/subjects`.
- **StudentProfile**: `GradesTab` now fetches subjects from API via `getSubjects()`; falls back to `HKDSE_SUBJECTS` constant if API returns empty. Main component loads subjects in parallel with student data.
- **TargetSchools**: Auto-recommendation cards now display major name + JUPAS code and fit score. Clicking a recommendation pre-fills the Intended Major(s) field with `major_name`. Added `newMajors` state.
- **analytics.js**: Added `getHkdsePopulationStats(subjectCode?)` calling `GET /api/v1/analytics/hkdse-population`.
- **DataAnalysis**: Fetches population stats in initial load. When no student grade trends exist, shows population subject cards (with "No student data" note and population-backed navigation).
- **SubjectDetail**: Fetches population stats for the subject on load. Displays a "HK Population Data (HKDSE)" section with year/candidates, GradeBar (percentage-based), and mean/variance per sitting. Subject name/category falls back to population data when no student sittings exist.

## Changelog — 2026-03-28 (third batch)

- **StudentProfile — DOB dropdowns (Change 1)**: Replaced single `<TextInput type="date">` for `date_of_birth` with three `<select>` dropdowns (Day / Month / Year). Year range is current year down to current year minus 25. Parses/reconstructs ISO `YYYY-MM-DD` string; stores `''` if any part unset.
- **StudentProfile — Collapsible activities/awards (Change 2)**: Each activity and award card now has a collapsible header row showing the item name (or "New Activity"/"New Award"). Toggle button (▼/▲) on right. Default collapsed for existing items with a name/title, expanded for new blank items. Tracks open state per index in `activityOpen[]` / `awardOpen[]`.
- **TargetSchools — Dual view (Change 3)**: Added `viewMode` state (`'school'`|`'major'`) with tab-toggle buttons "By School" / "By Major" above the list. By-Major view (`MajorView` component) groups all targets by unique major, with a "No Major Specified" group at the bottom. Move/Edit/Remove buttons only in school view.
- **SchoolCard — major_requirements fix (Change 4)**: Changed check from `Object.keys()` to `Array.isArray()`. Shows first 3 major names via `req.major`, "+N more" if more than 3.
- **SchoolProfile — major_requirements fix (Change 4)**: Replaced `Object.entries()` iteration with `school.major_requirements.map((req) => ...)`. Each card shows major name (bold), JUPAS code, minimum score, average score, required subject badges (red), preferred subject badges (blue), and notes.
- **DataAnalysis — VerticalBarChart (Change 5)**: Added `VerticalBarChart` component (pure CSS div bars, max 120px, color-coded by grade using CSS variables: primary for 5**/5*, success for 5/4, warning for 3, error for 2/1/U). Defined alongside `GradeBar` in DataAnalysis.jsx.
- **SubjectDetail — VerticalBarChart (Change 5)**: Added same `VerticalBarChart` component in SubjectDetail.jsx. Renders below the existing `GradeBar` for both student sittings and HK population sittings grade distributions.
- **plan.js — plan_type support (Change 6)**: `generatePlan(studentId, planType)` now accepts optional `planType` parameter (default `'UNIVERSITY'`), posted as `{ plan_type }` in request body.
- **AcademicPlan — plan type selector (Change 6)**: Added two toggle buttons "University Plan" / "High School Plan" in the toolbar. Active button uses primary background. `planType` state passed to `generatePlan`.

## Changelog — 2026-03-28 (fourth batch — Points 16 & 17)

- **plan.js**: Added `sendPlanChat`, `setPlanTemplate`, `editPlanSection`, `resetPlanSection` API functions.
- **PlanSectionEditor** (`src/components/PlanSectionEditor/PlanSectionEditor.jsx`): New TipTap-based rich text editor component. Props: `sectionKey`, `initialHtml`, `onSave`, `onReset`, `onCancel`, `saving`. Renders Bold / Italic / Bullet List mini toolbar, 400px editor area, and Save / Reset to Default / Cancel buttons.
- **TipTap**: Installed `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`.
- **AcademicPlan — two-column layout (Point 16)**: When a plan is rendered, the page switches to a flex-row layout — left column (flex 1) holds the plan iframe; right column (360px, flex-shrink 0) holds the AI chat panel. On narrower screens the right column still renders below via flex-wrap behaviour.
- **AcademicPlan — AI chat panel (Point 16)**: `ChatPanel` sub-component with header (title + beta badge), scrollable message list with auto-scroll via `useRef`/`useEffect`, user messages (right-aligned, primary background), assistant messages (left-aligned, grey), system messages (amber). Empty state hint text shown when no messages. Textarea with Enter-to-send (Shift+Enter for newline). 503 → persistent yellow notice + disables input. 429 → system message. Other errors → `chatError` shown below textarea.
- **AcademicPlan — template selector (Point 17a)**: Secondary toolbar row (only when plan exists) with Professional / Modern / Minimal toggle buttons. Active = primary background/white text, no border. Inactive = white background, primary text, primary border. Calls `setPlanTemplate` then reloads plan. `activeTemplate` state seeded from `plan.template_id` on load.
- **AcademicPlan — Edit Sections mode (Point 17b)**: "Edit Sections" toggle button in the template toolbar. When active, shows a row of section Edit buttons (Student Summary, School 1–N Rationale up to 5, Action Plan Notes). Clicking a section opens a full-screen modal with `PlanSectionEditor`. Save calls `editPlanSection` then reloads plan. Reset calls `resetPlanSection` then reloads plan. Cancel closes modal.

## Changelog — 2026-03-28 (fifth batch — bugs + redesigns)

- **BUG 1 — AcademicPlan iframe sandbox**: Changed `sandbox="allow-same-origin"` to `sandbox="allow-same-origin allow-scripts"` so Chart.js scripts embedded in the plan HTML document execute correctly.
- **BUG 2 — Dashboard plan count**: Changed `plansGenerated` filter from `s.plan_generated_at || s.has_plan` to `s.has_plan` only, consistent with the backend `has_plan: boolean` field.
- **BUG 3 — Chat message keys**: Messages now carry a stable `id: crypto.randomUUID()` field added at push time (user, assistant, system messages). ChatPanel `.map()` uses `key={msg.id}` instead of `key={i}` (array-index anti-pattern).
- **REDESIGN 1 — VerticalBarChart (DataAnalysis + SubjectDetail)**: Replaced plain bar chart with a polished visualization: white card with `border-radius: 8px` and `box-shadow`, `160px` bar area, per-grade color scheme (5**=purple, 5*=blue, 5=cyan, 4=green, 3=amber, 2=orange, 1=red, U=grey), rounded top corners, hover opacity effect + floating tooltip, always-visible value label above each bar in bar color, faint horizontal gridlines at 25%/50%/75%/100%, `%` suffix detection for population data, summary line showing Mean / Mode / n= derived via `deriveChartStats()`.
- **REDESIGN 2 — DataAnalysis subject card layout**: Subject cards now show `VerticalBarChart` (best-populated sitting) full-width at top of card, followed by horizontal stats pills (Mean, Variance, n= with primary-color bold values on grey pill backgrounds). Category badge redesigned as rounded pill (12px radius, bold text). Category colors corrected: CORE=blue, ELECTIVE=green, OTHER_LANGUAGE=purple, APPLIED_LEARNING=amber. SubjectDetail sitting cards and population cards updated with same pill-style stats row, chart made full-width and prominent (GradeBar kept for visual reference).
- **REDESIGN 3 — Template toolbar (AcademicPlan)**: Template buttons redesigned as 110x72px card-like buttons with mini-preview swatch (colored header bar + two grey content lines). Active template: 2px primary border, `scale(1.02)`, shadow. Inactive: light border, hover darkens border to primary color. `TEMPLATES` array extended with `headerColor` (Professional=#1e3a5f, Modern=#0d9488, Minimal=#111827).

## v1 Compatibility

All v1 routes, components, and API files are untouched:
- `/login`, `/register`, `/students`, `/students/:id`, `/students/:id/recommendations`
- All `src/api/` v1 files (client.js, auth.js, students.js, schools.js, recommendations.js, actionPlan.js)
- All v1 components (Button, TextInput, FormCard, NavBar, StudentRow, StudentForm, RecommendationCard, ActionPlanDisplay, LoadingSpinner, ErrorMessage, EmptyState)
- `src/context/AuthContext.jsx`, `src/hooks/useAuth.js`, `src/utils/tokens.css`, `src/main.jsx`
