# Data Sources Registry

> **DATA NOTICE: All records in this initial seed are estimated from training data
> and must be verified against official HKDSE and JUPAS publications before use
> in production.**
>
> No live web fetches were performed in this run. All data below is derived from
> the agent's training knowledge (model knowledge cutoff: August 2025). JUPAS
> codes, entry scores, and acceptance rates are representative estimates and may
> not match current published figures. Authoritative sources are listed in each
> section for manual verification.

---

| Source | URL | Access Date | Data Freshness | Confidence | Notes |
|---|---|---|---|---|---|
| HKDSE Subject List (training knowledge) | training_knowledge | 2026-03-27 | as of 2024-01-01 | Estimated | Subject names, codes, and categories derived from agent training data. Cross-check against HKEAA published subject list at https://www.hkeaa.edu.hk before production use. CSD replaced Liberal Studies in 2021-22 cohort — verified in training data. |
| HK University Profiles (training knowledge) | training_knowledge | 2026-03-27 | as of 2024-01-01 | Estimated | Institution names, types, locations, faculties, and minimum entry scores estimated from training data. Minimum entry scores are floor aggregates (best 5 subjects) and vary significantly by programme. Verify against each university's official JUPAS admissions page. |
| JUPAS Entry Scores (training knowledge) | training_knowledge | 2026-03-27 | as of 2023-24 | Estimated | Median and lower quartile scores are representative estimates based on training data knowledge of historical JUPAS rounds. JUPAS codes may not match current cycle codes. Verify against official JUPAS statistics at https://www.jupas.edu.hk/en/statistic/ |
| HKEAA Official Subject List (authoritative — not yet fetched) | https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_and_grade/ | — | — | Official (pending fetch) | Should be fetched in a future run to replace training-knowledge subject data. Cache target: data/cache/hkeaa_subject_list.html |
| JUPAS Official Statistics (authoritative — not yet fetched) | https://www.jupas.edu.hk/en/statistic/ | — | — | Official (pending fetch) | Should be fetched in a future run to replace estimated JUPAS score data. Cache target: data/cache/jupas_statistics.html |

---

## Source Detail

### HKDSE Subject List
- **URL:** training_knowledge
- **Access date:** 2026-03-27
- **Data freshness:** as of 2024-01-01
- **Confidence:** Estimated
- **Notes:** 4 compulsory subjects (CHLA, ENGL, MATH, CSD), 22 electives, 5 other languages, and 1 Applied Learning generic entry. Liberal Studies was replaced by Citizenship and Social Development (CSD) from the 2021-22 HKDSE cohort onward. Applied Learning subjects are graded Attained / Attained with Distinction (not numeric). Extended Math modules M1 and M2 count as bonus subjects in JUPAS scoring.

### HK University and Tertiary Institution Profiles
- **URL:** training_knowledge
- **Access date:** 2026-03-27
- **Data freshness:** as of 2024-01-01
- **Confidence:** Estimated
- **Institutions covered:** HKU, CUHK, HKUST, PolyU, CityU, HKBU, Lingnan, EdUHK, HKCC, VTC
- **Notes:** Minimum entry scores represent approximate JUPAS aggregate floors (best 5 subjects). Programme-level requirements differ from institution-level floors. Acceptance rates are approximate and vary by programme and year. Language requirements (IELTS) are indicative only; international applicants may be subject to different criteria.

### JUPAS Historical Entry Scores
- **URL:** training_knowledge
- **Access date:** 2026-03-27
- **Data freshness:** representative of 2023-24 academic year
- **Confidence:** Estimated
- **Notes:** 31 programme entries covering HKU (7), CUHK (7), HKUST (5), PolyU (6), CityU (6). Scores reflect median admitted HKDSE aggregate (best 5 or 6 subjects depending on programme bonus). JUPAS codes are representative — verify against https://www.jupas.edu.hk for the current admissions cycle. Medicine programmes at HKU and CUHK consistently show the highest entry scores (~31 median).
