# Student Features Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add school directory for students, programme website links, hypothetical grade builds with live scoring, and plan release from counselor to student.

**Architecture:** 7 tasks: DB migrations (new table + columns), backend endpoints (grade builds CRUD + scoring, plan release, programme URLs), frontend pages (student plan view, grade build UI), nav wiring. Each task independently testable.

**Tech Stack:** Python/FastAPI, SQLAlchemy, React, TanStack Query, existing JUPAS scorer.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/modules/school_choice/models/grade_builds.py` | Create | GradeBuild ORM model |
| `backend/app/modules/school_choice/models/models.py` | Modify | Add `released_at`, `release_note` to AcademicPlan; add `website_url` to JupasProgramme |
| `backend/app/api/v1/routes/grade_builds.py` | Create | Grade builds CRUD + live scoring endpoint |
| `backend/app/api/v1/routes/plan_release.py` | Create | Plan release endpoint |
| `backend/app/api/v1/routes/student_portal.py` | Modify | Add student plan view + grade builds access |
| `backend/app/api/v1/routes/jupas_search.py` | Modify | Add website_url to /all response |
| `backend/app/main.py` | Modify | Register new routers |
| `apps/web/src/api/gradeBuilds.js` | Create | Frontend API client for grade builds |
| `apps/web/src/api/plan.js` | Modify | Add plan release + student plan view APIs |
| `apps/web/src/pages/StudentPlan/StudentPlan.jsx` | Create | Student read-only plan page |
| `apps/web/src/pages/StudentProfile/GradesTab.jsx` | Modify | Grade build selector + editable build + live scores |
| `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx` | Modify | Build selector for scoring |
| `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx` | Modify | Release to Student button + modal |
| `apps/web/src/components/NavBarV2/NavBarV2.jsx` | Modify | Student nav: School Directory + My Plan |
| `apps/web/src/App.jsx` | Modify | Add /my-plan route |
| `packages/ui/src/i18n/en.json` | Modify | New i18n keys |
| `packages/ui/src/i18n/zh-HK.json` | Modify | Chinese translations |

---

### Task 1: DB Migrations (Models)

**Files:**
- Create: `backend/app/modules/school_choice/models/grade_builds.py`
- Modify: `backend/app/modules/school_choice/models/models.py`

- [ ] **Step 1: Create GradeBuild model**

Create `backend/app/modules/school_choice/models/grade_builds.py`:

```python
"""Grade builds — hypothetical grade sets for what-if analysis."""
from __future__ import annotations
import uuid
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.models import Base, UUID, _utcnow

class GradeBuild(Base):
    __tablename__ = "grade_builds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    grades = Column(JSON, nullable=False, server_default="'{}'")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)
```

- [ ] **Step 2: Add columns to AcademicPlan and JupasProgramme**

In `models.py`, add to the AcademicPlan class (after `chat_request_counts`):

```python
    released_at = Column(TIMESTAMP(timezone=True), nullable=True, comment="When plan was released to student")
    release_note = Column(Text, nullable=True, comment="Counselor note to student on release")
```

Add to JupasProgramme class (after `notes`):

```python
    website_url = Column(String(500), nullable=True, comment="Override URL for programme page")
```

- [ ] **Step 3: Run migration**

```bash
cd backend && python3 -c "
from app.db.session import engine
from app.db.models import Base
# Import new model so it registers
from app.modules.school_choice.models.grade_builds import GradeBuild
Base.metadata.create_all(bind=engine)
print('OK')
"
```

For SQLite (dev), also run ALTER TABLE for existing tables:

```bash
python3 -c "
from app.db.session import engine
from sqlalchemy import text
with engine.connect() as conn:
    try: conn.execute(text('ALTER TABLE academic_plans ADD COLUMN released_at TIMESTAMP'))
    except: pass
    try: conn.execute(text('ALTER TABLE academic_plans ADD COLUMN release_note TEXT'))
    except: pass
    try: conn.execute(text('ALTER TABLE jupas_programmes ADD COLUMN website_url VARCHAR(500)'))
    except: pass
    conn.commit()
print('Columns added')
"
```

- [ ] **Step 4: Import model in main.py**

Add to `backend/app/main.py` imports:

```python
from app.modules.school_choice.models.grade_builds import GradeBuild  # noqa: F401
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/school_choice/models/grade_builds.py backend/app/modules/school_choice/models/models.py backend/app/main.py
git commit -m "feat: grade_builds table + released_at/release_note on AcademicPlan + website_url on JupasProgramme"
```

---

### Task 2: Programme Website URLs

**Files:**
- Modify: `backend/app/api/v1/routes/jupas_search.py`
- Modify: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx`
- Modify: `apps/web/src/pages/SchoolProfile/SchoolProfile.jsx`

- [ ] **Step 1: Add website_url to /all response with URL generation**

In `jupas_search.py`, update the `list_all_programmes` function. Add a helper and include `website_url` in the response:

```python
def _programme_url(prog) -> str:
    """Generate JUPAS programme URL, with override support."""
    if prog.website_url:
        return prog.website_url
    code = prog.institution_code or ""
    jupas = prog.jupas_code or ""
    return f"https://www.jupas.edu.hk/en/programme/{code}/{jupas}/"
```

In the response dict for each programme, add:

```python
"website_url": _programme_url(p),
```

- [ ] **Step 2: Add programme link to ProgrammeChoicesTab result items**

In the programme search results list (inside the add-programme modal), add a small external link icon next to each programme name that opens `prog.website_url` in a new tab.

- [ ] **Step 3: Add programme link to SchoolProfile programme cards**

In SchoolProfile.jsx, for each programme card, add a "Visit" link using the `website_url` field.

- [ ] **Step 4: Build and verify**

```bash
cd apps/web && npx vite build
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/jupas_search.py apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx apps/web/src/pages/SchoolProfile/SchoolProfile.jsx
git commit -m "feat: programme website URLs — JUPAS pattern + override field"
```

---

### Task 3: Grade Builds Backend (CRUD + Live Scoring)

**Files:**
- Create: `backend/app/api/v1/routes/grade_builds.py`
- Modify: `backend/app/api/v1/routes/student_portal.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create grade builds router**

Create `backend/app/api/v1/routes/grade_builds.py`:

```python
"""Grade builds — hypothetical grade sets with live JUPAS scoring."""
from __future__ import annotations
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.grade_builds import GradeBuild
from app.modules.school_choice.models.models import Student, StudentSchoolTarget, JupasProgramme
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

router = APIRouter(prefix="/students/{student_id}/grade-builds", tags=["grade-builds"])


class GradeBuildCreate(BaseModel):
    name: str
    grades: dict[str, str] = {}


class GradeBuildUpdate(BaseModel):
    name: str | None = None
    grades: dict[str, str] | None = None


@router.get("")
def list_builds(student_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    builds = db.query(GradeBuild).filter(GradeBuild.student_id == student_id).order_by(GradeBuild.created_at).all()
    return {"builds": [{"id": str(b.id), "name": b.name, "grades": b.grades, "created_at": b.created_at.isoformat()} for b in builds]}


@router.post("")
def create_build(student_id: UUID, body: GradeBuildCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.query(GradeBuild).filter(GradeBuild.student_id == student_id).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 grade builds per student")
    build = GradeBuild(student_id=student_id, name=body.name, grades=body.grades or {})
    db.add(build)
    db.commit()
    db.refresh(build)
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.put("/{build_id}")
def update_build(student_id: UUID, build_id: UUID, body: GradeBuildUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if body.name is not None:
        build.name = body.name
    if body.grades is not None:
        build.grades = body.grades
    db.commit()
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.delete("/{build_id}")
def delete_build(student_id: UUID, build_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    db.delete(build)
    db.commit()
    return {"deleted": True}


@router.post("/{build_id}/scores")
def score_build(student_id: UUID, build_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Score all student targets against this build's hypothetical grades."""
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student_id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")

    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student_id).all()
    results = []
    for t in targets:
        if not t.jupas_code:
            continue
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == t.jupas_code).first()
        if not prog:
            continue
        prog_dict = {
            "jupas_code": prog.jupas_code,
            "name": prog.name,
            "scoring_formula": prog.scoring_formula or {},
            "minimum_requirements": prog.minimum_requirements or {},
            "admission_stats": prog.admission_stats or {},
        }
        try:
            score = score_student_for_programme(build.grades, prog_dict)
            results.append({
                "jupas_code": prog.jupas_code,
                "programme_name": prog.name,
                "match_score": score.get("admission_probability"),
                "eligible": score.get("eligible"),
                "risk_level": score.get("risk_level"),
            })
        except Exception:
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": None, "eligible": None, "risk_level": None})

    return {"build_id": str(build.id), "build_name": build.name, "scores": results}
```

- [ ] **Step 2: Register router in main.py**

```python
from app.api.v1.routes.grade_builds import router as grade_builds_router
app.include_router(grade_builds_router, prefix="/api/v1")
```

- [ ] **Step 3: Add student portal access for grade builds**

In `student_portal.py`, add endpoints that proxy to the grade builds using the student's own ID:

```python
@router.get("/grade-builds")
def student_list_builds(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    builds = db.query(GradeBuild).filter(GradeBuild.student_id == student.id).order_by(GradeBuild.created_at).all()
    return {"builds": [{"id": str(b.id), "name": b.name, "grades": b.grades} for b in builds]}

@router.post("/grade-builds")
def student_create_build(body: dict, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    count = db.query(GradeBuild).filter(GradeBuild.student_id == student.id).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 grade builds")
    build = GradeBuild(student_id=student.id, name=body.get("name", "Build"), grades=body.get("grades", {}))
    db.add(build)
    db.commit()
    db.refresh(build)
    return {"id": str(build.id), "name": build.name, "grades": build.grades}

@router.put("/grade-builds/{build_id}")
def student_update_build(build_id: UUID, body: dict, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if "name" in body:
        build.name = body["name"]
    if "grades" in body:
        build.grades = body["grades"]
    db.commit()
    return {"id": str(build.id), "name": build.name, "grades": build.grades}

@router.delete("/grade-builds/{build_id}")
def student_delete_build(build_id: UUID, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    db.delete(build)
    db.commit()
    return {"deleted": True}

@router.post("/grade-builds/{build_id}/scores")
def student_score_build(build_id: UUID, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student.id).all()
    results = []
    for t in targets:
        if not t.jupas_code:
            continue
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == t.jupas_code).first()
        if not prog:
            continue
        prog_dict = {"jupas_code": prog.jupas_code, "name": prog.name, "scoring_formula": prog.scoring_formula or {}, "minimum_requirements": prog.minimum_requirements or {}, "admission_stats": prog.admission_stats or {}}
        try:
            score = score_student_for_programme(build.grades, prog_dict)
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": score.get("admission_probability"), "eligible": score.get("eligible")})
        except Exception:
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": None, "eligible": None})
    return {"build_id": str(build.id), "scores": results}
```

- [ ] **Step 4: Verify endpoints**

```bash
curl -s http://localhost:8000/api/v1/students/7478362f-7d67-45d5-9173-f5a4ce9bbe06/grade-builds -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/routes/grade_builds.py backend/app/api/v1/routes/student_portal.py backend/app/main.py
git commit -m "feat: grade builds CRUD + live scoring endpoints"
```

---

### Task 4: Plan Release Backend

**Files:**
- Create: `backend/app/api/v1/routes/plan_release.py`
- Modify: `backend/app/api/v1/routes/student_portal.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create plan release endpoint**

Create `backend/app/api/v1/routes/plan_release.py`:

```python
"""Plan release — counselor releases plan to student."""
from __future__ import annotations
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.models import AcademicPlan

router = APIRouter(prefix="/students/{student_id}/plan", tags=["plan-release"])


class ReleaseRequest(BaseModel):
    note: str = ""


@router.post("/release")
def release_plan(student_id: UUID, body: ReleaseRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student_id).first()
    if not plan or not plan.html_content:
        raise HTTPException(status_code=404, detail="No plan to release")
    plan.released_at = datetime.now(timezone.utc)
    plan.release_note = body.note or None
    db.commit()
    return {"released_at": plan.released_at.isoformat(), "version": plan.version}
```

- [ ] **Step 2: Add student plan view endpoint**

In `student_portal.py`, add:

```python
@router.get("/plan")
def student_get_plan(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.models import AcademicPlan
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student.id).first()
    if not plan or not plan.released_at:
        raise HTTPException(status_code=404, detail="No plan released yet")
    return {
        "html_content": plan.html_content,
        "release_note": plan.release_note,
        "released_at": plan.released_at.isoformat(),
        "version": plan.version,
    }
```

- [ ] **Step 3: Register router**

In `main.py`:

```python
from app.api.v1.routes.plan_release import router as plan_release_router
app.include_router(plan_release_router, prefix="/api/v1")
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/plan_release.py backend/app/api/v1/routes/student_portal.py backend/app/main.py
git commit -m "feat: plan release endpoint + student plan view"
```

---

### Task 5: Frontend — Student Plan Page + Release UI

**Files:**
- Create: `apps/web/src/pages/StudentPlan/StudentPlan.jsx`
- Modify: `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx`
- Modify: `apps/web/src/api/plan.js`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/components/NavBarV2/NavBarV2.jsx`

- [ ] **Step 1: Add API functions**

Append to `apps/web/src/api/plan.js`:

```javascript
export const releasePlan = (studentId, note = '') =>
  post(`/api/v1/students/${studentId}/plan/release`, { note });

export const getStudentPlan = () =>
  get('/api/v1/student/plan');
```

(Import `post` and `get` from `./helpers` if not already imported.)

- [ ] **Step 2: Create StudentPlan page**

Create `apps/web/src/pages/StudentPlan/StudentPlan.jsx`:

```jsx
import { useQuery } from '@tanstack/react-query';
import NavBarV2 from '../../components/NavBarV2/NavBarV2';
import { LoadingSpinner } from '@schoolchoice/ui';
import { EmptyState } from '@schoolchoice/ui';
import { getAccount } from '@schoolchoice/ui/api/account';
import { getStudentPlan } from '../../api/plan';
import { useTranslation } from '@schoolchoice/ui/i18n';

export default function StudentPlan() {
  const { t } = useTranslation();
  const accountQuery = useQuery({ queryKey: ['account'], queryFn: getAccount });
  const planQuery = useQuery({ queryKey: ['student-plan'], queryFn: getStudentPlan });

  return (
    <div style={{ background: 'var(--color-background)', minHeight: '100dvh', fontFamily: 'var(--font-family-base)' }}>
      <NavBarV2 account={accountQuery.data ?? null} />
      <main className="px-4 md:px-8" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: '0 0 var(--space-4) 0' }}>
          {t('studentPlan.title')}
        </h1>

        {planQuery.isLoading && <LoadingSpinner />}

        {planQuery.isError && (
          <EmptyState message={t('studentPlan.notReleased')} />
        )}

        {planQuery.data && (
          <>
            {planQuery.data.release_note && (
              <div style={{
                background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)',
                borderRadius: 'var(--border-radius-md)', padding: 'var(--space-3) var(--space-4)',
                marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-info-text)',
              }}>
                <strong>{t('studentPlan.counselorNote')}:</strong> {planQuery.data.release_note}
              </div>
            )}
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              {t('studentPlan.releasedOn')}: {new Date(planQuery.data.released_at).toLocaleDateString()} · v{planQuery.data.version}
            </div>
            <iframe
              style={{ width: '100%', minHeight: '80vh', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}
              srcDoc={planQuery.data.html_content}
              title="Academic Plan"
              sandbox="allow-same-origin"
            />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Add Release button to ConsultantTask**

In ConsultantTask.jsx, add a "Release to Student" button in the toolbar when plan exists. Add state for release modal:

```javascript
const [showReleaseModal, setShowReleaseModal] = useState(false);
const [releaseNote, setReleaseNote] = useState('');
const [releasing, setReleasing] = useState(false);
```

Add handler:

```javascript
const handleRelease = async () => {
  setReleasing(true);
  try {
    await releasePlan(id, releaseNote);
    toast.success(t('plan.released'));
    setShowReleaseModal(false);
    setReleaseNote('');
  } catch { toast.error(t('plan.releaseFailed')); }
  finally { setReleasing(false); }
};
```

Add button in toolbar + modal with textarea.

- [ ] **Step 4: Add route and nav**

In `App.jsx`, add:
```jsx
import StudentPlan from './pages/StudentPlan/StudentPlan';
// In Routes:
<Route path="/my-plan" element={<ProtectedRoute><StudentPlan /></ProtectedRoute>} />
```

In `NavBarV2.jsx`, add to student section:
```jsx
{isStudent && (
  <Link to="/my-plan" style={getLinkStyle('/my-plan')}>{t('nav.myPlan')}</Link>
)}
{isStudent && (
  <Link to="/schools" style={getLinkStyle('/schools')}>{t('nav.schoolDirectory')}</Link>
)}
```

- [ ] **Step 5: Add i18n keys**

Add to en.json/zh-HK.json:
```json
"studentPlan": {
  "title": "My Academic Plan",
  "notReleased": "Your counselor has not released a plan yet.",
  "counselorNote": "Your counselor's note",
  "releasedOn": "Released"
},
"nav": { "myPlan": "My Plan" },
"plan": { "released": "Plan released to student", "releaseFailed": "Failed to release plan", "releaseToStudent": "Release to Student", "releaseNote": "Add a note for your student...", "rerelease": "Re-release" }
```

zh-HK:
```json
"studentPlan": {
  "title": "我的升學計劃",
  "notReleased": "你的輔導老師尚未發佈計劃。",
  "counselorNote": "輔導老師備註",
  "releasedOn": "發佈日期"
},
"nav": { "myPlan": "我的計劃" },
"plan": { "released": "計劃已發佈給學生", "releaseFailed": "發佈失敗", "releaseToStudent": "發佈給學生", "releaseNote": "為學生添加備註…", "rerelease": "重新發佈" }
```

- [ ] **Step 6: Build and verify**

```bash
cd apps/web && npx vite build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/StudentPlan/ apps/web/src/pages/ConsultantTask/ConsultantTask.jsx apps/web/src/api/plan.js apps/web/src/App.jsx apps/web/src/components/NavBarV2/NavBarV2.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: student plan page + release to student workflow"
```

---

### Task 6: Frontend — Grade Builds UI

**Files:**
- Create: `apps/web/src/api/gradeBuilds.js`
- Modify: `apps/web/src/pages/StudentProfile/GradesTab.jsx`
- Modify: `apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx`

- [ ] **Step 1: Create API client**

Create `apps/web/src/api/gradeBuilds.js`:

```javascript
import { get, post, put, del } from './helpers';

export const getGradeBuilds = (studentId) =>
  get(`/api/v1/students/${studentId}/grade-builds`);

export const createGradeBuild = (studentId, name, grades = {}) =>
  post(`/api/v1/students/${studentId}/grade-builds`, { name, grades });

export const updateGradeBuild = (studentId, buildId, data) =>
  put(`/api/v1/students/${studentId}/grade-builds/${buildId}`, data);

export const deleteGradeBuild = (studentId, buildId) =>
  del(`/api/v1/students/${studentId}/grade-builds/${buildId}`);

export const scoreBuild = (studentId, buildId) =>
  post(`/api/v1/students/${studentId}/grade-builds/${buildId}/scores`);

// Student portal versions
export const getStudentGradeBuilds = () => get('/api/v1/student/grade-builds');
export const createStudentGradeBuild = (name, grades) => post('/api/v1/student/grade-builds', { name, grades });
export const updateStudentGradeBuild = (buildId, data) => put(`/api/v1/student/grade-builds/${buildId}`, data);
export const deleteStudentGradeBuild = (buildId) => del(`/api/v1/student/grade-builds/${buildId}`);
export const scoreStudentBuild = (buildId) => post(`/api/v1/student/grade-builds/${buildId}/scores`);
```

- [ ] **Step 2: Add build selector to GradesTab**

In GradesTab.jsx, add at the top of the component:
- Query for builds: `useQuery(['grade-builds', studentId], () => getGradeBuilds(studentId))`
- State for selected build: `const [activeBuild, setActiveBuild] = useState(null)` (null = actual grades)
- Dropdown selector: "Actual Grades" | build names | "+ New Build"
- When a build is active: render an editable table of the build's grades instead of the actual grades table
- On each grade change: debounced `updateGradeBuild` + `scoreBuild` call
- Live scores panel: small table below showing programme match scores

- [ ] **Step 3: Add build selector to ProgrammeChoicesTab**

In ProgrammeChoicesTab.jsx, add a dropdown at the top:
- "Score using: Actual Grades | Build: [name]"
- When a build is selected, fetch scores via `scoreBuild` and overlay match percentages in the table

- [ ] **Step 4: Add i18n keys**

```json
"gradeBuilds": {
  "actualGrades": "Actual Grades",
  "newBuild": "+ New Build",
  "buildName": "Build name",
  "scoreUsing": "Score using",
  "liveScores": "Live Match Scores",
  "maxBuilds": "Maximum 5 builds reached",
  "deleteBuild": "Delete build"
}
```

zh-HK:
```json
"gradeBuilds": {
  "actualGrades": "實際成績",
  "newBuild": "+ 新組合",
  "buildName": "組合名稱",
  "scoreUsing": "使用成績",
  "liveScores": "即時配對分數",
  "maxBuilds": "已達 5 個組合上限",
  "deleteBuild": "刪除組合"
}
```

- [ ] **Step 5: Build and verify**

```bash
cd apps/web && npx vite build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/gradeBuilds.js apps/web/src/pages/StudentProfile/GradesTab.jsx apps/web/src/pages/StudentProfile/ProgrammeChoicesTab.jsx packages/ui/src/i18n/en.json packages/ui/src/i18n/zh-HK.json
git commit -m "feat: grade builds UI — build selector, editable grades, live scoring"
```

---

### Task 7: Bug Fixes (Post-Design Notes)

**Files:** Various

- [ ] **Step 1: Fix radar chart benchmark — use rank 1 programme admission median with subject weights**

In `plan_generator.py`, the `_section_academic_profile` function currently uses uniform benchmark. Change to look up rank 1 target's admission stats AND the programme's scoring_formula to weight subjects.

- [ ] **Step 2: Fix PDF export button visibility**

In ConsultantTask.jsx, the Export PDF button condition should check `plan?.html_content` not just `hasPlan`:

```javascript
{plan?.html_content && (
  <button onClick={handleExportPDF} ...>
```

- [ ] **Step 3: Fix language toggle visibility**

Move the language toggle button to the toolbar left section (near student name), not buried in the right section.

- [ ] **Step 4: Fix JUPAS code hallucination persistence**

In the consultant save handler, after the school-name matching populates `jupas_code` from DB, add a validation step: if any `jupas_code` in the output doesn't exist in our DB, strip it to null rather than persisting a hallucinated code.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: radar chart weights, PDF visibility, language toggle, JUPAS validation"
```

---

## Self-Review

**Spec coverage:**
1. ✅ School directory for students — Task 2 (URLs) + Task 5 (nav link)
2. ✅ Programme website links — Task 2
3. ✅ Grade builds (up to 5 named) — Task 3 (backend) + Task 6 (frontend)
4. ✅ Live scoring — Task 3 (/scores endpoint) + Task 6 (debounced UI)
5. ✅ Plan release — Task 4 (backend) + Task 5 (frontend)
6. ✅ Student plan view — Task 5
7. ✅ Student nav wiring — Task 5
8. ✅ Bug fixes — Task 7

**Placeholder scan:** No TBDs. Task 6 step 2 is higher-level than other tasks (GradesTab is complex) but the API client and patterns are fully specified.

**Type consistency:** `GradeBuild.grades` is `dict[str, str]` consistently. `scoreBuild` returns `{scores: [{jupas_code, programme_name, match_score, eligible}]}` used by both backend and frontend.
