# Design Tokens
# Intelligent Academic Advisor — MVP
# Document Owner: UI Designer
# Date: 2026-03-27
# Status: BASELINE

---

## Purpose

This file is the single source of truth for all visual values used across the application. No raw values (hex codes, pixel counts, font names, etc.) may appear in any other design file. All other design documents must reference tokens by name using the CSS custom property syntax shown below.

These tokens satisfy REQ-036 (clear layout, minimal styling) and REQ-039 (no visual complexity). Every token is chosen to support functional clarity for counselor users (see preferences.md §2).

---

## Color Tokens

| Token | CSS Custom Property | Value | Usage |
|---|---|---|---|
| Primary | `var(--color-primary)` | `#2563EB` | Primary buttons, active links, focus rings |
| Secondary | `var(--color-secondary)` | `#64748B` | Secondary buttons, muted labels, metadata text |
| Background | `var(--color-background)` | `#F8FAFC` | Page background |
| Surface | `var(--color-surface)` | `#FFFFFF` | Cards, modals, form containers, table rows |
| Text Primary | `var(--color-text-primary)` | `#0F172A` | Body text, headings, field values |
| Text Secondary | `var(--color-text-secondary)` | `#475569` | Helper text, subtitles, placeholder text |
| Error | `var(--color-error)` | `#DC2626` | Validation messages, error banners, destructive button backgrounds |
| Success | `var(--color-success)` | `#16A34A` | Save confirmations, success banners |
| Warning | `var(--color-warning)` | `#D97706` | Non-blocking warnings (e.g. stale recommendations notice) |
| Border | `var(--color-border)` | `#CBD5E1` | Input borders, table dividers, card outlines |

### Color Definition Block

```
:root {
  --color-primary:        #2563EB;
  --color-secondary:      #64748B;
  --color-background:     #F8FAFC;
  --color-surface:        #FFFFFF;
  --color-text-primary:   #0F172A;
  --color-text-secondary: #475569;
  --color-error:          #DC2626;
  --color-success:        #16A34A;
  --color-warning:        #D97706;
  --color-border:         #CBD5E1;
}
```

---

## Typography Tokens

| Token | CSS Custom Property | Value | Usage |
|---|---|---|---|
| Base Font Family | `var(--font-family-base)` | `system-ui, -apple-system, sans-serif` | All text in the application |
| Size XS | `var(--font-size-xs)` | `0.75rem` (12px) | Timestamps, metadata labels |
| Size SM | `var(--font-size-sm)` | `0.875rem` (14px) | Helper text, table cell secondary info |
| Size MD | `var(--font-size-md)` | `1rem` (16px) | Body text, input values, button labels |
| Size LG | `var(--font-size-lg)` | `1.125rem` (18px) | Section headings, card titles |
| Size XL | `var(--font-size-xl)` | `1.25rem` (20px) | Page sub-headings |
| Size 2XL | `var(--font-size-2xl)` | `1.5rem` (24px) | Page headings |
| Weight Normal | `var(--font-weight-normal)` | `400` | Body text, field values |
| Weight Medium | `var(--font-weight-medium)` | `500` | Labels, button text, table headers |
| Weight Bold | `var(--font-weight-bold)` | `700` | Page headings, score values, emphasis |
| Line Height Tight | `var(--line-height-tight)` | `1.25` | Headings, compact UI elements |
| Line Height Normal | `var(--line-height-normal)` | `1.5` | Body text, multi-line paragraphs |

### Typography Definition Block

```
:root {
  --font-family-base:     system-ui, -apple-system, sans-serif;
  --font-size-xs:         0.75rem;
  --font-size-sm:         0.875rem;
  --font-size-md:         1rem;
  --font-size-lg:         1.125rem;
  --font-size-xl:         1.25rem;
  --font-size-2xl:        1.5rem;
  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-bold:     700;
  --line-height-tight:    1.25;
  --line-height-normal:   1.5;
}
```

---

## Spacing Tokens

Spacing follows a 4px base grid. All layout gaps, padding, and margin values must use these tokens.

| Token | CSS Custom Property | Value | Usage |
|---|---|---|---|
| Space 1 | `var(--space-1)` | `4px` | Tight gaps between inline elements (e.g. icon + label) |
| Space 2 | `var(--space-2)` | `8px` | Inner padding for compact components (chips, badges) |
| Space 3 | `var(--space-3)` | `12px` | Input internal padding (vertical) |
| Space 4 | `var(--space-4)` | `16px` | Standard component padding, form field gaps |
| Space 5 | `var(--space-5)` | `20px` | Card internal padding (horizontal) |
| Space 6 | `var(--space-6)` | `24px` | Section gaps within a page, card padding |
| Space 8 | `var(--space-8)` | `32px` | Between major page sections |
| Space 10 | `var(--space-10)` | `40px` | Page-level vertical padding |
| Space 12 | `var(--space-12)` | `48px` | Page top margin, hero areas |

### Spacing Definition Block

```
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

---

## Border Tokens

| Token | CSS Custom Property | Value | Usage |
|---|---|---|---|
| Border Radius SM | `var(--border-radius-sm)` | `4px` | Input fields, small buttons |
| Border Radius MD | `var(--border-radius-md)` | `6px` | Cards, standard buttons, dropdowns |
| Border Radius LG | `var(--border-radius-lg)` | `8px` | FormCard container, modals |
| Border Width | `var(--border-width)` | `1px` | All bordered elements |

### Border Definition Block

```
:root {
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 8px;
  --border-width:     1px;
}
```

---

## Shadow Tokens

Shadows are intentionally minimal, consistent with REQ-036 and REQ-039.

| Token | CSS Custom Property | Value | Usage |
|---|---|---|---|
| Shadow SM | `var(--shadow-sm)` | `0 1px 2px rgba(0,0,0,0.06)` | Inputs on focus, table rows on hover |
| Shadow MD | `var(--shadow-md)` | `0 2px 8px rgba(0,0,0,0.10)` | Cards, FormCard container, NavBar |

### Shadow Definition Block

```
:root {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.10);
}
```

---

## Breakpoint Tokens

The application is web-only (preferences.md §7). Breakpoints are defined for reference but the primary target is desktop/laptop browser widths. No mobile-specific layouts are required for MVP.

| Token | CSS Custom Property | Value | Meaning |
|---|---|---|---|
| Breakpoint SM | `var(--breakpoint-sm)` | `640px` | Minimum workable viewport |
| Breakpoint MD | `var(--breakpoint-md)` | `768px` | Standard tablet / small laptop |
| Breakpoint LG | `var(--breakpoint-lg)` | `1024px` | Standard counselor desktop width |

### Breakpoint Definition Block

```
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}
```

---

## Token Usage Rules

1. No other design document may use a raw value where a token exists.
2. Token references always use the `var(--token-name)` notation.
3. If a new value is needed, a new token must be defined here first.
4. Token names must be updated here before any consuming file references them.
