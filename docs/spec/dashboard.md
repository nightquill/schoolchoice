# Dashboard Spec
<!-- spec-tracks: apps/web/src/pages/Dashboard/Dashboard.jsx, apps/web/src/components/AlertsPanel/AlertsPanel.jsx, apps/web/src/api/alerts.js, apps/web/src/api/cohorts.js, apps/web/src/api/entities.js, apps/web/src/api/students.js, apps/web/src/api/submissions.js, backend/app/api/v1/routes/alerts.py, backend/app/services/alert_service.py -->

## Teacher/Admin Dashboard (/dashboard)

### Elements

**Summary Statistics Region** (aria-label: "Summary statistics")
- "Total Students" metric card — displays integer count; not clickable
- "Plans Generated" metric card — count of students with has_plan === true; clickable → /analytics/plans; shows warning sub-text "{N} missing plan" in orange when any students lack plans
- "Pending Submissions" metric card — total submission count; clickable → /submissions; shows info sub-text "{N} awaiting review" in primary blue when count > 0
- Dynamic entity metric cards — one per auto_crud entity from entity registry; displays record count; label is capitalized entity name; not clickable

Each metric card structure:
- Card header with label (secondary text, small font)
- Card content with large numeric value (2xl font, tabular-nums)
- Sub-text line for alert message (xs font) or non-breaking space placeholder

**Alerts Panel** (aria-label: "Alerts")
- "Alerts" heading (h2, bold, md font)
- "Pending Review" category row — collapsible accordion with FileCheck icon, label, badge showing unique student count; blue tint background when count > 0
- "Student Data Quality" category row — collapsible accordion with AlertTriangle icon; covers: missing_grades, missing_targets, stale_data, missing_plan
- "Conservative" category row — collapsible accordion with Info icon; covers: dubious_conservative
- "Ambitious" category row — collapsible accordion with AlertCircle icon; covers: dubious_ambitious, at_risk_target

Each expanded alert category:
- Individual alert rows showing alert.message text (underlined if clickable)
- Dismiss button (X icon, 12px) per alert — removes from local display via client-side Set
- "No alerts" text when category expanded but 0 alerts
- Max height 200px with overflow scroll

**Quick Actions Grid** (gradient blue background)
- "+ Add Student" button — icon card; opens inline create form; hidden when form is open
- "Import CSV/Excel" button — icon card; navigates to /import/students; disabled with not-allowed cursor and 50% opacity when user lacks data_import permission; tooltip on disabled
- "Export Students" button — icon card; triggers CSV download via GET /api/v1/entities/student/export as blob; filename students-export-YYYY-MM-DD.csv

**Add Student Inline Form** (conditionally visible)
- "Student Full Name" label with red asterisk
- Text input (id: new-student-name, autoFocus) — border turns red on validation error
- "Create" submit button — disabled while creating; text "Creating..." during submission
- "Cancel" button (secondary) — clears form and hides it
- Error message (id: new-student-error) — "Name required" or "Create failed"

**Cohort Section**
- "Your Cohorts" heading (h2, xl font, bold)
- "New Cohort" button (secondary) — visible only to admins or users with can_manage_cohorts; opens create cohort dialog

**Student Search Bar**
- Search input (name: student-search) — placeholder "Search student by name"; filters loaded students client-side by name substring (case-insensitive)
- Search results grid (1/2/3 columns responsive) — up to 12 matching student cards
- Student result card — clickable div (role=button); shows name (bold) + class_name/year_of_study separated by " . "; navigates to /students/{id}/profile
- "No match" text when 0 results

**Cohort Cards Grid** (1/2/3 columns responsive, role: list)
- Cohort card (role: listitem) — clickable → /cohorts/{id}; hover shows elevated shadow
  - Users icon (18px, primary color)
  - Cohort name — default cohort shows "All Students" with blue "Default" badge pill
  - Description text (xs font, secondary) — non-default only
  - Student count: "{N} students"
  - Default cohort: 2px primary border; sorted first

**Create Cohort Dialog** (modal)
- Title: "Create Cohort"
- "Cohort Name" label + Input (id: cohort-name, aria-required) with placeholder
- "Description" label + Input (id: cohort-desc) with placeholder
- "Cancel" button (secondary) — disabled while pending
- "Create Cohort" button — disabled when name empty or pending; text "Creating..."

**Loading state**: LoadingSpinner with "Loading students"
**Error state**: ErrorMessage with error details
**No-access state**: "No group access" centered message (counsellors without group access)

### Data flow

On mount — parallel queries:
1. GET /api/v1/entities → Array<{name, table, auto_crud}> — entity registry
2. GET /api/v1/students?limit=500 → {items: Array<Student>, total} — all students
3. GET /api/v1/submissions → {submissions: Array, total} — pending count
4. GET /api/v1/account → AccountResponse — navbar, locale sync, permissions
5. GET /api/v1/cohorts → {cohorts: Array<{id, name, description, is_default, member_count}>}
6. GET /api/v1/alerts → {alerts: Array<{type, severity, student_id, student_name, message, submission_id?}>, count} — staleTime 60s

Per auto_crud entity: GET /api/v1/{entity.table} → count for metric card

Create student: POST /api/v1/students {name} → {id, ...} → navigate to /students/{id}/profile
Create cohort: POST /api/v1/cohorts {name, description} → invalidates ['cohorts'] query
Export: GET /api/v1/entities/student/export → blob CSV download

### Key behaviors
- Onboarding redirect: if localStorage.onboarding_complete not set AND 0 students → /onboarding
- Locale sync: on account load, syncs sessionStorage/localStorage locale from preferred_language
- Alert badge counts: unique student count (deduplicated by student_id), not raw alert count
- Alert dismiss: client-side only via in-memory Set keyed by {type}-{student_id}; resets on reload
- Alert click: pending_review → /submissions/{submission_id}; others → /students/{student_id}/profile?tab=programmes
- Accordion: only one category expanded at a time
- Permission gating: Import checks data_import; "New Cohort" checks can_manage_cohorts or admin
- Cohort sort: default cohort (is_default=true) always first
- Search results cap: max 12 cards
- Responsive grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
