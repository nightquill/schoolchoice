<!-- spec-tracks: apps/web/src/pages/SchoolDirectory/SchoolDirectory.jsx, apps/web/src/pages/SchoolProfile/SchoolProfile.jsx, apps/web/src/pages/ProgrammeDetail/ProgrammeDetail.jsx, apps/web/src/components/SchoolCard/SchoolCard.jsx, apps/web/src/api/schoolsV2.js, apps/web/src/api/jupas.js, apps/web/src/utils/competitiveness.js, apps/web/src/utils/requirementBadges.js, backend/app/api/v1/routes/schools_v2.py, backend/app/api/v1/routes/jupas_search.py, backend/app/schemas/v2/schools_v2.py -->

# School Directory, School Profile & Programme Detail — Page Specs

---

## School Directory (/schools)

### Elements

**Navigation**
- `NavBarV2` — top navigation bar (receives `account` prop)
- `ActionBar` — entity action bar with export controls; `hideImport` is true (no import button)
  - "Export Filtered" button — exports current filter results as CSV
  - "Export All" button — exports all schools as CSV
  - Loading/disabled state while `isExporting` is true

**Filter Bar** (role="search", aria-label="School search filters")
- **Search input** (`id="school-search-q"`) — text input, label "Search", placeholder from `t('schools.schoolNamePlaceholder')`. Debounced at 300ms on keystroke; Enter key triggers immediate search.
- **Type dropdown** (`id="school-search-type"`) — select with options:
  - "" (All)
  - "UNIVERSITY"
  - "POLYTECHNIC"
  - "COMMUNITY_COLLEGE"
  - "VOCATIONAL"
  - "HIGH_SCHOOL"
- **Location input** (`id="school-search-location"`) — text input, label "Location", placeholder from `t('schools.locationPlaceholder')`. Enter key triggers search.
- **Search button** — `<Button>`, disabled while loading. Text toggles between `t('schools.search')` / `t('schools.searching')`.

**Content Area**
- **Loading spinner** — shown during fetch, label `t('schools.searching')`
- **Error message** — shown on fetch failure, displays API `detail` or fallback `t('schools.loadFailed')`
- **Result count** — paragraph: "Showing {count} of {total}" via `t('schools.showing', { count, total })`
- **Empty state** — `<EmptyState>` with message `t('schools.noMatch')` when `schools.length === 0`
- **School grid** (role="list", aria-label="School results") — CSS grid, `repeat(auto-fill, minmax(280px, 1fr))`, gap `--space-6`. Each item wrapped in `role="listitem"`.

**SchoolCard** (per school in grid)
- Card container — clickable (navigates to `/schools/{school.id}`), focusable (`tabIndex=0`), keyboard-accessible (Enter/Space)
- **School name** — bold, `--font-size-md`
- **Chinese name** (`name_zh`) — secondary color, `--font-size-sm`, shown only if present
- **Type badge** — bordered inline badge showing `school.type`
- **Location** — with pin emoji prefix, shown only if present
- **Minimum entry score** — "Min. score: {value}", shown only if `minimum_entry_score != null`
- **Notable programs** — up to 4 small pill badges, "+N more" overflow indicator
- **Major requirements** — up to 3 blue-tinted pill badges, "+N more" overflow indicator
- **Scholarship badge** — green "Scholarship available" label, shown only if `school.scholarship_available` is truthy

**Pagination** (role="navigation", aria-label="Pagination") — shown only when `totalPages > 1`
- "Previous" button — `<Button variant="outline">`, disabled on page 1
- Page indicator — "Page {page} of {totalPages}" via `t('schools.pageOf', { page, total })`
- "Next" button — `<Button variant="outline">`, disabled on last page

**Self-Financing Institutions Section** (`SfInstitutionsSection`)
- Separated by a 2px top border + `--space-8` margin
- **Section heading** — h2 "Sub-degree & Self-financing"
- **Chinese label badge** — purple pill: "副學士 · 高級文憑"
- **Description text** — "Associate Degree, Higher Diploma, and self-financing programmes — separate from JUPAS."
- **Institution grid** — CSS grid, `repeat(auto-fill, minmax(300px, 1fr))`, gap `--space-4`
- **Institution card** (per institution) — `<Link to="/sf/{inst.code}">`, bordered card with hover effect (purple border)
  - **Institution name** — bold, `--font-size-md`
  - **Chinese name** (`name_zh`) — secondary, shown if present
  - **Parent university** — xs text, shown if present
  - **Tier badge** — green pill: "Tier {inst.tier}"
  - **Articulation rate** — "{N}% articulation", shown if `articulation_rate != null`
  - **Location** — shown if present
- Section hidden entirely while loading or if no institutions returned

### Data Flow

**On mount:**
1. `getAccount()` -> sets `account` state (for NavBar)
2. `fetchSchools(1, { q: '', type: '', location: '' })` -> calls `searchSchools(params)`

**`searchSchools(params)`**
- Frontend: `GET /api/v1/schools` with query params `{ limit, offset, q?, type?, location? }`
- Backend: `search_schools()` in `schools_v2.py`
  - Filters: `name ILIKE` / `name_zh ILIKE` for `q`, exact match for `type`, `location ILIKE` for location, optional `min_score` / `max_score`
  - Sorting: `is_custom ASC` (canonical first), then `name ASC`
  - Response: `{ items: SchoolV2Response[], total: number }`
- SchoolV2Response shape:
  ```
  {
    id: UUID, name: string, name_zh?: string, type?: string,
    location: string, website?: string, description?: string,
    minimum_entry_score?: number, required_subjects?: any,
    language_requirements?: any, faculties?: any, notable_programs?: any,
    acceptance_rate?: float, average_admitted_score?: float,
    scholarship_available?: boolean, data_source?: string,
    data_last_updated?: date, notes?: string, is_custom?: boolean,
    major_requirements?: any, key_strengths?: any,
    min_academic_requirements?: any, created_at: datetime, updated_at: datetime
  }
  ```

**`getSfInstitutions()`** (useQuery, staleTime 60s)
- Frontend: `GET /api/v1/sf/institutions`
- Response: `{ institutions: [...], total: number }`
- Institution shape:
  ```
  {
    id, code, name, name_zh, parent_university, location,
    website, tier, articulation_rate, notes
  }
  ```

**Export:**
- `exportEntityCSV('school', params)` — downloads CSV. `params` may include `q` and/or `filters` (JSON-stringified type filter).

### Key Behaviors

- **Debounced search** — typing in the search input triggers `fetchSchools` after 300ms delay. Changing type or location does NOT auto-search (requires button click or Enter).
- **Pagination** — page size fixed at 20 (`LIMIT`). Page state resets to 1 on any filter change or search.
- **Export** — two modes: "Export Filtered" sends current `q`/`type` params; "Export All" sends empty params. Both show loading state on button.
- **SF section loads independently** — uses React Query with 60s stale time. Hidden if loading or empty.
- **Keyboard navigation** — SchoolCard supports Enter/Space activation, shows focus outline.
- **Error handling** — fetch errors display `response.data.detail` if available, else fallback i18n string.

---

## School Profile (/schools/:id)

### Elements

**Navigation**
- `NavBarV2` — with account data

**Loading / Error states**
- `<LoadingSpinner>` — shown while school or programmes are loading
- `<ErrorMessage>` — shown on school fetch error, with "Back to directory" link below

**Hero Section** (surface background, bottom border)
- **Back link** — "← Back to directory", links to `/schools`
- **School name** (h1) — `--font-size-2xl`, bold, `text-wrap: balance`
- **Chinese name** (`name_zh`) — `--font-size-lg`, secondary color, shown if present
- **Meta row** (flex, space-between):
  - Left side:
    - **Type badge** — bordered inline pill showing `school.type`, shown if present
    - **Location** — with pin emoji, shown if present
    - **Website link** — opens in new tab, shown if `school.website` present. Text: `t('schoolProfile.website')`
  - Right side (stats row):
    - **Acceptance rate card** — green background, shows `{Math.round(acceptance_rate * 100)}%` or "N/A"
    - **Avg admitted score card** — blue/info background, shows score or "N/A"
    - **Programme count card** — purple background, shows `filtered.length`

**Programme List Section**
- **Header row** — flex between:
  - h2: `t('schoolProfile.programs')`
  - Filter row:
    - **Search input** — text, placeholder `t('schoolProfile.searchProgrammes')`, width 220px, aria-label set
    - **Faculty dropdown** — select, default option `t('schoolProfile.allFaculties')`, populated from unique faculties in this school's programmes

- **Empty state** — paragraph `t('schoolProfile.noProgrammesFound')` when no programmes match filters

- **Programme card stack** — vertical list (flex column, gap `--space-2`), one card per programme:
  - Card is a `<Link to="/schools/{id}/programmes/{jupas_code}">`, horizontal flex layout, hover highlights border
  - **JUPAS code** — monospace badge, fixed-width 64px, centered
  - **Programme name** — bold, `--font-size-sm`, ellipsis on overflow
  - **Faculty** — xs secondary text below name, shown if present
  - **Median score** — centered column, bold value + "Median" label below
  - **Badges** (right-aligned, wrapping):
    - **Competitiveness tier badge** — pill with color based on tier (Very Competitive / Competitive / Moderate / Accessible)
    - **Requirement badges** — compulsory-only (Interview, Portfolio, Aptitude Test, Audition) as small 10px pills
  - **Arrow** — "→" character, secondary color, far right

### Data Flow

**On mount (all via React Query):**
1. `getAccount()` -> account for NavBar
2. `getSchoolV2(id)` -> `GET /api/v1/schools/{id}` -> single `SchoolV2Response`
3. `getAllProgrammes()` -> `GET /api/v1/jupas/all`

**`GET /api/v1/jupas/all`**
- Returns all JUPAS programmes with school info
- Response:
  ```
  {
    programmes: [{
      jupas_code, name, name_zh, school_id, school_name, school_name_zh,
      faculty, admission_stats, non_grade_requirements, website_url
    }],
    schools: string[]   // sorted unique school names
  }
  ```

**Client-side filtering:**
- Programmes filtered to `school_id === id` (current school)
- Faculties derived from `[...new Set(schoolProgrammes.map(p => p.faculty))]`
- Search filter: matches `name` or `jupas_code` (case-insensitive)
- Faculty filter: exact match on `p.faculty`
- Results sorted by `jupas_code` (localeCompare)

**Competitiveness tier derivation** (`getCompetitivenessTier`):
- Input: `admission_stats` object (keyed by year, e.g. `{"2024": {median, upper_quartile, lower_quartile}}`)
- Uses latest year's stats
- Thresholds on median score:
  - >= 28: Very Competitive (red)
  - >= 24: Competitive (warning/amber)
  - >= 20: Moderate (green)
  - < 20 or no data: Accessible (blue/info)
- Returns: `{ id, label, bg, color, median, uq, lq }`

**Requirement badges** (`getRequirementBadges`):
- Input: `non_grade_requirements` JSON
- Badge types: interview (must/selective/may_require), portfolio, aptitude_test, audition
- `compulsoryOnly=true` on SchoolProfile (only "must" interview + required portfolio/audition)
- Returns: `[{ label, bg, color }]`

### Key Behaviors

- **All programmes loaded client-side** — the `/jupas/all` endpoint returns every programme; filtering happens in the browser by `school_id`.
- **Two independent filters** — search and faculty can be combined. Both apply instantly (no debounce).
- **Programme count in hero** — reflects filtered count, not total. Updates as filters change.
- **Loading gated** — `isLoading = schoolLoading || programmesLoading`. Nothing renders until both resolve.
- **Error back-link** — on school load failure, a link back to `/schools` is shown below the error.

---

## Programme Detail (/schools/:schoolId/programmes/:code)

### Elements

**Navigation**
- `NavBarV2` — with account data

**Breadcrumb**
- Link: "← {institution_code} / Programmes", links back to `/schools/{schoolId}`

**Header Section** (surface background, bottom border)
- **Badge row:**
  - **JUPAS code badge** — monospace, bordered, e.g. "JS1234"
  - **Competitiveness tier badge** — colored pill (Very Competitive / Competitive / Moderate / Accessible)
  - **Requirement badges** — full set (not compulsory-only): Interview, Interview (selective), Interview (may), Portfolio, Aptitude Test, Audition
- **Programme name** (h1) — 20px, bold, `text-wrap: balance`. Falls back to `code` if no name.
- **Subtitle** — "{faculty} · {institution_code}", either part omitted if absent

**Stats Row** — 4 equal-width cards in a horizontal flex:
1. **Median Score** — green, from `stats.median`
2. **Upper Quartile** — primary/blue, from `stats.upper_quartile`
3. **Lower Quartile** — warning/amber, from `stats.lower_quartile`
4. **Min Requirement** — primary text color, from `minReq.general`
- All show "—" when null

**Entry Requirements Card** (bordered, 8px radius)
- **Title** — "Entry Requirements", bold sm
- **General requirement** — "General: {value}", bold value
- **Required subjects** — label "Required:", then red-tinted pills: "{subject} >= {grade}" per entry in `subject_specific`
- **Preferred subjects** — label "Preferred:", then blue/info pills showing subject code, from `preferred_subjects` array

**Student Matches Section**
- **Section header** — h2 "Your Students -- Scored against this programme" + "{total} total" count

- **Strong Candidates tier** (`TierSection`, defaultOpen=true)
  - Green header bar: "Strong Candidates -- {N} students"
  - Table columns: Name | Class | Match | Weighted Score | Eligibility

- **Possible tier** (`TierSection`, defaultOpen=true)
  - Warning/amber header bar: "Possible -- {N} students"
  - Same table columns

- **Stretch tier** (custom collapsible, defaultOpen=false)
  - Gray header bar: "Stretch -- {N} students" + "show"/"hide" toggle button (`aria-expanded`)
  - Same table columns
  - Collapsed by default

- **No Grade Data section** (always visible if non-empty)
  - Header: "No Grade Data -- {N} students"
  - Same table columns

- **Empty state** — shown when `students.length === 0`: "No students have been scored against this programme yet."

**Student Row** (per student in each tier table)
- **Name** — link to `/students/{student_id}/profile`, primary color
- **Class** — text or "—"
- **Match %** — color-coded: green >= 75%, amber >= 50%, red < 50%. Shows "—" if null.
- **Weighted Score** — number or "—"
- **Eligibility badge** — "Eligible" (green bg/border) or "Ineligible" (red bg/border)

### Data Flow

**On mount:**
1. `getProgrammeStudents(code)` -> `GET /api/v1/jupas/{code}/students`
2. `getAccount()` -> account for NavBar

**`GET /api/v1/jupas/{jupas_code}/students`** (requires auth)
- Fetches programme by `jupas_code` (uppercased)
- Fetches all students in user's `active_organisation_id`
- Scores each student via `score_student_for_programme(grades_by_code, prog_dict)`
- Students without grades get `null` for all scoring fields
- Response:
  ```
  {
    programme: {
      jupas_code, name, name_zh, faculty, institution_code,
      admission_stats: { median, upper_quartile, lower_quartile },  // latest year only
      minimum_requirements: { general?, subject_specific?: {subject: grade}, preferred_subjects?: [...] },
      non_grade_requirements
    },
    students: [{
      student_id, student_name, class_name,
      match_score: float|null,     // 0-1 probability
      weighted_score: float|null,
      eligible: bool|null,
      risk_level: string|null
    }],
    total: number
  }
  ```
- Students sorted: scored descending by match_score, null-scored last

**Client-side tier partitioning:**
- `strong`: match_score >= 0.75
- `possible`: match_score >= 0.50 and < 0.75
- `stretch`: match_score < 0.50 (and not null)
- `noScore`: match_score === null

**Competitiveness tier (local function `getTierFromStats`):**
- Uses flat `admission_stats` (already latest-year from API)
- Same thresholds as `getCompetitivenessTier`: 28/24/20

### Key Behaviors

- **Stretch collapsed by default** — user must click "show" to expand. Other tiers always open.
- **No Grade Data always visible** — not collapsible, always shown if students exist without scores.
- **Match score color coding** — >= 75% green, >= 50% amber, < 50% red, null shows "—".
- **Eligibility is binary** — "Eligible" or "Ineligible" badge; null shows nothing (no badge rendered).
- **Breadcrumb shows institution code** — falls back to "School" if `institution_code` is null.
- **Error state** — shows error message + "← Back to school" link.
- **404 handling** — backend raises 404 if programme not found.
