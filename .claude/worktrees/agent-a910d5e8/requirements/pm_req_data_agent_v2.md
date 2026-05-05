# PM → Data Agent — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# New agent — no v1 predecessor.

---

## Context

The Data Agent is a new agent introduced in v2. Its role is to gather, structure, and maintain external real-world data for the system. It is not an API integration — it is a research and data-structuring agent that produces seed SQL and JSON files consumed by the Database Engineer and Backend Engineer.

The Data Agent follows the same agent .md file structure as all other agents and must maintain `skills/data-agent.md`.

---

## Owned Requirements (v2)

### REQ-081 [DATA] — HKDSE Subject Data
Gather the complete official HKDSE subject list from HKEAA published sources:
- All subjects with official subject codes (e.g. CHLA, ENGL, MATH, etc.)
- Subject categories (Core, Elective, Other Language, Applied Learning)
- Which subjects are compulsory
- Grade distributions per subject (if available in published HKEAA statistics)

Output: `data/processed/subjects.json` — schema-aligned to the Subject entity:
```json
[
  {
    "name": "Chinese Language",
    "code": "CHLA",
    "category": "CORE",
    "is_compulsory": true,
    "hkdse_subject_code": "CHLA",
    "grade_system": "HKDSE"
  }
]
```
Output: `data/seed/seed_subjects.sql` — INSERT statements for the subjects table.

### REQ-082 [DATA] — Hong Kong University and Tertiary Institution Profiles
Gather profiles for all major Hong Kong universities and tertiary institutions:

Priority institutions:
1. The University of Hong Kong (HKU)
2. The Chinese University of Hong Kong (CUHK)
3. The Hong Kong University of Science and Technology (HKUST)
4. The Hong Kong Polytechnic University (PolyU)
5. City University of Hong Kong (CityU)
6. Hong Kong Baptist University (HKBU)
7. Lingnan University
8. The Education University of Hong Kong (EdUHK)
9. The Hong Kong Metropolitan University (HKMU)
10. Community colleges and vocational institutions (VTC, IVE, etc.)

Per institution, gather:
- Official English name and Chinese name
- Institution type (University/Polytechnic/Community College/Vocational)
- Location (campus address or district)
- Website URL
- General minimum HKDSE entry requirements (aggregate, where published)
- Required subjects (with minimum grades) for at least the 3 most popular programs
- Language requirements (IELTS minimum if stated)
- Notable programs / faculties
- Acceptance rate (if published)
- Average/median admitted HKDSE score (from JUPAS or institution data)
- Scholarship availability

Output: `data/processed/schools.json` — schema-aligned to the School entity.
Output: `data/seed/seed_schools.sql` — INSERT statements for the schools table.

### REQ-083 [DATA] — JUPAS Historical Entry Score Data
Gather JUPAS program entry score data (median and lower quartile where available):
- Source: JUPAS published statistics or university admission results pages
- Per program: institution, program name, program code, academic year, median admitted score, lower quartile score
- This data populates School.average_admitted_score (use median where available)

Output: `data/processed/jupas_scores.json`:
```json
[
  {
    "institution": "HKU",
    "program_name": "Bachelor of Arts",
    "jupas_code": "JS6954",
    "academic_year": "2024",
    "median_score": 22,
    "lower_quartile_score": 20
  }
]
```

### REQ-084 [DATA] — Source Registry
Maintain `data/sources.md` documenting every data source used:

Format per source:
```
## <Source Name>
- URL: <full URL>
- Access date: <YYYY-MM-DD>
- Data freshness: <academic year or "as of YYYY-MM-DD">
- Confidence: Official | Semi-official | Estimated
- Notes: <any caveats>
```

Any data that is estimated or inferred (not officially published) must be marked Confidence: Estimated and include a note explaining the inference method.

### REQ-085 [DATA] — Output File Structure
The Data Agent must produce all of the following:

| File | Description |
|---|---|
| `data/sources.md` | Source registry (append after each source processed) |
| `data/raw/<source_name>.json` | Raw extracted data per source (one file per source) |
| `data/processed/schools.json` | Cleaned, schema-aligned school records |
| `data/processed/subjects.json` | HKDSE subject list with codes and categories |
| `data/processed/jupas_scores.json` | Historical JUPAS entry score data |
| `data/seed/seed_schools.sql` | Ready-to-run INSERT statements for schools table |
| `data/seed/seed_subjects.sql` | Ready-to-run INSERT statements for subjects table |

SQL files must use `INSERT INTO ... ON CONFLICT DO NOTHING` to be safely re-runnable.

### REQ-086 [DATA] — Token-Efficient Fetch Protocol
The Data Agent must follow these rules to minimise redundant work and token consumption:

1. **Index first**: fetch the index or listing page to extract all relevant URLs before fetching any detail pages
2. **Targeted extraction**: use CSS selectors or explicit section IDs — never process an entire page HTML blob when a table or div is sufficient
3. **Cache before process**: write fetched page content to `data/cache/<url_hash>.html` before processing; check cache before any fetch
4. **No duplicate fetches**: maintain a set of fetched URLs in memory for the current run; skip any URL already fetched
5. **Incremental write**: write to `data/raw/<source>.json` after processing each source; do not hold all data in memory
6. **Resume capability**: if data/sources.md already has an entry for a source, skip re-fetching that source unless forced
7. **Process row by row**: extract table data one row at a time; map only columns that correspond to schema fields

### REQ-087 [DATA] — Academic Year Refresh Trigger
When preferences.md is updated to indicate a new academic year (e.g., "2025-26"), the Data Agent must re-run all data gathering tasks for that year. The previous year's raw data files must be preserved (not overwritten) by appending the year suffix to the filename (e.g., `data/raw/jupas_2024.json`).

---

## Skills File Requirement

The Data Agent must create and maintain `skills/data-agent.md`, documenting:
- Which URLs and sources were most reliably structured (easiest to parse)
- Which sources required estimation vs. direct extraction
- Efficient CSS selectors or page section paths used per source
- Any rate-limiting or access issues encountered and workarounds
- Domain knowledge learned: JUPAS scoring system, HKEAA subject codes, etc.

---

## Deliverables

- `data/sources.md`
- `data/raw/*.json` (one per source)
- `data/processed/schools.json`
- `data/processed/subjects.json`
- `data/processed/jupas_scores.json`
- `data/seed/seed_schools.sql`
- `data/seed/seed_subjects.sql`
- `skills/data-agent.md`

---
*Packet owner: Data Agent. All items PENDING.*
