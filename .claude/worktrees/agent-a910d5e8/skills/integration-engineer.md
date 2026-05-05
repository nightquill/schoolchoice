# Skills — Integration Engineer
# Intelligent Academic Advisor
# Author: Integration Engineer
# Created: 2026-03-27 (v2 pipeline run)
# This file is append-only. Never delete entries.

---

## v2 Run — 2026-03-27

### What worked

- **Reading manifests before touching files**: Reading BACKEND_MANIFEST_V2.md and FRONTEND_MANIFEST_V2.md first gave an instant map of all endpoints, pages, and components before diving into code. This is always the right starting point.

- **Cross-referencing API contracts against frontend API files**: The fastest way to find URL/method bugs is to read each `frontend/src/api/*.js` file in parallel with `architecture/api_contracts_v2.md`. Three of four frontend bugs were caught this way in one pass.

- **Running tests early**: Running `pytest` before starting manual analysis confirmed 57/57 green, which meant the backend was structurally sound and narrowed attention to runtime serialization issues and frontend wiring.

- **Pydantic v2 `validation_alias` + `populate_by_name=True`**: When an ORM model's primary key is `id` but the API contract exposes it as `job_id`, using `Field(validation_alias="id")` with `populate_by_name=True` is the correct and least-invasive fix. It allows both ORM-based `model_validate` and explicit keyword construction to work. Do NOT use `alias` alone (breaks JSON output key name) and do NOT use `model_validate` override (fragile with FastAPI's response_model pathway).

- **Checking response shape consistency**: When a frontend page accesses `response.targets` but the backend schema returns `{targets: [...]}` — and the frontend was reading `response.items` — this is a classic copy-paste bug. Always check the list-response field name.

- **Seed SQL table naming**: Seed files written by agents often use singular table names (e.g., `INSERT INTO school`) when the actual schema uses plural (`INSERT INTO schools`). Always verify seed SQL table names against the migration or ORM `__tablename__` values before finalising.

- **Docker-compose infrastructure completeness checklist**:
  1. Does the backend have all required env vars? (DATABASE_URL, SECRET_KEY, UPLOAD_DIR if using file upload)
  2. Are all persistent storage paths backed by named volumes?
  3. Does the frontend Dockerfile accept and pass through VITE_* build args?
  4. Does docker-compose.yml pass build args to the frontend build context?

### What to avoid

- **Do not use `Field(alias=...)` alone for ORM→schema mapping when the JSON output key must match the Python field name**: `alias` changes the JSON output key. Use `validation_alias` to only affect input (ORM attribute lookup) while keeping the Python field name as the output JSON key.

- **Do not overlook the `TargetResponse` missing `school_name` class of bug**: When a frontend page renders a field that comes from a related ORM object (not a column on the join table), the schema must explicitly include it and the route must populate it from the SQLAlchemy relationship. FastAPI/Pydantic `from_attributes=True` does not automatically traverse relationships.

- **Do not trust agent-generated SQL without verifying table names**: The singular/plural table name mismatch is a recurring issue. `INSERT INTO subject` will silently fail if the table is named `subjects`. Always grep `__tablename__` values before checking seed SQL.

- **Do not assume the HTTP method in a frontend API file matches what was written for the backend route**: Agents can write the frontend and backend in separate passes. `PUT` vs `PATCH` and wrong URL paths are common divergences. Always cross-check.

### Patterns to reuse

- **Integration validation pipeline order**: (1) Read manifests → (2) Read architecture contracts → (3) Read backend models → (4) Read backend routes → (5) Check schemas directory → (6) Run tests → (7) Read frontend API files → (8) Read frontend pages → (9) Check docker/infra → (10) Check migrations + seeds → (11) Fix all issues → (12) Re-run tests → (13) Write report.

- **Test re-run as a fix verification gate**: After every fix batch, re-run `pytest` before writing the final report. This prevents shipping a report that says PASSED when a fix introduced a regression.

- **`validation_alias` pattern for ORM→schema ID mapping**:
  ```python
  class PlanStatusResponse(BaseModel):
      job_id: UUID = Field(validation_alias="id")
      model_config = {"from_attributes": True, "populate_by_name": True}
  ```
  This lets FastAPI serialize ORM objects directly without a manual adapter layer.

- **School name enrichment pattern in list routes**: When a list endpoint returns rows from a join table (e.g., StudentSchoolTarget) and the frontend needs related fields (school.name), populate them explicitly in the route handler:
  ```python
  resp = TargetResponse.model_validate(t)
  if t.school is not None:
      resp.school_name = t.school.name
  ```

- **Docker-compose upload volume pattern**:
  ```yaml
  backend:
    environment:
      UPLOAD_DIR: /app/uploads
    volumes:
      - uploads:/app/uploads
  volumes:
    uploads:
  ```
  Always pair the env var with the actual volume mount.

- **Frontend Dockerfile VITE build arg pattern**:
  ```dockerfile
  ARG VITE_API_BASE_URL=http://backend:8000
  ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
  ```
  The `ENV` line is required — Vite reads from `process.env` at build time, not from Docker ARG directly.
