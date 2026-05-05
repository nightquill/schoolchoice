# Agent Packet: Frontend Engineer
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27

---

## Scope

This packet contains every requirement in the [FRONTEND] domain. The Frontend Engineer is responsible for building the React client application. The Frontend Engineer works from the UI Designer's approved wireframes and the Backend Engineer's approved API contract. No database work or backend logic falls within this scope.

---

## Owned Requirements

### REQ-031 [FRONTEND]
**Description:** The frontend must provide a Login page where counselors submit email and password credentials.
**Source:** preferences.md §5.1, §5.7
**Priority:** Must Have

---

### REQ-032 [FRONTEND]
**Description:** The frontend must provide a Student List page that displays all students managed by the logged-in counselor.
**Source:** preferences.md §5.7
**Priority:** Must Have

---

### REQ-033 [FRONTEND]
**Description:** The frontend must provide a Student Detail page that displays a student's profile fields and allows editing.
**Source:** preferences.md §5.2, §5.7
**Priority:** Must Have

---

### REQ-034 [FRONTEND]
**Description:** The frontend must provide a Recommendation page that displays the ranked school list, scores, explanations, gaps, and action plan for a selected student.
**Source:** preferences.md §5.5, §5.6, §5.7
**Priority:** Must Have

---

### REQ-035 [FRONTEND]
**Description:** The frontend must include a mechanism (e.g., a "Generate" button) that triggers the matching and recommendation generation workflow for a student.
**Source:** preferences.md §9
**Priority:** Must Have

---

## UI Requirements the Frontend Must Implement (from [UI])

| REQ-ID | Requirement |
|---|---|
| REQ-036 | Clear layout, minimal styling, no visual complexity |
| REQ-037 | Recommendation display must include: school name, score, match explanation, gaps |
| REQ-038 | Recommendation page must also display the action plan (academic targets, extracurricular direction, preparation steps) |
| REQ-039 | No animations, no advanced component libraries, no design system complexity |

---

## Page Summary

### Page 1 — Login (REQ-031)
- Accepts email and password input
- Submits credentials to the backend auth endpoint
- Redirects to Student List on successful login

### Page 2 — Student List (REQ-032)
- Displays all students associated with the logged-in counselor
- Provides navigation to each student's detail page
- Provides a mechanism to create a new student profile

### Page 3 — Student Detail (REQ-033)
- Displays the following student fields: name, grades by subject, interests, strengths/weaknesses, target region
- Allows editing and saving each of these fields
- Provides access to trigger recommendation generation for this student (REQ-035)

### Page 4 — Recommendation (REQ-034, REQ-037, REQ-038)
- Displays up to 5 recommended schools, sorted by score (descending)
- For each school: name, score, explanation (factors that matched), gaps (what the student is missing)
- Displays the action plan: academic targets, extracurricular direction, general preparation steps

---

## Architectural Constraints to Observe

| REQ-ID | Constraint |
|---|---|
| REQ-003 | Frontend communicates exclusively with the Backend API; never directly with the database |
| REQ-004 | React is the mandated frontend framework |
| REQ-007 | Frontend component structure should not tightly couple to backend data shapes in a way that blocks future extension |
| REQ-009 | Outputs must be displayed transparently; no summarizing or hiding of explanation/gap data |

---

## Build Order Context (REQ-042)

Frontend UI is step 4 of 5 in the prescribed build order. The Backend API contract (step 2) and approved UI wireframes must be available before frontend implementation begins.

---

## Non-Goals for This Agent

- Do not implement backend logic or database queries
- Do not introduce OAuth, role switching, or any auth method beyond email/password flow
- Do not build a weight-tuning UI for the matching engine
- Do not build a timeline or scheduling interface
- Do not design for mobile or desktop native environments
- Do not introduce real-time features (websockets, live updates)
- Do not add pages beyond the four listed above

---

## Deliverable Expected from This Agent

- A React application implementing the four required pages
- Pages must satisfy the UI requirements in REQ-036 through REQ-039
- All API calls must route through the Backend API (REQ-003)
- Implementation must follow the approved wireframes from the UI Designer before build begins

---
*Packet issued by PM — do not modify REQ-IDs or descriptions.*
