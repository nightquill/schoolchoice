# Continue bug investigation: three persistent UI bugs in schoolchoice

## The bug
A bilingual (EN/中文) school counselling platform has three bugs that have resisted 5+ fix attempts:

1. **"All Students" default cohort**: users can still remove students from this auto-managed cohort. The remove/delete buttons should not exist for this cohort.
2. **Hardcoded English**: when locale is zh-HK, multiple pages still show English text — cohort descriptions, status labels, subject names, university names, various UI elements.
3. **Student grade sandbox**: students should see a "grade builds" feature on their dashboard that lets them create hypothetical grade combinations and see how match scores change. It's not visible.

## Verified reproduction
Previous session's Playwright tests pass — but user confirms bugs still visible in the actual browser. The tests may be checking the wrong selectors or the wrong pages. Trust what the user sees, not what tests assert.

## What's already been RULED OUT (do not repeat)
- CohortDetail.jsx `is_default` check on remove buttons — code is in place, may not be the page user is looking at
- DB seed data update for cohort descriptions — runtime fix that doesn't survive re-seeding; need to fix the seed scripts themselves
- Adding GradesTab import to StudentDashboard.jsx — code is in place but may have render errors
- Automated Playwright tests as verification — they pass but don't catch what the user sees
- Taking screenshots without reading them — screenshots were taken but agent didn't inspect them carefully

## Next experiment to try
Do NOT write any code first. Instead:
1. Open http://localhost:5173 in a persistent browser session
2. Login as admin (verify@test.com / verify123, locale zh-HK)
3. Navigate to EVERY page slowly (30+ seconds each): dashboard, students list, each student profile tab, cohort list, cohort detail for "All Students", cohort report, admin manage (all 4 tabs), data analysis, school directory, submissions
4. For each page: write down every piece of English text visible when it should be Chinese
5. Login as teacher (demo@school.hk / demo12345) — repeat the same navigation
6. Login as student (HKDSE-2026-A001 / Student123) — check dashboard for grade sandbox
7. Create a comprehensive bug list from actual observation
8. Only THEN fix each observed bug one at a time, verifying each fix in the browser before moving to the next

## Files relevant to this bug
- `apps/web/src/pages/Dashboard/Dashboard.jsx` — admin/teacher dashboard
- `apps/web/src/pages/StudentDashboard/StudentDashboard.jsx` — student dashboard (should show GradesTab)
- `apps/web/src/pages/CohortDetail/CohortDetail.jsx` — cohort member list with remove buttons
- `apps/web/src/pages/CohortReport/CohortReport.jsx` — report with school/subject names
- `apps/web/src/pages/AdminManage/AdminManage.jsx` — admin panel with cohort management
- `apps/web/src/pages/AdminTeacherGroups/AdminTeacherGroups.jsx` — teacher groups with member list
- `apps/web/src/pages/AdminTeacherGroups/GroupPermissions.jsx` — permission grid with cohort names
- `apps/web/src/components/AlertsPanel/AlertsPanel.jsx` — alert categories
- `apps/web/src/components/SubmissionHistory/SubmissionHistory.jsx` — submission status labels
- `packages/ui/src/i18n/en.json` — English translations (1377 keys)
- `packages/ui/src/i18n/zh-HK.json` — Chinese translations (1377 keys, verified in sync)
- `backend/app/services/default_cohort.py` — creates "All Students" cohort with English name
- `backend/scripts/seed_demo_school.py` — seeds cohorts with English descriptions

## Key context
- The project uses a custom I18nProvider (not react-i18next) at `packages/ui/src/i18n/index.jsx`
- `useTranslation()` returns `{ t, locale, setLocale }`
- `useLocalizedName()` hook at `apps/web/src/utils/localizedName.js` picks `name_zh` when locale is zh-HK
- DB entities (schools, programmes, subjects) have both `name` and `name_zh` columns
- ESLint `eslint-plugin-i18next` is installed with `no-literal-string` rule at warn level
- Three test accounts: admin (verify@test.com/verify123), teacher (demo@school.hk/demo12345), student (HKDSE-2026-A001/Student123)
- Escalation pack and three-wall pack are installed in .claude/
