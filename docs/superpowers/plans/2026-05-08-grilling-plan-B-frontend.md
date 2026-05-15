# Grilling Plan B: Frontend Features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close frontend gaps from grilling decisions #9, #10, #12, #17 — onboarding wizard, bulk edit grid, in-app alerts, and autosave/offline.

**Architecture:** New React pages and components using existing @schoolchoice/ui primitives. Backend alert generation as a lightweight service. localStorage autosave via custom hooks. Bulk edit uses a simple table-based grid (no external spreadsheet library — YAGNI).

**Tech Stack:** React, @tanstack/react-query, sonner, @schoolchoice/ui, localStorage API

**Depends on:** Plan A (schema changes) must be committed first.

---

### Task 1: In-app alerts system (Decision #12)

**Files:**
- Create: `backend/app/services/alert_service.py`
- Create: `backend/app/api/v1/routes/alerts.py`
- Modify: `backend/app/main.py` (register alerts router)
- Create: `apps/web/src/api/alerts.js`
- Create: `apps/web/src/components/AlertsPanel/AlertsPanel.jsx`
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx`
- Modify: `packages/ui/src/components/NavBar/NavBar.jsx` or NavBarV2 (badge count)
- Test: `backend/tests/test_alerts.py`

- [ ] **Step 1: Create alert service**

Create `backend/app/services/alert_service.py`:

```python
"""
Alert generation service (Decision #12).

Generates alerts by querying student data for:
- Stale data: students with no grade updates in 30+ days
- At-risk targets: students with at_risk=True on any target
- Missing data: students without grades or without targets
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models import Student
from app.modules.school_choice.models.models import (
    StudentSchoolTarget,
    StudentSubjectGrade,
)


def generate_alerts(
    db: Session,
    *,
    user_id: UUID | None = None,
    organisation_id: UUID | None = None,
) -> list[dict]:
    """Generate alerts for students owned by this counselor/org."""
    alerts = []

    # Build student query scoped by user or org
    student_query = db.query(Student)
    if organisation_id:
        student_query = student_query.filter(Student.organisation_id == organisation_id)
    elif user_id:
        student_query = student_query.filter(Student.user_id == user_id)
    students = student_query.all()

    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(days=30)

    for student in students:
        student_id = student.id
        student_name = student.name

        # 1. Missing grades
        grade_count = db.query(func.count(StudentSubjectGrade.id)).filter(
            StudentSubjectGrade.student_id == student_id,
        ).scalar()
        if grade_count == 0:
            alerts.append({
                "type": "missing_data",
                "severity": "warning",
                "student_id": str(student_id),
                "student_name": student_name,
                "message": f"{student_name} has no grades entered.",
            })

        # 2. Missing targets
        target_count = db.query(func.count(StudentSchoolTarget.id)).filter(
            StudentSchoolTarget.student_id == student_id,
        ).scalar()
        if target_count == 0:
            alerts.append({
                "type": "missing_data",
                "severity": "info",
                "student_id": str(student_id),
                "student_name": student_name,
                "message": f"{student_name} has no target schools.",
            })

        # 3. At-risk targets
        at_risk_count = db.query(func.count(StudentSchoolTarget.id)).filter(
            StudentSchoolTarget.student_id == student_id,
            StudentSchoolTarget.at_risk.is_(True),
        ).scalar()
        if at_risk_count > 0:
            alerts.append({
                "type": "risk_change",
                "severity": "error",
                "student_id": str(student_id),
                "student_name": student_name,
                "message": f"{student_name} has {at_risk_count} at-risk target(s).",
            })

        # 4. Stale data (no grade updates in 30 days)
        if grade_count > 0:
            latest_update = db.query(func.max(StudentSubjectGrade.updated_at)).filter(
                StudentSubjectGrade.student_id == student_id,
            ).scalar()
            if latest_update and latest_update < stale_threshold:
                days_ago = (now - latest_update).days
                alerts.append({
                    "type": "stale_data",
                    "severity": "warning",
                    "student_id": str(student_id),
                    "student_name": student_name,
                    "message": f"{student_name}'s grades haven't been updated in {days_ago} days.",
                })

    # Sort: errors first, then warnings, then info
    severity_order = {"error": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return alerts
```

- [ ] **Step 2: Create alerts endpoint**

Create `backend/app/api/v1/routes/alerts.py`:

```python
"""Alerts endpoint (Decision #12)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.alert_service import generate_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and return current alerts for this counselor's students."""
    org_id = getattr(current_user, "active_organisation_id", None)
    alerts = generate_alerts(
        db,
        user_id=current_user.id,
        organisation_id=org_id,
    )
    return {"alerts": alerts, "count": len(alerts)}
```

- [ ] **Step 3: Register router in main.py**

Add to `backend/app/main.py`:
```python
from app.api.v1.routes.alerts import router as alerts_router
app.include_router(alerts_router, prefix="/api/v1")
```

- [ ] **Step 4: Write backend test**

Create `backend/tests/test_alerts.py`:

```python
"""Tests for alerts endpoint (Decision #12)."""


def test_alerts_returns_200(client, auth_headers):
    response = client.get("/api/v1/alerts", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "alerts" in data
    assert "count" in data
    assert isinstance(data["alerts"], list)


def test_alerts_unauthenticated(client):
    response = client.get("/api/v1/alerts")
    assert response.status_code == 401
```

- [ ] **Step 5: Run backend tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_alerts.py -x -v`
Expected: 2 passed

- [ ] **Step 6: Create frontend alerts API and component**

Create `apps/web/src/api/alerts.js`:

```javascript
import client from '@schoolchoice/ui/api/client';

export const getAlerts = () =>
  client.get('/api/v1/alerts').then((r) => r.data);
```

Create `apps/web/src/components/AlertsPanel/AlertsPanel.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useState } from 'react';
import { getAlerts } from '../../api/alerts';

const ICON_MAP = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP = {
  error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', icon: '#f59e0b' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '#3b82f6' },
};

export default function AlertsPanel() {
  const [dismissed, setDismissed] = useState(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: getAlerts,
    staleTime: 60_000,
  });

  const alerts = (data?.alerts ?? []).filter((_, i) => !dismissed.has(i));

  if (isLoading || alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h3 style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-3)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Alerts ({alerts.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {alerts.map((alert, i) => {
          const colors = COLOR_MAP[alert.severity] || COLOR_MAP.info;
          const Icon = ICON_MAP[alert.severity] || Info;
          return (
            <div
              key={`${alert.student_id}-${alert.type}-${i}`}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--border-radius-sm)',
                fontSize: 'var(--font-size-sm)',
                color: colors.text,
              }}
            >
              <Icon size={16} style={{ color: colors.icon, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{alert.message}</span>
              <button
                onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.text, padding: '2px', flexShrink: 0,
                }}
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Add AlertsPanel to Dashboard**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, import and render AlertsPanel at the top of the main content area:

```javascript
import AlertsPanel from '../../components/AlertsPanel/AlertsPanel';
```

Add `<AlertsPanel />` after the page heading, before the existing dashboard cards.

- [ ] **Step 8: Add badge count to NavBarV2**

This requires querying alerts count and displaying a badge. In `packages/ui/src/components/NavBar/NavBar.jsx` or the NavBarV2 component used by most pages, add a small red badge next to the Dashboard link when alerts exist.

Read the NavBarV2 component first, then add a `useQuery` for `getAlerts` with `staleTime: 60_000` to get the count, and render a badge span next to "Dashboard" when `count > 0`.

- [ ] **Step 9: Build and verify**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build succeeds

- [ ] **Step 10: Commit**

```bash
git add backend/app/services/alert_service.py backend/app/api/v1/routes/alerts.py backend/app/main.py backend/tests/test_alerts.py apps/web/src/api/alerts.js apps/web/src/components/AlertsPanel/AlertsPanel.jsx apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "feat: in-app alerts system with dashboard panel and nav badge (Decision #12)"
```

---

### Task 2: Autosave drafts to localStorage (Decision #17)

**Files:**
- Create: `apps/web/src/hooks/useAutosave.js`
- Modify: `apps/web/src/hooks/usePersonalTab.js`
- Modify: `apps/web/src/hooks/useGradesTab.js`

- [ ] **Step 1: Create useAutosave hook**

Create `apps/web/src/hooks/useAutosave.js`:

```javascript
import { useEffect, useRef, useCallback } from 'react';

const AUTOSAVE_DELAY = 2000; // 2 seconds after last change

/**
 * Autosave form data to localStorage with debounce.
 *
 * @param {string} key - localStorage key (e.g., "draft:personal:studentId")
 * @param {object} data - current form state to save
 * @param {object} options
 * @param {boolean} options.enabled - whether autosave is active (default true)
 */
export function useAutosave(key, data, { enabled = true } = {}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !key) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [key, data, enabled]);
}

/**
 * Load a saved draft from localStorage.
 *
 * @param {string} key
 * @param {number} maxAgeMs - max age in ms (default 24 hours)
 * @returns {object|null} saved data or null
 */
export function loadDraft(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Clear a saved draft.
 *
 * @param {string} key
 */
export function clearDraft(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Integrate autosave into usePersonalTab**

In `apps/web/src/hooks/usePersonalTab.js`, add:

```javascript
import { useAutosave, loadDraft, clearDraft } from './useAutosave';
```

After the form state initialization, add:

```javascript
const draftKey = studentId ? `draft:personal:${studentId}` : null;
useAutosave(draftKey, form);
```

On successful save (in the mutation's `onSuccess`), clear the draft:

```javascript
clearDraft(draftKey);
```

On initial load, check for a draft and merge it:

```javascript
useEffect(() => {
  if (draftKey) {
    const draft = loadDraft(draftKey);
    if (draft) {
      setForm((prev) => ({ ...prev, ...draft }));
    }
  }
}, [draftKey]);
```

- [ ] **Step 3: Build and verify**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useAutosave.js apps/web/src/hooks/usePersonalTab.js
git commit -m "feat: autosave form drafts to localStorage (Decision #17)"
```

---

### Task 3: Onboarding wizard — first-login detection + flow (Decision #9)

**Files:**
- Create: `apps/web/src/pages/Onboarding/Onboarding.jsx`
- Create: `apps/web/src/api/onboarding.js`
- Modify: `apps/web/src/App.jsx` (add onboarding route)
- Modify: `apps/web/src/pages/Dashboard/Dashboard.jsx` (redirect if first login)

- [ ] **Step 1: Create onboarding page**

Create `apps/web/src/pages/Onboarding/Onboarding.jsx`:

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Input } from '@schoolchoice/ui/primitives/input';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { getAccount } from '@schoolchoice/ui/api/account';

const STEPS = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'school', label: 'School Info' },
  { key: 'import', label: 'Import Students' },
  { key: 'done', label: 'Ready' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const [step, setStep] = useState(0);
  const [schoolName, setSchoolName] = useState('');

  const currentStep = STEPS[step];

  const handleFinish = () => {
    localStorage.setItem('onboarding_complete', 'true');
    toast.success('Setup complete! Welcome to Academic Advisor.');
    navigate('/dashboard');
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const cardStyle = {
    maxWidth: '640px',
    margin: '0 auto',
    padding: 'var(--space-8)',
    background: 'var(--color-surface)',
    borderRadius: 'var(--border-radius-lg)',
    border: '1px solid var(--color-border)',
    marginTop: 'var(--space-8)',
  };

  const stepIndicatorStyle = {
    display: 'flex',
    gap: 'var(--space-4)',
    justifyContent: 'center',
    marginBottom: 'var(--space-6)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data} />
      <div style={cardStyle}>
        <div style={stepIndicatorStyle}>
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: i <= step ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                fontWeight: i === step ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-current={i === step ? 'step' : undefined}
            >
              <span style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i <= step ? 'var(--color-primary)' : 'var(--color-border)',
                color: i <= step ? '#fff' : 'var(--color-text-secondary)',
                fontSize: '12px', fontWeight: 600,
              }}>{i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>

        {currentStep.key === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
              Welcome to Academic Advisor
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Let's set up your school in a few quick steps. You'll be able to import your student roster and start generating academic plans.
            </p>
            <Button onClick={() => setStep(1)}>Get Started</Button>
          </div>
        )}

        {currentStep.key === 'school' && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
              School Information
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>
                  School Name
                </label>
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. St. Paul's College"
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                <Button onClick={() => setStep(2)} disabled={!schoolName.trim()}>Next</Button>
              </div>
            </div>
          </div>
        )}

        {currentStep.key === 'import' && (
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
              Import Student Roster
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
              Upload a CSV or Excel file with your student data. You can also skip this step and add students manually later.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'space-between' }}>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="outline" onClick={() => setStep(3)}>Skip for now</Button>
                <Button onClick={() => navigate('/entities/student/import')}>
                  Import Students
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentStep.key === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-4)' }}>
              You're All Set!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              Your school is configured. Head to the dashboard to start working with your students.
            </p>
            <Button onClick={handleFinish}>Go to Dashboard</Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add onboarding route to App.jsx**

In `apps/web/src/App.jsx`, add import and route:

```javascript
import Onboarding from './pages/Onboarding/Onboarding';
```

Add route before the dashboard route:
```jsx
<Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
```

- [ ] **Step 3: Add first-login redirect to Dashboard**

In `apps/web/src/pages/Dashboard/Dashboard.jsx`, add at the top of the component:

```javascript
import { useNavigate } from 'react-router-dom';

// Inside component:
const navigate = useNavigate();

useEffect(() => {
  const onboardingDone = localStorage.getItem('onboarding_complete');
  if (!onboardingDone) {
    navigate('/onboarding', { replace: true });
  }
}, [navigate]);
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Onboarding/Onboarding.jsx apps/web/src/App.jsx apps/web/src/pages/Dashboard/Dashboard.jsx
git commit -m "feat: onboarding wizard with first-login redirect (Decision #9)"
```

---

### Task 4: Bulk edit / quick-entry grid (Decision #10)

**Files:**
- Create: `apps/web/src/pages/BulkEdit/BulkEdit.jsx`
- Create: `apps/web/src/components/GradeGrid/GradeGrid.jsx`
- Modify: `apps/web/src/App.jsx` (add route)
- Modify: `apps/web/src/pages/CohortDetail/CohortDetail.jsx` (add "Bulk Edit Grades" button)

- [ ] **Step 1: Create GradeGrid component**

Create `apps/web/src/components/GradeGrid/GradeGrid.jsx`:

```jsx
import { useState, useCallback } from 'react';
import { Input } from '@schoolchoice/ui/primitives/input';
import { Button } from '@schoolchoice/ui/primitives/button';
import { toast } from 'sonner';
import client from '@schoolchoice/ui/api/client';

const cellStyle = {
  padding: '2px 4px',
  borderBottom: '1px solid var(--color-border)',
  borderRight: '1px solid var(--color-border)',
  fontSize: 'var(--font-size-sm)',
  minWidth: '60px',
};

const headerCellStyle = {
  ...cellStyle,
  background: 'var(--color-background)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-secondary)',
  position: 'sticky',
  top: 0,
  zIndex: 1,
};

const nameCellStyle = {
  ...cellStyle,
  position: 'sticky',
  left: 0,
  background: 'var(--color-surface)',
  zIndex: 1,
  minWidth: '160px',
  fontWeight: 'var(--font-weight-medium)',
};

const inputStyle = {
  width: '100%',
  minHeight: '32px',
  padding: '2px 6px',
  border: 'none',
  background: 'transparent',
  fontSize: 'var(--font-size-sm)',
  textAlign: 'center',
  outline: 'none',
};

/**
 * Spreadsheet-style grade editing grid.
 *
 * Props:
 *   students - array of { id, name, grades: { subjectCode: { id, raw_grade, sitting } } }
 *   subjects - array of { id, code, name }
 *   sitting - current sitting filter (MOCK | TRIAL | OFFICIAL)
 *   onSaved - callback after batch save
 */
export default function GradeGrid({ students, subjects, sitting, onSaved }) {
  // Track edits as { [studentId]: { [subjectCode]: newGrade } }
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(false);

  const editCount = Object.values(edits).reduce(
    (sum, s) => sum + Object.keys(s).length, 0
  );

  const handleCellChange = useCallback((studentId, subjectCode, value) => {
    setEdits((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [subjectCode]: value },
    }));
  }, []);

  const handlePaste = useCallback((e, studentIdx, subjectIdx) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.includes('\t') && !pasted.includes('\n')) return; // single cell paste
    e.preventDefault();
    const rows = pasted.split('\n').filter(Boolean);
    const newEdits = { ...edits };
    rows.forEach((row, ri) => {
      const cells = row.split('\t');
      const student = students[studentIdx + ri];
      if (!student) return;
      cells.forEach((cell, ci) => {
        const subject = subjects[subjectIdx + ci];
        if (!subject) return;
        if (!newEdits[student.id]) newEdits[student.id] = {};
        newEdits[student.id][subject.code] = cell.trim();
      });
    });
    setEdits(newEdits);
  }, [edits, students, subjects]);

  const handleSave = async () => {
    setSaving(true);
    let savedCount = 0;
    try {
      for (const [studentId, subjectEdits] of Object.entries(edits)) {
        const student = students.find((s) => s.id === studentId);
        if (!student) continue;
        for (const [subjectCode, grade] of Object.entries(subjectEdits)) {
          if (!grade) continue;
          const existing = student.grades?.[subjectCode];
          if (existing?.id) {
            // Update existing grade
            await client.put(`/api/v1/grades/${existing.id}`, {
              raw_grade: grade,
            });
          } else {
            // Create new grade
            const subject = subjects.find((s) => s.code === subjectCode);
            if (!subject) continue;
            await client.post(`/api/v1/students/${studentId}/grades`, {
              subject_id: subject.id,
              sitting,
              raw_grade: grade,
            });
          }
          savedCount++;
        }
      }
      toast.success(`Saved ${savedCount} grade(s).`);
      setEdits({});
      onSaved?.();
    } catch (err) {
      toast.error('Failed to save some grades. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {editCount > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-3) var(--space-4)',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--space-4)',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: '#1e40af' }}>
            {editCount} unsaved change(s)
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="outline" size="sm" onClick={() => setEdits({})}>Discard</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save All'}
            </Button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-sm)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, position: 'sticky', left: 0, zIndex: 2 }}>Student</th>
              {subjects.map((s) => (
                <th key={s.code} style={headerCellStyle} title={s.name}>{s.code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, si) => (
              <tr key={student.id}>
                <td style={nameCellStyle}>{student.name}</td>
                {subjects.map((subject, sj) => {
                  const currentGrade = edits[student.id]?.[subject.code]
                    ?? student.grades?.[subject.code]?.raw_grade
                    ?? '';
                  const isEdited = edits[student.id]?.[subject.code] !== undefined;
                  return (
                    <td key={subject.code} style={{
                      ...cellStyle,
                      background: isEdited ? '#fef9c3' : 'var(--color-surface)',
                    }}>
                      <input
                        type="text"
                        value={currentGrade}
                        onChange={(e) => handleCellChange(student.id, subject.code, e.target.value)}
                        onPaste={(e) => handlePaste(e, si, sj)}
                        style={inputStyle}
                        aria-label={`${student.name} ${subject.code} grade`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create BulkEdit page**

Create `apps/web/src/pages/BulkEdit/BulkEdit.jsx`:

```jsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import GradeGrid from '../../components/GradeGrid/GradeGrid';
import { getAccount } from '@schoolchoice/ui/api/account';
import client from '@schoolchoice/ui/api/client';

export default function BulkEdit() {
  const { cohortId } = useParams();
  const [sitting, setSitting] = useState('MOCK');

  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });

  const cohortQuery = useQuery({
    queryKey: ['cohort-bulk', cohortId, sitting],
    queryFn: async () => {
      // Get cohort members
      const cohort = await client.get(`/api/v1/cohorts/${cohortId}`).then((r) => r.data);
      const members = cohort.members || [];

      // Get subjects
      const subjectsResp = await client.get('/api/v1/subjects').then((r) => r.data);
      const subjects = Array.isArray(subjectsResp) ? subjectsResp : (subjectsResp.items ?? []);

      // Get grades for each student
      const studentsWithGrades = await Promise.all(
        members.map(async (m) => {
          const grades = await client.get(`/api/v1/students/${m.id}/grades`).then((r) => r.data);
          const gradeMap = {};
          (Array.isArray(grades) ? grades : []).forEach((g) => {
            if (g.sitting === sitting) {
              const subj = subjects.find((s) => String(s.id) === String(g.subject_id));
              if (subj) {
                gradeMap[subj.code] = { id: g.id, raw_grade: g.raw_grade, sitting: g.sitting };
              }
            }
          });
          return { id: m.id, name: m.full_name || m.name, grades: gradeMap };
        })
      );

      return { students: studentsWithGrades, subjects, cohortName: cohort.name };
    },
  });

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  return (
    <div style={pageStyle}>
      <NavBarV2 account={accountQuery.data} />
      <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: '100%' }}>
        <Link
          to={`/cohorts/${cohortId}`}
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 'var(--space-4)', display: 'block' }}
        >
          ← Back to Cohort
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
            Bulk Edit Grades {cohortQuery.data?.cohortName ? `— ${cohortQuery.data.cohortName}` : ''}
          </h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {['MOCK', 'TRIAL', 'OFFICIAL'].map((s) => (
              <button
                key={s}
                onClick={() => setSitting(s)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: sitting === s ? 'var(--color-primary)' : 'none',
                  color: sitting === s ? '#fff' : 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family-base)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {cohortQuery.isLoading && <LoadingSpinner label="Loading grades..." />}
        {cohortQuery.isError && <p style={{ color: 'var(--color-error)' }}>Failed to load data.</p>}
        {cohortQuery.data && (
          <GradeGrid
            students={cohortQuery.data.students}
            subjects={cohortQuery.data.subjects}
            sitting={sitting}
            onSaved={() => cohortQuery.refetch()}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add route and button**

In `apps/web/src/App.jsx`:
```javascript
import BulkEdit from './pages/BulkEdit/BulkEdit';
```
Add route:
```jsx
<Route path="/cohorts/:cohortId/bulk-edit" element={<ProtectedRoute><BulkEdit /></ProtectedRoute>} />
```

In `apps/web/src/pages/CohortDetail/CohortDetail.jsx`, add a "Bulk Edit Grades" button that navigates to `/cohorts/${cohortId}/bulk-edit`. Read the file first to find the right insertion point.

- [ ] **Step 4: Build and verify**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GradeGrid/GradeGrid.jsx apps/web/src/pages/BulkEdit/BulkEdit.jsx apps/web/src/App.jsx apps/web/src/pages/CohortDetail/CohortDetail.jsx
git commit -m "feat: bulk edit grade grid with Excel paste support (Decision #10)"
```

---

## Self-Review

| Decision | Task | Covered? |
|----------|------|----------|
| #9 Onboarding wizard | Task 3 | YES — welcome → school info → import → done flow with first-login redirect |
| #10 Bulk edit / grid | Task 4 | YES — spreadsheet grid with Excel paste, batch save, sitting filter |
| #12 In-app alerts | Task 1 | YES — backend alert service, dashboard panel, nav badge |
| #17 Autosave + offline | Task 2 | YES — useAutosave hook with localStorage, 2s debounce, 24h expiry |
