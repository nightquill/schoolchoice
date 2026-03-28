# Component Specifications
# Intelligent Academic Advisor — MVP
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE

---

## Purpose

This document specifies every reusable UI component in the application. Specifications include purpose, props, visual structure, interaction states, and accessibility requirements. All values reference tokens defined in design_tokens.md.

No code appears in this document. These specs are reviewed and approved by the PM before implementation begins.

---

## Component Index

1. Button
2. TextInput
3. FormCard
4. StudentRow
5. StudentForm
6. SchoolCard (informational reference)
7. RecommendationCard
8. ActionPlanDisplay
9. NavBar
10. LoadingSpinner
11. ErrorMessage
12. EmptyState

---

---

## 1. Button

**REQ-IDs:** REQ-031, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036

### Purpose

A clickable element that triggers an action. Used on every page. Comes in three variants: primary (main action), secondary (supporting action), and danger (destructive action, e.g. delete).

### Pages

Login, Student List, Student Detail, Recommendation

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| label | string | required | The visible text of the button |
| variant | string ("primary", "secondary", "danger") | required | Controls color scheme |
| disabled | boolean | optional | Prevents interaction when true; defaults to false |
| loading | boolean | optional | Shows a loading indicator inside the button; defaults to false |
| fullWidth | boolean | optional | Makes button span the full width of its container; defaults to false |
| onClick | function | required | Callback invoked on click |

### Visual Structure

**Primary variant (default state):**
- Background: `var(--color-primary)`
- Text color: `var(--color-surface)` (white)
- Font size: `var(--font-size-md)`
- Font weight: `var(--font-weight-medium)`
- Padding: `var(--space-3)` vertical, `var(--space-5)` horizontal
- Border radius: `var(--border-radius-md)`
- Border: none

**Secondary variant (default state):**
- Background: `var(--color-surface)`
- Text color: `var(--color-text-primary)`
- Border: `var(--border-width)` solid `var(--color-border)`
- All other values same as primary

**Danger variant (default state):**
- Background: `var(--color-error)`
- Text color: `var(--color-surface)`
- All other values same as primary

### Interaction States

| State | Description |
|---|---|
| Default | As described above |
| Hover | Primary: background darkens slightly (use a 10% darker shade of `var(--color-primary)`). Secondary: background changes to `var(--color-background)`. Danger: background darkens slightly. No animation — immediate color change. |
| Focus | Outline: 2px solid `var(--color-primary)`, offset 2px. Applies to all variants. |
| Active (pressed) | Background darkens further, same approach as hover but more pronounced. No animation. |
| Disabled | Opacity 0.5 on all variants. Cursor: not-allowed. No hover/active states respond. |
| Loading | The label is replaced by a small inline LoadingSpinner (see component 10). Button remains the same size. Button is implicitly disabled while loading to prevent double-submission. |

### Accessibility

- Role: `button`
- When disabled: `aria-disabled="true"`
- When loading: `aria-busy="true"` and `aria-label` should include the word "loading" (e.g. "Log In, loading")
- Keyboard: activates on Enter and Space
- Focus is visible per the focus state described above

---

---

## 2. TextInput

**REQ-IDs:** REQ-031, REQ-033, REQ-036

### Purpose

A labeled text input field used in forms. Displays a visible label above the input, an optional helper text below, and an error message when validation fails.

### Pages

Login (email, password), Student Detail (within StudentForm)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| label | string | required | Visible label text displayed above the input |
| name | string | required | The field identifier used for form submission |
| type | string ("text", "email", "password", "number") | optional | Input type; defaults to "text" |
| value | string | required | Current value (controlled input) |
| placeholder | string | optional | Placeholder text; shown when value is empty |
| helperText | string | optional | Supplemental guidance shown below the input |
| errorText | string | optional | Error message; when present, triggers the error visual state |
| disabled | boolean | optional | Disables the input; defaults to false |
| onChange | function | required | Callback invoked on every value change |
| onBlur | function | optional | Callback invoked when the input loses focus |

### Visual Structure

- Label: displayed above the input. Font size: `var(--font-size-sm)`. Font weight: `var(--font-weight-medium)`. Color: `var(--color-text-primary)`. Margin bottom: `var(--space-1)`.
- Input field: width 100% of its container. Background: `var(--color-surface)`. Border: `var(--border-width)` solid `var(--color-border)`. Border radius: `var(--border-radius-sm)`. Padding: `var(--space-3)` vertical, `var(--space-4)` horizontal. Font size: `var(--font-size-md)`. Color: `var(--color-text-primary)`.
- Helper text (when present): Font size: `var(--font-size-xs)`. Color: `var(--color-text-secondary)`. Margin top: `var(--space-1)`.
- Error text (when present): Font size: `var(--font-size-xs)`. Color: `var(--color-error)`. Margin top: `var(--space-1)`.

### Interaction States

| State | Description |
|---|---|
| Default | Border: `var(--color-border)` |
| Focus | Border color: `var(--color-primary)`. Shadow: `var(--shadow-sm)`. No animation. |
| Error | Border color: `var(--color-error)`. Error text is displayed below the input. |
| Disabled | Background: `var(--color-background)`. Opacity 0.6. Cursor: not-allowed. |

### Accessibility

- The `<label>` element is associated with the `<input>` via matching `for` / `id` attributes.
- When in error state: `aria-invalid="true"` and `aria-describedby` pointing to the error text element.
- When helper text is present: `aria-describedby` pointing to the helper text element.
- Keyboard: standard tab order. No custom keyboard behavior.

---

---

## 3. FormCard

**REQ-IDs:** REQ-031, REQ-033, REQ-036

### Purpose

A centered surface container that wraps form content. Used on the Login page to create a visually bounded card in the center of the viewport. Also used to wrap the StudentForm when it appears as an inline edit area.

### Pages

Login, Student Detail (edit mode)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| title | string | optional | Heading text rendered at the top of the card |
| children | components | required | Form content placed inside the card |
| maxWidth | number (px) | optional | Maximum width of the card; defaults to 400px for login, 100% of container for edit mode |

### Visual Structure

- Background: `var(--color-surface)`
- Border: `var(--border-width)` solid `var(--color-border)`
- Border radius: `var(--border-radius-lg)`
- Shadow: `var(--shadow-md)`
- Padding: `var(--space-6)` on all sides
- Title (when present): Font size: `var(--font-size-xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`. Margin bottom: `var(--space-6)`.
- On Login page: horizontally and vertically centered within the viewport using flexbox centering on the parent container.

### Interaction States

The FormCard itself is not interactive. Its children handle all interaction states.

### Accessibility

- Role: `region`
- `aria-label` matches the `title` prop when provided (e.g. "Log In", "Edit Student")

---

---

## 4. StudentRow

**REQ-IDs:** REQ-032, REQ-036

### Purpose

A table row representing one student in the Student List table. The entire row is a clickable navigation target that routes to the Student Detail page for that student.

### Pages

Student List

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| id | string (UUID) | required | Student ID used for navigation |
| name | string | required | Student's full name |
| targetRegion | string | required | "local" or "international" |
| createdAt | string (ISO 8601) | required | Profile creation date |
| onClick | function | required | Callback invoked when the row is clicked; receives the student id |

### Visual Structure

- Background: `var(--color-surface)`
- Border bottom: `var(--border-width)` solid `var(--color-border)` (between rows)
- Padding: `var(--space-3)` vertical, `var(--space-4)` horizontal per cell
- Name cell: Font size: `var(--font-size-md)`. Color: `var(--color-text-primary)`. Font weight: `var(--font-weight-normal)`.
- Region cell: Displays "Local" or "International". Font size: `var(--font-size-sm)`. Color: `var(--color-text-secondary)`.
- Created cell: Displays date portion only (YYYY-MM-DD). Font size: `var(--font-size-sm)`. Color: `var(--color-text-secondary)`.
- Chevron cell: Displays ">" character. Color: `var(--color-text-secondary)`. Font size: `var(--font-size-sm)`.
- Cursor: pointer on the entire row.

### Interaction States

| State | Description |
|---|---|
| Default | Background: `var(--color-surface)` |
| Hover | Background: `var(--color-background)`. Shadow: `var(--shadow-sm)`. No animation. |
| Focus | Outline: 2px solid `var(--color-primary)` on the row. |
| Active | Background slightly darker than hover state. |

### Accessibility

- Role: `row`
- The row must be keyboard-focusable (tabIndex="0")
- `aria-label`: "View student [name]"
- Activates on Enter key press as well as click
- Screen readers announce the full row content when focused

---

---

## 5. StudentForm

**REQ-IDs:** REQ-033, REQ-035, REQ-036

### Purpose

A form containing all editable student profile fields. Used within the Student Detail page when entering edit mode, and within the Student List page's inline "Add Student" creation flow.

### Pages

Student List (create mode), Student Detail (edit mode)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| initialValues | object | optional | Pre-populated field values for edit mode; all fields empty in create mode |
| onSubmit | function | required | Callback invoked with the form data object when the form is saved |
| onCancel | function | required | Callback invoked when the counselor cancels without saving |
| submitLabel | string | optional | Label for the submit button; defaults to "Save" |
| loading | boolean | optional | Passes loading state to the submit Button |
| errorText | string | optional | Top-level API error message displayed above the submit button |

### Visual Structure

The form is a vertical stack of field groups with `var(--space-4)` gap between each group.

**Field: Name**
- Component: TextInput
- Label: "Student Name"
- Type: text
- Required

**Field: Grades**
- Multiple TextInput rows, one per subject.
- A row contains: subject name input + grade input side by side.
- An "Add Subject" button (secondary variant) below the rows allows adding more grade entries.
- Each row has a remove button ("×", plain text) to the right.
- Label above the entire group: "Grades". Font weight: `var(--font-weight-medium)`. Font size: `var(--font-size-sm)`.

**Field: Interests**
- A TextInput with label "Interests".
- Helper text: "Separate interests with commas (e.g. robotics, music)".
- Value is stored and submitted as a comma-separated string; the implementation layer converts to/from array.

**Field: Strengths and Weaknesses**
- A multi-line text area (TextInput with type="textarea").
- Label: "Strengths and Weaknesses".
- Minimum height: 3 rows of text.

**Field: Target Region**
- A two-option selector displayed as two plain-text radio buttons or toggle buttons (secondary Button variant, one for "Local", one for "International").
- Selected option: primary Button variant.
- Unselected option: secondary Button variant.
- Label above: "Target Region".

**Form footer:**
- Submit Button (primary variant, label from submitLabel prop).
- Cancel Button (secondary variant, label "Cancel").
- Gap between buttons: `var(--space-3)`.
- Displayed side by side.

### Interaction States

| State | Description |
|---|---|
| Default | All fields in default TextInput state |
| Validation error | Triggered on submit attempt. Individual field errors shown via TextInput errorText prop. Top-level API errors shown via a single ErrorMessage component above the footer buttons. |
| Loading (submitting) | Submit button enters loading state. All inputs are disabled. |
| Success | Not handled within the form itself; the parent page handles post-save state. |

### Accessibility

- All inputs have visible labels.
- `aria-required="true"` on required fields.
- Error summary: when multiple validation errors exist, an `aria-live` region announces the count of errors on submit.

---

---

## 6. SchoolCard

**REQ-IDs:** REQ-037

### Purpose

A plain display card showing a school's basic information. Defined here as a base component that RecommendationCard builds upon. SchoolCard alone is not independently surfaced in MVP pages; it is referenced only within RecommendationCard.

### Pages

Recommendation (indirectly, via RecommendationCard)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| schoolName | string | required | The school's display name |
| score | number (0.0–1.0) | required | Computed match score |

### Visual Structure

- School name: Font size: `var(--font-size-lg)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`.
- Score: displayed as a percentage rounded to nearest integer (e.g. "Score: 92%") or as the raw float with two decimal places (e.g. "Score: 0.92") — either is acceptable; implementer chooses. Font size: `var(--font-size-sm)`. Font weight: `var(--font-weight-medium)`. Color: `var(--color-text-secondary)`.
- The school name and score are displayed on the same line, name on the left, score on the right.

### Interaction States

SchoolCard is purely informational. No interactive states.

### Accessibility

- Role: `region`
- `aria-label`: "School: [schoolName]"

---

---

## 7. RecommendationCard

**REQ-IDs:** REQ-034, REQ-037, REQ-036

### Purpose

A card displaying a single school recommendation with school name, match score, explanation of why the school matches the student, and gaps (what the student is missing). Appears up to five times on the Recommendation page, ordered by score descending.

### Pages

Recommendation

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| schoolName | string | required | The school's display name (from `school_name` API field) |
| score | number (0.0–1.0) | required | Match score (from `score` API field) |
| explanation | string | required | Plain-text explanation of match factors (from `explanation` API field) |
| gaps | string | required | Plain-text description of student gaps (from `gaps` API field) |
| rank | number | optional | Display rank (1–5); shown as a small rank indicator if provided |

### Visual Structure

- Container: Background `var(--color-surface)`. Border: `var(--border-width)` solid `var(--color-border)`. Border radius: `var(--border-radius-md)`. Padding: `var(--space-6)`. Shadow: `var(--shadow-sm)`.
- Header row: Contains school name (left) and score (right), as described in SchoolCard above. If rank is provided, display it as a plain number prefix to the school name: "1. [School Name]".
- Divider: A horizontal rule using `var(--color-border)` between the header and body content.
- Body: Two labeled sections displayed vertically with `var(--space-4)` gap between them.

**Explanation section:**
- Label: "Why it matches". Font size: `var(--font-size-sm)`. Font weight: `var(--font-weight-medium)`. Color: `var(--color-text-secondary)`. Margin bottom: `var(--space-1)`.
- Content: `explanation` string. Font size: `var(--font-size-md)`. Color: `var(--color-text-primary)`. Line height: `var(--line-height-normal)`.

**Gaps section:**
- Label: "Gaps". Font size: `var(--font-size-sm)`. Font weight: `var(--font-weight-medium)`. Color: `var(--color-text-secondary)`. Margin bottom: `var(--space-1)`.
- Content: `gaps` string. Font size: `var(--font-size-md)`. Color: `var(--color-text-primary)`. Line height: `var(--line-height-normal)`.

### Interaction States

RecommendationCard is purely informational. No interactive states. The content is presented as decision-support output for the counselor (REQ-002, preferences.md §1).

### Accessibility

- Role: `article`
- `aria-label`: "[rank if present]. [schoolName], score [score]"
- All text content is readable by screen readers in natural reading order (name, score, explanation, gaps).

---

---

## 8. ActionPlanDisplay

**REQ-IDs:** REQ-034, REQ-038, REQ-036

### Purpose

Displays the three sections of a generated action plan: academic targets, extracurricular direction, and preparation steps. Appears on the Recommendation page and conditionally on the Student Detail page.

### Pages

Student Detail (conditional), Recommendation

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| academicTargets | string | required | Plain-text academic targets (from `academic_targets` API field) |
| extracurricularDirection | string | required | Plain-text extracurricular guidance (from `extracurricular_direction` API field) |
| preparationSteps | string | required | Plain-text preparation guidance (from `preparation_steps` API field) |

### Visual Structure

- Container: Background `var(--color-surface)`. Border: `var(--border-width)` solid `var(--color-border)`. Border radius: `var(--border-radius-md)`. Padding: `var(--space-6)`.
- Three labeled sections displayed vertically, each with `var(--space-6)` gap between them.

**Each section:**
- Label: Font size: `var(--font-size-sm)`. Font weight: `var(--font-weight-medium)`. Color: `var(--color-text-secondary)`. Text transform: uppercase (to visually distinguish it as a label, without adding visual complexity). Margin bottom: `var(--space-2)`.
- Content: Font size: `var(--font-size-md)`. Color: `var(--color-text-primary)`. Line height: `var(--line-height-normal)`.

Section labels:
1. "Academic Targets"
2. "Extracurricular Direction"
3. "Preparation Steps"

### Interaction States

ActionPlanDisplay is purely informational. No interactive states.

### Accessibility

- Role: `region`
- `aria-label`: "Action Plan"
- Each sub-section uses a heading element at an appropriate level in the document hierarchy (one level below the page section heading).

---

---

## 9. NavBar

**REQ-IDs:** REQ-032, REQ-033, REQ-034, REQ-036

### Purpose

The top navigation bar present on all authenticated pages. Displays the application name and a logout link. No secondary navigation links are needed in MVP.

### Pages

Student List, Student Detail, Recommendation

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| onLogout | function | required | Callback invoked when the Logout link is clicked |
| counselorEmail | string | optional | If provided, displays the logged-in counselor's email in the nav for context |

### Visual Structure

- Height: fixed, sufficient to contain one line of text with `var(--space-3)` vertical padding.
- Background: `var(--color-surface)`.
- Shadow: `var(--shadow-md)`.
- Border bottom: `var(--border-width)` solid `var(--color-border)`.
- Layout: flex row, space-between. Left: application name. Right: counselor email (if provided, in `var(--color-text-secondary)`, `var(--font-size-sm)`) and "Logout" link.
- Application name: "Academic Advisor". Font size: `var(--font-size-lg)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`.
- Logout link: Font size: `var(--font-size-sm)`. Color: `var(--color-primary)`. No underline by default; underline on hover.
- Horizontal padding of the NavBar inner content: `var(--space-6)` on each side.

### Interaction States

| State | Description |
|---|---|
| Default | As described above |
| Logout link hover | Underline appears. Color remains `var(--color-primary)`. |
| Logout link focus | Outline: 2px solid `var(--color-primary)`, offset 2px. |

### Accessibility

- Role: `navigation`
- `aria-label`: "Main navigation"
- The logout element uses role: `button` or is an anchor element with a descriptive `aria-label`: "Log out"
- Keyboard: the logout link is reachable via Tab

---

---

## 10. LoadingSpinner

**REQ-IDs:** REQ-031, REQ-032, REQ-033, REQ-034, REQ-036, REQ-039

### Purpose

A simple, non-animated loading indicator (per REQ-039, no animations). Displayed while async operations are in flight.

### Pages

All four pages (inline within buttons, and as zone-level placeholder)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| size | string ("sm", "md", "lg") | optional | Controls the visual size. sm: used inside buttons. md: used within a content zone. lg: used for full-page loads. Defaults to "md". |
| label | string | optional | Accessible text label; defaults to "Loading…" |
| inline | boolean | optional | When true, the spinner renders inline within text (e.g. inside a button). When false, it is block-level and centered in its container. Defaults to false. |

### Visual Structure

Per REQ-039, no CSS animation (no spinning). The LoadingSpinner is rendered as a static text indicator to comply with the no-animation constraint.

- Content: The text "Loading…" (or the `label` prop value).
- Font size: matches container context (inherits or follows size prop).
  - sm: `var(--font-size-xs)`
  - md: `var(--font-size-md)`
  - lg: `var(--font-size-lg)`
- Color: `var(--color-text-secondary)`.
- When block-level (inline=false): centered horizontally within its container. Padding: `var(--space-6)` top and bottom.

### Interaction States

No interactive states.

### Accessibility

- Role: `status`
- `aria-live`: "polite"
- `aria-label` uses the `label` prop value

---

---

## 11. ErrorMessage

**REQ-IDs:** REQ-031, REQ-032, REQ-033, REQ-034, REQ-036

### Purpose

Displays an error message to the user. Used for API errors (network failures, server errors), form-level validation errors, and inline field errors.

### Pages

All four pages

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| message | string | required | The error text to display |
| context | string ("inline", "banner") | optional | "inline" is used within a form field or content zone; "banner" spans the full width of a content area. Defaults to "inline". |

### Visual Structure

**Inline:**
- Font size: `var(--font-size-xs)`.
- Color: `var(--color-error)`.
- No background or border. Displayed immediately below the relevant element.
- Margin top: `var(--space-1)`.

**Banner:**
- Background: a very light tint of `var(--color-error)` (10% opacity).
- Border: `var(--border-width)` solid `var(--color-error)`.
- Border radius: `var(--border-radius-sm)`.
- Padding: `var(--space-3)` vertical, `var(--space-4)` horizontal.
- Font size: `var(--font-size-sm)`.
- Color: `var(--color-error)`.
- Margin bottom: `var(--space-4)` (placed above the relevant form or content zone).

### Interaction States

No interactive states. ErrorMessage is purely informational.

### Accessibility

- Role: `alert`
- `aria-live`: "assertive" (error messages are time-sensitive; screen readers announce them immediately)

---

---

## 12. EmptyState

**REQ-IDs:** REQ-032, REQ-034, REQ-036

### Purpose

Displayed when a list or data zone has no content to show. Provides a brief explanation and optionally a call-to-action.

### Pages

Student List (no students), Recommendation (no recommendations, no action plan)

### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| message | string | required | Explanation of why the area is empty and what the counselor can do |
| actionLabel | string | optional | Label for an optional action button |
| onAction | function | optional | Callback for the optional action button |

### Visual Structure

- Container: centered within its parent zone. Padding: `var(--space-8)` top and bottom.
- Message: Font size: `var(--font-size-md)`. Color: `var(--color-text-secondary)`. Line height: `var(--line-height-normal)`. Text-align: center.
- Action button (when actionLabel and onAction are provided): secondary Button variant, displayed below the message with `var(--space-4)` margin top. Centered.

### Interaction States

The EmptyState container itself has no interactive states. The action button (if present) uses Button component states.

### Accessibility

- Role: `region`
- `aria-label`: "Empty state: [message]" (truncated for long messages)
- The action button (if present) has a descriptive `aria-label`
