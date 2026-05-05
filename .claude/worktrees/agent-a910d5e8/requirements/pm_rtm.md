# Requirements Traceability Matrix (RTM)
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27
# Status of all items: PENDING

---

| REQ-ID | Description | Domain | Owner Agent | Status | Linked Deliverable |
|---|---|---|---|---|---|
| REQ-001 | System must be a web-based internal tool (not mobile or desktop) | ARCH | System Architect | PENDING | Architecture document |
| REQ-002 | System is decision-support only; must not automate decisions | ARCH | System Architect | PENDING | Architecture document |
| REQ-003 | Three-tier architecture: Frontend → Backend API → Database; no tier bypass | ARCH | System Architect | PENDING | Architecture document |
| REQ-004 | Frontend must be implemented in React | ARCH | System Architect | PENDING | Architecture document |
| REQ-005 | Backend must be implemented with FastAPI (Python) | ARCH | System Architect | PENDING | Architecture document |
| REQ-006 | Database must be PostgreSQL | ARCH | System Architect | PENDING | Architecture document |
| REQ-007 | Architecture must be modular and extensible for future ML, multi-agent, external integration, and advanced planning | ARCH | System Architect | PENDING | Architecture document |
| REQ-008 | Matching engine must use rule-based logic only; no ML in MVP | ARCH | System Architect | PENDING | Architecture document |
| REQ-009 | System must produce transparent, interpretable outputs; no black-box outputs | ARCH | System Architect | PENDING | Architecture document |
| REQ-010 | Backend must implement email-and-password authentication | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-011 | No OAuth, social login, or role-based access control in MVP | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-012 | Backend must expose an endpoint to create a student profile | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-013 | Backend must expose an endpoint to edit (update) a student profile | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-014 | Backend must expose an endpoint to retrieve (view) a student profile | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-015 | Backend must expose an endpoint to list all student profiles for the authenticated user | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-016 | Matching engine Step 1: filter schools where student grades do not meet minimum requirements | BACKEND | Backend Engineer | PENDING | Matching logic implementation |
| REQ-017 | Matching engine Step 2: score remaining schools on grade match, interest alignment, school-strengths alignment | BACKEND | Backend Engineer | PENDING | Matching logic implementation |
| REQ-018 | Scoring weights are fixed; no user-facing weight-tuning interface | BACKEND | Backend Engineer | PENDING | Matching logic implementation |
| REQ-019 | Matching engine Step 3: rank by score descending, return top 5 | BACKEND | Backend Engineer | PENDING | Matching logic implementation |
| REQ-020 | Generate a recommendation record per top school: name, score, explanation, gaps | BACKEND | Backend Engineer | PENDING | Recommendation output |
| REQ-021 | Generate an action plan: academic targets, extracurricular direction, preparation steps | BACKEND | Backend Engineer | PENDING | Action plan output |
| REQ-022 | Action plan output is plain text; no timeline engine required | BACKEND | Backend Engineer | PENDING | Action plan output |
| REQ-023 | No external API integrations (UCAS, JUPAS, etc.) in MVP | BACKEND | Backend Engineer | PENDING | Backend API implementation |
| REQ-024 | Database must store a Users entity | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-025 | Database must store a Students entity with required fields | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-026 | Database must store a Schools entity with required fields | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-027 | Database must store a Recommendations entity linking student to school with output fields | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-028 | One-to-many relationship: user manages multiple students | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-029 | One-to-many relationship: student has multiple recommendation records | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-030 | School data stored internally; no external school data feed | DATABASE | Database Engineer | PENDING | Database schema |
| REQ-031 | Frontend must provide a Login page for email/password submission | FRONTEND | Frontend Engineer | PENDING | React application |
| REQ-032 | Frontend must provide a Student List page | FRONTEND | Frontend Engineer | PENDING | React application |
| REQ-033 | Frontend must provide a Student Detail page (view and edit) | FRONTEND | Frontend Engineer | PENDING | React application |
| REQ-034 | Frontend must provide a Recommendation page (schools, scores, explanations, gaps, action plan) | FRONTEND | Frontend Engineer | PENDING | React application |
| REQ-035 | Frontend must include a "Generate" trigger mechanism for the matching workflow | FRONTEND | Frontend Engineer | PENDING | React application |
| REQ-036 | UI must have a clear layout; minimal styling; no visual complexity | UI | UI Designer | PENDING | Wireframes / layout specs |
| REQ-037 | Each recommendation must display: school name, score, match explanation, gaps | UI | UI Designer | PENDING | Wireframes / layout specs |
| REQ-038 | Recommendation page must display action plan alongside school recommendations | UI | UI Designer | PENDING | Wireframes / layout specs |
| REQ-039 | No animations, no advanced component libraries, no complex UX systems in MVP | UI | UI Designer | PENDING | Wireframes / layout specs |
| REQ-040 | Full counselor workflow must be completable end-to-end in a single session | INTEGRATION | Integration Engineer | PENDING | Integration validation report |
| REQ-041 | No real-time collaboration in MVP | INTEGRATION | Integration Engineer | PENDING | Integration validation report |
| REQ-042 | Development must follow prescribed build order: DB → API → Matching → Frontend → Integration | INTEGRATION | Integration Engineer | PENDING | Integration validation report |

---

*Total requirements: 42*
*All statuses are PENDING — pipeline starting 2026-03-27.*
