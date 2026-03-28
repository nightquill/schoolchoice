# PM → Integration Engineer — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

v1 integration is complete (INTEGRATION_REPORT.md: verdict PASSED, 4 E2E tests). Your task is to extend the integration test suite and validate all new v2 workflows end-to-end. The existing Docker Compose setup must be extended to support new services or volumes if required.

---

## Owned Requirements (v2)

### REQ-105 [INTEGRATION] — Academic Plan Async Flow Validation
Write and execute an integration test for the full plan generation lifecycle:
1. Authenticated POST to `/api/v1/students/{id}/plan/generate` — expect 202 Accepted with task_id
2. Poll `GET /api/v1/students/{id}/plan/status` until status = "complete" (timeout: 30 seconds)
3. GET `/api/v1/students/{id}/plan` — expect 200 response with Content-Type: text/html
4. Validate HTML content contains all 7 plan sections (check for section headings in HTML)
5. Validate AcademicPlan record in DB has html_content populated and version ≥ 1
6. Validate the frontend renders the plan in the iframe without errors (Playwright or manual verification)

### REQ-106 [INTEGRATION] — Transcript Upload and Async Parse Validation
Write and execute an integration test for the transcript upload flow:
1. POST a test PDF to `/api/v1/students/{id}/transcripts` — expect 202 Accepted
2. Poll `GET /api/v1/students/{id}/transcripts/{transcript_id}` until parsed_data is not null (timeout: 60 seconds)
3. Validate parsed_data structure: array of `{subject_name, grade, confidence}`
4. Confirm no StudentSubjectGrade records were auto-created as a result of parsing
5. Simulate user accepting one parsed suggestion: POST to `/api/v1/students/{id}/grades` with accepted values; confirm record created
6. Simulate user dismissing one suggestion: confirm no record created

### REQ-107 [INTEGRATION] — API Response Time Validation
Write an integration test asserting response times for all GET endpoints:
- For each of the following, make 3 consecutive requests and assert all ≤ 500ms:
  - GET /api/v1/students
  - GET /api/v1/students/{id}
  - GET /api/v1/students/{id}/grades
  - GET /api/v1/students/{id}/targets
  - GET /api/v1/schools
  - GET /api/v1/schools/{id}
  - GET /api/v1/account
- Log response times to integration test output
- Test must pass in the Docker Compose environment (not just local machine)

### REQ-108 [INTEGRATION] — Drag-to-Reorder Persistence Validation
Write an integration test for preference rank reordering:
1. Create a student with 3 StudentSchoolTarget records (school A rank=1, B rank=2, C rank=3)
2. PATCH target B to rank=1, target A to rank=2, target C to rank=3
3. GET `/api/v1/students/{id}/targets` — confirm returned order matches new ranks
4. Verify ordering is stable across page refresh (re-fetch returns same ranked order)

---

## Additional Integration Validation (v2 completeness)

Beyond the 4 new REQ-bound tests, validate the following flows with integration tests or documented manual test steps:

| Flow | Test Type |
|---|---|
| Counsellor login → create student → enter grades (multiple sittings) → view predicted grade | Automated |
| Add school to target list from School Directory → confirm target record created | Automated |
| Edit StudentSchoolTarget status (CONSIDERING → APPLIED) | Automated |
| Admin login → trigger data refresh → poll for completion | Automated |
| Account Settings: change display name | Automated |
| Account Settings: change password | Automated |
| Account Settings: delete account (soft delete) | Automated |
| School Directory: search by name, filter by type, filter by score range | Automated |
| Non-admin user attempts to access /admin/data-refresh → 403 | Automated |
| IELTS score below school requirement → eligibility_pass=false, failing_criteria includes IELTS reason | Automated |

---

## Docker Compose Updates

Review `docker-compose.yml` and update if needed for v2:
- If transcript parsing requires additional system libraries (e.g. pdfplumber, poppler, tesseract): add to backend Dockerfile
- If plan generation uses significant memory: add memory limit config to docker-compose for documentation
- Add `data/` volume mount if Data Agent outputs must be accessible to the backend container at runtime (for seed SQL)
- Ensure `docker-compose.test.yml` works with new schema migrations applied

---

## Rulings and Open Items

If any integration test reveals a gap between agent implementations (e.g. a backend endpoint not matching the frontend's expected request/response shape), raise it in `requirements/pm_rulings_v2.md` format and notify the PM.

---

## Deliverables

- `integration/e2e/test_plan_generation.py` — REQ-105
- `integration/e2e/test_transcript_flow.py` — REQ-106
- `integration/e2e/test_performance.py` — REQ-107
- `integration/e2e/test_target_rank.py` — REQ-108
- `integration/e2e/test_v2_flows.py` — all additional flow tests
- `integration/INTEGRATION_REPORT_v2.md` — v2 integration verdict
- Updated `docker-compose.yml` (if changes needed)
- `skills/integration-engineer.md` — skills file (create or append)

---
*Packet owner: Integration Engineer. All items PENDING.*
