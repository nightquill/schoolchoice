# Navigation Flows — v2
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE
# Note: This file extends navigation_flows.md (v1). Do not modify v1. All v1 flows
#       (Login → Student List → Student Detail → Recommendation) remain unchanged.

---

## Purpose

This document defines the complete navigation map for all pages introduced in v2.
It covers every page transition, the API call made on entry, the loading state shown,
and the URL pattern assigned. The v1 pages (Login, Student List, Student Detail,
Recommendation) are referenced here as context but not re-specified.

---

## Page Inventory (v2 additions)

| Page | REQ-IDs | Auth Required | Role |
|---|---|---|---|
| Dashboard | REQ-088 | Yes | Counsellor or Admin |
| Student Profile (tabbed) | REQ-089, REQ-090, REQ-091 | Yes | Counsellor or Admin |
| Target Schools | REQ-092, REQ-093, REQ-103 | Yes | Counsellor or Admin |
| School Directory | REQ-094 | Yes | Counsellor or Admin |
| School Profile | REQ-095 | Yes | Counsellor or Admin |
| Academic Plan | REQ-096 | Yes | Counsellor or Admin |
| Account Settings | REQ-097 | Yes | Any authenticated |
| Admin: Data Refresh | REQ-098 | Yes | Admin only |

---

## Full Navigation Hierarchy (v2)

```
[Unauthenticated entry]
        |
        v (v1 — unchanged)
  +-----------+
  |   Login   |
  +-----------+
        |
        | POST /api/v1/auth/login → JWT stored
        v
  +-------------+
  |  Dashboard  |  ← default post-login destination (v2 replaces Student List as landing)
  +-------------+
        |
        |--- Click student card "View Profile" ─────────────────────────────────────┐
        |                                                                            v
        |--- NavBar: "School Directory" link ─────────────────────────────────┐  +------------------+
        |                                                                      v  | Student Profile  |
        |--- NavBar: "Account Settings" link ─────────────────────┐       +---+  |  (tabbed)        |
        |                                                          v       |      +------------------+
        |--- NavBar: "Data Refresh" link (admin only) ─────┐  +--------+  |           |
                                                            v  | Account|  |           |-- Tab: Personal
                                                        +------+ Settings| |           |-- Tab: Grades
                                                        | Admin|  +-------+ |           |-- Tab: Language
                                                        | Data |            |           |-- Tab: Teacher Evals
                                                        |Refresh            |           |-- Tab: Activities
                                                        +------+            |           |-- Tab: Notes
                                                                            v                |
                                                                    +------------------+     |
                                                                    | School Directory |     |
                                                                    +------------------+     |
                                                                            |                |
                                                                            | Click card     |
                                                                            v                |
                                                                    +------------------+     |
                                                                    |  School Profile  |     |
                                                                    +------------------+     |
                                                                            |                |
                                                                            | "Add to Target"|
                                                                            v                |
                                                                    +------------------+     |
                                                                    |  Target Schools  | <---+--- "Target Schools" button
                                                                    +------------------+     |
                                                                                             |
                                                                    +------------------+     |
                                                                    |  Academic Plan   | <---+--- "Generate Plan" button
                                                                    +------------------+
```

---

## Entry Point: Dashboard

- All authenticated users land on the Dashboard after login.
- If a valid JWT is already present and the user navigates to `/`, they are redirected
  to `/dashboard` without a round-trip to the login page.
- If no JWT is present, any URL redirects to `/login`.
- On Dashboard load: GET /api/v1/students is called to fetch the student list.
  A LoadingSpinner occupies the student cards grid zone while the call is in flight.
  On 401, the JWT is cleared and the user is redirected to Login.

---

## NavBar (v2 — extended)

The v2 NavBar replaces the v1 NavBar on all authenticated pages. It adds navigation
links while preserving the v1 logout behaviour.

**Common to all roles:**
- Left: Application name "Academic Advisor" (links to Dashboard)
- Centre links: Dashboard | School Directory | Account Settings
- Right: Display name or email + Logout

**Admin role only — additional centre link:**
- Data Refresh (shown between "School Directory" and "Account Settings")

**Active link state:** The link matching the current page section is visually distinguished
using `var(--color-primary)` text and `var(--font-weight-medium)`.

**On logout:**
1. JWT is removed from session storage.
2. Application navigates immediately to `/login`.
(Behaviour unchanged from v1.)

---

## Flow: Dashboard → Student Profile

- Trigger: Counsellor clicks "View Profile" on a student card.
- URL update: `/students/{id}/profile`
- API call on entry: GET /api/v1/students/{id}/profile
- Loading state: LoadingSpinner in the main content area while call is in flight.
- On 200 OK: Student Profile page renders; Personal tab is shown by default.
- On 403/404: ErrorMessage banner is shown. A "Back to Dashboard" link is provided.

---

## Student Profile — Tab Navigation

The Student Profile page has six tabs. Tab switching is client-side only (no page
navigation). Each tab loads its own data lazily on first activation.

| Tab | Data loaded on activation | API call |
|---|---|---|
| Personal | Student expanded profile fields | GET /api/v1/students/{id}/profile |
| Grades | Grade rows + subjects + grade systems | GET /api/v1/students/{id}/grades + GET /api/v1/subjects + GET /api/v1/grade-systems |
| Language | Language score record | GET /api/v1/students/{id}/language-scores |
| Teacher Evaluations | All teacher evaluation entries | GET /api/v1/students/{id}/teacher-evaluations |
| Activities | Extracurricular + awards arrays | GET /api/v1/students/{id}/extracurricular + GET /api/v1/students/{id}/awards |
| Notes | Loaded as part of GET /api/v1/students/{id}/profile (`notes` field) | (shared load with Personal tab) |

- On first tab open: a LoadingSpinner occupies the tab panel while data loads.
- Subsequent visits to the same tab within a session use the cached data; a manual
  "Refresh" action is not provided in v2 (reload the page to force a fresh fetch).
- Tab state is preserved in the URL as a query parameter: `?tab=grades`, `?tab=language`,
  etc., allowing direct linking.

---

## Flow: Student Profile → Target Schools

- Trigger: Counsellor clicks "Target Schools" button or link on the Student Profile header.
- URL: `/students/{id}/targets`
- API call on entry: GET /api/v1/students/{id}/targets
- Loading state: LoadingSpinner in the list zone.
- On 200 OK: Target Schools list renders, ordered by `student_rank` ascending.
- On 404: ErrorMessage with "Back to Profile" link.

---

## Flow: Student Profile → Generate Plan → Academic Plan

- Trigger: Counsellor clicks "Generate Plan" button on the Student Profile header or
  from within the Academic Plan page toolbar.
- Step 1: POST /api/v1/students/{id}/plan → receives `job_id`, status = "pending".
  Button enters loading state. User is navigated to `/students/{id}/plan` immediately.
- Step 2: Front end polls GET /api/v1/students/{id}/plan/status every 2 seconds.
  During polling: the Academic Plan page shows the generating state (spinner +
  "Generating plan…" + estimated wait message).
- Step 3 (status = "complete"): Front end calls GET /api/v1/students/{id}/plan to
  retrieve `html_content`. Iframe is rendered with the HTML.
- Step 4 (status = "failed"): ErrorMessage banner displayed. "Try again" button
  available to re-trigger generation.
- Polling stops as soon as status is `complete` or `failed`.

---

## Flow: Dashboard → School Directory

- Trigger: Counsellor clicks "School Directory" in the NavBar, or clicks "Add School"
  from the Target Schools page (which opens a School Directory search modal — see below).
- URL: `/schools`
- API call on entry: GET /api/v1/schools (with default params: `limit=50`, `offset=0`)
- Loading state: LoadingSpinner in the results grid zone.
- On 200 OK: SchoolCard grid renders with pagination controls.

---

## Flow: School Directory → School Profile

- Trigger: Counsellor clicks a SchoolCard in the directory grid.
- URL: `/schools/{id}`
- API call on entry: GET /api/v1/schools/{id}
- Loading state: LoadingSpinner in the main content zone.
- On 200 OK: School Profile page renders.
- On 404: ErrorMessage with "Back to Directory" link.

---

## Flow: School Profile → Add to Target List

Two contexts exist:

**Context A — arrived from Target Schools page (student context active):**
- The "Add to [Student Name]'s Target List" button is shown.
- Trigger: Counsellor clicks the button.
- API call: POST /api/v1/students/{student_id}/targets with `school_id`.
- On 201 Created: Toast notification "School added to target list". Button
  label changes to "Already in Target List" and is disabled.
- On 409 Conflict: Toast notification "This school is already in the target list."
- On completion: Counsellor may click "Back to Target Schools" to return.

**Context B — arrived directly (no student context):**
- A "Select Student & Add" button is shown.
- Trigger: Counsellor clicks the button.
- Behaviour: A Modal opens with a searchable student selector. After student selection,
  POST /api/v1/students/{student_id}/targets is called (same API as Context A).

---

## Flow: Dashboard → Account Settings

- Trigger: Counsellor clicks "Account Settings" in the NavBar.
- URL: `/account/settings`
- API call on entry: GET /api/v1/account
- Loading state: LoadingSpinner in the form card zone.
- On 200 OK: Account Settings form renders with pre-populated fields.

---

## Flow: Dashboard → Admin Data Refresh (admin only)

- Trigger: Admin clicks "Data Refresh" in the NavBar.
  Link is only rendered when `account.role === "admin"`.
- URL: `/admin/data-refresh`
- API call on entry: (none on initial load; status is shown as last-known state
  from the admin session or a static display)
- Page renders immediately with the last refresh state (if available in local state)
  or an empty state if never triggered in this session.

---

## Page Transition Behaviour

Per REQ-039, no animation is used on any transition. All transitions are immediate
repaints.

| Transition | Loading state shown | Fallback on error |
|---|---|---|
| Dashboard load | LoadingSpinner in cards grid | ErrorMessage banner; retry link |
| Dashboard → Student Profile | LoadingSpinner in main content | ErrorMessage + Back to Dashboard |
| Tab switch (Student Profile) | LoadingSpinner in tab panel | ErrorMessage in tab panel |
| Student Profile → Target Schools | LoadingSpinner in list zone | ErrorMessage + Back to Profile |
| Student Profile → Academic Plan (generate) | Generating state (spinner + message) | ErrorMessage + Try Again button |
| Academic Plan (idle load) | LoadingSpinner in iframe zone | EmptyState if no plan exists |
| School Directory load | LoadingSpinner in grid zone | ErrorMessage + retry |
| School Directory → School Profile | LoadingSpinner in main content | ErrorMessage + Back to Directory |
| Dashboard → Account Settings | LoadingSpinner in form card | ErrorMessage |
| Dashboard → Admin Data Refresh | No loading state (static page) | N/A |

---

## URL Structure (v2)

| URL Pattern | Page | Notes |
|---|---|---|
| `/dashboard` | Dashboard | Default post-login landing page |
| `/students/{id}/profile` | Student Profile | `?tab=personal` (default), `?tab=grades`, `?tab=language`, `?tab=evaluations`, `?tab=activities`, `?tab=notes` |
| `/students/{id}/targets` | Target Schools | `id` is student UUID |
| `/students/{id}/plan` | Academic Plan | `id` is student UUID |
| `/schools` | School Directory | Query params forwarded to API |
| `/schools/{id}` | School Profile | `id` is school UUID; `?from_student={student_id}` preserves context |
| `/account/settings` | Account Settings | |
| `/admin/data-refresh` | Admin: Data Refresh | 403 redirect to Dashboard for non-admin |

---

## Protected Route Guard (v2 additions)

- All v2 pages are protected routes. Behaviour is unchanged from v1: missing JWT
  redirects to `/login`; 401 from any API call clears the JWT and redirects.
- The Admin Data Refresh page additionally checks `account.role === "admin"`.
  If the role check fails (403 from API), the user is redirected to `/dashboard`
  with a Toast notification: "You do not have permission to access that page."

---

## Non-Goals (v2)

- No breadcrumb component (back links and NavBar are sufficient for the depth of v2).
- No multi-step wizard flows for student profile creation.
- No deep-link to specific tab sections beyond the `?tab=` query parameter.
- No browser history manipulation beyond standard React Router behaviour.
