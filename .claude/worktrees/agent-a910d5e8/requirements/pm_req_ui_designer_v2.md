# PM → UI Designer — v2 Requirements Packet
# Intelligent Academic Advisor — v2 Pipeline
# Date: 2026-03-27
# Note: REQ-001–REQ-042 are DONE. This packet covers NEW requirements only.

---

## Context

v1 delivered: design tokens, page layouts for Login/Register/StudentList/StudentDetail/RecommendationPage, component specs, interaction states. These design artifacts stand. Your task is to extend the design system for all new pages and components introduced in v2.

---

## Owned Requirements (v2)

### REQ-051 [ARCH→UI] — WCAG AA Compliance
All components designed in v2 must meet WCAG AA standards:
- Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text
- All interactive elements must have visible focus states
- Form fields must have associated labels
- Icons used alone (without text) must have aria-label or title attributes
- Error messages must be programmatically associated with their input fields
Document compliance approach in `design/accessibility_spec.md`.

### REQ-052 [ARCH→UI] — Mobile Responsive Design
All new page layouts must be usable at 375px viewport width (mobile) through 1440px (desktop). Design for a fluid/responsive layout using CSS Grid or Flexbox. Breakpoints: 375px (mobile), 768px (tablet), 1280px (desktop).

### REQ-088 [UI] — Dashboard Page Layout
Design the Dashboard page:
- Header with navigation (logo, nav links, account menu)
- Student list summary cards: student name, year of study, last updated, quick-link to profile
- Summary statistics bar: total students, plans generated, pending actions
- Counsellor identity shown in header

### REQ-089 [UI] — Tabbed Student Profile Page
Design the full Student Profile page with 6 tabs:
1. **Personal Information** — full name, preferred name, DOB, age (auto), gender, address, phone, email
2. **Grades** — subject grade table (see REQ-090/REQ-091), grade system selector, transcript upload button
3. **Language Scores** — IELTS band + subscores + date; additional language scores (add/remove rows)
4. **Teacher Evaluations** — per-subject rows: subject, teacher name, 1–5 star rating, written comment, date
5. **Extracurricular & Awards** — two sub-sections: activities table + awards table
6. **Notes** — full-width free text

### REQ-090 [UI] — Subject Grade Entry Table
Design the grade entry table in the Grades tab:
- Columns: Subject (dropdown), Sitting (Mock/Trial/Official), Grade (dropdown), Predicted Grade (auto/manual, visually distinct), Transcript Uploaded (checkbox), Notes (inline text), Actions (edit/delete)
- "Add row" button at bottom
- Multiple sittings per subject shown as separate rows (grouped by subject)
- Predicted grade column: use italic text + grey background or a "~" prefix badge

### REQ-091 [UI] — Predicted Grade Visual Treatment
Predicted grades must be visually distinguished from official grades throughout the system:
- In the grade table: italic, lighter text colour, optional prefix "~" or "(predicted)" badge
- In the Academic Plan and any summary views: same treatment
- NEVER show a predicted grade without a visual indicator

### REQ-092 [UI] — Student Target Schools Page
Design the Target Schools page:
- List of StudentSchoolTarget cards with: school name, match score (as %, colour-coded: green ≥70%, yellow 40–69%, red <40%), eligibility badge (ELIGIBLE / INELIGIBLE), SHAP summary (3 bullet points), preference rank number, status chip (CONSIDERING / APPLIED / ADMITTED / REJECTED / WITHDRAWN)
- Drag handle on left of each card for reordering
- "Add School" button linking to School Directory
- Edit/remove action per card

### REQ-093 [UI] — Drag-to-Reorder Interaction
The preference rank reorder interaction:
- Cards have a visible drag handle (≡ icon)
- Dragging a card updates the rank numbers in real time
- On drop, a save indicator confirms the new order was persisted
- Keyboard fallback: up/down arrow buttons on each card

### REQ-094 [UI] — School Directory Page
Design the School Directory:
- Search bar (live search by name)
- Filter panel: Type (checkbox list), Location (text or dropdown), Min Entry Score (range slider)
- Results as a table or card grid: school name (EN + ZH), type badge, location, min entry score, scholarship indicator
- Clicking a row/card navigates to School Profile

### REQ-095 [UI] — School Profile Page
Design the School Profile page:
- Hero section: name (EN), name (ZH), type badge, location, website link
- Key stats bar: min entry score, acceptance rate, average admitted score, scholarship available
- Sections: Required Subjects, Language Requirements, Faculties, Notable Programs
- Data provenance footer: source name, last updated date
- "Add to Target List" button (if student context is active) or "Back to Directory"

### REQ-096 [UI] — Academic Plan Page
Design the Academic Plan view:
- Toolbar: student name, plan version, generated date, Print button
- Full-page iframe or scrollable container rendering the HTML plan
- Print button triggers window.print() or opens the HTML in a new tab
- Loading state while plan generation is in progress (spinner + estimated time message)

### REQ-097 [UI] — Account Settings Page
Design the Account Settings page:
- Sections: Profile (display name), Security (password change), Preferences (language, notifications), Danger Zone (delete account)
- Email shown as read-only with note "contact admin to change"
- Password change: 3 fields (current, new, confirm) + submit button
- Language selector: English / 中文 (toggle or dropdown)
- Notifications: toggle switch (placeholder, not wired)
- Delete Account: red button, triggers modal with password confirmation before soft-delete

### REQ-098 [UI] — Admin Data Refresh Page
Design the Admin: Data Refresh page:
- Header with "Admin" badge
- Status card: last refresh date/time, data freshness indicators per source (HKEAA, JUPAS, Universities)
- "Trigger Data Refresh" button with confirmation modal
- Refresh progress indicator (polling state)

### REQ-103 [UI] — Ineligible School Visual Treatment
Ineligible schools in the Target Schools list:
- Grey out the card or apply a muted colour scheme
- Display a red "INELIGIBLE" badge
- Show the specific failing criterion below the badge (e.g., "Below minimum entry score: requires 18, student best-5 is 14")

### REQ-104 [UI] — Grade System Selector
The grade system selector (HKDSE / A-Level / IB / Custom) must default to HKDSE. Non-HKDSE options must be selectable but show a "(partial support)" note. Placeholder message: "Full support for this grade system is coming soon."

---

## Deliverables

- `design/page_layouts_v2.md` — layout specs for all new pages (Dashboard, School Directory, School Profile, Academic Plan, Account Settings, Admin Data Refresh) and updated Student Profile
- `design/component_specs_v2.md` — specs for new components (TargetSchoolCard, GradeEntryTable, ShapExplainPanel, PlanIframe, DragHandle, StatusChip, SchoolFilterPanel, etc.)
- `design/accessibility_spec.md` — WCAG AA compliance approach
- `design/interaction_states_v2.md` — async loading states (plan generation, transcript parsing, drag reorder)
- `skills/ui-designer.md` — skills file (create or append)

---
*Packet owner: UI Designer. All items PENDING.*
