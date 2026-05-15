# School Profile & Programme Detail Overhaul

**Date:** 2026-05-14
**Status:** Approved

## Summary

Overhaul the School Directory school profile pages, add programme-level sub-pages with competitiveness indicators and tiered student matching, and fix the submissions list page.

## 1. School Profile Page Redesign (`/schools/:id`)

### Current Problems
- Sparse 60/40 grid with a sidebar containing 3 stats and 2 buttons
- Programmes listed as plain text (faculties, notable programs, requirements by major)
- No interactivity — can't drill into individual programmes
- No competitiveness signal

### New Layout

**Hero section (full-width):**
- School name (EN + ZH), type badge, location, website link
- Stat cards inline: acceptance rate, avg admitted score, programme count
- No sidebar — stats live in the hero

**Programme list (main content, full-width):**
- Each programme is a clickable card row showing:
  - JUPAS code (monospace badge)
  - Programme name
  - Faculty
  - Median admission score
  - Competitiveness tier badge
  - Arrow indicator (→) for click-through
- Search input + faculty dropdown filter above the list
- Click navigates to `/schools/:id/programmes/:code`

**Removed from this page:**
- "Requirements by Major" section (moved into programme sub-pages)
- Sidebar grid (stats moved to hero)
- "Add to Targets" button (moved to programme sub-page)

## 2. Programme Sub-page (`/schools/:id/programmes/:code`)

New route. Full-page layout for a single JUPAS programme.

### Header
- Breadcrumb: `← HKU / Programmes`
- JUPAS code badge + competitiveness tier badge
- Programme name (h1)
- Faculty + institution name

### Stats Row (4 cards)
- Median score
- Upper quartile
- Lower quartile
- Minimum requirement (e.g. "33222")

All sourced from `JupasProgramme.admission_stats` (latest year).

### Entry Requirements (compact card)
- General requirement (e.g. "33222")
- Required subjects with minimum grades (red badges)
- Preferred subjects (blue badges)

Sourced from `JupasProgramme.minimum_requirements`.

### Student Matches (tiered table)

Header shows "Your Students — Scored against this programme" + org student count.

**Backend: new endpoint `GET /api/v1/jupas/{jupas_code}/students`**
- Runs `score_student_for_programme()` for every student in the teacher's org against this programme
- Returns: `{ students: [{student_id, student_name, class_name, match_score, weighted_score, eligible, risk_level}], total: int }`
- Sorted by match_score descending

**Frontend: 3 tiers**

| Tier | Threshold | Header Color | Default State |
|------|-----------|-------------|---------------|
| Strong Candidates | ≥ 75% match | Green (#f0fdf4) | Expanded |
| Possible | 50–74% match | Amber (#fefce8) | Expanded |
| Stretch | < 50% match | Gray (#f8fafc) | Collapsed |

Each student row shows: name (link to profile), class, match %, weighted score, eligibility badge.

## 3. Competitiveness Tier Logic

Derived from `JupasProgramme.admission_stats` latest-year median score:

| Tier | Median Score | Badge Color |
|------|-------------|-------------|
| Very Competitive | ≥ 28 | Red (#fef2f2 / #dc2626) |
| Competitive | 24 – 27.9 | Amber (#fef3c7 / #92400e) |
| Moderate | 20 – 23.9 | Green (#d1fae5 / #065f46) |
| Accessible | < 20 or no data | Blue (#eff6ff / #1e40af) |

Thresholds based on HKDSE best-5 scoring (max ~35, median programme ~20).

**Implementation:** Pure function `getCompetitivenessTier(admissionStats)` that:
1. Parses admission_stats JSON
2. Finds the latest year key
3. Extracts median
4. Returns `{ tier, label, median, uq, lq }`

Can run on frontend (data already in `/jupas/all` response) or backend. Frontend preferred — no new endpoint needed for the school profile page.

## 4. Submissions List Fix (`/submissions`)

### Current Bug
- `getSubmissions()` API returns `{ submissions: [...], total: N }` but the frontend destructures `submissionsQuery.data` and iterates it directly
- The data shape is `{ submissions: [...] }` but the component treats it as an array
- Review links render as `<Link to={/submissions/${sub.id}}>` which works, but the `submissions` variable may be the wrapper object not the array

### Fix
- Ensure `submissions` variable correctly reads from `submissionsQuery.data?.submissions ?? []`
- Verify review links render and navigate correctly
- No design change needed — just a data-binding bug

## 5. Backend Changes

### New Endpoint: `GET /api/v1/jupas/{jupas_code}/students`

**Purpose:** Score all org students against a specific programme.

**Auth:** Teacher/admin only (uses `get_current_user`).

**Logic:**
1. Look up `JupasProgramme` by jupas_code
2. Query all students in user's `active_organisation_id`
3. For each student, build grades dict via `build_student_data()`
4. Run `score_student_for_programme(grades, programme_dict)`
5. Return sorted by `admission_probability` descending

**Response:**
```json
{
  "programme": {
    "jupas_code": "JS6901",
    "name": "Bachelor of Economics",
    "faculty": "Faculty of Business and Economics",
    "institution_code": "HKU",
    "admission_stats": { ... },
    "minimum_requirements": { ... }
  },
  "students": [
    {
      "student_id": "uuid",
      "student_name": "Chan Siu Ming",
      "class_name": "5A",
      "match_score": 0.82,
      "weighted_score": 28.2,
      "eligible": true,
      "risk_level": "safe"
    }
  ],
  "total": 10
}
```

### Extend Existing: `GET /api/v1/jupas/all`

Add `admission_stats` to each programme in the response so the frontend can compute competitiveness tiers client-side without a new endpoint.

Currently returns: `jupas_code, name, school_id, school_name, faculty`
Add: `admission_stats` (the raw JSON field)

## 6. Frontend Routes

| Route | Component | New? |
|-------|-----------|------|
| `/schools/:id` | SchoolProfile (rewritten) | Rewrite |
| `/schools/:id/programmes/:code` | ProgrammeDetail (new) | New |
| `/submissions` | SubmissionList (bugfix) | Fix |

## 7. No Changes To

- SchoolDirectory listing page (works fine)
- Student-facing pages
- Alert system
- Backend scoring engine (used as-is)
