# Account Lifecycle Management Design

**Date:** 2026-05-20
**Status:** Approved
**Scope:** 4-state account lifecycle for students and teachers, data-only student deletion

## Context

The current system has implicit account states (No Account / Invited / Active) with no ability to suspend, archive, or properly delete users. The delete button exists in code but is never rendered. Account status badges are hardcoded in English.

Industrial research (PowerSchool, ManageBac, Arbor, Google Admin) shows a clear consensus: 4-state lifecycle with archive as the default removal action and hard-delete reserved for mistakes or data-only records.

**Key distinction:** A student data record is separate from a login account. Students without accounts are just data — deletable with cascade confirmation. Students with accounts require lifecycle management.

## Data Model

### Account Status Enum

Add `account_status` column to the `User` model. Applies to both student and teacher accounts.

| Status | Meaning | Can sign in? | Visible in lists? |
|---|---|---|---|
| `active` | Normal operating state | Yes | Yes |
| `suspended` | Temporarily disabled by admin | No | Yes (flagged) |
| `archived` | Left school / graduated / departed | No | Admin only |
| `deleted` | Soft-deleted, 30-day purge window | No | No |

**Rules:**
- Column: `account_status VARCHAR(20) NOT NULL DEFAULT 'active'`
- Transitions: Active ↔ Suspended ↔ Archived → Deleted (deleted is one-way)
- Suspended/Archived accounts retain all data (grades, plans, submissions)
- Deleted accounts set `deleted_at` timestamp; hard-purge after 30 days
- `is_active` boolean becomes a computed property: `return self.account_status == 'active'`
- Migration: all existing users with `is_active=True` get `account_status='active'`; `is_active=False` get `account_status='suspended'`
- **"Invited" is not an account status** — it's a property of the student data record (`invite_sent_at` is set, `invite_accepted_at` is null). Invite status is displayed alongside "No Account" in the UI but is orthogonal to the 4-state lifecycle which only applies once an account exists.

## Backend API

### Status change endpoint

```
PUT /api/v1/admin/users/{user_id}/status
Body: { "status": "suspended" | "archived" | "active" | "deleted" }
Response: { "id": "...", "account_status": "suspended" }
```

Validation rules:
- Requires admin role
- Cannot change own status
- Cannot transition from `deleted` to any other state
- Setting `deleted` records `deleted_at = now()`

### Student delete (data-only)

Existing `DELETE /api/v1/students/{student_id}`:
- If student has no account (`user_id` is null): hard delete with cascade (grades, plans, targets, programme choices, submissions)
- If student has account: reject with 400 "Must archive or delete the account first"

### Cascade preview endpoint

```
GET /api/v1/students/{student_id}/delete-preview
Response: {
  "grades": 9,
  "plans": 1,
  "targets": 3,
  "submissions": 0,
  "has_account": false
}
```

Frontend calls this before showing the delete confirmation dialog.

### Login guard

In `get_current_user` dependency:
- `account_status == 'active'`: proceed normally
- `account_status == 'suspended'`: return 403 `{"detail": "Account suspended"}`
- `account_status == 'archived'` or `'deleted'`: return 401 `{"detail": "Account disabled"}`

## Frontend — Student List Page

### Account status badges (i18n)

| Status | i18n key | Color |
|---|---|---|
| Active | `account.active` | Green (`#dcfce7` / `#166534`) |
| Suspended | `account.suspended` | Orange (`#fef3c7` / `#92400e`) |
| Archived | `account.archived` | Gray (`#f3f4f6` / `#6b7280`) |
| No Account | `account.noAccount` | Yellow (`#fef3c7` / `#92400e`) |

### Row actions by state

**No Account (data-only):**
- "Assign Account" button (existing)
- Delete icon (trash) — triggers cascade confirmation dialog

**Active account:**
- Three-dot overflow menu → Suspend, Archive

**Suspended:**
- Three-dot overflow menu → Reactivate, Archive

**Archived:**
- Three-dot overflow menu → Reactivate, Delete (with cascade warning)

### Delete confirmation dialog (data-only students)

Simple modal with cascade count:

```
Delete [Student Name]?

This will permanently remove:
• X grade records
• Y programme choices
• Z academic plans

[Cancel]  [Delete]
```

Calls `GET /students/{id}/delete-preview` to populate counts before showing.

### Batch actions

Current batch actions retained: "Batch Assign Accounts", "Add to Cohort"
New: **"Delete Selected"** — enabled only when ALL selected students have no account. Shows aggregate cascade count.

### Wiring the existing delete button

`StudentRow` receives `onDelete` and `canDelete` props but never destructures them. Fix: add these to the component signature and render a trash icon for data-only students.

## Frontend — Teacher Management (AdminManage)

### Account status column

Add status badge column to the teacher table. Same 4-state badges as students (minus "No Account" — teachers always have accounts).

### Row actions by state

**Active:**
- Role dropdown (existing, unchanged)
- Three-dot overflow menu → Suspend, Archive
- Cannot suspend/archive self

**Suspended:**
- Three-dot overflow menu → Reactivate, Archive

**Archived:**
- Three-dot overflow menu → Reactivate, Delete

### Teacher delete confirmation (escalated)

```
Delete teacher [Name]?

This will permanently remove their account.
Student data they entered is retained.

Type "delete" to confirm: [________]

[Cancel]  [Delete] (disabled until typed)
```

Higher bar than student data deletion because teachers have permissions and group memberships.

## i18n Keys Required

```
account.active → "Active" / "啟用"
account.suspended → "Suspended" / "已停用"
account.archived → "Archived" / "已封存"
account.noAccount → "No Account" / "未開戶"
account.suspend → "Suspend" / "停用"
account.archive → "Archive" / "封存"
account.reactivate → "Reactivate" / "重新啟用"
account.deleteConfirmTitle → "Delete {name}?" / "刪除 {name}？"
account.cascadeWarning → "This will permanently remove:" / "此操作將永久移除："
account.gradeRecords → "{count} grade records" / "{count} 個成績記錄"
account.programmeChoices → "{count} programme choices" / "{count} 個課程選擇"
account.academicPlans → "{count} academic plans" / "{count} 個升學計劃"
account.teacherDeleteWarning → "This will permanently remove their account.\nStudent data they entered is retained." / "此操作將永久移除其帳戶。\n其輸入的學生資料將被保留。"
account.typeDeleteConfirm → "Type \"delete\" to confirm" / "輸入「delete」以確認"
account.suspendedLoginError → "Account suspended" / "帳戶已被停用"
account.cannotChangeSelf → "Cannot change your own status" / "無法更改自己的狀態"
```

## Migration Plan

1. Add `account_status` column to `users` table with default `'active'`
2. Backfill: `UPDATE users SET account_status = 'active' WHERE is_active = true`
3. Backfill: `UPDATE users SET account_status = 'suspended' WHERE is_active = false`
4. Add `deleted_at` column (nullable timestamp)
5. Keep `is_active` column for backward compat but derive from `account_status`

## Out of Scope

- Printable credential cards (PDF per class) — future enhancement
- QR code login — future enhancement
- Automatic 30-day purge cron job — can be added later
- Full People Management page redesign — not needed now
- SSO integration — separate project
