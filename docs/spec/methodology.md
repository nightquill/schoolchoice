<!-- spec-tracks: apps/web/src/pages/MethodologyReport/MethodologyReport.jsx, apps/web/src/api/methodology.js, backend/app/api/v1/routes/methodology.py -->

# Methodology Report Page Spec

Single read-only page displaying the scoring methodology used by the recommendation system.

---

## Methodology Report (`/methodology`)

### Elements
- **NavBarV2** (top navigation, receives account data)
- **Back to Dashboard link** (`<Link to="/dashboard">`, sm text, primary color, padded)
- **Loading state**: `<LoadingSpinner>` with "Loading..." label
- **Error state**: `<ErrorMessage>` component with error detail + "Back to Dashboard" link below

#### Hero Section (when report loaded)
- **Container**: surface background, bordered bottom
- **Title** (h1, 2xl bold, primary text): `report.title` -- "School Choice Recommendation Methodology"
- **Version** (p, sm, secondary text): `report.version` -- "2.0 -- Parametric Statistical Model"
- **Summary** (p, md, secondary text, max-width 800px, normal line-height): `report.summary`

#### Content Sections (flex column, gap-8)

**1. Data Coverage Section** (`aria-label="Data Coverage"`):
- **Section heading** (h2, lg medium, primary text, bordered bottom, padded bottom)
- **Stats row** (flex, gap-6, wrapping):
  - **Total Programmes stat card** (surface bg, bordered, rounded, padded):
    - **Value** (span, 2xl bold, primary color): `report.data_coverage.total_programmes.toLocaleString()`
    - **Label** (div, xs, secondary text): translated "JUPAS Programmes" label
  - **Total Institutions stat card** (same styling):
    - **Value**: `report.data_coverage.total_institutions`
    - **Label**: translated "Institutions" label
- **Data source note** (p, sm, secondary text): `report.data_coverage.data_source`

**2. Methodology Steps Section** (`aria-label="Methodology Steps"`):
- **Section heading** (h2, lg medium, bordered bottom)
- **Steps list** (flex column, gap-5):
  - Per step (flex row, gap-4):
    - **Step number circle** (28x28px, primary bg, white text, rounded full, bold sm, aria-hidden)
    - **Step body** (flex-1):
      - **Step title** (h3, md medium, primary text)
      - **Step description** (p, sm, secondary text, normal line-height)
  - Steps from API:
    1. Grade Conversion -- HKDSE grades to numerical points
    2. Subject Weighting -- programme-specific multipliers
    3. Best-N Selection -- best N subjects by weighted score
    4. Admission Probability -- score vs published admission statistics
    5. Risk Assessment -- at risk / borderline / safe classification

**3. Data Sources Section** (`aria-label="Data Sources"`):
- **Section heading** (h2, lg medium, bordered bottom)
- **Source list** (divider-separated rows):
  - Per source (flex column, gap-1, padded vertically, bordered bottom except last):
    - **Source title** (`<a>`, primary color, no underline, opens in new tab with arrow icon):
      - Link text: `src.source` + " ↗"
      - href: `src.url`
      - `target="_blank"`, `rel="noopener noreferrer"`
    - **Source description** (span, sm, secondary text): `src.description`
  - Sources from API:
    1. JUPAS 2025 Admissions Scores (9 institutions)
    2. JUPAS 2024 Admissions Scores
    3. HKU Programme Scoring Formulas
    4. PolyU Subject Weighting PDFs

**4. Confidence Levels Section** (`aria-label="Confidence Levels"`):
- **Section heading** (h2, lg medium, bordered bottom)
- **Level rows** (bordered-bottom dividers except last):
  - Per level (flex row, space-between, gap-4, padded vertically):
    - **Level badge** (monospace, xs, background bordered pill): confidence key string
    - **Description** (span, secondary text): confidence description
  - Levels from API:
    - `verified_from_jupas_2025_pdf`: "Scores extracted directly from official JUPAS 2025 PDF"
    - `verified_from_polyu_pdf`: "Weights extracted from PolyU individual programme PDFs"
    - `estimated_conservative`: "Conservative estimate based on published preferred subjects"
    - `estimated_pending_pdf_verification`: "Estimated, awaiting manual verification against source"

**5. Limitations Section** (`aria-label="Limitations"`):
- **Section heading** (h2, lg medium, bordered bottom)
- **Limitation items** (bordered-bottom dividers except last):
  - Per limitation (flex row, gap-2, padded vertically, sm secondary text):
    - **Warning icon** (span, warning color, aria-hidden): Unicode &#9888;
    - **Limitation text** (span): limitation string
  - Limitations from API (5 items):
    1. Individual student outcome data not publicly available
    2. Non-academic factors not modelled
    3. Some subject weights estimated conservatively
    4. Normal distribution assumption may not fit all programmes
    5. Year-to-year variation means statistics are indicative

### Data flow
- **Methodology report**: `GET /api/v1/methodology`
  - No authentication required (router has no `Depends(get_current_user)`)
  - Response shape:
    ```json
    {
      "title": "School Choice Recommendation Methodology",
      "version": "2.0 — Parametric Statistical Model",
      "summary": "...",
      "data_coverage": {
        "total_programmes": number,
        "total_institutions": number,
        "data_source": "Official JUPAS 2024/2025 Admissions Scores PDFs"
      },
      "methodology_steps": [
        { "step": number, "title": string, "description": string }
      ],
      "data_sources": [
        { "source": string, "url": string, "description": string }
      ],
      "confidence_levels": {
        "key_string": "description_string"
      },
      "limitations": [ "string", ... ]
    }
    ```
- **Account**: `GET /api/v1/account` (for NavBar display)
- Both fetched in parallel via `Promise.all`

### Key behaviors
- **No auth on methodology endpoint**: the backend route does not use `Depends(get_current_user)`, but the frontend still fetches account for NavBar
- **Live data counts**: `total_programmes` and `total_institutions` are queried from the `jupas_programmes` table at request time (not hardcoded). Falls back to 0 on query failure.
- **Static content**: all methodology steps, data sources, confidence levels, and limitations are hardcoded in the backend response (not stored in DB)
- **External links**: data source URLs open in new tab with `noopener noreferrer`
- **Error handling**: catches `Promise.all` failure, displays error message with back link
- **Locale-formatted numbers**: `total_programmes` uses `.toLocaleString()` for thousands separator
- **Responsive**: stats row and content sections use flex-wrap
- **ARIA**: sections use `aria-label`, step numbers use `aria-hidden`, error uses `role="alert"` (inherited from ErrorMessage component)

---

## Backend API Summary

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/v1/methodology` | GET | None | Returns full methodology report as structured JSON with live programme/institution counts |

The endpoint runs a single SQL query against `jupas_programmes` for counts, then returns a hardcoded JSON structure with methodology steps, data sources, confidence levels, and limitations. All content is defined in Python, not stored in a database table.
