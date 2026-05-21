<!-- spec-tracks: apps/web/src/pages/CohortList/CohortList.jsx, apps/web/src/pages/CohortDetail/CohortDetail.jsx, apps/web/src/pages/CohortReport/CohortReport.jsx, apps/web/src/pages/BulkEdit/BulkEdit.jsx, apps/web/src/components/GradeGrid/GradeGrid.jsx, apps/web/src/api/cohorts.js, backend/app/api/v1/routes/cohorts.py, backend/app/api/v1/routes/reports.py -->

# Cohorts Spec

---

## Cohort List (/cohorts)

### Elements

- **NavBarV2** — top navigation bar with account context
- **Page heading** — "Student Cohorts" (h1)
- **"New Cohort" button** — top-right, opens create modal
- **Cohort cards** — one per cohort, clickable (navigates to `/cohorts/{id}`):
  - Cohort name (shows "All Students" for `is_default` cohorts)
  - Description text (hidden for default cohorts)
  - Member count badge ("X students")
  - **"Delete" button** — red outline, only for non-default cohorts; `stopPropagation` on click
- **EmptyState** — shown when no cohorts exist
- **LoadingSpinner** — shown during initial load
- **ErrorMessage** — shown on load failure

#### Create Cohort Modal
- **Title**: "New Cohort"
- **Cohort name input** (required, `id="cohort-name-input"`)
- **Description input** (optional, `id="cohort-desc-input"`)
- **Create button** — label toggles to "Creating..." while pending
- **Cancel/close** — resets inputs

#### Delete Confirmation Modal
- **Title**: "Delete Cohort"
- **Confirmation text**: "Are you sure you want to delete {name}?"
- **Delete button** — danger variant, label toggles to "Deleting..."
- **Cancel/close**

### Data flow

**Initial load:**
- `GET /api/v1/cohorts` -> `{ cohorts: CohortResponse[], total: number }`
  - `CohortResponse`: `{ id, name, description, academic_year, is_default, member_count, created_at, updated_at }`
- `GET /api/v1/account` -> account data for NavBar
- Non-admin users: backend filters to only cohorts where the user's teacher groups have `visible=true` in `CohortPermission`

**Create cohort:**
- `POST /api/v1/cohorts` with `{ name: string, description: string|null }`
- Returns `CohortResponse`
- Backend auto-creates `CohortPermission` rows for all existing teacher groups with default `read_write` permissions
- Requires admin role or `cohort_management=read_write` group permission

**Delete cohort:**
- `DELETE /api/v1/cohorts/{id}` -> 204
- Cannot delete default "All Students" cohort (backend returns 400)
- Members are unlinked, not deleted

### Key behaviors

- Clicking a cohort card navigates to `/cohorts/{id}`
- Delete button only appears on non-default cohorts
- Delete click uses `stopPropagation` to prevent card navigation
- Create modal resets inputs on close
- Toast notifications on success/failure for create and delete
- Cohorts ordered by `created_at` descending

---

## Cohort Detail (/cohorts/:id)

### Elements

- **NavBarV2** — top navigation bar
- **"Back to Dashboard" link** — top-left
- **Header bar** with:
  - **Cohort name** (h1) — clickable to enter edit mode (non-default only, shows pencil icon)
  - **Description** — shown below name for non-default cohorts
  - **"View Report" button** — navigates to `/cohorts/{id}/report`
  - **"Bulk Edit Grades" button** — navigates to `/cohorts/{id}/bulk-edit`
  - **"Add Students" button** — opens add modal (non-default only; disabled without `cohort_management` permission)

#### Edit Name/Description (inline)
- **Name input** (`<Input>`, width 280px)
- **Description input** (`<Input>`, width 280px, placeholder text)
- **Save button** — disabled while saving or if name empty
- **Cancel button** — exits edit mode

#### Members Table (card)
- **Section title**: "Members ({count})"
- **Table columns**: Name, Class, Year, Actions
  - Name column: link to `/students/{id}/profile`
  - Class column: value or "---"
  - Year column: value or "---"
  - Actions column: **"Remove" button** (red outline, non-default only; disabled without `cohort_management` permission)
- **EmptyState** when no members

#### Subject Stats Table (card)
- **Section title**: "Subject Statistics"
- **Sitting filter dropdown** (`id="sitting-filter"`):
  - Options: All, MOCK (default), TRIAL, OFFICIAL
- **Loading indicator** — inline "Loading..." text while stats refresh
- **Table columns**: Subject Code, Subject Name, Sitting, Students, Mean Grade, Variance, Distribution
  - Mean Grade: shown as grade label with numeric in parentheses, e.g., "4 (3.67)"
  - Distribution: compact format "5**:2 . 5*:4 . 5:6 . 4:8"
- **EmptyState** when no grade data

#### Add Students Modal
- **Title**: "Add Students to Cohort"
- **Search inputs row**:
  - Name search input (flex 2, Enter triggers search)
  - Class filter input (flex 1)
  - Year filter input (number type, flex 1)
  - **Search button** — disabled while searching
- **Results list** (scrollable, max-height 260px):
  - Each item shows: student name, class name, year of study
  - Click to toggle selection (highlight with blue border/background)
  - Already-in-cohort members shown grayed out with "Already in cohort" label
  - `role="option"`, `aria-selected`, `aria-disabled` attributes
- **Confirm button**: "Add {count} Selected" — disabled when 0 selected
- Auto-searches on modal open (empty query returns all students)

#### Remove Student Confirmation Modal
- **Title**: "Remove Student"
- **Text**: "Remove {name} from this cohort?"
- **Remove button** — danger variant

### Data flow

**Initial load:**
- `GET /api/v1/cohorts/{id}` -> `CohortDetailResponse`:
  ```
  { id, name, description, is_default, members: CohortMemberResponse[], created_at, updated_at }
  ```
  - `CohortMemberResponse`: `{ id, full_name, class_name, year_of_study }`
- `GET /api/v1/account` -> account data
- Non-admin users: backend checks `CohortPermission.visible` for user's groups; raises 403 if not visible

**Load stats:**
- `GET /api/v1/cohorts/{id}/stats?sitting={MOCK|TRIAL|OFFICIAL}` -> `CohortStatsResponse`:
  ```
  { cohort_id, cohort_name, member_count, subject_stats: SubjectStatEntry[] }
  ```
  - `SubjectStatEntry`: `{ subject_code, subject_name, sitting, count, mean, variance, grade_distribution: {grade: count} }`

**Update cohort name/description:**
- `PUT /api/v1/cohorts/{id}` with `{ name, description }` -> `CohortResponse`

**Search students (for add modal):**
- `GET /api/v1/cohorts/students/search?q=&class_name=&year_of_study=` -> `StudentSearchResponse`:
  ```
  { students: StudentSearchResult[], total }
  ```
  - `StudentSearchResult`: `{ id, full_name, class_name, year_of_study, candidate_number }`
  - Limited to 50 results

**Add members:**
- `POST /api/v1/cohorts/{id}/members` with `{ student_ids: UUID[] }` -> `CohortDetailResponse`
- Duplicates silently ignored
- Returns 404 if any student ID not found

**Remove member:**
- `DELETE /api/v1/cohorts/{id}/members/{student_id}` -> 204

### Key behaviors

- Stats auto-reload when sitting filter changes
- Edit mode for name/description only available on non-default cohorts
- Clicking cohort name enters inline edit mode (shows pencil icon hint)
- Add Students button disabled (opacity 0.5, cursor not-allowed) when user lacks `cohort_management` permission
- Remove button per member also permission-gated
- Subject names are localized via `t('subjects.{code}')` with fallback to API name
- Grade numeric values: 7=5**, 6=5*, 5=5, 4=4, 3=3, 2=2, 1=1, 0=U

---

## Cohort Report (/cohorts/:cohortId/report)

### Elements

- **NavBarV2** — top navigation bar
- **"Back to Cohort" link** — links to `/cohorts/{cohortId}`
- **Page title**: "{cohort_name} --- Cohort Report" (h1)
- **LoadingSpinner** — during initial load
- **ErrorMessage** — on load failure

#### Target Distribution Card
- **Section title**: "Target Distribution"
- **Horizontal bar chart** (CSS bars, not a charting library):
  - Each bar: school name (200px label, right-aligned) | proportional bar with count inside | avg score label
  - Bar width proportional to `count / maxCount * 100%`, minimum 2%
  - School names localized via `useLocalizedName`
- **EmptyState** when no target data

#### Risk Breakdown Card
- **Section title**: "Risk Breakdown"
- **Table columns**: Class, Total Students, At Risk, Risk %
  - Risk % color-coded:
    - >= 50%: error (red)
    - >= 25%: warning (amber)
    - < 25%: success (green)
- **EmptyState** when no risk data

#### Subject Performance Card
- **Section title**: "Subject Performance"
- **Sitting filter dropdown** (`id="perf-sitting"`):
  - Options: MOCK (default), TRIAL, OFFICIAL
- **Table columns**: Code, Subject, Students, Mean, Min, Max
  - Grades shown as label with numeric in parentheses, e.g., "4 (3.67)"
  - Subject names localized via `t('subjects.{code}')`
- **EmptyState** when no performance data

### Data flow

**Initial load (3 parallel requests):**

1. `GET /api/v1/reports/cohort/{cohortId}/target-distribution`:
   ```
   { cohort_name, distribution: [{ school, school_zh, count, avg_score }] }
   ```
   - Sorted by count descending

2. `GET /api/v1/reports/cohort/{cohortId}/risk-breakdown`:
   ```
   { cohort_name, breakdown: [{ class_name, total_students, at_risk_students, risk_pct }] }
   ```
   - "At risk" = any `StudentSchoolTarget` where `at_risk=true`
   - Grouped by `class_name` (or "Unassigned")

3. `GET /api/v1/reports/cohort/{cohortId}/subject-performance?sitting=MOCK`:
   ```
   { cohort_name, sitting, subjects: [{ code, name, count, mean, min, max }] }
   ```
   - min/max are numeric grade values (0-7)

**Sitting filter change:**
- All three endpoints re-fetched with new `sitting` value

### Key behaviors

- All three sections load together in parallel on mount
- Changing sitting filter reloads all three sections
- Target distribution bars scale relative to the highest-count school
- Risk percentage uses color gradient for visual urgency
- Empty states shown per-section independently

---

## Bulk Edit Grades (/cohorts/:cohortId/bulk-edit)

### Elements

- **NavBarV2** — top navigation bar
- **"Back to Cohort" link** — links to `/cohorts/{cohortId}`
- **Page title**: "Bulk Edit Grades --- {cohort_name}" (h1)
- **Sitting toggle buttons**: MOCK, TRIAL, OFFICIAL
  - Active button: blue border, blue text, light blue background
  - Inactive: standard border
- **LoadingSpinner** — during data load
- **Empty state text** — "No students in this cohort..."

#### GradeGrid Component (spreadsheet)
- **Sticky corner cell**: "Student" label (top-left, z-index 3)
- **Sticky header row**: subject codes (z-index 2, border-bottom 2px)
- **Sticky name column**: student names (left-pinned, z-index 1, border-right 2px, min-width 140px)
- **Grade cells**: text inputs (64px wide, center-aligned)
  - Normal: transparent background
  - Edited: yellow background (#fef9c3)
  - `aria-label="{student} {subject} grade"`

#### Unsaved Changes Banner (GradeGrid)
- Yellow background (#fef9c3), shown when edits exist
- **Text**: "{count} unsaved changes"
- **"Discard" button** — resets all edits
- **"Save All" button** — blue, disabled while saving (shows "Saving...")

### Data flow

**Initial load (3 parallel queries via React Query):**

1. `GET /api/v1/account` -> account data
2. `GET /api/v1/cohorts/{cohortId}` -> cohort with members
3. `GET /api/v1/grades/subjects` -> `[{ id, code, name }]`

**Per-student grade fetch:**
- `GET /api/v1/students/{studentId}/grades?sitting={sitting}` -> `{ grades: [{ id, subject_code, raw_grade, sitting }] }`
- Fetched for all members in parallel
- Re-fetched when sitting changes

**Save individual grade:**
- If existing: `PUT /api/v1/grades/{gradeId}` with `{ raw_grade }`
- If new: `POST /api/v1/students/{studentId}/grades` with `{ subject_code, sitting, raw_grade }`
- Each cell saved individually; counts successes and failures

### Key behaviors

- **Excel paste support**: intercepting `onPaste` event on each cell
  - Detects multi-cell paste (tabs or multiple rows)
  - Parses `\t`-separated columns, `\n`-separated rows
  - Applies values to grid cells starting from paste origin
  - Single-cell paste falls through to default behavior
- Sitting toggle re-fetches all grades for all students
- GradeGrid max-height 70vh with dual-axis scroll
- Edited cells highlighted yellow until saved or discarded
- Save iterates all edits sequentially per student/subject
- Toast notifications: separate success/error for save counts
- `refetchGrades` called after successful save
