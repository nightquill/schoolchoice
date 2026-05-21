<!-- spec-tracks: apps/web/src/pages/SfInstitution/SfInstitution.jsx, apps/web/src/pages/SfInstitution/SfProgrammeDetail.jsx, apps/web/src/api/selfFinancing.js, backend/app/api/v1/routes/self_financing.py -->

# Self-Financing Institutions & Programmes — Page Specs

These pages are entirely separate from the JUPAS school directory. They cover sub-degree, associate degree, higher diploma, and self-financing degree programmes.

---

## SF Institution Profile (/sf/:code)

### Elements

**Navigation**
- `NavBarV2` — with account data

**Back link** — "← Back to directory", links to `/schools`

**Loading / Error states**
- `<LoadingSpinner>` — shown while institution data loads
- `<ErrorMessage>` — shown on fetch error, message `t('sfInstitution.loadFailed')`

**Hero Card** (bordered card, surface background)
- **Badge row:**
  - **Sub-degree badge** — purple pill: `t('sfInstitution.subDegree')` (displays "Sub-degree")
  - **Tier badge** — green pill: "Tier {inst.tier}"
- **Institution name** (h1) — `--font-size-2xl`, bold
- **Chinese name** (`name_zh`) — `--font-size-lg`, secondary, shown if present
- **Parent university** — primary color, medium weight: "Under {inst.parent_university}", shown if present
- **Meta row:**
  - **Location** — shown if present
  - **Website link** — opens in new tab, text `t('schoolProfile.website')`, shown if present
- **Stats (right side):**
  - **Articulation rate card** — green background: "{N}%" or "N/A", label `t('sfInstitution.articulationRate')`
  - **Programme count card** — blue background: `data.total`, label `t('sfInstitution.programmes')`

**Filter Row**
- **Section heading** (h2) — `t('sfInstitution.programmes')`
- **Search input** — text, placeholder `t('sfInstitution.searchProgrammes')`, width 220px. Filters by programme name or faculty (case-insensitive).
- **Level dropdown** — shown only when `levels.length > 1`. Options:
  - "" (`t('sfInstitution.allLevels')`)
  - Dynamic from data: each unique `level` value mapped through `LEVEL_LABELS`:
    - `associate_degree` -> "Associate Degree"
    - `higher_diploma` -> "Higher Diploma"
    - `diploma` -> "Diploma"
    - `self_financing_degree` -> "Degree"
- **Result count** — xs text: "{filteredProgs.length} of {allProgs.length}"

**Programme Table** (bordered card, full-width table)
- Table columns:
  1. **Level** (width 60px) — colored pill badge with short label:
     - AD (blue), HD (amber), Dip (gray), Deg (green)
  2. **Programme** — programme name as link to `/sf/{code}/programmes/{p.id}`, medium weight. Faculty as xs secondary text below, shown if present.
  3. **Mean** (width 80px, centered) — `admission_score_mean` or "—", bold
  4. **LQ** (width 60px, centered) — `admission_score_lq` or "—", secondary
  5. **UQ** (width 60px, centered) — `admission_score_uq` or "—", secondary
  6. **Competitiveness** (width 100px, right-aligned) — colored pill badge:
     - Mean >= 16: "Competitive" (amber)
     - Mean >= 14: "Moderate" (green)
     - Mean < 14 or null: "Accessible" (blue) / "—" (gray)
  7. **Arrow** (width 30px) — "→" link to programme detail

- **Empty row** — colspan 7, centered: `t('sfInstitution.noMatch')` when no programmes match filters

**Footer note** — centered xs text: `t('sfInstitution.scoresNote')` + " · Source: {data_source}" (falls back to "CSPE/iPASS")

### Data Flow

**On mount (React Query):**
1. `getAccount()` -> account for NavBar
2. `getSfInstitution(code)` -> `GET /api/v1/sf/institutions/{code}`

**`GET /api/v1/sf/institutions/{code}`**
- Backend: raw SQL query against `sf_institutions` table (code uppercased)
- Returns 404 if not found
- Response:
  ```
  {
    institution: {
      id, code, name, name_zh, parent_university,
      location, website, tier, articulation_rate, notes
    },
    programmes: [{
      id, programme_code, name, name_zh, level, faculty,
      admission_score_mean, admission_score_lq, admission_score_uq,
      admission_score_highest, admission_year, data_source
    }],
    total: number
  }
  ```

**Client-side filtering:**
- `levels`: unique `level` values from all programmes, sorted
- `faculties`: unique non-null `faculty` values, sorted (computed but not currently exposed as a filter)
- Level filter: exact match on `p.level`
- Search filter: matches `name` or `faculty` (case-insensitive, trimmed)
- Both filters combine (AND logic)

### Key Behaviors

- **Level dropdown hidden** — only shown when more than one distinct level exists in the data.
- **Search is instant** — no debounce, filters on every keystroke.
- **Competitiveness thresholds differ from JUPAS** — uses mean score with thresholds 16/14 (not 28/24/20 like JUPAS median).
- **Code is uppercased** — backend forces `code.upper()` for lookup.
- **Data source footer** — uses first programme's `data_source` field, defaults to "CSPE/iPASS".
- **All filtering is client-side** — full programme list is returned by the API; no server-side programme search.

---

## SF Programme Detail (/sf/:code/programmes/:progId)

### Elements

**Navigation**
- `NavBarV2` — with account data

**Back link** — "← {institution_code} / Programmes", links to `/sf/{code}`. Falls back to `code` param if `institution_code` absent.

**Loading / Error states**
- `<LoadingSpinner>` — label "Loading..."
- `<ErrorMessage>` — message "Programme not found"

**Header Section**
- **Badge row:**
  - **Level badge** — purple pill showing full level label from `LEVEL_LABELS`:
    - `associate_degree` -> "Associate Degree"
    - `higher_diploma` -> "Higher Diploma"
    - `diploma` -> "Diploma"
    - `self_financing_degree` -> "Self-financing Degree"
  - **Programme code badge** — monospace, gray background, shown only if `prog.programme_code` exists
- **Programme name** (h1) — 20px, bold
- **Subtitle** — "{faculty} · {institution_name}". Faculty prefix omitted if absent.

**Stats Row** — 4 flex cards (1 1 120px each):
1. **Mean Score** — green (#059669), from `admission_score_mean`
2. **Upper Quartile** — blue (#2563eb), from `admission_score_uq`
3. **Lower Quartile** — amber (#d97706), from `admission_score_lq`
4. **Highest** — dark (#0f172a), from `admission_score_highest`
- All show "—" when null. Values displayed at 22px bold.

**Student Matches Section** (bordered card)
- **Section header bar** — flex between:
  - Left: "Your Students -- Scored against this programme"
  - Right: "{data.total} total"

- **Strong Candidates band** (shown if non-empty)
  - Green header: "Strong Candidates -- {N} students"
  - Table columns: Name | Class | Match | Best 5 | Eligibility

- **Possible band** (shown if non-empty)
  - Yellow header: "Possible -- {N} students"
  - Same table columns

- **Stretch band** (shown if non-empty, **collapsed by default**)
  - Gray header: "Stretch -- {N} students" + "show"/"hide" underlined text toggle
  - Clicking header row toggles visibility
  - Same table columns

- **No data note** (shown if non-empty)
  - Text: "{N} student(s) with no grade data"
  - Not a table, just a text line with top border

**Student Row** (per student in each tier table)
- **Name** — link to `/students/{student_id}/profile`, primary color, medium weight
- **Class** — `class_name` text
- **Match %** — color-coded:
  - >= 75%: green (#059669)
  - >= 50%: amber (#d97706)
  - < 50%: red (#dc2626)
  - null: "—"
- **Best 5** — `best5_score` number or "—"
- **Eligibility** — pill badge:
  - `eligible === true`: green "Eligible" (bg #dcfce7, text #166534)
  - `eligible === false`: red "Ineligible" (bg #fee2e2, text #991b1b)
  - `eligible === null`: nothing rendered

**Footer note** — centered xs text: "Scores are best-5 HKDSE subjects · Source: {data_source}" (falls back to "CSPE/iPASS")

### Data Flow

**On mount (React Query):**
1. `getAccount()` -> account for NavBar
2. `getSfProgrammeStudents(progId)` -> `GET /api/v1/sf/programmes/{progId}/students`

**`GET /api/v1/sf/programmes/{prog_id}/students`** (requires auth)
- Backend: raw SQL joins `sf_programmes` + `sf_institutions`
- Fetches all students in user's `active_organisation_id`
- Scores each student using best-5 HKDSE aggregate score
- Scoring model (4-band probability):
  ```
  effective_lq = lq or (mean - 2.0)
  effective_uq = uq or (mean + 2.0)

  if best5 >= effective_uq:  match = min(0.95, 0.90 + (best5 - uq) * 0.02)
  elif best5 >= mean:        match = 0.60 + fraction * 0.30
  elif best5 >= effective_lq: match = 0.30 + fraction * 0.30
  else:                       match = max(0.05, 0.30 * (best5 / lq))
  ```
- Eligibility: `best5 >= 10` (five level-2 passes = floor for sub-degree)
- Students without `best5_aggregate` get all null scores
- Response:
  ```
  {
    programme: {
      id, name, level, faculty, admission_score_mean,
      admission_score_lq, admission_score_uq, admission_score_highest,
      admission_year, minimum_requirements,
      institution_code, institution_name
    },
    students: [{
      student_id, student_name, class_name,
      best5_score: float|null,
      match_score: float|null,    // 0-1 probability
      eligible: bool|null
    }],
    total: number
  }
  ```
- Students sorted: scored descending by `match_score`, null-scored last (sorted as -1)

**Client-side tier partitioning:**
- `strong`: match_score >= 0.75
- `possible`: match_score >= 0.50 and < 0.75
- `stretch`: match_score < 0.50 (and not null)
- `noData`: match_score === null

### Key Behaviors

- **Stretch collapsed by default** — `stretchOpen` state starts false. Click on the header row (not a button, the entire div) toggles it.
- **No data section is NOT a table** — unlike JUPAS ProgrammeDetail which renders a table for no-grade students, SF just shows a text line.
- **Best 5 instead of Weighted Score** — SF uses `best5_score` (simple aggregate), not the JUPAS-style `weighted_score` from programme-specific formula.
- **Eligibility floor is 10** — any student with best-5 >= 10 is eligible for sub-degree programmes.
- **Match score rounding** — backend rounds to 2 decimal places before returning.
- **Programme code display** — only shown if `programme_code` field exists (not all SF programmes have one).
- **404 on missing programme** — backend returns 404 with "Programme not found".
- **Scoring requires auth** — the endpoint uses `get_current_user` to determine org.

---

## API Summary (Self-Financing)

| Endpoint | Auth | Method | Description |
|---|---|---|---|
| `/api/v1/sf/institutions` | No | GET | List all SF institutions. Optional `q` param for name search. |
| `/api/v1/sf/institutions/{code}` | No | GET | Single institution + all its programmes. Code uppercased. |
| `/api/v1/sf/programmes` | No | GET | Flat list of all SF programmes. Optional `level`, `institution`, `q` filters. |
| `/api/v1/sf/programmes/{prog_id}/students` | Yes | GET | Score org students against a SF programme. Returns match scores and eligibility. |

## API Summary (JUPAS — used by School Directory pages)

| Endpoint | Auth | Method | Description |
|---|---|---|---|
| `/api/v1/schools` | Yes | GET | Search/filter school directory. Paginated. |
| `/api/v1/schools/{id}` | Yes | GET | Single school profile. |
| `/api/v1/schools` | Yes | POST | Create custom school. |
| `/api/v1/schools/{id}` | Yes | DELETE | Delete custom school only. |
| `/api/v1/jupas/all` | No | GET | All JUPAS programmes with school info. |
| `/api/v1/jupas/search` | No | GET | Search programmes by code/name/school. |
| `/api/v1/jupas/{code}/students` | Yes | GET | Score org students against a JUPAS programme. |
| `/api/v1/jupas/{code}/deadlines` | No | GET | JUPAS milestones + programme deadlines. |
