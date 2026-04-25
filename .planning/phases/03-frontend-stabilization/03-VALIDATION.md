---
phase: 3
slug: frontend-stabilization
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-24
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | UX-01, UX-04 | — | N/A | infra | `cd frontend && npx vitest run 2>&1 \| tail -5 && npm list tailwindcss && test -f components.json` | no (W0 creates) | pending |
| 03-01-02 | 01 | 1 | PLAT-03 | T-03-01 | Unauthenticated 401 | unit | `cd backend && python -m pytest tests/test_entities.py -x --tb=short` | no (task creates) | pending |
| 03-02-01 | 02 | 2 | UX-01, UX-03 | T-03-03 | Retry limit set | unit | `cd frontend && grep -c "QueryClientProvider" src/App.jsx && test -f src/components/QueryBoundary/QueryBoundary.jsx` | no (task creates) | pending |
| 03-02-02 | 02 | 2 | UX-01 | — | N/A | unit | `cd frontend && npx vitest run src/pages/StudentProfile/StudentProfile.test.jsx` | no (task creates) | pending |
| 03-03-01 | 03 | 3 | UX-02, UX-03 | — | N/A | unit | `cd frontend && ls src/hooks/use*Tab.js \| wc -l` | no (task creates) | pending |
| 03-03-02 | 03 | 3 | UX-02 | — | N/A | unit | `cd frontend && npx vitest run src/pages/StudentProfile/` | no (task creates tabs) | pending |
| 03-04-01 | 04 | 3 | PLAT-03 | — | N/A | unit | `cd frontend && test -f src/api/entities.js && test -f src/components/EntityForm/fieldComponents.js` | no (task creates) | pending |
| 03-04-02 | 04 | 3 | PLAT-03 | T-03-05 | No dangerouslySetInnerHTML | unit | `cd frontend && test -f src/components/EntityListView/EntityListView.jsx && test -f src/components/EntityForm/EntityForm.jsx` | no (task creates) | pending |
| 03-04-03 | 04 | 3 | PLAT-03 | T-03-06, T-03-07 | ProtectedRoute wraps entity routes | unit | `cd frontend && grep "EntityListPage" src/App.jsx && grep "getEntities" src/components/NavBarV2/NavBarV2.jsx` | no (task creates pages) | pending |
| 03-05-01 | 05 | 4 | UX-04 | — | N/A | infra | `cd frontend && ls src/components/ui/ && grep "Toaster" src/main.jsx` | no (task installs) | pending |
| 03-05-02 | 05 | 4 | UX-04 | — | N/A | unit | `cd frontend && grep -r "from '../../components/Button/Button'" src/pages/ \| wc -l && npx vitest run` | depends on W0 | pending |
| 03-05-03 | 05 | 4 | UX-04 | — | N/A | unit | `cd frontend && npx vitest run src/pages/StudentProfile/StudentProfile.test.jsx` | depends on 03-02-02 | pending |
| 03-05-04 | 05 | 4 | UX-04 | — | N/A | manual | Human visual verification checkpoint | N/A | pending |
| 03-06-01 | 06 | 5 | UX-05 | — | N/A | unit | `cd frontend && grep "md:hidden" src/components/NavBarV2/NavBarV2.jsx && grep "overflow-x-auto" src/pages/StudentProfile/StudentProfile.jsx` | depends on prior plans | pending |
| 03-06-02 | 06 | 5 | UX-06, UX-07, UX-08 | — | N/A | unit | `cd frontend && npx vitest run src/components/PlanSectionEditor/PlanSectionEditor.test.jsx && grep "getEntities" src/pages/Dashboard/Dashboard.jsx && grep "TemplateSelector" src/pages/AcademicPlan/AcademicPlan.jsx` | no (task creates test) | pending |
| 03-06-03 | 06 | 5 | UX-05 | — | N/A | manual | Human visual verification checkpoint — mobile 375px | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` — install test framework
- [ ] `vitest.config.ts` — configure vitest with jsdom environment
- [ ] `src/tests/setup.ts` — RTL setup file
- [ ] Characterization tests for StudentProfile — baseline before decomposition

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile 375px viewport rendering | UX-05 | Visual layout check | Open all pages at 375px width, verify no horizontal overflow |
| UI polish / professional appearance | UX-04 | Subjective visual assessment | Review spacing, typography, color consistency across all pages |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
