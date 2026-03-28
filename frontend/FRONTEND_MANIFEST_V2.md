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
| `src/api/plan.js` | generatePlan, getPlanStatus, getPlan | POST/GET `/students/{id}/plan` |
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

## v1 Compatibility

All v1 routes, components, and API files are untouched:
- `/login`, `/register`, `/students`, `/students/:id`, `/students/:id/recommendations`
- All `src/api/` v1 files (client.js, auth.js, students.js, schools.js, recommendations.js, actionPlan.js)
- All v1 components (Button, TextInput, FormCard, NavBar, StudentRow, StudentForm, RecommendationCard, ActionPlanDisplay, LoadingSpinner, ErrorMessage, EmptyState)
- `src/context/AuthContext.jsx`, `src/hooks/useAuth.js`, `src/utils/tokens.css`, `src/main.jsx`
