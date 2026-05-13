# Student Import Pipeline + Student Choice App — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Scope:** Two features sharing backend infrastructure

---

## Overview

Two features that together complete the student data lifecycle:

1. **CSV Student+Grades Import** — counsellors bulk-import student profiles and HKDSE grades from spreadsheets, with candidate_number as the canonical identifier for matching.

2. **Student Choice App** — a lightweight single-purpose web app where students enter their own JUPAS programme choices (ranked 1–25, bands A–E). Counsellors review and approve. Approved choices become official targets with JUPAS scoring auto-computed.

Both features share the existing backend, database, and `@schoolchoice/ui` component library.

---

## Feature 1: CSV Student+Grades Import

### Endpoint

`POST /api/v1/import/students` — dedicated endpoint, separate from generic entity import.

### Input Format

CSV or Excel (.xlsx) with the following columns:

**Student identity (required):**
- `candidate_number` — primary key for matching. If blank, system generates `AUTO-{uuid[:8]}`.
- `name` — required. Rows without name are rejected.

**Student profile (optional):**
- `class_name`, `year_of_study`, `gender`, `date_of_birth`, `target_region`, `preferred_language`

**Grade columns (optional, any number):**
- Column headers matching subject codes: `CHLA`, `ENGL`, `MATH`, `CSD`, `PHYS`, `CHEM`, `BIOL`, `ECON`, `HIST`, `GEOG`, `ICT`, `M1`, `M2`, `VART`, `MUSC`, `BAFS`, `CHIH`, `CHIL`
- Values must be valid HKDSE grades: `5**`, `5*`, `5`, `4`, `3`, `2`, `1`, `U`, `A`, `AD`

**Sitting context (optional):**
- `sitting` — `MOCK`, `TRIAL`, or `OFFICIAL`. Default: `OFFICIAL`.
- `year_of_exam` — integer. Default: current year.

### Matching Logic

1. Look up student by `candidate_number` within the counsellor's organisation.
2. **Found** → update profile fields (name, class, gender, etc.) with CSV values where non-empty.
3. **Not found** → create new student within counsellor's organisation. Auto-generate candidate_number if blank.
4. `candidate_number` is the system's unique student identifier going forward.

### Grade Import Logic

For each subject code column with a non-empty value:
1. Look up existing grade for this `student_id + subject_id + sitting + year_of_exam`.
2. **Found** → overwrite `raw_grade` with new value. Previous data stays as history (different year_of_exam rows).
3. **Not found** → insert new `student_subject_grades` row.
4. Trigger `_recompute_predicted()` after grade changes to keep predicted grades current.

Key rule: A MOCK import never touches OFFICIAL grades and vice versa. Each sitting type is independent.

### Two-Phase Flow

1. **Parse + Preview** — `POST /api/v1/import/students/preview`
   - Parses file, validates all rows, detects subject columns.
   - Returns: `{rows: [{candidate_number, name, status: "create"|"update"|"error", grades: {...}, warnings: [...]}], summary: {create: N, update: N, error: N, grade_count: N}}`
   - Counsellor reviews preview before committing.

2. **Commit** — `POST /api/v1/import/students/commit`
   - Accepts the validated payload from preview.
   - Performs all creates/updates/grade inserts within a single DB transaction.
   - Returns: `{created: N, updated: N, grades_imported: N, skipped: N, warnings: [...], errors: [...]}`

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty/whitespace candidate_number | Generate `AUTO-{uuid[:8]}` |
| Duplicate candidate_number in same CSV | Reject second row, report error |
| Grade value not in valid set | Skip that grade cell, report warning |
| Column header not matching any subject code | Ignore column silently |
| Missing name field | Reject row with error |
| Invalid sitting value | Default to OFFICIAL, report warning |
| Row with only candidate_number, no data | Skip row, report warning |
| Malformed encoding | Try utf-8-sig, fall back to latin-1 |
| File > 10MB | Reject at upload |
| Empty file / no data rows | Return "no data found" error |
| Candidate_number belongs to different org | No cross-org matching; create new student in current org |
| Concurrent imports of same student | DB upsert handles; last write wins per field |
| candidate_number has special characters | Sanitise to alphanumeric + hyphens only |

### Frontend Integration

- Dashboard "Import (CSV / Excel)" button routes to `/import/students` (new page, replaces generic entity import for students).
- Two-step wizard: Upload → Preview (shows table of create/update/error rows + grade counts) → Commit.
- Sample CSV download link with grades included.

---

## Feature 2: Student Choice App

### Architecture

```
apps/student/          — New Vite SPA (lightweight)
  src/
    pages/
      Login.jsx        — candidate_number + password
      MyGrades.jsx     — read-only grade display
      MyChoices.jsx    — ranked 1-25 programme selector
    App.jsx            — router (3 routes)
    main.jsx           — entry point
```

Shares:
- `packages/ui/` — primitives, i18n, auth context, API client
- Backend API at same `VITE_API_BASE_URL`
- Same database, same JWT auth system

### Student Authentication

**New role:** `student` (alongside existing `counsellor`, `admin`).

**Account creation flow:**
- When a student record is created (via CSV import or manually by counsellor), the system can auto-create a user account.
- Login credentials: `candidate_number` as username, password set by counsellor (or default `{candidate_number}` that must be changed on first login).
- JWT claims for student: `{sub: user_id, role: "student", student_id: student_uuid}`.
- Student can ONLY access their own data — enforced by `student_id` from JWT on every query.

**New endpoint:** `POST /api/v1/auth/student-login` — accepts `candidate_number` + `password`, returns JWT with student claims.

### Student App Pages

**1. Login**
- Fields: Candidate Number, Password.
- First login: force password change.
- After login: redirect to My Choices.

**2. My Grades (read-only)**
- Shows student's HKDSE grades in a table: Subject, Sitting, Year, Grade, Predicted Grade.
- Data from `student_subject_grades` table.
- No editing — counsellor controls grade data.
- Purpose: student sees what scores the system is using for their match calculations.

**3. My Choices (core feature)**

Layout: ranked list of 1–25 programme slots, divided into bands.

**Band structure (matching 選科表):**

| Band | Slots | Colour | Meaning |
|------|-------|--------|---------|
| A | 1–3 | Pink | Dream choices — strong interest, confident of admission |
| B | 4–6 | Yellow | Strong interest, good chance |
| C | 7–10 | Green | Interested, realistic safety picks |
| D | 11–14 | Blue | Interested, consider associate degrees |
| E | 15–25 | Grey | Fillers, different institutions |

**Adding a programme:**
- Search by JUPAS code (e.g., "JS6456") or programme name (e.g., "HKU BBA").
- Autocomplete from `jupas_programmes` table (370+ programmes).
- On selection: show programme name, school name, and **real-time match percentage** (JUPAS scorer runs immediately with student's current grades).
- Match % colour-coded: green ≥70%, yellow 40–69%, red <40%.

**Reordering:**
- Drag-to-reorder or ↑/↓ buttons.
- Band assignment auto-updates based on rank position.
- Minimum: 0 choices (draft state). No maximum enforcement but slots go up to 25.

**Per-choice fields:**
- `rank` (1–25, auto-assigned by position)
- `jupas_code` (from search selection)
- `programme_name` (from search selection)
- `notes` (optional free text — student can note interview dates, portfolio requirements, etc.)

**Submission:**
- "Submit for Approval" button.
- Confirmation dialog: "Your choices will be sent to your counsellor for review. You won't be able to edit until they respond."
- Status changes to `pending`.
- After submission: list becomes read-only. Student sees status badge: "Pending Approval" / "Approved" / "Revision Requested".

**Revision flow:**
- If counsellor sends back for revision: student sees counsellor's notes, list becomes editable again.
- Student revises and resubmits.

### Counsellor Approval (in existing counsellor app)

**Dashboard integration:**
- New metric card: "Pending Submissions: N" (shows count of students awaiting approval).
- Clicking navigates to submissions list.

**New page: `/submissions`**
- List of pending student submissions: student name, class, submission date, choice count.
- Click → detail view showing all 25 choices with:
  - Rank, band, programme name, JUPAS code, match %, risk level.
  - Band colour coding matching student view.
  - Counsellor can see where choices are realistic vs. risky at a glance.

**Actions:**
- **Approve** — each choice creates/updates `StudentSchoolTarget` with:
  - `jupas_code`, `programme_name`, `student_rank` = choice rank
  - `preference_confidence` mapped from band: A→5, B→4, C→3, D→2, E→1
  - JUPAS scoring auto-runs on all targets
  - Submission status → `approved`
- **Send Back for Revision** — counsellor writes notes (required), submission status → `revision_requested`, student notified (can edit and resubmit)
- **Reject** — rare, with required reason. Status → `rejected`.

### New Database Table

```sql
CREATE TABLE student_choice_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- draft | pending | approved | revision_requested | rejected
    choices         JSONB NOT NULL DEFAULT '[]',
        -- [{rank: 1, jupas_code: "JS6456", programme_name: "HKU BBA", notes: ""}]
    counsellor_notes TEXT,
    submitted_at    TIMESTAMP,
    reviewed_at     TIMESTAMP,
    reviewed_by     UUID REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Status transitions:**
```
draft → pending (student submits)
pending → approved (counsellor approves)
pending → revision_requested (counsellor sends back)
pending → rejected (counsellor rejects)
revision_requested → pending (student resubmits)
```

### New API Endpoints

**Student-facing:**
- `POST /api/v1/auth/student-login` — login with candidate_number + password
- `GET /api/v1/student/grades` — read-only grades for authenticated student
- `GET /api/v1/student/choices` — get current submission (draft or latest)
- `PUT /api/v1/student/choices` — save choices (draft or revision)
- `POST /api/v1/student/choices/submit` — submit for approval
- `GET /api/v1/student/choices/match` — real-time match scores for a list of JUPAS codes
- `GET /api/v1/jupas/search?q=...` — search programmes by code or name (used by autocomplete)

**Counsellor-facing:**
- `GET /api/v1/submissions` — list pending submissions (scoped to org)
- `GET /api/v1/submissions/{id}` — detail view with all choices + match scores
- `POST /api/v1/submissions/{id}/approve` — approve and create targets
- `POST /api/v1/submissions/{id}/revise` — send back with notes
- `POST /api/v1/submissions/{id}/reject` — reject with reason

### Security

- Student role can ONLY access `/api/v1/student/*` and `/api/v1/jupas/*` endpoints.
- Student cannot see other students' data, counsellor data, or school management.
- JWT `student_id` claim enforces data isolation — every query filters by it.
- Password must be changed on first login (flag: `must_change_password` on user record).
- Rate limiting on student login: 10 attempts per minute.
- Choices JSON validated against `jupas_programmes` table — cannot submit codes that don't exist.

### Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Student submits with 0 choices | Allowed (draft→pending) but show warning "Are you sure? You have no choices." |
| Student adds same programme twice | Reject duplicate, show error |
| Programme removed from JUPAS database | Show warning on existing choice, don't block submission |
| Student has no grades yet | Allow choice entry but match % shows "No grade data" instead of percentage |
| Counsellor deletes student while submission pending | Cascade delete submission |
| Two submissions from same student | Only one active submission at a time; new submission replaces draft |
| Student tries to edit after submission | Blocked — read-only until counsellor responds |
| Counsellor approves then student's grades change | Targets retain original scores; next "Run Match" refreshes with JUPAS scorer |

---

## Implementation Order

1. **CSV student+grades import** — backend endpoint + frontend wizard (standalone, no dependencies)
2. **Student choice DB model + API** — submission table, student auth, JUPAS search
3. **Student app frontend** — login, grades, choices pages
4. **Counsellor approval UI** — submissions list + detail + approve/revise/reject

---

## Files to Create/Modify

**New files:**
- `backend/app/api/v1/routes/student_import.py` — CSV import endpoint
- `backend/app/api/v1/routes/student_portal.py` — student-facing API
- `backend/app/api/v1/routes/submissions.py` — counsellor submission management
- `backend/app/modules/school_choice/models/submissions.py` — StudentChoiceSubmission model
- `apps/student/` — entire new Vite app (login, grades, choices pages)
- `apps/web/src/pages/Submissions/` — counsellor submission review pages

**Modified files:**
- `backend/app/db/models.py` — add `student` role, `student_id` FK on User, `must_change_password` flag
- `backend/app/core/dependencies.py` — add `get_current_student()` dependency
- `backend/app/main.py` — register new routers
- `apps/web/src/pages/Dashboard/Dashboard.jsx` — pending submissions metric, rewire import button
- `apps/web/src/App.jsx` — add submissions route
- `pnpm-workspace.yaml` — add apps/student
- `packages/ui/src/i18n/en.json` + `zh-HK.json` — new translation keys
