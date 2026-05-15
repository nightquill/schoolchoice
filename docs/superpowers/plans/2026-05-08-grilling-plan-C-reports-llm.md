# Grilling Plan C: Reports, Export & LLM Reporter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close gaps from grilling decisions #14, #15, #19, #21 — print/PDF export, cohort reports with risk heatmaps, annual data refresh workflow, and LLM reporter persona.

**Architecture:** Print CSS added to plan templates. PDF generation via browser print (no server-side PDF library — browser print-to-PDF is the accepted path per Decision D-13). Cohort reports as new analytics endpoints + frontend page. Annual refresh extends existing AdminDataRefresh. LLM reporter adds system prompt configuration.

**Tech Stack:** FastAPI, SQLAlchemy, React, @tanstack/react-query, CSS @media print

**Depends on:** Plan A (schema changes) must be committed first.

---

### Task 1: Print-robust CSS for plan templates (Decision #14)

**Files:**
- Modify: `backend/app/modules/school_choice/services/plan_generator.py`

- [ ] **Step 1: Read existing plan generator**

Read: `backend/app/modules/school_choice/services/plan_generator.py` — find the HTML template generation section.

- [ ] **Step 2: Add print CSS to generated HTML plans**

In the plan HTML template (the `generate_html_plan` function), add a `<style>` block with `@media print` rules inside the `<head>`:

```css
@media print {
  body { margin: 0; padding: 0; font-size: 11pt; }
  .no-print, nav, .chat-panel { display: none !important; }
  table { page-break-inside: avoid; }
  h2, h3 { page-break-after: avoid; }
  .school-card { page-break-inside: avoid; }
  @page { margin: 1.5cm; }
  a { text-decoration: none; color: inherit; }
  .score-badge { border: 1px solid #333; }
}
```

This ensures that `window.print()` from AcademicPlan.jsx produces clean output.

- [ ] **Step 3: Verify plan generation still works**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_v2_plan.py -x -v -k "not template" 2>&1 | tail -5`
Expected: Tests pass (template tests may fail for pre-existing reasons)

- [ ] **Step 4: Commit**

```bash
git add backend/app/modules/school_choice/services/plan_generator.py
git commit -m "feat: add @media print CSS to plan HTML templates (Decision #14)"
```

---

### Task 2: Cohort reports — risk breakdown + target distribution (Decision #15)

**Files:**
- Create: `backend/app/api/v1/routes/reports.py`
- Modify: `backend/app/main.py`
- Create: `apps/web/src/pages/CohortReport/CohortReport.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/pages/CohortDetail/CohortDetail.jsx` (add report link)
- Test: `backend/tests/test_reports.py`

- [ ] **Step 1: Create reports endpoint**

Create `backend/app/api/v1/routes/reports.py`:

```python
"""
Cohort report endpoints (Decision #15).

Provides aggregate analytics per cohort:
- Target school distribution
- Risk breakdown by class
- Subject performance summary
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import Student, User
from app.db.session import get_db
from app.modules.school_choice.models.models import (
    CohortMembership,
    School,
    StudentCohort,
    StudentSchoolTarget,
    StudentSubjectGrade,
    Subject,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _verify_cohort_access(db: Session, cohort_id: UUID, user: User) -> StudentCohort:
    org_id = getattr(user, "active_organisation_id", None)
    query = db.query(StudentCohort).filter(StudentCohort.id == cohort_id)
    if org_id:
        query = query.filter(StudentCohort.organisation_id == org_id)
    else:
        query = query.filter(StudentCohort.user_id == user.id)
    cohort = query.first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    return cohort


@router.get("/cohort/{cohort_id}/target-distribution")
def cohort_target_distribution(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Target school distribution across cohort members."""
    cohort = _verify_cohort_access(db, cohort_id, current_user)
    member_ids = [
        m.student_id for m in
        db.query(CohortMembership.student_id).filter(CohortMembership.cohort_id == cohort_id).all()
    ]
    if not member_ids:
        return {"cohort_name": cohort.name, "distribution": []}

    rows = (
        db.query(
            School.name,
            func.count(StudentSchoolTarget.id).label("count"),
            func.avg(StudentSchoolTarget.match_score).label("avg_score"),
        )
        .join(StudentSchoolTarget, StudentSchoolTarget.school_id == School.id)
        .filter(StudentSchoolTarget.student_id.in_(member_ids))
        .group_by(School.name)
        .order_by(func.count(StudentSchoolTarget.id).desc())
        .all()
    )
    return {
        "cohort_name": cohort.name,
        "distribution": [
            {"school": r.name, "count": r.count, "avg_score": round(float(r.avg_score or 0), 3)}
            for r in rows
        ],
    }


@router.get("/cohort/{cohort_id}/risk-breakdown")
def cohort_risk_breakdown(
    cohort_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Risk breakdown by class within a cohort."""
    cohort = _verify_cohort_access(db, cohort_id, current_user)
    member_ids = [
        m.student_id for m in
        db.query(CohortMembership.student_id).filter(CohortMembership.cohort_id == cohort_id).all()
    ]
    if not member_ids:
        return {"cohort_name": cohort.name, "breakdown": []}

    rows = (
        db.query(
            Student.class_name,
            func.count(Student.id).label("total"),
            func.sum(
                func.cast(
                    db.query(func.count(StudentSchoolTarget.id))
                    .filter(
                        StudentSchoolTarget.student_id == Student.id,
                        StudentSchoolTarget.at_risk.is_(True),
                    )
                    .correlate(Student)
                    .as_scalar() > 0,
                    type_=func.cast(True, type_=None).__class__,
                )
            ).label("at_risk_count"),
        )
        .filter(Student.id.in_(member_ids))
        .group_by(Student.class_name)
        .all()
    )

    # Simpler approach: query all students with at_risk targets
    at_risk_student_ids = set(
        r[0] for r in
        db.query(StudentSchoolTarget.student_id)
        .filter(
            StudentSchoolTarget.student_id.in_(member_ids),
            StudentSchoolTarget.at_risk.is_(True),
        )
        .distinct()
        .all()
    )

    # Group students by class
    students = db.query(Student).filter(Student.id.in_(member_ids)).all()
    class_map = {}
    for s in students:
        cls = s.class_name or "Unassigned"
        if cls not in class_map:
            class_map[cls] = {"total": 0, "at_risk": 0}
        class_map[cls]["total"] += 1
        if s.id in at_risk_student_ids:
            class_map[cls]["at_risk"] += 1

    return {
        "cohort_name": cohort.name,
        "breakdown": [
            {
                "class_name": cls,
                "total_students": data["total"],
                "at_risk_students": data["at_risk"],
                "risk_pct": round(data["at_risk"] / data["total"] * 100, 1) if data["total"] > 0 else 0,
            }
            for cls, data in sorted(class_map.items())
        ],
    }


@router.get("/cohort/{cohort_id}/subject-performance")
def cohort_subject_performance(
    cohort_id: UUID,
    sitting: str = "MOCK",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subject performance heatmap data for cohort."""
    cohort = _verify_cohort_access(db, cohort_id, current_user)
    member_ids = [
        m.student_id for m in
        db.query(CohortMembership.student_id).filter(CohortMembership.cohort_id == cohort_id).all()
    ]
    if not member_ids:
        return {"cohort_name": cohort.name, "subjects": []}

    from app.modules.school_choice.services.hkdse_service import grade_to_int

    rows = (
        db.query(Subject.code, Subject.name, StudentSubjectGrade.raw_grade)
        .join(StudentSubjectGrade, StudentSubjectGrade.subject_id == Subject.id)
        .filter(
            StudentSubjectGrade.student_id.in_(member_ids),
            StudentSubjectGrade.sitting == sitting,
        )
        .all()
    )

    subject_grades = {}
    for code, name, grade in rows:
        if code not in subject_grades:
            subject_grades[code] = {"name": name, "grades": []}
        val = grade_to_int(grade)
        if val is not None:
            subject_grades[code]["grades"].append(val)

    subjects = []
    for code, data in sorted(subject_grades.items()):
        grades = data["grades"]
        if grades:
            subjects.append({
                "code": code,
                "name": data["name"],
                "count": len(grades),
                "mean": round(sum(grades) / len(grades), 2),
                "min": min(grades),
                "max": max(grades),
            })

    return {"cohort_name": cohort.name, "sitting": sitting, "subjects": subjects}
```

- [ ] **Step 2: Register router**

Add to `backend/app/main.py`:
```python
from app.api.v1.routes.reports import router as reports_router
app.include_router(reports_router, prefix="/api/v1")
```

- [ ] **Step 3: Write tests**

Create `backend/tests/test_reports.py`:

```python
"""Tests for cohort report endpoints (Decision #15)."""


def test_target_distribution_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/target-distribution")
    assert resp.status_code == 401


def test_risk_breakdown_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/risk-breakdown")
    assert resp.status_code == 401


def test_subject_performance_unauthenticated(client):
    resp = client.get("/api/v1/reports/cohort/00000000-0000-0000-0000-000000000001/subject-performance")
    assert resp.status_code == 401
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/test_reports.py -x -v`
Expected: 3 passed

- [ ] **Step 5: Commit backend**

```bash
git add backend/app/api/v1/routes/reports.py backend/app/main.py backend/tests/test_reports.py
git commit -m "feat: cohort report endpoints — target distribution, risk breakdown, subject performance (Decision #15)"
```

- [ ] **Step 6: Create CohortReport frontend page**

Create `apps/web/src/pages/CohortReport/CohortReport.jsx` — a page showing three sections (target distribution bar chart, risk breakdown table, subject performance heatmap) using data from the three endpoints above. Use the existing chart patterns from DataAnalysis page.

Add route in App.jsx:
```jsx
<Route path="/cohorts/:cohortId/report" element={<ProtectedRoute><CohortReport /></ProtectedRoute>} />
```

Add "View Report" button in CohortDetail.jsx.

- [ ] **Step 7: Build and commit**

```bash
git add apps/web/src/pages/CohortReport/CohortReport.jsx apps/web/src/App.jsx apps/web/src/pages/CohortDetail/CohortDetail.jsx
git commit -m "feat: cohort report page with risk breakdown and target distribution (Decision #15)"
```

---

### Task 3: Annual data refresh workflow (Decision #19)

**Files:**
- Modify: `backend/app/api/v1/routes/admin.py`
- Modify: `apps/web/src/pages/AdminDataRefresh/AdminDataRefresh.jsx`

- [ ] **Step 1: Read existing admin refresh**

Read: `backend/app/api/v1/routes/admin.py` and `apps/web/src/pages/AdminDataRefresh/AdminDataRefresh.jsx`

- [ ] **Step 2: Add diff preview endpoint**

In `backend/app/api/v1/routes/admin.py`, add a new endpoint:

```python
@router.post("/admin/data-refresh/preview", status_code=200)
def preview_data_refresh(
    file: UploadFile = File(...),
    entity_type: str = Query(..., description="schools | subjects | programmes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Preview diff between uploaded data and existing records before publishing."""
    import csv
    import io

    content = file.file.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    new_rows = list(reader)

    # Get existing data based on entity_type
    if entity_type == "schools":
        existing = {s.name: s for s in db.query(School).all()}
        key_field = "name"
    elif entity_type == "subjects":
        existing = {s.code: s for s in db.query(Subject).all()}
        key_field = "code"
    else:
        return {"error": f"Unknown entity_type: {entity_type}"}

    added = []
    updated = []
    unchanged = 0

    for row in new_rows:
        key = row.get(key_field, "").strip()
        if not key:
            continue
        if key in existing:
            # Check if any field changed
            has_changes = False
            changes = {}
            for col, val in row.items():
                old_val = str(getattr(existing[key], col, "")) if hasattr(existing[key], col) else None
                if old_val is not None and old_val != val:
                    has_changes = True
                    changes[col] = {"old": old_val, "new": val}
            if has_changes:
                updated.append({"key": key, "changes": changes})
            else:
                unchanged += 1
        else:
            added.append({"key": key, "fields": row})

    return {
        "entity_type": entity_type,
        "total_rows": len(new_rows),
        "added": len(added),
        "updated": len(updated),
        "unchanged": unchanged,
        "added_preview": added[:20],
        "updated_preview": updated[:20],
    }
```

- [ ] **Step 3: Update AdminDataRefresh frontend**

Update `apps/web/src/pages/AdminDataRefresh/AdminDataRefresh.jsx` to add:
- File upload for CSV
- Entity type selector (schools | subjects | programmes)
- "Preview Changes" button that calls the preview endpoint
- Diff table showing added/updated/unchanged counts
- "Publish" button that calls the existing `/admin/data-refresh` endpoint

- [ ] **Step 4: Build and commit**

```bash
git add backend/app/api/v1/routes/admin.py apps/web/src/pages/AdminDataRefresh/AdminDataRefresh.jsx
git commit -m "feat: annual data refresh with diff preview and publish (Decision #19)"
```

---

### Task 4: LLM reporter persona and grounding (Decision #21)

**Files:**
- Create: `backend/app/modules/school_choice/prompts/reporter.py`
- Modify: `backend/app/modules/school_choice/services/plan_chat_service.py`

- [ ] **Step 1: Create reporter persona module**

Create `backend/app/modules/school_choice/prompts/__init__.py` (empty).

Create `backend/app/modules/school_choice/prompts/reporter.py`:

```python
"""
LLM Reporter persona configuration (Decision #21).

The LLM acts as a REPORTER presenting data, not an ADVISOR giving recommendations.
All responses must be grounded in actual scored JUPAS data.
"""

REPORTER_SYSTEM_PROMPT = """You are an Academic Data Reporter for a Hong Kong secondary school counselling platform.

## Role
You are a REPORTER, not an advisor. You present data, highlight patterns, and surface relevant facts. You never recommend specific actions or predict outcomes.

## Grounding Rules
1. Every claim must be grounded in the student's actual data (grades, targets, match scores).
2. When discussing university programmes, cite the actual JUPAS code, admission score data, and eligibility status.
3. Never speculate about outcomes. Say "the data shows" not "you should" or "you will".
4. When data is insufficient, say so explicitly: "Insufficient data to assess [X]."
5. Always include the data vintage: when grades were last updated, which sitting (MOCK/TRIAL/OFFICIAL).

## Persona
- Tone: Professional, neutral, factual
- Format: Use structured sections with clear headings
- Numbers: Always show the actual score/grade alongside any qualitative assessment
- Uncertainty: Express confidence levels based on data completeness, not personal judgment

## Output Structure
When generating reports, use this structure:
1. Student Data Summary (grades, subjects, sitting, last updated)
2. Target School Analysis (for each target: eligibility status, match score, key gaps)
3. Data Quality Notes (missing fields, stale data, incomplete profiles)

## Prohibited
- Do not use phrases like "I recommend", "you should", "I suggest", "it would be best"
- Do not make predictions about admissions outcomes
- Do not compare students to each other
- Do not provide emotional encouragement or discouragement
"""


def build_reporter_context(student_data: dict, match_results: list | None = None) -> str:
    """Build grounded context string from actual student data for the reporter."""
    parts = []

    # Student summary
    name = student_data.get("name", "Student")
    parts.append(f"## Student: {name}")

    # Grades
    grades = student_data.get("subject_grades", [])
    if grades:
        parts.append("\n### Current Grades")
        for g in grades:
            sitting = g.get("sitting", "MOCK")
            subject = g.get("subject_name", g.get("subject_code", "Unknown"))
            grade = g.get("raw_grade", "N/A")
            predicted = g.get("predicted_grade", "")
            line = f"- {subject}: {grade} ({sitting})"
            if predicted:
                line += f" [predicted: {predicted}]"
            parts.append(line)

    # Targets
    targets = student_data.get("school_targets", [])
    if targets:
        parts.append("\n### Target Schools")
        for t in targets:
            school = t.get("school_name", "Unknown")
            score = t.get("match_score", "N/A")
            eligible = t.get("eligibility_pass")
            risk = t.get("at_risk", False)
            status_str = "ELIGIBLE" if eligible else "NOT ELIGIBLE" if eligible is False else "UNKNOWN"
            risk_str = " [AT RISK]" if risk else ""
            parts.append(f"- {school}: score={score}, {status_str}{risk_str}")

    # Match results (if provided)
    if match_results:
        parts.append("\n### Match Analysis")
        for m in match_results:
            parts.append(f"- {m.get('school_name', 'Unknown')}: {m.get('rationale', '')}")

    return "\n".join(parts)
```

- [ ] **Step 2: Integrate reporter persona into plan_chat_service**

In `backend/app/modules/school_choice/services/plan_chat_service.py`, modify the system prompt used for chat to use `REPORTER_SYSTEM_PROMPT`:

```python
from app.modules.school_choice.prompts.reporter import REPORTER_SYSTEM_PROMPT

# In the chat function, replace the existing system prompt with:
system_message = REPORTER_SYSTEM_PROMPT
```

- [ ] **Step 3: Run chat tests**

Run: `cd /Users/bsg/Downloads/schoolchoice/backend && python3 -m pytest tests/ -x -v -k "chat" 2>&1 | tail -10`
Expected: Chat tests pass (may skip if AI key not configured)

- [ ] **Step 4: Commit**

```bash
git add backend/app/modules/school_choice/prompts/__init__.py backend/app/modules/school_choice/prompts/reporter.py backend/app/modules/school_choice/services/plan_chat_service.py
git commit -m "feat: LLM reporter persona with grounding rules (Decision #21)"
```

---

## Self-Review

| Decision | Task | Covered? |
|----------|------|----------|
| #14 Print + PDF | Task 1 | YES — @media print CSS in plan templates; browser print-to-PDF is accepted path |
| #15 Cohort reports | Task 2 | YES — 3 endpoints (target dist, risk breakdown, subject perf) + frontend page |
| #19 Annual data refresh | Task 3 | YES — diff preview endpoint + updated admin UI |
| #21 LLM reporter | Task 4 | YES — reporter persona prompt, grounding rules, context builder |
