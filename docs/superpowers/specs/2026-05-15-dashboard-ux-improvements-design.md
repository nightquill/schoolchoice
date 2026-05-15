# Dashboard UX Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix dashboard bugs, add analytics chart pages for plan generation and submissions, improve i18n coverage, and reorganize dashboard layout for counselor clarity.

**Architecture:** Six independent changes touching dashboard, backend analytics endpoints, i18n files, alerts panel, and two new chart pages using Recharts.

**Tech Stack:** React, Recharts (new dependency), FastAPI, SQLAlchemy, existing i18n system.

---

## 1. Bug Fix: Pending Submissions Shows 0

**Problem:** Dashboard metric card shows 0 pending submissions when there are pending submissions. The submissions API returns `{ submissions: [...], total: N }` but the dashboard reads `.length` on the wrapper object instead of `.submissions.length` or `.total`.

**Fix:** In `Dashboard.jsx`, change the pending submissions count to read the correct field from the API response shape.

**Files:**
- `apps/web/src/pages/Dashboard/Dashboard.jsx` — fix submissions count logic

---

## 2. Clickable Metric Cards + Analytics Pages

### 2a. Plans Generated — Click to `/analytics/plans`

**Backend:** New endpoint `GET /api/v1/analytics/plans?granularity=daily|weekly|monthly&days=90`

Query `PlanGenerationJob` table, group by date bucket (day/week/month based on `created_at`), return:
```json
{
  "data": [
    { "date": "2026-05-01", "count": 3 },
    { "date": "2026-05-02", "count": 1 }
  ],
  "granularity": "daily",
  "total": 42
}
```

- Default: last 90 days, daily granularity
- Weekly: group by ISO week start (Monday)
- Monthly: group by first of month
- Scoped to current user's organisation

**Frontend:** New page `apps/web/src/pages/Analytics/PlansAnalytics.jsx`

- Route: `/analytics/plans`
- Recharts `<LineChart>` inside `<ResponsiveContainer>`
- Single line: plan generation count
- Granularity toggle: three segmented buttons (Daily / Weekly / Monthly), default Daily
- Title: "Plan Generation History"
- Back link to dashboard
- Uses design tokens for colors, `tabular-nums` on axis labels

### 2b. Pending Submissions — Click to `/analytics/submissions`

**Backend:** New endpoint `GET /api/v1/analytics/submissions?granularity=daily|weekly|monthly&days=90`

Query `StudentChoiceSubmission` table, group by date bucket on `created_at`, return:
```json
{
  "data": [
    { "date": "2026-05-01", "total": 5, "approved": 3 },
    { "date": "2026-05-02", "total": 2, "approved": 2 }
  ],
  "granularity": "daily",
  "total_submissions": 87,
  "total_approved": 64
}
```

- `total`: all submissions created on that date
- `approved`: submissions with `status = 'approved'` and `reviewed_at` on that date
- Scoped to current user's organisation

**Frontend:** New page `apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx`

- Route: `/analytics/submissions`
- Recharts `<LineChart>` with **two lines**: total (blue) and approved (green)
- Granularity toggle: Daily / Weekly / Monthly, default Daily
- Legend showing both lines
- Title: "Submission History"
- Back link to dashboard

### 2c. Dashboard Card Clickability

Make the "Plans Generated" and "Pending Submissions" metric cards clickable:
- Wrap in a link or add `onClick` with `navigate()`
- Visual affordance: cursor pointer, subtle hover state
- "Total Students" card remains non-clickable (no analytics page for it)

**Files:**
- `backend/app/api/v1/routes/analytics.py` — new file, both endpoints
- `apps/web/src/pages/Analytics/PlansAnalytics.jsx` — new page
- `apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx` — new page
- `apps/web/src/pages/Dashboard/Dashboard.jsx` — make cards clickable
- `apps/web/src/App.jsx` — add routes
- `packages/ui/src/i18n/en.json` — analytics page strings
- `packages/ui/src/i18n/zh-HK.json` — analytics page strings

**Dependency:** `recharts` added to `apps/web/package.json`

---

## 3. Alert Section: Student Data Import Title

**Problem:** In the AlertsPanel, alerts related to student data quality (missing_grades, stale_data) appear without a section header, making it unclear what they relate to.

**Fix:** Add a visible section title "Student Data Quality" (i18n'd) above the missing_grades/stale_data alert group to distinguish from advisory alerts (too_conservative, too_ambitious, pending_review).

**Files:**
- `apps/web/src/components/AlertsPanel/AlertsPanel.jsx` — add section header
- `packages/ui/src/i18n/en.json` — add `alerts.studentDataQuality` key
- `packages/ui/src/i18n/zh-HK.json` — add Chinese translation

---

## 4. Search Student Placement

**Current:** Search input is positioned in the dashboard above the student cards area.

**Change:**
- Move search input to directly below the "Your Cohorts" heading
- Change placeholder from "Search by name" to "Search student by name"
- Update i18n key `dashboard.searchByName` value to "Search student by name" / "按學生姓名搜尋"

**Files:**
- `apps/web/src/pages/Dashboard/Dashboard.jsx` — move search input DOM position
- `packages/ui/src/i18n/en.json` — update placeholder text
- `packages/ui/src/i18n/zh-HK.json` — update placeholder text

---

## 5. i18n: Subject Names

**Problem:** All 32 DSE subject names are hardcoded in English in `GradesTab.jsx`. No Chinese translations exist.

**Fix:**
- Add `subjects.*` keys to both i18n files for all 32 subjects
- Subject codes as keys: `subjects.CHLA`, `subjects.ENGL`, `subjects.MATH`, etc.
- Update `GradesTab.jsx` to use `t('subjects.CHLA')` instead of hardcoded `'Chinese Language'`
- Audit `DataAnalysis.jsx` for any remaining hardcoded strings and add i18n keys

**Subject list (32 DSE subjects):**
CHLA, ENGL, MATH, M1, M2, PHIS, CHEM, BIOL, BAFS, ECON, GEOG, HIST, CHIS, ICT, LITS, VA, MUSC, PE, THS, DAT, HMSC, SCI, PSYE, TOUR, ETHR, JPLA, FRLA, GRLA, SPLA, URLA, HILA, KOLA

**Files:**
- `packages/ui/src/i18n/en.json` — add 32 subject name keys
- `packages/ui/src/i18n/zh-HK.json` — add 32 subject Chinese names
- `apps/web/src/pages/StudentProfile/GradesTab.jsx` — use i18n for subject names
- `apps/web/src/pages/DataAnalysis/DataAnalysis.jsx` — audit and fix hardcoded strings

---

## Non-goals

- Programme names remain in English (official JUPAS names, not a translation issue)
- No changes to the alert generation logic itself
- No changes to plan generation or submission workflows
- Total Students card stays non-clickable
