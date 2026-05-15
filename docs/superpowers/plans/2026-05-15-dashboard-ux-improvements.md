# Dashboard UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix pending submissions bug, add analytics chart pages, improve i18n coverage, reorganize dashboard layout.

**Architecture:** Six independent tasks: bug fix, two new backend endpoints added to existing analytics router, two new React chart pages with Recharts, dashboard layout/i18n changes.

**Tech Stack:** React, Recharts (new), FastAPI, SQLAlchemy, existing i18n system, design tokens.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/package.json` | Modify | Add recharts dependency |
| `backend/app/api/v1/routes/analytics.py` | Modify | Add plan-history and submission-history endpoints |
| `apps/web/src/api/analytics.js` | Create | Frontend API client for analytics endpoints |
| `apps/web/src/pages/Analytics/PlansAnalytics.jsx` | Create | Plan generation history chart page |
| `apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx` | Create | Submission history chart page |
| `apps/web/src/App.jsx` | Modify | Add /analytics/* routes |
| `apps/web/src/pages/Dashboard/Dashboard.jsx` | Modify | Fix submissions bug, clickable cards, move search |
| `apps/web/src/components/AlertsPanel/AlertsPanel.jsx` | Modify | Add "Student Data Quality" section title |
| `apps/web/src/pages/StudentProfile/GradesTab.jsx` | Modify | Use i18n for subject names |
| `packages/ui/src/i18n/en.json` | Modify | Add subject names, analytics strings, update search label |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Add Chinese translations for all new keys |

---

### Task 1: Fix Pending Submissions Count Bug

**Files:**
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx:84`

The submissions API returns `{ submissions: [...], total: N }` but line 84 reads `submissionsQuery.data?.length` which is `undefined` on an object (not an array), falling through to `?? 0`.

- [ ] **Step 1: Fix the submissions count**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, change line 84 from:

```javascript
{ label: t('submissions.pendingSubmissions'), value: submissionsQuery.isLoading ? '--' : (submissionsQuery.data?.length ?? 0) },
```

to:

```javascript
{ label: t('submissions.pendingSubmissions'), value: submissionsQuery.isLoading ? '--' : (submissionsQuery.data?.submissions?.length ?? submissionsQuery.data?.total ?? 0) },
```

- [ ] **Step 2: Verify the fix**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds.

Then start the dev server, navigate to `/dashboard`, confirm the pending submissions count is no longer 0 when submissions exist.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "fix: pending submissions count reads correct field from API response"
```

---

### Task 2: Backend Analytics Endpoints (Plan History + Submission History)

**Files:**
- Modify: `backend/app/api/v1/routes/analytics.py`

Add two new endpoints to the existing analytics router. Both support `granularity` (daily/weekly/monthly) and `days` query params, scoped to current user's organisation.

- [ ] **Step 1: Add plan-history endpoint**

Append to `backend/app/api/v1/routes/analytics.py`:

```python
from datetime import datetime, timedelta, timezone


def _bucket_date(dt: datetime, granularity: str) -> str:
    """Bucket a datetime into a date string based on granularity."""
    if granularity == "weekly":
        # ISO week start (Monday)
        monday = dt - timedelta(days=dt.weekday())
        return monday.strftime("%Y-%m-%d")
    elif granularity == "monthly":
        return dt.strftime("%Y-%m-01")
    else:  # daily
        return dt.strftime("%Y-%m-%d")


@router.get("/plan-history")
def get_plan_generation_history(
    granularity: str = Query("daily", description="daily | weekly | monthly"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Plan generation frequency over time, grouped by granularity."""
    from app.modules.school_choice.models.models import PlanGenerationJob

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    org_id = getattr(current_user, "active_organisation_id", None)

    query = db.query(PlanGenerationJob).filter(
        PlanGenerationJob.created_at >= cutoff,
        PlanGenerationJob.status == "DONE",
    )
    if org_id:
        query = query.join(Student, PlanGenerationJob.student_id == Student.id).filter(
            Student.organisation_id == org_id
        )

    jobs = query.all()

    buckets: dict[str, int] = defaultdict(int)
    for job in jobs:
        key = _bucket_date(job.created_at, granularity)
        buckets[key] += 1

    data = [{"date": k, "count": v} for k, v in sorted(buckets.items())]
    return {"data": data, "granularity": granularity, "total": sum(v for v in buckets.values())}
```

- [ ] **Step 2: Add submission-history endpoint**

Append to the same file:

```python
@router.get("/submission-history")
def get_submission_history(
    granularity: str = Query("daily", description="daily | weekly | monthly"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submission frequency over time: total created and approved, grouped by granularity."""
    from app.modules.school_choice.models.submissions import StudentChoiceSubmission

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    org_id = getattr(current_user, "active_organisation_id", None)

    query = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.created_at >= cutoff,
    )
    if org_id:
        query = query.join(Student, StudentChoiceSubmission.student_id == Student.id).filter(
            Student.organisation_id == org_id
        )

    submissions = query.all()

    total_buckets: dict[str, int] = defaultdict(int)
    approved_buckets: dict[str, int] = defaultdict(int)

    for sub in submissions:
        key = _bucket_date(sub.created_at, granularity)
        total_buckets[key] += 1
        if sub.status == "approved" and sub.reviewed_at:
            approved_key = _bucket_date(sub.reviewed_at, granularity)
            approved_buckets[approved_key] += 1

    all_dates = sorted(set(list(total_buckets.keys()) + list(approved_buckets.keys())))
    data = [
        {"date": d, "total": total_buckets.get(d, 0), "approved": approved_buckets.get(d, 0)}
        for d in all_dates
    ]
    return {
        "data": data,
        "granularity": granularity,
        "total_submissions": sum(total_buckets.values()),
        "total_approved": sum(approved_buckets.values()),
    }
```

- [ ] **Step 3: Verify endpoints**

Run the backend: `cd backend && uvicorn app.main:app --reload`

Test:
```bash
# Plan history
curl -s http://localhost:8000/api/v1/analytics/plan-history?granularity=daily | python3 -m json.tool

# Submission history
curl -s http://localhost:8000/api/v1/analytics/submission-history?granularity=weekly | python3 -m json.tool
```

Expected: JSON responses with `data` arrays. May be empty if no data — that's OK, structure should be correct.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/analytics.py
git commit -m "feat: add plan-history and submission-history analytics endpoints"
```

---

### Task 3: Install Recharts + Create Frontend API Client

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/api/analytics.js`

- [ ] **Step 1: Install recharts**

```bash
cd /Users/bsg/Downloads/schoolchoice && pnpm add recharts --filter @schoolchoice/web
```

- [ ] **Step 2: Create analytics API client**

Create `apps/web/src/api/analytics.js`:

```javascript
import client from '@schoolchoice/ui/api/client';

export const getPlanHistory = (params = {}) =>
  client.get('/api/v1/analytics/plan-history', { params }).then(r => r.data);

export const getSubmissionHistory = (params = {}) =>
  client.get('/api/v1/analytics/submission-history', { params }).then(r => r.data);
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/src/api/analytics.js pnpm-lock.yaml
git commit -m "feat: install recharts, add analytics API client"
```

---

### Task 4: Plan Generation History Chart Page

**Files:**
- Create: `apps/web/src/pages/Analytics/PlansAnalytics.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Add i18n keys**

Add to `packages/ui/src/i18n/en.json` inside the top-level object:

```json
"analytics": {
  "planHistory": "Plan Generation History",
  "submissionHistory": "Submission History",
  "daily": "Daily",
  "weekly": "Weekly",
  "monthly": "Monthly",
  "plansGenerated": "Plans Generated",
  "totalSubmissions": "Total Submissions",
  "approvedSubmissions": "Approved",
  "backToDashboard": "Back to Dashboard",
  "noData": "No data for this period",
  "total": "Total"
}
```

Add to `packages/ui/src/i18n/zh-HK.json`:

```json
"analytics": {
  "planHistory": "生成計劃紀錄",
  "submissionHistory": "提交紀錄",
  "daily": "每日",
  "weekly": "每週",
  "monthly": "每月",
  "plansGenerated": "已生成計劃",
  "totalSubmissions": "提交總數",
  "approvedSubmissions": "已批准",
  "backToDashboard": "返回主頁",
  "noData": "此期間沒有數據",
  "total": "總計"
}
```

- [ ] **Step 2: Create PlansAnalytics page**

Create `apps/web/src/pages/Analytics/PlansAnalytics.jsx`:

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getPlanHistory } from '../../api/analytics';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRANULARITIES = ['daily', 'weekly', 'monthly'];

export default function PlansAnalytics() {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState('daily');
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'plan-history', granularity],
    queryFn: () => getPlanHistory({ granularity, days: 90 }),
  });

  const chartData = data?.data ?? [];

  const toggleStyle = (active) => ({
    flex: 1,
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    fontFamily: 'var(--font-family-base)',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '100%' }}>
        <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-block' }}>
          ← {t('analytics.backToDashboard')}
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, textWrap: 'balance' }}>
            {t('analytics.planHistory')}
          </h1>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
            {GRANULARITIES.map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={toggleStyle(granularity === g)} aria-pressed={granularity === g}>
                {t(`analytics.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {data?.total != null && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontVariantNumeric: 'tabular-nums' }}>
            {t('analytics.total')}: {data.total}
          </p>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-12) 0' }}>
            {t('analytics.noData')}
          </p>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return granularity === 'monthly' ? d.toLocaleDateString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }} />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
                  contentStyle={{ fontSize: 13, borderRadius: 6 }}
                />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.plansGenerated')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.jsx**

In `apps/web/src/App.jsx`, add the import after the existing imports (around line 35):

```javascript
import PlansAnalytics from './pages/Analytics/PlansAnalytics';
```

Add this route inside `<Routes>`, after the `/data-analysis` routes (after line 107):

```jsx
<Route path="/analytics/plans" element={<ProtectedRoute><PlansAnalytics /></ProtectedRoute>} />
```

- [ ] **Step 4: Build and verify**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds.

Navigate to `/analytics/plans` in the browser. Verify the chart page renders with the granularity toggle.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Analytics/PlansAnalytics.jsx apps/web/src/App.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: plan generation history chart page with daily/weekly/monthly toggle"
```

---

### Task 5: Submission History Chart Page + Dashboard Clickable Cards

**Files:**
- Create: `apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx`

- [ ] **Step 1: Create SubmissionsAnalytics page**

Create `apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx`:

```jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getSubmissionHistory } from '../../api/analytics';
import { useTranslation } from '@schoolchoice/ui/i18n';

const GRANULARITIES = ['daily', 'weekly', 'monthly'];

export default function SubmissionsAnalytics() {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState('daily');
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'submission-history', granularity],
    queryFn: () => getSubmissionHistory({ granularity, days: 90 }),
  });

  const chartData = data?.data ?? [];

  const toggleStyle = (active) => ({
    flex: 1,
    padding: 'var(--space-1) var(--space-3)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 'var(--font-weight-medium)',
    fontFamily: 'var(--font-family-base)',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    background: active ? 'var(--color-surface)' : 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    boxShadow: active ? 'var(--shadow-sm)' : 'none',
  });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)', maxWidth: '100%' }}>
        <Link to="/dashboard" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'inline-block' }}>
          ← {t('analytics.backToDashboard')}
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0, textWrap: 'balance' }}>
            {t('analytics.submissionHistory')}
          </h1>

          <div style={{ display: 'flex', gap: '2px', background: 'var(--color-background)', borderRadius: 'var(--border-radius-sm)', padding: '2px', border: 'var(--border-width) solid var(--color-border)' }}>
            {GRANULARITIES.map((g) => (
              <button key={g} onClick={() => setGranularity(g)} style={toggleStyle(granularity === g)} aria-pressed={granularity === g}>
                {t(`analytics.${g}`)}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontVariantNumeric: 'tabular-nums' }}>
            {t('analytics.total')}: {data.total_submissions} submitted, {data.total_approved} approved
          </p>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : chartData.length === 0 ? (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-12) 0' }}>
            {t('analytics.noData')}
          </p>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)', border: 'var(--border-width) solid var(--color-border)', padding: 'var(--space-4)' }}>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return granularity === 'monthly' ? d.toLocaleDateString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }} />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' })}
                  contentStyle={{ fontSize: 13, borderRadius: 6 }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.totalSubmissions')} />
                <Line type="monotone" dataKey="approved" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} name={t('analytics.approvedSubmissions')} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.jsx**

In `apps/web/src/App.jsx`, add import:

```javascript
import SubmissionsAnalytics from './pages/Analytics/SubmissionsAnalytics';
```

Add route after the plans analytics route:

```jsx
<Route path="/analytics/submissions" element={<ProtectedRoute><SubmissionsAnalytics /></ProtectedRoute>} />
```

- [ ] **Step 3: Make dashboard metric cards clickable**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, change the metrics array (lines 81-84) to include link targets:

```javascript
const metrics = [
  { label: t('dashboard.totalStudents'), value: loading ? '--' : students.length, link: null },
  { label: t('dashboard.plansGenerated'), value: loading ? '--' : students.filter((s) => s.has_plan).length, link: '/analytics/plans' },
  { label: t('submissions.pendingSubmissions'), value: submissionsQuery.isLoading ? '--' : (submissionsQuery.data?.submissions?.length ?? submissionsQuery.data?.total ?? 0), link: '/analytics/submissions' },
  ...entityMetrics.map((m, i) => ({
    label: m.label,
    value: entityCountQueries[i]?.data?.length ?? '--',
    link: null,
  })),
];
```

Then update the Card rendering (lines 148-160) to wrap clickable cards:

```jsx
{metrics.map((m) => {
  const cardContent = (
    <Card key={m.label} style={m.link ? { cursor: 'pointer', transition: 'box-shadow 0.15s' } : undefined}>
      <CardHeader>
        <CardTitle style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
          {m.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
          {m.value}
        </p>
      </CardContent>
    </Card>
  );
  return m.link ? (
    <Link key={m.label} to={m.link} style={{ textDecoration: 'none', color: 'inherit' }}>
      {cardContent}
    </Link>
  ) : (
    <div key={m.label}>{cardContent}</div>
  );
})}
```

- [ ] **Step 4: Build and verify**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds.

Navigate to `/dashboard`. Verify:
- "Plans Generated" card is clickable → navigates to `/analytics/plans`
- "Pending Submissions" card is clickable → navigates to `/analytics/submissions`
- "Total Students" card is NOT clickable

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Analytics/SubmissionsAnalytics.jsx apps/web/src/App.jsx apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "feat: submission history chart page, clickable dashboard metric cards"
```

---

### Task 6: Dashboard Layout Fixes (Search Placement, Alert Title, i18n Subjects)

**Files:**
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx`
- Modify: `apps/web/src/components/AlertsPanel/AlertsPanel.jsx`
- Modify: `apps/web/src/pages/StudentProfile/GradesTab.jsx`
- Modify: `packages/ui/src/i18n/en.json`
- Modify: `packages/ui/src/i18n/zh-HK.json`

- [ ] **Step 1: Move search input below "Your Cohorts" heading**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, remove the search block from its current location (lines 215-264 — the `<div style={{ marginBottom: 'var(--space-6)' }}>` wrapper containing the search input and results).

Then place it immediately after the "Your Cohorts" heading div (after the `<h2>` and "New Cohort" button row, before `cohortsQuery.isLoading` check). The search block should go right after the closing `</div>` of the header flex row (line ~281) and before line 283:

```jsx
{/* Search bar — finds students across all cohorts */}
<div style={{ marginBottom: 'var(--space-4)' }}>
  <input
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={t('dashboard.searchStudentByName')}
    name="student-search"
    autoComplete="off"
    style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-2)', border: 'var(--border-width) solid var(--color-border)', borderRadius: 'var(--border-radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family-base)' }}
    aria-label={t('dashboard.searchStudentByName')}
  />
  {searchQuery.trim() && (
    <div style={{ marginTop: 'var(--space-3)' }}>
      {filteredStudents.length === 0 ? (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>{t('dashboard.noMatch')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredStudents.slice(0, 12).map((student) => (
            <div
              key={student.id}
              onClick={() => navigate(`/students/${student.id}/profile`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/students/${student.id}/profile`)}
              style={{
                background: 'var(--color-surface)',
                border: 'var(--border-width) solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)',
                padding: 'var(--space-3)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                {student.full_name || student.name || t('dashboard.unnamedStudent')}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {student.class_name && `${t('dashboard.class')} ${student.class_name}`}
                {student.class_name && student.year_of_study && ' · '}
                {student.year_of_study && `${t('dashboard.year')} ${student.year_of_study}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )}
</div>
```

Note the placeholder changed from `t('dashboard.searchByName')` to `t('dashboard.searchStudentByName')`.

- [ ] **Step 2: Add "Student Data Quality" section title to AlertsPanel**

In `apps/web/src/components/AlertsPanel/AlertsPanel.jsx`, update the `CATEGORIES_CONFIG` array. Change the `missing` category (id: 'missing') to add a `sectionTitle` property:

```javascript
const CATEGORIES_CONFIG = [
  {
    id: 'pendingReview',
    labelKey: 'alerts.pendingReview',
    types: ['pending_review'],
    color: 'var(--color-purple-text)',
    bg: 'var(--color-purple-bg)',
    border: 'var(--color-purple-border)',
    Icon: FileCheck,
  },
  {
    id: 'dataQuality',
    sectionTitleKey: 'alerts.studentDataQuality',
    labelKey: 'alerts.missing',
    types: ['missing_grades', 'missing_targets', 'stale_data'],
    color: 'var(--color-warning-text)',
    bg: 'var(--color-warning-bg)',
    border: 'var(--color-warning-border)',
    Icon: AlertTriangle,
  },
  {
    id: 'conservative',
    labelKey: 'alerts.conservative',
    types: ['dubious_conservative'],
    color: 'var(--color-info-text)',
    bg: 'var(--color-info-bg)',
    border: 'var(--color-info-border)',
    Icon: Info,
  },
  {
    id: 'ambitious',
    labelKey: 'alerts.ambitious',
    types: ['dubious_ambitious', 'at_risk_target'],
    color: 'var(--color-error-text)',
    bg: 'var(--color-error-bg)',
    border: 'var(--color-error-border)',
    Icon: AlertCircle,
  },
];
```

Then in the render, before each category that has `sectionTitleKey`, render a section header. Update the map in the return statement (around line 109):

```jsx
{CATEGORIES.map((cat) => {
  const alerts = grouped[cat.id] || [];
  const count = alerts.length;
  const isExpanded = expandedTab === cat.id;
  const CatIcon = cat.Icon;

  return (
    <div key={cat.id}>
      {cat.sectionTitleKey && (
        <h3 style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          margin: 'var(--space-3) 0 var(--space-1) 0',
        }}>
          {t(cat.sectionTitleKey)}
        </h3>
      )}
      <div style={{ border: `1px solid ${cat.border}`, borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
        {/* ... rest of existing category content unchanged ... */}
      </div>
    </div>
  );
})}
```

- [ ] **Step 3: Add subject name i18n keys**

Add to `packages/ui/src/i18n/en.json`:

```json
"subjects": {
  "CHLA": "Chinese Language",
  "ENGL": "English Language",
  "MATH": "Mathematics (Compulsory Part)",
  "CSD": "Citizenship and Social Development",
  "CHIH": "Chinese History",
  "CHIL": "Chinese Literature",
  "HIST": "History",
  "GEOG": "Geography",
  "TOUR": "Tourism and Hospitality Studies",
  "VART": "Visual Arts",
  "MUSC": "Music",
  "ERS": "Ethics and Religious Studies",
  "PE": "Physical Education",
  "ECON": "Economics",
  "BAFS": "Business, Accounting and Financial Studies",
  "BIOL": "Biology",
  "CHEM": "Chemistry",
  "PHYS": "Physics",
  "CSCI": "Combined Science",
  "ISCI": "Integrated Science",
  "M1": "Mathematics Extended Module 1 (M1)",
  "M2": "Mathematics Extended Module 2 (M2)",
  "ICT": "Information and Communication Technology",
  "DAT": "Design and Applied Technology",
  "HMSC": "Health Management and Social Care",
  "TL": "Technology and Living",
  "FREN": "French",
  "GERM": "German",
  "JAPA": "Japanese",
  "SPAN": "Spanish",
  "PTH": "Putonghua",
  "APL_GENERIC": "Applied Learning (Generic)"
}
```

Add to `packages/ui/src/i18n/zh-HK.json`:

```json
"subjects": {
  "CHLA": "中國語文",
  "ENGL": "英國語文",
  "MATH": "數學（必修部分）",
  "CSD": "公民與社會發展",
  "CHIH": "中國歷史",
  "CHIL": "中國文學",
  "HIST": "歷史",
  "GEOG": "地理",
  "TOUR": "旅遊與款待",
  "VART": "視覺藝術",
  "MUSC": "音樂",
  "ERS": "倫理與宗教",
  "PE": "體育",
  "ECON": "經濟",
  "BAFS": "企業、會計與財務概論",
  "BIOL": "生物",
  "CHEM": "化學",
  "PHYS": "物理",
  "CSCI": "組合科學",
  "ISCI": "綜合科學",
  "M1": "數學延伸單元一（M1）",
  "M2": "數學延伸單元二（M2）",
  "ICT": "資訊及通訊科技",
  "DAT": "設計與應用科技",
  "HMSC": "健康管理與社會關懷",
  "TL": "科技與生活",
  "FREN": "法語",
  "GERM": "德語",
  "JAPA": "日語",
  "SPAN": "西班牙語",
  "PTH": "普通話",
  "APL_GENERIC": "應用學習（通用）"
}
```

Also update the search label — add to both files:

`en.json`: `"dashboard.searchStudentByName": "Search student by name"`
`zh-HK.json`: `"dashboard.searchStudentByName": "按學生姓名搜尋"`

And alert section title:

`en.json`: `"alerts.studentDataQuality": "Student Data Quality"`
`zh-HK.json`: `"alerts.studentDataQuality": "學生數據質量"`

- [ ] **Step 4: Update GradesTab to use i18n for subject names**

In `apps/web/src/pages/StudentProfile/GradesTab.jsx`, change the `HKDSE_SUBJECTS` array (lines 10-43) to only contain codes:

```javascript
const HKDSE_SUBJECT_CODES = [
  'CHLA', 'ENGL', 'MATH', 'CSD', 'CHIH', 'CHIL', 'HIST', 'GEOG', 'TOUR',
  'VART', 'MUSC', 'ERS', 'PE', 'ECON', 'BAFS', 'BIOL', 'CHEM', 'PHYS',
  'CSCI', 'ISCI', 'M1', 'M2', 'ICT', 'DAT', 'HMSC', 'TL',
  'FREN', 'GERM', 'JAPA', 'SPAN', 'PTH', 'APL_GENERIC',
];
```

Then update all references from `HKDSE_SUBJECTS` to use the codes array with `t()` for display names. In the component, wherever subject names are rendered (e.g., `<option>` elements in the subject select, table rows showing subject names), use:

```javascript
const subjectName = t(`subjects.${code}`, { defaultValue: code });
```

Replace the select/option rendering that currently maps `HKDSE_SUBJECTS` as `{ code, name }` to instead map `HKDSE_SUBJECT_CODES` and use `t('subjects.' + code)` for the display name. Wherever `sub.name` was used, use `t('subjects.' + sub.code)` or `t('subjects.' + code)`.

- [ ] **Step 5: Build and verify**

Run: `cd apps/web && npx vite build`
Expected: Build succeeds.

Verify in browser:
- Dashboard: search input is below "Your Cohorts" heading, placeholder says "Search student by name"
- AlertsPanel: "Student Data Quality" title visible above the missing/stale data category
- Student profile → Grades tab: subject names display correctly (English or Chinese based on locale)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/Dashboard/Dashboard.jsx apps/web/src/components/AlertsPanel/AlertsPanel.jsx apps/web/src/pages/StudentProfile/GradesTab.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: move search below cohorts, alert section title, i18n subject names"
```

---

## Self-Review

**Spec coverage check:**
1. ✅ Bug fix: pending submissions count — Task 1
2. ✅ Clickable Plans Generated → chart page — Tasks 4, 5 (step 3)
3. ✅ Clickable Pending Submissions → chart page — Tasks 5
4. ✅ Alert section "Student Data Quality" title — Task 6 (step 2)
5. ✅ Search student placement + label — Task 6 (step 1)
6. ✅ i18n subject names — Task 6 (steps 3-4)
7. ✅ Daily/weekly/monthly granularity toggle — Tasks 4, 5

**Placeholder scan:** No TBDs, TODOs, or vague instructions found.

**Type consistency:** `getPlanHistory`/`getSubmissionHistory` in API client matches endpoint names `plan-history`/`submission-history`. Response shapes (`data`, `granularity`, `total`) match between backend and frontend consumption. `GRANULARITIES` array matches query param values.
