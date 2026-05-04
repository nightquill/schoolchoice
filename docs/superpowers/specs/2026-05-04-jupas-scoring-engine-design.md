# JUPAS Parametric Scoring Engine — Design Spec

> Approved via brainstorming session 2026-05-04

## Goal

Replace the heuristic matching engine with a parametric statistical model calibrated against real JUPAS admission data. Every percentage shown in the UI must trace to a published data source.

## Scope — Three Deliverables

### 1. Parametric Scoring Engine + Methodology Report

- **New `jupas_programme` table** normalizing programmes out of the `major_requirements` JSON blob.
  Each row stores: JUPAS code, programme name, institution, scoring formula (grade-to-point scale + subject weightings), admission statistics (UQ/Median/LQ) per year, minimum requirements, best-N count.
- **Curated data files** (`data/jupas/`) extracted from real JUPAS/university PDFs. JSON format, checked into repo. Covers all 9 UGC institutions + HKMU/HSUHK.
- **New scoring engine** (`backend/app/modules/school_choice/services/jupas_scorer.py`) that:
  1. Converts student HKDSE grades to points using the programme's published scale (standard 7-pt vs HKU/CUHK 8.5-pt vs programme-specific)
  2. Applies programme-specific subject weightings (e.g., ×1.3 for Chemistry in HKU Medicine)
  3. Computes the student's weighted score the same way the university does
  4. Maps the score to an admission probability using the published UQ/Median/LQ distribution
  5. Returns a confidence interval and data provenance for every number
- **Methodology report** served as an API endpoint and viewable in the UI — consultant-readable, research-grade documentation of the scoring methodology with data sources.

### 2. Subject Weighting by Programme

- Each `jupas_programme` row includes a `scoring_formula` JSONB field:
  ```json
  {
    "scale": "hku_enhanced",
    "best_n": 5,
    "subject_weights": {
      "CHEM": 1.3,
      "BIOL": 1.3,
      "M2": 1.0
    },
    "bonus_subjects": ["M1", "M2"],
    "bonus_weight": 0.5
  }
  ```
- The scorer reads this formula and applies it per-programme, per-student.

### 3. Danger Flag

- Backend: new field `at_risk` (boolean) + `risk_reasons` (array) on StudentSchoolTarget.
- Logic: student is "at risk" if their weighted score for any target programme falls below the published LQ (lower quartile) of admitted students.
- Frontend: red warning badge on StudentRow in the student list, and a danger banner on the TargetSchools page.

## Architecture

```
data/jupas/*.json          -- curated programme data (source of truth)
  |
  v
seed script                -- loads into jupas_programmes table
  |
  v
jupas_scorer.py            -- new scoring engine (replaces matchmaker_v2 academic_fit)
  |                           uses jupas_programme rows for formula + stats
  v
matchmaker_v2.py           -- calls jupas_scorer instead of own academic_fit calc
  |                           keeps eligibility filter, interest/language scoring
  v
match API endpoints        -- return enhanced MatchResult with provenance
  |
  v
Frontend                   -- displays score + methodology link + danger flags
```

## Data Sources (Verified Available)

| Data | Source | Format | Update Frequency |
|------|--------|--------|-----------------|
| Admission scores (UQ/M/LQ) | JUPAS annual PDFs | JSON (extracted) | Annual |
| Subject weighting formulas | University scoring formula PDFs | JSON (extracted) | Annual |
| Programme requirements | University websites | JSON (extracted) | Annual |
| HKEAA grade distributions | DATA.GOV.HK | CSV (API) | Annual |
| Grade-to-point scales | University scoring docs | JSON (hardcoded) | Rarely changes |

## Key Decisions

1. **Programme-centric, not school-centric.** JUPAS admits to programmes, not schools. The scoring engine operates at the programme level.
2. **No ML training.** Individual outcome data doesn't exist publicly. The model is parametric — calibrated against published statistics, not trained on labelled data.
3. **Probability mapping.** Student score mapped to admission probability using normal distribution fitted to UQ/Median/LQ quartiles.
4. **Backwards compatible.** The existing MatchResult dataclass is extended, not replaced. `fit_score` continues to be the primary display field.
5. **Annual update workflow.** Update JSON files, run seed script. No scraper infra needed.
