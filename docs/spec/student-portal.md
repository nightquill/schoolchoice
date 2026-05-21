<!-- spec-tracks: apps/web/src/pages/StudentDashboard/StudentDashboard.jsx, apps/web/src/pages/StudentProfile/GradesTab.jsx, apps/web/src/pages/Submissions/StudentSubmissions.jsx, apps/web/src/pages/StudentPlan/StudentPlan.jsx, apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx, apps/web/src/api/plan.js, apps/web/src/api/gradeBuilds.js, backend/app/api/v1/routes/student_portal.py -->

# Student Portal Spec

Student-facing pages live within the SAME web app (`apps/web/`), not a separate app. When a user with `role: student` logs in via the shared login page (Student toggle), they are routed to student-specific pages via `DashboardRouter`.

**Architecture**: Single app, role-based routing. `DashboardRouter` renders `StudentDashboard` for students, `Dashboard` for admin/counsellor. Student nav shows only: Dashboard, My Plan, My Submissions, Schools, Account Settings.

---

## Student Login (`/login`) -- Standalone App

### Elements
- **Page wrapper**: centered card on full-screen `bg-background`
- **Heading**: "Student Portal" (h1, `text-xl font-semibold`, centered)
- **Subheading**: "Sign in to manage your programme choices" (p, `text-sm text-muted-foreground`, centered)
- **Form** (`<form>`, `space-y-4`):
  - **Candidate Number label** (`<label>` for `candidate-number`)
  - **Candidate Number input** (`<Input>`, type text, placeholder "e.g. HKDSE-2026-A001", required)
  - **Password label** (`<label>` for `password`)
  - **Password input** (`<Input>`, type password, required)
  - **Error banner** (conditional, `bg-destructive/10 text-destructive text-sm`)
  - **Sign In button** (`<Button>`, full width, disabled while loading, text toggles "Signing in..." / "Sign In")

### Data flow
- **API**: `POST /api/v1/auth/student-login`
  - Request: `{ candidate_number: string, password: string }`
  - Response: `{ access_token: string }`
- On success: calls `login(data.access_token)` from `useAuth()`, navigates to `/`
- On 404: "No account found with this candidate number. Contact your counsellor."
- On 401: server `detail` string or fallback "Incorrect password."
- Other errors: server `detail` string or fallback "Login failed. Please try again."

### Key behaviors
- If already authenticated (`useAuth().isAuthenticated`), redirects to `/` immediately (useEffect + early return `null`)
- Error clears on any input change
- Empty candidate number or password shows client-side validation: "Please enter your candidate number and password."

---

## My Grades (`/grades`) -- Standalone App

### Elements
- **Header bar** (border-b, bg-card):
  - **Back button** (`<Link to="/">`, ghost icon button with `<ArrowLeft>` icon)
  - **Title**: "My Grades" (h1, `text-lg font-semibold`)
  - **Student name** (conditional, `text-sm text-muted-foreground`, from `useAuth().user.name`)
- **Main content** (max-w-3xl, p-4):
  - **Loading state**: "Loading grades..." text
  - **Error state**: destructive banner with error message
  - **Empty state**: bordered card, centered text "No grades recorded yet." + "Your counsellor will enter your grades."
  - **Grades table** (when grades exist):
    - Container: rounded border card, overflow-hidden
    - Table headers: Subject | Sitting | Year | Grade | Predicted
    - Table rows: one per grade entry
      - Subject: `g.subject`
      - Sitting: `g.sitting || '-'`
      - Year: `g.year || '-'`
      - Grade: `g.grade || '-'` (font-medium)
      - Predicted: `g.predicted_grade || '-'`

### Data flow
- **API**: `GET /api/v1/student/grades`
  - Response: `{ grades: [{ subject_code, subject_name, sitting, year_of_exam, raw_grade, predicted_grade }] }`
  - Frontend maps: `subject` from response, handles both array and `data.grades` shapes
- Backend: joins `StudentSubjectGrade` with `Subject` table, filters by `user.student_id`

### Key behaviors
- Protected route (ProtectedRoute wrapper, redirects to `/login` if unauthenticated)
- Read-only -- no edit capabilities for students
- Graceful handling of empty grades array vs API errors

---

## My Choices (`/`) -- Standalone App

### Elements
- **Header bar** (border-b, bg-card):
  - **Title**: "My Programme Choices" (h1, `text-lg font-semibold`)
  - **Student name** (conditional, from `useAuth().user.name`)
  - **My Grades link button** (ghost, with `<BookOpen>` icon, navigates to `/grades`)
  - **Sign Out button** (ghost, calls `logout()`)
- **StatusBanner component**:
  - Draft: muted bg, "Status: Draft"
  - Pending: amber bg, "Status: Submitted -- awaiting counsellor review"
  - Approved: green bg, "Status: Approved"
  - Revision Requested: red bg, "Status: Revision Requested" + counsellor notes box (amber border/bg)
- **Programme Search** (hidden when `readOnly` i.e. status=pending):
  - **Search input** (`<Input>`, with `<Search>` icon, placeholder "Search programmes by name or JUPAS code...")
  - **Dropdown results** (absolute z-10, max-h-64, scroll):
    - Each result: button with programme name + programme code + school name
  - **No results message**: "No programmes found."
- **Ranked Choice List** (grouped by bands):
  - **Band A** (rank 1-3): red accent, `bg-red-50`
  - **Band B** (rank 4-6): amber accent, `bg-amber-50`
  - **Band C** (rank 7-10): green accent, `bg-green-50`
  - **Band D** (rank 11-14): blue accent, `bg-blue-50`
  - **Band E** (rank 15-25): gray accent, `bg-gray-50`
  - Each band section:
    - **Band header**: label + rank range (e.g. "Band A (Rank 1-3)")
    - **Choice rows**: rank number | programme name | programme code + school | match % (color-coded) | controls
  - Per-choice controls (hidden when readOnly):
    - **Move Up button** (`<ChevronUp>`, disabled at position 0)
    - **Move Down button** (`<ChevronDown>`, disabled at last position)
    - **Remove button** (`<X>`, red hover)
- **Empty state**: "No programme choices yet." + "Use the search above to add programmes."
- **Action Buttons** (visible when not readOnly and choices > 0):
  - **Save Draft button** (`<Save>` icon, variant outline, disabled while saving, text "Saving..." / "Save Draft")
  - **Submit for Approval button** (`<Send>` icon, default variant)
  - **Confirmation flow** (after first submit click):
    - Text: "Are you sure?"
    - **Yes, Submit button** (default, disabled while submitting)
    - **Cancel button** (ghost, resets confirmation)

### Data flow
- **Load choices**: `GET /api/v1/student/choices`
  - Response: `{ choices: [...], status: string, counsellor_notes: string }`
  - Handles 404 silently (no choices yet)
- **Load match scores**: `GET /api/v1/student/choices/match`
  - Response: array of `{ programme_code, match_pct }` or `{ scores: { code: pct } }`
  - Mapped to `matchScores` dictionary by programme_code
- **Search programmes**: `GET /api/v1/jupas/search?q=<query>&limit=20`
  - Response: array of `{ programme_code, programme_name, school_name }` or `{ programmes: [...] }`
  - Debounced by 300ms
- **Save choices**: `PUT /api/v1/student/choices`
  - Request: `{ choices: [{ rank, programme_code, programme_name, school_name }] }`
  - Response: `{ id, status, choices }`
- **Submit**: `POST /api/v1/student/choices/submit`
  - Response: `{ id, status: "pending" }`

### Key behaviors
- **Read-only mode**: when `status === 'pending'` -- search hidden, move/remove/action buttons hidden
- **Max 25 choices**: enforced client-side with toast error
- **Duplicate prevention**: checks `programme_code` before adding, toast info if duplicate
- **Rank auto-recalculation**: on add, remove, or reorder -- all ranks renumbered sequentially
- **Match score colors**: >= 70% green, >= 40% amber, < 40% red, null gray
- **Submit flow**: saves first, then submits. Two-click confirmation pattern.
- **Outside click**: closes search dropdown
- **Debounced search**: 300ms delay before API call
- **Loading state**: full-screen centered "Loading..." text

---

## Student Dashboard (`/student-dashboard`) -- Web App

### Elements
- **NavBarV2** (top navigation, receives account data)
- **Student header row** (flex, space-between, wrapping):
  - **Display name** (h1, 2xl bold)
  - **Student ID** (span, sm, secondary text, derived from `email.replace('@student.local', '')`)
  - **Submission status badge** (conditional, colored pill):
    - Pending: amber bg (#fef3c7), text #92400e
    - Approved: green bg (#dcfce7), text #166534
    - Revision Requested / Rejected: red bg (#fee2e2), text #991b1b
    - Draft: gray bg (#f1f5f9), text #475569
  - **Submit to Teacher button** (`<Button>`, disabled while submitting or when status=pending):
    - Text: "Submitting..." / "Awaiting Review" / "Submit to Teacher"
- **ProgrammeChoicesTab** component (reused from StudentProfile, receives `studentId`)
- **Divider** (border-top, margin-top)
- **GradesTab** component (reused from StudentProfile, receives `studentId`)

### Data flow
- **Account**: `GET /api/v1/account` (via react-query)
  - Response: `{ role, student_id, display_name, email, ... }`
- **Submission status**: `GET /api/v1/student/choices` (dynamic import of client)
  - Response: `{ submission: { status } }`
- **Submit flow**:
  1. `GET /api/v1/students/{studentId}/targets` -- fetches current programme targets
  2. Filters targets with `jupas_code`, sorts by `student_rank`
  3. `PUT /api/v1/student/choices` -- saves as draft choices
  4. `POST /api/v1/student/choices/submit` -- submits for review
  - On 429: rate limit error message
  - On success: sets status to "pending", shows success toast

### Key behaviors
- **Role guard**: if `account.role !== 'student'`, redirects to `/dashboard`
- **No student_id**: shows "No profile" message with NavBar
- **Rate limiting**: backend enforces cooldown (default 3 days, configurable per org via `submission_cooldown_days` in org metadata)
- **Empty choices guard**: if no targets with jupas_code, shows error toast

---

## My Submissions (`/my-submissions`) -- Web App

### Elements
- **NavBarV2** (top navigation)
- **Back to Dashboard link** (`<Link to="/dashboard">`, primary color, sm text)
- **Page title**: "My Submissions" (h1, xl bold)
- **SubmissionHistory component** (receives `studentId` from account, `isStudent=true`):
  - **Section header**: "Submission History" (md medium, bordered bottom)
  - **Loading state**: "Loading..." text (xs, secondary)
  - **Empty state**: "No submissions" (sm, secondary, centered)
  - **History table**:
    - Headers: Submitted | Status | Choices | Reviewed | Notes
    - Per row:
      - **Submitted date** (formatted locale-aware)
      - **Status badge** (colored pill: draft/pending/approved/revision_requested/rejected)
      - **Choice count** ("X programmes")
      - **Reviewed date** (formatted or dash)
      - **Counsellor notes** (or dash)
      - **Flagged choices** (conditional, red flag icon):
        - Shows up to 3 flagged choices with rank and note
        - "+N more" for additional flags

### Data flow
- **Account**: `GET /api/v1/account`
- **Submission history** (isStudent=true path): `GET /api/v1/student/choices/history`
  - Response: `{ submissions: [{ id, status, choices, counsellor_notes, flagged_choices, submitted_at, reviewed_at, created_at }] }`

### Key behaviors
- Locale-aware date formatting (zh-HK or en-GB)
- Status color mapping consistent across all surfaces
- Flagged choices display with truncation at 3 items

---

## My Plan (`/my-plan`) -- Web App

### Elements
- **NavBarV2** (top navigation)
- **Page title**: "My Academic Plan" (h1, xl bold)
- **Loading state**: `<LoadingSpinner />`
- **Error/not released state**: `<EmptyState>` with "Plan not ready" message
- **Plan content** (when data available):
  - **Release note banner** (conditional, info-colored box):
    - Bold label "Counselor Note:" + note text
  - **Release metadata**: "Released on: [date] . v[version]" (xs, secondary)
  - **Plan iframe** (`<iframe>`, srcDoc=html_content, full width, min-height 80vh, sandboxed with `allow-same-origin`, bordered + rounded)

### Data flow
- **Account**: `GET /api/v1/account`
- **Plan**: `GET /api/v1/student/plan`
  - Response: `{ html_content, release_note, released_at, version }`
  - 404 if no plan released yet

### Key behaviors
- Plan is rendered in a sandboxed iframe using `srcDoc`
- Only released plans are shown (backend checks `plan.released_at` is not null)
- Version number displayed alongside release date

---

## Backend API Summary (Student Portal Routes)

All routes under `/api/v1/student/`, authenticated via `get_current_student` dependency.

| Endpoint | Method | Purpose |
|---|---|---|
| `/student/grades` | GET | Read-only grades (joins StudentSubjectGrade + Subject) |
| `/student/choices` | GET | Current submission (draft/pending/revision_requested), newest first |
| `/student/choices` | PUT | Save choices as draft. Max 25, no duplicates, validates jupas_codes exist. Blocked if pending submission exists (409). |
| `/student/choices/submit` | POST | Submit for approval. Rate limited (configurable cooldown). Requires non-empty choices. Clears previous counsellor notes. |
| `/student/choices/match` | GET | Real-time match scores per choice using jupas_scorer. Returns score, eligibility, risk_level. |
| `/student/choices/history` | GET | All submissions for student, newest first |
| `/student/plan` | GET | Released plan HTML + metadata (404 if unreleased) |
| `/student/grade-builds` | GET | List grade builds (max 5) |
| `/student/grade-builds` | POST | Create new grade build (max 5 enforced) |
| `/student/grade-builds/{build_id}` | PUT | Update grade build name/grades |
| `/student/grade-builds/{build_id}` | DELETE | Delete grade build |
| `/student/grade-builds/{build_id}/scores` | POST | Score a grade build against student's targets |
