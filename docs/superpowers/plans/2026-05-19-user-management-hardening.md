# User Management Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce all 11 permissions at both API and frontend layers, implement soft delete, fix cascade bug, and default teachers to no-access until group assignment.

**Architecture:** Backend: add `deleted_at` + `student_profile` columns, add `require_feature_permission` dependency to every write endpoint, change teacher defaults. Frontend: update `usePermission` hook to return `none` during load, wire permission checks into all page components with disable+tooltip pattern.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL (alembic for migration), React, TanStack Query

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/modules/school_choice/models/models.py` | Modify | Fix cascade, add `deleted_at` to Student |
| `backend/app/db/models.py` | Modify | Add `deleted_at` to User, add `student_profile` to CohortPermission |
| `backend/app/services/permission_service.py` | Modify | Add `student_profile` to TOOL_FIELDS, change teacher defaults to none |
| `backend/app/services/student_service.py` | Modify | Soft delete instead of hard delete, filter `deleted_at` |
| `backend/app/api/v1/routes/students.py` | Modify | Add permission check to delete, filter soft-deleted |
| `backend/app/api/v1/routes/targets.py` | Modify | Add `programme_choices` permission check |
| `backend/app/api/v1/routes/plan.py` | Modify | Add `plan_generation` permission check |
| `backend/app/api/v1/routes/cohorts.py` | Modify | Add `cohort_management` permission check |
| `backend/app/api/v1/routes/admin.py` | Modify | Soft delete user with `deleted_at` |
| `backend/app/api/v1/routes/account.py` | Modify | Self-delete: soft delete + unlink |
| `backend/app/schemas/v2/cohorts.py` | Modify | Add `student_profile` to CohortPermissionSet if exists |
| `apps/web/src/hooks/usePermission.js` | Modify | Return `none` during load, add `useFeatureAccess` |
| `apps/web/src/pages/StudentListPage/StudentListPage.jsx` | Modify | Wire delete/import/invite permission checks |
| `apps/web/src/pages/StudentProfile/StudentProfile.jsx` | Modify | Wire `student_profile` permission check on edit controls |
| `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx` | Modify | Wire `programme_choices` permission check |
| `apps/web/src/pages/StudentProfile/PlansTab.jsx` | Modify | Wire `plan_generation` permission check |
| `apps/web/src/pages/Dashboard/Dashboard.jsx` | Modify | Wire `data_import` check, no-group empty state |
| `apps/web/src/pages/CohortDetail/CohortDetail.jsx` | Modify | Wire `cohort_management` permission check |
| `apps/web/src/pages/Submissions/SubmissionDetail.jsx` | Modify | Wire `submissions` permission check |
| `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` | Modify | Add `student_profile` column to grid |
| `apps/web/src/components/NavBarV2/NavBarV2.jsx` | Modify | Verify admin-only links hidden for non-admin |
| `packages/ui/src/i18n/en.json` | Modify | Add permission-related i18n keys |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add matching Chinese keys |

---

### Task 1: Database model changes — cascade fix, soft delete columns, student_profile permission

**Files:**
- Modify: `backend/app/modules/school_choice/models/models.py:63-65`
- Modify: `backend/app/db/models.py:155-165` and `356-372`

- [ ] **Step 1: Fix Student.user_id cascade from CASCADE to SET NULL**

In `backend/app/modules/school_choice/models/models.py`, change line 65:

```python
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL", name="fk_students_user_id"),
        nullable=True,  # changed from False: student can exist without counsellor
        index=True,
        comment="Owning counselor — FK to users.id, SET NULL on delete",
    )
```

- [ ] **Step 2: Add `deleted_at` to Student model**

After the `is_graduated` column in the Student model, add:

```python
    deleted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
        comment="Soft delete timestamp — NULL means active",
    )
```

- [ ] **Step 3: Add `deleted_at` to User model**

In `backend/app/db/models.py`, after the `is_active` column (line ~158), add:

```python
    deleted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=True,
        default=None,
        comment="Soft delete timestamp — NULL means active",
    )
```

- [ ] **Step 4: Add `student_profile` to CohortPermission model**

In `backend/app/db/models.py`, after the `student_delete` column (line ~371), add:

```python
    student_profile = Column(String(10), nullable=False, default="none", server_default="'none'")
```

- [ ] **Step 5: Run migration**

```bash
cd backend && alembic revision --autogenerate -m "soft_delete_cascade_fix_student_profile_perm"
alembic upgrade head
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/modules/school_choice/models/models.py backend/app/db/models.py backend/alembic/versions/
git commit -m "fix: cascade SET NULL, add deleted_at columns, add student_profile permission"
```

---

### Task 2: Permission service — add student_profile, change teacher defaults

**Files:**
- Modify: `backend/app/services/permission_service.py`

- [ ] **Step 1: Add `student_profile` to TOOL_FIELDS and change defaults**

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
)

ROLE_DEFAULTS: dict[str, dict] = {
    "admin": {"visible": True, **{f: "read_write" for f in TOOL_FIELDS}},
    "counsellor": {
        "visible": False,
        **{f: "none" for f in TOOL_FIELDS},
    },
    "student": {
        "visible": True,
        "programme_choices": "read_only",
        "grades": "read_only",
        "plan_generation": "none",
        "submissions": "read_write",
        "reports": "none",
        "cohort_management": "none",
        "data_import": "none",
        "account_assignment": "none",
        "student_delete": "none",
        "student_profile": "read_only",
    },
}
```

Key change: counsellor defaults go from read_write on most things to `none` on everything + `visible: False`. Teachers without groups now have no access.

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/permission_service.py
git commit -m "feat: add student_profile permission, change teacher default to no-access"
```

---

### Task 3: Soft delete implementation — student service + routes

**Files:**
- Modify: `backend/app/services/student_service.py`
- Modify: `backend/app/api/v1/routes/students.py`
- Modify: `backend/app/api/v1/routes/admin.py`
- Modify: `backend/app/api/v1/routes/account.py`

- [ ] **Step 1: Change student_service.delete_student to soft delete**

Replace `delete_student` function in `backend/app/services/student_service.py`:

```python
def delete_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> None:
    """
    Soft-delete a student profile. Sets deleted_at timestamp.
    Deactivates linked student account if one exists.
    """
    from datetime import datetime, timezone
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)
    student.deleted_at = datetime.now(timezone.utc)

    # Deactivate linked student account
    linked_user = db.query(User).filter(
        User.student_id == student.id,
        User.is_active == True  # noqa: E712
    ).first()
    if linked_user:
        linked_user.is_active = False
        linked_user.deleted_at = datetime.now(timezone.utc)

    db.commit()
```

- [ ] **Step 2: Add deleted_at filter to student list query**

In `backend/app/api/v1/routes/students.py`, find the GET list endpoint and add `.filter(Student.deleted_at.is_(None))` to the query. Also add permission check to DELETE endpoint:

```python
from app.services.permission_service import check_feature_permission

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a student profile. Requires student_delete permission."""
    perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_delete")
    if perm != "read_write":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student delete permission required.")
    student_service.delete_student(db, student_id=student_id, user_id=current_user.id, organisation_id=_org_id(current_user))
```

- [ ] **Step 3: Soft delete user in admin.py**

In `backend/app/api/v1/routes/admin.py`, update the `delete_user` endpoint to set `deleted_at`:

```python
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()
```

- [ ] **Step 4: Self-delete in account.py — soft delete + unlink**

Update the account self-delete to also set `deleted_at` and unlink `student_id`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/student_service.py backend/app/api/v1/routes/students.py backend/app/api/v1/routes/admin.py backend/app/api/v1/routes/account.py
git commit -m "feat: implement soft delete for students and users, enforce student_delete permission"
```

---

### Task 4: Backend permission enforcement on all write endpoints

**Files:**
- Modify: `backend/app/api/v1/routes/targets.py`
- Modify: `backend/app/api/v1/routes/plan.py`
- Modify: `backend/app/api/v1/routes/cohorts.py`
- Modify: `backend/app/api/v1/routes/students.py` (profile edit endpoints)

- [ ] **Step 1: Add programme_choices permission to targets endpoints**

In `backend/app/api/v1/routes/targets.py`, add to POST/PUT/DELETE endpoints:

```python
from app.services.permission_service import check_feature_permission

# In each write endpoint, before the operation:
perm = check_feature_permission(current_user, db, student_id=student_id, feature="programme_choices")
if perm != "read_write":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Programme choices write permission required.")
```

For GET endpoints, check for at least `read_only`:
```python
perm = check_feature_permission(current_user, db, student_id=student_id, feature="programme_choices")
if perm == "none":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to programme choices for this student.")
```

- [ ] **Step 2: Add plan_generation permission to plan endpoints**

In `backend/app/api/v1/routes/plan.py`, add to POST generate, POST chat, PATCH template/section, DELETE:

```python
perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
if perm != "read_write":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan generation write permission required.")
```

For GET plan:
```python
perm = check_feature_permission(current_user, db, student_id=student_id, feature="plan_generation")
if perm == "none":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to plans for this student.")
```

- [ ] **Step 3: Add cohort_management permission to cohort endpoints**

In `backend/app/api/v1/routes/cohorts.py`, add to POST/PUT/DELETE cohort and POST/DELETE members:

```python
from app.services.permission_service import check_feature_permission
# For cohort write operations, check the cohort_management permission
# Note: cohort operations don't have a student_id; check against the user's permission on the specific cohort
```

For cohort operations, use the existing `resolve_user_permissions` to check if user has `cohort_management: read_write` on the target cohort.

- [ ] **Step 4: Add student_profile permission to student profile edit endpoints**

In `backend/app/api/v1/routes/students.py`, add to PUT profile/personal, PUT evaluations, POST activities/awards/language:

```python
perm = check_feature_permission(current_user, db, student_id=student_id, feature="student_profile")
if perm != "read_write":
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student profile write permission required.")
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/targets.py backend/app/api/v1/routes/plan.py backend/app/api/v1/routes/cohorts.py backend/app/api/v1/routes/students.py
git commit -m "feat: enforce all 11 permissions on API write endpoints"
```

---

### Task 5: Frontend usePermission hook update

**Files:**
- Modify: `apps/web/src/hooks/usePermission.js`

- [ ] **Step 1: Change optimistic default and add useFeatureAccess**

```javascript
import { useQuery } from '@tanstack/react-query';
import { getMyPermissions } from '../api/teacherGroups';

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: getMyPermissions,
    staleTime: 5 * 60 * 1000,
  });
  return { permissions: data?.cohorts ?? [], isLoading };
}

export function usePermission(cohortId, feature) {
  const { permissions, isLoading } = usePermissions();
  if (isLoading) return 'none';  // CHANGED: was 'read_write', now pessimistic
  if (!cohortId) {
    const rank = { none: 0, read_only: 1, read_write: 2 };
    let best = 'none';
    for (const p of permissions) {
      if (!p.visible) continue;
      const val = p[feature] || 'none';
      if ((rank[val] || 0) > (rank[best] || 0)) best = val;
    }
    return best;
  }
  const perm = permissions.find(p => p.cohort_id === cohortId);
  if (!perm || !perm.visible) return 'none';
  return perm[feature] || 'none';
}

export function useFeatureAccess(feature) {
  const { permissions, isLoading } = usePermissions();
  if (isLoading) return { level: 'none', isLoading: true, canView: false, canEdit: false };
  const rank = { none: 0, read_only: 1, read_write: 2 };
  let best = 'none';
  for (const p of permissions) {
    if (!p.visible) continue;
    const val = p[feature] || 'none';
    if ((rank[val] || 0) > (rank[best] || 0)) best = val;
  }
  return {
    level: best,
    isLoading: false,
    canView: best !== 'none',
    canEdit: best === 'read_write',
  };
}

export function useCohortVisible(cohortId) {
  const { permissions } = usePermissions();
  if (!cohortId) return true;
  const perm = permissions.find(p => p.cohort_id === cohortId);
  return perm ? perm.visible : true;
}

export function useHasAnyAccess() {
  const { permissions, isLoading } = usePermissions();
  if (isLoading) return { hasAccess: false, isLoading: true };
  const hasVisibleCohort = permissions.some(p => p.visible);
  return { hasAccess: hasVisibleCohort, isLoading: false };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePermission.js
git commit -m "feat: pessimistic permission loading, add useFeatureAccess and useHasAnyAccess hooks"
```

---

### Task 6: Add permission i18n keys

**Files:**
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add permission-related keys to en.json**

Add after `"planEditor"` block:

```json
  "permission": {
    "requiresPermission": "Requires {permission} permission \u2014 contact your admin",
    "noGroupAccess": "Your administrator hasn\u2019t assigned you to any groups yet. Contact them to get started.",
    "programmeChoices": "programme choices",
    "grades": "grades",
    "planGeneration": "plan generation",
    "submissions": "submissions",
    "reports": "reports",
    "cohortManagement": "cohort management",
    "dataImport": "data import",
    "accountAssignment": "account assignment",
    "studentDelete": "student delete",
    "studentProfile": "student profile"
  }
```

- [ ] **Step 2: Add matching zh-HK keys**

```json
  "permission": {
    "requiresPermission": "\u9700\u8981{permission}\u6b0a\u9650 \u2014 \u8acb\u806f\u7d61\u7ba1\u7406\u54e1",
    "noGroupAccess": "\u60a8\u7684\u7ba1\u7406\u54e1\u5c1a\u672a\u5c07\u60a8\u5206\u914d\u5230\u4efb\u4f55\u7fa4\u7d44\u3002\u8acb\u806f\u7d61\u4ed6\u5011\u4ee5\u958b\u59cb\u4f7f\u7528\u3002",
    "programmeChoices": "\u8ab2\u7a0b\u9078\u64c7",
    "grades": "\u6210\u7e3e",
    "planGeneration": "\u8a08\u756b\u751f\u6210",
    "submissions": "\u63d0\u4ea4",
    "reports": "\u5831\u544a",
    "cohortManagement": "\u7fa4\u7d44\u7ba1\u7406",
    "dataImport": "\u6578\u64da\u532f\u5165",
    "accountAssignment": "\u5e33\u6236\u6307\u6d3e",
    "studentDelete": "\u522a\u9664\u5b78\u751f",
    "studentProfile": "\u5b78\u751f\u6a94\u6848"
  }
```

Also add `groupPermissions.studentProfile`:

In en.json under `"groupPermissions"`:
```json
    "studentProfile": "Student Profile"
```

In zh-HK.json under `"groupPermissions"`:
```json
    "studentProfile": "\u5b78\u751f\u6a94\u6848"
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "i18n: add permission-related translation keys"
```

---

### Task 7: Frontend permission enforcement — all pages

**Files:**
- Modify: `apps/web/src/pages/StudentListPage/StudentListPage.jsx`
- Modify: `apps/web/src/pages/StudentProfile/StudentProfile.jsx`
- Modify: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx`
- Modify: `apps/web/src/pages/StudentProfile/PlansTab.jsx`
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx`
- Modify: `apps/web/src/pages/CohortDetail/CohortDetail.jsx`
- Modify: `apps/web/src/pages/Submissions/SubmissionDetail.jsx`

Pattern for each file: import `useFeatureAccess` or `useHasAnyAccess`, check permission level, disable buttons with tooltip.

**Disabled button pattern:**
```jsx
const { canEdit: canImport } = useFeatureAccess('data_import');

<button
  disabled={!canImport}
  title={!canImport ? t('permission.requiresPermission', { permission: t('permission.dataImport') }) : undefined}
  style={!canImport ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
>
  {t('import.importCsvExcel')}
</button>
```

**No-group empty state pattern (Dashboard):**
```jsx
const { hasAccess, isLoading: permLoading } = useHasAnyAccess();
const isTeacherNoGroup = user?.role === 'counsellor' && !permLoading && !hasAccess;

{isTeacherNoGroup && (
  <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
    {t('permission.noGroupAccess')}
  </div>
)}
```

- [ ] **Step 1: Wire StudentListPage** — disable delete (student_delete), invite (account_assignment), import (data_import)
- [ ] **Step 2: Wire Dashboard** — disable import, add no-group empty state
- [ ] **Step 3: Wire ProgrammeChoicesTab** — disable add/edit/remove (programme_choices)
- [ ] **Step 4: Wire PlansTab** — disable generate (plan_generation)
- [ ] **Step 5: Wire StudentProfile** — disable edit on personal tabs (student_profile)
- [ ] **Step 6: Wire CohortDetail** — disable add/remove members (cohort_management)
- [ ] **Step 7: Wire SubmissionDetail** — disable approve/reject/send-back (submissions)
- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/StudentListPage/StudentListPage.jsx apps/web/src/pages/Dashboard/Dashboard.jsx apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx apps/web/src/pages/StudentProfile/PlansTab.jsx apps/web/src/pages/StudentProfile/StudentProfile.jsx apps/web/src/pages/CohortDetail/CohortDetail.jsx apps/web/src/pages/Submissions/SubmissionDetail.jsx
git commit -m "feat: wire frontend permission enforcement — disable unauthorized actions with tooltip"
```

---

### Task 8: Permission grid UI — add student_profile column

**Files:**
- Modify: `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx`

- [ ] **Step 1: Add student_profile column to permission grid**

Add `student_profile` to the tool columns array and render a dropdown for it, matching the existing pattern for other tools.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx
git commit -m "feat: add student_profile column to admin permission grid"
```

---

### Task 9: NavBar — verify admin-only links hidden

**Files:**
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx` (if needed)

- [ ] **Step 1: Verify and fix admin-only nav links**

Check that "User Management", "Teacher Groups", and "Data Refresh" links are wrapped in admin role checks. If not, add:

```jsx
{account?.role === 'admin' && (
  <Link to="/admin/manage">{t('nav.manage')}</Link>
)}
```

- [ ] **Step 2: Commit (if changes needed)**

---

### Task 10: E2E tests — headed Playwright

**Files:**
- Create: `apps/web/e2e/verify-permissions.spec.ts`

- [ ] **Step 1: Write admin↔teacher permission test**

Test flow: Login as admin → create teacher group → assign teacher → set specific permissions → login as teacher → verify buttons disabled/enabled per permissions.

- [ ] **Step 2: Write no-group teacher test**

Test flow: Login as teacher without group → verify empty dashboard with "contact admin" message.

- [ ] **Step 3: Write soft delete test**

Test flow: Login as admin → delete student → verify student disappears from list → verify counsellor's other students still visible.

- [ ] **Step 4: Run tests headed**

```bash
npx playwright test apps/web/e2e/verify-permissions.spec.ts --headed
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/verify-permissions.spec.ts
git commit -m "test: add permission enforcement and soft delete E2E tests"
```
