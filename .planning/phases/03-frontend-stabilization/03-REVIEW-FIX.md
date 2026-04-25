---
phase: 03-frontend-stabilization
fixed_at: 2026-04-25T14:45:00Z
review_path: .planning/phases/03-frontend-stabilization/03-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-04-25T14:45:00Z
**Source review:** .planning/phases/03-frontend-stabilization/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Stored XSS via iframe srcDoc rendering of plan HTML

**Files modified:** `frontend/src/pages/StudentProfile/PlansTab.jsx`
**Commit:** 9f737f1
**Applied fix:** Changed `sandbox="allow-same-origin"` to `sandbox=""` on the iframe element to apply all restrictions (no scripts, no forms, no popups, no same-origin access), preventing any injected scripts in plan HTML from executing.

### CR-02: User-controlled table name interpolated into API URL paths

**Files modified:** `frontend/src/api/entities.js`
**Commit:** 5266928
**Applied fix:** Added a `SAFE_TABLE_NAME` regex (`/^[a-z][a-z0-9_]*$/`) and `validateTableName()` guard function. All five entity CRUD functions (`getEntityList`, `getEntityDetail`, `createEntity`, `updateEntity`, `deleteEntity`) now validate the `tableName` parameter before interpolating it into the API URL, blocking path traversal attempts.

### WR-01: Stale closure in useEvaluationsTab removeEval

**Files modified:** `frontend/src/hooks/useEvaluationsTab.js`
**Commit:** 86c3cb2
**Applied fix:** Replaced direct `evaluations` closure reference with functional updater form `setEvaluations((prev) => ...)` so `removeEval` always operates on the latest state. Removed `evaluations` from the dependency array, leaving only `[saveAll]`.

### WR-02: Shared saving state causes concurrent save conflicts in ActivitiesTab

**Files modified:** `frontend/src/hooks/useActivitiesTab.js`
**Commit:** 36f78fc
**Applied fix:** Replaced single `saving` boolean with separate `savingActivities` and `savingAwards` states. Each save handler now manages its own saving flag independently. A derived `saving` property (`savingActivities || savingAwards`) is still exported for backward compatibility.

### WR-03: EntityForm initialValues only captured once on mount

**Files modified:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx`
**Commit:** d1e0543
**Applied fix:** Added `key={detailQuery.data?.id || 'new'}` prop to the `EntityForm` component, forcing React to remount the form when the detail data arrives asynchronously, ensuring the form populates with the loaded values.

### WR-04: EntityDetailPage mutation has no error feedback

**Files modified:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx`
**Commit:** d1e0543
**Applied fix:** Added `import { toast } from 'sonner'` and an `onError` callback to the `useMutation` call that displays `toast.error("Failed to update {name}.")` when the update request fails, matching the toast pattern used elsewhere in the application.

### WR-05: NavBarV2 and EntityListPage/EntityDetailPage render without account prop

**Files modified:** `frontend/src/pages/EntityListPage/EntityListPage.jsx`, `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx`
**Commit:** 158ca67
**Applied fix:** Added `import { getAccount } from '../../api/account'` and an `accountQuery` using `useQuery` in both entity pages, then passed `account={accountQuery.data ?? null}` to `NavBarV2`. This matches the pattern used in Dashboard and other pages, ensuring the navbar displays user name, role, and admin-only links consistently.

### WR-06: CSS variable collision for --accent and --border

**Files modified:** `frontend/src/index.css`
**Commit:** d36432e
**Applied fix:** Renamed the shadcn-format CSS variables from `--accent` to `--shadcn-accent`, `--accent-foreground` to `--shadcn-accent-foreground`, and `--border` to `--shadcn-border`. These shadcn variables were not referenced by any component or tailwind config, so the rename has no functional impact. The original hex-format `--accent` and `--border` definitions are now preserved without being overwritten.

## Test Results

- **Frontend (vitest):** 9/9 tests passed
- **Backend (pytest):** 136/136 tests passed

---

_Fixed: 2026-04-25T14:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
