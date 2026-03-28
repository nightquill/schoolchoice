# Component Specifications — v2
# Intelligent Academic Advisor — v2 Pipeline
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE
# Note: This file defines NEW components only. All v1 components
#       (Button, TextInput, FormCard, StudentRow, StudentForm, SchoolCard,
#       RecommendationCard, ActionPlanDisplay, NavBar, LoadingSpinner,
#       ErrorMessage, EmptyState) are fully specified in component_specs.md
#       and must not be redesigned here.
#       All values reference tokens in design_tokens.md.

---

## Component Index (v2)

1. Tabs
2. GradeTable
3. PredictedGradeBadge
4. SchoolCard (v2 — directory use; replaces informational-only v1 SchoolCard)
5. TargetSchoolRow
6. EligibilityBadge
7. ShapSummary
8. StatusChip
9. StarRating
10. FileUpload
11. Toast
12. Modal
13. DragHandle

---

---

## 1. Tabs

**REQ-IDs:** REQ-089

### Purpose

A tab bar that switches between named panels within a single page. Used on the
Student Profile page to organise the six profile sections. Keyboard-navigable
per WAI-ARIA Tabs pattern.

### Pages

Student Profile

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| tabs | array of `{id: string, label: string}` | required | Ordered list of tab definitions |
| activeTab | string | required | The `id` of the currently active tab |
| onChange | function | required | Callback invoked with the tab `id` when a tab is selected |

### Visual Structure

**Tab Bar:**
- Full-width strip. Background: `var(--color-surface)`.
- Border bottom: `var(--border-width)` solid `var(--color-border)`.
- Tabs are a horizontal flex row. Overflow: horizontally scrollable on narrow viewports
  (no truncation of tab labels).
- Each tab button:
  - Padding: `var(--space-3)` vertical, `var(--space-5)` horizontal.
  - Font size: `var(--font-size-md)`.
  - Font weight: `var(--font-weight-normal)` (inactive) / `var(--font-weight-medium)`
    (active).
  - Text colour: `var(--color-text-secondary)` (inactive) / `var(--color-text-primary)`
    (active).
  - Active indicator: a 2px border-bottom segment in `var(--color-primary)`, flush
    with the tab bar's own bottom border.
  - Background: transparent (all states).
  - No border on inactive tabs.
  - Cursor: pointer.

**Tab Panel:**
- The content region below the tab bar.
- Padding: `var(--space-6)` top, as specified per tab in page_layouts_v2.md.
- Only the active panel is rendered (or visible); inactive panels are unmounted
  or hidden to prevent screen readers from reading off-screen content.

### Interaction States

| State | Description |
|---|---|
| Default (inactive tab) | `var(--color-text-secondary)`, no underline indicator |
| Active tab | `var(--color-text-primary)`, `var(--font-weight-medium)`, `var(--color-primary)` bottom indicator |
| Hover (inactive tab) | `var(--color-text-primary)` text; no indicator added |
| Focus | 2px solid `var(--color-primary)` outline, offset 2px, on the focused tab button |
| Loading (tab panel) | LoadingSpinner (md) rendered inside the panel while data loads |

### Accessibility

- The tab bar container has `role="tablist"`.
- Each tab button has `role="tab"`, `aria-selected="true/false"`, and
  `aria-controls="[panel-id]"`.
- Each tab panel has `role="tabpanel"`, `id="[panel-id]"`, and
  `aria-labelledby="[tab-id]"`.
- Only the active tab has `tabindex="0"`; all others have `tabindex="-1"`.
- Keyboard navigation:
  - Tab key: moves focus to the active tab button (then Tab again moves into the panel).
  - Left Arrow / Right Arrow: moves focus between tab buttons (within the tablist;
    wraps at ends). Does not activate the tab automatically (follows the manual
    activation pattern — Enter or Space activates).
  - Enter / Space: activates the focused tab.
  - Home: moves focus to first tab.
  - End: moves focus to last tab.
- When a tab is activated, focus moves to the tab panel (or to the first focusable
  element within it). See accessibility_spec.md §Focus Management.

---

---

## 2. GradeTable

**REQ-IDs:** REQ-090, REQ-091

### Purpose

An inline-editable table for entering and managing student subject grade records.
Each row represents one StudentSubjectGrade entry. Multiple rows for the same
subject (different sittings) are permitted and displayed as sequential rows.

### Pages

Student Profile → Grades tab

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| grades | array of grade objects | required | Current grade records from GET /api/v1/students/{id}/grades |
| subjects | array of subject objects | required | Subject options from GET /api/v1/subjects |
| onAdd | function | required | Called with new grade data object when user saves a new row |
| onDelete | function | required | Called with `grade_id` when user confirms deletion of a row |
| onUpdate | function | required | Called with `{grade_id, ...updatedFields}` when a row is saved |

### Visual Structure

**Table container:**
- Background: `var(--color-surface)`. Border: `var(--border-width)` solid
  `var(--color-border)`. Border radius: `var(--border-radius-md)`. Overflow: visible.

**Table header row:**
- Background: `var(--color-background)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)`.
- Column labels: `var(--font-size-sm)` `var(--font-weight-medium)` `var(--color-text-secondary)`.
- Padding per header cell: `var(--space-3)` vertical, `var(--space-4)` horizontal.
- Columns:
  1. Subject (flexible width, ~25%)
  2. Sitting (~12%)
  3. Grade (~10%)
  4. Predicted Grade (~15%) — header cell has a background tint of
     `var(--color-border)` at 50% opacity and an italic label "Predicted" to signal
     that this column has special visual treatment.
  5. Transcript (~10%) — header label "Transcript ✓"
  6. Notes (~18%)
  7. Actions (~10%) — no header label text; aria-label "Row actions"

**Data rows:**
- Background: `var(--color-surface)`. Border bottom: `var(--border-width)` solid
  `var(--color-border)` (between rows).
- Padding per cell: `var(--space-3)` vertical, `var(--space-4)` horizontal.
- Row height: sufficient to contain one line of text (single-line inputs).
- Hover state: background `var(--color-background)`.

**Cell contents:**

- **Subject cell:** Dropdown (select element) showing subject name. Options populated
  from `subjects` prop. `var(--font-size-md)` `var(--color-text-primary)`.
- **Sitting cell:** Dropdown. Options: Mock | Trial | Official.
- **Grade cell:** Dropdown. Options depend on grade system (e.g., 5**, 5*, 5, 4, 3, 2,
  1, U for HKDSE). `var(--font-size-md)` `var(--color-text-primary)`.
- **Predicted Grade cell:** Displays PredictedGradeBadge component if `predicted_grade`
  is non-null, otherwise empty. Cell background: a light tint of `var(--color-border)`
  (same as header) to visually group the column.
- **Transcript cell:** Checkbox input. Checked when `transcript_uploaded` is true.
  Centred within the cell.
- **Notes cell:** TextInput (inline, no visible border in default state — border
  appears on focus). `var(--font-size-sm)`.
- **Actions cell:** Two icon buttons side by side:
  - Save (checkmark character): visible only when the row has unsaved changes.
    `var(--color-primary)`. aria-label: "Save changes to [subject name] row".
  - Delete (× character): always visible. `var(--color-error)`.
    aria-label: "Delete [subject name] [sitting] row".

**New row (add state):**
- A blank row appended at the bottom when "Add Row" is clicked. All cells show their
  empty/default state. Save and Cancel buttons shown in Actions cell.

**"Add Row" button:**
- Secondary Button variant. Full width below the table. Label: "+ Add Row".
- Gap between table and button: `var(--space-3)`.

### Interaction States

| State | Description |
|---|---|
| Default row | Static display of saved values |
| Editing row | All cell inputs are active. Save icon button appears. |
| Saving row | Save icon button shows loading state (aria-busy). Row inputs disabled. |
| Save success | Row returns to default state. Toast notification "Grade saved." |
| Save error | ErrorMessage banner above table. Row inputs re-enabled. |
| Delete confirmation | Row background changes to light `var(--color-error)` tint. "Confirm" and "Cancel" appear in Actions cell. |
| Delete in progress | "Confirm" button enters loading state (aria-busy). |

### Accessibility

- Table uses native `<table>` element with `<th scope="col">` for header cells.
- `role="grid"` on the table element (interactive cells within rows).
- Each row has `role="row"`. Each editable cell has appropriate input labelling:
  the visible column header is the programmatic label for each cell's input via
  `aria-labelledby` referencing the column header `id`.
- Delete confirmation: announce via `aria-live="assertive"` region when confirmation
  prompt appears.
- Keyboard navigation: Tab moves through inputs within a row; Enter triggers Save
  in editing mode.

---

---

## 3. PredictedGradeBadge

**REQ-IDs:** REQ-091

### Purpose

A visual indicator distinguishing predicted grades from official grades throughout
the system. Must never be omitted when displaying a predicted grade. Used in the
GradeTable Predicted Grade column and in any summary view that shows grades.

### Pages

Student Profile → Grades tab; Academic Plan page (within iframe — styling is
embedded in the plan HTML; this component controls the design specification for
counsellor-facing UI only).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| grade | string | required | The predicted grade value to display (e.g. "4", "5*") |
| isOfficial | boolean | optional | When true, renders as a plain grade (no badge treatment). Defaults to false. |

### Visual Structure

**Predicted state (isOfficial = false):**
- Container: inline-block pill. Background: `var(--color-background)`.
  Border: `var(--border-width)` solid `var(--color-border)`.
  Border radius: `var(--border-radius-sm)`. Padding: `var(--space-1)` vertical,
  `var(--space-2)` horizontal.
- Prefix character: "~" — displayed before the grade value in the same pill.
  `var(--font-size-xs)` `var(--color-text-secondary)`.
- Grade value: italic. `var(--font-size-sm)` `var(--color-text-secondary)`.
- Combined display example: "~4" where ~ is the prefix and 4 is the grade value,
  both italic within the pill.

**Official state (isOfficial = true):**
- No pill, no prefix. Plain text rendering.
  `var(--font-size-sm)` `var(--color-text-primary)` `var(--font-weight-normal)`.

### Interaction States

PredictedGradeBadge is non-interactive. No interactive states.

### Accessibility

- When rendered as predicted: an `aria-label` of "Predicted grade: [grade]" is
  applied to the container element so screen readers announce the distinction.
- When rendered as official (isOfficial=true): plain text, no additional aria label.

---

---

## 4. SchoolCard (v2)

**REQ-IDs:** REQ-094

### Purpose

A card displayed in the School Directory results grid. Shows enough information for a
counsellor to assess whether a school is worth visiting in full. Clicking the card
navigates to the School Profile page. This is a v2 expansion of the informational
SchoolCard defined in v1 (v1 SchoolCard was internal to RecommendationCard; this v2
card is independently surfaced in the directory grid).

### Pages

School Directory

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| school | object | required | School summary object from GET /api/v1/schools items array |
| onClick | function | required | Callback invoked when card is clicked; receives `school.id` |

The `school` object contains: `id`, `name`, `name_zh`, `type`, `location`,
`minimum_entry_score`, `scholarship_available`.

### Visual Structure

- Container: Background `var(--color-surface)`. Border: `var(--border-width)` solid
  `var(--color-border)`. Border radius: `var(--border-radius-md)`. Padding: `var(--space-5)`.
  Shadow: `var(--shadow-sm)`. Cursor: pointer.
- School name (EN): `var(--font-size-lg)` `var(--font-weight-bold)` `var(--color-text-primary)`.
- School name (ZH): `var(--font-size-sm)` `var(--color-text-secondary)`, below EN name.
  Hidden if `name_zh` is null or empty.
- Type badge: same pill treatment as School Profile hero (see page_layouts_v2.md
  Zone A). Displayed inline after the ZH name or after EN name if ZH is absent.
- Location: `var(--font-size-sm)` `var(--color-text-secondary)`.
- Minimum entry score: label "Min. score: " + value, or "Min. score: —" if null.
  `var(--font-size-sm)` `var(--color-text-secondary)`.
- Scholarship badge: shown only when `scholarship_available` is true. Pill with
  background `var(--color-success)` at 15% opacity (very light green), border
  `var(--border-width)` solid `var(--color-success)`, text "Scholarship" in
  `var(--color-success)`, `var(--font-size-xs)` `var(--border-radius-sm)` padding
  `var(--space-2)`.
- Content vertical stack: name (EN) → name (ZH) → type badge → location → min score
  → scholarship badge (conditional). Gap: `var(--space-2)` between each element.

### Interaction States

| State | Description |
|---|---|
| Default | As described above |
| Hover | Shadow: `var(--shadow-md)`. Background: `var(--color-background)`. No animation. |
| Focus | Outline: 2px solid `var(--color-primary)`, offset 2px, on the card container. |
| Active | Shadow: `var(--shadow-sm)`. Background slightly darker than hover (same approach as Button active state). |

### Accessibility

- `role="article"` on the card container.
- `aria-label`: "[school name EN], [type], located in [location]".
- The entire card is keyboard-focusable (`tabindex="0"`).
- Activates on Enter key in addition to click.
- If scholarship badge is present: included in aria-label as "…, scholarship available".

---

---

## 5. TargetSchoolRow

**REQ-IDs:** REQ-092, REQ-093, REQ-103

### Purpose

A single row in the student's Target Schools ranked list. Draggable for reordering.
Displays eligibility, fit score, SHAP top feature, and application status. Ineligible
schools are visually muted but still shown per REQ-103.

### Pages

Target Schools

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| target | object | required | StudentSchoolTarget object from GET /api/v1/students/{id}/targets |
| onRemove | function | required | Called with `target.id` when remove is confirmed |
| onViewSchool | function | required | Called with `target.school_id` to navigate to School Profile |
| onMoveUp | function | required | Called with `target.id` for keyboard-fallback up reorder |
| onMoveDown | function | required | Called with `target.id` for keyboard-fallback down reorder |

The `target` object contains: `id`, `student_id`, `school_id`, `school_name`,
`school_name_zh`, `student_rank`, `match_score`, `eligibility_pass`,
`eligibility_fail_reason`, `shap_explanation`, `status`.

### Visual Structure

**Row layout (horizontal flex, left to right):**

1. DragHandle component — leftmost, centred vertically.
2. Rank badge — filled circle. Background `var(--color-primary)`.
   Text: rank number, `var(--color-surface)`, `var(--font-size-sm)` `var(--font-weight-bold)`.
   Size: 28px × 28px (use `var(--space-7)` if a new token is needed; otherwise
   approximate with `var(--space-6)` + 2px). Border radius: 50%.
3. School name block — flexible width, main content:
   - EN name: `var(--font-size-md)` `var(--font-weight-medium)` `var(--color-text-primary)`.
   - ZH name (if present): `var(--font-size-xs)` `var(--color-text-secondary)`, below.
4. EligibilityBadge component.
5. Fit score % — formatted as integer with "%" suffix (e.g. "73%").
   Colour-coded as specified in page_layouts_v2.md Zone B.
   `var(--font-size-sm)` `var(--font-weight-medium)`.
6. ShapSummary component (compact/collapsed mode showing only top 1 feature).
7. StatusChip component.
8. Actions block:
   - "View School" link button: `var(--font-size-sm)` `var(--color-primary)`.
     aria-label: "View school profile for [school name]".
   - "Remove" link button: `var(--font-size-sm)` `var(--color-error)`.
     aria-label: "Remove [school name] from target list".
   - On "Remove" click: inline confirmation prompt replaces action buttons:
     "Remove [school name]? [Confirm] [Cancel]". On Confirm: `onRemove(target.id)`.

**Ineligible row treatment (REQ-103):**
- Row background: a muted overlay — `var(--color-border)` at 30% opacity layered
  over `var(--color-surface)`.
- All text colours remain at their standard tokens (no further dimming); the background
  tint alone communicates the muted state. Contrast ratios are maintained (see
  accessibility_spec.md).
- EligibilityBadge shows "INELIGIBLE" red state.

**Row container:** `var(--space-4)` vertical padding, `var(--space-3)` horizontal.
Border bottom: `var(--border-width)` solid `var(--color-border)`.

### Interaction States

| State | Description |
|---|---|
| Default | Standard layout |
| Dragging | Row has `var(--shadow-md)` applied (elevated appearance). Adjacent rows shift position to show insertion point (a 2px `var(--color-primary)` line). |
| Drag over target | 2px `var(--color-primary)` line above the target row. |
| Remove confirmation | Actions column shows inline "Remove [name]? [Confirm] [Cancel]" prompt. |
| Hover | Background `var(--color-background)`. No animation. |
| Focus (row) | 2px solid `var(--color-primary)` outline on the row container. |

### Accessibility

- Each row is a `<li>` within a `<ul role="listbox">` (or `role="list"`) container.
- `role="option"` is not used; rows use `role="listitem"`.
- `aria-label` on the row: "[rank]. [school name], fit score [score]%, [status]".
- DragHandle has `aria-hidden="true"` (the keyboard fallback buttons are the
  accessible reorder mechanism).
- Up/Down buttons (see DragHandle component) have aria-labels:
  "Move [school name] up in preference order" and "Move [school name] down in
  preference order".
- Remove confirmation uses `aria-live="assertive"` to announce the prompt.

---

---

## 6. EligibilityBadge

**REQ-IDs:** REQ-092, REQ-103

### Purpose

A coloured badge indicating whether a student meets a school's entry requirements.
ELIGIBLE is shown in green; INELIGIBLE in red with the specific failing criterion.

### Pages

Target Schools (within TargetSchoolRow), School Profile (contextual, when student
context is active).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| pass | boolean | required | `true` for ELIGIBLE, `false` for INELIGIBLE |
| failingCriteria | string | optional | Human-readable reason for ineligibility. Displayed below the badge when `pass` is false. Mapped from `eligibility_fail_reason` API field. |

### Visual Structure

**ELIGIBLE (pass = true):**
- Pill container: background `var(--color-success)` at 15% opacity.
  Border: `var(--border-width)` solid `var(--color-success)`.
  Border radius: `var(--border-radius-sm)`. Padding: `var(--space-1)` vertical,
  `var(--space-2)` horizontal.
- Label text: "ELIGIBLE". `var(--font-size-xs)` `var(--font-weight-medium)`
  `var(--color-success)`.

**INELIGIBLE (pass = false):**
- Pill container: background `var(--color-error)` at 15% opacity.
  Border: `var(--border-width)` solid `var(--color-error)`.
  Same dimensions as ELIGIBLE pill.
- Label text: "INELIGIBLE". `var(--font-size-xs)` `var(--font-weight-medium)`
  `var(--color-error)`.
- Failing criteria text (when `failingCriteria` is non-empty):
  Displayed below the pill, not within it. `var(--font-size-xs)` `var(--color-error)`.
  Example: "Below minimum entry score: requires 18, student best-5 is 14."

### Interaction States

EligibilityBadge is non-interactive. No interactive states.

### Accessibility

- `role="status"` on the badge container.
- `aria-label`: "Eligibility: ELIGIBLE" or "Eligibility: INELIGIBLE.
  [failingCriteria text]" (the full reason is included in the aria-label so screen
  readers announce the complete eligibility picture in one announcement).

---

---

## 7. ShapSummary

**REQ-IDs:** REQ-092

### Purpose

Displays the top 1–3 SHAP feature explanations from the matchmaking engine in
plain English, helping counsellors understand why a student's fit score is what it is.

### Pages

Target Schools (within TargetSchoolRow).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| shapExplanation | object | required | `shap_explanation` field from StudentSchoolTarget. Shape: `{top_features: [{feature, value, direction, plain_text}]}` |
| maxFeatures | number | optional | Maximum number of features to show. Defaults to 1 (collapsed); expand shows up to 3. |
| expanded | boolean | optional | When true, shows up to `maxFeatures` features. When false (default), shows only the top 1. |
| onToggle | function | optional | Callback when user expands/collapses the summary. |

### Visual Structure

**Collapsed (expanded = false, shows 1 feature):**
- A single line of plain text: the `plain_text` of the top feature.
  `var(--font-size-xs)` `var(--color-text-secondary)`.
  Max width: approximately 200px with text truncation (ellipsis) if longer.
- Expand affordance: a small "+" text link after the line if 2 or more features exist.
  `var(--font-size-xs)` `var(--color-primary)`. aria-label: "Show more reasons".

**Expanded (expanded = true, shows up to 3 features):**
- A vertical list of up to 3 feature lines, each on its own row.
  Same text style as collapsed.
- Collapse affordance: "−" text link at the end. aria-label: "Show fewer reasons".

**Null / empty state:**
- If `shapExplanation` is null or `top_features` is empty: display nothing (component
  renders as empty).

### Interaction States

| State | Description |
|---|---|
| Default (collapsed) | 1 feature line + expand affordance |
| Expanded | Up to 3 feature lines + collapse affordance |
| Expand/collapse focus | 2px solid `var(--color-primary)` outline on the affordance link |

### Accessibility

- The feature list container uses `role="list"` with each feature as `role="listitem"`.
- Expand/collapse toggle is a `<button>` element with appropriate aria-label.
- `aria-expanded` attribute on the toggle reflects current state.
- When expanded: the new content is within an `aria-live="polite"` region so screen
  readers announce the additional features.

---

---

## 8. StatusChip

**REQ-IDs:** REQ-092

### Purpose

A colour-coded status label indicating where a student is in their application
process for a specific school.

### Pages

Target Schools (within TargetSchoolRow).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| status | string | required | One of: `CONSIDERING`, `APPLIED`, `ADMITTED`, `REJECTED`, `WITHDRAWN` |
| onChange | function | optional | If provided, the chip becomes a clickable cycle or dropdown to update status. Receives the new status string. |

### Visual Structure

All chips: pill shape, `var(--border-radius-sm)`, padding `var(--space-1)` vertical
`var(--space-2)` horizontal, `var(--font-size-xs)` `var(--font-weight-medium)`.

| Status | Background (token + opacity) | Border | Text Colour |
|---|---|---|---|
| CONSIDERING | `var(--color-secondary)` at 15% | `var(--color-secondary)` | `var(--color-secondary)` |
| APPLIED | `var(--color-primary)` at 15% | `var(--color-primary)` | `var(--color-primary)` |
| ADMITTED | `var(--color-success)` at 15% | `var(--color-success)` | `var(--color-success)` |
| REJECTED | `var(--color-error)` at 15% | `var(--color-error)` | `var(--color-error)` |
| WITHDRAWN | `var(--color-warning)` at 15% | `var(--color-warning)` | `var(--color-warning)` |

Border width: `var(--border-width)` on all.

### Interaction States

**Read-only (onChange not provided):**
- No interactive states. Static display.

**Editable (onChange provided):**
- Cursor: pointer. Clicking opens a small dropdown (or cycles through values).
- Hover: background opacity increases to 25%.
- Focus: 2px solid `var(--color-primary)` outline.

### Accessibility

- `role="status"` when read-only.
- When editable: `role="button"`, `aria-label`: "Application status: [status]. Click to change."
- Status change dropdown (if used): `role="listbox"` with `role="option"` items.
- Keyboard: Enter/Space opens the dropdown or cycles status when editable.

---

---

## 9. StarRating

**REQ-IDs:** REQ-089

### Purpose

A 1–5 star interactive rating input used in Teacher Evaluation cards. Can also
render as read-only.

### Pages

Student Profile → Teacher Evaluations tab.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| value | number (1–5 or null) | required | Current rating value. Null means unset. |
| onChange | function | optional | Callback with new numeric value. If omitted, renders read-only. |
| readOnly | boolean | optional | Explicitly forces read-only mode. Defaults to false. |
| label | string | optional | Accessible label for the rating group. Defaults to "Rating". |

### Visual Structure

Five star elements in a horizontal row. Gap: `var(--space-1)`.

**Filled star (value ≤ current rating):**
- Character: "★" (Unicode HEAVY BLACK STAR).
- Colour: `var(--color-warning)`.
- Font size: `var(--font-size-lg)`.

**Empty star (value > current rating):**
- Character: "☆" (Unicode WHITE STAR).
- Colour: `var(--color-border)`.
- Font size: `var(--font-size-lg)`.

**Hover preview (interactive, readOnly = false):**
- While the cursor hovers over star N, stars 1–N render as filled and stars N+1–5
  render as empty (preview of the new value). This uses a CSS :hover approach with
  no animation.

### Interaction States

| State | Description |
|---|---|
| Default | Stars filled up to `value`; remainder empty |
| Hover (star N) | Stars 1–N shown as filled preview. No animation. |
| Focus (star N) | 2px solid `var(--color-primary)` outline around the focused star |
| Active (click) | Selected value updates. `onChange` is called. |
| Read-only | No hover or focus states on stars. Stars reflect `value` statically. |

### Accessibility

- Container: `role="radiogroup"`, `aria-label` from `label` prop.
- Each star: `role="radio"`, `aria-checked="true/false"`,
  `aria-label`: "[N] star[s]" (e.g. "3 stars").
- Only the currently selected star (or the first star if value is null) has
  `tabindex="0"`; others have `tabindex="-1"`.
- Keyboard navigation:
  - Tab: focuses the radiogroup (lands on the current value star).
  - Left Arrow / Right Arrow: moves between stars within the group, updating value
    on movement (follows the radio group roving tabindex pattern).
  - Home: sets value to 1.
  - End: sets value to 5.

---

---

## 10. FileUpload

**REQ-IDs:** REQ-089 (transcript upload, Grades tab)

### Purpose

A drag-and-drop file upload zone with a fallback file picker button. Used for
transcript upload on the Grades tab.

### Pages

Student Profile → Grades tab.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| onFile | function | required | Callback invoked with the selected File object |
| accept | string | optional | MIME types or extensions accepted (e.g. "application/pdf,image/*"). Defaults to "application/pdf,image/*". |
| loading | boolean | optional | When true, shows a parsing progress indicator. |
| progress | string | optional | Status text shown during loading (e.g. "Parsing transcript…"). Defaults to "Processing…". |

### Visual Structure

**Default (idle) state:**
- Container: Background `var(--color-background)`. Border: 2px dashed `var(--color-border)`.
  Border radius: `var(--border-radius-md)`. Padding: `var(--space-8)` vertical,
  `var(--space-6)` horizontal. Text-align: center.
- Primary text: "Drag and drop your transcript here" — `var(--font-size-md)`
  `var(--color-text-secondary)`.
- Secondary text: "PDF or image, max 10 MB" — `var(--font-size-xs)`
  `var(--color-text-secondary)`.
- "Choose file" button: secondary Button variant, centred below text,
  `var(--space-3)` gap above.

**Drag-over state:**
- Border colour changes to `var(--color-primary)`.
- Background changes to `var(--color-primary)` at 5% opacity.

**Loading state:**
- Container shows LoadingSpinner (md) centred + `progress` prop text below in
  `var(--font-size-sm)` `var(--color-text-secondary)`.
- The "Choose file" button is hidden during loading.

**File accepted (before upload):**
- Container shows the file name in `var(--font-size-md)` `var(--color-text-primary)`
  + file size below in `var(--font-size-xs)` `var(--color-text-secondary)`.
- A "Remove" text link appears to clear the selection.

### Interaction States

| State | Description |
|---|---|
| Idle | Dashed border, prompt text, "Choose file" button |
| Drag over | Solid `var(--color-primary)` border, light blue tint background |
| File selected | File name + size displayed; Remove link shown |
| Loading | Spinner + progress text; controls hidden |
| Error (file rejected) | Border changes to `var(--color-error)`; error message below zone using ErrorMessage (inline variant) |

### Accessibility

- Container: `role="region"`, `aria-label`: "Transcript file upload area".
- The drop zone registers keyboard-focusable affordance: when focused, Enter key
  opens the system file picker.
- `aria-live="polite"` region within the container announces state changes
  (drag-over, file selected, loading, error).
- The hidden native file input is labelled via `aria-label`: "Upload transcript file".
  It is visually hidden but accessible to keyboard users via the "Choose file" button.
- Drag-and-drop is enhancement only; the "Choose file" button is always available.

---

---

## 11. Toast

**REQ-IDs:** REQ-093 (save confirmation), REQ-051

### Purpose

A non-blocking, auto-dismissing notification that appears in response to user
actions. Does not interrupt the user's workflow. Used for save confirmations,
errors, and informational messages throughout v2 pages.

### Pages

All v2 pages (global component, rendered at the root level).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| message | string | required | The notification text |
| type | string | required | One of: `success`, `error`, `info` |
| duration | number (ms) | optional | How long before auto-dismiss. Defaults to 4000ms. A duration of 0 means the toast persists until manually dismissed. |
| onDismiss | function | optional | Callback invoked when the toast is dismissed (either by timeout or user action). |

### Visual Structure

**Position:** Fixed, top-right of the viewport. Offset: `var(--space-6)` from top,
`var(--space-6)` from right. z-index above all page content.

**Container:** Background `var(--color-surface)`. Shadow: `var(--shadow-md)`.
Border radius: `var(--border-radius-md)`. Padding: `var(--space-4)`.
Min width: 240px. Max width: 360px.
Left border: 4px solid (colour depends on type — see below).

| Type | Left border colour | Label prefix |
|---|---|---|
| success | `var(--color-success)` | "✓ " |
| error | `var(--color-error)` | "✕ " |
| info | `var(--color-primary)` | "ℹ " |

- Message text: `var(--font-size-md)` `var(--color-text-primary)` `var(--line-height-normal)`.
- Dismiss "×" button: top-right corner of the toast, `var(--font-size-sm)`
  `var(--color-text-secondary)`. aria-label: "Dismiss notification".

**Multiple toasts:** Stack vertically with `var(--space-3)` gap. Maximum 3 toasts
visible simultaneously; excess toasts are queued and appear when one is dismissed.

### Interaction States

| State | Description |
|---|---|
| Appearing | Toast renders immediately at its final position. No slide/fade animation (REQ-039). |
| Visible | Standard appearance as described |
| Hovered | No visual change. Duration timer pauses while hovered (prevents auto-dismiss while user is reading). |
| Dismissed | Toast is removed from the DOM. No exit animation. |

### Accessibility

- Container: `role="alert"` for `error` type; `role="status"` for `success` and
  `info` types.
- `aria-live="assertive"` for `error`; `aria-live="polite"` for `success` and `info`.
- `aria-atomic="true"` on the container so the full message is announced, not
  character by character.
- The dismiss button is keyboard-focusable. Pressing Escape on any focused element
  within the toast dismisses it.
- Toasts do not steal keyboard focus from the user's current position.

---

---

## 12. Modal

**REQ-IDs:** REQ-097 (Delete Account), REQ-093 (reorder confirmation), REQ-095 (student selector), REQ-051

### Purpose

An accessible dialog overlay for confirmation prompts and selection flows. Used
for Delete Account confirmation, Data Refresh confirmation, and the "Select Student"
flow from School Profile. Focus is trapped within the modal while open.

### Pages

Account Settings, Admin: Data Refresh, School Profile, Target Schools.

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| isOpen | boolean | required | Controls visibility |
| title | string | required | Modal heading text |
| children | components | required | Body content |
| onClose | function | required | Callback when user cancels/closes (Escape key or Close button) |
| onConfirm | function | optional | Callback for the primary confirm action. If omitted, no Confirm button is rendered. |
| confirmLabel | string | optional | Label for the confirm button. Defaults to "Confirm". |
| confirmVariant | string | optional | Button variant for confirm button. Defaults to "primary". |
| size | string | optional | "sm" (400px) or "md" (560px). Defaults to "sm". |

### Visual Structure

**Backdrop:**
- Full-viewport overlay. Background: `var(--color-text-primary)` at 40% opacity
  (dark scrim). Renders behind the modal container.

**Modal container:**
- Background: `var(--color-surface)`. Border radius: `var(--border-radius-lg)`.
  Shadow: `var(--shadow-md)`. Padding: `var(--space-6)`.
- Width: 400px (sm) or 560px (md). On mobile: width 90vw, centred.
- Vertically centred in the viewport.

**Modal header:**
- Title: `var(--font-size-xl)` `var(--font-weight-bold)` `var(--color-text-primary)`.
- Close "×" button: top-right of header. `var(--font-size-lg)` `var(--color-text-secondary)`.
  aria-label: "Close dialog".

**Modal body:**
- `children` content. Padding top: `var(--space-4)`. `var(--font-size-md)`
  `var(--color-text-primary)` `var(--line-height-normal)`.

**Modal footer:**
- Horizontal flex row, right-aligned. Gap: `var(--space-3)`.
- Cancel button: secondary Button variant, label "Cancel".
- Confirm button (if `onConfirm` is provided): variant from `confirmVariant` prop.

### Interaction States

| State | Description |
|---|---|
| Open | Modal and backdrop visible. Focus trapped inside. |
| Confirm loading | Confirm button enters loading state (aria-busy). All modal inputs disabled. |
| Closed | Modal unmounted from DOM. Focus returns to the triggering element. |

### Accessibility

- Container: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to
  the title element's `id`.
- On open: focus moves to the first focusable element within the modal (or the modal
  container itself if no focusable child). See accessibility_spec.md §Focus Management.
- Focus trap: Tab and Shift+Tab cycle only through focusable elements within the modal.
- Escape key: triggers `onClose`.
- On close: focus returns to the element that triggered the modal open.
- Backdrop click: triggers `onClose`.

---

---

## 13. DragHandle

**REQ-IDs:** REQ-093

### Purpose

A visual grip indicator attached to TargetSchoolRow indicating that the row is
draggable. Includes keyboard-accessible Up and Down buttons as a fallback for users
who cannot use drag-and-drop.

### Pages

Target Schools (within TargetSchoolRow).

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| onMoveUp | function | required | Callback for keyboard up action |
| onMoveDown | function | required | Callback for keyboard down action |
| isFirst | boolean | optional | When true, the Up button is disabled (already at top). Defaults to false. |
| isLast | boolean | optional | When true, the Down button is disabled (already at bottom). Defaults to false. |
| itemLabel | string | required | Name of the item being moved, used in aria-labels. |

### Visual Structure

**Grip icon:**
- Three horizontal lines (≡) or six dots (⠿) character, centred in a small touch
  target.
- Colour: `var(--color-text-secondary)`. Font size: `var(--font-size-lg)`.
- Cursor: grab (changes to grabbing during active drag).
- `aria-hidden="true"` — decorative; the keyboard buttons are the accessible interface.

**Keyboard fallback buttons:**
- Two small icon buttons stacked vertically beside the grip icon:
  - Up button: "↑" character. `var(--font-size-sm)`.
    aria-label: "Move [itemLabel] up in preference order".
    Disabled when `isFirst` is true.
  - Down button: "↓" character. `var(--font-size-sm)`.
    aria-label: "Move [itemLabel] down in preference order".
    Disabled when `isLast` is true.
- Button colour: `var(--color-text-secondary)`. Disabled state: opacity 0.4,
  cursor not-allowed.
- Focus state: 2px solid `var(--color-primary)` outline, offset 2px.

**Combined layout:** grip icon (left) + up/down buttons (right of grip), all
contained in a compact column of `var(--space-4)` total width.

### Interaction States

| State | Description |
|---|---|
| Default | Grip icon visible; up/down buttons visible |
| Drag active | Cursor changes to grabbing on the grip icon. Row elevation increases (handled by TargetSchoolRow). |
| Up/Down button hover | `var(--color-text-primary)` colour. |
| Up/Down button focus | 2px solid `var(--color-primary)` outline. |
| Up/Down button disabled | Opacity 0.4, cursor not-allowed, aria-disabled="true". |
| After move | Toast "Preference order saved." shown after POST /api/v1/students/{id}/targets/reorder. |

### Accessibility

- The grip icon element: `aria-hidden="true"`, `role="presentation"`.
- Up and Down buttons: `role="button"`. aria-labels as described above.
- When `isFirst` is true: Up button has `aria-disabled="true"` and does not respond
  to Enter/Space.
- When `isLast` is true: Down button has `aria-disabled="true"`.
- Screen reader announcement on move: `aria-live="polite"` region on the Target
  Schools page announces "[School name] moved to rank [N]." after each move action.
