# Page Layouts — v2
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE
# Note: This file extends page_layouts.md (v1). Do not modify v1. All v1 layouts
#       (Login, Student List, Student Detail, Recommendation) remain unchanged.
#       All values reference tokens in design_tokens.md.

---

## Purpose

Defines the grid structure, content zones, API field mappings, and responsive
behaviour for every new page introduced in v2. Desktop baseline is 1280px.
Mobile target is 375px. Tablet intermediate is 768px (REQ-052).

Breakpoints referenced:
- Mobile: up to 767px (use `var(--breakpoint-sm)` as the lower guard)
- Tablet: 768px–1279px (use `var(--breakpoint-md)`)
- Desktop: 1280px and above (use `var(--breakpoint-lg)` as the design baseline)

---

## 1. Dashboard

**REQ-IDs:** REQ-088

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar (fixed top)
- Stats bar: single horizontal row directly below NavBar
- Student cards grid: 3-column CSS grid with `var(--space-6)` column and row gaps
- Page outer padding: `var(--space-8)` horizontal, `var(--space-6)` vertical (below NavBar)

**Tablet (768px–1279px):**
- Stats bar: same single row, values wrap if viewport is narrow
- Student cards grid: 2-column grid, same gaps

**Mobile (375px–767px):**
- Stats bar: single column stack, each stat on its own row
- Student cards grid: 1-column stack, full width
- Page outer padding: `var(--space-4)` horizontal

### Content Zones

**Zone A — NavBar**
- Full width. Height: sufficient for one text line + `var(--space-3)` vertical padding.
- Contains: application name (left), nav links: Dashboard | School Directory | Account Settings
  [+ Data Refresh for admin] (centre), display name + Logout (right).
- API fields: `account.display_name` for right side; `account.role` to conditionally
  render the Data Refresh link.

**Zone B — Stats Bar**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid `var(--color-border)`.
- Padding: `var(--space-4)` vertical, page outer padding horizontal.
- Three stat blocks, evenly spaced within the bar:
  1. Total Students — count of students returned by GET /api/v1/students
  2. Plans Generated — count of students with a non-null AcademicPlan (derived from
     student list response; if not available in list response, this stat shows "--")
  3. Active Targets — total count of StudentSchoolTarget records across all students
     (informational; if not available from list endpoint, shows "--")
- Each stat block: value in `var(--font-size-2xl)` `var(--font-weight-bold)` +
  label in `var(--font-size-sm)` `var(--color-text-secondary)` below.

**Zone C — Student Cards Grid**
- Background: `var(--color-background)`.
- Each card: StudentCard component (see component_specs_v2.md — not a new component;
  uses the existing FormCard container style with the following content zones):
  - Student full name: `var(--font-size-lg)` `var(--font-weight-bold)` `var(--color-text-primary)`
  - Year of study: `var(--font-size-sm)` `var(--color-text-secondary)`
  - Latest plan date: label "Last plan:" + `plan.generated_at` formatted as YYYY-MM-DD,
    or "No plan yet" if null. `var(--font-size-xs)` `var(--color-text-secondary)`.
  - "View Profile" button: primary Button variant, full width within card.
- API fields populated per card: `student.full_name`, `student.year_of_study`,
  `student.id` (for navigation), `plan.generated_at` (if included in list response).
- Card padding: `var(--space-5)`. Border radius: `var(--border-radius-md)`.
  Shadow: `var(--shadow-sm)`. Background: `var(--color-surface)`.

### Loading / Empty States

- While GET /api/v1/students is in flight: Zone C shows a LoadingSpinner (md size, centered).
- If no students exist: Zone C shows an EmptyState with message "No students yet. Add a
  student to get started." and an "Add Student" action button (secondary variant).

---

## 2. Student Profile (Tabbed)

**REQ-IDs:** REQ-089, REQ-090, REQ-091, REQ-104

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar (fixed top)
- Profile header: full-width strip below NavBar
- Tab bar: full-width, below header
- Tab panel: single-column main content area, max-width 960px, horizontally centred.
  Page horizontal padding: `var(--space-8)`.

**Tablet (768px–1279px):**
- Tab panel max-width: 100%, page horizontal padding `var(--space-6)`.

**Mobile (375px–767px):**
- Profile header: stacked layout (name on first line, action buttons below)
- Tab bar: horizontally scrollable if tabs overflow viewport
- Tab panel: full width, page horizontal padding `var(--space-4)`

### Content Zones

**Zone A — Profile Header**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-4)` vertical, `var(--space-8)` horizontal.
- Left: Student full name (`var(--font-size-2xl)` `var(--font-weight-bold)`) +
  year of study below (`var(--font-size-sm)` `var(--color-text-secondary)`).
- Right: action buttons row — "Target Schools" (secondary), "Generate Plan" (primary).
- API fields: `student.full_name`, `student.year_of_study`.

**Zone B — Tab Bar**
- Tabs component (see component_specs_v2.md). Six tabs in order:
  Personal | Grades | Language | Teacher Evaluations | Activities | Notes
- Background: `var(--color-surface)`. Bottom border: `var(--border-width)` solid
  `var(--color-border)`. Sticky below profile header on scroll.

**Zone C — Tab Panels (one active at a time)**

See per-tab sections below.

---

### Tab: Personal

**Layout:** Two-column form grid on desktop (two equal columns, `var(--space-6)` gap).
Single column on mobile.

**Fields and API mapping:**

| Field Label | API Field | Type | Notes |
|---|---|---|---|
| Full Name | `full_name` | TextInput | |
| Preferred Name | `preferred_name` | TextInput | Optional |
| Date of Birth | `date_of_birth` | TextInput (date) | ISO 8601 date |
| Age | derived from `date_of_birth` | Read-only display | Auto-calculated; not sent to API |
| Gender | `gender` | TextInput | Free text |
| Address | `address` | TextInput | Spans both columns on desktop |
| Phone | `phone` | TextInput | |
| Email | `email` | TextInput (email) | Student email; distinct from account email |
| Financial Aid | `financial_aid_flag` | Checkbox (Toggle) | Label: "Financial Aid Applicant" |
| Notes | `notes` | Textarea (min 4 rows) | Spans both columns on desktop |

- "Save" button (primary variant) below the grid. API call on save:
  PUT /api/v1/students/{id}/profile.
- Save button enters loading state during call. On 200 OK: Toast success notification.
- On 422: Inline field errors shown via TextInput errorText prop.

---

### Tab: Grades

**REQ-IDs:** REQ-090, REQ-091, REQ-104

**Layout:** Full-width single column within the tab panel.

**Zone C1 — Grade System Selector**
- Label: "Grade System". Displayed as a horizontal button group (radio-button style).
- Options: HKDSE | A-Level | IB | Custom
- Default selected: HKDSE.
- Non-HKDSE options: render a "(partial support)" note in `var(--font-size-xs)`
  `var(--color-text-secondary)` immediately below the selector. Text:
  "Full support for this grade system is coming soon."
- API call on change: GET /api/v1/subjects?grade_system_id={selected_id} to reload
  subject dropdown options in the GradeTable.
- API fields: populated from GET /api/v1/grade-systems.

**Zone C2 — Transcript Upload**
- FileUpload component (see component_specs_v2.md) at the top of the Grades tab,
  above the GradeTable.
- Label: "Upload Transcript (PDF or image, max 10 MB)".
- API call: POST /api/v1/students/{id}/transcript (multipart/form-data).
- On 202 Accepted: FileUpload enters "parsing" state showing "Transcript uploaded.
  Parsing in progress…". Front end polls GET /api/v1/students/{id}/transcript every
  3 seconds until `parse_status` is `complete` or `failed`.
- On `complete`: A Toast notification appears: "Transcript parsed. Review suggested
  grades below." Parsed grades are shown as a review banner above the GradeTable with
  "Apply suggestion" action per row. Parsed grades are NEVER auto-applied to the table.
- On `failed`: Toast error notification: "Transcript parsing failed. Please enter
  grades manually."

**Zone C3 — Grade Table**
- GradeTable component (see component_specs_v2.md).
- API data: GET /api/v1/students/{id}/grades.
- Columns: Subject | Sitting | Grade | Predicted Grade | Transcript | Notes | Actions
- Predicted Grade column uses PredictedGradeBadge for any row where:
  `sitting != "OFFICIAL"` OR `predicted_grade != null`.
- "Add Row" button below the table: secondary variant. Adds a new editable row.
- Each row saves individually: PUT /api/v1/students/{id}/grades/{grade_id}
  (for existing rows) or POST /api/v1/students/{id}/grades (for new rows).
- Delete row: DELETE /api/v1/students/{id}/grades/{grade_id}. Confirmation is
  inline (row highlights in `var(--color-error)` tint; "Confirm delete" appears).

---

### Tab: Language

**Layout:** Single column within the tab panel. Two visually separated sections.

**Section 1 — IELTS**
- Section heading: "IELTS" (`var(--font-size-lg)` `var(--font-weight-medium)`).
- Two-column grid on desktop, single column on mobile.
- Fields:

| Field Label | API Field | Notes |
|---|---|---|
| Overall Band | `ielts_score` | Numeric 0–9, step 0.5 |
| Listening | `ielts_listening` | |
| Reading | `ielts_reading` | |
| Writing | `ielts_writing` | |
| Speaking | `ielts_speaking` | |
| Test Date | `ielts_date` | Date picker |

**Section 2 — Other Scores**
- Section heading: "Other Language Scores".
- Table with add/remove rows. Columns: Label | Score | Date | Remove.
- "Add Score" button below: secondary variant. Adds a new inline-editable row.
- API field: `other_language_scores` array. Each row: `{label, score, date}`.
- Save button (primary variant) below both sections. API call:
  POST /api/v1/students/{id}/language-scores (upsert behaviour).

---

### Tab: Teacher Evaluations

**Layout:** Vertical stack of per-subject evaluation cards. "Add Evaluation" button
at the top of the zone.

**Each Evaluation Card:**
- Container: `var(--color-surface)` background, `var(--border-width)` solid
  `var(--color-border)` border, `var(--border-radius-md)` radius, `var(--space-5)`
  padding, `var(--shadow-sm)`.
- Fields (inline editable):
  - Subject: dropdown from subject list (`subject_code`, displayed as subject name).
    API field: `subject_code`.
  - Teacher Name: TextInput. API field: `teacher_name`.
  - Rating: StarRating component (1–5). API field: `rating`.
  - Comment: Textarea (min 3 rows). API field: `comment`.
  - Date: TextInput (date). API field: `date`.
- "Save" icon button per card (checkmark). API call:
  POST /api/v1/students/{id}/teacher-evaluations (append behaviour).
  Existing entries: the entire array is replaced on save (PUT semantics are on the
  whole array; see API contracts).
- "Delete" icon button per card. Removes the card. On confirm:
  DELETE /api/v1/students/{id}/teacher-evaluations (clears all) is not used for
  individual delete; instead the front end reconstructs the array without the item
  and calls PUT /api/v1/students/{id}/teacher-evaluations — see api_contracts_v2.md
  for array-replace semantics.
- "Add Evaluation" button: secondary variant, full width of zone. Adds a new empty card.

---

### Tab: Activities

**Layout:** Two visually separated sections within the tab panel.

**Section 1 — Extracurricular Activities**
- Section heading: "Extracurricular Activities".
- Each activity: card with fields: Activity (TextInput), Role (TextInput),
  Years (TextInput), Achievement (Textarea). Plus delete icon button.
- "Add Activity" button: secondary variant, below last card.
- API fields from `extra_curricular` array: `activity`, `role`, `years`, `achievement`.
- Save per card: POST /api/v1/students/{id}/extracurricular.

**Section 2 — Awards**
- Section heading: "Awards".
- Each award: card with fields: Title (TextInput), Awarding Body (TextInput),
  Level (dropdown: School / District / Regional / International), Year (TextInput, number).
  Plus delete icon button.
- "Add Award" button: secondary variant, below last card.
- API fields from `awards` array: `title`, `awarding_body`, `level`, `year`.
- Save per card: POST /api/v1/students/{id}/awards.

**Section separating gap:** `var(--space-8)` between sections.

---

### Tab: Notes

**Layout:** Full-width within the tab panel.

- Single Textarea, full width of tab panel, minimum 12 rows.
- Label: "Counsellor Notes" (above textarea).
- Auto-save: textarea triggers PUT /api/v1/students/{id}/profile (with only the
  `notes` field) 1500 ms after the last keystroke (debounced).
- Auto-save indicator: a small text badge appears to the right of the label while
  saving — "Saving…" in `var(--color-text-secondary)` `var(--font-size-xs)`, then
  "Saved" with a checkmark character when the call completes, then fades after 3 s
  (implemented via a timeout, not CSS animation per REQ-039).
- API field: `notes`.

---

## 3. Target Schools

**REQ-IDs:** REQ-092, REQ-093, REQ-103

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Page header: full-width strip
- Drag-handle ranked list: single-column, max-width 960px, horizontally centred.
  Page horizontal padding: `var(--space-8)`.

**Mobile (375px–767px):**
- List full width, page horizontal padding `var(--space-4)`.
- Drag-to-reorder replaced by up/down buttons (keyboard fallback is the primary
  interaction on mobile as touch drag is unreliable).

### Content Zones

**Zone A — Page Header**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-4)` vertical, page horizontal padding.
- Left: Student name (`var(--font-size-xl)` `var(--font-weight-bold)`) +
  "Target Schools" label below (`var(--font-size-sm)` `var(--color-text-secondary)`).
- Right: "Add School" button (primary variant). Opens School Directory in a search
  modal (Modal component; see component_specs_v2.md) allowing search and selection.
  On selection: POST /api/v1/students/{id}/targets.
- API field: `student.full_name`.

**Zone B — Ranked List**
- Background: `var(--color-background)`.
- Each row: TargetSchoolRow component (see component_specs_v2.md).
- Row layout (left to right):
  1. DragHandle (grip icon)
  2. Rank badge (filled circle with rank number: `var(--font-size-sm)`
     `var(--font-weight-bold)` `var(--color-surface)` text on `var(--color-primary)`
     background, `var(--border-radius-sm)`)
  3. School name: `var(--font-size-md)` `var(--font-weight-medium)` `var(--color-text-primary)`
  4. EligibilityBadge component
  5. Fit score %: displayed as integer percentage, colour-coded:
     - ≥70%: `var(--color-success)` text
     - 40–69%: `var(--color-warning)` text
     - <40%: `var(--color-error)` text
     Font: `var(--font-size-sm)` `var(--font-weight-medium)`.
  6. ShapSummary component (top 1 feature shown inline; expand for up to 3)
  7. StatusChip component
  8. Actions: icon buttons — "View School" (navigates to School Profile) and "Remove"
     (triggers DELETE /api/v1/students/{id}/targets/{target_id} after confirmation).
- Ineligible rows: the entire row background changes to a light tint of
  `var(--color-border)` (approximately 40% opacity overlay on `var(--color-surface)`).
  Text colours remain readable (contrast requirement maintained — see accessibility_spec.md).
- Row separation: `var(--border-width)` solid `var(--color-border)` between rows.
  Each row padding: `var(--space-4)` vertical, `var(--space-3)` horizontal.
- Container: `var(--color-surface)` background, `var(--border-radius-md)` radius,
  `var(--shadow-sm)`, `var(--border-width)` solid `var(--color-border)`.

**Reorder behaviour:**
- On drag end: POST /api/v1/students/{id}/targets/reorder with `ordered_target_ids`.
- During drag: rank badges update in real time (optimistic UI).
- On successful save: Toast "Preference order saved." (success type).
- On 400/error: rank badges revert to previous order; Toast error notification.

**Empty state:** EmptyState component with message "No target schools yet. Click
'Add School' to begin." and the "Add School" action button.

---

## 4. School Directory

**REQ-IDs:** REQ-094

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Filter bar: full-width strip below NavBar
- Results grid: 3-column CSS grid, `var(--space-6)` gaps.
  Page horizontal padding: `var(--space-8)`. Vertical padding: `var(--space-6)`.

**Tablet (768px–1279px):**
- Results grid: 2-column grid.

**Mobile (375px–767px):**
- Filter bar: stacked single column (all controls full width).
- Results grid: 1-column stack.
- Page horizontal padding: `var(--space-4)`.

### Content Zones

**Zone A — Filter Bar**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-4)` vertical, page horizontal padding.
- Controls (left to right on desktop, stacked on mobile):
  1. Text search input: label "Search", placeholder "School name…".
     Bound to `q` query parameter.
  2. Type dropdown: label "Type". Options: All | University | Polytechnic |
     Community College | Vocational. Bound to `type` query param.
  3. Location text input: label "Location". Bound to `location` query param.
  4. Score range: label "Entry Score Range". Two numeric inputs (Min, Max) or a
     dual-thumb range slider. Bound to `min_score_gte` and `min_score_lte`.
  5. "Search" button: primary variant. Triggers GET /api/v1/schools with all
     current filter values. Also triggered on Enter from any text input.
- Filter controls gap: `var(--space-4)`.

**Zone B — Results Grid**
- Each cell: SchoolCard component (see component_specs_v2.md).
- API fields per card: from each item in `items` array:
  `name`, `name_zh`, `type`, `location`, `minimum_entry_score`,
  `scholarship_available`.
- Total results count: displayed above the grid as plain text,
  e.g. "Showing 20 of 47 schools." `var(--font-size-sm)` `var(--color-text-secondary)`.

**Zone C — Pagination Controls**
- Displayed below the grid.
- Previous / Next buttons (secondary Button variant).
- Page indicator: "Page 2 of 5" text between buttons.
- On page change: GET /api/v1/schools with updated `offset` (offset = (page - 1) × limit).
  LoadingSpinner replaces grid zone while call is in flight.
- Empty state: EmptyState with message "No schools match your filters. Try adjusting
  the search criteria."

---

## 5. School Profile

**REQ-IDs:** REQ-095

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Full-width hero section
- Two-column content grid below hero: left column (60%) for Admission + Programs,
  right column (40%) for Stats + Action. Gap: `var(--space-8)`.
  Page horizontal padding: `var(--space-8)`. Vertical padding: `var(--space-6)`.

**Tablet (768px–1279px):**
- Single column below hero. Left content first, right content below.

**Mobile (375px–767px):**
- Single column throughout.
- Page horizontal padding: `var(--space-4)`.

### Content Zones

**Zone A — Hero Section**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-6)` vertical, page horizontal padding.
- School name (EN): `var(--font-size-2xl)` `var(--font-weight-bold)` `var(--color-text-primary)`.
- School name (ZH): `var(--font-size-lg)` `var(--font-weight-normal)` `var(--color-text-secondary)`,
  below the EN name. Hidden if `name_zh` is null.
- Type badge: pill label — background `var(--color-background)`, border
  `var(--border-width)` solid `var(--color-border)`, `var(--border-radius-sm)`,
  `var(--space-2)` padding, `var(--font-size-xs)` text.
- Location: `var(--color-text-secondary)` `var(--font-size-sm)` with a map-pin
  character prefix.
- Website link: `var(--color-primary)` `var(--font-size-sm)`, opens in new tab.
  aria-label: "Visit [school name] website (opens in new tab)".
- API fields: `name`, `name_zh`, `type`, `location`, `website`.

**Zone B — Admission Section (left column)**
- Section heading: "Admission Requirements".
- Minimum HKDSE Aggregate: label + numeric value. If null: "Not specified."
- Required Subjects table: columns Subject Code | Minimum Grade. Populated from
  `required_subjects` JSONB array. If empty: "No specific subject requirements listed."
- IELTS Requirement: label + `language_requirements.ielts_minimum` value.
  If null: "No IELTS requirement listed."
- API fields: `minimum_entry_score`, `required_subjects`, `language_requirements`.

**Zone C — Programs Section (left column, below Admission)**
- Section heading: "Programs".
- Faculties: bulleted list from `faculties` JSONB array. If empty: hidden.
- Notable Programs: bulleted list from `notable_programs` array. If empty: hidden.
- API fields: `faculties`, `notable_programs`.

**Zone D — Stats Section (right column)**
- Contained in a FormCard.
- Stats items (label + value pairs, vertically stacked with `var(--space-4)` gap):
  - Acceptance Rate: formatted as percentage (e.g. "32%"), or "N/A" if null.
  - Average Admitted Score: numeric value or "N/A" if null.
  - Scholarship Available: "Yes" or "No". "Yes" rendered in `var(--color-success)`.
- API fields: `acceptance_rate`, `average_admitted_score`, `scholarship_available`.

**Zone E — Action Button (right column, below Stats)**
- Context A (student context active via `?from_student={id}`):
  "Add to [Student Name]'s Target List" — primary Button variant, full width.
- Context B (no student context):
  "Select Student & Add" — primary Button variant, full width.
- "Back to Directory" link: secondary Button variant, full width, below the action button.
- After successful add: button becomes "Already in Target List", disabled.

**Zone F — Data Provenance Footer**
- Displayed below both columns, full width.
- Background: `var(--color-background)`. Border top: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-4)` vertical, page horizontal padding.
- Content: "Source: [data_source]  ·  Last updated: [data_last_updated formatted as
  YYYY-MM-DD]". `var(--font-size-xs)` `var(--color-text-secondary)`.
- If both fields are null: footer is hidden.
- API fields: `data_source`, `data_last_updated`.

---

## 6. Academic Plan

**REQ-IDs:** REQ-096

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Full-width toolbar strip below NavBar
- Full-width content zone (iframe) below toolbar, stretching to bottom of viewport.
  No horizontal padding on the iframe zone (plan renders edge-to-edge in its frame).

**Mobile (375px–767px):**
- Toolbar: stacked layout if content overflows.
- Iframe zone: full viewport width and height minus toolbar. Horizontally scrollable
  if plan HTML is wider than viewport.

### Content Zones

**Zone A — Toolbar**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`. Padding: `var(--space-3)` vertical, `var(--space-6)` horizontal.
- Left: Student name (`var(--font-size-lg)` `var(--font-weight-medium)`) +
  plan version label below ("Plan v[version]", `var(--font-size-xs)`
  `var(--color-text-secondary)`). Version and generated date from `plan.version`
  and `plan.generated_at`.
- Centre: "Generate Plan" button (primary variant). Disabled while generation is
  in progress.
- Right: "Print" button (secondary variant) + last generated timestamp
  (`var(--font-size-xs)` `var(--color-text-secondary)`, formatted as
  "Generated: YYYY-MM-DD HH:MM"). Timestamp hidden if no plan exists.
- API fields: `student.full_name`, `plan.version`, `plan.generated_at`.

**Zone B — Content Zone (three states)**

**State 1 — Idle, plan exists:**
- An iframe fills the content zone. `srcdoc` attribute is set to `plan.html_content`
  from GET /api/v1/students/{id}/plan.
- Iframe has no border, no padding. Background: `var(--color-background)`.
- Title attribute on iframe: "Academic Plan for [student name]" (for accessibility).

**State 2 — Generating (polling active):**
- A centred block within the content zone (not within the iframe):
  - LoadingSpinner (lg size).
  - Text line 1: "Generating plan…" — `var(--font-size-lg)` `var(--font-weight-medium)`
    `var(--color-text-primary)`.
  - Text line 2: "This usually takes up to 10 seconds." — `var(--font-size-sm)`
    `var(--color-text-secondary)`.
  - Both text lines have `role="status"` and `aria-live="polite"`.
- "Cancel" link: secondary Button variant below the loading block. Cancels polling
  (front end stops polling; generation continues server-side but result is ignored
  until next load).

**State 3 — Idle, no plan exists:**
- EmptyState component with message "No plan has been generated yet." and
  "Generate Plan" action button (primary variant).

**Polling behaviour:**
- Interval: every 2 seconds.
- Calls: GET /api/v1/students/{id}/plan/status.
- Stops on status `complete` or `failed`.
- On `complete`: call GET /api/v1/students/{id}/plan, then render iframe.
- On `failed`: show ErrorMessage banner ("Plan generation failed. Try again.") +
  "Try Again" button.

---

## 7. Account Settings

**REQ-IDs:** REQ-097

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Single-column form card layout, max-width 640px, horizontally centred.
  Page padding: `var(--space-10)` vertical, `var(--space-8)` horizontal.

**Mobile (375px–767px):**
- Full width, page padding `var(--space-6)` vertical, `var(--space-4)` horizontal.

### Content Zones

The page is a vertical stack of FormCard sections, each with `var(--space-8)` gap
between them.

**Zone A — Display Name Section**
- FormCard title: "Profile"
- Field: Display Name (TextInput, label "Display Name", bound to `account.display_name`).
- "Save" button (primary variant). API call: PUT /api/v1/account with `{display_name}`.
- On 200 OK: Toast success.

**Zone B — Email Section**
- FormCard title: "Email Address"
- Read-only display of `account.email`. Rendered as plain text (not an input field)
  in `var(--color-text-primary)`.
- Helper note below: "To change your email address, contact your administrator."
  `var(--font-size-sm)` `var(--color-text-secondary)`.

**Zone C — Password Change Section**
- FormCard title: "Change Password"
- Three TextInput fields (type="password"):
  1. Current Password (bound to `current_password`)
  2. New Password (bound to `new_password`)
  3. Confirm New Password (bound to `confirm_new_password`)
- "Change Password" button (primary variant). API call:
  PUT /api/v1/account/password.
- On 200 OK: Toast success. Fields are cleared.
- On 401 (wrong current password): inline error on Current Password field.
- On 422 (mismatch / too short): inline errors on relevant fields.

**Zone D — Preferences Section**
- FormCard title: "Preferences"
- Preferred Language: toggle buttons (two-option, radio-button style).
  Options: "English" | "中文". Bound to `account.preferred_language` (`en` / `zh-HK`).
  On change: PUT /api/v1/account with `{preferred_language}`.
- Notification Preferences: a single toggle switch labelled "Email notifications".
  Marked as "(coming soon)" in `var(--font-size-xs)` `var(--color-text-secondary)`.
  Toggle is rendered but disabled (not wired to any API call in v2).

**Zone E — Danger Zone Section**
- FormCard title: "Danger Zone"
- FormCard border colour override: `var(--color-error)` (to signal destructive content).
- "Delete Account" button: danger Button variant.
- Trigger: clicking button opens a Modal with:
  - Title: "Delete Account"
  - Body: "This action cannot be undone. Your account will be deactivated and you
    will be logged out. Enter your password to confirm."
  - Password TextInput (type="password") within modal body.
  - Confirm button: danger variant, label "Yes, Delete My Account".
  - Cancel button: secondary variant.
  - API call on confirm: DELETE /api/v1/account with `{password}`.
  - On 200 OK: JWT is cleared; navigate to Login page; no toast (page is gone).
  - On 401 (wrong password): inline error on password field within modal; modal
    remains open.

---

## 8. Admin: Data Refresh

**REQ-IDs:** REQ-098

### Grid Structure

**Desktop (1280px+):**
- Full-width NavBar
- Single-column card layout, max-width 760px, horizontally centred.
  Page padding: `var(--space-10)` vertical, `var(--space-8)` horizontal.

**Mobile (375px–767px):**
- Full width, page padding `var(--space-6)` vertical, `var(--space-4)` horizontal.

### Content Zones

**Zone A — Page Header**
- Page heading: "Data Refresh" (`var(--font-size-2xl)` `var(--font-weight-bold)`).
- "Admin" badge pill: background `var(--color-warning)`, text `var(--color-surface)`,
  `var(--border-radius-sm)`, `var(--space-2)` padding, `var(--font-size-xs)`.
  Displayed inline beside the heading.

**Zone B — Status Card**
- FormCard with title "Refresh Status".
- Last Refresh: label + formatted timestamp from the last trigger response.
  If never triggered in session: "Never" in `var(--color-text-secondary)`.
- Per-source status indicators. Three rows:
  - Subjects (HKEAA data)
  - Schools (University profiles)
  - JUPAS Scores
  Each row: source name + status indicator character:
  - Success: "✓" in `var(--color-success)` + timestamp.
  - Pending: "…" in `var(--color-warning)`.
  - Unknown / not run: "—" in `var(--color-text-secondary)`.
- Note: v2 status data is derived from the POST /api/v1/admin/data-refresh response
  and stored in front-end session state. No dedicated status polling endpoint exists
  in v2; status indicators are informational approximations.

**Zone C — Trigger Card**
- FormCard with title "Trigger Data Refresh".
- Explanatory text: "Running a data refresh will update school profiles, JUPAS entry
  scores, and subject lists from external sources. This may take several minutes."
  `var(--font-size-sm)` `var(--color-text-secondary)`.
- "Trigger Data Refresh" button: primary Button variant, full width.
- Trigger: button click opens a confirmation Modal:
  - Title: "Confirm Data Refresh"
  - Body: "This will queue a full data re-import. Continue?"
  - Confirm button: primary variant, label "Yes, Trigger Refresh".
  - Cancel button: secondary variant.
  - API call on confirm: POST /api/v1/admin/data-refresh.
  - On 202 Accepted: Modal closes; Toast success "Data refresh triggered.";
    button enters disabled state with label "Refresh Triggered" for the remainder
    of the session.
  - On 403: Toast error "You do not have permission to trigger a data refresh."

**Zone D — Console Log Area**
- FormCard with title "Recent Messages".
- A scrollable, fixed-height text area (not a form textarea — a read-only display
  area): monospace font (`var(--font-family-base)` with a fallback to a monospace
  system font), `var(--font-size-xs)`, `var(--color-text-secondary)` text on
  `var(--color-background)` background.
- Height: approximately 200px on desktop, with internal scroll.
- Content: recent messages from POST /api/v1/admin/data-refresh response or session log.
  In v2 MVP, this displays the `triggered_at`, `triggered_by` fields from the response
  as a log line. Placeholder text when empty: "No refresh messages yet."
- Border: `var(--border-width)` solid `var(--color-border)`.
  Border radius: `var(--border-radius-sm)`.
- Not interactive (read-only display zone).

---

## Responsive Token Reference Summary

All breakpoint-based layout changes use the following references:

| Viewport Width | Token Reference | Layout Change |
|---|---|---|
| ≤767px | Below `var(--breakpoint-md)` | 1-column stacks, reduced horizontal padding |
| 768px–1279px | `var(--breakpoint-md)` to `var(--breakpoint-lg)` | 2-column grids where applicable |
| ≥1280px | At or above `var(--breakpoint-lg)` | Full desktop layout as specified above |
