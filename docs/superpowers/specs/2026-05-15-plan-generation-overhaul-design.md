# Plan Generation Overhaul — Design Spec

## Goal

Transform plan generation from raw streaming text to a polished, programme-specific advisory document with real deadlines, radar chart benchmarking, inline editing, and PDF export.

## Architecture

Five areas: generation UX (progress screen), export (PDF), deadline data model, prompt quality overhaul, and plan display redesign. Backend changes to YAML prompt, new DB column, new PDF endpoint. Frontend changes to ConsultantTask, plan viewer, and admin settings.

## Tech Stack

Existing: React, Recharts, FastAPI, SQLAlchemy, LiteLLM, Jinja2 YAML prompts.
New: weasyprint (PDF generation), RadarChart from Recharts.

---

## 1. Plan Generation Loading Experience

### Current
Raw HTML tokens stream into the page via SSE as they arrive from the LLM.

### New
Four-stage progress screen replaces `SSEStreamDisplay` during generation:

1. "Analyzing grades..." (0-3s)
2. "Matching programmes..." (3-8s)
3. "Generating insights..." (8-20s)
4. "Formatting plan..." (20s-done)

SSE stream runs silently behind the progress screen. Each stage auto-advances on a timer. When the SSE `done` event fires, jump to 100% and reveal the finished plan. If SSE takes longer than expected, stage 4 holds with a spinner until done.

### Files
- Modify: `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx` — replace SSEStreamDisplay with PlanProgress component
- Create: `apps/web/src/components/PlanProgress/PlanProgress.jsx` — four-stage progress UI

---

## 2. Plan Export (PDF) + History Fix

### PDF Export
- New backend endpoint: `GET /api/v1/students/{id}/plan/export-pdf`
- Uses `weasyprint` to render plan HTML to PDF
- Returns PDF blob with `Content-Type: application/pdf`
- Frontend: "Export PDF" button in plan toolbar, downloads blob

### Plan History Export
- New endpoint: `GET /api/v1/students/{id}/plans/history/{plan_id}/export-pdf`
- Each saved plan version in Plans tab gets a PDF download icon

### History Count Fix
- The analytics `plan-history` endpoint queries `PlanGenerationJob` with `status='DONE'`
- Trace and fix: may be timezone issue or org filter excluding valid records

### Files
- Modify: `backend/app/api/v1/routes/plan.py` — add PDF export endpoints
- Modify: `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx` — add Export PDF button
- Modify: `apps/web/src/pages/StudentProfile/PlansTab.jsx` — add per-version PDF download
- Add: `weasyprint` to backend requirements

---

## 3. Programme Deadlines Data Model

### JUPAS Cycle Milestones
Hardcoded constants in new file:

**File:** `backend/app/modules/school_choice/data/jupas_calendar.py`

```python
JUPAS_MILESTONES = [
    {"label": "Band A submission", "month": "December", "day_range": "1-8"},
    {"label": "Band A/B/C revision", "month": "May", "day_range": "20-25"},
    {"label": "Main round results", "month": "August", "day_range": "10-12"},
    {"label": "HKDSE exam period", "month": "April-May", "day_range": None},
]
```

Updated manually each cycle.

### Per-Programme Deadlines
New nullable JSON column `deadlines` on `JupasProgramme`:

```json
{
  "application": "2026-12-08",
  "interview": "2026-01-15",
  "portfolio": "2026-02-01",
  "audition": null
}
```

Most programmes null (use JUPAS defaults). Editable via admin UI or CSV import.

### API
- `GET /api/v1/jupas/{code}/deadlines` — returns merged JUPAS milestones + programme-specific overrides
- Migration adds `deadlines` column to `jupas_programmes` table

### Files
- Create: `backend/app/modules/school_choice/data/jupas_calendar.py`
- Modify: `backend/app/modules/school_choice/models/models.py` — add `deadlines` column to JupasProgramme
- Modify: `backend/app/api/v1/routes/jupas_search.py` — add deadlines endpoint
- Migration: add column

---

## 4. Plan Content Quality (Prompt Overhaul)

### Plan Detail Level Setting
New org-level setting `plan_detail_level` in `Organisation.metadata_`:
- `'A'` (default): rank 1-3 only (Band A)
- `'B'`: rank 1-6 (Band A+B)
- `'C'`: rank 1-10 (Band A+B+C)

Admin configurable via Settings tab (alongside submission rate limit). The matchmaker results passed to the prompt are filtered to only include programmes within the selected bands.

### Prompt Changes in `academic_plan.yaml`

**Data injected per programme (new fields):**
- `jupas_code` — already in matchmaker results
- `programme_name` — already in matchmaker results as `major_name`
- `non_grade_requirements` — interview/portfolio/audition/aptitude_test flags
- `deadlines` — from new JupasProgramme.deadlines column + JUPAS milestones

**New prompt instructions:**

1. **Programme identity**: "Always reference the programme name and JUPAS code (e.g., 'JS6456 — HKU Medicine'), not just the university name."

2. **Programme uniqueness**: "For each recommended programme, explain what makes it distinct from the others on this list — different career pathways, teaching approach, or admission emphasis. Do NOT repeat the same rationale across programmes."

3. **Special requirements**: "If a programme requires an interview, portfolio, or audition, include specific preparation actions with the programme's deadline. For interview programmes, suggest mock interview practice. For portfolio programmes, suggest portfolio review timeline."

4. **Deadline-aware action plan**: "Action items must reference real dates from the deadlines provided. Work backward from each deadline to suggest when preparation should start. Include JUPAS milestone dates."

5. **Band filtering**: TaskEngine filters matchmaker results by `plan_detail_level` before injecting into prompt. Only programmes within the selected bands are sent.

### Files
- Modify: `backend/app/modules/school_choice/tasks/academic_plan.yaml` — prompt text + data slots
- Modify: `backend/app/platform/task_engine.py` — inject deadlines, non_grade_requirements, filter by detail level
- Modify: `backend/app/api/v1/routes/admin.py` — add plan_detail_level GET/PUT endpoints
- Modify: `apps/web/src/pages/AdminManage/AdminManage.jsx` — add detail level selector in Settings
- Modify: `apps/web/src/api/admin.js` — add API functions

---

## 5. Plan Display Redesign

### Radar Chart (Academic Strengths)
Replace text/table academic profile with Recharts `<RadarChart>`:

- **Student polygon** (blue fill): actual DSE grades per subject, 0-7 scale
- **Benchmark polygon** (red outline): rank 1 programme's admission median per subject from `admission_stats`
- Axes: one per subject in student's best-5 plus any subjects required by rank 1 programme
- Labels: subject codes (MATH, PHYS, CHEM, etc.)

Data source: `grades_by_code` from student data + `admission_stats` from rank 1 target's JupasProgramme record. Rendered client-side in the plan viewer, not baked into HTML.

### Programme Cards with JUPAS Code
Each school section header: `JS6456 — The University of Hong Kong — Medicine`
- JUPAS code in monospace bordered badge (same style as Programme Choices table)
- Programme name after university name

### Inline Editing for All Text Fields
Every text section (student_summary, each rationale, each action_item) gets:
- Pencil icon on hover
- Click → `<textarea>` with save/cancel
- Uses existing `editPlanSection` API
- Wire `PlanSectionEditor` to all text blocks

### General Deadline Badge
Top-right of plan page: next upcoming JUPAS milestone with countdown.
e.g., "Band A deadline: Dec 8, 2026 — 207 days"
Calculated from `jupas_calendar.py` relative to today.

### Per-Programme Deadline Tags
On each programme card, if programme has special deadlines:
- "Interview: Jan 15" badge (orange)
- "Portfolio: Feb 1" badge (purple)
Sourced from `JupasProgramme.deadlines`.

### Files
- Create: `apps/web/src/components/PlanRadarChart/PlanRadarChart.jsx` — radar chart component
- Modify: `apps/web/src/pages/ConsultantTask/ConsultantTask.jsx` — plan display sections
- Modify: `apps/web/src/components/PlanWorkspace/planStyles.js` — new styles for deadline badges, programme headers
- Modify: `backend/app/modules/school_choice/services/plan_generator.py` — HTML rendering with JUPAS codes, deadline badges

---

## Non-goals

- Chinese programme name translations (official JUPAS names are English)
- Non-JUPAS plan generation (self-financing programmes use different workflow)
- AI chat overhaul (existing chat edit works, not in scope)
- Multiple LLM provider comparison
