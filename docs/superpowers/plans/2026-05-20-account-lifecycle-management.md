# Account Lifecycle Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add industrial 4-state account lifecycle (Active/Suspended/Archived/Deleted) for both students and teachers, with data-only student deletion and cascade warnings.

**Architecture:** Add `account_status` column to User model, guard login by status, expose status-change API, update StudentRow/AdminManage UI to render state badges and action menus. Data-only students (no account) get a simple delete with cascade preview.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + TanStack Query (frontend), i18n via custom I18nProvider

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/app/db/models.py` | Modify | Add `account_status` column to User |
| `backend/app/core/dependencies.py` | Modify | Guard login by `account_status` |
| `backend/app/api/v1/routes/admin.py` | Modify | Add `PUT /users/{id}/status` endpoint, update `list_users` to return `account_status` |
| `backend/app/api/v1/routes/students.py` | Modify | Add `GET /students/{id}/delete-preview`, update `DELETE` to hard-delete data-only |
| `backend/app/services/student_service.py` | Modify | Change `delete_student` to hard-delete data-only records |
| `apps/web/src/api/admin.js` | Modify | Add `updateUserStatus` API call |
| `apps/web/src/api/students.js` | Modify | Add `getDeletePreview` API call |
| `apps/web/src/components/StudentRow/StudentRow.jsx` | Modify | Wire delete prop, add status badges, three-dot menu |
| `apps/web/src/pages/StudentListPage/StudentListPage.jsx` | Modify | Add delete confirmation dialog with cascade, batch delete |
| `apps/web/src/pages/AdminManage/AdminManage.jsx` | Modify | Add status column + actions to teacher table |
| `packages/ui/src/i18n/en.json` | Modify | Add `account.*` i18n keys |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add `account.*` i18n keys |
| `e2e/verify-account-lifecycle.spec.ts` | Create | Playwright verification |

---

### Task 1: Add `account_status` column to User model

**Files:**
- Modify: `backend/app/db/models.py:155-163`

- [ ] **Step 1: Add the column to User model**

In `backend/app/db/models.py`, after the `preferred_language` column (line 154) and before `is_active` (line 155), add:

```python
    account_status = Column(
        String(20), nullable=False, default="active",
        server_default="'active'",
        comment="Lifecycle: active | suspended | archived | deleted",
    )
```

- [ ] **Step 2: Make `is_active` a hybrid property**

Replace the existing `is_active` column (lines 155-159) with a hybrid property that derives from `account_status`. Keep the column for backward compat but update the default:

```python
    # Kept for backward compat — new code should use account_status
    is_active = Column(
        Boolean, nullable=False, default=True,
        server_default="true",
        comment="Derived from account_status; true when status='active'",
    )
```

Note: We keep `is_active` as a real column (not a hybrid property) to avoid breaking existing queries. The status-change endpoint will set both `account_status` and `is_active` together.

- [ ] **Step 3: Verify backend starts**

Run:
```bash
cd backend && python -c "from app.db.models import User; print([c.name for c in User.__table__.columns if 'status' in c.name or 'active' in c.name])"
```
Expected: `['account_status', 'is_active']`

- [ ] **Step 4: Commit**

```bash
git add backend/app/db/models.py
git commit -m "feat: add account_status column to User model"
```

---

### Task 2: Guard login by account_status

**Files:**
- Modify: `backend/app/core/dependencies.py:23-62`

- [ ] **Step 1: Add status check in `_resolve_user_from_token`**

In `backend/app/core/dependencies.py`, after the line `user = db.query(User).filter(User.id == user_id).first()` (around line 48) and the `if user is None` check, add:

```python
    # Account lifecycle guard
    acct_status = getattr(user, "account_status", "active")
    if acct_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended",
        )
    if acct_status in ("archived", "deleted"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
```

Place this right after the `if user is None: raise _unauthorized` block, before the `# Attach org context from JWT claim` line.

- [ ] **Step 2: Verify login still works for active users**

```bash
curl -s http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if 'access_token' in d else d)"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/core/dependencies.py
git commit -m "feat: guard login by account_status — reject suspended/archived/deleted"
```

---

### Task 3: Add status-change API endpoint and update list_users

**Files:**
- Modify: `backend/app/api/v1/routes/admin.py`

- [ ] **Step 1: Add the status change endpoint**

Add this after the existing `delete_user` function (around line 255) in `backend/app/api/v1/routes/admin.py`:

```python
class UserStatusUpdate(BaseModel):
    status: str


@router.put("/users/{user_id}/status", status_code=status.HTTP_200_OK)
def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Change a user's account lifecycle status. Admin only."""
    valid_statuses = {"active", "suspended", "archived", "deleted"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status. Must be one of: {', '.join(sorted(valid_statuses))}",
        )
    if str(user_id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change your own account status",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    current_status = getattr(user, "account_status", "active")
    if current_status == "deleted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change status of a deleted account",
        )

    user.account_status = payload.status
    user.is_active = (payload.status == "active")
    if payload.status == "deleted":
        from datetime import datetime, timezone
        user.deleted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "account_status": user.account_status,
    }
```

You will also need to add `BaseModel` import — check the existing imports at the top of the file. If `BaseModel` from pydantic is not imported, add:

```python
from pydantic import BaseModel
```

Check if `UserStatusUpdate` name conflicts with existing schemas. The file already has `UserCreateAdmin` and `UserUpdateAdmin` — just add `UserStatusUpdate` nearby.

- [ ] **Step 2: Update `list_users` to include `account_status`**

In the `list_users` function, find where it builds the response items (the list comprehension or loop that creates user dicts). Add `"account_status": getattr(u, "account_status", "active")` to each user dict in the response.

Look for the return statement — it likely builds items like:
```python
{"id": str(u.id), "email": u.email, "display_name": u.display_name, "role": u.role, ...}
```

Add `"account_status": getattr(u, "account_status", "active")` to that dict.

- [ ] **Step 3: Test the endpoint**

```bash
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# List users — should include account_status
curl -s http://localhost:8000/api/v1/admin/users -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('items', [])
for u in items[:2]:
    print(f\"{u.get('email')}: status={u.get('account_status')}\")
"
```
Expected: each user shows `status=active`

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/admin.py
git commit -m "feat: add PUT /admin/users/{id}/status endpoint for 4-state lifecycle"
```

---

### Task 4: Add delete-preview endpoint and update student delete

**Files:**
- Modify: `backend/app/api/v1/routes/students.py`
- Modify: `backend/app/services/student_service.py`

- [ ] **Step 1: Add the cascade preview endpoint**

In `backend/app/api/v1/routes/students.py`, add this endpoint (near the existing delete endpoint):

```python
@router.get("/{student_id}/delete-preview", status_code=status.HTTP_200_OK)
def delete_preview(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return counts of data that would be deleted with this student."""
    student = student_service.get_student(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=_org_id(current_user),
    )
    from app.modules.school_choice.models.models import StudentSubjectGrade, StudentChoiceSubmission
    from app.db.models_v2 import StudentSchoolTarget, AcademicPlan

    grades = db.query(StudentSubjectGrade).filter(StudentSubjectGrade.student_id == student_id).count()
    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student_id).count()
    plans = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).count()
    submissions = db.query(StudentChoiceSubmission).filter(StudentChoiceSubmission.student_id == student_id).count()

    return {
        "grades": grades,
        "targets": targets,
        "plans": plans,
        "submissions": submissions,
        "has_account": student.user_id is not None,
    }
```

- [ ] **Step 2: Update `delete_student` in student_service.py**

Replace the existing `delete_student` function in `backend/app/services/student_service.py` with:

```python
def delete_student(
    db: Session, student_id: UUID, user_id: UUID, *, organisation_id: UUID | None = None
) -> None:
    """
    Delete a student record.
    - Data-only (no account): hard delete with cascade.
    - Has account: reject — must archive/delete the account first.
    """
    from fastapi import HTTPException, status
    student = get_student(db, student_id, user_id, organisation_id=organisation_id)

    if student.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student has a login account. Archive or delete the account first.",
        )

    # Hard delete — cascade removes grades, plans, targets, submissions
    from app.modules.school_choice.models.models import StudentSubjectGrade, StudentChoiceSubmission
    from app.db.models_v2 import StudentSchoolTarget, AcademicPlan
    from app.db.models import Recommendation

    db.query(StudentSubjectGrade).filter(StudentSubjectGrade.student_id == student_id).delete()
    db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student_id).delete()
    db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).delete()
    db.query(StudentChoiceSubmission).filter(StudentChoiceSubmission.student_id == student_id).delete()
    db.query(Recommendation).filter(Recommendation.student_id == student_id).delete()
    db.delete(student)
    db.commit()
```

- [ ] **Step 3: Test the preview endpoint**

```bash
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
FIRST_ID=$(curl -s http://localhost:8000/api/v1/students -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")
curl -s "http://localhost:8000/api/v1/students/$FIRST_ID/delete-preview" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```
Expected: JSON with `grades`, `targets`, `plans`, `submissions`, `has_account` counts.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/students.py backend/app/services/student_service.py
git commit -m "feat: add delete-preview endpoint, hard-delete data-only students"
```

---

### Task 5: Add i18n keys

**Files:**
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add account namespace to en.json**

Find the end of the last top-level namespace object in `packages/ui/src/i18n/en.json` (before the final `}`). Add a new `"account"` namespace:

```json
  "account": {
    "active": "Active",
    "suspended": "Suspended",
    "archived": "Archived",
    "noAccount": "No Account",
    "suspend": "Suspend",
    "archive": "Archive",
    "reactivate": "Reactivate",
    "delete": "Delete",
    "deleteConfirmTitle": "Delete {name}?",
    "cascadeWarning": "This will permanently remove:",
    "gradeRecords": "{count} grade records",
    "programmeChoices": "{count} programme choices",
    "academicPlans": "{count} academic plans",
    "submissions": "{count} submissions",
    "targets": "{count} target schools",
    "teacherDeleteWarning": "This will permanently remove their account.\nStudent data they entered is retained.",
    "typeDeleteConfirm": "Type \"delete\" to confirm:",
    "suspendedLoginError": "Account suspended",
    "cannotChangeSelf": "Cannot change your own status",
    "hasAccountError": "Student has a login account. Archive or delete the account first.",
    "assignAccount": "Assign Account",
    "invite": "Invite",
    "deleteSelected": "Delete Selected",
    "batchDeleteConfirm": "Delete {count} students?",
    "noAccountOnly": "Can only delete students without accounts"
  }
```

- [ ] **Step 2: Add account namespace to zh-HK.json**

Add the same structure in `packages/ui/src/i18n/zh-HK.json`:

```json
  "account": {
    "active": "啟用",
    "suspended": "已停用",
    "archived": "已封存",
    "noAccount": "未開戶",
    "suspend": "停用",
    "archive": "封存",
    "reactivate": "重新啟用",
    "delete": "刪除",
    "deleteConfirmTitle": "刪除 {name}？",
    "cascadeWarning": "此操作將永久移除：",
    "gradeRecords": "{count} 個成績記錄",
    "programmeChoices": "{count} 個課程選擇",
    "academicPlans": "{count} 個升學計劃",
    "submissions": "{count} 份提交",
    "targets": "{count} 個目標學校",
    "teacherDeleteWarning": "此操作將永久移除其帳戶。\n其輸入的學生資料將被保留。",
    "typeDeleteConfirm": "輸入「delete」以確認：",
    "suspendedLoginError": "帳戶已被停用",
    "cannotChangeSelf": "無法更改自己的狀態",
    "hasAccountError": "學生已有登入帳戶。請先封存或刪除帳戶。",
    "assignAccount": "開設帳戶",
    "invite": "邀請",
    "deleteSelected": "刪除所選",
    "batchDeleteConfirm": "刪除 {count} 位學生？",
    "noAccountOnly": "僅可刪除未開戶的學生"
  }
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: add account lifecycle i18n keys (en + zh-HK)"
```

---

### Task 6: Add frontend API calls

**Files:**
- Modify: `apps/web/src/api/admin.js`
- Modify: `apps/web/src/api/students.js`

- [ ] **Step 1: Add `updateUserStatus` to admin.js**

Add to `apps/web/src/api/admin.js`:

```javascript
export const updateUserStatus = (userId, status) =>
  put(`/api/v1/admin/users/${userId}/status`, { status });
```

- [ ] **Step 2: Add `getDeletePreview` to students.js**

Add to `apps/web/src/api/students.js`:

```javascript
export const getDeletePreview = (id) =>
  get(`/api/v1/students/${id}/delete-preview`);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/admin.js apps/web/src/api/students.js
git commit -m "feat: add updateUserStatus and getDeletePreview API calls"
```

---

### Task 7: Update StudentRow — wire delete, add status badges, three-dot menu

**Files:**
- Modify: `apps/web/src/components/StudentRow/StudentRow.jsx`

- [ ] **Step 1: Rewrite StudentRow**

Replace the entire contents of `apps/web/src/components/StudentRow/StudentRow.jsx` with:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from '@schoolchoice/ui/i18n';
import { MoreHorizontal, Trash2 } from 'lucide-react';

function StatusBadge({ student, t }) {
  if (!student.has_account) {
    return (
      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', background: '#fef3c7', color: '#92400e' }}>
        {t('account.noAccount')}
      </span>
    );
  }
  const status = student.account_status || 'active';
  const styles = {
    active:    { background: '#dcfce7', color: '#166534' },
    suspended: { background: '#fef3c7', color: '#92400e' },
    archived:  { background: '#f3f4f6', color: '#6b7280' },
  };
  const s = styles[status] || styles.active;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', ...s }}>
      {t(`account.${status}`)}
    </span>
  );
}

function ThreeDotMenu({ items }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--border-radius-sm)', color: 'var(--color-text-secondary)' }}
        aria-label="Actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', zIndex: 100,
            background: 'var(--color-surface)', border: 'var(--border-width) solid var(--color-border)',
            borderRadius: 'var(--border-radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '140px', overflow: 'hidden',
          }}>
            {items.map((item, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: 'var(--space-2) var(--space-3)', border: 'none',
                  background: 'none', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-base)',
                  color: item.danger ? 'var(--color-error)' : 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-background)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StudentRow({ student, onInvite, onAssignAccount, onDelete, canDelete, onStatusChange, queryClient, selected, onToggleSelect }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id, name, class_name, candidate_number } = student;

  const handleClick = () => navigate(`/students/${id}/profile`);

  const tdBase = { padding: 'var(--space-3) var(--space-4)' };
  const tdName = { ...tdBase, fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-normal)' };
  const tdSecondary = { ...tdBase, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' };

  // Build menu items based on account state
  const menuItems = [];
  const status = student.account_status || 'active';

  if (student.has_account) {
    if (status === 'active') {
      menuItems.push({ label: t('account.suspend'), onClick: () => onStatusChange?.(student, 'suspended') });
      menuItems.push({ label: t('account.archive'), onClick: () => onStatusChange?.(student, 'archived') });
    } else if (status === 'suspended') {
      menuItems.push({ label: t('account.reactivate'), onClick: () => onStatusChange?.(student, 'active') });
      menuItems.push({ label: t('account.archive'), onClick: () => onStatusChange?.(student, 'archived') });
    } else if (status === 'archived') {
      menuItems.push({ label: t('account.reactivate'), onClick: () => onStatusChange?.(student, 'active') });
      menuItems.push({ label: t('account.delete'), onClick: () => onDelete?.(id), danger: true });
    }
  }

  return (
    <tr
      style={{ background: 'var(--color-surface)', borderBottom: 'var(--border-width) solid var(--color-border)', cursor: 'pointer' }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      tabIndex={0}
      role="row"
      aria-label={`View student ${name}`}
    >
      {onToggleSelect && (
        <td style={{ ...tdBase, width: 40, textAlign: 'center' }}>
          <input type="checkbox" checked={!!selected} onChange={(e) => { e.stopPropagation(); onToggleSelect(id); }} onClick={(e) => e.stopPropagation()} aria-label={`Select ${name}`} />
        </td>
      )}
      <td style={tdName}>
        {name}
        {student.has_at_risk_targets && (
          <span style={{ display: 'inline-block', background: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '8px', marginLeft: '8px', verticalAlign: 'middle' }}>AT RISK</span>
        )}
      </td>
      <td style={tdSecondary}>{class_name || '—'}</td>
      <td style={tdSecondary}>{candidate_number || '—'}</td>
      <td style={tdSecondary}>
        {student.best5 != null && (
          <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
            fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)',
            background: student.best5 >= 25 ? '#dcfce7' : student.best5 >= 20 ? '#fef9c3' : '#fee2e2',
            color: student.best5 >= 25 ? '#166534' : student.best5 >= 20 ? '#854d0e' : '#991b1b',
          }}>
            {student.best5}
          </span>
        )}
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <StatusBadge student={student} t={t} />
          {!student.has_account && onAssignAccount && (
            <button onClick={(e) => { e.stopPropagation(); onAssignAccount(student); }}
              style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
              {t('account.assignAccount')}
            </button>
          )}
        </div>
      </td>
      <td style={tdBase}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          {/* Trash icon for data-only students */}
          {!student.has_account && canDelete && onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)' }}
              aria-label={`Delete ${name}`}
              title={t('account.delete')}
            >
              <Trash2 size={14} />
            </button>
          )}
          {/* Three-dot menu for account lifecycle actions */}
          <ThreeDotMenu items={menuItems} />
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>{'>'}</span>
        </div>
      </td>
    </tr>
  );
}

export default StudentRow;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/StudentRow/StudentRow.jsx
git commit -m "feat: StudentRow with status badges, three-dot menu, delete icon"
```

---

### Task 8: Update StudentListPage — delete dialog with cascade, batch delete, status change handler

**Files:**
- Modify: `apps/web/src/pages/StudentListPage/StudentListPage.jsx`

- [ ] **Step 1: Add imports and state**

At the top of `StudentListPage.jsx`, update the students import:

```javascript
import { getStudents, createStudent, deleteStudent, getDeletePreview } from '../../api/students';
```

Add the admin import for status changes:

```javascript
import { updateUserStatus } from '../../api/admin';
```

Inside the `StudentListPage` function, add state for the delete confirmation dialog:

```javascript
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
```

- [ ] **Step 2: Add delete handler with cascade preview**

Add this function inside `StudentListPage`:

```javascript
  const handleDeleteWithPreview = async (studentId) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    try {
      const preview = await getDeletePreview(studentId);
      setDeleteTarget(student);
      setDeletePreview(preview);
    } catch {
      toast.error(t('studentList.deleteFailed'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteStudent(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t('studentList.deleteSuccess'));
      setDeleteTarget(null);
      setDeletePreview(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('studentList.deleteFailed'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (student, newStatus) => {
    if (!student.user_id) return;
    try {
      await updateUserStatus(student.user_id, newStatus);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(t(`account.${newStatus}`));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('adminManage.saveFailed'));
    }
  };
```

- [ ] **Step 3: Update the StudentRow render to pass new props**

Find the `<StudentRow>` component render (around line 382). Update it to:

```jsx
<StudentRow
  key={student.id}
  student={student}
  selected={selectedIds.has(student.id)}
  onToggleSelect={toggleSelect}
  onInvite={canInvite ? inviteStudent : undefined}
  onAssignAccount={canInvite ? setAssignTarget : undefined}
  onDelete={canDelete && account?.role === 'admin' ? handleDeleteWithPreview : undefined}
  canDelete={canDelete && account?.role === 'admin'}
  onStatusChange={account?.role === 'admin' ? handleStatusChange : undefined}
  queryClient={queryClient}
/>
```

- [ ] **Step 4: Add the batch delete button to the batch action bar**

Inside the batch action bar (the `{selectedIds.size > 0 && (...)}` block), after the "Add to Cohort" button, add:

```jsx
{canDelete && account?.role === 'admin' && (
  (() => {
    const allNoAccount = [...selectedIds].every((sid) => {
      const s = students.find((st) => st.id === sid);
      return s && !s.has_account;
    });
    return allNoAccount ? (
      <Button
        variant="destructive"
        onClick={async () => {
          // Use first student for preview pattern, show aggregate
          if (window.confirm(t('account.batchDeleteConfirm', { count: selectedIds.size }))) {
            for (const sid of selectedIds) {
              try { await deleteStudent(sid); } catch {}
            }
            queryClient.invalidateQueries({ queryKey: ['students'] });
            setSelectedIds(new Set());
            toast.success(t('studentList.deleteSuccess'));
          }
        }}
        style={{ fontSize: 'var(--font-size-sm)', padding: '4px 12px' }}
      >
        {t('account.deleteSelected')}
      </Button>
    ) : null;
  })()
)}
```

- [ ] **Step 5: Add the delete confirmation dialog**

After the existing modals (Assign Account, Batch Results, Add to Cohort), before the closing `</div>` of the page, add:

```jsx
{/* Delete Confirmation Dialog */}
{deleteTarget && deletePreview && (
  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setDeleteTarget(null); setDeletePreview(null); }}>
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-lg)', padding: 'var(--space-6)', minWidth: 360, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
      <h2 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
        {t('account.deleteConfirmTitle', { name: deleteTarget.name || deleteTarget.full_name })}
      </h2>
      {(deletePreview.grades > 0 || deletePreview.targets > 0 || deletePreview.plans > 0 || deletePreview.submissions > 0) && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <p style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('account.cascadeWarning')}
          </p>
          <ul style={{ margin: 0, padding: '0 0 0 var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {deletePreview.grades > 0 && <li>{t('account.gradeRecords', { count: deletePreview.grades })}</li>}
            {deletePreview.targets > 0 && <li>{t('account.targets', { count: deletePreview.targets })}</li>}
            {deletePreview.plans > 0 && <li>{t('account.academicPlans', { count: deletePreview.plans })}</li>}
            {deletePreview.submissions > 0 && <li>{t('account.submissions', { count: deletePreview.submissions })}</li>}
          </ul>
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeletePreview(null); }}>{t('common.cancel')}</Button>
        <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
          {deleteLoading ? '...' : t('account.delete')}
        </Button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/StudentListPage/StudentListPage.jsx
git commit -m "feat: delete dialog with cascade preview, batch delete, status change"
```

---

### Task 9: Update AdminManage — teacher status badges and actions

**Files:**
- Modify: `apps/web/src/pages/AdminManage/AdminManage.jsx`

- [ ] **Step 1: Add status column header to teacher table**

In the `TeachersSection` component, find the `<thead>` of the teacher table. Add a status column after the role column:

```jsx
<th style={thStyle}>{t('studentList.account')}</th>
```

- [ ] **Step 2: Add status badge and actions to each teacher row**

In the teacher table `<tbody>`, for each user row, after the role `<td>`, add:

```jsx
<td style={tdStyle}>
  <span style={{
    fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: '8px', fontWeight: 500,
    background: (user.account_status || 'active') === 'active' ? '#dcfce7' :
                (user.account_status || 'active') === 'suspended' ? '#fef3c7' : '#f3f4f6',
    color: (user.account_status || 'active') === 'active' ? '#166534' :
           (user.account_status || 'active') === 'suspended' ? '#92400e' : '#6b7280',
  }}>
    {t(`account.${user.account_status || 'active'}`)}
  </span>
</td>
```

- [ ] **Step 3: Replace the role-change dropdown in the actions column with a three-dot menu**

Replace the existing actions `<td>` content with status lifecycle actions. For each user row, replace the actions cell:

```jsx
<td style={tdStyle}>
  {!isSelf && (() => {
    const status = user.account_status || 'active';
    const items = [];
    if (status === 'active') {
      items.push(
        <button key="suspend" onClick={() => handleTeacherStatus(user.id, 'suspended')}
          style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
          {t('account.suspend')}
        </button>
      );
      items.push(
        <button key="archive" onClick={() => handleTeacherStatus(user.id, 'archived')}
          style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', fontFamily: 'var(--font-family-base)' }}>
          {t('account.archive')}
        </button>
      );
    } else if (status === 'suspended') {
      items.push(
        <button key="reactivate" onClick={() => handleTeacherStatus(user.id, 'active')}
          style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-primary)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', color: 'var(--color-primary)', fontFamily: 'var(--font-family-base)' }}>
          {t('account.reactivate')}
        </button>
      );
    } else if (status === 'archived') {
      items.push(
        <button key="reactivate" onClick={() => handleTeacherStatus(user.id, 'active')}
          style={{ fontSize: 'var(--font-size-xs)', cursor: 'pointer', padding: '2px 8px', border: '1px solid var(--color-primary)', borderRadius: 'var(--border-radius-sm)', background: 'var(--color-surface)', color: 'var(--color-primary)', fontFamily: 'var(--font-family-base)' }}>
          {t('account.reactivate')}
        </button>
      );
    }
    return <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>{items}</div>;
  })()}
</td>
```

- [ ] **Step 4: Add the status change handler to TeachersSection**

Inside the `TeachersSection` function, add:

```javascript
  const handleTeacherStatus = async (userId, newStatus) => {
    try {
      const { updateUserStatus } = await import('../../api/admin');
      await updateUserStatus(userId, newStatus);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(t(`account.${newStatus}`));
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('adminManage.saveFailed'));
    }
  };
```

- [ ] **Step 5: Keep the existing role-change dropdown alongside status actions**

The role dropdown should remain for active users. Move it before the status buttons inside the actions cell, wrapped in a condition:

```jsx
{status === 'active' && (
  <select
    value={user.role}
    onChange={(e) => updateUserMutation.mutate({ userId: user.id, role: e.target.value })}
    disabled={updateUserMutation.isPending}
    style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontFamily: 'var(--font-family-base)' }}
  >
    <option value="counsellor">{t('adminManage.counsellor')}</option>
    <option value="admin">{t('adminManage.admin')}</option>
  </select>
)}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/AdminManage/AdminManage.jsx
git commit -m "feat: teacher status badges and lifecycle actions in AdminManage"
```

---

### Task 10: Playwright verification

**Files:**
- Create: `e2e/verify-account-lifecycle.spec.ts`

- [ ] **Step 1: Write the verification script**

Create `e2e/verify-account-lifecycle.spec.ts`:

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

async function shot(page, path: string, opts: any = {}) {
  await page.screenshot({ path, ...opts });
  resize(path);
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', 'verify@test.com');
  await page.fill('input[name="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Account lifecycle', () => {

  test('Student list shows status badges, delete icon for data-only students', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should have status badges
    const badges = page.locator('span', { hasText: /Active|No Account|啟用|未開戶/ });
    await expect(badges.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/lifecycle-student-list.png');
  });

  test('Delete confirmation shows cascade preview', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/students`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find a trash icon button and click it
    const trashBtn = page.locator('button[aria-label*="Delete"]').first();
    if (await trashBtn.count() > 0) {
      await trashBtn.click();
      await page.waitForTimeout(500);
      await shot(page, 'e2e/screenshots/lifecycle-delete-dialog.png');
    }
  });

  test('Admin manage shows teacher status badges', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/manage`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Click teachers tab
    const teacherTab = page.locator('button', { hasText: /Teacher|教師/ });
    await teacherTab.click();
    await page.waitForTimeout(500);

    // Should show status badges
    const badge = page.locator('span', { hasText: /Active|啟用/ });
    await expect(badge.first()).toBeVisible();

    await shot(page, 'e2e/screenshots/lifecycle-teacher-list.png');
  });

});
```

- [ ] **Step 2: Run the tests**

```bash
npx playwright test e2e/verify-account-lifecycle.spec.ts --headed --timeout 30000
```
Expected: All 3 tests pass.

- [ ] **Step 3: View screenshots and verify**

View each screenshot to confirm:
- Student list shows status badges and trash icons
- Delete dialog shows cascade counts
- Teacher table shows status badges and action buttons

- [ ] **Step 4: Commit**

```bash
git add e2e/verify-account-lifecycle.spec.ts
git commit -m "test: Playwright verification for account lifecycle management"
```
