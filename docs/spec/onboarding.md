# Onboarding Spec
<!-- spec-tracks: apps/web/src/pages/Onboarding/Onboarding.jsx, backend/app/api/v1/routes/account.py -->

## Onboarding Wizard (/onboarding)

### Elements

**Step Indicator** (centered, horizontal)
- Step 1 circle — number "1" or checkmark when complete; label "School Info"
- Step 2 circle — number "2" or checkmark when complete; label "Create Teachers"
- Step 3 circle — number "3"; label "Ready"
- Active step: primary background, white text, bold label
- Completed step: primary background at 60% opacity, white checkmark
- Future step: border/gray background, secondary text

**Wizard Card** (max-width 640px, centered, surface background, rounded, padded)

**Step 1: School Information**
- "School Information" heading (h1, 2xl, bold, centered)
- Description paragraph (md font, secondary color, centered)
- "School Name" label (sm font, medium weight)
- School Name input (id: school-name, autoFocus) with placeholder
- "Email Domain" label (sm font, medium weight)
- Email Domain input (id: email-domain) with placeholder
- Email domain helper text (xs font, secondary) — explains purpose
- "Next" button — disabled when school name empty or loading; text changes during submission

**Step 2: Create Teachers**
- "Create Teachers" heading (h1, 2xl, bold, centered)
- Description paragraph
- "Teacher Name" label + input (id: teacher-name) with placeholder
- "Teacher Email" label + input (id: teacher-email, type: email) with placeholder
- "Add Teacher" button (secondary) — disabled when either field empty or loading
- Teacher list (visible when teachers.length > 0):
  - Per row: display_name (sm, bold), email (xs, secondary), "Remove" button (danger color, xs)
- "Back" button (outline) — returns to step 1
- "Skip Teachers" button (secondary) — advances to step 3
- "Next" button — visible only when ≥1 teacher added

**Step 3: All Set**
- "All Set!" heading (h1, 2xl, bold, centered)
- Description paragraph — ready message
- "Go to Dashboard" button — completes onboarding, navigates to /dashboard

### Data flow

Step 1: POST /api/v1/account/setup-organisation {school_name, email_domain?}
→ {id, name, already_existed}
- Creates Organisation + OrganisationMembership (role: owner, permission: read_write)
- Auto-creates "All Students" default cohort
- If org already exists: updates name from placeholder, updates email_domain

Step 2: POST /api/v1/admin/users/create-teacher {display_name, email, password: "changeme123"}
→ {id, display_name, email}

Step 3: No API call. Sets localStorage.onboarding_complete = 'true', navigates to /dashboard.

### Key behaviors
- Entry condition: Dashboard redirects here when onboarding_complete not set AND 0 students
- Linear wizard: can go back from step 2 to step 1; can skip step 2
- Org creation idempotency: updates existing org if name starts with "pending-"
- Teacher default password: "changeme123" for all onboarding-created teachers
- Teacher list is client-side: removing from list doesn't delete backend account
- No skip for step 1: school name is mandatory
- Toast notifications on success/failure for teacher add and org creation
