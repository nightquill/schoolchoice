# Ship-Ready Design Spec

**Date:** 2026-04-29
**Target:** Pilot with real counselors
**Approach:** Outside-In (Plan Report → UI Skin → Components → Backend)

---

## 0. Product Philosophy

The plan is NOT an algorithmic recommendation telling the student what they should do. Psychologically, the student and parents have already decided where they want to go. The counselor has already set their target schools and majors in the app.

**The plan is an action document: "Here is what you need to do to get where you want to go."**

It serves two audiences differently:

**For the student/parent (the default view):**
- Validates their choices — never rules out their preferred schools
- Frames everything as actionable: "To strengthen your application for HKUST Engineering, focus on..."
- No match percentages, no fit scores, no anxiety-inducing numbers
- Tone: encouraging, specific, forward-looking
- The value is the roadmap — month-by-month steps to maximize their chances

**For the counselor (toggle-on internal view):**
- Match percentages, data completeness, competitive positioning
- Honest assessment of chances — "stretch", "match", "safety"
- This data helps the counselor guide the conversation but is NOT shown to the student by default

**Key design rules:**
1. Target schools come from the counselor's `StudentSchoolTarget` records, not from algorithmic ranking
2. If no targets are set, fall back to top matches from the engine — but frame as "schools worth considering" not "our algorithm says"
3. Rationale must support the student's goals, not challenge them. "Your MATH 5** gives you a strong foundation for this programme" not "67% match — moderate fit"
4. The plan creates value for the counselor by prompting specific actions: "Write a personal statement paragraph about your robotics experience for HKUST"
5. Match scores are internal/counselor-only data, hidden by default, toggled via a "Show counselor metrics" switch in the plan UI

### Preference Confidence Slider

Each target school has a **confidence score** (1-5) set by the counselor, indicating how committed the student is to that choice:

- **5 — Decided:** Student is set on this school/major. Plan fully supports their choice — rationale builds the case, actions are specific to strengthening this application. Algorithm's opinion is irrelevant to the student view.
- **4 — Strong preference:** Similar to decided but plan may gently note one area to consider.
- **3 — Interested:** Student likes this option but is open to alternatives. Plan supports it but also mentions what makes this a good/challenging fit.
- **2 — Exploring:** Student is browsing. Plan leans more on data — "based on your grades, here's why this could work" or "here's what you'd need to be competitive."
- **1 — Unsure:** Counselor added this as a suggestion. Plan treats it like an algorithmic recommendation — data-driven rationale, honest positioning.

**How it affects plan generation:**
- High confidence (4-5): AI writes supportive rationale, actions focus on "how to get in." Counselor-only notes may flag risks privately.
- Medium confidence (3): Balanced — supportive but includes practical positioning.
- Low confidence (1-2): More exploratory — AI can surface strengths/gaps more openly, suggest alternatives the algorithm found.

**Implementation:**
- Add `preference_confidence` integer column (1-5, default 3) to `StudentSchoolTarget` model
- Frontend: show a 1-5 slider or star rating next to each target school in the TargetSchools page
- Pass confidence values to the AI prompt alongside each target school
- AI prompt instructions reference the confidence level per school to calibrate tone

---

## 1. Plan Report Redesign

Replace the current `plan_generator.py` HTML output with a Modern Consultant style. The plan is a self-contained HTML document rendered in an iframe.

### Design Language
- **Typography:** Inter / system-ui sans-serif. No serif fonts.
- **Primary accent:** #2563eb (blue)
- **Positive indicators:** #16a34a (green)
- **Warnings:** #d97706 (amber)
- **Gaps/errors:** #dc2626 (red)
- **Background:** #ffffff (white), cards on #f8fafc
- **Border radius:** 8px cards, 20px for percentage pills

### Report Sections (7 total)

**1. Header**
- White background, 3px blue (#2563eb) border-bottom
- "University Application Strategy" as small uppercase label
- Student name large (20px, bold)
- Subtitle: "Prepared {date} · Year {year}"
- No Best-5 score in header (that's counselor-only data)

**2. Student Snapshot**
- Brief encouraging summary: strengths, interests, goals
- Framed positively: "Strong STEM profile with leadership in robotics and mathematics"
- NOT a data dump — a narrative the student would be proud to read

**3. Your Target Schools**
- Sourced from counselor's `StudentSchoolTarget` records (preferred schools/majors)
- If no targets set, fall back to top matches framed as "Schools to Consider"
- Each school is a white card with subtle border:
  - School name + major (bold) | JUPAS code in gray
  - "Why this works for you" — 2-3 sentences citing the student's actual strengths that align with this programme. Always supportive, never discouraging.
  - "What to focus on" — 2-3 specific action items for THIS school (e.g., "Write a paragraph about your Physics lab assistant experience for your personal statement")
- NO percentage badges, NO match scores in default view
- Counselor-only overlay (hidden by default): shows match %, confidence tier, competitive positioning

**4. Academic Profile**
- Clean table: Subject, Grade, Predicted
- Grade cells color-coded: green for 5+, amber for 4, red for below 4
- Framing: "Your Academic Strengths" not "Academic Profile"
- Highlight top grades prominently

**5. Application Roadmap**
- THIS IS THE CORE OF THE PLAN — the primary value
- Month-by-month table spanning the full application cycle
- Columns: Month, What To Do, Priority (color pill), Related School
- Dense with specific actions: "Draft HKUST personal statement paragraph on robotics", "Book IELTS test date", "Request reference from Mr. Wong (Physics)"
- Includes HK-specific milestones: JUPAS open (Sep), choices due (Dec), HKDSE (Mar-May), amendments (May-Jun), offers (Aug)
- At least 10-15 items spanning the entire cycle

**6. Areas to Strengthen**
- Framed as growth opportunities, not gaps
- "Improving your English writing will strengthen applications across all your target schools"
- Specific and actionable, not generic
- Language readiness: IELTS status or recommendation

**7. Appendix**
- Raw grade table (compact, for reference)
- Data sources line
- Counselor-only section (hidden by default): Best-5 aggregate, data completeness %, match scores per school

### Counselor Metrics Toggle
- In the plan UI (ConsultantTask page), add a toggle switch: "Show counselor metrics"
- Default: OFF (student-safe view)
- When ON: overlays match percentages on school cards, shows Best-5 in header, shows appendix data section
- Implementation: all counselor-only data is rendered in the HTML but wrapped in `<div class="counselor-only" style="display:none">`. The toggle adds/removes a CSS class on the parent that shows these elements.
- The iframe communicates with the parent via `postMessage` to toggle the class

### What Gets Removed
- Chart.js radar and bar charts
- SVG Gantt timeline (replaced by month-by-month table)
- Serif fonts
- Dark navy hero header
- "What drives this score" SHAP breakdown section
- Match percentage badges from default student view

### Implementation
- Rewrite `plan_generator.py` section builders (`_section_student_summary`, `_section_recommended_schools`, `_section_action_plan`, etc.)
- Update `generate_html_plan()` to produce new HTML structure
- Remove Chart.js CDN import
- Keep template switching (professional/modern/minimal) — same card-based layout, different color schemes:
  - **Professional:** Primary #2563eb (blue), white background, subtle shadows
  - **Modern:** Primary #0d9488 (teal), #f5f5f5 background, larger spacing
  - **Minimal:** Primary #111827 (near-black), white background, no shadows, 1px borders only
- Consultant save endpoint already routes through `generate_html_plan()` — no routing changes needed

---

## 2. App UI Visual Refresh

Apply the plan report's design language to the app shell. Same pages, same navigation, new skin.

### Design Tokens
- Primary: #2563eb (blue) — matches plan report
- Font: Inter / system-ui sans-serif
- Border radius: 8px cards, 6px buttons, 4px inputs
- Card shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Background: #f8fafc (page), #ffffff (cards)

### Component Unification

**Buttons:**
- Delete `frontend/src/components/Button/Button.jsx` (custom component)
- All buttons become shadcn `<Button>` from `@/components/ui/button`
- Update all imports across every page that uses the custom Button
- Variants: default (blue fill), outline, destructive (red), ghost

**Inputs:**
- Delete `frontend/src/components/TextInput/TextInput.jsx`
- All inputs become shadcn `<Input>` from `@/components/ui/input`
- All `<select>` elements become styled with consistent CSS matching shadcn input style
- Replace raw `<textarea>` with consistent styling

**DOB Fix:**
- Replace the three `<select>` dropdowns in `PersonalTab.jsx` (lines 65-113) with a single `<input type="date">`
- Remove the `rebuildDob` / `dobParts` parsing logic
- Backend already stores as ISO date — native date input handles this correctly
- Delete the day/month/year dropdown generation code

**Toasts:**
- Remove legacy `Toast` component usage
- Standardize all notifications on sonner (`toast.success()`, `toast.error()`)

### Page-by-Page Changes

**Dashboard:**
- Student cards: white card, subtle border, hover shadow transition
- Metric counters: colored metric cards (same style as plan report key metrics row)
- Search input + filter selects: shadcn components replacing raw HTML elements

**StudentProfile:**
- Replace all inline-styled form fields in PersonalTab with shadcn Input/Select
- Fix DOB as described above
- Tab buttons: consistent styling (already using button elements, just update colors to match primary blue)
- "Generate Plan" button: stays, routes to consultant page

**TargetSchools:**
- Match score display: use percentage pill badges (same as plan report school cards)
- Replace custom toggle buttons ("By School" / "By Major") with shadcn button group
- Replace raw search input with shadcn Input
- Arrow icons (↑↓): replace Unicode with lucide-react ChevronUp/ChevronDown icons

**SchoolDirectory / SchoolProfile:**
- Card styling refresh to match new design tokens
- Consistent button variants

**CohortList / CohortDetail:**
- Same card and table styling pass
- Add edit button (see Section 3)

**DataAnalysis:**
- Same styling pass on cards and tables

**AcademicPlan / ConsultantTask:**
- Plan renders in iframe (no change to plan content)
- Update surrounding chrome: header bar, template selector pills, chat panel border/colors to match new primary blue
- Chat panel: clean up styling to match new input/button components

**AccountSettings:**
- Make editable (see Section 3)

### What We're NOT Changing
- Navigation structure (top nav bar stays)
- Page routing
- Tab order in StudentProfile
- Any functionality or data flow

---

## 3. Backend Fixes

### Auth Hardening

**Email enumeration fix:**
- File: `backend/app/services/auth_service.py`
- Change: Both "email not found" and "wrong password" return identical response:
  - Status: 401
  - Body: `{"detail": "Invalid email or password"}`
- Remove the `error_code` parameter from `authenticate_user`

**Rate limiting:**
- Add `slowapi` dependency
- Apply to `POST /auth/login`: 5 requests per IP per minute
- Apply to `POST /auth/register`: 3 requests per IP per minute
- Return 429 with `{"detail": "Too many attempts. Try again in 60 seconds."}`

### Data Validation

Add Pydantic models for JSONB fields. Validate on write, accept existing data on read.

```python
class AwardSchema(BaseModel):
    title: str
    year: Optional[int] = None
    level: Optional[str] = None  # "School" | "Regional" | "Territory" | "National" | "International"

class TeacherEvaluationSchema(BaseModel):
    subject_code: str
    teacher_name: str
    rating: int  # 1-5, validated with ge=1, le=5
    comments: Optional[str] = None

class ExtracurricularSchema(BaseModel):
    activity: str
    role: Optional[str] = None
    years: Optional[str] = None
    description: Optional[str] = None

class LanguageScoreSchema(BaseModel):
    label: str
    score: float  # 0-9, validated with ge=0, le=9
    date: Optional[str] = None
```

Apply validation on:
- `POST /students/{id}/awards`
- `PUT /students/{id}/teacher-evaluations`
- `POST /students/{id}/extracurricular`
- `POST /students/{id}/language-scores`

### Pagination

Add `skip`/`limit` to these list endpoints:
- `GET /students` — currently returns all
- `GET /grades/subjects` — currently returns all (39 subjects, fine for now but add for consistency)
- `GET /admin/users` — currently returns all

Response format: `{"items": [...], "total": N}`

Default limit: 50, max: 100.

Frontend `Dashboard.jsx` and `Settings.jsx` (admin user list) must handle the new paginated response shape.

### Fix Stubs

**Admin data refresh (`POST /admin/data-refresh`):**
- Replace the sleep stub with actual re-execution of seed SQL files
- Reuse `_run_sql_file()` from `main.py` to re-import `seed_schools.sql`
- Only refresh school data (not subjects — those are structural)
- Mark status as "running" → execute → "complete" with timestamp
- Store status in a simple DB table instead of in-memory dict (survives restart)

**Cohort edit:**
- Add `PUT /cohorts/{id}` endpoint accepting `{name, description}`
- Frontend: add edit icon button in `CohortDetail.jsx` header that toggles inline editing of name/description fields
- Save on blur or Enter key

**Account settings:**
- Add `PUT /api/v1/account` endpoint for updating `display_name` and `preferred_language`
- Add `POST /api/v1/account/change-password` accepting `{current_password, new_password}`
- Frontend: make AccountSettings fields editable with Save button
- Add change password form section

**Preference confidence on targets:**
- Add `preference_confidence` column (Integer, default 3, check 1-5) to `StudentSchoolTarget` model
- Add to `PUT /students/{id}/targets/{target_id}` request/response schemas
- Frontend: show 1-5 slider next to each target school in TargetSchools page

---

## 4. Feature Gap Fixes

### AI Prompt Rewrite
The AI prompt (in `academic_plan.yaml`) must be rewritten to match the product philosophy:
- The AI receives the student's **target schools** (from `StudentSchoolTarget` records) as the primary school list, not algorithmic top-N
- If no targets set, fall back to matchmaker top results
- Prompt instructs the AI to:
  - Frame every school positively — "why this works for you" not "how well you match"
  - Never rule out a student's preferred school — instead, identify what they need to strengthen
  - Focus 60% of output on the Application Roadmap (specific monthly actions)
  - Write for a student/parent audience: encouraging, specific, no jargon
  - Generate counselor-only data separately: match assessment, competitive positioning, honest risk flags
- The output schema adds a `counselor_notes` field (object with per-school honest assessment + overall risk summary) that is rendered in the hidden counselor overlay

### Financial Aid in Plan
- Add `financial_aid_flag` to the AI prompt context in `_load_student()` in `task_engine.py`
- If flagged, AI includes scholarship opportunities and financial aid deadlines in the roadmap
- Also update `plan.py` AI enhancement prompt similarly

### Graduated Student Guard
- Frontend: if `student.is_graduated === true`, disable "Generate Plan" button with tooltip "This student has graduated"
- Backend: in consultant stream endpoint, check `student.is_graduated` and return 400 "Cannot generate plan for graduated student"

### Error Handling Cleanup
- Audit all `.catch(() => {})` and `.catch(() => null)` in frontend
- Replace with `toast.error('Failed to load X. Please try again.')`
- Files to fix: `AcademicPlan.jsx`, `ConsultantTask.jsx`, `StudentProfile.jsx`, and any others found during implementation

### Loading States
- Standardize all pages on `<LoadingSpinner label="..." />`
- Remove bare "Loading..." text strings
- Ensure every async data fetch has a visible loading state

---

## Execution Order

### Phase 1: Plan Report Redesign
1. Add `preference_confidence` column to `StudentSchoolTarget` model + migration
2. Rewrite AI prompt (`academic_plan.yaml`) with new philosophy: action-oriented, target-school-first, confidence-aware tone, counselor metrics separate
3. Update `_load_student()` in task engine to pass target schools with confidence scores from `StudentSchoolTarget`
4. Add `counselor_notes` to output schema
5. Rewrite `plan_generator.py` with new HTML structure (student-safe + counselor overlay)
6. Add counselor metrics toggle to ConsultantTask page (postMessage to iframe)
7. Update all three templates (professional/modern/minimal)
8. Test with all 3 test students (set different confidence levels on their targets)
9. Verify in browser via consultant page

### Phase 2: App UI Refresh (can start after Phase 1 establishes design tokens)
1. Delete custom Button and TextInput components
2. Update all page imports to shadcn
3. Fix DOB input
4. Apply new color scheme and card styling across all pages
5. Replace Unicode icons with lucide-react
6. Standardize toasts and loading states

### Phase 3: Backend Fixes (independent — can run in parallel with Phase 2)
1. Auth hardening (enumeration + rate limiting)
2. JSONB validation schemas
3. Pagination on list endpoints
4. Fix admin data refresh stub
5. Add cohort edit endpoint + UI
6. Add account settings edit + change password

### Phase 4: Feature Gaps (after Phase 3)
1. Financial aid flag in AI prompt
2. Graduated student guard
3. Error handling cleanup
4. Final pass on loading states

---

## Out of Scope
- Dark mode toggle UI (OS preference detection already works)
- Audit logging
- CORS tightening
- Upload directory hardening
- Sidebar navigation (keeping top nav)
- Page routing changes
- Removing any student fields
- Enterprise auth features (SSO, MFA)
