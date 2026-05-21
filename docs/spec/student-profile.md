<!-- spec-tracks: apps/web/src/pages/StudentProfile/StudentProfile.jsx, apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx, apps/web/src/pages/StudentProfile/GradesTab.jsx, apps/web/src/pages/StudentProfile/PlansTab.jsx, apps/web/src/pages/StudentProfile/PersonalTab.jsx, apps/web/src/pages/StudentProfile/EvaluationsTab.jsx, apps/web/src/pages/StudentProfile/ActivitiesTab.jsx, apps/web/src/pages/StudentProfile/NotesTab.jsx, apps/web/src/pages/StudentProfile/LanguageTab.jsx, apps/web/src/pages/StudentProfile/OtherTab.jsx, apps/web/src/hooks/useGradesTab.js, apps/web/src/hooks/usePersonalTab.js, apps/web/src/hooks/usePlansTab.js, apps/web/src/hooks/useLanguageTab.js, apps/web/src/hooks/useEvaluationsTab.js, apps/web/src/hooks/useActivitiesTab.js, apps/web/src/hooks/useNotesTab.js, apps/web/src/api/students.js, apps/web/src/api/targets.js, apps/web/src/api/grades.js, apps/web/src/api/gradeBuilds.js, apps/web/src/api/plan.js, apps/web/src/api/transcripts.js, apps/web/src/api/match.js -->

# Student Profile Page -- Comprehensive Spec

Route: `/students/:id`
Active tab controlled by `?tab=` query parameter (default: `programmes`).

---

## 1. Page Shell (StudentProfile.jsx)

### Elements

- **NavBarV2** -- top navigation bar, receives `account` data
- **Back link** -- "← Back to Dashboard" link, navigates to `/dashboard`. Styled as inline text link with primary color, small font
- **QueryBoundary** -- wraps all content below; shows loading spinner, error state, or retry button while `studentQuery` is pending/errored
- **Student header bar** -- surface-colored bar with bottom border, flex layout (space-between), wraps on small screens
  - **Student name** (`h1`) -- `student.full_name` or fallback "Student Profile", bold, 2xl font
  - **Candidate number badge** -- shown only if `student.candidate_number` exists. Small font, medium weight, secondary text color, bordered pill with background color
  - **Class badge** -- shown only if `student.class_name` exists. Small font, primary color text, light blue background pill. Prefixed with translated "Class" label
  - **Year of study label** -- shown only if `student.year_of_study` exists. Small font, secondary text. Prefixed with translated "Year" label
  - **Graduated badge** -- shown only if `student.is_graduated`. Green background, white text, rounded pill. Shows "Graduated" + optional `graduation_year`
  - **"Mark Graduated" button** -- shown only if `!student.is_graduated`. Variant: secondary. Disabled (50% opacity, not-allowed cursor) if `canEditProfile` is false. Opens graduate modal
  - **"Generate Plan" button** -- always shown. Primary variant. Disabled if `canEditProfile` is false. Navigates to `/students/:id/consultant?generate=true`
- **Tab bar** -- sticky at `top: 56px`, z-index 50, surface background, bottom border. Horizontally scrollable on overflow. Uses `TabsList` with variant "line"
  - Tab triggers (5 total):
    1. `programmes` -- translated label `profile.tabs.programmes`
    2. `grades` -- translated label `profile.tabs.grades`
    3. `plans` -- translated label `profile.tabs.plans`
    4. `personal` -- translated label `profile.tabs.personal`
    5. `other` -- translated label `profile.tabs.other`
- **Tab content area** -- padded container (`px-4 md:px-8`), max-width 100%, top padding

#### Graduate Modal (Dialog)

- **Title** -- translated `profile.markGraduated`
- **Description text** -- translated `profile.graduateConfirm`, secondary color, small font
- **Final School select** -- `<select>` dropdown. Options: "None/Unknown" + dynamically loaded school list (up to 100 schools fetched from `searchSchools` API on modal open)
- **Final Major input** -- `<Input>` component, text field, placeholder from `profile.finalMajorPlaceholder`
- **Graduation Year input** -- `<Input>` component, type number, pre-filled with current year
- **Cancel button** -- secondary variant, disabled while mutation is pending
- **Confirm Graduate button** -- primary variant, disabled while mutation is pending. Label toggles between `profile.saving` and `profile.confirmGraduate`

### Data flow

- `GET /api/v1/students/:id` -- fetches student record. Query key: `['student', id]`
  - Response: full student object with fields: `full_name`, `candidate_number`, `class_name`, `year_of_study`, `is_graduated`, `graduation_year`, `date_of_birth`, `gender`, `address`, `phone`, `email`, `preferred_name`, `preferred_language`, `financial_aid_flag`, `personal_statement`, `notes`, `ielts_*`, `other_language_scores`, `extra_curricular`, `awards`
- `GET /api/v1/account` -- fetches current user account. Query key: `['account']`, staleTime 5 min
- `GET /api/v1/grades/subjects` -- fetches subject list. Query key: `['subjects']`, staleTime 10 min
- `POST /api/v1/students/:id/graduate` -- graduates student
  - Request: `{ final_school_id: string|null, final_major: string|null, graduation_year: number|null }`
  - On success: invalidates `['student', id]`, closes modal, shows success toast
  - On error: shows error toast
- Schools for graduate modal: lazy-loaded via `searchSchools({ limit: 100 })` from `api/schoolsV2` (dynamic import). Cached in `schoolOptions` state

### Key behaviors

- Active tab is read from and written to the `?tab=` URL search parameter. Defaults to `programmes`
- `handleStudentSaved(updated)` -- called by child tabs after saving; optimistically sets the student query data
- Permission gating via `useFeatureAccess('student_profile')` -- controls "Mark Graduated" and "Generate Plan" buttons
- Tab bar is sticky below the navbar (top: 56px) with overflow-x scroll for mobile
- The Grades tab content area also renders `LanguageTab` below it, separated by a top border

---

## 2. Programme Choices Tab (ProgrammeChoicesTab.jsx)

### Elements

- **Section heading** (`h3`) -- translated `profile.programmesTab.title`, lg font, medium weight
- **Choice table** -- full-width table inside a bordered, rounded surface card. Columns:
  1. **Rank** (`th`: translated `programmes.rank`) -- slot number 1-20, bold, centered
  2. **Band** (`th`: translated `programmeDetail.band`) -- rowSpan per band group, bold, lg font, colored background per band. Bands:
     - Band A: slots 1-3, red-tinted background (#fff1f2), red-rose text (#be123c)
     - Band B: slots 4-6, yellow background (#fef9c3), amber text (#a16207)
     - Band C: slots 7-10, green background (#d1fae5), emerald text (#047857)
     - Band D: slots 11-14, blue background (#dbeafe), blue text (#1d4ed8)
     - Band E: slots 15-20, slate background (#f1f5f9), slate text (#475569)
  3. **Code** (`th`: translated `programmes.code`) -- JUPAS code in monospace font, bold xs, slate background pill
  4. **Name** (`th`: translated `programmes.name`) -- programme name prefixed with school name. Below the name:
     - **"AT RISK" badge** -- red background, white text, 10px font, shown if `target.at_risk`
     - **"INELIGIBLE" label** -- dark red text, 10px, shown if `target.eligibility_pass === false`
     - **Requirement badges** -- from `getRequirementBadges()`, colored pills for non-grade requirements (e.g., interview, portfolio)
     - **Empty slot "Add" link** -- italic, underlined, primary color, xs font. Clickable to open add modal for that specific slot. Disabled (not-allowed, 50% opacity) if `canEditChoices` is false
  5. **Score** (`th`: translated `programmes.score`) -- match percentage, color-coded: green >=70%, amber >=40%, red <40%. Bold
  6. **Status** (`th`: translated `targets.applicationStatus`) -- `StatusChip` component rendering target status
  7. **Actions** (`th`: empty header, 60px width) -- per-row action buttons:
     - **Edit button** (pencil icon "✎") -- bordered, small, opens edit modal. Disabled if `canEditChoices` is false
     - **Remove button** ("x" icon) -- bordered, small, error color. Opens remove confirmation modal. Disabled if `canEditChoices` is false

#### Add Programme Modal (custom full-screen overlay)

- **Backdrop** -- fixed position, semi-transparent black. Click outside to close
- **Modal container** -- max-width 900px, max-height 85vh, flex column, rounded, shadowed
- **Header**
  - **Title** (`h2`) -- translated `profile.programmesTab.addProgramme` + optional slot indicator " — Rank N"
  - **Close button** -- "x" icon, top-right, no border
- **Two-pane body** -- flex row, divided by vertical border
  - **Left pane: Recommendations** (flex 1 1 340px, scrollable)
    - **Section label** -- "Recommended" in primary color, small font, medium weight
    - **Loading text** -- shown while recommendations load
    - **Empty text** -- shown if no recommendations
    - **Recommendation list** -- unordered list of clickable items:
      - **School/programme name** -- medium weight. Uses localized name helper
      - **Major name + JUPAS code** -- xs font, primary color, shown if `rec.major_name` exists
      - **Match score** -- xs font, color-coded (green >=70%, amber >=40%, red <40%), bold
      - **Selected state** -- light blue background + primary border when selected
  - **Right pane: Search & Browse** (flex 1 1 460px, flex column)
    - **JUPAS / Self-Financing toggle** -- segmented control with two buttons:
      - JUPAS button -- shows count of JUPAS programmes. Active: surface bg + primary text + shadow
      - Self-Financing button -- shows count of SF programmes. Active: surface bg + primary text + shadow
      - Switching resets filters and search input
    - **Search label** -- translated `programmes.searchLabel`, sm font, medium weight
    - **Filter bar** -- flex wrap row:
      - **Active filter chips** -- removable pills:
        - University filter: blue background (#dbeafe), blue text (#1d4ed8), prefixed "University:"
        - Text filter: slate background (#f1f5f9), dark text, prefixed "Search:"
        - Each chip has a "x" remove button
      - **"+ Add filter" button** -- dashed primary border, primary text, rounded pill. Opens category picker dropdown
      - **Category picker dropdown** (when open):
        - "University" option -- bold label + description "Filter by institution"
        - "Programme" option -- bold label + description "Filter by programme"
      - **University picker dropdown** -- search input + scrollable list of all school names. Click to add as filter chip. Already-selected universities are excluded
      - **Programme type picker dropdown** -- text input, press Enter to add as text filter chip. Shows hint text "Press Enter to filter"
      - **"Clear all" button** -- shown only if filters exist. Text button, secondary color
    - **Search input** -- full-width text input, placeholder from `programmes.searchPlaceholder`. Enter key: if matches a university suggestion, adds as uni filter; otherwise adds as text filter
    - **Result count** -- xs font, secondary color. Shows "N of M programmes" or loading/no results text
    - **Programme list** -- scrollable `<ul>`, each item clickable:
      - **JUPAS code** (for JUPAS programmes) -- monospace, bold xs, slate pill
      - **Level badge** (for SF programmes) -- purple background, bold xs
      - **School name** -- xs font, secondary color
      - **Programme name** -- medium weight, displayed below
      - **Faculty** -- xs font, secondary color, shown if exists
      - **Website link** -- xs font, primary color, opens in new tab. Stops event propagation
      - **Selected state** -- light blue background + primary border
- **Footer**
  - **Selection summary** -- shows selected programme name (with JUPAS code if applicable), or instruction text if nothing selected
  - **Cancel button** -- secondary variant
  - **Add button** -- primary variant, disabled if no programme selected or currently adding. Label toggles "Adding..." / "Add Programme"

#### Remove Confirmation Modal

- `<Modal>` component with danger confirm variant
- **Body text** -- translated `confirmation.removeProgramme` with programme name and band interpolated

#### Edit Target Modal

- `<Modal>` component with primary confirm variant
- **Title** -- "Edit" + school name
- **Intended Majors input** -- text input, comma-separated values. Label includes "(comma separated)" hint
- **Year of Entry input** -- number input
- **Application Status select** -- dropdown with options: Not set, CONSIDERING, APPLIED, ADMITTED, REJECTED, WITHDRAWN
- **Student Confidence slider** -- range input 1-5 with accent color primary. Labels: 1=Unsure, 2=Exploring, 3=Interested, 4=Strong, 5=Decided. Current label shown to the right (min-width 90px)
- **Save button** -- label toggles "Saving..." / "Save". Disabled while saving

### Data flow

- `GET /api/v1/students/:studentId/targets` -- fetches target list. Query key: `['targets', studentId]`
  - Response: array of targets or `{ targets: [...] }`. Each target has: `id`, `student_rank`, `school_id`, `school_name`, `school_name_zh`, `programme_name`, `programme_name_zh`, `jupas_code`, `match_score`, `at_risk`, `eligibility_pass`, `status`, `intended_majors`, `year_of_entry`, `preference_confidence`
- `POST /api/v1/students/:studentId/targets` -- adds a new target
  - Request: `{ school_id, jupas_code?, programme_name?, student_rank? }`
- `PUT /api/v1/students/:studentId/targets/:targetId` -- updates a target
  - Request: `{ intended_majors: string[]|null, year_of_entry: number|null, status: string|null, preference_confidence: number }`
- `DELETE /api/v1/students/:studentId/targets/:targetId` -- removes a target
- `POST /api/v1/students/:studentId/targets/reorder` -- reorders targets
  - Request: `{ ordered_ids: string[] }`
- `GET /api/v1/jupas/programmes` (via `getAllProgrammes`) -- fetches all JUPAS programmes. Query key: `['jupas-all']`, staleTime 10 min
  - Response: `{ programmes: [...], schools: [...] }`. Programme fields: `jupas_code`, `name`, `name_zh`, `school_id`, `school_name`, `school_name_zh`, `faculty`, `non_grade_requirements`, `website_url`
- `GET /api/v1/self-financing/programmes` (via `getSfProgrammes`) -- fetches all SF programmes. Query key: `['sf-programmes-all']`, staleTime 10 min
  - Response: array or `{ programmes: [...] }`. Fields: `programme_code`, `name`, `name_zh`, `institution_name`, `institution_name_zh`, `faculty`, `level`, `admission_score_mean/lq/uq`
- `GET /api/v1/students/:studentId/recommendations/auto?limit=5` -- auto recommendations. Loaded on modal open
  - Response: array or `{ recommendations: [...] }`. Fields: `school_id`, `id`, `school_name`, `major_name`, `major_jupas_code`, `final_score`, `name`

### Key behaviors

- Targets sorted by `student_rank` ascending
- Unranked targets fill into first available slots (1-20)
- Reorder is optimistic: UI updates immediately, reverts on API failure
- Filter chips use AND logic -- all must match
- Permission gating via `useFeatureAccess('programme_choices')` -- controls add, edit, remove, reorder actions
- Recommendations auto-load when add modal opens, filtered to exclude already-targeted schools
- Localized names via `useLocalizedName()` helper (supports `_zh` suffixed fields)
- Band tooltips available via `t('bands.X')` translations

---

## 3. Grades Tab (GradesTab.jsx)

### Elements

- **Build selector row** -- flex wrap row:
  - **Build dropdown** (`<select>`) -- options: "Actual Grades" (value ""), plus up to 5 saved builds by name
  - **"+ New Build" link** -- text button, primary color. Hidden if 5 builds exist or if new build form is shown
  - **New build form** (when `showNewBuild` is true):
    - **Name input** -- 150px width, placeholder "Build name", Enter key triggers create
    - **Create button** -- primary variant
    - **Close button** -- "x" icon, secondary color
  - **"Delete Build" link** -- shown only when a build is active. Error color text, xs font

#### Build Mode (when `activeBuildId` is set)

- **Build grades table** -- full-width, bordered, rounded. Columns:
  - **Subject** -- HKDSE subject code translated via `t('subjects.CODE')`, falling back to raw code
  - **Grade** -- `<select>` dropdown per subject with options: "—" (empty), 5**, 5*, 5, 4, 3, 2, 1, U
  - All 32 HKDSE subject codes listed: CHLA, ENGL, MATH, CSD, CHIH, CHIL, HIST, GEOG, TOUR, VART, MUSC, ERS, PE, ECON, BAFS, BIOL, CHEM, PHYS, CSCI, ISCI, M1, M2, ICT, DAT, HMSC, TL, FREN, GERM, JAPA, SPAN, PTH, APL_GENERIC
- **Live scores panel** -- shown below build table when scores exist. Bordered card:
  - **Heading** -- "Live Scores", bold sm font
  - **Score rows** -- per target programme:
    - Programme name (left-aligned)
    - Match score percentage (right-aligned, bold, tabular-nums). Color: green >=70%, amber >=40%, red <40%

#### Actual Grades Mode (when no build selected)

- **Upload section**
  - **Label** -- "Upload Transcript", medium weight sm font
  - **FileUpload component** -- accepts `.pdf, .jpg, .jpeg, .png`. Shows progress bar during upload. Loading state during parsing
  - **Parsing status text** -- "Transcript parsing in progress..." shown while `transcriptState === 'parsing'`
- **Parsed grades review panel** -- shown when `parsedGrades` array is non-empty. Background card:
  - **Heading** -- translated `grades.parsedReview`
  - **Per-suggestion row** -- flex row:
    - **Subject + Grade + Confidence text** -- e.g. "Biology — Grade: 5 (Confidence: 0.95)"
    - **Accept button** -- primary variant. Creates grade with sitting=OFFICIAL, transcript_uploaded=true
    - **Dismiss button** -- secondary variant. Removes from parsed list
- **Sitting toggle** -- segmented button group, shown only if >1 sitting exists. Each button shows sitting name + count. Active sitting: primary bg, white text. Options come from distinct `sitting` values in grade data
- **Grades table** -- horizontally scrollable, bordered, rounded. Columns:
  1. **Subject** -- sticky left column, surface background. Translated via `t('subjects.CODE')` with fallback to `subject_name` or `subject_code`
  2. **Year** -- `year_of_exam` or "—"
  3. **Grade** -- `raw_grade`
  4. **Predicted Grade** -- `PredictedGradeBadge` component. For non-OFFICIAL sittings: shows `predicted_grade`. For OFFICIAL: shows `raw_grade` marked as official. Otherwise "—"
  5. **Transcript** -- checkmark "✓" if `transcript_uploaded`, empty otherwise
  6. **Notes** -- `notes` field text
  7. **Actions** -- "Delete" text button, error color. Has aria-label "Delete grade for {subject}"
- **Add Grade section** (below table):
  - **"Add Grade" button** (when `newRow` is null) -- secondary variant
  - **New grade form** (when `newRow` is set) -- bordered card with primary border:
    - **Heading** -- "New Grade Entry"
    - **Subject select** -- dropdown of all subjects (from `subjects` prop or hardcoded HKDSE codes). Translated labels
    - **Sitting select** -- dropdown: MOCK, TRIAL, OFFICIAL
    - **Year input** -- number, placeholder current year
    - **Grade select** -- dropdown: 5**, 5*, 5, 4, 3, 2, 1, U
    - **Notes input** -- text field, placeholder "Notes"
    - **Save Grade button** -- primary variant
    - **Cancel button** -- secondary variant, resets `newRow` to null

### Data flow

- `GET /api/v1/students/:studentId/grades` -- fetches grades. Query key: `['grades', studentId]`
  - Response: array or `{ grades: [...] }`. Each grade: `id`, `subject_code`, `subject_name`, `sitting`, `raw_grade`, `predicted_grade`, `year_of_exam`, `transcript_uploaded`, `notes`
- `POST /api/v1/students/:studentId/grades` -- creates a grade
  - Request: `{ subject_name, raw_grade, sitting, notes?, transcript_uploaded?, year_of_exam? }`
- `DELETE /api/v1/students/:studentId/grades/:gradeId` -- deletes a grade
- `POST /api/v1/students/:studentId/transcript` -- uploads transcript file (multipart/form-data)
- `GET /api/v1/students/:studentId/transcript` -- polls transcript parse status
  - Response: `{ parse_status: 'complete'|'failed'|'pending', parsed_data: [{subject, grade, confidence}] }`
- `GET /api/v1/students/:studentId/grade-builds` -- fetches grade builds. Query key: `['grade-builds', studentId]`
  - Response: `{ builds: [{id, name, grades: {subjectCode: grade}}] }`
- `POST /api/v1/students/:studentId/grade-builds` -- creates build
  - Request: `{ name: string, grades: {} }`
- `PUT /api/v1/students/:studentId/grade-builds/:buildId` -- updates build grades
  - Request: `{ grades: {subjectCode: grade} }`
- `DELETE /api/v1/students/:studentId/grade-builds/:buildId` -- deletes build
- `POST /api/v1/students/:studentId/grade-builds/:buildId/scores` -- scores a build against targets
  - Response: `{ scores: [{jupas_code, programme_name, match_score}] }`

### Key behaviors

- Default sitting is the one with the most grades. If no grades exist, defaults to "MOCK"
- Sitting filter is local state, not URL-persisted
- Transcript upload uses polling (3-second intervals) to check parse status after upload
- Parsed grade suggestions can be individually accepted (creates OFFICIAL grade) or dismissed
- Grade builds are capped at 5 per student
- Build grade changes trigger a debounced (300ms) live score recalculation
- When switching builds, grades and scores are reloaded from the selected build
- Subject column is sticky-left on horizontal scroll

---

## 4. Language Tab (LanguageTab.jsx)

Rendered inside the Grades tab content area, below a divider.

### Elements

- **IELTS section heading** (`h3`) -- translated `language.ielts`, lg font, medium weight
- **IELTS score grid** -- 2-column grid, 6 fields:
  1. **Overall Band** -- number input, step 0.5, min 0, max 9. Label: `language.overallBand`
  2. **Listening** -- number input, step 0.5, min 0, max 9. Label: `language.listening`
  3. **Reading** -- number input, step 0.5, min 0, max 9. Label: `language.reading`
  4. **Writing** -- number input, step 0.5, min 0, max 9. Label: `language.writing`
  5. **Speaking** -- number input, step 0.5, min 0, max 9. Label: `language.speaking`
  6. **Test Date** -- date input. Label: `language.testDate`
- **Other Scores section heading** (`h3`) -- translated `language.otherScores`
- **Other score rows** -- one per entry, 4-column grid (1fr 1fr 1fr auto):
  - **Label input** -- text, aria-label "Score label"
  - **Score input** -- text, aria-label "Score value"
  - **Date input** -- date type, aria-label "Score date"
  - **Remove button** -- error color text, "Remove"
- **"Add Score" button** -- secondary variant, appends a new empty row `{label:'', score:'', date:''}`
- **Save button** -- primary variant, disabled while saving. Label toggles "Loading..." / "Save"

### Data flow

- Reads from `student` prop fields: `ielts_score`, `ielts_listening`, `ielts_reading`, `ielts_writing`, `ielts_speaking`, `ielts_date`, `other_language_scores`
- `POST /api/v1/students/:studentId/language-scores`
  - Request: `{ ielts_score: float|null, ielts_listening: float|null, ielts_reading: float|null, ielts_writing: float|null, ielts_speaking: float|null, ielts_date: string|null, other_language_scores: [{label, score, date}] }`
  - On success: invalidates `['student', studentId]`, calls `onSaved(updated)`, shows success toast
  - On error: shows error toast

### Key behaviors

- All IELTS number fields accept 0.5 increments (step=0.5), range 0-9
- Other scores list is fully dynamic -- add/remove rows at will
- Empty string values are converted to `null` before sending to API

---

## 5. Plans Tab (PlansTab.jsx)

### Elements

- **Header row** -- flex, space-between:
  - **Title** (`h2`) -- "Saved Plans (N)" where N is plan count. lg font, medium weight
  - **"Generate New" button** -- primary variant. Disabled if `canGenerate` is false (opacity 0.5, not-allowed cursor, tooltip). Navigates to `/students/:studentId/consultant?generate=true`
- **Empty state** -- `EmptyState` component with translated `plans.noPlansEmptyState`, shown when `plans.length === 0`
- **Plan list** (shown when no plan selected) -- clickable cards:
  - **Plan card** -- bordered, rounded, padded, pointer cursor. Keyboard accessible (Enter/Space to select)
    - **Plan label** -- md font, medium weight. Falls back to "Plan vN"
    - **Date** -- xs font, secondary color. `generated_at` formatted as "YYYY-MM-DD HH:MM"
    - **Snapshot summary** -- xs font, secondary color. Shows: subject count, Best-5 aggregate, recommended school count
    - **Download PDF button** -- icon (FileDown) + "Download PDF" text. xs font, primary color. Triggers blob download
    - **Delete button** -- xs font, error color text. Opens delete confirmation modal
- **Selected plan detail view** (shown when a plan is selected):
  - **Back link** -- "← Back to List", primary color text button
  - **Plan label** (`h3`) -- md font, medium weight
  - **Download PDF button** -- primary variant with FileDown icon. Disabled while downloading
  - **Delete Plan button** -- destructive variant. Disabled while deleting. Label toggles "Deleting..." / "Delete Plan"
  - **Snapshot panel** -- background card, bordered, sm font, secondary color. Shows: subject count, Best-5 aggregate, recommended school count. Only shown if `snapshot_data` exists
  - **Plan content iframe** -- `srcDoc` renders `html_content`. Full width, min-height 600px, bordered, rounded, sandboxed (empty sandbox attribute). Shown if `html_content` exists
  - **Empty content state** -- `EmptyState` with "No content stored" if `html_content` is missing

#### Delete Confirmation Modal

- `<Modal>` with danger confirm variant
- **Body text** -- translated `confirmation.deletePlan`
- **Confirm button** -- translated `confirmation.confirm`
- **Cancel button** -- translated `confirmation.cancel`

### Data flow

- `GET /api/v1/students/:studentId/plans/history` -- fetches plan history. Query key: `['plans', studentId]`
  - Response: `{ plans: [{id, version, plan_label, generated_at, html_content, snapshot_data, recommended_schools}] }`
  - `snapshot_data`: `{ subject_grades: [], best5_aggregate: number|null }`
- `DELETE /api/v1/students/:studentId/plans/history/:planId` -- deletes a saved plan
  - On success: invalidates `['plans', studentId]`, deselects if deleted plan was selected, shows success toast
- `GET /api/v1/students/:studentId/plans/history/:planId/export-pdf` -- downloads plan as PDF blob
  - If response is PDF: triggers browser download as "academic-plan-history.pdf"
  - If response is HTML: opens in new tab and triggers print dialog

### Key behaviors

- Permission gating via `useFeatureAccess('plan_generation')` -- controls "Generate New" button
- Plan list is a master-detail pattern: clicking a card shows its detail, "Back to List" returns
- PDF download uses blob response handling with fallback to HTML print
- Delete requires confirmation modal

---

## 6. Personal Tab (PersonalTab.jsx)

### Elements

- **Form grid** -- 2-column CSS grid, gap spacing
- **Full Name input** -- `<Input>`, id `input-full_name`. Has error display (red xs text, role="alert") for validation
- **Preferred Name input** -- `<Input>`, id `input-preferred_name`
- **Date of Birth input** -- native `<input type="date">`. Below it: **Age display** -- xs font, secondary color, shows calculated age (e.g., "Age: 17"). Only shown if DOB is set
- **Gender input** -- `<Input>`, id `input-gender`
- **Address input** -- `<Input>`, id `input-address`. Spans full grid width (`gridColumn: 1 / -1`)
- **Phone input** -- `<Input>`, id `input-phone`
- **Email input** -- `<Input>`, type email, id `input-email`. Has error display for validation
- **Class input** -- `<Input>`, id `input-class_name`
- **Year of Study input** -- `<Input>`, type number, id `input-year_of_study`
- **Candidate Number input** -- `<Input>`, id `input-candidate_number`
- **Preferred Language select** -- `<select>` with options: English (`en`), Chinese (`zh`)
- **Financial Aid checkbox** -- native `<input type="checkbox">` + label "Financial Aid"
- **Personal Statement textarea** -- 6 rows, full width, resizable vertically. Placeholder from `personal.personalStatementPlaceholder`
- **Save button** -- primary variant, disabled while saving. Label toggles "Loading..." / "Save"

### Data flow

- Reads from `student` prop. Initializes form state with all personal fields
- `PUT /api/v1/students/:studentId/profile`
  - Request: `{ full_name, preferred_name, date_of_birth: string|null, gender, address, phone, email, class_name, year_of_study: number|null, candidate_number, financial_aid_flag: boolean, preferred_language, personal_statement: string|null }`
  - On success: clears autosave draft, invalidates `['student', studentId]`, calls `onSaved(updated)`, shows success toast
  - On 422 error: shows validation error detail as toast
  - On other error: shows generic error toast

### Key behaviors

- Autosave drafts to localStorage via `useAutosave` hook with key `draft:personal:{studentId}`. Draft loaded on mount
- On save success, draft is cleared via `clearDraft()`
- Age calculated from DOB using `calcAge()` -- simple year-based calculation
- `year_of_study` converted from string to integer (or null) before API call
- Empty `date_of_birth` and `personal_statement` sent as null

---

## 7. Other Tab (OtherTab.jsx)

Container tab that holds three sub-sections with toggle buttons.

### Elements

- **Section toggle buttons** -- row of 3 buttons:
  1. **Evaluations** -- translated `profile.tabs.evaluations`
  2. **Activities** -- translated `profile.tabs.activities`
  3. **Notes** -- translated `profile.tabs.notes`
  - Active button: primary background, white text, medium weight
  - Inactive button: no background, secondary text, normal weight, bordered
- **Content area** -- renders one sub-section at a time based on `expanded` state (default: `evaluations`)

### Key behaviors

- Only one sub-section visible at a time
- Default expanded section is "evaluations"

---

## 7a. Evaluations Sub-Tab (EvaluationsTab.jsx)

### Elements

- **"Add Evaluation" button** -- secondary variant, top of section
- **Evaluation cards** -- one per evaluation, shadowed bordered card:
  - **Subject Code input** -- text input, label "Subject Code"
  - **Teacher Name input** -- text input, label "Teacher Name"
  - **Rating** -- `StarRating` component (interactive). Label from subject code or "Evaluation N"
  - **Comment textarea** -- 3 rows, resizable, label "Comment"
  - **Date input** -- native date input, label "Evaluation Date"
  - **Save button** -- primary variant, saves ALL evaluations at once. Disabled while saving. Label toggles "Loading..." / "Save"
  - **Delete button** -- destructive variant. Immediately removes from list and triggers save

### Data flow

- `GET /api/v1/students/:studentId/teacher-evaluations` -- fetches evaluations. Query key: `['evaluations', studentId]`
  - Response: array of `{ subject_code, teacher_name, rating, comment, date }`
- `PUT /api/v1/students/:studentId/teacher-evaluations` -- saves full evaluation list (replaces all)
  - Request: array of evaluation objects
  - On success: syncs local state, invalidates query, shows success toast
  - On error: shows error toast

### Key behaviors

- All evaluations saved together as a batch (not individually)
- Delete immediately saves the remaining list (triggers saveAll with filtered list)
- New evaluation defaults: `{ subject_code: '', teacher_name: '', rating: 0, comment: '', date: '' }`
- StarRating is interactive -- click to set rating value

---

## 7b. Activities Sub-Tab (ActivitiesTab.jsx)

### Elements

- **Extracurricular heading** (`h3`) -- translated `activities.extracurricular`
- **Activity cards** -- collapsible cards, one per activity:
  - **Header row** -- clickable to toggle expand/collapse:
    - **Activity name** -- sm font, medium weight. Falls back to "Add Activity" if empty
    - **Toggle button** -- up/down arrow (▲/▼)
  - **Expanded content** (2-column grid):
    - **Activity input** -- text, label "Activity"
    - **Role input** -- text, label "Role"
    - **Years input** -- text, label "Years"
    - **Achievement input** -- text, label "Achievement"
    - **Remove button** -- error color text, "Remove"
- **Action row** (below activities):
  - **"Add Activity" button** -- secondary variant
  - **"Save Activities" button** -- primary variant, disabled while saving. Label toggles "Loading..." / "Save Activities"

- **Awards heading** (`h3`) -- translated `activities.awards`, with top margin
- **Award cards** -- collapsible cards, same pattern:
  - **Header row** -- clickable:
    - **Award title** -- sm font, medium weight. Falls back to "Add Award" if empty
    - **Toggle button** -- up/down arrow
  - **Expanded content** (2-column grid):
    - **Title input** -- text, label "Title"
    - **Awarding Body input** -- text, label "Awarding Body"
    - **Level select** -- dropdown: School, District, Regional, International. Label "Level"
    - **Year input** -- number, label "Year"
    - **Remove button** -- error color text, "Remove"
- **Action row** (below awards):
  - **"Add Award" button** -- secondary variant
  - **"Save Awards" button** -- primary variant, disabled while saving

### Data flow

- Reads from `student` prop fields: `extra_curricular` (array), `awards` (array)
- `POST /api/v1/students/:studentId/extracurricular` -- saves activities list
  - Request: array of `{ activity, role, years, achievement }`
  - On success: invalidates `['student', studentId]`, shows success toast
- `POST /api/v1/students/:studentId/awards` -- saves awards list
  - Request: array of `{ title, awarding_body, level, year }`
  - On success: invalidates `['student', studentId]`, shows success toast

### Key behaviors

- Activities and awards are saved independently (separate buttons, separate API calls)
- Cards default to collapsed if they have content, expanded if empty (new items open by default)
- New activity defaults: `{ activity: '', role: '', years: '', achievement: '' }`
- New award defaults: `{ title: '', awarding_body: '', level: 'School', year: '' }`
- Removing an item filters it from local state; must save to persist

---

## 7c. Notes Sub-Tab (NotesTab.jsx)

### Elements

- **Label + status row** -- flex row:
  - **Label** -- "Counsellor Notes", sm font, medium weight
  - **Saving indicator** -- xs font, secondary color. Text: "Saving..." (shown when `saveStatus === 'saving'`)
  - **Saved indicator** -- xs font, success color. Text: "Saved" (shown when `saveStatus === 'saved'`)
- **Notes textarea** -- 12 rows, full width, resizable vertically. Uses design system font, normal line-height. aria-label "Counsellor notes"

### Data flow

- Reads from `student.notes` prop
- `PUT /api/v1/students/:studentId/profile` -- saves notes via student profile endpoint
  - Request: `{ notes: string }`
  - On success: invalidates `['student', studentId]`, calls `onSaved(updated)`, shows "Saved" indicator for 3 seconds
  - On error: shows error toast "Auto-save failed."

### Key behaviors

- **Auto-save with debounce** -- saves 1500ms after last keystroke. No manual save button
- Save status indicator: null -> "Saving..." -> "Saved" (fades after 3 seconds)
- Timers cleaned up on unmount

---

## Cross-Cutting Concerns

### Permission System
- `useFeatureAccess('student_profile')` -- gates "Mark Graduated" and "Generate Plan" buttons
- `useFeatureAccess('programme_choices')` -- gates add/edit/remove/reorder of programme choices
- `useFeatureAccess('plan_generation')` -- gates "Generate New" plan button
- Disabled elements show 50% opacity, not-allowed cursor, and tooltip explaining required permission

### Internationalization
- All user-visible text uses `useTranslation()` with `t()` calls
- Subject names translated via `t('subjects.CODE')` with fallback to raw code
- Localized names (Chinese/English) via `useLocalizedName()` hook for school and programme names

### Toast Notifications
- All mutations show success/error toasts via `sonner`
- Pattern: action success = green toast, action failure = red toast

### Query Caching (React Query)
- Student data: no explicit staleTime (default)
- Account data: 5-minute staleTime
- Subjects: 10-minute staleTime
- JUPAS programmes: 10-minute staleTime
- SF programmes: 10-minute staleTime
- Other queries: default staleTime

### Autosave
- Personal tab uses `useAutosave` hook with localStorage drafts
- Notes tab uses debounced auto-save (1500ms) directly to API
