# Test Results — v2 Backend
# Date: 2026-03-27

## Environment

- Python: 3.9.19
- FastAPI: 0.111.0
- SQLAlchemy: 2.0.30
- Database: SQLite (in-memory, test only)
- pytest: 8.2.0

## Run Command

```bash
cd backend
python -m ruff check app/ --fix   # 0 errors after fixes
python -m pytest tests/ -v
```

## Ruff Lint

```
All checks passed!
```

## Pytest Results

```
============================= test session starts ==============================
platform darwin -- Python 3.9.19, pytest-8.2.0, pluggy-1.6.0

57 passed in 2.65s
```

### Test Breakdown

| File | Tests | Result |
|------|-------|--------|
| tests/test_auth.py | 5 | PASS |
| tests/test_v2_routes.py | 22 | PASS |
| tests/test_v2_services.py | 30 | PASS |
| **Total** | **57** | **ALL PASS** |

## Known Constraints

- Tests run against SQLite (in-memory); production uses PostgreSQL.
- `UUID(as_uuid=True)` with SQLite requires the `auth_headers` conftest
  fixture to inject `get_current_user` directly (bypassing the string-UUID
  query path that fails in SQLite). Production PostgreSQL handles this natively.
- `shap`, `xgboost`, `scikit-learn` installed; ML model path not set in test
  environment — all ML score paths correctly fall back to rule-only scoring.
- Transcript parsing requires `pdfplumber` (PDF) or `pytesseract` + `Pillow`
  (images) — not installed in base env; graceful fallback returns empty
  suggestions with confidence=0.0.

## New Services Tested

- `hkdse_service`: grade_to_int, compute_best5_aggregate, compute_predicted_grade
- `matchmaker_v2`: run_eligibility_filter, compute_weighted_score, run_matching
- `plan_generator`: generate_html_plan, _build_action_items

## New Route Endpoints Smoke-Tested

- GET/PATCH /api/v1/account
- POST /api/v1/account/change-password
- GET /api/v1/schools, GET /api/v1/schools/{id}
- GET/POST /api/v1/students/{id}/grades
- GET/POST /api/v1/students/{id}/targets
- GET/POST /api/v1/students/{id}/plan
- GET /api/v1/students/{id}/plan/status
- POST /api/v1/admin/data-refresh (auth guard verified)
