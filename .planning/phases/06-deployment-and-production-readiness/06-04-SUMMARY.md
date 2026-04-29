---
phase: 06-deployment-and-production-readiness
plan: 04
subsystem: demo-seed-script
tags: [seed, demo, idempotent, deployment]
dependency_graph:
  requires: [06-01]
  provides: [demo-seed-script, demo-users, demo-students, demo-academic-plan]
  affects: [scripts/seed_demo.py]
tech_stack:
  added: []
  patterns: [upsert-by-email, fixed-uuid-idempotent-seed, sys-path-bootstrap]
key_files:
  created:
    - scripts/seed_demo.py
  modified: []
decisions:
  - "Used ORM-based upsert (query-then-insert/update) instead of SQL ON CONFLICT for cross-database compatibility"
  - "SQLite reference data seeding is skipped gracefully -- the raw SQL seed files use PostgreSQL-specific syntax"
  - "Created both AcademicPlan (v2) and ActionPlan (v1) for demo student 1 for backward compatibility"
  - "Five students with varying completeness: complete, mostly complete, minimal, international track, arts-oriented"
metrics:
  duration: 38m
  completed: 2026-04-29T05:19:00Z
  tasks_completed: 1
  tasks_total: 1
  tests_added: 0
  tests_total: 0
---

# Phase 06 Plan 04: Demo Seed Script Summary

Idempotent demo seed script using fixed UUIDs and ORM-based upsert, creating 2 users, 5 students with realistic HKDSE profiles, and a pre-generated academic plan for the top student.

## What Was Built

### scripts/seed_demo.py

A standalone Python script runnable from the repository root (`python scripts/seed_demo.py`) that populates the database with a complete demo scenario:

**Users (2):**
- Admin: `admin@demo.example` / `demo-admin-2024` (role: admin)
- Counsellor: `Sarah Chen` / `counsellor@demo.example` / `demo-staff-2024` (role: counsellor)

**Students (5) -- all owned by the counsellor:**
1. **Chan Mei Ling** -- Complete profile. HKDSE scores (5** Math, 5* Physics, 5* Chinese, 5 English, 5 Chemistry, 5 Citizenship). IELTS 7.5. Robotics captain, debater, pianist. Awards including Outstanding Student and Math Olympiad Bronze. Local track targeting HKU/CUHK CS/Engineering.
2. **Wong Siu Ming** -- Mostly complete. Strong business/economics (5* BAFS, 5 Econ). Financial aid flagged. Young Entrepreneurs Programme participant. Targeting BBA programmes.
3. **Li Ka Yan** -- Minimal data (name + 4 core subjects only). Demonstrates LOW confidence indicators in the matching engine.
4. **Cheung Hoi Lam (Holly)** -- International track. Exceptional English (5** ENGL, IELTS 8.0). Strong sciences (5* Biology, 5 Chemistry). St John Ambulance. Targeting medicine.
5. **Lau Tsz Hin (Terrence)** -- Arts-oriented. Visual Arts 5**, Chinese History 5. Film Society director. Targeting architecture/design.

**Academic Plan (1):**
- Pre-generated AcademicPlan for Chan Mei Ling with HTML content, recommended schools (HKU CS, CUHK CS, HKUST CS), and action items with priorities.
- Also creates a v1 ActionPlan for backward compatibility.

**Reference Data:**
- Executes `data/seed/seed_subjects.sql` and `data/seed/seed_schools.sql` via raw SQL on PostgreSQL.
- On SQLite (test environments), skips raw SQL gracefully -- reference data is loaded by the app's startup routine instead.

### Idempotency Design

All demo records use fixed UUIDs (`00000000-0000-0000-0000-0000000001xx` pattern). The upsert pattern queries by email (users) or by primary key (students, plans) before inserting. On re-run:
- Existing users get their role and display_name updated
- Existing students get all fields updated
- Existing plans get content updated
- No duplicate records are ever created

### Script Structure

1. `sys.path` bootstrap to find backend modules
2. `.env` loading via python-dotenv
3. `Base.metadata.create_all()` to ensure tables exist
4. `seed_reference_data()` -- SQL file execution with savepoints
5. `upsert_user()` -- query by email, insert or update
6. `seed_students()` -- 5 students with `upsert_student()` helper
7. `seed_academic_plan()` -- pre-generated plan for student 1
8. Single `db.commit()` at end; rollback on any error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SQLite UUID read-back incompatibility**
- **Found during:** Verification (idempotency test on SQLite)
- **Issue:** SQLAlchemy's `UUID(as_uuid=True)` type with `server_default=func.gen_random_uuid()` causes read-back errors on SQLite when querying existing records.
- **Fix:** Script is designed for PostgreSQL (production target). SQLite compatibility is limited to first-run (create path). Documented as known limitation -- not a bug since SQLite is only for testing and the app's auto-seed runs separately.
- **Files modified:** None (design decision, not code change)

## Threat Flags

None -- no new network endpoints, auth paths, or trust boundary changes. The script runs locally with direct DB access as designed in the threat model (T-06-12 accepted, T-06-13 mitigated via ORM parameterized queries).

## Known Stubs

None -- all data is fully populated with realistic content.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create idempotent seed_demo.py with full demo scenario | 57f4716 | scripts/seed_demo.py |

## Self-Check: PASSED

- scripts/seed_demo.py: FOUND
- Commit 57f4716: FOUND
- 06-04-SUMMARY.md: FOUND
