# Skills File — UI Designer
# Intelligent Academic Advisor

---

## Run: v2 Pipeline (2026-03-27)

### Predicted vs Official Grade Visual Distinction
HKDSE students have mock, trial, and official sittings. Predicted grades must
never look like official grades. Pattern: italic text + "~" prefix + grey pill
background (var(--color-background)). Never use colour alone to distinguish —
also use text style (WCAG). Official grades: normal weight, no prefix, no pill.

### Drag-to-Reorder with Keyboard Fallback
Drag-and-drop alone fails WCAG AA. Always pair with explicit Up/Down buttons
visible alongside the drag handle. The drag handle button should announce its
keyboard alternative in its aria-label. After reorder, announce the new position
via an aria-live="polite" region.

### Accessible Tab Pattern
Tab bars use role="tablist" + role="tab" + role="tabpanel". Arrow keys navigate
between tabs (not Tab key — Tab moves into/out of the panel). Always set
aria-selected on each tab. Tab panels need tabIndex={0} to be reachable.

### Async Polling UI Pattern
For generate → poll → render flows (plan generation, transcript parsing):
1. Show non-blocking "Generating..." state — never block the whole page
2. Poll every 2s with GET /status; show elapsed time or spinner
3. On completion: render content + show success toast
4. On error: show ErrorMessage inline, allow retry
5. Announce completion/error via aria-live="polite" for screen readers

### Additive Design File Strategy
Never rewrite v1 design files. Create _v2 variants. Each v2 file should
reference v1 tokens (design_tokens.md) directly — there is one token file.
Component _v2 specs list only new components; reference v1 spec for existing ones.

### HKDSE Domain Knowledge for UI
- Grade display order (high→low): 5**, 5*, 5, 4, 3, 2, 1, U, X
- Sitting types affect display: OFFICIAL = definitive; MOCK/TRIAL = predicted context
- Compulsory subjects (4): always shown first in grade tables
- Best-5 aggregate: calculated from best 5 subjects including compulsory ones
- ApL grades: "Attained" / "Attained with Distinction" — not on numeric scale

### Mobile-First Constraints (375px)
- GradeTable: sticky first column + horizontal scroll for remaining columns
- Tab bars: horizontal scroll (overflow-x: auto) — no wrapping
- All tap targets: 44×44px minimum
- Filter bars: stack vertically on mobile
- No page-level horizontal scroll ever
