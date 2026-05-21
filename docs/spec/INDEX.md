# SchoolChoice Application Spec

This is the authoritative specification for the SchoolChoice application. Every page, component, endpoint, and interaction is documented here. When code contradicts the spec, the spec is correct — fix the code.

## Agent Protocol

**Before modifying any feature:**
1. Read this INDEX.md for global rules
2. Read the relevant feature spec file (see File Index below)
3. If your change contradicts the spec, update the spec FIRST, then implement
4. Verify against the updated spec
5. Never claim "done" without checking EVERY element listed in the spec for the affected page

**When verifying a page via Playwright:**
- Check EVERY element listed in the spec, not just the one you changed
- Screenshot the full page (full-page screenshot), not just the viewport
- Report any element that doesn't match the spec, even if unrelated to your task
- A test that passes but doesn't verify the spec is worthless

**When a bug is reported:**
1. Read the spec for the affected page
2. Identify which spec element is broken
3. Fix the code to match the spec
4. Verify ALL elements on that page still match the spec (regression check)

## Staleness Tracking

Each spec file includes a `<!-- spec-tracks: [...] -->` comment listing the source files it covers. When source files change but the spec doesn't, the spec may be stale.

Run the staleness check: `node scripts/check-spec-staleness.js`

This outputs spec files that may need updating. Integrate into CI to flag stale specs on PRs.

**Rule:** Any PR that modifies a tracked source file MUST also update the corresponding spec file, or explicitly note in the PR description why the spec is still accurate.

## Cross-Cutting Rules

### Application Architecture — Single App, Three Roles
This is ONE web application (apps/web) serving three user roles with different page visibility:

| Role | Dashboard | Pages visible |
|------|-----------|--------------|
| **admin** | Teacher Dashboard (metrics, alerts, cohorts, quick actions) | All pages: students, schools, data analysis, submissions, admin manage, import, analytics, cohorts, plans |
| **counsellor** | Teacher Dashboard (same as admin, limited by cohort permissions) | Same as admin minus admin-only routes (/admin/manage requires admin role) |
| **student** | Student Dashboard (programme choices + grade sandbox + submit) | /dashboard (StudentDashboard variant), /my-plan, /my-submissions, /account/settings, /schools (read-only) |

The `DashboardRouter` component checks `user.role` and renders `StudentDashboard` for students, `Dashboard` for admin/counsellor. There is NO separate student app — all roles share the same React app with role-based routing.

### Authentication
- All routes require JWT auth except: /login, /health
- Roles: admin, counsellor, student
- Admin sees everything; counsellor sees based on cohort permissions; student sees own data only
- Unauthenticated → redirect to /login
- Expired token (401) → clear auth state, clear QueryClient cache → redirect to /login

### Permissions
- Feature-level access controlled by CohortPermission model
- 10 permission features: programme_choices, grades, plan_generation, submissions, reports, cohort_management, data_import, account_assignment, student_delete, student_profile
- Each feature: read_write | read_only | none
- Permission checked via useFeatureAccess() hook on frontend, permission_service on backend
- Counsellors without any group membership see "No group access" message

### i18n
- UI chrome: use t('key') from translation files (en.json, zh-HK.json)
- Domain data (schools, programmes): use useLocalizedName() hook — picks name_zh when locale is zh-HK, falls back to name
- Subjects: use t(`subjects.${code}`), fallback to subject_name field
- No hardcoded strings in components — ALL user-visible text goes through t() or useLocalizedName()
- Date/number formatting: always pass app locale to Intl APIs, never browser default
- Locale switching: update preference via PATCH /account, sync to sessionStorage + localStorage, call setLocale()
- Known limitation: currently requires window.location.reload() — target is seamless switching without reload

### Loading & Error States
- Every page: show LoadingSpinner while data fetches (with descriptive label)
- API error: show ErrorMessage with retry button
- Empty data: show EmptyState with contextual message and action button
- Never show raw error objects, undefined, [object Object], NaN, or translation keys to users
- Never show empty/blank page — always a loading spinner, error message, or empty state

### Navigation
- NavBarV2 at top of every authenticated page
- Receives account object for user context display
- Mobile: hamburger menu at 768px breakpoint
- Active nav item highlighted
- Logo links to /dashboard

### Forms & Validation
- Required fields marked with red asterisk
- Validation errors shown inline per field (red border + error text below)
- Submit buttons disabled while request in flight; text changes to "Saving..." / "Creating..." etc.
- Cancel buttons clear form state and close modal/form
- Toast notifications (sonner) for success/failure on mutations

### Data Fetching
- All data via TanStack Query (React Query)
- Default staleTime: 30s, retry: 1
- Query keys: hierarchical — ['students'], ['student', id], ['targets', studentId], etc.
- Mutations invalidate relevant query keys on success
- Loading: show LoadingSpinner; Error: show ErrorMessage with retry

### Responsive Layout
- Grid layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Mobile breakpoint: 768px
- Content max-width varies by page (640px for forms, full-width for dashboards/tables)
- Cards and tables stack vertically on mobile

### Test Account
- Admin: verify@test.com / verify123 (St Pauls org)
- Students: candidate number as both username and password (e.g. HKDSE-2026-A001 / HKDSE-2026-A001)

## Spec File Index

| File | Pages/Features | Lines |
|------|---------------|-------|
| [auth.md](auth.md) | Login, registration, invite, password reset, session | 88 |
| [dashboard.md](dashboard.md) | Teacher/admin dashboard, alerts, quick actions, cohorts | 99 |
| [onboarding.md](onboarding.md) | 3-step onboarding wizard | 65 |
| [account.md](account.md) | Account settings, password, preferences, deletion | 78 |
| [student-profile.md](student-profile.md) | Student profile with 7 tabs (Programmes, Grades, Plans, Personal, Evaluations, Activities, Notes, Language) | 592 |
| [school-directory.md](school-directory.md) | School directory, school profile, programme detail | 340 |
| [self-financing.md](self-financing.md) | SF institutions and programmes | 264 |
| [academic-plan.md](academic-plan.md) | Plan generation, templates, chat, section editing, release, HTML output | 580 |
| [submissions.md](submissions.md) | Submission list, detail, review workflow, flags | 416 |
| [cohorts.md](cohorts.md) | Cohort detail, report, bulk grade editing | 312 |
| [analytics.md](analytics.md) | Plans analytics, submissions analytics, data analysis | 278 |
| [admin.md](admin.md) | Admin panel (teacher groups, cohorts, teachers, settings), permissions | 466 |
| [student-portal.md](student-portal.md) | Student dashboard, my-grades, my-choices, my-plan, my-submissions | 261 |
| [import.md](import.md) | Student import wizard, entity import, entity CRUD | 287 |
| [methodology.md](methodology.md) | Methodology report page | 138 |

**Total: 15 spec files, ~4,264 lines**
