---
phase: 06-deployment-and-production-readiness
plan: 02
subsystem: frontend-admin-ui-and-rbac
tags: [admin-ui, rbac, settings-page, auth-context, route-guards]
dependency_graph:
  requires: [require_role-dependency, admin-user-crud]
  provides: [settings-page, admin-route-guard, auth-context-with-role, admin-api-client]
  affects: [frontend-app-routes, frontend-nav, frontend-auth-context]
tech_stack:
  added: []
  patterns: [admin-route-guard, auth-context-role-fetch, shadcn-crud-table]
key_files:
  created:
    - frontend/src/api/admin.js
    - frontend/src/pages/Settings/Settings.jsx
  modified:
    - frontend/src/context/AuthContext.jsx
    - frontend/src/App.jsx
    - frontend/src/components/NavBarV2/NavBarV2.jsx
decisions:
  - "Used AdminRoute guard in App.jsx with null-safe user check to avoid flash redirect before user loads"
  - "Settings page fetches account independently for NavBarV2 prop, while also reading authUser from context for self-delete check"
metrics:
  duration: 9m
  completed: 2026-04-29T04:49:00Z
  tasks_completed: 1
  tasks_total: 2
  tests_added: 0
  tests_total: 237
---

# Phase 06 Plan 02: Admin User Management UI with Role-Based Navigation Summary

Settings page with full CRUD user management table, AuthContext extended with user role, admin API client, AdminRoute guard, and admin-only Settings nav link with lucide icon.

## What Was Built

### AuthContext with Role
Extended `frontend/src/context/AuthContext.jsx` to fetch the user's account data (including role) from `GET /api/v1/account` immediately after login and on mount when a token exists. The `user` object (with `role`, `email`, `display_name`, etc.) is now available to all context consumers via `useAuth()`.

### Admin API Client
Created `frontend/src/api/admin.js` with four functions matching the account.js pattern: `listUsers`, `createUser`, `updateUser`, `deleteUser`. Each function calls the corresponding backend admin endpoint and returns the response data.

### Settings Page with User Management
Created `frontend/src/pages/Settings/Settings.jsx` with:
- Shadcn Tabs component with "Users" tab
- User management table with columns: Name, Email, Role, Created, Actions
- Role badges with color coding (Admin: blue #dbeafe/#1e40af, Counsellor: grey #f1f5f9/#475569)
- Create User dialog with Full Name, Email, Password, and Role (Select) fields
- Edit User dialog pre-populated with existing user data, password optional
- Delete User confirmation dialog with destructive button
- Self-delete prevention: Delete action disabled for current user with tooltip "You cannot delete your own account."
- Toast messages for all CRUD outcomes per UI-SPEC copywriting contract
- Error handling for 403 (permission denied) and 409 (duplicate email) responses
- Loading states and empty state messaging

### AdminRoute Guard
Added `AdminRoute` component in `App.jsx` that checks `user.role === 'admin'` and redirects non-admin users to `/dashboard`. The `/settings` route uses this guard.

### Navigation Settings Link
Added "Settings" link with lucide Settings icon (18px) to NavBarV2, visible only when `account?.role === 'admin'`. Present in both desktop and mobile navigation menus.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | AuthContext with role, admin API client, Settings page, route guard, nav link | 4b5ef2f | AuthContext.jsx, admin.js, Settings.jsx, App.jsx, NavBarV2.jsx |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

```
Frontend tests: 2 files, 9 tests passed (vitest run)
Frontend build: successful (1,214.90 kB bundle)
Backend tests: 228 passed in 5.42s (no regressions)
Acceptance criteria: 14/14 grep checks passed
```

## Known Stubs

None -- all API functions are wired to real backend endpoints created in Plan 01.

## Checkpoint Status

Task 2 (checkpoint:human-verify) requires manual verification of the admin user management UI. The checkpoint is blocking -- a human must verify the create/edit/delete flows work, that non-admin users cannot see or access the Settings page, and that self-delete prevention works.

## Self-Check: PASSED
