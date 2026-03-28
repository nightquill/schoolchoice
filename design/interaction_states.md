# Interaction States
# Intelligent Academic Advisor — MVP
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE

---

## Purpose

This document specifies the loading, error, empty, success, and validation states for every interactive element across the four required pages. All visual values reference design tokens from design_tokens.md. No code appears in this document.

Governed by: REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-039.

---

## Global Principles

1. No animations. All state changes are immediate repaints. (REQ-039)
2. Loading states use the LoadingSpinner component (static text, not a spinning graphic).
3. Error messages use `var(--color-error)` exclusively for error-related text and borders.
4. Success states use `var(--color-success)` for confirmation text.
5. Empty states explain the absence of content and guide the counselor toward an action.
6. Form validation triggers on submit (not on blur) for primary forms. Inline field errors may update on blur for fields where the rule is unambiguous (e.g. email format). See the Form Validation section.

---

## Page 1: Login Page

### Interactive Elements

- Email TextInput
- Password TextInput
- Log In Button

---

### Login Form — Loading State

- Trigger: Counselor clicks "Log In" and the POST /api/v1/auth/login call is in flight.
- The "Log In" Button enters its loading state: label changes to "Logging in…", the button is disabled, and `aria-busy="true"` is set.
- The Email and Password TextInputs are disabled (greyed out, cursor: not-allowed) while the call is in flight.
- No spinner is shown outside the button. The rest of the page is unchanged.
- Duration: from button click until the API responds (success or error).

---

### Login Form — Error State

- Trigger: API returns 401 or 422.
- The Button returns to its default (non-loading, enabled) state with label "Log In".
- The Email and Password TextInputs return to their default enabled state.
- An ErrorMessage component (banner context) is displayed below the Password field and above the Log In button.
  - 401 message: "Invalid email or password. Please try again."
  - 422 message: "Please check your input and try again."
- The error banner uses `var(--color-error)` border and text.
- The error banner persists until the counselor modifies either input field, at which point it is dismissed.

---

### Login Form — Validation State (Client-Side, Pre-Submit)

- Validation triggers on submit only.
- If the email field is empty on submit: TextInput enters error state, errorText: "Email is required."
- If the email field contains an invalid format on submit: TextInput enters error state, errorText: "Please enter a valid email address."
- If the password field is empty on submit: TextInput enters error state, errorText: "Password is required."
- Field errors are cleared when the counselor modifies that field.
- The form is not submitted to the API while client-side validation errors exist.

---

## Page 2: Student List Page

### Interactive Elements

- StudentRow (each row in the table)
- "Add Student" Button
- StudentForm (inline creation form, shown when "Add Student" is clicked)

---

### Student Table — Loading State

- Trigger: Page loads and GET /api/v1/students is in flight.
- The table header row is rendered immediately.
- The table body is replaced by a LoadingSpinner (md size, block-level, centered in the table body area).
- Label: "Loading students…"
- The "Add Student" button is visible but not disabled during table load (counselor can begin creating a student while the list loads).

---

### Student Table — Error State

- Trigger: GET /api/v1/students returns a non-200 response or a network error.
- The LoadingSpinner is replaced by an ErrorMessage component (banner context) within the table body area.
- Message: "Could not load students. Please refresh the page."
- The table header row remains visible.
- The "Add Student" button remains enabled.

---

### Student Table — Empty State

- Trigger: GET /api/v1/students returns an empty array.
- The table body is replaced by an EmptyState component within the table body area.
- Message: "No students yet. Click Add Student to create a profile."
- The EmptyState actionLabel is "Add Student"; clicking it triggers the same flow as the "Add Student" button.
- The table header row remains visible.

---

### "Add Student" Button — Loading State

- The button itself does not enter a loading state when clicked. Clicking it reveals the inline StudentForm; the button is hidden or disabled while the form is open to prevent duplicate form opens.

---

### Inline StudentForm (Create) — Loading State

- Trigger: Counselor clicks "Save" and POST /api/v1/students is in flight.
- The Save Button enters loading state: label "Saving…", disabled.
- All form inputs are disabled.

---

### Inline StudentForm (Create) — Error State

- Trigger: API returns 400 or 422.
- The Save Button returns to its default state.
- All inputs return to enabled state.
- If the API returns field-level errors (422 with detail): each affected TextInput displays its errorText below the field.
- If the error is non-field-specific (400, network error): an ErrorMessage banner is displayed above the Save button. Message: "Could not save student. Please check your input and try again."

---

### Inline StudentForm (Create) — Validation State

- Validation triggers on submit.
- Name field empty: errorText "Student name is required."
- Target Region not selected: the region selector area shows an inline error text "Please select a target region."
- Grades with a subject name but no grade value: errorText on that row "Please enter a grade for [subject]."
- Interests field is optional; no required validation.
- Strengths and Weaknesses field is required: errorText "Please describe the student's strengths and weaknesses."

---

### Inline StudentForm (Create) — Success State

- Trigger: POST /api/v1/students returns 201 Created.
- The form closes (disappears from view).
- The "Add Student" button reappears.
- The new StudentRow is added to the top of the student table.
- A brief success message is displayed in an inline banner above the table for approximately 3 seconds (non-animated; it simply appears and then disappears after the timeout). Message: "Student added successfully." Text color: `var(--color-success)`. Border: `var(--border-width)` solid `var(--color-success)`.

---

## Page 3: Student Detail Page

### Interactive Elements

- "Edit Student" Button
- "Generate Recommendations" Button
- "Generate Action Plan" Button
- StudentForm (edit mode)
- "Save Changes" Button (within edit mode)
- "Cancel" Button (within edit mode)

---

### Page Load — Loading State

- Trigger: Page navigates in and GET /api/v1/students/{id} is in flight.
- The page heading area shows "Loading…" as a LoadingSpinner (md size).
- The Student Info Section area shows a LoadingSpinner (md size, centered).
- The action button row is not shown until the student data resolves.
- Concurrent: GET /api/v1/students/{id}/action-plan is also in flight. The Action Plan Display zone shows a LoadingSpinner (md size).

---

### Page Load — Error State

- Trigger: GET /api/v1/students/{id} returns 403, 404, or a network error.
- The Student Info Section area shows an ErrorMessage banner.
  - 404: "Student not found."
  - 403: "You do not have access to this student record."
  - Other: "Could not load student data. Please try again."
- A "Back to Students" link is displayed below the error message.
- The action button row is not shown.

---

### "Edit Student" Button — Interaction

- Clicking this button replaces the Student Info Section with the StudentForm pre-populated with the student's current field values.
- The three action buttons are replaced by "Save Changes" (primary) and "Cancel" (secondary).
- No loading state on the button itself; the transition to edit mode is immediate.

---

### StudentForm (Edit Mode) — Loading State

- Trigger: Counselor clicks "Save Changes" and PUT /api/v1/students/{id} is in flight.
- "Save Changes" Button enters loading state: label "Saving…", disabled.
- All form inputs are disabled.

---

### StudentForm (Edit Mode) — Error State

- Trigger: API returns 400, 422, 403, or network error.
- "Save Changes" Button returns to default state.
- Inputs return to enabled state.
- Field-level errors (422): affected TextInput fields display errorText.
- Non-field errors: ErrorMessage banner above the footer buttons. Message: "Could not save changes. Please check your input and try again."

---

### StudentForm (Edit Mode) — Validation State

- Same rules as the create form (see Student List Page above), with the addition:
- Validation triggers on submit.
- On blur validation for email-format-like fields is not applicable here (student form has no email field).

---

### StudentForm (Edit Mode) — Success State

- Trigger: PUT /api/v1/students/{id} returns 200 OK.
- The StudentForm is replaced by the updated Student Info Section in view mode.
- The "Save Changes" / "Cancel" buttons are replaced by the three action buttons.
- A success message appears above the Student Info Section for approximately 3 seconds. Message: "Changes saved." Text color: `var(--color-success)`. No animation.

---

### StudentForm (Edit Mode) — Cancel State

- Clicking "Cancel" immediately discards all in-progress edits.
- The StudentForm is replaced by the unmodified Student Info Section in view mode.
- No confirmation dialog.
- No success or error message is shown.

---

### "Generate Recommendations" Button — Loading State

- Trigger: Counselor clicks the button. Two sequential API calls are in flight: POST /api/v1/students/{id}/recommendations, then POST /api/v1/students/{id}/action-plan.
- The button enters loading state: label "Generating…", disabled, `aria-busy="true"`.
- The "Edit Student" and "Generate Action Plan" buttons are also disabled while generation is in flight (to prevent conflicting state changes).
- No page-level spinner is shown; the button loading state is sufficient.
- Duration: from button click until both API calls complete (or one fails).

---

### "Generate Recommendations" Button — Error State

- Trigger: Either API call returns an error.
- All three buttons return to their default enabled states.
- An ErrorMessage banner is displayed above the action button row.
  - 422 from recommendations: "The student profile is incomplete. Please ensure all required fields are filled in before generating recommendations."
  - 404: "Student not found."
  - Other: "Could not generate recommendations. Please try again."

---

### "Generate Recommendations" Button — Success State

- Trigger: Both API calls return success.
- The application navigates to the Recommendation page for this student.
- No success message is shown on the Student Detail page (the navigation itself is the confirmation).

---

### "Generate Action Plan" Button — Loading State

- Trigger: Counselor clicks the button. POST /api/v1/students/{id}/action-plan is in flight.
- The button enters loading state: label "Generating…", disabled.
- The "Edit Student" and "Generate Recommendations" buttons are also disabled.

---

### "Generate Action Plan" Button — Error State

- Trigger: API returns an error.
- Buttons return to default state.
- ErrorMessage banner above the action button row.
  - 422: "The student profile is incomplete. Please ensure all fields are filled in before generating an action plan."
  - Other: "Could not generate action plan. Please try again."

---

### "Generate Action Plan" Button — Success State

- Trigger: POST /api/v1/students/{id}/action-plan returns 201.
- The ActionPlanDisplay zone at the bottom of the page is updated with the new plan data.
- If the ActionPlanDisplay was previously hidden (404 on page load), it now becomes visible.
- A brief success message appears above the ActionPlanDisplay for approximately 3 seconds. Message: "Action plan generated." Text color: `var(--color-success)`.

---

## Page 4: Recommendation Page

### Interactive Elements

- "Back to [Student Name]" link
- (No other interactive elements; all content is informational)

---

### Recommendations Zone — Loading State

- Trigger: Page loads and GET /api/v1/students/{id}/recommendations is in flight.
- The recommendations zone shows a LoadingSpinner (md size, centered, block-level).
- Label: "Loading recommendations…"

---

### Recommendations Zone — Error State

- Trigger: GET /api/v1/students/{id}/recommendations returns 403, 404, or network error.
- The LoadingSpinner is replaced by an ErrorMessage banner.
  - 403/404: "Could not load recommendations. You may not have access to this student."
  - Other: "Could not load recommendations. Please try again."

---

### Recommendations Zone — Empty State

- Trigger: GET /api/v1/students/{id}/recommendations returns an empty array.
- An EmptyState component is shown.
- Message: "No recommendations have been generated yet. Return to the student profile and click Generate Recommendations."
- EmptyState actionLabel: "Back to Student". Clicking navigates to the Student Detail page.

---

### Action Plan Zone — Loading State

- Trigger: Page loads and GET /api/v1/students/{id}/action-plan is in flight.
- The action plan zone shows a LoadingSpinner (md size, centered, block-level).
- Label: "Loading action plan…"
- The recommendations zone loads independently. If recommendations finish before the action plan, they are displayed while the action plan zone continues to show its spinner.

---

### Action Plan Zone — Error State

- Trigger: GET /api/v1/students/{id}/action-plan returns 403, network error (but not 404; see empty below).
- An ErrorMessage banner is shown in the action plan zone.
- Message: "Could not load action plan. Please try again."

---

### Action Plan Zone — Empty State

- Trigger: GET /api/v1/students/{id}/action-plan returns 404 (no plan generated yet).
- An EmptyState component is shown in the action plan zone.
- Message: "No action plan available yet. Return to the student profile and click Generate Action Plan."
- EmptyState actionLabel: "Back to Student". Clicking navigates to the Student Detail page.

---

## Form Validation Rules Summary

This section consolidates all validation trigger rules across the application.

### Trigger Timing

| Trigger | Rule | Rationale |
|---|---|---|
| On submit | All required-field checks | Avoids showing errors before the counselor has had a chance to fill the field |
| On blur | Email format check (Login form only) | Email format is an unambiguous rule; early feedback is helpful and not intrusive |
| On change (after first submit attempt) | All previously-failed fields re-validate on each change | Allows counselor to see real-time correction of errors after the first submit attempt |

### Validation Rules by Field

**Login — Email:**
- Required. Error: "Email is required."
- Valid email format. Error: "Please enter a valid email address."

**Login — Password:**
- Required. Error: "Password is required."

**StudentForm — Name:**
- Required. Error: "Student name is required."

**StudentForm — Grades:**
- If at least one subject row is present, each subject row must have both a subject name and a grade value.
- Subject name: Error: "Please enter a subject name."
- Grade value: Error: "Please enter a grade for this subject."
- Empty grades object (no rows at all) is permitted; the API accepts an empty grades object.

**StudentForm — Interests:**
- Optional field. No validation required.

**StudentForm — Strengths and Weaknesses:**
- Required. Error: "Please describe the student's strengths and weaknesses."

**StudentForm — Target Region:**
- Required; one of "local" or "international" must be selected.
- Error: "Please select a target region."

---

## Disabled State Summary

All interactive elements across the application are disabled in the following conditions:

| Condition | Elements Disabled |
|---|---|
| API call in flight from a form submit | All inputs and buttons in that form |
| "Generate Recommendations" in flight | Edit Student, Generate Recommendations, Generate Action Plan buttons |
| "Generate Action Plan" in flight | Edit Student, Generate Recommendations, Generate Action Plan buttons |
| Page data loading | Action buttons not shown until data resolves |

Disabled elements always set `aria-disabled="true"` and apply `opacity: 0.5` with `cursor: not-allowed`.

---

## Non-Goals

- No toast notifications or floating overlays (consistent with REQ-039, no visual complexity)
- No undo functionality
- No optimistic UI updates (page reflects server state only after API confirms)
- No real-time validation as the user types (except the on-change re-validation rule after first submit attempt)
