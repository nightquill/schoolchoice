# Agent Packet: Integration Engineer
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27

---

## Scope

This packet contains every requirement in the [INTEGRATION] domain. The Integration Engineer is responsible for verifying and validating that all system tiers work together end-to-end to satisfy the complete counselor workflow. This role is step 5 of 5 in the prescribed build order and is therefore the last agent to act on MVP deliverables.

---

## Owned Requirements

### REQ-040 [INTEGRATION]
**Description:** The full counselor workflow must be completable end-to-end: input a student, trigger generation, and receive a ranked school list, explanation, and action plan in a single session.
**Source:** preferences.md §9
**Priority:** Must Have

---

### REQ-041 [INTEGRATION]
**Description:** The system must not support real-time collaboration between multiple simultaneous users in MVP.
**Source:** preferences.md §7
**Priority:** Must Have (constraint / exclusion)

---

### REQ-042 [INTEGRATION]
**Description:** Development must follow the prescribed build order: (1) Database schema, (2) Backend API, (3) Matching logic, (4) Frontend UI, (5) Integration.
**Source:** preferences.md §10
**Priority:** Must Have (process constraint)

---

## End-to-End Workflow to Validate (REQ-040)

The Integration Engineer must verify that the following complete workflow executes correctly across all three tiers:

1. Counselor navigates to the Login page and authenticates with email and password (REQ-031, REQ-010)
2. Counselor is presented with the Student List page (REQ-032, REQ-015)
3. Counselor creates or selects a student and views/edits the student profile (REQ-033, REQ-012, REQ-013, REQ-014)
4. Counselor triggers the "Generate" action for the student (REQ-035)
5. Backend receives the trigger, runs the matching engine (filter → score → rank), and returns the top 5 schools with scores, explanations, and gaps (REQ-016 through REQ-020)
6. Backend also generates and returns the action plan (REQ-021, REQ-022)
7. Frontend displays the Recommendation page with all required fields (REQ-034, REQ-037, REQ-038)

This workflow must complete successfully in a single session without errors.

---

## Cross-Tier Data Flow to Verify

| Step | From | To | Data |
|---|---|---|---|
| Login | Frontend | Backend | Email, password → session/token |
| Student list | Frontend | Backend | Authenticated request → student list |
| Student create/edit | Frontend | Backend | Student fields → confirmation |
| Generate trigger | Frontend | Backend | Student ID → recommendation result |
| Recommendation result | Backend | Frontend | Schools (name, score, explanation, gaps) + action plan |
| All backend reads/writes | Backend | Database | Via SQL through ORM/driver only |

---

## Tier Boundary Rules (REQ-003)

The Integration Engineer must confirm that:
- The frontend never accesses the database directly
- The backend is the only service that reads from or writes to the database
- All frontend-to-backend communication uses the Backend API endpoints

---

## Exclusion Verification

The Integration Engineer must confirm that the following are absent from the integrated system:

| Excluded Feature | Source REQ-ID |
|---|---|
| Machine learning inference calls | REQ-008 |
| External API calls (UCAS, JUPAS, etc.) | REQ-023 |
| Real-time collaboration / WebSocket connections | REQ-041 |
| Role-based access control | REQ-011 |
| Mobile or desktop application code | REQ-001 |
| Timeline engine or scheduling logic | REQ-022 |
| Weight-tuning UI | REQ-018 |

---

## Build Order Gate (REQ-042)

Integration work begins only after all of the following are complete and approved by PM:

| Step | Deliverable | Owner |
|---|---|---|
| 1 | Database schema | Database Engineer |
| 2 | Backend API (endpoints) | Backend Engineer |
| 3 | Matching logic | Backend Engineer |
| 4 | Frontend UI | Frontend Engineer |
| 5 | Integration validation | Integration Engineer |

---

## Non-Goals for This Agent

- Do not write application code, SQL, or React components
- Do not introduce features not present in any upstream deliverable
- Do not design the UI or the database schema

---

## Deliverable Expected from This Agent

- An integration validation report confirming REQ-040 is satisfied
- Identification of any gaps or mismatches between tiers
- Confirmation that all exclusions in REQ-041 and the Non-Goals sections of other packets are observed in the running system

---
*Packet issued by PM — do not modify REQ-IDs or descriptions.*
