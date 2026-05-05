# School Choice — Scoring Methodology Report

## Overview

The recommendation engine computes **admission probability** for each JUPAS programme by:

1. Converting the student's HKDSE grades to numerical points using the programme's published grade scale
2. Applying programme-specific subject weightings (multipliers)
3. Selecting the best N subjects by weighted score
4. Comparing the total against published admission statistics (Median, Lower Quartile) of actually admitted students
5. Mapping to a probability using a fitted normal distribution

Every number in the system traces to a published official source. No ML training, no heuristics, no fabricated data.

---

## Data Sources

| Source | What it provides | Format | Confidence |
|--------|-----------------|--------|------------|
| [JUPAS 2025 Admissions Scores PDF](https://www.jupas.edu.hk/f/page/3667/af_2025_JUPAS.pdf) | Median + Lower Quartile per programme (all 9 UGC institutions) | PDF, extracted via pymupdf | Verified |
| [JUPAS 2024 Admissions Scores PDF](https://www.jupas.edu.hk/f/page/3667/af_2024_JUPAS.pdf) | Previous year M/LQ for trend | PDF, extracted | Verified |
| [HKU Programme Scoring Formulas](https://admissions.hku.hk/apply/jupas/score-calculator) | Exact formula + multipliers per HKU programme (e.g., "1.5 x Eng + 1.5 x Math + Best 3") | PDF + web | Verified |
| [CUHK Score Calculator](https://admission.cuhk.edu.hk/application/jupas/programme-specific-requirements-and-score-calculator/) | Subject multipliers (x2 Math, x1.75 M1/M2, etc.) | Web | Verified |
| PolyU Individual Programme PDFs | Absolute subject weights (5-10 per subject) | PDF per programme | 3 verified, 41 estimated |
| CityU Scoring Formula PDF | Group multipliers (2x for relevant subjects, 1x others) | PDF | Verified from JUPAS PDF |
| HKUST | "Preferred subjects" indicators only — no published multipliers | PDF | Estimated at conservative 1.2x |

---

## Grade-to-Point Scale

From 2025, **all JUPAS institutions** use the enhanced 8.5-point scale:

| HKDSE Level | Points |
|-------------|--------|
| 5** | 8.5 |
| 5* | 7.0 |
| 5 | 5.5 |
| 4 | 4.0 |
| 3 | 3.0 |
| 2 | 2.0 |
| 1 | 1.0 |
| U | 0.0 |
| CSD Attained | 1.0 |
| CSD Attained with Distinction | 2.0 |

Source: Header of both JUPAS 2024 and 2025 Admissions Scores PDFs.

---

## Scoring Formula Examples

### HKU Business Administration (JS6755)

**Published formula**: `1.5 × English + 1.5 × Mathematics + Best 3 Subjects + 0.2 × 6th Best Subject`

**Scale**: Enhanced 8.5-point

**How it works for a student with CHLA=5, ENGL=5*, MATH=5**, CSD=A, PHYS=5, CHEM=4:**

| Subject | Grade | Base Points | Weight | Weighted |
|---------|-------|-------------|--------|----------|
| MATH | 5** | 8.5 | ×1.5 | 12.75 |
| ENGL | 5* | 7.0 | ×1.5 | 10.50 |
| CHLA | 5 | 5.5 | ×1.0 | 5.50 |
| PHYS | 5 | 5.5 | ×1.0 | 5.50 |
| CHEM | 4 | 4.0 | ×1.0 | 4.00 |
| | | | **Best 5:** | **38.25** |
| CSD | A | 1.0 | ×0.2 | 0.20 |
| | | | **Total:** | **38.45** |

**Published 2025 stats**: Median = 37, LQ = 36

**Result**: Score 38.45 > Median 37 → **97% admission probability, SAFE**

### CityU Biomedical Engineering (JS1211)

**Published formula**: `Best 5 subjects` with `2× weight` for English, Mathematics, Biology, Chemistry, M1/M2, Physics

**Same student:**

| Subject | Grade | Base Points | Weight | Weighted |
|---------|-------|-------------|--------|----------|
| MATH | 5** | 8.5 | ×2 | 17.0 |
| ENGL | 5* | 7.0 | ×2 | 14.0 |
| PHYS | 5 | 5.5 | ×2 | 11.0 |
| CHEM | 4 | 4.0 | ×2 | 8.0 |
| CHLA | 5 | 5.5 | ×1 | 5.5 |
| | | | **Best 5:** | **55.5** |

**Published 2025 stats**: Median = 39, LQ = 38

**Result**: Score 55.5 >> Median 39 → **99% probability, SAFE**

### Weak Student (all 4s/3s) → HKU BBA

| Subject | Grade | Base Points | Weight | Weighted |
|---------|-------|-------------|--------|----------|
| MATH | 4 | 4.0 | ×1.5 | 6.0 |
| ENGL | 4 | 4.0 | ×1.5 | 6.0 |
| CHLA | 4 | 4.0 | ×1.0 | 4.0 |
| PHYS | 3 | 3.0 | ×1.0 | 3.0 |
| CHEM | 3 | 3.0 | ×1.0 | 3.0 |
| CSD | A | 1.0 | ×0.2 | 0.2 |
| | | | **Total:** | **22.2** |

**vs Median 37, LQ 36** → **1% probability, AT RISK**

---

## Probability Mapping

The admission probability is computed using a normal distribution fitted to the published quartiles:

- **μ (mean)** = Published Median score
- **σ (std dev)** = IQR / 1.349, where IQR = UQ − LQ (for normal distributions, IQR = 1.349σ)
- **P(admitted)** = Φ((student_score − μ) / σ) — the normal CDF

When only Median and LQ are published (no UQ), we estimate: IQR = 2 × (Median − LQ)

The probability is clamped to [1%, 99%] to avoid overconfidence.

### Interpretation

| Probability | Meaning |
|-------------|---------|
| >75% | Above the upper quartile of admitted students — strong chance |
| 50% | At the median — roughly even odds |
| 25% | At the lower quartile — bottom of typically admitted students |
| <25% | Below most admitted students — at risk |

### Risk Levels

| Level | Condition | UI Treatment |
|-------|-----------|-------------|
| **Safe** | Score ≥ Median | Normal display |
| **Borderline** | LQ ≤ Score < Median | No flag (still within admitted range) |
| **At Risk** | Score < LQ | Red "AT RISK" badge, warning banner |

---

## Data Coverage

| Institution | Programmes | Scores Verified | Weights Verified | Source |
|-------------|-----------|-----------------|-----------------|--------|
| HKU | 54 | 54/54 (100%) | 29 from PDF + 25 unweighted | HKU + JUPAS PDF |
| CUHK | 70 | 70/70 (100%) | 46 from PDF + 24 unweighted | JUPAS PDF |
| HKUST | 34 | 33/34 (97%) | 34 conservative 1.2x | JUPAS PDF |
| CityU | 58 | 57/58 (98%) | 39 from PDF + 19 unweighted | JUPAS PDF |
| PolyU | 44 | 44/44 (100%) | 3 from PDF + 41 estimated | JUPAS PDF + PolyU PDFs |
| HKBU | 22 | 22/22 (mean+grades) | 0 (confirmed unweighted) | JUPAS PDF |
| Lingnan | 24 | 23/24 (96%) | 0 (confirmed unweighted) | JUPAS PDF |
| EdUHK | 26 | 26/26 (100%) | 24 from PDF + 2 unweighted | JUPAS PDF |
| HKMU | 28 | 28/28 (100%) | 9 from PDF + 19 unweighted | JUPAS PDF |
| HSUHK | 10 | 0 (not in JUPAS PDF) | 10 estimated | SSSDP — separate source needed |
| **Total** | **370** | **357/370 (96%)** | **235 with weights** | |

---

## What the Score IS and IS NOT

### It IS:
- A statistical estimate of where the student sits in the distribution of previously admitted students
- Based on the EXACT formula each university publishes for each programme
- Calibrated against REAL published admission statistics (not training data estimates)
- Traceable: every number links to a specific PDF, page, and cell

### It IS NOT:
- A guarantee of admission (non-academic factors like interviews, portfolios, SLP are not modelled)
- A prediction trained on individual student outcomes (that data doesn't exist publicly)
- Comparable across programmes (different programmes use different formulas/scales)
- Static year-to-year (admission stats change annually; we use the most recent available)

---

## Limitations

1. **No interview/portfolio modelling** — programmes requiring interviews (e.g., HKU Medicine, HKBU Film) have an additional selection layer we cannot quantify.

2. **HKUST weights are estimated** — HKUST shows "preferred subjects" but doesn't publish exact multipliers. We use a conservative 1.2× for preferred subjects.

3. **PolyU weights are partially estimated** — 3 programmes have verified weights from official PDFs. The remaining 41 use templates based on programme type (engineering/business/health/etc.).

4. **HSUHK data is estimated** — HSUHK is an SSSDP institution not covered by the JUPAS 9-institution PDF. Scores and weights are estimates.

5. **Normal distribution assumption** — the probability mapping assumes admission scores are normally distributed. Real distributions may be skewed, especially for very competitive programmes.

6. **Year-to-year variation** — a programme's median can shift 2-5 points between years depending on cohort quality and applicant numbers. We use the most recent year available.

7. **Band choice effects** — JUPAS allows students to rank programmes in preference bands. A student's band choice affects their admission chances but is not modelled here.

---

## Annual Update Process

1. Download new JUPAS Admissions Scores PDF (published ~August each year)
2. Extract text with pymupdf
3. Parse median/LQ per programme
4. Update `data/jupas/programmes/*.json` files
5. Run `python scripts/seed_jupas_programmes.py` to load into database
6. Verify with `python -m pytest tests/test_jupas_scorer.py`

Scoring formulas change less frequently (typically stable year-to-year). Check university websites annually for formula updates.

---

## Technical Implementation

| Component | File | Purpose |
|-----------|------|---------|
| Grade scales | `data/jupas/grade_scales.json` | Grade-to-points conversion tables |
| Programme data | `data/jupas/programmes/*.json` | Formulas, weights, admission stats per programme |
| Scorer engine | `backend/app/modules/school_choice/services/jupas_scorer.py` | Core scoring logic (46 unit tests) |
| Matchmaker integration | `backend/app/modules/school_choice/services/matchmaker_v2.py` | Routes scoring through JUPAS path when data available |
| DB model | `JupasProgramme` in `models.py` | Stores programme data for API access |
| Seed script | `scripts/seed_jupas_programmes.py` | Loads JSON data into database |
| API | `backend/app/api/v1/routes/methodology.py` | Serves methodology info |
| Danger flags | `StudentSchoolTarget.at_risk` | Flags students below LQ |
