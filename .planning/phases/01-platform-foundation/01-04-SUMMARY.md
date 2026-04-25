---
phase: 01-platform-foundation
plan: "04"
subsystem: school_choice module models
tags: [orm, models, module-extraction, strangler-fig, backward-compatibility]
dependency_graph:
  requires: [01-02, 01-03]
  provides: [domain-models-in-module, module-manifest]
  affects: [app.db.models, app.db.models_v2, app.modules.school_choice]
tech_stack:
  added: []
  patterns: [re-export-stub, circular-import-guard, module-manifest-yaml]
key_files:
  created:
    - backend/app/modules/school_choice/models/__init__.py
    - backend/app/modules/school_choice/models/models.py
    - backend/app/modules/school_choice/config.yaml
    - backend/app/modules/school_choice/routes/__init__.py
  modified:
    - backend/app/db/models.py
    - backend/app/db/models_v2.py
decisions:
  - "Re-exports at bottom of models.py resolve circular import for models.py-first import order"
  - "models_v2.py imports app.db.models first as circular import guard for direct-import scenarios"
metrics:
  duration_seconds: 401
  completed: "2026-04-25T04:16:00Z"
---

# Phase 1 Plan 4: Domain Model Extraction Summary

Extracted 14 domain ORM models from monolithic db/models.py and db/models_v2.py into app.modules.school_choice.models.models, with re-export stubs at both original paths preserving all 115 existing test imports without modification.

## What Was Done

### Task 1: Move domain models to school_choice module with re-export stubs
- **Commit:** 7847a29
- Created `backend/app/modules/school_choice/models/models.py` containing all 14 domain models (Student, School, Recommendation, ActionPlan, GradeSystem, Subject, StudentSubjectGrade, Transcript, StudentSchoolTarget, PlanGenerationJob, AcademicPlan, StudentCohort, CohortMembership, PlanHistory)
- Trimmed `backend/app/db/models.py` to platform-only (Base, _utcnow, User) with re-export stubs at the bottom
- Converted `backend/app/db/models_v2.py` to a pure re-export stub with a circular import guard
- All 115 tests pass without any test file modifications

### Task 2: Create school_choice module config.yaml manifest
- **Commit:** e88da95
- Created `backend/app/modules/school_choice/config.yaml` with name, version, models_import, entities, empty routes, and health_callback
- Created `backend/app/modules/school_choice/routes/__init__.py` as placeholder for Plan 05/06 migration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Circular import when models_v2 imported before models**
- **Found during:** Task 1 verification
- **Issue:** Direct `from app.db.models_v2 import AcademicPlan` triggered a circular import because models_v2 -> school_choice.models.models -> app.db.models -> school_choice.models.models (partially initialized)
- **Fix:** Added `import app.db.models as _platform_models` at the top of models_v2.py to ensure Base/User are fully loaded before the school_choice module is imported. This matches the plan's anticipated mitigation (T-04-02).
- **Files modified:** backend/app/db/models_v2.py
- **Commit:** 7847a29

## Verification Results

1. `python -m pytest tests/ -x -q` -- 115 passed
2. `from app.db.models import Student; Student.__module__` -- returns `app.modules.school_choice.models.models`
3. `from app.db.models_v2 import AcademicPlan; AcademicPlan.__module__` -- returns `app.modules.school_choice.models.models`
4. `grep "class Student" backend/app/db/models.py` -- no match (definition removed)
5. `grep "class Student" backend/app/modules/school_choice/models/models.py` -- match found
6. config.yaml parses correctly with name=school_choice, 2 entities, health callback present

## Known Stubs

None -- all models are fully functional, not stubbed.

## Self-Check: PASSED
