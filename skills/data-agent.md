---
agent: data-agent
version: 1
last_updated: 2026-03-27
---

# Data Agent Skills

> Written for reuse across future runs and for any agent inheriting this role.
> Append — never delete.

---

## 1. Token-Efficient Fetch Protocol

### Rule set (from preferences.md §7.3)
1. **Index first**: fetch the listing/index page, extract all relevant child URLs, then fetch only the detail pages you actually need.
2. **Cache before process**: immediately after fetching, write raw HTML to `data/cache/<url_slug>.html`. Before any fetch, check whether the cache file exists and read from it instead.
3. **No duplicate fetches**: maintain a mental set of already-fetched URLs within the current run. If the URL appears in that set, skip it.
4. **Targeted extraction**: use CSS selectors or known section IDs — never scan an entire page blob when a table or `<div>` is sufficient.
5. **Incremental write**: write to `data/raw/<source>.json` after finishing each source; do not hold large datasets purely in memory.
6. **Resume check**: before processing a source, check `data/sources.md` — if a row for that source already exists, skip re-fetching unless explicitly forced.
7. **Row-by-row table processing**: for HTML tables, map each `<tr>` to schema fields one at a time; discard columns with no schema mapping immediately.

### URL slug convention
Convert URL to a filesystem-safe slug:
- Strip `https://` and `http://`
- Replace `/`, `?`, `=`, `&`, `.` with `_`
- Truncate at 80 characters
- Example: `https://www.jupas.edu.hk/en/statistic/` → `www_jupas_edu_hk_en_statistic`

### Cache read pattern
```
cache_path = data/cache/<slug>.html
if file_exists(cache_path):
    content = read(cache_path)
else:
    content = web_fetch(url)
    write(cache_path, content)
```

---

## 2. HKDSE Domain Knowledge

### Grade scale
| Grade | Numeric equivalent |
|---|---|
| 5** | 7 |
| 5* | 6 |
| 5 | 5 |
| 4 | 4 |
| 3 | 3 |
| 2 | 2 |
| 1 | 1 |
| U (Unclassified) | 0 |
| X (Absent) | 0 |

Applied Learning grades: **Attained** or **Attained with Distinction** (not numeric). ApL does not count toward the standard best-5 aggregate in JUPAS but may count as bonus points in some programmes.

### JUPAS aggregate scoring
Standard aggregate = best 5 subjects including:
- Chinese Language (compulsory)
- English Language (compulsory)
- Mathematics Compulsory Part (compulsory)
- Citizenship and Social Development (compulsory, reported as Attained/Not Attained, no numeric contribution in most calculations)
- Best 2 elective subjects from the remaining subjects

Extended Mathematics (M1/M2) may count as an additional elective for bonus purposes, depending on programme rules. Some programmes specify required elective subjects (e.g., Sciences for Medicine).

### Subject categories
| Category | Description |
|---|---|
| CORE | 4 compulsory subjects all HKDSE candidates sit |
| ELECTIVE | Standard elective subjects (candidate selects 2–3) |
| OTHER_LANGUAGE | Non-English, non-Chinese language electives |
| APPLIED_LEARNING | Vocational/applied subjects, graded Attained/Distinction |

### Compulsory subjects (codes)
- CHLA — Chinese Language
- ENGL — English Language
- MATH — Mathematics (Compulsory Part)
- CSD — Citizenship and Social Development (replaced Liberal Studies from 2021-22)

### Notable subject groupings for matchmaking
- Science pathway: BIOL, CHEM, PHYS (or Combined Science CSCI)
- Business pathway: ECON, BAFS
- Arts/Humanities pathway: HIST, CHIH, CHIL, GEOG, VART, MUSC, ERS
- STEM extended: M1, M2, ICT, DAT
- PE/Performing: PE, MUSC, VART

---

## 3. Handling Estimated vs Official Data

### Confidence levels
| confidence_level value | Meaning |
|---|---|
| `official` | Directly extracted from a primary source URL (HKEAA, JUPAS, university admissions page). Cache file exists. |
| `semi_official` | Derived from a secondary but reputable source (e.g., newspaper article citing JUPAS data). |
| `estimated_from_training_data` | Agent's training knowledge only — no live fetch. Must be replaced by official data before production use. |

### Workflow rule
- Every JSON record and SQL row must carry `confidence_level`.
- Every `data/sources.md` row must state confidence.
- A prominent `DATA NOTICE` warning must appear at the top of `data/sources.md`.
- SQL seed files must include a header comment with the same warning.

### When to upgrade confidence
Replace `estimated_from_training_data` with `official` only when:
1. The URL has been fetched and cached.
2. The value was directly read from that page (not inferred).
3. The `data/sources.md` row updated with the actual access date and URL.

---

## 4. Seed SQL with UUID PKs and FK Safety

### Grade system FK pattern
The `subject` table has a FK `grade_system_id`. To avoid FK violations on re-run:
1. Insert `grade_system` row **first**, using a hardcoded UUID so it can be referenced.
2. Use that same hardcoded UUID in all subject `INSERT` statements.
3. Add `ON CONFLICT DO NOTHING` to the grade_system insert so re-runs are safe.

Hardcoded HKDSE grade_system UUID (reserved):
```
00000000-0000-0000-0000-000000000001
```

### Subject INSERT pattern
```sql
INSERT INTO subject (id, grade_system_id, name, code, ...)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', ...)
ON CONFLICT DO NOTHING;
```
Using `gen_random_uuid()` for subjects means each run generates new UUIDs — safe with `ON CONFLICT DO NOTHING` as long as there is a unique constraint on `(grade_system_id, code)` or `code` alone. If the subjects table has no unique constraint on `code`, add one in the migration or use a hardcoded UUID per subject.

### School INSERT pattern
```sql
INSERT INTO school (id, name, ..., required_subjects, faculties, notable_programs, language_requirements)
VALUES (gen_random_uuid(), 'School Name', ...,
  '[{"code":"ENGL","min_grade":"3"}]',   -- JSON string, double-quoted keys
  '["Faculty of Arts"]',
  '["Programme A"]',
  '{"ielts_minimum":6.5}'                -- NULL if no requirement
)
ON CONFLICT (name) DO NOTHING;
```

### JSONB escaping rules for SQL strings
- Use single-quoted SQL strings containing valid JSON.
- Escape any single quotes inside the JSON value by doubling: `''`.
- Arrays: `'["item one","item two"]'`
- Objects: `'{"key":"value"}'`
- NULL JSONB: use SQL `NULL` (not the string `'null'`).

### Re-runnable safety checklist
- [ ] grade_system insert: `ON CONFLICT DO NOTHING`
- [ ] subject inserts: `ON CONFLICT DO NOTHING`
- [ ] school inserts: `ON CONFLICT (name) DO NOTHING`
- [ ] No `TRUNCATE` or `DELETE` statements in seed files
- [ ] Header comment states data source and confidence level

---

## 5. JUPAS Score Data Notes

- JUPAS codes follow the pattern `JS<4-digit number>`. HKU codes start with JS6xxx, CUHK with JS4xxx, HKUST with JS5xxx, PolyU with JS3xxx, CityU with JS1xxx, HKBU with JS2xxx, Lingnan with JS7xxx, EdUHK with JS8xxx.
- JUPAS statistics page: https://www.jupas.edu.hk/en/statistic/ — publishes median and lower quartile admitted scores per programme per year.
- Scores are HKDSE aggregates (best 5 or 6 subjects). Medicine consistently highest (~31). Law ~27–29. Engineering and Business at top universities ~25–28. Community colleges and vocational entry ~8–10.
- Academic year format in this project: `"2023-24"` (hyphenated, 4-digit years).

---

## 6. Directory Structure Reminder

```
data/
  cache/          Raw fetched HTML (keyed by URL slug)
  raw/            Extracted data per source, before schema alignment
  processed/      Schema-aligned JSON ready for database import
  seed/           SQL INSERT files safe to run against PostgreSQL
  sources.md      Source registry — append after each source completed
skills/
  data-agent.md   This file
```

---

## 7. Known Sources and Reliability (from Training Knowledge)

| Source | Reliability | Structured? | Notes |
|---|---|---|---|
| HKEAA subject list page | High | Yes (HTML table) | Stable URL, rarely changes |
| JUPAS statistics page | High | Yes (HTML tables per year) | Published after each admissions cycle; year suffix in URL |
| Individual university JUPAS pages | Medium | Varies | Some provide PDF, some HTML tables |
| University general admissions pages | Medium | Low structure | Narrative text; admission requirements for each programme separately |

---

*Append new learnings below this line after each significant run.*
