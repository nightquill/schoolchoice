---
phase: 06-deployment-and-production-readiness
plan: 01
subsystem: backend-rbac-and-startup-validation
tags: [rbac, security, admin-api, startup-validation, pydantic]
dependency_graph:
  requires: []
  provides: [require_role-dependency, admin-user-crud, startup-secret-validation]
  affects: [backend-app-core-dependencies, backend-app-core-config, backend-admin-routes]
tech_stack:
  added: []
  patterns: [require_role-factory, model-validator-startup-guard, admin-crud-with-soft-delete]
key_files:
  created:
    - backend/app/schemas/v2/admin_users.py
    - backend/tests/test_admin_users.py
    - backend/tests/test_startup_validation.py
  modified:
    - backend/app/core/dependencies.py
    - backend/app/core/config.py
    - backend/app/api/v1/routes/admin.py
decisions:
  - "Used UUID type for user_id path params (matching codebase convention) instead of str to fix SQLite compatibility"
  - "Kept _require_admin in admin.py alongside new require_role in dependencies.py — existing code unchanged"
metrics:
  duration: 9m
  completed: 2026-04-29T04:31:37Z
  tasks_completed: 3
  tasks_total: 3
  tests_added: 15
  tests_total: 228
---

# Phase 06 Plan 01: RBAC Enforcement, Admin User CRUD, and Startup Validation Summary

Reusable require_role() dependency factory, admin user management CRUD with soft-delete and self-delete prevention, and Pydantic model_validator startup guard rejecting placeholder secrets.

## What Was Built

### require_role() Dependency Factory
Added to `backend/app/core/dependencies.py` -- a factory function that returns a FastAPI `Depends()` callable enforcing any given role. Used as `Depends(require_role("admin"))` on all new admin user endpoints.

### Startup Validation
Added `_FORBIDDEN_SECRET_KEYS` set and `@model_validator(mode="after")` to `Settings` class in `backend/app/core/config.py`. The app refuses to start if SECRET_KEY is a known placeholder ("dev-secret-key-do-not-use-in-production-abc123", "CHANGE_ME", "changeme") or if DATABASE_URL is missing/placeholder. The test key "test-secret-key-for-pytest-only-not-for-production" is intentionally not in the forbidden set.

### Admin User Schemas
New file `backend/app/schemas/v2/admin_users.py` with three Pydantic v2 schemas: `UserCreateAdmin`, `UserUpdateAdmin`, `UserAdminResponse`. Role validation constrains values to {"counsellor", "admin"}.

### Admin User CRUD Endpoints
Four new endpoints added to `backend/app/api/v1/routes/admin.py`:
- `GET /api/v1/admin/users` -- list active users (200)
- `POST /api/v1/admin/users` -- create user (201, 409 on duplicate email)
- `PATCH /api/v1/admin/users/{user_id}` -- update role/profile (200)
- `DELETE /api/v1/admin/users/{user_id}` -- soft-delete (204, 403 on self-delete)

All endpoints gated with `require_role("admin")`.

### Comprehensive Tests
- `test_admin_users.py`: 11 tests in `TestAdminUsersEndpoints` class covering RBAC enforcement (counsellor 403, admin 200), CRUD operations, self-delete prevention, duplicate email 409, invalid role 422
- `test_startup_validation.py`: 4 tests covering placeholder rejection and valid key acceptance

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | require_role, startup validation, schemas | 50a9545 | dependencies.py, config.py, admin_users.py |
| 2 | Admin user CRUD endpoints | 51863b3 | admin.py |
| 3 | RBAC and startup validation tests | 81045f3 | test_admin_users.py, test_startup_validation.py, admin.py (UUID fix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed user_id path parameter type from str to UUID**
- **Found during:** Task 3 (test execution)
- **Issue:** The plan specified `user_id: str` for PATCH and DELETE endpoints. SQLite test backend uses UUID column type, and passing a string caused `AttributeError: 'str' object has no attribute 'hex'` in SQLAlchemy's UUID type processor.
- **Fix:** Changed `user_id: str` to `user_id: UUID` in both `update_user()` and `delete_user()` endpoints, matching the established codebase pattern (e.g., `students.py` uses `student_id: UUID`).
- **Files modified:** `backend/app/api/v1/routes/admin.py`
- **Commit:** 81045f3

## Verification

```
pytest backend/tests/ -x -q
228 passed in 5.14s
```

All 213 existing tests remain green. 15 new tests added and passing.

## Known Stubs

None -- all endpoints are fully wired with real database operations.

## Self-Check: PASSED
