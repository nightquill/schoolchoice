# Permission Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken permission system — cache propagation, backend enforcement on 18 unguarded endpoints, frontend UI gating, and add data_export feature.

**Architecture:** Three-layer fix: (1) Fix React Query cache invalidation so permission changes propagate immediately, (2) Add `check_feature_permission()` guards to all mutation endpoints, (3) Wire `useFeatureAccess()` to all UI controls. Plus add `data_export` as 12th permission feature.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query (frontend), custom i18n

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` | Modify | Fix cache invalidation on save, add data_export to grid |
| `apps/web/src/hooks/usePermission.js` | Modify | Set staleTime to 0, refetchOnMount always |
| `backend/app/db/models.py` | Modify | Add `data_export` column to CohortPermission |
| `backend/app/services/permission_service.py` | Modify | Add `data_export` to TOOL_FIELDS |
| `backend/app/api/v1/routes/grades.py` | Modify | Add permission checks to 3 endpoints |
| `backend/app/api/v1/routes/submissions.py` | Modify | Add permission checks to 3 endpoints |
| `backend/app/api/v1/routes/reports.py` | Modify | Add permission checks to 3 endpoints |
| `backend/app/api/v1/routes/students.py` | Modify | Add permission checks to 5 endpoints + gate export |
| `backend/app/api/v1/routes/plan.py` | Modify | Add permission checks to 4 endpoints |
| `apps/web/src/pages/StudentProfile/GradesTab.jsx` | Modify | Gate edit/delete/add behind grades permission |
| `apps/web/src/pages/Submissions/SubmissionDetail.jsx` | Modify | Gate approve/reject/revise behind submissions permission |
| `apps/web/src/pages/Dashboard/Dashboard.jsx` | Modify | Gate export button behind data_export permission |
| `packages/ui/src/i18n/en.json` | Modify | Add data_export i18n key |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add data_export i18n key |

---

### Task 1: Fix cache propagation

**Files:**
- Modify: `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx:1-66`
- Modify: `apps/web/src/hooks/usePermission.js:1-62`

- [ ] **Step 1: Fix GroupPermissions — invalidate cache after save**

In `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`, change the imports on line 2:

```javascript
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
```

Then inside the component function (line 9), add after `const { t } = useTranslation();`:

```javascript
  const queryClient = useQueryClient();
```

Then in `handleSave` (lines 55-66), after `setDirty(false);` add:

```javascript
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
```

- [ ] **Step 2: Fix usePermission — staleTime 0, always refetch**

In `apps/web/src/hooks/usePermission.js`, replace the query config (lines 5-9):

```javascript
export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: getMyPermissions,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  return { permissions: data?.cohorts ?? [], isLoading };
}
```

- [ ] **Step 3: Verify app loads without errors**

```bash
curl -s http://localhost:5173 | head -5
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx apps/web/src/hooks/usePermission.js
git commit -m "fix: permission cache propagation — invalidate on save, staleTime 0

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add data_export permission feature

**Files:**
- Modify: `backend/app/db/models.py:393-403`
- Modify: `backend/app/services/permission_service.py:24-36`
- Modify: `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx:12-23`
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add column to CohortPermission model**

In `backend/app/db/models.py`, after the `student_profile` column (line 403), add:

```python
    data_export = Column(String(10), nullable=False, default="none", server_default="'none'")
```

- [ ] **Step 2: Add to TOOL_FIELDS in permission_service.py**

In `backend/app/services/permission_service.py`, find the `TOOL_FIELDS` tuple (line 24). Add `"data_export"` to the end:

```python
TOOL_FIELDS = (
    "programme_choices",
    "grades",
    "plan_generation",
    "submissions",
    "reports",
    "cohort_management",
    "data_import",
    "account_assignment",
    "student_delete",
    "student_profile",
    "data_export",
)
```

- [ ] **Step 3: Add to GroupPermissions TOOLS array**

In `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`, add to the TOOLS array (after the student_profile entry, line 22):

```javascript
    { key: 'data_export', label: t('groupPermissions.dataExport') },
```

- [ ] **Step 4: Add i18n keys**

In `packages/ui/src/i18n/en.json`, find the `groupPermissions` namespace. Add:
```json
    "dataExport": "Data Export",
```

In `packages/ui/src/i18n/zh-HK.json`, find the `groupPermissions` namespace. Add:
```json
    "dataExport": "資料匯出",
```

- [ ] **Step 5: Verify backend starts (auto-patches column)**

```bash
curl -s http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print('OK' if 'access_token' in json.load(sys.stdin) else 'FAIL')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/db/models.py backend/app/services/permission_service.py apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: add data_export as 12th permission feature

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend enforcement — grades.py (3 endpoints)

**Files:**
- Modify: `backend/app/api/v1/routes/grades.py`

- [ ] **Step 1: Add import**

At the top of `backend/app/api/v1/routes/grades.py`, add:

```python
from app.services.permission_service import check_feature_permission
```

- [ ] **Step 2: Guard create_grade**

In the `create_grade` function (line 148), right after the `student = student_service.get_student(...)` call (line 155-158), add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="grades")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Grades write permission required.")
```

- [ ] **Step 3: Guard update_grade**

In the `update_grade` function (line 248), right after the `student = student_service.get_student(...)` call (line 256-258), add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="grades")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Grades write permission required.")
```

- [ ] **Step 4: Guard delete_grade**

In the `delete_grade` function (line 299), right after the `student_service.get_student(...)` call (line 306-309), add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="grades")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Grades write permission required.")
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/grades.py
git commit -m "fix: enforce grades permission on create/update/delete endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Backend enforcement — submissions.py (3 endpoints)

**Files:**
- Modify: `backend/app/api/v1/routes/submissions.py`

- [ ] **Step 1: Add import**

At the top of `backend/app/api/v1/routes/submissions.py`, add:

```python
from app.services.permission_service import check_feature_permission
```

- [ ] **Step 2: Guard approve_submission**

In `approve_submission` (line 268), after `sub = _get_submission_or_404(db, submission_id, user)` (line 273), add:

```python
    perm = check_feature_permission(user, db, student_id=sub.student_id, feature="submissions")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Submissions write permission required.")
```

- [ ] **Step 3: Guard revise_submission**

In `revise_submission` (line 380), after `sub = _get_submission_or_404(db, submission_id, user)` (line 386), add:

```python
    perm = check_feature_permission(user, db, student_id=sub.student_id, feature="submissions")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Submissions write permission required.")
```

- [ ] **Step 4: Guard reject_submission**

In `reject_submission` (line 410), after `sub = _get_submission_or_404(db, submission_id, user)` (line 416), add:

```python
    perm = check_feature_permission(user, db, student_id=sub.student_id, feature="submissions")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Submissions write permission required.")
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/submissions.py
git commit -m "fix: enforce submissions permission on approve/revise/reject endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Backend enforcement — reports.py (3 endpoints)

**Files:**
- Modify: `backend/app/api/v1/routes/reports.py`

Reports use `cohort_id` not `student_id`. The check needs to verify the user's group has `reports != "none"` for that cohort. We can pick any member of the cohort to check against since permissions are cohort-level.

- [ ] **Step 1: Add import**

At the top of `backend/app/api/v1/routes/reports.py`, add:

```python
from app.services.permission_service import check_feature_permission
```

- [ ] **Step 2: Add helper to check cohort-level permission**

Add this helper near the top of the file (after the existing helpers):

```python
def _check_cohort_feature(db, user, cohort, feature):
    """Check permission on a cohort by testing against its first member."""
    if user.role == "admin":
        return
    member_ids = _member_student_ids(cohort)
    if not member_ids:
        return  # empty cohort — allow access
    perm = check_feature_permission(user, db, student_id=member_ids[0], feature=feature)
    if perm == "none":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No {feature} access for this cohort.",
        )
```

- [ ] **Step 3: Guard target_distribution**

In `target_distribution` (line 64), after the `cohort = _get_cohort_or_403(...)` call (line 70), add:

```python
    _check_cohort_feature(db, current_user, cohort, "reports")
```

- [ ] **Step 4: Guard risk_breakdown**

In `risk_breakdown` (line 111), after the `cohort = _get_cohort_or_403(...)` call (line 117), add:

```python
    _check_cohort_feature(db, current_user, cohort, "reports")
```

- [ ] **Step 5: Guard subject_performance**

In `subject_performance` (line 164), after the `cohort = _get_cohort_or_403(...)` call (line 171), add:

```python
    _check_cohort_feature(db, current_user, cohort, "reports")
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/reports.py
git commit -m "fix: enforce reports permission on cohort report endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Backend enforcement — students.py (5 endpoints) + gate export

**Files:**
- Modify: `backend/app/api/v1/routes/students.py`

- [ ] **Step 1: Verify import exists**

Check that `check_feature_permission` is already imported in students.py (it's used elsewhere in the file). If not, add:

```python
from app.services.permission_service import check_feature_permission
```

- [ ] **Step 2: Guard update_language_scores**

In `update_language_scores` (line 382), after the `student = student_service.get_student(...)` call (line 389), add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
```

- [ ] **Step 3: Guard update_teacher_evaluations**

In `update_teacher_evaluations` (line 433), after the validated payload section, before the `student = ...` line, add the student fetch and permission check:

```python
    student = student_service.get_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
```

Note: if `get_student` is already called later in the function, move the perm check right after it instead of duplicating.

- [ ] **Step 4: Guard update_extracurricular, update_awards, graduate_student**

Apply the same pattern to each — after the `student_service.get_student()` call, add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
```

- [ ] **Step 5: Gate the export endpoint**

In the `export_students` function, after the student list is fetched and filtered, add a permission check. Since export is org-wide (not per-student), check if the user has `data_export` access on any cohort:

```python
    # Check data_export permission
    if current_user.role != "admin":
        from app.services.permission_service import resolve_user_permissions
        user = db.merge(current_user)
        perms = resolve_user_permissions(user, db)
        has_export = any(p.get("data_export") in ("read_only", "read_write") for p in perms)
        if not has_export:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Data export permission required.")
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/students.py
git commit -m "fix: enforce student_profile + data_export permission on 6 endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Backend enforcement — plan.py (4 endpoints)

**Files:**
- Modify: `backend/app/api/v1/routes/plan.py`

- [ ] **Step 1: Add import**

At the top of `backend/app/api/v1/routes/plan.py`, add:

```python
from app.services.permission_service import check_feature_permission
```

- [ ] **Step 2: Guard plan_chat**

In `plan_chat` (line 462), after the student fetch (look for `student_service.get_student(...)` or similar), add:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan generation permission required.")
```

- [ ] **Step 3: Guard set_plan_template**

In `set_plan_template` (line 488), after the student fetch, add the same check:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan generation permission required.")
```

- [ ] **Step 4: Guard edit_plan_section**

In `edit_plan_section` (line 532), after the student fetch, add the same check:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan generation permission required.")
```

- [ ] **Step 5: Guard reset_plan_section**

In `reset_plan_section` (line 578), after the student fetch, add the same check:

```python
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan generation permission required.")
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/v1/routes/plan.py
git commit -m "fix: enforce plan_generation permission on chat/template/section endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Frontend gating — GradesTab

**Files:**
- Modify: `apps/web/src/pages/StudentProfile/GradesTab.jsx`

- [ ] **Step 1: Add useFeatureAccess import and call**

At the top of `GradesTab.jsx`, add:

```javascript
import { useFeatureAccess } from '../../hooks/usePermission';
```

Inside the `GradesTab` function, after the existing hooks, add:

```javascript
  const { canEdit: canEditGrades } = useFeatureAccess('grades');
```

- [ ] **Step 2: Gate edit controls**

Wrap the grade edit pencil icon, delete button, add grade button, and transcript upload in `canEditGrades` checks. For the pencil icon in the actions column:

```jsx
{!isStudentView && canEditGrades && editingGradeId !== g.id && (
```

For the delete button:

```jsx
{canEditGrades && (
  <button onClick={() => handleDeleteGrade(g.id)} ...>
```

For the add grade button:

```jsx
{canEditGrades && !newRow ? (
```

For the transcript upload section:

```jsx
{canEditGrades && !isStudentView && (
  // ... upload transcript section
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/StudentProfile/GradesTab.jsx
git commit -m "fix: gate grade edit/delete/add behind grades permission

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Frontend gating — SubmissionDetail + Dashboard export

**Files:**
- Modify: `apps/web/src/pages/Submissions/SubmissionDetail.jsx`
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx`

- [ ] **Step 1: Gate submission approve/reject/revise**

In `apps/web/src/pages/Submissions/SubmissionDetail.jsx`, add:

```javascript
import { useFeatureAccess } from '../../hooks/usePermission';
```

Inside the component, add:

```javascript
const { canEdit: canEditSubmissions } = useFeatureAccess('submissions');
```

Find all approve, reject, revise/send-back buttons. Wrap each in `{canEditSubmissions && (...)}`.

- [ ] **Step 2: Gate dashboard export button**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, add:

```javascript
import { useFeatureAccess } from '../../hooks/usePermission';
```

The `useFeatureAccess` import may already exist. Inside the component, add:

```javascript
const { canEdit: canExport } = useFeatureAccess('data_export');
```

Find the export button (the one that calls `/api/v1/students/export`). Wrap it:

```jsx
{canExport && (
  <button onClick={async () => { /* existing export logic */ }} ...>
    ...
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Submissions/SubmissionDetail.jsx apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "fix: gate submission actions + data export behind permissions

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Playwright verification

**Files:**
- Create: `e2e/verify-permissions.spec.ts`

- [ ] **Step 1: Write the test**

Create `e2e/verify-permissions.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';

function resize(path: string) {
  try {
    const info = execSync(`sips -g pixelWidth -g pixelHeight "${path}" 2>/dev/null`, { encoding: 'utf-8' });
    const w = parseInt(info.match(/pixelWidth:\s*(\d+)/)?.[1] || '0', 10);
    const h = parseInt(info.match(/pixelHeight:\s*(\d+)/)?.[1] || '0', 10);
    if (w > 1800 || h > 1800) {
      const scale = Math.min(1800 / w, 1800 / h);
      execSync(`sips --resampleHeightWidth ${Math.round(h * scale)} ${Math.round(w * scale)} "${path}" 2>/dev/null`);
    }
  } catch {}
}

async function shot(page, path: string) {
  await page.screenshot({ path });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => { sessionStorage.setItem('locale', 'zh-HK'); localStorage.setItem('locale', 'zh-HK'); });
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Permission hardening', () => {

  test('Admin permission grid shows data_export column', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click Teacher Groups tab (first tab, should be active by default)
    await page.waitForTimeout(500);

    // Look for data export label in the permission grid
    const dataExport = page.locator('th, td', { hasText: /Data Export|資料匯出/ });
    await expect(dataExport.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/perm-admin-grid.png');
  });

  test('Permission cache refresh — staleTime is 0', async ({ page }) => {
    await login(page);
    // Navigate between pages to confirm no stale permission errors
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // No errors should appear
    const errorVisible = await page.locator('text=account.').count();
    expect(errorVisible).toBe(0);

    await shot(page, 'e2e/screenshots/perm-no-stale.png');
  });

});
```

- [ ] **Step 2: Run tests**

```bash
npx playwright test e2e/verify-permissions.spec.ts --headed --timeout 30000
```

- [ ] **Step 3: View screenshots**

Confirm the permission grid shows `data_export` column and no raw i18n keys appear.

- [ ] **Step 4: Commit**

```bash
git add e2e/verify-permissions.spec.ts
git commit -m "test: Playwright verification for permission hardening

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
