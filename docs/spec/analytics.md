<!-- spec-tracks: apps/web/src/pages/Analytics/PlansAnalytics.jsx, apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx, apps/web/src/pages/DataAnalysis/DataAnalysis.jsx, apps/web/src/api/analytics.js, backend/app/api/v1/routes/analytics.py -->

# Analytics Spec

---

## Plans Analytics (/analytics/plans)

### Elements

- **NavBarV2** — top navigation bar
- **"Back to Dashboard" link** — top-left with arrow
- **Page title**: "Plan Generation History" (h1)
- **Granularity toggle** (segmented button group):
  - **Daily** | **Weekly** | **Monthly**
  - Active: white background, primary color text, shadow
  - Inactive: transparent, secondary text
  - `aria-pressed` attribute on each button
- **Total count text** — "Total: {N}" (tabular-nums font variant)
- **LoadingSpinner** — during chart data load

#### Line Chart Card (Recharts)
- **Container**: surface background, rounded border, padding
- **Chart** (300px height, `<ResponsiveContainer>` 100% width):
  - `<LineChart>` with `<CartesianGrid>` dashed stroke
  - **X-axis** (`date`): formatted as "Mon d" (daily/weekly) or "Mon" (monthly)
  - **Y-axis**: integer ticks, no decimals
  - **Tooltip**: full date "Month Day, Year" format
  - **Single line**: "Plans Generated" — primary color, strokeWidth 2, dot r=3
  - Fallback: if no data, renders single point at today's date with count=0
- **"No data" text** — centered below chart when `chartData.length === 0`

#### Students Missing Plan Section
- **Section title**: "Students Missing a Plan ({count})" (h2)
- **LoadingSpinner** — separate spinner for students query
- **"All students have plans"** text — when none missing
- **Table** (surface card):
  - **Columns**: Name, Class, Actions
  - **Name cell**: student name or "Unnamed Student"
  - **Class cell**: class_name or "---"
  - **Actions cell**: "Generate Plan" link to `/students/{id}/consultant`
  - Entire row clickable (navigates to consultant page)

### Data flow

**Chart data:**
- `GET /api/v1/analytics/plan-history?granularity={daily|weekly|monthly}&days=90`
  ```
  { data: [{ date: "YYYY-MM-DD", count: number }], granularity, total }
  ```
  - Backend queries `AcademicPlan` table (not PlanGenerationJob)
  - Groups by date bucket based on `generated_at`
  - Scoped to user's organisation

**Students list:**
- `GET /api/v1/students?limit=500`
  ```
  { items: [{ id, full_name, name, class_name, has_plan }] }
  ```
  - Filtered client-side: `students.filter(s => !s.has_plan)`
  - `staleTime: 60000` (1 minute cache)

### Key behaviors

- Granularity toggle refetches chart data via React Query key change
- Students query is independent of granularity (separate query key)
- Chart always renders (even with empty data, shows flat zero line)
- Row click and "Generate Plan" link both navigate to consultant
- `stopPropagation` on link click to prevent double navigation
- `fontVariantNumeric: 'tabular-nums'` on all numeric displays

---

## Submissions Analytics (/analytics/submissions)

### Elements

- **NavBarV2** — top navigation bar
- **"Back to Dashboard" link** — top-left with arrow
- **Page title**: "Submission History" (h1)
- **Granularity toggle** (segmented button group):
  - **Daily** | **Weekly** | **Monthly**
  - Same styling as Plans Analytics toggle
  - `aria-pressed` attribute
- **Summary text** — "Total: {N} submitted, {N} approved" (tabular-nums)
- **LoadingSpinner** — during chart load

#### Line Chart Card (Recharts)
- **Container**: surface background, rounded border, padding
- **Chart** (400px height, `<ResponsiveContainer>` 100% width):
  - `<LineChart>` with `<CartesianGrid>` dashed stroke
  - **X-axis** (`date`): same formatting as Plans Analytics
  - **Y-axis**: integer ticks
  - **Tooltip**: full date format
  - **Legend** — shown below chart
  - **Two lines**:
    1. "Total Submissions" — primary color, strokeWidth 2, dot r=3
    2. "Approved Submissions" — success color (green), strokeWidth 2, dot r=3
- **"No data" text** — centered when no chart data (instead of chart)

### Data flow

**Chart data:**
- `GET /api/v1/analytics/submission-history?granularity={daily|weekly|monthly}&days=90`
  ```
  {
    data: [{ date: "YYYY-MM-DD", total: number, approved: number }],
    granularity,
    total_submissions,
    total_approved
  }
  ```
  - Backend queries `StudentChoiceSubmission` table
  - `total` = submissions created per bucket
  - `approved` = submissions where `status="approved"`, bucketed by `reviewed_at`
  - Scoped to user's organisation

### Key behaviors

- Granularity toggle refetches via React Query
- Chart height 400px (vs 300px for Plans)
- Legend visible (Plans Analytics has no legend since single line)
- Empty data shows text message instead of empty chart (different from Plans which shows flat line)
- Both total and approved lines visible simultaneously for comparison

---

## Data Analysis (/data-analysis)

### Elements

- **NavBarV2** — top navigation bar
- **Header bar** (surface background, border-bottom):
  - **Page title**: "Data Analysis" (h1)
  - **Section tab buttons**:
    1. **"HKDSE Trends"** (default active)
    2. **"Subject Combinations"**
    3. **"Popular Majors"**
    4. **"Graduation Outcomes"**
  - Active tab: primary color background, white text
  - Inactive tab: transparent, secondary text
- **LoadingSpinner** — during initial load
- **ErrorMessage** — on load failure

### HKDSE Trends Section (activeSection === 'trends')

#### Elements
- **Card** with section title: "Grade Distribution ({count})"
- **Filter bar** (right side of title):
  - **Sitting dropdown**: All (default), MOCK, TRIAL, OFFICIAL
  - **Cohort dropdown**: "All Students" + list of cohorts by name
  - **Category dropdown**: All + dynamic list (CORE, ELECTIVE, OTHER_LANGUAGE, APPLIED_LEARNING)
- **Subject cards grid** (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`):
  - Each card is **clickable** (navigates to `/data-analysis/subjects/{code}`, shadow on hover)
  - **Header row**: subject code (bold) + subject name (secondary) + category badge (colored pill)
    - Category badge colors: CORE=#2563eb, ELECTIVE=#16a34a, OTHER_LANGUAGE=#7c3aed, APPLIED_LEARNING=#d97706
  - **VerticalBarChart** — embedded grade distribution chart
  - **Stats pills row**: Mean (value), Variance (value), n=(count)
  - **"Population Data" link** — small primary-colored text
- **EmptyState** — when no grade data and no population stats
- **Fallback cards** — from population stats when no student data exists (show "No student data" instead of chart)

#### VerticalBarChart Component
- **Container**: white background, rounded, shadow
- **Horizontal gridlines**: 4 lines at 25%, 50%, 75%, 100% of max
- **Bar area** (160px height + 20px padding):
  - One bar per HKDSE grade: 5**, 5*, 5, 4, 3, 2, 1, U
  - Each bar: minimum 4px if value > 0, color-coded:
    - 5**=#7c3aed, 5*=#2563eb, 5=#0891b2, 4=#16a34a, 3=#ca8a04, 2=#ea580c, 1=#dc2626, U=#9ca3af
  - **Value label** above each bar (always visible, same color as bar)
  - **Hover tooltip**: dark background pill showing "{grade}: {value}"
  - **X-axis labels**: grade names below bars
- **Summary line**: "Mean: {grade} ({numeric}) | Mode: {grade} | n={count}"

### Subject Combinations Section (activeSection === 'combinations')

#### Elements
- **Card** with section title: "Elective Combinations"
- **Subtitle**: "Top pairs" (right side)
- **Ranked list** of combinations:
  - Each item: rank number + combination string (e.g., "ECON + BAFS") + frequency count + "students" label
  - **Horizontal progress bar**: proportional width relative to top combination
  - Top 3 items have medium font weight
- **EmptyState** when no combination data

### Popular Majors Section (activeSection === 'majors')

#### Elements
- **Card** with section title: "Popular Intended Majors"
- **Subtitle**: "{N} distinct majors" (right side)
- **Ranked list** of majors:
  - Each item: rank number + major name + count
  - **Horizontal progress bar**: proportional width relative to top major
  - Top 3 items have medium font weight
- **EmptyState** when no major data

### Graduation Outcomes Section (activeSection === 'directory')

#### Elements
- **Card** with section title: "Graduation Outcomes"
- **Subtitle**: "Actual admission results for graduated students"
- **EmptyState**: "No graduated students yet. Mark students as graduated to see outcomes here."

When data exists:
- **Summary cards row** (4 cards, flex wrap):
  1. **Graduated** — count (bold 2xl), label "Graduated"
  2. **With Recorded Outcome** — count (green), label "With Recorded Outcome"
  3. **Distinct Universities** — count (primary), label "Distinct Universities"
  4. **Distinct Programmes** — count (primary), label "Distinct Programmes"
- **University Destinations** (h3):
  - Per university: name + horizontal bar (proportional to total grads) + count
- **Programme Distribution** (h3, top 15):
  - Per programme: name + count
- **Individual Outcomes table**:
  - **Columns**: Class, Year, Graduation Year, Final University, Final Programme, Best 5
  - Best 5: compact "{subject}:{grade}" format
  - Final University in medium font weight

### Data flow

**Initial load (6 parallel requests):**
1. `GET /api/v1/account` -> account data
2. `GET /api/v1/analytics/hkdse-trends` -> trends data:
   ```
   {
     trends: [{
       subject_code, subject_name, category, sitting, count,
       mean, variance, grade_distribution: {grade: count},
       grade_rates: {grade: pct}
     }],
     total_subjects,
     subject_combinations: [{ combination: string, frequency: number }]
   }
   ```
3. `GET /api/v1/analytics/popular-majors?limit=20`:
   ```
   { majors: [{ major, count }], total_distinct }
   ```
4. `GET /api/v1/analytics/student-directory?graduated_only=true`:
   ```
   {
     students: [{
       anon_id, class_name, year_of_study, is_graduated, graduation_year,
       final_school, final_major, grades: { "{code}_{sitting}": grade },
       school_outcomes: [{ school_id, status, match_score, eligibility_pass, intended_majors, year_of_entry }]
     }],
     total
   }
   ```
5. `GET /api/v1/cohorts` -> cohort list (for filter dropdown)
6. `GET /api/v1/analytics/hkdse-population`:
   ```
   { subjects: [{ code, name, category, ... }], metadata }
   ```

**Sitting/Cohort filter change:**
- `GET /api/v1/analytics/hkdse-trends?sitting={}&cohort_id={}` -> re-fetches trends only

**Graduated filter change:**
- `GET /api/v1/analytics/student-directory?graduated_only={bool}` -> re-fetches directory

### Key behaviors

- Trends section groups rows by `subject_code`; uses best-populated sitting for the chart
- Category filter is client-side (filters `allTrends` array)
- Sitting and cohort filters trigger API re-fetch
- Subject cards are clickable, navigate to subject detail page
- Graduation Outcomes filters `directory.students` to only `is_graduated=true` on client side
- Student directory is anonymized: uses hashed `anon_id`, no names or personal data
- Subject combinations limited to elective subjects, pairs/triples/quads up to size 4
- Population stats from static JSON file (`data/processed/hkdse_subject_stats.json`)
- All analytics scoped to user's organisation via backend org isolation
