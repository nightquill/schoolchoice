# Account Settings Spec
<!-- spec-tracks: apps/web/src/pages/AccountSettings/AccountSettings.jsx, backend/app/api/v1/routes/account.py, packages/ui/src/api/account.js -->

## Account Settings (/account)

### Elements

**Loading state**: LoadingSpinner with "Loading account"
**Error state**: ErrorMessage with error text

**Page Title**: "Account Settings" (h1, 2xl, bold)

**Profile Card** (hidden for student role)
- "Profile" heading (h2, lg, bold)
- "Display Name" text input (name: display_name) — pre-filled with current value
- "Save" button — disabled while saving; text "Saving..."

**Email Card**
- "Email Address" heading (h2, lg, bold)
- Email text (md font, primary) — displays account.email as plain text (not editable)
- Helper note (sm font, secondary) — "Contact admin to change email"

**Change Password Card**
- "Change Password" heading (h2, lg, bold)
- "Current Password" input (type: password) — shows "Incorrect password" on 401
- "New Password" input (type: password) — shows "New password required" when empty
- "Confirm New Password" input (type: password) — shows "Passwords don't match" on mismatch
- "Change Password" button — disabled while saving; text "Changing password..."

**Preferences Card**
- "Preferences" heading (h2, lg, bold)
- "Preferred Language" label
- "English" toggle button — active when selected (primary bg, white text); aria-pressed
- "Chinese" toggle button — active when selected; aria-pressed
- "Email Notifications" label with "Coming soon" badge (xs, secondary)
- Email notifications checkbox — disabled, aria-label "Email notifications (coming soon)"
- "Save Preferences" button — disabled while saving; text "Saving..."

**Danger Zone Card** (hidden for student role; red/error border)
- "Danger Zone" heading (h2, lg, bold, error color)
- Warning text (sm, secondary) — explains consequences
- "Delete Account" button (destructive) — opens confirmation modal

**Delete Account Modal**
- Title: "Delete Account"
- Warning paragraph
- "Password" input (type: password) — for re-authentication
- Error text — "Incorrect password" on 401 or generic failure
- "Confirm Delete" button (danger) — text "Deleting..." while in progress
- Close clears password and error state

### Data flow

On mount: GET /api/v1/account → AccountResponse {id, email, display_name, preferred_language, role, is_active, can_manage_cohorts, student_id, organisation_id, organisation_name}

Save name: PATCH /api/v1/account {display_name} → AccountResponse
Save preferences: PATCH /api/v1/account {preferred_language: "en" | "zh-HK"} → AccountResponse
- On success: updates sessionStorage/localStorage locale, calls setLocale(), triggers window.location.reload()

Change password: POST /api/v1/account/change-password {current_password, new_password, confirm_new_password}
→ {message: "Password updated successfully"}
- 400: wrong current password or passwords don't match or too short

Delete account: DELETE /api/v1/account → {message: "Account deactivated successfully"}
- Soft-delete: is_active=false, deleted_at=now(), student_id=null
- Frontend: logout() → /login
- Note: password from modal is NOT sent to DELETE endpoint (client code sends no body)

### Key behaviors
- Role-based visibility: Profile and Danger Zone hidden for students
- Language save triggers full page reload (known UX issue — spec defines current behavior)
- Password validation: client checks match first, server validates; 401 → inline error on current_password
- Delete modal state cleanup: clears on close
- Email is read-only
- Email notifications: permanently disabled placeholder
- Layout: single column, max-width 640px, centered
- Toggle button styling: active = primary bg + white text; inactive = surface bg + border; both have aria-pressed
- Student display name: backend resolves from linked Student record
