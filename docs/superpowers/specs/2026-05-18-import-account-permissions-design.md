# Import & Account Assignment Permissions — Design Spec

**Date:** 2026-05-18
**Status:** Approved

## Summary

Add two new permission tools (`data_import`, `account_assignment`) to the existing cohort-based teacher group permission system. Import always creates unaccounted students (even with email). Account assignment is an explicit permissioned action. Security-hardened with per-student cohort checks, no role-default fallback for these tools, and mandatory cohort assignment on import.

## New Permission Tools

| Tool key | Controls | Default | Notes |
|----------|----------|---------|-------|
| `data_import` | Upload CSV, create/update students and grades | `none` | Never a role default. Only explicit grant. |
| `account_assignment` | Assign email to unaccounted student, trigger invite | `none` | Never a role default. Only explicit grant. |

Updated `TOOL_FIELDS` (8 total):
```
programme_choices, grades, plan_generation, submissions,
reports, cohort_management, data_import, account_assignment
```

`ROLE_DEFAULTS`: admin gets `read_write` for all 8. Counsellor and student get `none` for `data_import` and `account_assignment`. These two tools are NEVER granted by role default — only by explicit teacher group → cohort permission.

## Data Import Permission Flow

### Permission check
1. Preview: user must have `data_import` at `read_only` or `read_write` on at least one cohort
2. Commit: user must have `data_import=read_write` on at least one cohort
3. Per-row: if CSV specifies a cohort column, verify user has `data_import=read_write` on that specific cohort. Rows targeting unauthorized cohorts are rejected with error.

### Mandatory cohort assignment
- If CSV has a `cohort` column → students assigned to that cohort (existing behavior)
- If CSV has NO cohort column → students assigned to an auto-created cohort named `Import {date} by {user_display_name}`. This cohort gets visibility only for the groups the importing user belongs to (auto-creates CohortPermission rows with `visible=true, data_import=read_write` for those groups).
- Students are NEVER left orphaned outside the cohort system.

### Unaccounted rule
- All imported students are unaccounted, even if CSV has an email column
- Email is stored on the student record for later use
- Account activation is a separate permissioned step (account_assignment)

## Account Assignment Permission Flow

### Who can assign
- Teacher with `account_assignment=read_write` on the student's cohort(s)
- Admin (bypasses all checks)
- `account_assignment=read_only` → can see unaccounted students but cannot assign
- `account_assignment=none` → unaccounted students in that cohort behave normally (visible per cohort visibility, but no invite button shown)

### Assignment flow
1. Teacher clicks "Assign Account" on an unaccounted student
2. Enters/confirms email (pre-filled if CSV had one)
3. Backend checks `account_assignment=read_write` for that student's cohort(s)
4. Backend generates invite token, stores JTI on student, sets invite_sent_at
5. Returns invite URL to teacher (copy/print). Email delivery is future SMTP enhancement.
6. Student opens invite link → sets password → account created and linked

### Audit
- `invite_sent_at` timestamp on student record
- `invite_accepted_at` timestamp when accepted
- The inviting user's ID is tracked (already in the invite token's JWT claims via the auth context)

## Security Hardening

### 1. Import cohort scoping
Import commit verifies per-row that the user has `data_import=read_write` on the target cohort. Rows for unauthorized cohorts are rejected with explicit error messages. No silent skipping.

### 2. No role-default fallback for elevated tools
`data_import` and `account_assignment` return `none` for all roles in `ROLE_DEFAULTS` (except admin). A counsellor NOT in any teacher group cannot import or assign accounts. This prevents the "no group = default counsellor permissions" bypass.

### 3. Per-student permission check on invite endpoints
All invite endpoints (single, bulk, reinvite) check `account_assignment` permission against each student's cohort(s). Not just role-based. Prevents cross-cohort invite abuse.

### 4. Permission checked at both preview and commit
Import permission is verified at preview time AND again at commit time. Prevents race condition where admin revokes permission between preview and commit.

### 5. Mandatory cohort assignment prevents orphaned students
Students without a cohort would bypass the entire permission system (no cohort = no permission filter). Import MUST assign every student to a cohort. Auto-created import cohorts prevent orphans.

### 6. Email validation on account assignment
Email format validated before generating invite. Invalid emails rejected immediately.

### 7. No cached permissions in JWT
JWT only carries user_id. All permission checks query current DB state (group membership + CohortPermission). Revoking a teacher's group membership takes effect immediately on next request.

## Changes Required

### Backend

**DB migration** — add 2 columns to `cohort_permissions`:
```sql
ALTER TABLE cohort_permissions ADD COLUMN data_import VARCHAR(10) NOT NULL DEFAULT 'none';
ALTER TABLE cohort_permissions ADD COLUMN account_assignment VARCHAR(10) NOT NULL DEFAULT 'none';
```

**app/services/permission_service.py:**
- Add `data_import` and `account_assignment` to `TOOL_FIELDS`
- Update `ROLE_DEFAULTS`: counsellor and student get `none` for both new tools

**app/api/v1/routes/student_import.py:**
- Preview: check `data_import >= read_only` across user's visible cohorts
- Commit: check `data_import = read_write` across user's visible cohorts
- Per-row cohort check during commit
- Auto-create import cohort when no cohort column in CSV

**app/api/v1/routes/invite.py:**
- Change `bulk_invite_students` from `require_role("admin")` to permission check: admin bypasses, others need `account_assignment=read_write` on each student's cohort
- Same for `invite_single_student` and `reinvite_student`

**app/db/models.py:**
- Add `data_import` and `account_assignment` columns to CohortPermission model

### Frontend

**GroupPermissions.jsx TOOLS array:**
```javascript
{ key: 'data_import', label: 'Data Import' },
{ key: 'account_assignment', label: 'Account Assign' },
```

**StudentListPage.jsx:**
- "Invite" button only shown when user has `account_assignment=read_write` for that student's cohort
- Import link/button only shown when user has `data_import` permission

**StudentImport page:**
- Check `data_import` permission before showing the page
- If `read_only` → show preview only, disable commit button

**i18n:** Add translation keys for new tool labels and permission-related messages in both en.json and zh-HK.json.

## What We Skip

- Email delivery (SMTP) — invite URLs displayed to teacher for now
- Per-row audit log (who imported which row) — the auto-created cohort name includes the user, sufficient for now
- Import undo/rollback — not in scope
- Notification when account is assigned — future enhancement
