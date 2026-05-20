# Spec C: UX Hardening + Accessibility

> Every user flow has proper confirmation, feedback, validation, and accessibility. No single-click deletions, no blank empty states, no silent failures, no keyboard traps.

## Problem

The application has functional user flows but lacks the defensive UX layer that prevents user mistakes and confusion. Destructive actions happen on single click. Empty states show blank space. Forms don't indicate required fields. Async operations don't disable UI during flight. Interactive elements are not fully keyboard-accessible.

## Scope

### 1. Confirmation Dialogs for Destructive Actions (4 files)

Every delete/remove action requires a confirmation modal before executing.

| File | Action | Modal text |
|---|---|---|
| `StudentProfile/PlansTab.jsx` | Delete plan | "Delete this plan? This cannot be undone." |
| `AdminTeacherGroups/AdminTeacherGroups.jsx` | Remove teacher from group | "Remove {name} from {group}?" |
| `StudentProfile/ProgrammeChoicesTab.jsx` | Remove programme choice | "Remove {programme} from Band {band}?" |
| `CohortDetail/CohortDetail.jsx` | Remove student from cohort | Already has confirmation — verify and ensure consistent pattern |

**Pattern:** Use existing `Modal` component. Confirm button uses `variant="danger"` styling. Cancel returns to previous state. All modal text via `t()` i18n keys.

### 2. Empty States with Guidance (4 files)

Every list/view that can be empty shows a helpful message with next-step guidance.

| File | Current behavior | Fix |
|---|---|---|
| `SubmissionHistory/SubmissionHistory.jsx` | Returns `null` — blank space | Show "No submissions yet." For students: "Submit your programme choices to see them here." For teachers: "No student submissions to review." |
| `StudentPlan/StudentPlan.jsx` | "Not released" with no CTA | "Your counsellor will release your plan when it's ready. In the meantime, review your programme choices." |
| `StudentImport/StudentImport.jsx` | Success step has no navigation | Add "Done — Back to Dashboard" button and summary of what was imported |
| `Dashboard.jsx` (no-group teacher) | Not currently handled | New empty state: "Your administrator hasn't assigned you to any groups yet. Contact them to get started." (from Spec B, but the UI lives here) |

### 3. Form Validation Indicators (4 files)

Required fields get visual indicators. Inline errors on invalid submit. No server round-trip for client-validatable errors.

| File | Change |
|---|---|
| `Dashboard/Dashboard.jsx` | Create student dialog: asterisk on "Student Name" field, inline error "Name is required" on empty submit |
| `AdminTeacherGroups/AdminTeacherGroups.jsx` | Create group: asterisk on group name, inline error on empty submit, prevent duplicate name submission |
| `CohortDetail/CohortDetail.jsx` | Add members: disable "Add" button until at least one student selected |
| `LoginPage/LoginPage.jsx` | Candidate number field: add pattern hint "e.g. HKDSE-2026-A001", validate format client-side |

**Pattern:** Required fields show red asterisk (`*`) after label. Inline error message appears below field in `color: var(--color-error)` on invalid submit. Error clears when user starts typing.

### 4. Loading/Disabled States During Async Operations (5 files)

All async operations disable their triggering UI and show progress.

| File | Issue | Fix |
|---|---|---|
| `StudentProfile/StudentProfile.jsx` | Graduation modal fields not disabled during save | Disable all fields + buttons when `isPending`, show spinner on confirm button |
| `CohortDetail/CohortDetail.jsx` | Add member inputs enabled during request | Disable search inputs + add button during mutation |
| `Dashboard/Dashboard.jsx` | Export has empty catch block | Add toast error: `t('dashboard.exportFailed')` on failure |
| `StudentDashboard/StudentDashboard.jsx` | Submit button — no visual success feedback | Disable button, show checkmark icon + "Submitted" state for 3 seconds |
| `CohortDetail/CohortDetail.jsx` | Save cohort name — no disabled state | Disable save button during save, show spinner |

**Pattern:** During async: set `disabled={true}` on all form controls, show `LoadingSpinner` or spinner icon on the triggering button, prevent double-submit.

### 5. Accessibility Fixes (7 files)

| File | Issue | Fix |
|---|---|---|
| `Dashboard/Dashboard.jsx` | `role="button"` divs missing Space key handler | Add `onKeyDown` handler: if `event.key === ' '` or `event.key === 'Enter'`, call click handler. Add `tabIndex={0}`. |
| Multiple table components | `<th>` missing `scope` attribute | Add `scope="col"` to column headers, `scope="row"` to row headers in: `CohortDetail`, `DataAnalysis`, `SubmissionDetail`, `StudentListPage`, `AdminTeacherGroups`, `GroupPermissions` |
| `NavBarV2/NavBarV2.jsx` | Mobile hamburger missing `aria-expanded` | Add `aria-expanded={mobileMenuOpen}` to hamburger button |
| `StudentProfile/StudentProfile.jsx` | Tab panels — verify ARIA wiring | Ensure each `TabsContent` has `aria-labelledby` matching its `TabsTrigger` id |
| Modal components | Focus trap verification | Verify focus moves to modal on open, returns to trigger on close. Fix if broken. |
| `StudentDashboard/StudentDashboard.jsx` | Status changes not announced | Add `aria-live="polite"` wrapper around submission status badge |
| Async state changes globally | Toast announcements | Verify toast component has `role="status"` and `aria-live="polite"` |

### 6. i18n Keys for New UX Text

All new user-visible text added in this spec goes through `t()`. New keys:

```
confirmation.deletePlan         — "Delete this plan? This cannot be undone."
confirmation.removeFromGroup    — "Remove {name} from {group}?"
confirmation.removeProgramme    — "Remove {programme} from Band {band}?"
confirmation.confirm            — "Confirm"
confirmation.cancel             — "Cancel"

emptyState.noSubmissionsStudent — "No submissions yet. Submit your programme choices to see them here."
emptyState.noSubmissionsTeacher — "No student submissions to review."
emptyState.planNotReady         — "Your counsellor will release your plan when it's ready. Review your programme choices in the meantime."
emptyState.importSuccess        — "Import complete. {created} students created, {updated} updated."
emptyState.noGroupAccess        — "Your administrator hasn't assigned you to any groups yet. Contact them to get started."

validation.nameRequired         — "Name is required."
validation.candidateHint        — "e.g. HKDSE-2026-A001"
validation.selectAtLeastOne     — "Select at least one student."
validation.groupNameRequired    — "Group name is required."

permission.requiresPermission   — "Requires {permission} permission — contact your admin"
```

Plus zh-HK translations for all of the above.

## Success Criteria

1. **No single-click deletions:** Every destructive action shows confirmation modal
2. **No blank empty states:** Every list/view shows guidance when empty
3. **Required fields indicated:** Asterisks on required fields, inline errors on invalid submit
4. **No double-submit:** All async operations disable triggering UI during flight
5. **Keyboard navigable:** All interactive elements reachable via Tab, activatable via Enter/Space
6. **Screen reader compatible:** `aria-expanded`, `aria-live`, `scope` attributes present
7. **Focus management:** Modals trap focus, return focus to trigger on close

### E2E Test Requirements (Headed Playwright)

8. **Confirmation test:** Click delete plan → verify modal appears → click cancel → verify plan still exists → click delete → confirm → verify plan removed
9. **Empty state test:** Student with no submissions → verify helpful message visible, not blank
10. **Form validation test:** Try to create student with empty name → verify inline error appears → type name → verify error clears → submit → verify success
11. **Loading state test:** Click export → verify button is disabled during export → verify re-enabled after
12. **Keyboard test:** Tab through dashboard → verify all cohort cards reachable → press Space on card → verify navigation occurs
13. **Permission tooltip test:** Login as teacher without `data_import` → verify "Import" button visible but disabled → hover → verify tooltip shows permission message

## Out of Scope

- Color contrast audit (separate WCAG compliance spec)
- Screen reader testing with VoiceOver/NVDA (manual testing, not automated)
- Motion/animation accessibility (`prefers-reduced-motion`)
- Skip navigation links
- High contrast mode support

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Confirmation pattern | Reuse existing Modal component with danger variant | Consistent with existing UI; no new dependencies |
| Empty state pattern | Contextual message + CTA per role | Student and teacher see different guidance for same empty state |
| Validation pattern | Asterisk + inline error below field | Industry standard; no tooltip-only validation |
| Loading pattern | Disable controls + spinner on button | Prevents double-submit without blocking the entire page |
| Accessibility scope | ARIA attributes + keyboard handlers | Covers WCAG 2.1 Level A requirements; Level AA deferred |
| All new text | Through t() with i18n keys | Spec A established zero-hardcoded-text rule; Spec C follows it |
