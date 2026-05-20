# Spec A: i18n Completeness + Lint Enforcement

> Zero hardcoded natural language in source code. Every user-visible string goes through `t()`. ESLint rule prevents regression.

## Problem

17 frontend files contain hardcoded English strings that bypass the i18n system. One file (`SubmissionHistory.jsx`) contains hardcoded Chinese. The app has 1,275 translation keys in perfect EN/中文 sync, but nothing prevents agents or developers from adding new hardcoded strings. This has been reported and "fixed" multiple times — it keeps recurring because there is no structural enforcement.

## Scope

### Pages to wire (5 files)

| File | Hardcoded strings | Examples |
|------|-------------------|----------|
| `apps/web/src/pages/SubjectDetail/SubjectDetail.jsx` | ~20 | Filter labels (Cohort, Sitting), chart titles, stats (Mean, Variance), empty states, category labels (Core, Elective), dynamic counts |
| `apps/web/src/pages/MethodologyReport/MethodologyReport.jsx` | ~10 | Section headings (Data Coverage, How It Works, Data Sources, Limitations), stat labels (JUPAS Programmes, Institutions), back links |
| `apps/web/src/pages/StudentDetailPage/StudentDetailPage.jsx` | ~15 | Form labels (Name, Target Region, Grades, Interests), button labels (Edit Student, Generate Recommendations, Generate Action Plan), error messages, empty states |
| `apps/web/src/pages/Submissions/StudentSubmissions.jsx` | 3 | Page heading (My Submissions), back link, loading label |
| `apps/web/src/pages/StudentProfile/PlansTab.jsx` | 2 | LoadingSpinner label, EmptyState message |

### Components to wire (8 files)

| File | Hardcoded strings | Examples |
|------|-------------------|----------|
| `apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx` | ~10 | Status labels (Draft, Pending Review, Approved, Revision Requested, Rejected), table headers (Submitted, Status, Choices, Reviewed, Notes), hardcoded Chinese `志願` on line 78 |
| `apps/web/src/components/ValidationSummary/ValidationSummary.jsx` | ~10 | Summary badges ({count} valid, {count} errors), table headers (Row #, Field, Value, Reason), button label (Download error rows as CSV), section heading (Duplicate rows) |
| `apps/web/src/components/ActionPlanDisplay/ActionPlanDisplay.jsx` | 3 | Section labels (Academic Targets, Extracurricular Direction, Preparation Steps) |
| `apps/web/src/components/RecommendationCard/RecommendationCard.jsx` | 3 | Labels (Score, Why it matches, Gaps) |
| `apps/web/src/components/EntityListView/EntityListView.jsx` | 1 | Empty state template |
| `apps/web/src/components/EntityForm/EntityForm.jsx` | 3 | Validation message, Save/Cancel button labels |
| `apps/web/src/components/EntityForm/fieldComponents.jsx` | 1 | Select placeholder (— Select —) |
| `apps/web/src/components/ShapSummary/ShapSummary.jsx` | 3 | Stats labels (Admission probability, pts, Mean/Mode/n summary) |

### UI primitives — prop-based translation (4 files)

These are low-level components without page context. They should accept translated strings via props, not call `useTranslation()` internally.

| File | Change |
|------|--------|
| `packages/ui/src/components/FileUpload/FileUpload.jsx` | Accept `labels` prop for "Drag file here", "Browse", "Uploading…" |
| `packages/ui/src/components/Modal/Modal.jsx` | Accept `cancelLabel` prop, default to `t('common.cancel')` at call sites |
| `packages/ui/src/components/Button/Button.jsx` | Accept `loadingLabel` prop for "Loading…" text |
| `apps/web/src/components/PlanSectionEditor/PlanSectionEditor.jsx` | Editing label and toolbar titles via `t()` |

### Translation files

- Add ~80 new keys to `packages/ui/src/i18n/en.json`
- Add ~80 matching keys to `packages/ui/src/i18n/zh-HK.json`
- Both files must have identical key sets after changes

### New key namespaces

Keys follow existing convention — `{domain}.{element}`:

```
subjectDetail.*     — filter labels, chart titles, stats, empty states, category labels
methodology.*       — section headings, stat labels, back links
studentDetail.*     — form labels, buttons, error messages, empty states
submissionHistory.* — status labels, table headers, choice label
validation.*        — summary badges, table headers, buttons
actionPlan.*        — section labels
recommendation.*    — score label, section labels
entityList.*        — (extend existing) empty state
entityForm.*        — validation, buttons
shap.*              — stats labels
fileUpload.*        — upload text, browse button
```

### ESLint enforcement

Install and configure `eslint-plugin-i18next`:

- **Package:** `eslint-plugin-i18next` added as dev dependency at workspace root
- **Rule:** `i18next/no-literal-string` set to `error`
- **Mode:** `jsx-text-only` — only flags literal text content inside JSX elements
- **Template validation:** `should-validate-template: true` — also catches template literals in JSX
- **Ignored callees:** `console.*`, `Error`
- **Ignored attributes:** `aria-label`, `aria-*`, `data-*`, `className`, `style`, `key`, `role`, `type`, `name`, `htmlFor`, `id`, `src`, `href`, `alt`
- **Ignored files:** `*.test.*`, `*.config.*`, `vite.config.*`
- **Ignored values:** technical codes matching `/^[A-Z0-9_*]+$/` (covers `JUPAS`, `HKDSE`, `5**`, `U`, `ENGL`, `MOCK`, `TRIAL`, `OFFICIAL`, etc.)

## Success Criteria

1. **Locale switch test:** Set locale to `zh-HK` → navigate every page → zero English text visible (except: proper nouns like `JUPAS`, `IELTS`; grade labels `5**` through `U`; technical codes)
2. **Lint passes:** `pnpm lint` succeeds with `no-literal-string` rule active across all `.jsx` files
3. **Key parity:** `en.json` and `zh-HK.json` have identical key sets (verified by diff of sorted keys)
4. **No regressions:** Existing translation keys unchanged. All pages that were already translated continue to work.
5. **No hardcoded Chinese:** `志願` and any other Chinese text removed from source code and moved to `zh-HK.json`

## Out of Scope

- Splitting translation files into namespaces (single file is working at 1,275 keys)
- Backend API error message translation (backend returns error codes; frontend maps to i18n keys)
- RTL support (not relevant for EN/中文)
- Third-language support
- Locale-aware date/number formatting (not currently broken)
- Refactoring existing translated components (only touching files that need new i18n wiring)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Key file structure | Single `en.json` + `zh-HK.json` | Working at current scale; namespace split deferred |
| Natural language in source | Zero tolerance | ESLint enforced; same value in both files for universal terms |
| UI primitive i18n | Props, not hooks | Primitives don't have page context; callers pass translated strings |
| Lint rule severity | `error`, not `warning` | Warnings get ignored; error blocks commit |
| Hardcoded Chinese | Remove, externalize to i18n | `志願` moved to `zh-HK.json` as `submissionHistory.choiceRank`, English gets `Choice {rank}` |
