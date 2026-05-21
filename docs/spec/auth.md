# Authentication Spec
<!-- spec-tracks: apps/web/src/pages/LoginPage.jsx, packages/ui/src/hooks/useAuth.jsx, backend/app/api/v1/routes/auth.py, backend/app/core/security.py -->

## Login Page (/login)

### Elements
- Mode toggle: [Teacher/Admin | Student] — switches form fields
- Teacher/Admin mode:
  - Email input (required, email format)
  - Password input (required)
  - "Log In" button
  - "Register with Token" link — shows registration form
- Student mode:
  - Candidate Number input (required, e.g. HKDSE-2026-A001)
  - Password input (required)
  - "Log In" button
- Error display: red banner below form on failed login ("Invalid credentials")
- No "forgot password" link on login page (password reset is admin-initiated)

### Data flow
- Teacher: POST /auth/login {email, password} → {access_token, user}
- Student: POST /auth/student-login {candidate_number, password} → {access_token, user}
- On success: store token, set axios default header, redirect based on role:
  - admin/counsellor → /dashboard
  - student → /dashboard (student dashboard variant)
  - First-time admin with no students → /onboarding

### Key behaviors
- Login button disabled while request in flight
- Failed login: form stays populated, error banner appears, password field cleared
- Token stored in memory (AuthProvider context) + sessionStorage
- Switching mode (Teacher ↔ Student) clears all form fields and errors

## Registration (/login → Register form)

### Elements
- Registration Token input (required, single-use)
- Email input (required, email format)
- Password input (required, 8+ chars, 1 uppercase, 1 digit)
- Confirm Password input (must match)
- "Register" button

### Data flow
- POST /auth/register {token, email, password} → {access_token, user}
- Token consumed on success (cannot reuse)

### Key behaviors
- Validation errors shown inline per field
- Invalid/consumed token: "Invalid or expired registration token"
- After registration: auto-login, redirect to /onboarding

## Invite Accept (/invite/:token)

### Elements
- Token validation on page load (shows spinner, then form or error)
- If valid: shows pre-filled org name, email input, password input
- If invalid: "This invitation link is invalid or has expired"
- "Accept & Create Account" button

### Data flow
- GET /auth/invite/{token} → validates token, returns {org_name, role}
- POST /auth/invite/{token}/accept {email, password} → {access_token, user}

### Key behaviors
- Student invites: password defaults to candidate_number (can be changed)
- After accept: auto-login, redirect to /dashboard

## Password Reset (admin-initiated)

### Elements
- No user-facing page — admin triggers via AdminManage panel
- Admin clicks "Reset Password" on user row → confirmation dialog → POST

### Data flow
- POST /admin/users/{user_id}/reset-password → sets must_change_password flag
- Next login: user is prompted to change password (must_change_password=true)

### Key behaviors
- Only admin role can trigger reset
- Reset sets a temporary password (returned to admin) + forces change on next login

## Session Management

### Rules
- Token expires after ACCESS_TOKEN_EXPIRE_MINUTES (default 30)
- Expired token: any API call returns 401 → clear auth state → redirect to /login
- Logout: clear token from memory + sessionStorage + clear QueryClient cache
- Switching accounts (multi-login): full state reset — clear all cached data
