# Page Layouts
# Intelligent Academic Advisor — MVP
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE

---

## Purpose

This document defines the grid structure, content zones, API field mappings, and header/nav behavior for each of the four required pages. All values reference design tokens defined in design_tokens.md. No raw values appear here.

Governed by: REQ-031, REQ-032, REQ-033, REQ-034, REQ-036, REQ-037, REQ-038, REQ-039.

---

## Global Layout Rules

- All pages use `var(--color-background)` as the page background.
- All pages use `var(--font-family-base)` for all text.
- All page content is bounded by a maximum width of 960px centered horizontally with auto left/right margins, providing comfortable reading width on typical counselor desktops.
- The NavBar is fixed at the top of every authenticated page. It does not scroll with the page content.
- Spacing between the NavBar and the first content zone is `var(--space-8)`.
- Consistent vertical rhythm: sections within a page are separated by `var(--space-8)`.

---

## Page 1: Login Page

**REQ-IDs:** REQ-031, REQ-036, REQ-039

### Grid Structure

Single-column layout. The entire viewport displays only a centered card. There is no NavBar on this page (user is unauthenticated).

```
+--------------------------------------------------+
|                                                  |
|                                                  |
|         +------------------------------+         |
|         |       Application Name       |         |
|         |       (page heading)         |         |
|         |                              |         |
|         |   Email field                |         |
|         |   Password field             |         |
|         |                              |         |
|         |   [Login Button]             |         |
|         |                              |         |
|         |   [Inline error message]     |         |
|         +------------------------------+         |
|                                                  |
|                                                  |
+--------------------------------------------------+
```

### Content Zones

| Zone | Component | Description |
|---|---|---|
| Page background | — | Full viewport, `var(--color-background)` |
| Login card | FormCard | Centered vertically and horizontally. Width: 400px fixed. Padding: `var(--space-6)` on all sides. Background: `var(--color-surface)`. Shadow: `var(--shadow-md)`. Border radius: `var(--border-radius-lg)`. |
| Application heading | — | Text: "Academic Advisor". Font size: `var(--font-size-2xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`. Margin bottom: `var(--space-6)`. |
| Email input | TextInput | Label: "Email". Type: email. Placeholder: none. |
| Password input | TextInput | Label: "Password". Type: password. Placeholder: none. |
| Submit button | Button (primary variant) | Label: "Log In". Full width of the card. Margin top: `var(--space-4)`. |
| Error message | ErrorMessage | Appears below the submit button only when the API returns 401 or 422. Text: "Invalid email or password." for 401; "Please check your input." for 422. |

### API Fields

| API Field Used | Where Displayed |
|---|---|
| `email` (request) | Email TextInput value |
| `password` (request) | Password TextInput value |
| `access_token` (response) | Stored in session; not displayed |
| `expires_in` (response) | Not displayed; used internally |

### Header/Nav Behavior

No NavBar on the Login page. The page heading ("Academic Advisor") serves as the only brand identifier.

---

## Page 2: Student List Page

**REQ-IDs:** REQ-032, REQ-035, REQ-036, REQ-039

### Grid Structure

Full-width single-column layout with a fixed NavBar at top.

```
+--------------------------------------------------+
| NavBar: [Academic Advisor]      [Logout]         |
+--------------------------------------------------+
|                                                  |
|  Page Heading: "Students"    [Add Student]       |
|                                                  |
|  +--------------------------------------------+ |
|  | Name          | Region   | Created    |     | |
|  |---------------|----------|------------|-----| |
|  | Student Row   | local    | 2026-01-10 | [>] | |
|  | Student Row   | intl     | 2026-01-12 | [>] | |
|  | Student Row   | local    | 2026-02-03 | [>] | |
|  +--------------------------------------------+ |
|                                                  |
|  [EmptyState if no students]                     |
|                                                  |
+--------------------------------------------------+
```

### Content Zones

| Zone | Component | Description |
|---|---|---|
| NavBar | NavBar | Spans full width. Fixed top. Contains app name and Logout link. Background: `var(--color-surface)`. Shadow: `var(--shadow-md)`. |
| Page header row | — | Flex row. Left: Page heading "Students" in `var(--font-size-2xl)`, `var(--font-weight-bold)`, `var(--color-text-primary)`. Right: "Add Student" Button (primary variant). Padding bottom: `var(--space-4)`. Border bottom: `var(--border-width)` solid `var(--color-border)`. |
| Student table | — | Full-width table. Background: `var(--color-surface)`. Border: `var(--border-width)` solid `var(--color-border)`. Border radius: `var(--border-radius-md)`. |
| Table header row | — | Background: `var(--color-background)`. Font weight: `var(--font-weight-medium)`. Font size: `var(--font-size-sm)`. Color: `var(--color-text-secondary)`. |
| Student rows | StudentRow | One row per student returned by GET /api/v1/students. Each row is clickable and navigates to the Student Detail page. |
| Empty state | EmptyState | Shown when GET /api/v1/students returns an empty array. Replaces the table body (table header remains visible). |
| Loading state | LoadingSpinner | Shown in the table body area while GET /api/v1/students is in flight. Replaces the table body. |
| Error state | ErrorMessage | Shown in the table body area if GET /api/v1/students returns an error. |

### Student Table Columns

| Column | API Field | Display Format |
|---|---|---|
| Name | `name` | Full name text, `var(--color-text-primary)`, `var(--font-size-md)` |
| Region | `target_region` | Display as "Local" or "International" (capitalized), `var(--color-text-secondary)`, `var(--font-size-sm)` |
| Created | `created_at` | Display date portion only (YYYY-MM-DD), `var(--color-text-secondary)`, `var(--font-size-sm)` |
| Action | — | A right-pointing chevron icon (plain text ">" acceptable per REQ-039) indicating the row is clickable |

### API Fields

| API Field | Source Endpoint | Where Used |
|---|---|---|
| `id` | GET /api/v1/students | Used as the key for routing to Student Detail; not displayed |
| `name` | GET /api/v1/students | Name column |
| `target_region` | GET /api/v1/students | Region column |
| `created_at` | GET /api/v1/students | Created column |

### Header/Nav Behavior

NavBar is present. The "Students" page heading is the active context indicator; no additional nav highlighting is needed in MVP.

---

## Page 3: Student Detail Page

**REQ-IDs:** REQ-033, REQ-035, REQ-036, REQ-039

### Grid Structure

Single-column layout with a fixed NavBar at top. Content is divided into three vertical sections: student info, action buttons, and (conditionally) action plan display.

```
+--------------------------------------------------+
| NavBar: [Academic Advisor]      [Logout]         |
+--------------------------------------------------+
|                                                  |
|  < Back to Students                              |
|  Page Heading: "[Student Name]"                  |
|                                                  |
|  +--------------------------------------------+ |
|  | Student Info Section                       | |
|  |  Name:                  [value]            | |
|  |  Target Region:         [value]            | |
|  |  Grades:                [subject: grade]   | |
|  |  Interests:             [tag] [tag] [tag]  | |
|  |  Strengths / Weaknesses:[text block]       | |
|  +--------------------------------------------+ |
|                                                  |
|  [Edit Student]  [Generate Recommendations]      |
|  [Generate Action Plan]                          |
|                                                  |
|  +--------------------------------------------+ |
|  | Action Plan (if exists)                    | |
|  |  Academic Targets:      [text]             | |
|  |  Extracurricular:       [text]             | |
|  |  Preparation Steps:     [text]             | |
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

### Content Zones

**Zone: Back Navigation**

- A plain text link: "Back to Students".
- Color: `var(--color-primary)`.
- Font size: `var(--font-size-sm)`.
- Navigates to the Student List page.
- Margin bottom: `var(--space-2)`.

**Zone: Page Heading**

- Displays the student's `name` field.
- Font size: `var(--font-size-2xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`.
- Margin bottom: `var(--space-6)`.

**Zone: Student Info Section (View Mode)**

- Background: `var(--color-surface)`.
- Border: `var(--border-width)` solid `var(--color-border)`.
- Border radius: `var(--border-radius-md)`.
- Padding: `var(--space-6)`.
- Displays all student fields as labeled key/value pairs. Labels are `var(--font-weight-medium)`, `var(--color-text-secondary)`, `var(--font-size-sm)`. Values are `var(--font-weight-normal)`, `var(--color-text-primary)`, `var(--font-size-md)`.

| Displayed Label | API Field | Format |
|---|---|---|
| Name | `name` | Plain text |
| Target Region | `target_region` | "Local" or "International" |
| Grades | `grades` | Each key-value pair on its own row: "Math: A", "English: B+" etc. |
| Interests | `interests` | Each string displayed as a plain inline tag (text surrounded by `var(--color-border)` outline, `var(--border-radius-sm)`, `var(--space-2)` padding). |
| Strengths and Weaknesses | `strengths_weaknesses` | Multi-line text block, `var(--line-height-normal)`. |

**Zone: Student Info Section (Edit Mode)**

- Triggered when the counselor clicks "Edit Student".
- The Student Info Section is replaced by the StudentForm component, pre-populated with current field values.
- The action button row is replaced by "Save Changes" (primary Button) and "Cancel" (secondary Button).
- "Save Changes" calls PUT /api/v1/students/{id}.
- "Cancel" discards all edits and returns to view mode. No confirmation dialog required.
- On successful save: the page returns to view mode. A success confirmation message is briefly displayed above the action button row.
- On validation error (422): inline errors appear within the StudentForm. The page remains in edit mode.

**Zone: Action Button Row**

- Displayed below the Student Info Section in view mode only.
- Contains three buttons displayed left to right with `var(--space-3)` gap between them:
  1. "Edit Student" — secondary Button variant
  2. "Generate Recommendations" — primary Button variant (REQ-035)
  3. "Generate Action Plan" — secondary Button variant (REQ-035)

Note on "Generate Action Plan": This button allows generating an action plan independently of navigating to the Recommendation page. It calls POST /api/v1/students/{id}/action-plan and, on success, refreshes the Action Plan Display zone below without navigating away.

**Zone: Action Plan Display (conditional)**

- Shown only when an action plan exists for this student (fetched via GET /api/v1/students/{id}/action-plan on page load; 404 means no plan exists yet, zone is hidden).
- Background: `var(--color-surface)`.
- Border: `var(--border-width)` solid `var(--color-border)`.
- Border radius: `var(--border-radius-md)`.
- Padding: `var(--space-6)`.
- Section heading: "Action Plan". Font size: `var(--font-size-xl)`. Font weight: `var(--font-weight-bold)`. Margin bottom: `var(--space-4)`.

| Sub-section Label | API Field | Format |
|---|---|---|
| Academic Targets | `academic_targets` | Plain text paragraph |
| Extracurricular Direction | `extracurricular_direction` | Plain text paragraph |
| Preparation Steps | `preparation_steps` | Plain text paragraph |

### API Fields

| API Field | Source Endpoint | Where Used |
|---|---|---|
| `id` | GET /api/v1/students/{id} | Used in API calls; not displayed |
| `name` | GET /api/v1/students/{id} | Page heading and Name field |
| `grades` | GET /api/v1/students/{id} | Grades sub-section |
| `interests` | GET /api/v1/students/{id} | Interests tags |
| `strengths_weaknesses` | GET /api/v1/students/{id} | Strengths/Weaknesses text block |
| `target_region` | GET /api/v1/students/{id} | Target Region field |
| `academic_targets` | GET /api/v1/students/{id}/action-plan | Action Plan Display |
| `extracurricular_direction` | GET /api/v1/students/{id}/action-plan | Action Plan Display |
| `preparation_steps` | GET /api/v1/students/{id}/action-plan | Action Plan Display |

### Header/Nav Behavior

NavBar is present. No secondary navigation within the page.

---

## Page 4: Recommendation Page

**REQ-IDs:** REQ-034, REQ-037, REQ-038, REQ-036, REQ-039

### Grid Structure

Single-column layout with a fixed NavBar at top. Content is divided into two primary zones: the school recommendations list, and the action plan section.

```
+--------------------------------------------------+
| NavBar: [Academic Advisor]      [Logout]         |
+--------------------------------------------------+
|                                                  |
|  < Back to [Student Name]                        |
|  Page Heading: "Recommendations for [Name]"      |
|                                                  |
|  Section: School Recommendations                 |
|  +--------------------------------------------+ |
|  | RecommendationCard 1 (highest score)       | |
|  |  School Name  |  Score: 0.92               | |
|  |  Explanation: [text]                       | |
|  |  Gaps:        [text]                       | |
|  +--------------------------------------------+ |
|  +--------------------------------------------+ |
|  | RecommendationCard 2                       | |
|  +--------------------------------------------+ |
|  | ... (up to 5 cards)                        | |
|  +--------------------------------------------+ |
|                                                  |
|  Section: Action Plan                            |
|  +--------------------------------------------+ |
|  | ActionPlanDisplay                          | |
|  |  Academic Targets:      [text]             | |
|  |  Extracurricular:       [text]             | |
|  |  Preparation Steps:     [text]             | |
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

### Content Zones

**Zone: Back Navigation**

- A plain text link: "Back to [Student Name]".
- Color: `var(--color-primary)`. Font size: `var(--font-size-sm)`.
- Navigates back to the Student Detail page for the same student.
- Margin bottom: `var(--space-2)`.

**Zone: Page Heading**

- Text: "Recommendations for [student name]".
- Font size: `var(--font-size-2xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`.
- Margin bottom: `var(--space-8)`.

**Zone: School Recommendations Section**

- Section heading: "School Recommendations". Font size: `var(--font-size-xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`. Margin bottom: `var(--space-4)`.
- Contains up to 5 RecommendationCard components stacked vertically with `var(--space-4)` gap between each.
- If GET /api/v1/students/{id}/recommendations returns an empty array: EmptyState component is shown with message "No recommendations have been generated yet. Return to the student profile and click Generate Recommendations."
- While loading: LoadingSpinner is shown in place of the card list.

**Zone: Action Plan Section**

- Section heading: "Action Plan". Font size: `var(--font-size-xl)`. Font weight: `var(--font-weight-bold)`. Color: `var(--color-text-primary)`. Margin bottom: `var(--space-4)`.
- Margin top: `var(--space-8)` (separating it from the recommendations zone).
- Contains one ActionPlanDisplay component.
- If GET /api/v1/students/{id}/action-plan returns 404: EmptyState is shown with message "No action plan available. Return to the student profile and click Generate Action Plan."
- While loading: LoadingSpinner is shown in place of the ActionPlanDisplay.

### API Fields

**Recommendations zone — from GET /api/v1/students/{id}/recommendations (REQ-037):**

| API Field | Where Displayed |
|---|---|
| `school_name` | RecommendationCard heading |
| `score` | RecommendationCard score display |
| `explanation` | RecommendationCard explanation section |
| `gaps` | RecommendationCard gaps section |
| `id` | Used as list item key; not displayed |
| `school_id` | Not displayed in MVP |
| `student_id` | Not displayed |
| `created_at` | Not displayed in MVP |

**Action Plan zone — from GET /api/v1/students/{id}/action-plan (REQ-038):**

| API Field | Where Displayed |
|---|---|
| `academic_targets` | ActionPlanDisplay, Academic Targets sub-section |
| `extracurricular_direction` | ActionPlanDisplay, Extracurricular Direction sub-section |
| `preparation_steps` | ActionPlanDisplay, Preparation Steps sub-section |
| `id` | Not displayed |
| `student_id` | Not displayed |
| `created_at` | Not displayed in MVP |

### Page Load Behavior

The Recommendation page issues two concurrent GET requests on load:
1. GET /api/v1/students/{id}/recommendations — to populate the school list
2. GET /api/v1/students/{id}/action-plan — to populate the action plan

Each zone shows its own LoadingSpinner independently. If one resolves before the other, it renders immediately without waiting. This ensures the page is responsive even if one call is slower.

### Header/Nav Behavior

NavBar is present. No secondary navigation within the page.

### Informational Framing (REQ-002 / preferences.md §1)

The Recommendation page presents all outputs as informational, not directive. Section headings and labels must not use prescriptive language. Use "School Recommendations" (not "Your Schools"), "Explanation" (not "Why You Should Apply"), "Gaps" (not "Deficiencies"). The system is decision-support; the counselor interprets the output.
