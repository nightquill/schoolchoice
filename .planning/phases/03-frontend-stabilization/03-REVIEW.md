---
phase: 03-frontend-stabilization
reviewed: 2026-04-25T14:32:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - backend/app/api/v1/routes/entities.py
  - backend/app/main.py
  - backend/app/platform/entity_registry.py
  - backend/app/platform/module_loader.py
  - backend/tests/test_entities.py
  - frontend/src/App.jsx
  - frontend/src/api/entities.js
  - frontend/src/components/EntityForm/EntityForm.jsx
  - frontend/src/components/EntityForm/fieldComponents.js
  - frontend/src/components/EntityListView/EntityListView.jsx
  - frontend/src/components/NavBarV2/NavBarV2.jsx
  - frontend/src/components/QueryBoundary/QueryBoundary.jsx
  - frontend/src/components/TemplateSelector/TemplateSelector.jsx
  - frontend/src/components/ui/sonner.jsx
  - frontend/src/hooks/useActivitiesTab.js
  - frontend/src/hooks/useEvaluationsTab.js
  - frontend/src/hooks/useGradesTab.js
  - frontend/src/hooks/useLanguageTab.js
  - frontend/src/hooks/useNotesTab.js
  - frontend/src/hooks/usePersonalTab.js
  - frontend/src/hooks/usePlansTab.js
  - frontend/src/index.css
  - frontend/src/main.jsx
  - frontend/src/pages/Dashboard/Dashboard.jsx
  - frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx
  - frontend/src/pages/EntityListPage/EntityListPage.jsx
  - frontend/src/pages/StudentProfile/ActivitiesTab.jsx
  - frontend/src/pages/StudentProfile/EvaluationsTab.jsx
  - frontend/src/pages/StudentProfile/GradesTab.jsx
  - frontend/src/pages/StudentProfile/LanguageTab.jsx
  - frontend/src/pages/StudentProfile/NotesTab.jsx
  - frontend/src/pages/StudentProfile/PersonalTab.jsx
  - frontend/src/pages/StudentProfile/PlansTab.jsx
  - frontend/src/pages/StudentProfile/StudentProfile.jsx
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-25T14:32:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed all backend entity platform files and the full frontend surface (components, hooks, pages) for phase 3 frontend stabilization. The codebase is generally well-structured with consistent design-token usage and good separation of concerns via custom hooks. However, two critical security issues were found: an XSS vector via `srcDoc` iframe rendering of stored HTML, and a path-traversal-style API endpoint where user-controlled `tableName` is interpolated directly into API URLs. Several warnings relate to stale-closure bugs in hooks, missing error feedback on mutations, and a race condition in shared `saving` state.

## Critical Issues

### CR-01: Stored XSS via iframe srcDoc rendering of plan HTML

**File:** `frontend/src/pages/StudentProfile/PlansTab.jsx:76-79`
**Issue:** `selected.html_content` (server-stored HTML) is rendered via `<iframe srcDoc={selected.html_content}>`. The `sandbox` attribute is set to `allow-same-origin`, which does NOT prevent script execution in the context of the parent origin. If any plan HTML is injected with malicious scripts (via the LLM pipeline, a compromised API, or a malicious admin), those scripts execute with full access to the parent page's cookies, localStorage, and session tokens.
**Fix:** Either sanitize the HTML server-side before storage (using a library like bleach/DOMPurify), or change the sandbox attribute to a restrictive value that blocks scripts:
```jsx
<iframe
  style={iframeStyle}
  srcDoc={selected.html_content}
  title={selected.plan_label}
  sandbox=""
/>
```
Using `sandbox=""` (empty string) applies all restrictions: no scripts, no forms, no popups, no same-origin access. If styling needs same-origin, use `sandbox="allow-same-origin"` but pair it with server-side HTML sanitization.

### CR-02: User-controlled table name interpolated into API URL paths

**File:** `frontend/src/api/entities.js:9-22`
**Issue:** Functions `getEntityList`, `getEntityDetail`, `createEntity`, `updateEntity`, and `deleteEntity` all interpolate the `tableName` parameter directly into the API URL path (e.g., `` `/api/v1/${tableName}` ``). The `tableName` value originates from the server-returned schema (`schemaQuery.data?.table`), but if an attacker can influence entity configs or if the schema response is tampered with, they could craft a `tableName` like `../admin/data-refresh` to hit arbitrary backend endpoints with unintended HTTP methods (POST, PUT, DELETE). This is a path traversal risk at the API routing layer.
**Fix:** Validate `tableName` on the client side before use, and more importantly, ensure the backend entity CRUD router validates the table name against the registry:
```js
// Client-side guard
const SAFE_NAME = /^[a-z][a-z0-9_]*$/;
export const getEntityList = (tableName) => {
  if (!SAFE_NAME.test(tableName)) throw new Error(`Invalid table name: ${tableName}`);
  return client.get(`/api/v1/${tableName}`).then((r) => r.data);
};
```

## Warnings

### WR-01: Stale closure in useEvaluationsTab removeEval

**File:** `frontend/src/hooks/useEvaluationsTab.js:38-40`
**Issue:** `removeEval` captures `evaluations` from the closure at the time of the last `useCallback` call, but the dependency array includes `evaluations`. Every time `evaluations` changes, a new `removeEval` function is created, which defeats the purpose of `useCallback`. More critically, if `removeEval` is called rapidly (e.g., deleting two items in quick succession), the second call may use the stale `evaluations` array from before the first `saveAll` completed, causing the first deletion to be reverted.
**Fix:** Use the functional updater form to read current state:
```js
const removeEval = useCallback((index) => {
  setEvaluations((prev) => {
    const next = prev.filter((_, i) => i !== index);
    saveAll(next);
    return next;
  });
}, [saveAll]);
```

### WR-02: Shared saving state causes concurrent save conflicts in ActivitiesTab

**File:** `frontend/src/hooks/useActivitiesTab.js:7`
**Issue:** A single `saving` boolean is shared between `handleSaveActivities` and `handleSaveAwards`. If a user saves activities and then immediately saves awards (or vice versa), the second operation will set `saving = true` while the first is still in flight, and the `finally` block of whichever finishes first will set `saving = false` prematurely, re-enabling the buttons while the other operation is still running.
**Fix:** Use separate saving states:
```js
const [savingActivities, setSavingActivities] = useState(false);
const [savingAwards, setSavingAwards] = useState(false);
```

### WR-03: EntityForm initialValues only captured once on mount

**File:** `frontend/src/components/EntityForm/EntityForm.jsx:17`
**Issue:** `useState(initialValues)` captures the initial values only on first render. In `EntityDetailPage`, when `detailQuery.data` arrives asynchronously (after the component mounts with `{}`), the form will remain empty because `useState` ignores subsequent prop changes. The user sees a blank form even after data loads.
**Fix:** Add a `useEffect` to sync form state when `initialValues` changes, or use a `key` prop on the form to force remount:
```jsx
// In EntityDetailPage.jsx, force remount when data arrives:
<EntityForm
  key={detailQuery.data?.id || 'new'}
  schema={schemaQuery.data}
  initialValues={detailQuery.data || {}}
  ...
/>
```

### WR-04: EntityDetailPage mutation has no error feedback

**File:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx:24-31`
**Issue:** The `useMutation` call has an `onSuccess` handler but no `onError` handler. If the update fails, the user receives no feedback -- the form just stops showing "Saving..." and nothing happens. The error is silently swallowed.
**Fix:** Add an `onError` callback:
```jsx
const mutation = useMutation({
  mutationFn: (payload) => updateEntity(schemaQuery.data?.table || name, id, payload),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['entities', name] });
    queryClient.invalidateQueries({ queryKey: ['entity', name, id] });
    navigate(`/entities/${name}`);
  },
  onError: () => {
    toast.error(`Failed to update ${name}.`);
  },
});
```

### WR-05: NavBarV2 and EntityListPage/EntityDetailPage render without account prop

**File:** `frontend/src/pages/EntityListPage/EntityListPage.jsx:25`
**File:** `frontend/src/pages/EntityDetailPage/EntityDetailPage.jsx:35`
**Issue:** Both pages render `<NavBarV2 />` without passing the `account` prop. This means the navbar will not display the user's name or role, and admin-only links (Data Refresh) will never appear on entity pages even for admins. This is a functional gap rather than a crash, but it creates an inconsistent navigation experience.
**Fix:** Fetch account data in both pages and pass it to NavBarV2, or lift account fetching into a shared context/layout component.

### WR-06: CSS variable collision for --accent and --border

**File:** `frontend/src/index.css:11,36,39`
**Issue:** The `:root` block defines `--accent: #aa3bff` (line 11) and then later redefines `--accent: 210 40% 96%` (line 36, shadcn format). Similarly, `--border: #e5e4e7` (line 9) is redefined as `--border: 214 32% 91%` (line 39). The second definitions overwrite the first. Any code using `var(--accent)` or `var(--border)` with the original hex format assumption will get broken HSL values instead. The dark mode block also sets `--accent` in hex format, creating further inconsistency.
**Fix:** Rename the shadcn variables to avoid collision (e.g., `--shadcn-accent`, `--shadcn-border`), or remove the original hex definitions if they are no longer used.

## Info

### IN-01: Unused plansGenerated variable in Dashboard

**File:** `frontend/src/pages/Dashboard/Dashboard.jsx:62`
**Issue:** `const plansGenerated = students.filter((s) => s.has_plan).length;` is computed but never referenced. The same computation already appears inline in the `metrics` array at line 55.
**Fix:** Remove line 62.

### IN-02: index.css contains commented-out-style legacy rules

**File:** `frontend/src/index.css:73-77`
**Issue:** The dark mode block contains a rule for `#social .button-icon` which appears to be a leftover from a different project or template (Vite starter). It has no relevance to the school choice application.
**Fix:** Remove the `#social .button-icon` rule from the dark mode block.

### IN-03: EntityForm does not handle jsonb field type for initial display

**File:** `frontend/src/components/EntityForm/fieldComponents.js:78-88`
**Issue:** The jsonb field component uses `JSON.stringify(value, null, 2)` for display and `JSON.parse(e.target.value)` on change. If the user types invalid JSON, the `catch` block silently ignores the change, meaning the internal form state does not update. This creates a confusing UX where the textarea shows one thing but the form will submit the last valid JSON. While not a bug per se, it could lead to data loss if the user thinks their edits are being captured.
**Fix:** Consider storing the raw text in local state and only parsing on submit, or showing a validation message when JSON is invalid.

### IN-04: backend/app/main.py runs DDL migrations at import time

**File:** `backend/app/main.py:52,148-170`
**Issue:** `Base.metadata.create_all()`, `_seed_database()`, and inline `ALTER TABLE` statements all execute at module import time (not inside a startup event handler). This means these operations run during test collection, IDE analysis, and any other import of the `app` module. While guarded for PostgreSQL dialect, the overall pattern couples import with side effects.
**Fix:** Consider moving these operations into a FastAPI `@app.on_event("startup")` handler or the newer lifespan pattern for cleaner separation.

---

_Reviewed: 2026-04-25T14:32:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
