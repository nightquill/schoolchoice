# PM Master Requirements Register
# Intelligent Academic Advisor — MVP
# Parsed from: preferences.md
# Date: 2026-03-27
# Status: BASELINE

---

## Legend

| Domain Tag | Meaning |
|---|---|
| [ARCH] | System architecture and structural constraints |
| [BACKEND] | FastAPI / Python server-side logic |
| [DATABASE] | PostgreSQL schema and data persistence |
| [FRONTEND] | React client-side application |
| [UI] | Page layout, user interaction, and display requirements |
| [INTEGRATION] | Wiring between layers; end-to-end workflow |

---

## REQ-001 [ARCH]
**Description:** The system must be a web-based internal tool (not a mobile or desktop application).
**Source:** preferences.md §1, §7
**Priority:** Must Have

---

## REQ-002 [ARCH]
**Description:** The system is decision-support only; it must not automate decisions on behalf of users.
**Source:** preferences.md §1
**Priority:** Must Have

---

## REQ-003 [ARCH]
**Description:** The system must follow a three-tier architecture: Frontend → Backend API → Database. No tier may bypass an intermediate tier.
**Source:** preferences.md §4
**Priority:** Must Have

---

## REQ-004 [ARCH]
**Description:** The frontend must be implemented in React.
**Source:** preferences.md §4
**Priority:** Must Have

---

## REQ-005 [ARCH]
**Description:** The backend must be implemented with FastAPI (Python).
**Source:** preferences.md §4
**Priority:** Must Have

---

## REQ-006 [ARCH]
**Description:** The database must be PostgreSQL.
**Source:** preferences.md §4
**Priority:** Must Have

---

## REQ-007 [ARCH]
**Description:** The architecture must be modular and extensible to allow future addition of ML-based scoring, multi-agent reasoning, external system integration, and advanced planning tools, without requiring a rewrite of MVP components.
**Source:** preferences.md §3, §8
**Priority:** Should Have (design constraint)

---

## REQ-008 [ARCH]
**Description:** The matching engine must use rule-based logic only. No machine learning models may be introduced in MVP.
**Source:** preferences.md §3, §7
**Priority:** Must Have

---

## REQ-009 [ARCH]
**Description:** The system must produce transparent, interpretable outputs. Black-box outputs are not acceptable.
**Source:** preferences.md §3
**Priority:** Must Have

---

## REQ-010 [BACKEND]
**Description:** The backend must implement email-and-password authentication for counselor login.
**Source:** preferences.md §5.1
**Priority:** Must Have

---

## REQ-011 [BACKEND]
**Description:** Authentication must not include OAuth, social login, or role-based access control in MVP.
**Source:** preferences.md §5.1, §7
**Priority:** Must Have (constraint / exclusion)

---

## REQ-012 [BACKEND]
**Description:** The backend must expose an API endpoint to create a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

## REQ-013 [BACKEND]
**Description:** The backend must expose an API endpoint to edit (update) a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

## REQ-014 [BACKEND]
**Description:** The backend must expose an API endpoint to retrieve (view) a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

## REQ-015 [BACKEND]
**Description:** The backend must expose an API endpoint to list all student profiles managed by the authenticated user.
**Source:** preferences.md §5.7 (Student list page implies list retrieval), §6
**Priority:** Must Have

---

## REQ-016 [BACKEND]
**Description:** The backend must implement a matching engine that first filters out schools where the student's grades do not meet the school's minimum academic requirements.
**Source:** preferences.md §5.4 Step 1
**Priority:** Must Have

---

## REQ-017 [BACKEND]
**Description:** The backend matching engine must score each remaining school using three factors: grade match, interest alignment, and school-strengths alignment.
**Source:** preferences.md §5.4 Step 2
**Priority:** Must Have

---

## REQ-018 [BACKEND]
**Description:** Scoring weights for the three matching factors must be fixed values in MVP; no user-facing weight-tuning interface is required.
**Source:** preferences.md §5.4 Step 2
**Priority:** Must Have (constraint)

---

## REQ-019 [BACKEND]
**Description:** The backend must rank schools by score in descending order and return the top 5 results.
**Source:** preferences.md §5.4 Step 3
**Priority:** Must Have

---

## REQ-020 [BACKEND]
**Description:** The backend must generate a recommendation record for each top-ranked school that includes: school name, score, explanation of why it matches (which factors contributed), and identified gaps (what the student is missing).
**Source:** preferences.md §5.5
**Priority:** Must Have

---

## REQ-021 [BACKEND]
**Description:** The backend must generate an action plan for a student that includes: academic targets, suggested extracurricular direction, and general preparation steps.
**Source:** preferences.md §5.6
**Priority:** Must Have

---

## REQ-022 [BACKEND]
**Description:** Action plan output must be plain text. No timeline engine or structured scheduling logic is required.
**Source:** preferences.md §5.6
**Priority:** Must Have (constraint)

---

## REQ-023 [BACKEND]
**Description:** The backend must not integrate with any external systems or third-party APIs (e.g., UCAS, JUPAS) in MVP.
**Source:** preferences.md §5.3, §7
**Priority:** Must Have (constraint / exclusion)

---

## REQ-024 [DATABASE]
**Description:** The database must store a Users entity to represent authenticated counselors.
**Source:** preferences.md §6
**Priority:** Must Have

---

## REQ-025 [DATABASE]
**Description:** The database must store a Students entity with the following fields: name, grades by subject, interests (list or tags), strengths/weaknesses (text), and target region (local or international).
**Source:** preferences.md §5.2, §6
**Priority:** Must Have

---

## REQ-026 [DATABASE]
**Description:** The database must store a Schools entity with the following fields: name, location, minimum academic requirements, key strengths (e.g., STEM, arts), and notes (free text).
**Source:** preferences.md §5.3, §6
**Priority:** Must Have

---

## REQ-027 [DATABASE]
**Description:** The database must store a Recommendations entity that links a student to a school and persists the recommendation output (score, explanation, gaps).
**Source:** preferences.md §5.5, §6
**Priority:** Must Have

---

## REQ-028 [DATABASE]
**Description:** The database must enforce a one-to-many relationship: a single user may manage multiple students.
**Source:** preferences.md §6
**Priority:** Must Have

---

## REQ-029 [DATABASE]
**Description:** The database must enforce a one-to-many relationship: a single student may have multiple recommendation records.
**Source:** preferences.md §6
**Priority:** Must Have

---

## REQ-030 [DATABASE]
**Description:** School data must be stored and managed entirely within the system's own database. No external school data feed is required.
**Source:** preferences.md §5.3
**Priority:** Must Have

---

## REQ-031 [FRONTEND]
**Description:** The frontend must provide a Login page where counselors submit email and password credentials.
**Source:** preferences.md §5.1, §5.7
**Priority:** Must Have

---

## REQ-032 [FRONTEND]
**Description:** The frontend must provide a Student List page that displays all students managed by the logged-in counselor.
**Source:** preferences.md §5.7
**Priority:** Must Have

---

## REQ-033 [FRONTEND]
**Description:** The frontend must provide a Student Detail page that displays a student's profile fields and allows editing.
**Source:** preferences.md §5.2, §5.7
**Priority:** Must Have

---

## REQ-034 [FRONTEND]
**Description:** The frontend must provide a Recommendation page that displays the ranked school list, scores, explanations, gaps, and action plan for a selected student.
**Source:** preferences.md §5.5, §5.6, §5.7
**Priority:** Must Have

---

## REQ-035 [FRONTEND]
**Description:** The frontend must include a mechanism (e.g., a "Generate" button) that triggers the matching and recommendation generation workflow for a student.
**Source:** preferences.md §9
**Priority:** Must Have

---

## REQ-036 [UI]
**Description:** The UI must have a clear layout. Minimal styling is acceptable; visual complexity must be avoided.
**Source:** preferences.md §5.7
**Priority:** Must Have

---

## REQ-037 [UI]
**Description:** Each recommendation displayed in the UI must show: school name, score, the reasons it matches the student, and the gaps identified for that student.
**Source:** preferences.md §5.5
**Priority:** Must Have

---

## REQ-038 [UI]
**Description:** The Recommendation page must display the action plan output (academic targets, extracurricular direction, preparation steps) alongside the school recommendations.
**Source:** preferences.md §5.6, §5.7
**Priority:** Must Have

---

## REQ-039 [UI]
**Description:** The system must not implement a complex UI/UX system (e.g., animations, advanced component libraries, design systems) in MVP.
**Source:** preferences.md §7
**Priority:** Must Have (constraint / exclusion)

---

## REQ-040 [INTEGRATION]
**Description:** The full counselor workflow must be completable end-to-end: input a student, trigger generation, and receive a ranked school list, explanation, and action plan in a single session.
**Source:** preferences.md §9
**Priority:** Must Have

---

## REQ-041 [INTEGRATION]
**Description:** The system must not support real-time collaboration between multiple simultaneous users in MVP.
**Source:** preferences.md §7
**Priority:** Must Have (constraint / exclusion)

---

## REQ-042 [INTEGRATION]
**Description:** Development must follow the prescribed build order: (1) Database schema, (2) Backend API, (3) Matching logic, (4) Frontend UI, (5) Integration.
**Source:** preferences.md §10
**Priority:** Must Have (process constraint)

---

---
*End of Master Requirements Register — 42 requirements baseline.*
