# PM → System Architect — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

You are building v2 on top of a completed v1. The following are already implemented and must not be re-designed unless a v2 requirement explicitly changes them:
- Three-tier architecture (React → FastAPI → PostgreSQL)
- Docker Compose + Dockerfiles
- Basic auth (JWT, email+password)
- Basic Student / School / Recommendation entities

Your role in v2 is to:
1. Design the architecture extensions required by the new entities and features
2. Define the async task architecture for plan generation and transcript parsing
3. Author the encryption ADR
4. Extend API contracts to cover all new endpoints
5. Update the skills/system-architect.md file after completing this work

---

## Owned Requirements (v2)

### REQ-043 [ARCH] — Skills Development Protocol
Every agent must maintain `skills/<agent-name>.md`. You must create and maintain `skills/system-architect.md`. Document architectural decisions, patterns discovered, and domain knowledge (e.g. async task patterns in FastAPI, PostgreSQL JSONB indexing decisions).

### REQ-045 [ARCH] — Multi-Grade-System Support
Design the architecture to support GradeSystem, Subject, StudentSubjectGrade, and Transcript as first-class entities. HKDSE is the only fully implemented path; A-Level, IB, Custom must be structurally present.

### REQ-046 [ARCH] — ML Module Boundary
Define the module boundary for the ML matchmaking service (XGBoost + SHAP). It must live entirely within the backend. Design the interface contract: input (student features), output (fit_score, ml_probability, shap_values dict). The module must be swappable — a rule-only fallback must exist for when the ML model is not trained.

### REQ-047 [ARCH] — Counsellor Role
Design role-based access control (RBAC) for the Counsellor role. Counsellors may access all student profiles. Define how roles are stored (account.role field) and how the backend enforces them.

### REQ-048 [ARCH] — Admin Role
Design the Admin role. Admin accounts may trigger data-agent refresh via a protected endpoint. Define the admin-only route guard pattern.

### REQ-049 [ARCH] — Performance SLA
Document in the architecture spec: all read API responses ≤500ms. Plan generation and transcript parsing are exempt (background tasks). Define the background task pattern (FastAPI BackgroundTasks or Celery — justify the choice in an ADR given the Docker Compose constraint).

### REQ-050 [ARCH] — Data Encryption ADR
Author an ADR evaluating PostgreSQL column-level encryption vs. full-disk encryption for sensitive student fields (PII: date_of_birth, phone, address, email). Recommend one approach and document the trade-offs. Store as `architecture/adr_encryption.md`.

### REQ-051 [ARCH] — WCAG AA
Document in the architecture spec that all frontend components must target WCAG AA. Reference this in the UI designer's interface contract.

### REQ-052 [ARCH] — Mobile Responsive
Document mobile-responsive layout requirement in the architecture spec. All pages must be usable on a 375px viewport.

---

## Extended API Contracts to Define (v2 additions)

The following new endpoint groups must be added to `architecture/api_contracts.md`:

| Group | Endpoints |
|---|---|
| StudentSubjectGrade | POST, GET (by student), PATCH, DELETE |
| Transcript | POST (upload + async parse), GET (suggestions) |
| StudentSchoolTarget | POST, GET (by student), PATCH (rank + status), DELETE |
| School Directory | GET /schools (search + filter) |
| School Profile | GET /schools/{id} |
| Academic Plan | POST /students/{id}/plan (trigger), GET /students/{id}/plan/status (poll), GET /students/{id}/plan (HTML) |
| Account Settings | GET /account, PATCH /account, POST /account/change-password, DELETE /account |
| Admin Data Refresh | POST /admin/data-refresh (admin-only) |

---

## Deliverables

- `architecture/api_contracts_v2.md` — new endpoint contracts
- `architecture/adr_encryption.md` — encryption ADR
- `architecture/adr_async_tasks.md` — background task pattern ADR
- `architecture/data_flow_v2.md` — updated data flow including async flows
- `skills/system-architect.md` — skills file (create or append)

---
*Packet owner: System Architect. All items PENDING.*
