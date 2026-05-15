# Student Features Expansion — Design Spec

## Goal

Expand the student portal with school directory access, programme website links, hypothetical grade builds with live scoring, and plan release from counselor to student.

## Architecture

Four sub-systems: (A) school directory + programme URLs for students, (B) plan release workflow, (C) grade builds with live scoring, (D) student portal wiring. Backend: new DB table for grade builds, new columns on AcademicPlan and JupasProgramme, new API endpoints. Frontend: student nav expansion, grade build UI, plan view page.

## Tech Stack

Existing: React, FastAPI, SQLAlchemy, TanStack Query, JUPAS scorer, existing student portal auth.

---

## 1. School Directory for Students + Programme URLs

### Programme URLs

Generate from JUPAS pattern: `https://www.jupas.edu.hk/en/programme/{institution_code}/{jupas_code}/`

Add nullable `website_url` column to `JupasProgramme` for overrides. Display logic:
```
url = programme.website_url or f"https://www.jupas.edu.hk/en/programme/{programme.institution_code}/{programme.jupas_code}/"
```

Show as clickable link icon on:
- Programme cards in school directory
- Programme detail page header
- Programme choices table (per-row)
- Add programme modal (per-result)

### Student Access

Add "School Directory" to student nav in `NavBarV2.jsx` (student role section). Same `/schools` route component — read-only (no admin edit features). Student sees all schools + programmes + website links.

### Files
- Modify: `backend/app/modules/school_choice/models/models.py` — add `website_url` column to JupasProgramme
- Modify: `backend/app/api/v1/routes/jupas_search.py` — include website_url in /all response, add URL generation helper
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx` — add School Directory to student nav
- Modify: `apps/web/src/pages/SchoolProfile/SchoolProfile.jsx` — add programme website links
- Modify: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx` — add website link per programme

---

## 2. Plan Release to Students

### Data Model

Add to `AcademicPlan`:
- `released_at` (TIMESTAMP, nullable) — null = not released
- `release_note` (TEXT, nullable) — optional counselor message

### Backend

- `POST /api/v1/students/{id}/plan/release` — body: `{note: "optional text"}`. Sets `released_at = now()`, `release_note = note`. Requires counselor auth.
- `GET /api/v1/student-portal/plan` — student auth. Returns plan only if `released_at IS NOT NULL`. Response: `{html_content, release_note, released_at, version}`. 404 if not released.

### Teacher UI (ConsultantTask)

"Release to Student" button in toolbar, shown when plan exists. Click opens modal:
- Textarea for optional note (placeholder: "Add a note for your student...")
- "Release" button
- If already released: shows "Released on [date]" badge, button says "Re-release"

### Student View

New page `/my-plan`:
- Route added to `App.jsx`, nav link in student dashboard
- If released: shows plan HTML in read-only iframe + release note banner above
- If not released: empty state "Your counselor has not released a plan yet."
- No edit/generate/chat buttons — view only

### Files
- Modify: `backend/app/modules/school_choice/models/models.py` — add `released_at`, `release_note` to AcademicPlan
- Create: `backend/app/api/v1/routes/plan_release.py` — release endpoint
- Modify: `backend/app/api/v1/routes/student_portal.py` — add GET /student-portal/plan
- Modify: `backend/app/main.py` — register plan_release router
- Create: `apps/web/src/pages/StudentPlan/StudentPlan.jsx` — student read-only plan page
- Modify: `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx` — add Release button + modal
- Modify: `apps/web/src/App.jsx` — add /my-plan route
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx` — add My Plan to student nav
- Modify: `packages/ui/src/i18n/en.json` + `zh-HK.json` — release-related i18n keys

---

## 3. Grade Builds (Hypothetical Grades)

### Data Model

New table `grade_builds`:
```sql
CREATE TABLE grade_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    grades JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```
- `grades` JSON shape: `{"MATH": "5*", "ENGL": "4", "PHYS": "5", ...}`
- Constraint: max 5 builds per student (enforced in API, not DB)
- Actual grades remain in `student_subject_grades` — builds are a separate parallel system

### Backend

- `GET /api/v1/students/{id}/grade-builds` — list all builds for student
- `POST /api/v1/students/{id}/grade-builds` — create build (name + grades). Reject if already 5.
- `PUT /api/v1/students/{id}/grade-builds/{build_id}` — update name or grades
- `DELETE /api/v1/students/{id}/grade-builds/{build_id}` — delete build
- `POST /api/v1/students/{id}/grade-builds/{build_id}/scores` — run JUPAS scorer against this build's grades for all student targets. Returns `[{jupas_code, programme_name, match_score, eligible}]`. This is the live scoring endpoint — must be fast (<500ms).

Student portal access: same endpoints accessible via student auth (student can only access own builds).

### Live Scoring Implementation

The `/scores` endpoint:
1. Takes the build's `grades` JSON
2. Converts to `grades_by_code` format
3. Gets student's target programmes (from `student_school_targets`)
4. For each target, calls `score_student_for_programme(grades_by_code, programme_dict)`
5. Returns scores array

This reuses the existing JUPAS scorer — no new scoring logic needed.

### Grades Tab UI

Dropdown at top of grades tab: "Actual Grades" (default) | "Build: [name]" | "+ New Build"

When a build is selected:
- Editable grade table showing the build's grades
- Subject dropdown + grade dropdown to add/change grades
- Each change triggers debounced (300ms) call to `/scores` endpoint
- Live score preview panel below the grade table: compact list of target programmes with match percentages, updating in real-time

When "Actual Grades" selected: existing read-only grade display (no live scoring, already computed).

### Programme Choices Tab

New dropdown at top: "Score using: Actual Grades | Build: [name]"
When a build is selected, all match scores in the programme table recalculate using that build's grades. The dropdown fires a query to `/scores` and overlays the results.

### Files
- Create: `backend/app/modules/school_choice/models/grade_builds.py` — GradeBuild ORM model
- Create: `backend/app/api/v1/routes/grade_builds.py` — CRUD + scoring endpoints
- Modify: `backend/app/main.py` — register grade_builds router
- Modify: `apps/web/src/pages/StudentProfile/GradesTab.jsx` — build selector, editable build view, live scores
- Modify: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx` — build selector dropdown
- Create: `apps/web/src/api/gradeBuilds.js` — frontend API client
- Modify: `packages/ui/src/i18n/en.json` + `zh-HK.json` — grade build i18n keys

---

## 4. Student Portal Wiring

### Student Nav

Current student nav: Dashboard, My Submissions. Add:
- School Directory → `/schools`
- My Plan → `/my-plan`

### Student Dashboard

Current `StudentDashboard.jsx` shows basic info. No changes needed — the new features are accessed via nav links.

### Route Protection

Existing `ProtectedRoute` handles auth. Student-specific pages (`/my-plan`) use the student portal API which already scopes to the authenticated student. No new auth logic needed.

### Files
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx` — student nav links
- Modify: `apps/web/src/App.jsx` — add /my-plan route

---

## Non-goals

- Programme name translations (official JUPAS English names)
- Grade build sharing between students
- Plan comments/discussion thread (just release note)
- Programme comparison view
- Self-financing programme URLs (different URL pattern, future work)
