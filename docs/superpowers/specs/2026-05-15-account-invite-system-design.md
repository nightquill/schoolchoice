# Account & Invite System — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Replace the auto-generated @student.local fake accounts with a proper email-based account system. CSV import creates student data records only (no accounts). Admin invites students via email. Students set their own passwords via invite link. Unaccounted student data can be linked to new accounts or merged into existing ones.

## Data Model

Two separate entities (already exist, no schema changes needed):

- **Student record** (`students` table) — academic data: name, grades, class, targets. Created by import. Exists independently of any login account.
- **User account** (`users` table) — login credentials: email, password hash. Created by invite acceptance. Linked to student via `User.student_id` FK.

**Unaccounted** = a student record with no linked User account (no row in `users` where `student_id` = this student's id).

### New columns

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `students` | `invite_token_jti` | String(36), nullable | Current valid invite token ID. Cleared on accept. Set on invite/reinvite. |
| `students` | `invite_sent_at` | Timestamp, nullable | When the last invite was generated |
| `students` | `invite_accepted_at` | Timestamp, nullable | When the student accepted and created account |

### Cleanup

Delete all 15 existing `@student.local` User accounts. Null out their `student_id` references first so student data is preserved.

## Account Lifecycle

### Stage 1: Data Import

- Admin uploads CSV (may include `email` column)
- Student records created — all unaccounted
- If CSV has email, stored on `Student.email`
- No User accounts created

### Stage 2: Invite (admin-initiated)

- Admin views student list, filters "Unaccounted"
- Selects students with emails → "Send Invites" (bulk or single)
- System generates signed JWT invite token per student (48h expiry)
- Invite links displayed to admin (copy/print/distribute)
- Email delivery is a future enhancement (SMTP/SendGrid) — token system is the same

### Stage 3: Onboarding (student)

- Student opens `/invite/{token}`
- Page shows: "Welcome, [name]. Set your password to access your school portal."
- Student sets password (min 8 chars)
- Account created: User record with real email, hashed password, `role=student`, `student_id` linked
- User auto-added to org via OrganisationMembership
- Token consumed (`invite_token_jti` cleared, `invite_accepted_at` set)
- Auto-login: returns JWT access token, redirects to student dashboard

### Stage 4: Ongoing

- **Password reset**: `POST /auth/forgot-password` → generates reset token → displayed to admin (email later). `POST /auth/reset-password/{token}` → sets new password.
- **Admin re-invite**: Regenerates invite link for students who lost theirs or whose token expired.
- **Deactivation**: Admin toggles `is_active` (already exists).

### Stage 5: Merge (duplicate data)

- Admin sees unaccounted student record that duplicates an existing accounted student
- Chooses "Link to Existing Account" → selects target student
- System merges grades, profile (fill blanks), targets, cohort memberships from unaccounted → target
- Unaccounted student record deleted after merge

## API Endpoints

### Unaccounted filter

```
GET /students?unaccounted=true
```

Add query param to existing student list endpoint. Returns students where no User record has `student_id` pointing to them.

### Invite management (admin only)

```
POST /admin/students/invite
  body: {student_ids: ["uuid", ...]}
  returns: {invites: [{student_id, name, email, invite_url, expires_at}, ...], errors: [...]}
```

Bulk generate invite tokens. Students must have `email` set. Returns invite URLs.

```
POST /admin/students/{id}/invite
  body: {email: "student@school.hk"}  (optional — sets email if not already set)
  returns: {invite_url, expires_at}
```

Single invite. If email provided, updates `Student.email` first.

```
POST /admin/students/{id}/reinvite
  returns: {invite_url, expires_at}
```

Regenerate invite for existing student. Invalidates previous token.

### Invite acceptance (public, no auth)

```
GET /auth/invite/{token}
  returns: {valid: true, student_name, school_name, email}
```

Validate token. Returns student info for the UI.

```
POST /auth/invite/{token}/accept
  body: {password: "min8chars"}
  returns: {access_token, token_type, expires_in, must_change_password: false}
```

Create account, link to student, auto-login.

### Password reset (public)

```
POST /auth/forgot-password
  body: {email: "..."}
  returns: {message: "If an account exists, a reset link has been generated."}
```

Generates reset token. For now, admin retrieves via admin panel. Email delivery later.

```
POST /auth/reset-password/{token}
  body: {password: "..."}
  returns: {message: "Password updated."}
```

### Merge

```
POST /admin/students/{unaccounted_id}/merge/{target_id}
  returns: {merged_grades, merged_targets, merged_cohorts, message}
```

Merge unaccounted student data into target. Deletes unaccounted record.

### Cleanup (one-time)

```
DELETE /admin/cleanup/fake-accounts
  returns: {deleted: 15, message: "Removed @student.local accounts"}
```

## Invite Token Design

Signed JWT using existing `SECRET_KEY` and `python-jose`:

```python
{
    "type": "invite",          # "invite" or "reset"
    "student_id": "uuid",
    "email": "student@school.hk",
    "org_id": "uuid",
    "exp": now + 48h,
    "jti": "random-uuid"
}
```

One-time use enforcement: `Student.invite_token_jti` stores the `jti`. On acceptance, field is cleared. Token is only valid if its `jti` matches the stored value. Re-invite generates a new `jti`, invalidating any previous token.

For password reset tokens: same JWT pattern with `type: "reset"`, but `jti` stored on `User.reset_token_jti` (new column, nullable String(36)).

## Frontend Pages

### Student List Page (modify existing)

- Add toggle filter: "All Students" | "Unaccounted (N)" with badge count
- Unaccounted rows show orange "No Account" badge
- Row actions:
  - "Invite" (visible when email is set, no account exists)
  - "Set Email & Invite" (visible when no email set)
  - "Link to Existing" (merge into existing accounted student)
- Bulk action bar (when checkboxes selected): "Invite Selected (N)"
- After invite: row shows "Invited" badge with timestamp, invite link copyable

### Invite Acceptance Page (new: `/invite/:token`)

- Public page, no auth required
- On load: `GET /auth/invite/{token}` to validate
- If invalid/expired: error message + "Contact your school counsellor"
- If valid: shows student name, school name, password form
- Password input + confirm + submit
- On success: auto-redirect to student dashboard

### Password Reset Pages (new)

- `/forgot-password` — email input, submit → "Check with your counsellor for the reset link" (until email delivery is added)
- `/reset-password/:token` — new password form, same pattern as invite acceptance

### Admin Users Page (modify existing)

- Show linked student name for student-role accounts
- "Re-invite" button for unaccepted invites
- "Reset Password" → generates reset link (displayed, copyable)
- Invited-but-not-accepted accounts show "Pending" status

## Merge Flow Detail

1. Admin clicks "Link to Existing" on unaccounted student row
2. Modal: searchable list of existing accounted students (name, class, email)
3. Admin selects target
4. Preview: "Merge [unaccounted name] → [target name] ([target email])"
   - Shows: N grades, N targets, N cohort memberships to transfer
5. Confirm → backend executes:
   - `StudentSubjectGrade` rows: update `student_id` to target
   - Profile fields on target: fill blanks only (don't overwrite)
   - `StudentSchoolTarget` rows: update `student_id` to target
   - `CohortMembership` rows: update `student_id` to target (skip if already member)
   - Delete unaccounted student record
6. Toast: "Merged successfully. 5 grades, 2 targets transferred."

## What We Skip (YAGNI)

- SCIM/SAML/SSO
- Email delivery infrastructure (links displayed to admin for now)
- Self-registration
- Password complexity beyond min 8 chars
- MFA
- Hard account deletion (soft deactivation only)
- Account lockout after failed attempts (rate limiting already exists on login)

## Files to Modify/Create

### Backend
| File | Change |
|------|--------|
| `backend/app/modules/school_choice/models/models.py` | Add `invite_token_jti`, `invite_sent_at`, `invite_accepted_at` to Student |
| `backend/app/db/models.py` | Add `reset_token_jti` to User |
| `backend/app/api/v1/routes/invite.py` | New: invite generation, acceptance, validation endpoints |
| `backend/app/api/v1/routes/password_reset.py` | New: forgot-password, reset-password endpoints |
| `backend/app/api/v1/routes/admin.py` | Add merge endpoint, cleanup endpoint |
| `backend/app/api/v1/routes/students.py` | Add `unaccounted` query param filter |
| `backend/app/services/invite_service.py` | New: token generation, validation, account creation |
| `backend/app/services/merge_service.py` | New: student record merging |
| `backend/app/main.py` | Register new routers |

### Frontend
| File | Change |
|------|--------|
| `apps/web/src/pages/StudentListPage/StudentListPage.jsx` | Unaccounted filter, invite buttons, merge modal |
| `apps/web/src/pages/InviteAccept/InviteAccept.jsx` | New: invite acceptance page |
| `apps/web/src/pages/ResetPassword/ResetPassword.jsx` | New: password reset pages |
| `apps/web/src/api/invite.js` | New: invite API client |
| `apps/web/src/App.jsx` | Add new routes |
