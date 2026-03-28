# Accessibility Specification — WCAG AA
# Intelligent Academic Advisor v2
# REQ-051

## Overview
All UI components must meet WCAG 2.1 Level AA. This document defines the
binding accessibility requirements for the frontend engineer.

---

## Colour Contrast
- Normal text (< 18pt): minimum contrast ratio 4.5:1 against background
- Large text (≥ 18pt or 14pt bold): minimum 3:1
- Token pairs that meet AA:
  - var(--color-text-primary) on var(--color-background): must pass
  - var(--color-text-secondary) on var(--color-surface): must pass
  - var(--color-primary) (button bg) with white text: must pass
  - var(--color-error) with white text: must pass
- EligibilityBadge: red INELIGIBLE must use white text (not dark), verified at design time

---

## Focus Management

### Modals
- On open: move focus to first focusable element inside modal
- On close: return focus to the element that triggered the modal
- Focus must not escape the modal while open (focus trap)
- Escape key always closes the modal

### Tab Navigation (Tabs component)
- Tab bar: arrow keys move between tabs (left/right); Tab/Shift-Tab moves into/out of tab panel
- Active tab: aria-selected="true"; inactive: aria-selected="false"
- Tab panel: role="tabpanel", aria-labelledby={tab-id}
- Tab button: role="tab"

### Page Transitions
- On route change: move focus to main heading (h1) of new page
- Use a visually hidden "skip to main content" link as first focusable element on every page

---

## Keyboard Navigation Map

| Key | Context | Action |
|-----|---------|--------|
| Tab | Global | Move to next focusable element |
| Shift+Tab | Global | Move to previous focusable element |
| Enter / Space | Buttons, links | Activate |
| Escape | Modal, dropdown | Close/dismiss |
| Arrow Left/Right | Tabs | Switch tab |
| Arrow Up/Down | TargetSchoolRow list | Move keyboard focus between rows |
| Arrow Up/Down | DragHandle keyboard mode | Reorder row up/down |
| Enter | DragHandle keyboard mode | Confirm new position |

---

## ARIA Patterns

### Tabs
```
role="tablist" aria-label="Student profile sections"
  role="tab" aria-selected aria-controls={panelId} id={tabId}
role="tabpanel" aria-labelledby={tabId} tabIndex={0}
```

### Drag-and-drop (TargetSchoolRow)
- Drag handle button: aria-label="Drag to reorder {school name}. Use Up/Down buttons to reorder with keyboard."
- Up/Down buttons: aria-label="Move {school name} up" / "Move {school name} down"
- List: aria-label="Target school preference list" role="list"
- After reorder: announce via aria-live="polite": "{school name} moved to position {n}"

### Star Rating (StarRating)
- role="radiogroup" aria-label="Rating for {subject}"
- Each star: role="radio" aria-label="{n} star{s}" aria-checked={value === n}
- Keyboard: arrow keys change value within group

### Live Regions
- Toast notifications: role="status" aria-live="polite" aria-atomic="true"
- Error messages: role="alert" aria-live="assertive"
- Polling status ("Generating plan…"): role="status" aria-live="polite"
- Form validation errors: aria-describedby linking input to error paragraph

### Form Validation
- Validation fires on form submit (not on blur, except email format)
- Error paragraph id linked from input via aria-describedby
- On error: focus moves to first invalid input
- aria-invalid="true" on invalid inputs

### FileUpload
- Drop zone: role="button" tabIndex={0} aria-label="Upload transcript. Drag file here or press Enter to browse."
- Progress: role="progressbar" aria-valuenow aria-valuemin="0" aria-valuemax="100"

---

## Screen Reader Labels

| Element | aria-label |
|---------|-----------|
| NavBar logout button | "Log out" |
| EligibilityBadge INELIGIBLE | "Ineligible: {failingCriteria}" |
| PredictedGradeBadge | "Predicted grade: {grade}" |
| SchoolCard "Add to Target" | "Add {school name} to target list" |
| StatusChip | "Application status: {status}" |
| DragHandle | "Reorder {school name}" |
| Modal close button | "Close {title} dialog" |

---

## Mobile (REQ-052)
- Minimum tested viewport: 375px width
- All tap targets minimum 44×44px
- No horizontal scroll on any page at 375px
- Tabs component: scrollable horizontally if tabs overflow; no wrapping
- GradeTable: horizontally scrollable container with sticky first column (Subject name)
- School Directory filter bar: stacks vertically on mobile
