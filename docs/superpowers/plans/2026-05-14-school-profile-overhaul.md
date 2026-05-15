# School Profile & Programme Detail Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign school profile pages with programme-level drill-down, competitiveness tiers, tiered student matching, and fix the submissions list page.

**Architecture:** Rewrite SchoolProfile as a programme-card list with inline stats. Add a new ProgrammeDetail sub-page at `/schools/:id/programmes/:code` backed by a new API endpoint that scores all org students against a programme. Fix SubmissionList data binding.

**Tech Stack:** React, TanStack Query, FastAPI, existing JUPAS scorer (`score_student_for_programme`)

---

### Task 1: Extend `/jupas/all` to include admission_stats

**Files:**
- Modify: `backend/app/api/v1/routes/jupas_search.py`

- [ ] **Step 1: Add admission_stats to the /jupas/all response**

In `backend/app/api/v1/routes/jupas_search.py`, update the `list_all_programmes` function to include `admission_stats` in each programme dict:

```python
@router.get("/all")
def list_all_programmes(
    db: Session = Depends(get_db),
):
    """Return all JUPAS programmes with school info. Used for client-side filtering."""
    programmes = (
        db.query(JupasProgramme)
        .join(School, JupasProgramme.school_id == School.id)
        .order_by(JupasProgramme.jupas_code)
        .all()
    )
    return {
        "programmes": [
            {
                "jupas_code": p.jupas_code,
                "name": p.name,
                "school_id": str(p.school_id),
                "school_name": p.school.name if p.school else None,
                "faculty": p.faculty,
                "admission_stats": p.admission_stats,
            }
            for p in programmes
        ],
        "schools": sorted(set(p.school.name for p in programmes if p.school)),
    }
```

- [ ] **Step 2: Verify the endpoint returns admission_stats**

```bash
curl -s http://localhost:8000/api/v1/jupas/all | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['programmes'] if x['admission_stats']]; print(f'{len(p)} programmes with admission_stats out of {len(d[\"programmes\"])}')"
```

Expected: A count > 0 showing programmes with admission_stats.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/routes/jupas_search.py
git commit -m "feat: include admission_stats in /jupas/all response for competitiveness tiers"
```

---

### Task 2: New backend endpoint — score org students against a programme

**Files:**
- Modify: `backend/app/api/v1/routes/jupas_search.py`

- [ ] **Step 1: Add the GET /jupas/{jupas_code}/students endpoint**

Append to `backend/app/api/v1/routes/jupas_search.py`:

```python
import json as _json
import logging
from app.core.dependencies import get_current_user
from app.db.models import User
from app.modules.school_choice.models.models import Student
from app.services.student_data_builder import build_student_data
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

logger = logging.getLogger(__name__)


@router.get("/{jupas_code}/students")
def get_programme_students(
    jupas_code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Score all org students against a specific JUPAS programme. Teacher/admin only."""
    programme = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == jupas_code).first()
    if not programme:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programme not found")

    org_id = getattr(user, "active_organisation_id", None)
    q = db.query(Student)
    if org_id:
        q = q.filter(Student.organisation_id == org_id)
    students = q.all()

    prog_dict = {
        "jupas_code": programme.jupas_code,
        "name": programme.name,
        "scoring_formula": programme.scoring_formula or {},
        "minimum_requirements": programme.minimum_requirements or {},
        "admission_stats": programme.admission_stats or {},
    }

    # Parse admission_stats for the response
    stats_raw = programme.admission_stats
    if isinstance(stats_raw, str):
        try:
            stats_raw = _json.loads(stats_raw)
        except (ValueError, TypeError):
            stats_raw = {}
    stats_raw = stats_raw or {}
    latest_stats = {}
    if stats_raw:
        latest_key = max(stats_raw.keys())
        latest_stats = stats_raw[latest_key] if isinstance(stats_raw[latest_key], dict) else {}

    # Parse minimum_requirements for the response
    min_reqs = programme.minimum_requirements
    if isinstance(min_reqs, str):
        try:
            min_reqs = _json.loads(min_reqs)
        except (ValueError, TypeError):
            min_reqs = {}
    min_reqs = min_reqs or {}

    scored = []
    for student in students:
        data = build_student_data(student, db)
        grades = data.get("grades_by_code", {})
        if not grades:
            scored.append({
                "student_id": str(student.id),
                "student_name": student.name or "Unnamed",
                "class_name": student.class_name,
                "match_score": None,
                "weighted_score": None,
                "eligible": None,
                "risk_level": None,
            })
            continue
        try:
            result = score_student_for_programme(grades, prog_dict)
            scored.append({
                "student_id": str(student.id),
                "student_name": student.name or "Unnamed",
                "class_name": student.class_name,
                "match_score": result.get("admission_probability"),
                "weighted_score": result.get("weighted_score"),
                "eligible": result.get("eligible", True),
                "risk_level": result.get("risk_level"),
            })
        except Exception:
            logger.warning("Scoring failed for student %s / %s", student.id, jupas_code, exc_info=True)
            scored.append({
                "student_id": str(student.id),
                "student_name": student.name or "Unnamed",
                "class_name": student.class_name,
                "match_score": None,
                "weighted_score": None,
                "eligible": None,
                "risk_level": None,
            })

    # Sort by match_score descending (None last)
    scored.sort(key=lambda s: s["match_score"] if s["match_score"] is not None else -1, reverse=True)

    return {
        "programme": {
            "jupas_code": programme.jupas_code,
            "name": programme.name,
            "faculty": programme.faculty,
            "institution_code": programme.institution_code,
            "admission_stats": latest_stats,
            "minimum_requirements": min_reqs,
        },
        "students": scored,
        "total": len(scored),
    }
```

- [ ] **Step 2: Add new imports at top of file**

Update the imports at the top of `jupas_search.py` — add `import json as _json`, `import logging`, and the new dependencies. The existing imports (`APIRouter, Depends, Query, or_, Session, get_db, JupasProgramme, School`) stay. Add:

```python
import json as _json
import logging
from app.core.dependencies import get_current_user
from app.db.models import User
from app.modules.school_choice.models.models import JupasProgramme, School, Student
from app.services.student_data_builder import build_student_data
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

logger = logging.getLogger(__name__)
```

Note: `Student` is added to the existing `models` import. `JupasProgramme` and `School` are already imported.

- [ ] **Step 3: Verify endpoint works**

```bash
# Login first to get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"verify@test.com","password":"verify123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# Call the new endpoint with a known JUPAS code
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/jupas/JS6456/students | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'Programme: {d[\"programme\"][\"name\"]}');print(f'Students: {d[\"total\"]}');[print(f'  {s[\"student_name\"]}: {s[\"match_score\"]}') for s in d['students'][:5]]"
```

Expected: Programme name, student count, and match scores.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/jupas_search.py
git commit -m "feat: add GET /jupas/{code}/students — score org students against a programme"
```

---

### Task 3: Frontend API functions for new endpoints

**Files:**
- Modify: `apps/web/src/api/jupas.js`

- [ ] **Step 1: Add getProgrammeStudents function**

Update `apps/web/src/api/jupas.js`:

```javascript
import client from '@schoolchoice/ui/api/client';

export const searchJupas = (q) => client.get('/api/v1/jupas/search', { params: { q, limit: 20 } });
export const getAllProgrammes = () => client.get('/api/v1/jupas/all').then(r => r.data);
export const getProgrammeStudents = (jupasCode) => client.get(`/api/v1/jupas/${jupasCode}/students`).then(r => r.data);
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/api/jupas.js
git commit -m "feat: add getProgrammeStudents API function"
```

---

### Task 4: Competitiveness tier utility

**Files:**
- Create: `apps/web/src/utils/competitiveness.js`

- [ ] **Step 1: Create the utility**

```javascript
/**
 * Derive competitiveness tier from JUPAS programme admission_stats.
 * Uses latest-year median score to classify.
 *
 * Thresholds (HKDSE best-5, max ~35):
 *   Very Competitive: median >= 28
 *   Competitive:      median 24-27.9
 *   Moderate:         median 20-23.9
 *   Accessible:       median < 20 or no data
 */

const TIERS = [
  { id: 'very_competitive', label: 'Very Competitive', min: 28, bg: '#fef2f2', color: '#dc2626' },
  { id: 'competitive',      label: 'Competitive',      min: 24, bg: '#fef3c7', color: '#92400e' },
  { id: 'moderate',          label: 'Moderate',          min: 20, bg: '#d1fae5', color: '#065f46' },
  { id: 'accessible',       label: 'Accessible',       min: 0,  bg: '#eff6ff', color: '#1e40af' },
];

export function getCompetitivenessTier(admissionStats) {
  if (!admissionStats || typeof admissionStats !== 'object') {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  // Parse if string
  let stats = admissionStats;
  if (typeof stats === 'string') {
    try { stats = JSON.parse(stats); } catch { return { ...TIERS[3], median: null, uq: null, lq: null }; }
  }

  const years = Object.keys(stats).sort();
  if (years.length === 0) {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  const latest = stats[years[years.length - 1]];
  if (!latest || typeof latest !== 'object') {
    return { ...TIERS[3], median: null, uq: null, lq: null };
  }

  const median = latest.median != null ? Number(latest.median) : null;
  const uq = latest.upper_quartile != null ? Number(latest.upper_quartile) : null;
  const lq = latest.lower_quartile != null ? Number(latest.lower_quartile) : null;

  if (median == null) {
    return { ...TIERS[3], median, uq, lq };
  }

  const tier = TIERS.find(t => median >= t.min) || TIERS[3];
  return { ...tier, median, uq, lq };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/utils/competitiveness.js
git commit -m "feat: add competitiveness tier utility for JUPAS programmes"
```

---

### Task 5: Rewrite SchoolProfile page

**Files:**
- Modify: `apps/web/src/pages/SchoolProfile/SchoolProfile.jsx`

- [ ] **Step 1: Rewrite SchoolProfile with programme card list**

Replace the entire contents of `apps/web/src/pages/SchoolProfile/SchoolProfile.jsx` with the new layout. Key structure:

- Hero: school name, ZH name, type badge, location, website, 3 stat cards (acceptance rate, avg score, programme count)
- Programme list: search + faculty filter, clickable programme cards with JUPAS code, name, faculty, median, competitiveness badge
- Each card links to `/schools/${id}/programmes/${jupasCode}`
- Programmes fetched from `/jupas/all` filtered by `school_id` matching the current school
- Uses `getCompetitivenessTier()` for tier badges
- Uses `useQuery` for both school data and programmes
- NavBarV2 at top, back link to `/schools`

The component should:
1. Fetch school via `getSchoolV2(id)` (existing)
2. Fetch all programmes via `getAllProgrammes()` (existing, cached)
3. Filter programmes where `programme.school_id === id`
4. Extract unique faculties for the filter dropdown
5. Apply search (name/code) and faculty filters client-side
6. Render each programme as a card row with competitiveness tier

- [ ] **Step 2: Verify the page loads**

Navigate to `http://localhost:5173/schools/{any-school-id}` — should show the new layout with programme cards.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/SchoolProfile/SchoolProfile.jsx
git commit -m "feat: rewrite SchoolProfile with programme card list and competitiveness tiers"
```

---

### Task 6: New ProgrammeDetail page

**Files:**
- Create: `apps/web/src/pages/ProgrammeDetail/ProgrammeDetail.jsx`
- Modify: `apps/web/src/App.jsx` (add route)

- [ ] **Step 1: Create ProgrammeDetail component**

Create `apps/web/src/pages/ProgrammeDetail/ProgrammeDetail.jsx` with:

- Route params: `schoolId` and `code` (JUPAS code)
- Fetches `getProgrammeStudents(code)` via useQuery
- Header: breadcrumb back to school, JUPAS code badge, competitiveness tier, programme name, faculty
- Stats row: 4 cards (median, UQ, LQ, min requirement from `programme.minimum_requirements.general`)
- Requirements card: general requirement, required subjects (red badges), preferred subjects (blue badges) — parsed from `programme.minimum_requirements`
- Tiered student table:
  - Strong (≥75%): green header, expanded
  - Possible (50-74%): amber header, expanded
  - Stretch (<50%): gray header, collapsed by default (toggle to expand)
- Each student row: name (link to `/students/${id}/profile`), class, match % (color-coded), weighted score, eligibility badge
- Students with `match_score === null` grouped into a "No Grade Data" section at bottom

- [ ] **Step 2: Add route to App.jsx**

In `apps/web/src/App.jsx`, add import and route:

```javascript
import ProgrammeDetail from './pages/ProgrammeDetail/ProgrammeDetail';
```

Add route after the `/schools/:id` route:

```jsx
<Route path="/schools/:schoolId/programmes/:code" element={<ProtectedRoute><ProgrammeDetail /></ProtectedRoute>} />
```

- [ ] **Step 3: Verify the page loads**

Navigate via the SchoolProfile page — click a programme card. Should load the sub-page with stats, requirements, and student tiers.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProgrammeDetail/ProgrammeDetail.jsx apps/web/src/App.jsx
git commit -m "feat: add ProgrammeDetail sub-page with tiered student matching"
```

---

### Task 7: Fix SubmissionList data binding

**Files:**
- Modify: `apps/web/src/pages/Submissions/SubmissionList.jsx`

- [ ] **Step 1: Fix the submissions variable**

In `apps/web/src/pages/Submissions/SubmissionList.jsx`, line 16 currently reads:

```javascript
const submissions = submissionsQuery.data ?? [];
```

The API returns `{ submissions: [...], total: N }`, so this assigns the wrapper object, not the array. Fix to:

```javascript
const submissions = submissionsQuery.data?.submissions ?? [];
```

- [ ] **Step 2: Verify the page shows pending submissions with working review links**

Navigate to `http://localhost:5173/submissions`. Should show a table with student names, classes, choice counts, dates, and clickable "Review" links that navigate to `/submissions/{id}`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Submissions/SubmissionList.jsx
git commit -m "fix: SubmissionList reads submissions array from API response wrapper"
```

---

### Task 8: Playwright verification

**Files:**
- Create: `apps/web/verify-school-profile.ts`

- [ ] **Step 1: Write Playwright verification script**

Create `apps/web/verify-school-profile.ts` that:
1. Logs in as verify@test.com / verify123
2. Navigates to `/schools` directory
3. Clicks the first school
4. Verifies: hero section with stats, programme cards with competitiveness badges, search/filter
5. Clicks a programme card
6. Verifies: programme sub-page loads with stats row, requirements, tiered student table
7. Verifies: student names link to profiles
8. Navigates to `/submissions`
9. Verifies: pending submissions table renders with Review links
10. Clicks Review link, verifies submission detail loads
11. Takes screenshots at each step

- [ ] **Step 2: Run verification**

```bash
cd /Users/bsg/Downloads/schoolchoice && npx tsx apps/web/verify-school-profile.ts
```

- [ ] **Step 3: View screenshots and confirm all checks pass**

- [ ] **Step 4: Commit verification script**

```bash
git add apps/web/verify-school-profile.ts
git commit -m "test: add Playwright verification for school profile overhaul"
```
