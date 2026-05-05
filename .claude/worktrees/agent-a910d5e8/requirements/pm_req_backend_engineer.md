# Agent Packet: Backend Engineer
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27

---

## Scope

This packet contains every requirement in the [BACKEND] domain. The Backend Engineer is responsible for the FastAPI (Python) application, including authentication, all API endpoints, the matching engine, recommendation generation, and action plan generation. The Backend Engineer does not design the database schema or write frontend code.

---

## Owned Requirements

### REQ-010 [BACKEND]
**Description:** The backend must implement email-and-password authentication for counselor login.
**Source:** preferences.md §5.1
**Priority:** Must Have

---

### REQ-011 [BACKEND]
**Description:** Authentication must not include OAuth, social login, or role-based access control in MVP.
**Source:** preferences.md §5.1, §7
**Priority:** Must Have (constraint / exclusion)

---

### REQ-012 [BACKEND]
**Description:** The backend must expose an API endpoint to create a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

### REQ-013 [BACKEND]
**Description:** The backend must expose an API endpoint to edit (update) a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

### REQ-014 [BACKEND]
**Description:** The backend must expose an API endpoint to retrieve (view) a student profile.
**Source:** preferences.md §5.2
**Priority:** Must Have

---

### REQ-015 [BACKEND]
**Description:** The backend must expose an API endpoint to list all student profiles managed by the authenticated user.
**Source:** preferences.md §5.7, §6
**Priority:** Must Have

---

### REQ-016 [BACKEND]
**Description:** The backend must implement a matching engine that first filters out schools where the student's grades do not meet the school's minimum academic requirements.
**Source:** preferences.md §5.4 Step 1
**Priority:** Must Have

---

### REQ-017 [BACKEND]
**Description:** The backend matching engine must score each remaining school using three factors: grade match, interest alignment, and school-strengths alignment.
**Source:** preferences.md §5.4 Step 2
**Priority:** Must Have

---

### REQ-018 [BACKEND]
**Description:** Scoring weights for the three matching factors must be fixed values in MVP; no user-facing weight-tuning interface is required.
**Source:** preferences.md §5.4 Step 2
**Priority:** Must Have (constraint)

---

### REQ-019 [BACKEND]
**Description:** The backend must rank schools by score in descending order and return the top 5 results.
**Source:** preferences.md §5.4 Step 3
**Priority:** Must Have

---

### REQ-020 [BACKEND]
**Description:** The backend must generate a recommendation record for each top-ranked school that includes: school name, score, explanation of why it matches (which factors contributed), and identified gaps (what the student is missing).
**Source:** preferences.md §5.5
**Priority:** Must Have

---

### REQ-021 [BACKEND]
**Description:** The backend must generate an action plan for a student that includes: academic targets, suggested extracurricular direction, and general preparation steps.
**Source:** preferences.md §5.6
**Priority:** Must Have

---

### REQ-022 [BACKEND]
**Description:** Action plan output must be plain text. No timeline engine or structured scheduling logic is required.
**Source:** preferences.md §5.6
**Priority:** Must Have (constraint)

---

### REQ-023 [BACKEND]
**Description:** The backend must not integrate with any external systems or third-party APIs (e.g., UCAS, JUPAS) in MVP.
**Source:** preferences.md §5.3, §7
**Priority:** Must Have (constraint / exclusion)

---

## Architectural Constraints to Observe

| REQ-ID | Constraint |
|---|---|
| REQ-003 | Backend is the sole intermediary between frontend and database; no direct DB access from frontend |
| REQ-005 | FastAPI (Python) is the mandated framework |
| REQ-007 | Backend modules must be structured to allow the matching engine to be swapped or extended (e.g., for future ML scoring) without rewriting the API layer |
| REQ-008 | Rule-based logic only in the matching engine; no ML models |
| REQ-009 | Recommendation output must be transparent and interpretable; the engine must expose which factors contributed to each score |

---

## Matching Engine Summary (REQ-016 through REQ-019)

The engine operates in three steps:

**Step 1 — Filter:**
Remove any school from consideration where the student's grades do not satisfy the school's minimum academic requirements.

**Step 2 — Score:**
For each remaining school, compute a composite score using:
- Grade match
- Interest alignment
- School-strengths alignment
Weights are fixed; they do not need to be configurable.

**Step 3 — Rank:**
Sort scored schools in descending order. Return the top 5.

---

## Recommendation Output Fields (REQ-020)

Each recommendation record must carry:
- School name
- Numeric score
- Explanation: human-readable text describing which factors contributed positively
- Gaps: human-readable text describing where the student falls short of the school's profile

---

## Action Plan Fields (REQ-021, REQ-022)

The action plan is a plain-text output containing:
- Academic targets (e.g., improve performance in a subject)
- Suggested extracurricular direction
- General preparation steps

No date or timeline fields are required.

---

## Build Order Context (REQ-042)

The Backend API is step 2 of 5 in the prescribed build order. The Database schema (step 1) must be available before backend development begins. Matching logic (step 3) is a sub-phase of backend work.

---

## Non-Goals for This Agent

- Do not write React components or frontend code
- Do not design the PostgreSQL schema (that is the Database Engineer's deliverable)
- Do not implement OAuth, social login, or role-based access control
- Do not call any external APIs or data feeds
- Do not implement a timeline engine or scheduling logic
- Do not build a weight-tuning UI or expose scoring weights via API

---

## Deliverable Expected from This Agent

- API contract (endpoint list, request/response shapes) — to be approved by PM before implementation
- Implementation of all endpoints listed in REQ-012 through REQ-015 and the generate workflow (REQ-016 through REQ-022)
- Authentication implementation satisfying REQ-010 and REQ-011

---
*Packet issued by PM — do not modify REQ-IDs or descriptions.*
