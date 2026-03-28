# Navigation Flows
# Intelligent Academic Advisor — MVP
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE

---

## Purpose

This document maps all four required pages to a navigation hierarchy and defines all transitions between them. It covers entry points, authenticated routing, flow triggers, and logout behavior.

Pages in scope are limited to those defined in preferences.md §5.7 and the [FRONTEND] requirements in pm_req_ui_designer.md. No additional pages exist in MVP.

---

## Page Inventory

| Page | REQ-ID | Auth Required |
|---|---|---|
| Login | REQ-031 | No |
| Student List | REQ-032 | Yes |
| Student Detail | REQ-033 | Yes |
| Recommendation | REQ-034 | Yes |

---

## Navigation Hierarchy

```
[Unauthenticated entry]
        |
        v
  +-----------+
  | Login     |  (entry point for all unauthenticated users)
  +-----------+
        |
        | Successful POST /api/v1/auth/login → JWT stored
        v
  +-------------------+
  | Student List      |  (default landing page after login)
  +-------------------+
        |
        | Click on a student row
        v
  +-------------------+
  | Student Detail    |  (view and edit for a specific student)
  +-------------------+
        |
        | Click "Generate Recommendations" button
        v
  +---------------------+
  | Recommendation Page |  (ranked schools + action plan for that student)
  +---------------------+
```

---

## Entry Point: Login Page

- All unauthenticated requests (direct URL access to any page) redirect to the Login page.
- The Login page is the only page accessible without a stored JWT.
- If a valid JWT is already present in the session (e.g. the counselor has not logged out), navigating to the root URL or the Login page redirects directly to the Student List page.

---

## Flow: Login → Student List

- Trigger: Counselor submits valid email and password credentials on the Login page.
- API call: POST /api/v1/auth/login (REQ-031)
- On 200 OK: JWT is stored (in memory or session storage). The application navigates to the Student List page.
- On 401 or 422: The Login page remains visible. An inline error message is displayed below the form. The counselor is not navigated away.
- No intermediary loading screen is shown; a loading state is displayed on the Login form's submit button while the API call is in flight.

---

## Flow: Student List → Student Detail

- Trigger: Counselor clicks any student row in the Student List table.
- API call: GET /api/v1/students/{id} (REQ-033) is issued when the Student Detail page loads.
- On 200 OK: The Student Detail page renders with the student's full profile.
- On 403 or 404: The Student Detail page renders an error message. A "Back to Students" link is provided to return to the Student List page.
- The browser URL updates to include the student ID (e.g. /students/{id}).

### Flow: Student List → Create New Student

- Trigger: Counselor clicks the "Add Student" button on the Student List page.
- The Student List page renders an inline creation form (or a modal-equivalent inline panel) using the StudentForm component. No separate page is required for create.
- API call: POST /api/v1/students (REQ-032, REQ-033)
- On 201 Created: The form closes. The new student row appears in the Student List. A success message is briefly displayed.
- On 400/422: Validation errors are shown inline within the form. The counselor remains on the Student List page.

---

## Flow: Student Detail → Recommendation Page

- Trigger: Counselor clicks the "Generate Recommendations" button on the Student Detail page.
- API calls (issued sequentially):
  1. POST /api/v1/students/{id}/recommendations (REQ-035) — triggers the matching engine
  2. POST /api/v1/students/{id}/action-plan (REQ-035) — triggers action plan generation
- While these calls are in flight, the "Generate Recommendations" button shows a loading state and is disabled to prevent duplicate submissions.
- On success (201 from both): The application navigates to the Recommendation page for this student.
- On 422 (incomplete profile): An inline error message is shown on the Student Detail page. The counselor is not navigated away. The error message explains that the student profile is incomplete.
- On 404/403: An inline error message is shown. No navigation occurs.
- The browser URL updates to include the student ID (e.g. /students/{id}/recommendations).

### Back Navigation from Recommendation Page

- A "Back to Student" link is present at the top of the Recommendation page.
- Clicking it navigates back to the Student Detail page for the same student (GET /api/v1/students/{id}).
- No back navigation goes directly from the Recommendation page to the Student List; the counselor must pass through Student Detail.

---

## Logout

- Trigger: Counselor clicks the "Logout" link in the NavBar, present on all authenticated pages (Student List, Student Detail, Recommendation).
- Behavior:
  1. The stored JWT is removed from memory/session storage immediately.
  2. The application navigates to the Login page.
  3. No API call to a logout endpoint is required in MVP (token invalidation is not implemented server-side in MVP; the token simply becomes orphaned).
- After logout, using the browser back button to return to a protected page results in a redirect to the Login page (because no valid JWT is present).

---

## Page Transitions

Per REQ-039, no animations or transition effects are used. Page changes are immediate repaints:

- Login → Student List: Immediate render of the Student List page upon successful login.
- Student List → Student Detail: Immediate render of the Student Detail page. A LoadingSpinner occupies the main content zone while the GET /api/v1/students/{id} call resolves.
- Student Detail → Recommendation: Immediate render of the Recommendation page shell. A LoadingSpinner occupies the recommendations list zone while the generate calls resolve. Because generation can take a few seconds (matching engine + LLM/rule-based plan), the loading state on the button must persist until both API calls return.
- Any page → Login (on logout or redirect): Immediate render of the Login page.

---

## Protected Route Guard

- Before rendering any protected page, the application checks whether a JWT is present.
- If no JWT is present: redirect to Login page immediately, before any API call is made.
- If the API returns 401 on any protected call: the JWT is cleared and the application redirects to the Login page.

---

## URL Structure (Informational — for Developer Reference)

| URL Pattern | Page | Notes |
|---|---|---|
| `/login` | Login | Unauthenticated entry point |
| `/students` | Student List | Default post-login destination |
| `/students/{id}` | Student Detail | `id` is the student UUID |
| `/students/{id}/recommendations` | Recommendation | `id` is the student UUID |

---

## Non-Goals

- No multi-step wizard flows
- No breadcrumb trail component (navigation is shallow enough that Back links suffice)
- No history stack management beyond standard browser behavior
- No deep links to specific recommendation items
