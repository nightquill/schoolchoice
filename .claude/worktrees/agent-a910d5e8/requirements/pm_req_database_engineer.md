# Agent Packet: Database Engineer
# Intelligent Academic Advisor — MVP
# Issued by: PM (Requirements Authority)
# Date: 2026-03-27

---

## Scope

This packet contains every requirement in the [DATABASE] domain. The Database Engineer is responsible for the PostgreSQL schema and data persistence layer. No application code, API logic, or frontend work falls within this scope.

---

## Owned Requirements

### REQ-024 [DATABASE]
**Description:** The database must store a Users entity to represent authenticated counselors.
**Source:** preferences.md §6
**Priority:** Must Have

---

### REQ-025 [DATABASE]
**Description:** The database must store a Students entity with the following fields: name, grades by subject, interests (list or tags), strengths/weaknesses (text), and target region (local or international).
**Source:** preferences.md §5.2, §6
**Priority:** Must Have

---

### REQ-026 [DATABASE]
**Description:** The database must store a Schools entity with the following fields: name, location, minimum academic requirements, key strengths (e.g., STEM, arts), and notes (free text).
**Source:** preferences.md §5.3, §6
**Priority:** Must Have

---

### REQ-027 [DATABASE]
**Description:** The database must store a Recommendations entity that links a student to a school and persists the recommendation output (score, explanation, gaps).
**Source:** preferences.md §5.5, §6
**Priority:** Must Have

---

### REQ-028 [DATABASE]
**Description:** The database must enforce a one-to-many relationship: a single user may manage multiple students.
**Source:** preferences.md §6
**Priority:** Must Have

---

### REQ-029 [DATABASE]
**Description:** The database must enforce a one-to-many relationship: a single student may have multiple recommendation records.
**Source:** preferences.md §6
**Priority:** Must Have

---

### REQ-030 [DATABASE]
**Description:** School data must be stored and managed entirely within the system's own database. No external school data feed is required.
**Source:** preferences.md §5.3
**Priority:** Must Have

---

## Architectural Constraints to Observe

The Database Engineer must design the schema to satisfy the following constraints set by the System Architect and PM:

| REQ-ID | Constraint |
|---|---|
| REQ-006 | PostgreSQL is the mandated database engine |
| REQ-003 | The database is accessed only through the Backend API — never directly from the frontend |
| REQ-007 | Schema must be modular enough to accommodate future entities (e.g., ML scores, timelines) without breaking the MVP schema |
| REQ-023 | No external data feeds; all school data is internally managed |

---

## Entity Summary (from preferences.md)

Four top-level entities are required:

1. **Users** — counselors who log in and manage students
2. **Students** — profiles managed by a user; contain grades, interests, strengths/weaknesses, target region
3. **Schools** — the internal school catalog; contain name, location, minimum requirements, key strengths, notes
4. **Recommendations** — links a student to a school; stores score, explanation text, and gaps text

Relationships:
- User → Students: one-to-many
- Student → Recommendations: one-to-many
- Recommendation → School: many-to-one

---

## Non-Goals for This Agent

- Do not design API endpoints or application logic
- Do not integrate with external data sources
- Do not design a timeline or scheduling schema (not required in MVP)
- Do not implement role-based permission columns (no roles in MVP)

---

## Deliverable Expected from This Agent

- A schema design document (entity definitions, field types, relationships, constraints)
- The schema must be reviewable and approvable by PM before implementation begins
- Build order: Database schema is step 1 of 5 (REQ-042)

---
*Packet issued by PM — do not modify REQ-IDs or descriptions.*
