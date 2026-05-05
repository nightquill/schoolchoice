# Skills — Frontend Engineer
# Intelligent Academic Advisor v2
# Date: 2026-03-27

---

## Patterns

### Controlled Tabbed Form Pattern (6 tabs, shared student state)

The Student Profile page uses a single parent component (`StudentProfile`) that fetches and owns the `student` object state. Each of the 6 tab sub-components (PersonalTab, GradesTab, LanguageTab, EvaluationsTab, ActivitiesTab, NotesTab) receives `studentId` and `student` as props. Sub-components call `onSaved(updatedStudent)` to propagate API responses back to the parent, keeping the single source of truth at the top level.

Tab selection is stored in the URL query param (`?tab=grades`) via `useSearchParams`, allowing deep-linking. The `Tabs` component renders only the active tab panel to avoid screen readers reading off-screen content. The WAI-ARIA Tabs pattern is implemented with `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and arrow-key navigation per the accessibility spec.

### Async Polling Pattern (plan generation, transcript parsing)

Two async polling flows exist:
1. **Plan generation** (`AcademicPlan.jsx`): `generatePlan(id)` is called, then `setInterval` polls `getPlanStatus(id)` every 2 seconds. On `complete`, `getPlan(id)` fetches the HTML content and the interval is cleared. On `failed`, the interval is cleared and an error is shown. Cancel button stops polling client-side without cancelling the server job.
2. **Transcript parsing** (`GradesTab` inside `StudentProfile.jsx`): `uploadTranscript()` is followed by polling `getTranscript(id)` every 3 seconds until `parse_status === 'complete'` or `'failed'`.

Interval refs (`useRef`) ensure cleanup on component unmount via `useEffect` return function. Polling state is tracked with `useState` boolean flags and `planStatus` string enum.

### Drag-to-Reorder with Keyboard Fallback (Up/Down buttons)

The `TargetSchools` page uses simple Up/Down arrow buttons as the primary reorder mechanism (no drag library dependency). On each button click, the local `targets` array is reordered optimistically (array splice), previous state is stored in `useRef`, and `reorderTargets(studentId, orderedIds)` is called. On API error, the previous array is restored from `useRef` and a Toast error is shown. ARIA labels on Up/Down buttons follow the accessibility spec: `aria-label="Move {school name} up"`.

### Focus Management for Modals

The `Modal` component implements the full WAI-ARIA dialog pattern:
- On open, stores the trigger element (`document.activeElement`) in a `ref`.
- Queries all focusable elements inside the dialog on each open; focuses the first one.
- Adds a `keydown` listener for `Tab`/`Shift+Tab` to trap focus within the dialog.
- Adds a `keydown` listener for `Escape` to close the dialog.
- On close (`isOpen` becomes false), restores focus to the stored trigger element.
- Backdrop click closes the dialog (propagation is stopped on the dialog box itself).

### HKDSE UI Patterns

**Predicted Grade Display**: The `PredictedGradeBadge` component shows official grades as plain text and predicted grades as italic text with `~` prefix, grey background (`var(--color-background)`), and a tooltip `title` attribute: "Predicted — based on mock/trial sitting(s)". The `aria-label` attribute is set to `"Predicted grade: {grade}"` for screen readers.

**Eligibility Badge**: The `EligibilityBadge` component renders `ELIGIBLE` in green (`var(--color-success)`) or `INELIGIBLE` in red (`var(--color-error)`), both with white text. The `aria-label` includes the failing criteria when ineligible: `"Ineligible: {failingCriteria}"`. This meets WCAG AA contrast requirements as specified in the accessibility spec.

---

## Rules

- REQ-ID comment at top of every page file (e.g., `// REQ-088: Dashboard Page`)
- All styling via CSS custom properties (`var(--...)`) only — no raw hex/px values in JSX
- API calls only through `src/api/` layer — no direct `axios` or `fetch` calls in page or component files (exception: `client` is imported directly only where a new v2 endpoint has no dedicated API file yet)
- Never write Python, SQL, or design specs in this codebase
- Never rewrite or delete v1 files
- All new pages wrap in a `ProtectedRoute` in `App.jsx`
- Admin-only pages perform role check in the component on mount and redirect to `/dashboard` if role is not `admin`
- State management uses React Context API (existing `AuthContext`) — do not introduce Redux or Zustand
- All forms show validation errors inline via `TextInput` `error` prop, never as `alert()`
- Toast notifications use `useToast()` hook and `<Toast toasts={toasts} removeToast={removeToast} />` at the bottom of each page
