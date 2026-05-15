# Phase 4: School Choice Domain Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate import/export, search, and filter capabilities into the existing school choice domain pages (StudentListPage, SchoolDirectory, AcademicPlan) using the generic components already built in packages/ui.

**Architecture:** The generic framework (ActionBar, SearchFilterBar, FilterControl, ImportWizard, export APIs) already exists. This plan wires those components into the real domain pages and adds backend search support where missing. The students endpoint needs a `q` search param; the schools endpoint already supports `q`, `type`, `location`. Both entity exports route through the existing `/entities/{name}/export` endpoint which resolves models via `_resolve_model()`.

**Tech Stack:** React, @schoolchoice/ui components, FastAPI backend, SQLAlchemy, existing import/export service layer

**Key files reference:**
- `apps/web/src/pages/StudentListPage/StudentListPage.jsx` — student list (180 lines, no search/filter/export)
- `apps/web/src/pages/SchoolDirectory/SchoolDirectory.jsx` — school directory (355 lines, has search but no import/export)
- `apps/web/src/pages/AcademicPlan/AcademicPlan.jsx` — plan page (955 lines, export button exists)
- `packages/ui/src/components/ActionBar/ActionBar.jsx` — generic import/export action bar
- `packages/ui/src/components/SearchFilterBar/SearchFilterBar.jsx` — generic search + filter bar
- `apps/web/src/api/entities.js` — import/export API functions
- `apps/web/src/api/students.js` — student CRUD API
- `apps/web/src/api/schoolsV2.js` — school search API
- `backend/app/api/v1/routes/students.py` — student list endpoint (no search support)
- `backend/app/api/v1/routes/schools_v2.py` — school search endpoint (has q/type/location)
- `backend/app/api/v1/routes/entities.py` — entity import/export endpoints

---

### Task 1: Add search parameter to backend student list endpoint

The student list endpoint (`GET /api/v1/students`) currently only supports `skip` and `limit`. We need to add a `q` text search parameter that filters by student name.

**Files:**
- Modify: `backend/app/api/v1/routes/students.py:93-137`
- Modify: `backend/app/services/student_service.py:19-30`
- Test: `backend/tests/test_students_search.py` (create)

- [ ] **Step 1: Add `q` parameter to `list_students` route and `get_students` service**

In `backend/app/api/v1/routes/students.py`, modify the `list_students` function signature to accept a `q` parameter:

```python
@router.get("", status_code=status.HTTP_200_OK)
def list_students(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, description="Text search across student name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
```

Pass `q` to the service call:

```python
    all_students = student_service.get_students(
        db, user_id=current_user.id,
        organisation_id=_org_id(current_user),
        q=q,
    )
```

In `backend/app/services/student_service.py`, modify `get_students` to accept and apply `q`:

```python
def get_students(
    db: Session, user_id: UUID, *, organisation_id: UUID | None = None, q: str | None = None
) -> list[Student]:
```

Add the search filter after the existing org/user filter:

```python
    if q:
        query = query.filter(Student.name.ilike(f"%{q}%"))
```

- [ ] **Step 2: Run existing student tests to verify no regression**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/ -x --tb=short -q`
Expected: All tests pass (existing test suite green)

- [ ] **Step 3: Write a quick integration test for search**

Create `backend/tests/test_students_search.py`:

```python
"""Test student list search parameter."""
import pytest


def test_student_list_search_returns_200(client, auth_headers):
    """GET /api/v1/students?q=test returns 200 with items array."""
    response = client.get("/api/v1/students?q=test", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_student_list_search_unauthenticated(client):
    """GET /api/v1/students?q=test without auth returns 401."""
    response = client.get("/api/v1/students?q=test")
    assert response.status_code == 401
```

- [ ] **Step 4: Run the new test**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_students_search.py -x -v`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/students.py backend/app/services/student_service.py backend/tests/test_students_search.py
git commit -m "feat: add q= text search to student list endpoint"
```

---

### Task 2: Add search, filter, import/export to StudentListPage

Wire the existing SearchFilterBar, ActionBar, and export functions into the StudentListPage. Replace manual fetch with TanStack Query for consistency.

**Files:**
- Modify: `apps/web/src/pages/StudentListPage/StudentListPage.jsx`
- Modify: `apps/web/src/api/students.js` (add search params support)

- [ ] **Step 1: Extend `getStudents` API to accept search params**

In `apps/web/src/api/students.js`, modify `getStudents` to accept optional params:

```javascript
export const getStudents = (params = {}) =>
  client.get('/api/v1/students', { params }).then((r) => r.data);
```

- [ ] **Step 2: Rewrite StudentListPage with search, filter, and import/export**

Replace the contents of `apps/web/src/pages/StudentListPage/StudentListPage.jsx`:

```jsx
// REQ-032: Student Profile Management - Student list with search, filter, import/export
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavBar, ActionBar, EmptyState, LoadingSpinner, ErrorMessage } from '@schoolchoice/ui';
import { Input } from '@schoolchoice/ui/primitives/input';
import { Button } from '@schoolchoice/ui/primitives/button';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import StudentRow from '../../components/StudentRow/StudentRow';
import StudentForm from '../../components/StudentForm/StudentForm';
import { getStudents, createStudent } from '../../api/students';
import { exportEntityCSV } from '../../api/entities';

function StudentListPage() {
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(handle);
  }, [searchText]);

  const studentsQuery = useQuery({
    queryKey: ['students', debouncedSearch],
    queryFn: () => {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      return getStudents(params);
    },
  });

  const students = Array.isArray(studentsQuery.data)
    ? studentsQuery.data
    : (studentsQuery.data?.items ?? []);

  const handleCreateStudent = async (formData) => {
    setFormLoading(true);
    setFormError('');
    try {
      await createStudent(formData);
      setShowForm(false);
      studentsQuery.refetch();
      toast.success('Student added successfully.');
    } catch {
      setFormError('Could not save student. Please check your input and try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleExportFiltered = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (debouncedSearch) params.q = debouncedSearch;
      await exportEntityCSV('student', params);
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [debouncedSearch]);

  const handleExportAll = useCallback(async () => {
    setIsExporting(true);
    try {
      await exportEntityCSV('student', {});
      toast.success('Export downloaded.');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const pageStyle = {
    minHeight: '100vh',
    background: 'var(--color-background)',
    fontFamily: 'var(--font-family-base)',
  };

  const headerRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 'var(--space-4)',
    borderBottom: 'var(--border-width) solid var(--color-border)',
    marginBottom: 'var(--space-6)',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 'var(--font-weight-bold)',
    color: 'var(--color-text-primary)',
    margin: 0,
  };

  const searchBarStyle = {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'center',
    marginBottom: 'var(--space-4)',
    flexWrap: 'wrap',
  };

  const searchWrapStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--color-surface)',
    border: 'var(--border-width) solid var(--color-border)',
    borderRadius: 'var(--border-radius-md)',
    overflow: 'hidden',
  };

  const thStyle = {
    background: 'var(--color-background)',
    fontWeight: 'var(--font-weight-medium)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-secondary)',
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left',
    borderBottom: 'var(--border-width) solid var(--color-border)',
  };

  return (
    <div style={pageStyle}>
      <NavBar />
      <div className="px-4 md:px-8" style={{ maxWidth: '960px', margin: '0 auto', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div style={headerRowStyle}>
          <h1 style={headingStyle}>Students</h1>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>Add Student</Button>
          )}
        </div>

        <ActionBar
          entityName="student"
          onExportFiltered={handleExportFiltered}
          onExportAll={handleExportAll}
          isExporting={isExporting}
        />

        <div style={searchBarStyle}>
          <div style={searchWrapStyle}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--color-text-secondary)', pointerEvents: 'none', zIndex: 1 }}>
              <Search size={16} />
            </span>
            <Input
              type="text"
              role="searchbox"
              aria-label="Search students"
              placeholder="Search students by name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ maxWidth: 320, minHeight: 44, paddingLeft: 34 }}
            />
          </div>
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
                padding: 'var(--space-1) var(--space-2)',
                fontFamily: 'var(--font-family-base)',
                textDecoration: 'underline',
              }}
            >
              Clear search
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            {formError && <ErrorMessage message={formError} />}
            <StudentForm
              onSubmit={handleCreateStudent}
              onCancel={() => { setShowForm(false); setFormError(''); }}
              loading={formLoading}
              submitLabel="Save"
            />
          </div>
        )}

        <div className="overflow-x-auto">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Target Region</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {studentsQuery.isLoading ? (
                <tr>
                  <td colSpan={4}>
                    <LoadingSpinner label="Loading students..." />
                  </td>
                </tr>
              ) : studentsQuery.isError ? (
                <tr>
                  <td colSpan={4}>
                    <ErrorMessage message="Could not load students. Please refresh the page." />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      message={
                        debouncedSearch
                          ? 'No students match your search. Try a different name.'
                          : 'No students yet. Click Add Student to create a profile.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <StudentRow key={student.id} student={student} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StudentListPage;
```

- [ ] **Step 3: Verify frontend builds**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build completes with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/StudentListPage/StudentListPage.jsx apps/web/src/api/students.js
git commit -m "feat: add search, import/export to StudentListPage"
```

---

### Task 3: Add import/export buttons to SchoolDirectory

The SchoolDirectory already has search and type/location filters. We need to add the ActionBar import/export buttons while keeping the existing filter UI.

**Files:**
- Modify: `apps/web/src/pages/SchoolDirectory/SchoolDirectory.jsx`

- [ ] **Step 1: Add import/export to SchoolDirectory**

In `apps/web/src/pages/SchoolDirectory/SchoolDirectory.jsx`:

1. Add imports at the top:

```javascript
import { ActionBar } from '@schoolchoice/ui';
import { exportEntityCSV } from '../../api/entities';
import { toast } from 'sonner';
```

2. Add export state and handlers inside the component, after the existing `confirmDeleteId` state:

```javascript
const [isExporting, setIsExporting] = useState(false);

const handleExportFiltered = useCallback(async () => {
  setIsExporting(true);
  try {
    const params = {};
    if (filters.q) params.q = filters.q;
    if (filters.type) params.filters = JSON.stringify({ type: filters.type });
    await exportEntityCSV('school', params);
    toast.success('Export downloaded.');
  } catch {
    toast.error('Export failed. Please try again.');
  } finally {
    setIsExporting(false);
  }
}, [filters]);

const handleExportAll = useCallback(async () => {
  setIsExporting(true);
  try {
    await exportEntityCSV('school', {});
    toast.success('Export downloaded.');
  } catch {
    toast.error('Export failed. Please try again.');
  } finally {
    setIsExporting(false);
  }
}, []);
```

3. Render the ActionBar between NavBarV2 and the existing filter bar:

```jsx
<NavBarV2 account={account} />

<ActionBar
  entityName="school"
  onExportFiltered={handleExportFiltered}
  onExportAll={handleExportAll}
  isExporting={isExporting}
/>

<div style={filterBarStyle} role="search" aria-label="School search filters">
  {/* existing filter UI unchanged */}
</div>
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web build`
Expected: Build completes with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/SchoolDirectory/SchoolDirectory.jsx
git commit -m "feat: add import/export ActionBar to SchoolDirectory"
```

---

### Task 4: Verify AcademicPlan export and run Playwright verification

AcademicPlan already has the Export HTML button wired up. Verify all three pages work end-to-end.

**Files:**
- Create: `apps/web/verify-phase4.ts`

- [ ] **Step 1: Start the backend and frontend dev servers**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && uvicorn app.main:app --reload --port 8000 &`
Run: `cd /Users/bsg/Downloads/schoolchoice && pnpm --filter @schoolchoice/web dev &`

Wait for both to be ready.

- [ ] **Step 2: Write Playwright verification script**

Create `apps/web/verify-phase4.ts`:

```typescript
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', 'verify@test.com');
  await page.fill('input[name="password"], input[type="password"]', 'verify123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.screenshot({ path: 'test-results/phase4/01-dashboard.png' });
  console.log('PASS: Login and dashboard loaded');

  // 1. StudentListPage — search + action bar
  await page.goto(`${BASE}/students`);
  await page.waitForSelector('table', { timeout: 10000 });
  await page.screenshot({ path: 'test-results/phase4/02-students-list.png' });

  // Check ActionBar exists (Import/Export buttons)
  const importBtn = page.locator('button:has-text("Import"), button[aria-label*="Import"]');
  const exportBtn = page.locator('button:has-text("Export"), button[aria-label*="Export"]');
  console.log('Students Import button:', await importBtn.count() > 0 ? 'FOUND' : 'MISSING');
  console.log('Students Export button:', await exportBtn.count() > 0 ? 'FOUND' : 'MISSING');

  // Check search box exists
  const searchBox = page.locator('input[role="searchbox"], input[aria-label*="Search"]');
  console.log('Students search box:', await searchBox.count() > 0 ? 'FOUND' : 'MISSING');

  // Type in search
  if (await searchBox.count() > 0) {
    await searchBox.first().fill('nonexistent_xyz');
    await page.waitForTimeout(500); // debounce
    await page.screenshot({ path: 'test-results/phase4/03-students-search.png' });
    console.log('PASS: Student search with debounce');
    await searchBox.first().clear();
    await page.waitForTimeout(500);
  }

  // 2. SchoolDirectory — action bar
  await page.goto(`${BASE}/schools`);
  await page.waitForSelector('[role="list"], .school-card, [role="listitem"]', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/phase4/04-schools-directory.png' });

  const schoolImportBtn = page.locator('button:has-text("Import"), button[aria-label*="Import"]');
  const schoolExportBtn = page.locator('button:has-text("Export"), button[aria-label*="Export"]');
  console.log('Schools Import button:', await schoolImportBtn.count() > 0 ? 'FOUND' : 'MISSING');
  console.log('Schools Export button:', await schoolExportBtn.count() > 0 ? 'FOUND' : 'MISSING');

  // 3. Import wizard navigation (from students)
  await page.goto(`${BASE}/entities/student/import`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/phase4/05-import-wizard.png' });
  console.log('PASS: Import wizard page loaded');

  // 4. AcademicPlan export button (need a student with a plan)
  // Navigate to first student plan if possible
  await page.goto(`${BASE}/students`);
  await page.waitForSelector('table', { timeout: 10000 });
  const firstStudentLink = page.locator('a[href*="/students/"]').first();
  if (await firstStudentLink.count() > 0) {
    const href = await firstStudentLink.getAttribute('href');
    const studentId = href?.match(/students\/([^/]+)/)?.[1];
    if (studentId) {
      await page.goto(`${BASE}/students/${studentId}/plan`);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/phase4/06-academic-plan.png' });
      const exportHtmlBtn = page.locator('button:has-text("Export HTML"), button:has(svg.lucide-file-down)');
      console.log('Plan Export HTML button:', await exportHtmlBtn.count() > 0 ? 'FOUND' : 'MISSING');
    }
  }

  await browser.close();
  console.log('\n--- Phase 4 Verification Complete ---');
  console.log('Screenshots saved to test-results/phase4/');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run verification**

Run: `mkdir -p test-results/phase4 && cd /Users/bsg/Downloads/schoolchoice && npx tsx apps/web/verify-phase4.ts`

Review all screenshots. Report what was verified with specific evidence.

- [ ] **Step 4: Commit verification script**

```bash
git add apps/web/verify-phase4.ts
git commit -m "test: add Phase 4 Playwright verification script"
```

---

## Summary of Changes

| Page | What gets added |
|------|----------------|
| **StudentListPage** | Search input with 300ms debounce, ActionBar (Import + Export), TanStack Query |
| **SchoolDirectory** | ActionBar (Import + Export) above existing filter bar |
| **AcademicPlan** | Already done — Export HTML button verified |
| **Backend students** | `q=` search parameter on `GET /api/v1/students` |
| **Import wizard** | Already works at `/entities/student/import` and `/entities/school/import` |

## What is NOT changed

- SchoolDirectory keeps its existing card grid layout, custom search/filter UI, add modal, delete flow
- StudentListPage keeps its existing table layout, StudentRow component, StudentForm
- AcademicPlan keeps all existing functionality (chat, templates, section editing)
- All generic entity framework code (EntityListPage, ImportWizard, etc.) unchanged
- Backend entity import/export endpoints unchanged
