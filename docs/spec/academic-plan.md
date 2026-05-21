<!-- spec-tracks: apps/web/src/pages/AcademicPlan/AcademicPlan.jsx, apps/web/src/pages/ConsultantTask/ConsultantTask.jsx, apps/web/src/hooks/usePlanWorkspace.js, apps/web/src/components/PlanChat/PlanChat.jsx, apps/web/src/components/PlanSectionEditor/PlanSectionEditor.jsx, apps/web/src/components/PlanProgress/PlanProgress.jsx, apps/web/src/components/PlanRadarChart/PlanRadarChart.jsx, apps/web/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx, apps/web/src/components/PlanWorkspace/planStyles.js, apps/web/src/api/plan.js, apps/web/src/api/consultant.js, backend/app/api/v1/routes/plan.py, backend/app/api/v1/routes/consultant.py, backend/app/api/v1/routes/plan_release.py, backend/app/modules/school_choice/services/plan_generator.py, backend/app/modules/school_choice/services/plan_chat_service.py -->

# Academic Plan Specification

There are two plan pages that share a common workspace hook (`usePlanWorkspace`):

1. **AcademicPlan** (`/students/:id/plan`) — polling-based async generation
2. **ConsultantTask** (`/consultant/:id`) — SSE streaming generation

Both render the same HTML plan document in an iframe, use the same chat panel, template selector, and section editor.

---

## Page: Academic Plan (`/students/:id/plan`)

### Elements

#### NavBar
- `<NavBarV2 account={account} />` — standard navigation bar

#### Back Link
- `<Link>` — "Back to Profile" link, navigates to `/students/:id/profile`

#### Main Toolbar (top bar)
- **Student name** — `<p>` displaying `student.full_name` or "Academic Plan"
- **Plan version badge** — `<p>` "Plan vN" (visible when `plan.version` exists)
- **Plan type selector** — two `<button>` elements:
  - "University Plan" (`UNIVERSITY`) — default active
  - "High School Plan" (`HIGH_SCHOOL`)
  - Disabled while generating; active button has primary background
- **Generate Plan button** — `<Button variant="primary">` "Generate Plan"
  - Shows loading spinner when `generating || isGenerating`
  - Disabled when `isGenerating`
- **Print button** — `<Button variant="secondary">` "Print" — calls `window.print()`
  - Visible only when `plan.html_content` exists
- **Export HTML button** — `<button>` with `<FileDown>` icon
  - Label toggles: "Exporting..." / "Export HTML"
  - Disabled when `isExportingHTML || !plan?.id`
  - Cursor changes to `wait` when exporting
- **Generated timestamp** — `<span>` "Generated YYYY-MM-DD HH:MM"
  - Visible when `plan.generated_at` exists

#### Template Selector Bar (below toolbar, visible only when `hasPlan`)
- **TemplateSelector** — shared UI component
  - Props: `templateId`, `onTemplateChange`, `isPending`
  - Options: `professional`, `modern`, `minimal`
- **Edit Sections toggle** — `<button>`
  - Label: "Edit Sections" / "Done Editing"
  - Primary background when `editMode` is active
  - Toggles `editMode` state

#### Section List (visible when `hasPlan && editMode`)
- **Label** — "Select a section to edit"
- **Section buttons** — array of `<button>` elements, one per editable section
  - Each shows pencil icon + section label
  - Clicking opens the section editor modal
  - Sections derived from `buildSectionList(plan)`:
    - `student_summary` — "Student Summary"
    - `school_N_rationale` — "School N+1 Rationale" (for each recommended school, max 5)
    - `action_plan_notes` — "Action Plan Notes"

#### Content Zone (mutually exclusive states)

**State 1: Loading**
- `<LoadingSpinner label="Loading..." />`

**State 2: Generating (polling)**
- `<LoadingSpinner label="Generating Plan..." />`
- `<p>` "Generating Plan..." (large, medium weight)
- `<p>` description text (small, secondary color)
- `<Button variant="secondary">` "Cancel" — stops polling
- `role="status" aria-live="polite"` on status container

**State 3: Error**
- `<ErrorMessage message={error} />`
- `<Button variant="primary">` "Generate Plan" — retry

**State 4: Plan Loaded (`hasPlan`)**
- Two-column layout:
  - **Left column (plan iframe)**: `<iframe>` with `srcDoc={plan.html_content}`
    - `sandbox="allow-same-origin allow-scripts"`
    - `aria-label="Academic plan document"`
  - **Right column (chat panel)**: `<ChatPanel>` (see Chat Panel spec below)

**State 5: No Plan (empty)**
- `<EmptyState message="No plan generated" />`
- `<Button variant="primary">` "Generate Plan"

#### Section Editor Modal (visible when `editingSection` is set)
- **Backdrop** — click outside closes (unless saving)
- **Dialog** container (click stops propagation)
- **Header row**:
  - `<h2>` "Edit {section.label}"
  - Close button `×` (hidden while saving), `aria-label="Close editor"`
- **PlanSectionEditor** component (see Section Editor spec below)

### Data Flow

#### Initial Load
1. `getStudent(id)` — fetch student profile
2. `getAccount()` — fetch current user account
3. `getPlan(id)` — fetch existing plan (404 is OK, caught silently)
4. After hook loads, checks `getPlanStatus(id)` to detect PENDING/RUNNING jobs

#### Plan Generation (Polling)
1. `POST /api/v1/students/:id/plan` — request body: `{ plan_type: "UNIVERSITY"|"HIGH_SCHOOL" }`
   - Response: `{ job_id, status: "PENDING", created_at }`
   - HTTP 202 Accepted
2. Poll `GET /api/v1/students/:id/plan/status` every 2000ms
   - Response: `{ id, student_id, status, error_message, created_at, updated_at }`
   - Status values: `PENDING`, `RUNNING`, `DONE`, `FAILED`
3. On DONE: `GET /api/v1/students/:id/plan` to fetch full plan
   - Response: `PlanResponse` (see below)
4. On FAILED: stop polling, show error toast

#### Plan Response Shape (`PlanResponse`)
```json
{
  "id": "uuid",
  "student_id": "uuid",
  "version": 3,
  "html_content": "<html>...</html>",
  "recommended_schools": [...],
  "action_items": [...],
  "generated_at": "2025-01-01T00:00:00Z",
  "template_id": "professional",
  "overrides": {}
}
```

#### Template Change
- `PATCH /api/v1/students/:id/plan/template` — body: `{ template_id: "modern" }`
- Returns updated `PlanResponse` with regenerated HTML

#### Section Edit
- `PATCH /api/v1/students/:id/plan/section` — body: `{ section_key, html_content }`
- HTML is sanitized server-side with `nh3.clean()`
- Returns updated `PlanResponse` with regenerated HTML

#### Section Reset
- `DELETE /api/v1/students/:id/plan/section/:section_key`
- Removes override, reverts to auto-generated content
- Returns updated `PlanResponse`

#### Plan Chat
- `POST /api/v1/students/:id/plan/chat` — body: `{ message: "..." }`
- Response: `{ plan_id, version, html_content, message }`
- Rate limited: 20 requests per counsellor per plan per 24-hour rolling window
- 503 if AI_API_KEY not configured
- 429 if rate limit exceeded

#### Plan History
- `GET /api/v1/students/:id/plans/history` — returns `{ plans: [...], total }`
- `DELETE /api/v1/students/:id/plans/history/:plan_id` — 204 No Content

#### Export HTML
- Uses `exportPlanHTML(plan.id)` from entities API

#### Export PDF
- `GET /api/v1/students/:id/plan/export-pdf`
- Returns PDF blob (`application/pdf`) or falls back to HTML for browser print
- Uses PyMuPDF (fitz) for HTML-to-PDF conversion

### Key Behaviors

- **Polling lifecycle**: Start → PENDING → RUNNING → DONE/FAILED. Interval: 2000ms. Cleanup on unmount.
- **Cancel**: `handleCancelPolling()` stops the interval and resets `planStatus` to null.
- **Auto-detect in-progress**: On mount, if no plan loaded, checks `/plan/status` for PENDING/RUNNING and auto-starts polling.
- **Plan type persists in local state only** — not sent to backend until Generate is clicked.
- **hasPlan guard**: `!isGenerating && !error && plan?.html_content` — all three conditions required.

---

## Page: Consultant Task (`/consultant/:id`)

### Elements

All elements from Academic Plan above, plus the following differences/additions:

#### Main Toolbar Differences
- **No plan type selector** — always generates UNIVERSITY plan
- **Language toggle button** — switches between `繁體中文` and `English`
  - Label: "中 → EN" or "EN → 中"
  - Stored in local state `planLanguage`
- **JUPAS Milestone badge** — auto-calculated from `JUPAS_MILESTONES` array
  - Shows next upcoming milestone with date and days remaining
  - Red background if ≤30 days; amber if >30 days
  - 10 milestones hardcoded (Sep 2025 through Aug 2026)
- **Stop Generation button** — `<button>` with `<StopCircle>` icon
  - Visible only while `streaming`
  - Closes EventSource, resets stream state
- **Export PDF button** — `<button>` with `<FileDown>` icon
  - Visible when `plan.html_content` exists
  - Downloads PDF via `exportPlanPDF(id)`
- **Release to Student button** — `<button>`
  - If already released: green background, "Released vN"
  - If not released: "Release to Student"
  - Opens release modal
- **Generated timestamp** — same as AcademicPlan

#### Template Selector Bar Additions
- **Counselor View checkbox** — `<input type="checkbox">`
  - Label: "Counselor View"
  - Sends postMessage to iframe: `show-counselor` / `hide-counselor`
  - Toggles visibility of `class="counselor-only"` elements in plan HTML

#### Generation Progress (replaces polling states)
- **PlanProgress** component — 4-stage progress indicator:
  1. "Analyzing student data..." (3s)
  2. "Matching programmes..." (5s)
  3. "Generating plan..." (12s)
  4. "Formatting..." (indefinite)
- Progress bar: max 95% until done, 100% when done
- 4 stage dots below progress bar
- Wraps in min-height 400px centered container

#### SSE Stream Error State
- **SSEStreamDisplay** with `error` prop
- Shows error message text
- "Try Again" `<button>` (calls `handleGenerate`)

#### Mobile Chat Toggle (below plan, `<768px`)
- **Toggle button** — full-width, shows/hides chat panel
  - Label: "AI Assistant" / "Show Chat"
  - Primary background when chat is shown
- **Mobile ChatPanel** — renders below toggle when `showChat` is true
- Desktop chat: hidden below 768px via CSS class `.consultant-chat-desktop`
- Mobile chat: hidden above 769px via CSS class `.consultant-chat-mobile`

#### Release Plan Modal (`<Dialog>`)
- **DialogHeader** — title: "Release to Student"
- **Release note textarea** — `<textarea rows={3}>`
  - Label: "Release Note"
  - Placeholder: release note text
- **DialogFooter**:
  - Cancel button — `<Button variant="secondary">`
  - Release button — `<Button>` "Release to Student" or "Re-release" if already released
  - Disabled while `releasing`

### Data Flow

#### SSE Stream Generation
1. Opens `EventSource` to `GET /api/v1/consultant/tasks/academic_plan/stream?entity_id=:id&force=true&token=:jwt`
   - Auth via query param (EventSource is GET-only)
   - `force=true` always passed
2. `onmessage`: accumulates tokens in ref + state
3. `done` event: closes source, saves via `POST /api/v1/consultant/tasks/academic_plan/save`
   - Body: `{ task_id, entity_id, ai_output_json }` (raw JSON string from SSE)
   - Server validates against JSON schema, applies confidence guardrail, renders HTML, persists
   - Response: `{ id, version, html_content, recommended_schools, action_items }`
4. `onerror`: if >50 tokens received, attempts save (graceful degradation); otherwise shows error

#### SSE Stream Backend Flow
- Loads YAML task definition via `TaskEngine`
- Builds messages array (data slots, Jinja2 templates)
- Streams via `call_ai_stream()` (LiteLLM)
- Staleness guard: if `?force=false` and plan data fingerprint matches, returns 409

#### Save Validation Pipeline
1. Parse JSON from SSE buffer
2. Validate against task `output_schema` via jsonschema
3. Validate via `ConsultantPlanOutput` Pydantic model
4. **Confidence guardrail**: compare AI confidence_tier vs code-computed tier (from `compute_data_completeness`). Downgrade if AI inflated. Never upgrade.
5. Map AI school names to JUPAS programmes (fuzzy match on school name)
6. Render HTML via `generate_html_plan()`
7. Upsert `AcademicPlan` row
8. Create `PlanHistory` snapshot
9. Create `PlanGenerationJob` (status: DONE)
10. Store data fingerprint in `plan.overrides._data_fingerprint`

#### Consultant Chat
- `POST /api/v1/consultant/tasks/academic_plan/chat`
  - Body: `{ entity_id, message }`
  - Delegates to `plan_chat_service.handle_chat()`
  - Response: `{ message, plan_id, version, html_content }`

#### Plan Release
- `POST /api/v1/students/:id/plan/release` — body: `{ note: "" }`
  - Sets `released_at` timestamp and `release_note`
  - Response: `{ released_at, version }`
- `GET /api/v1/students/:id/plan/release-status`
  - Response: `{ released: bool, released_at, release_note, version }`

#### Auto-Generate on Navigation
- If URL has `?generate=true`, auto-starts generation on mount (once)
- Clears query param after triggering

#### Radar Chart Data Queries (enabled when `hasPlan`)
- `getGrades(id)` — student's grade records
- `getTargets(id)` — student's school targets
- `getAllProgrammes()` — all JUPAS programmes (staleTime: 10min)
- Builds `gradesByCode` map: `{ subject_code: grade_string }`
- Finds rank-1 target, looks up programme admission_stats median
- Derives per-subject benchmark: `median / 5`

### Key Behaviors

- **SSE lifecycle**: EventSource opened → tokens streamed → `done` event → save → reload plan. Cleanup on unmount.
- **Stop generation**: Closes EventSource, resets all stream state. Does not save partial output.
- **Graceful degradation on onerror**: If >50 tokens accumulated, tries to save them anyway (stream may have completed before `done` event fired).
- **`doneHandledRef`**: prevents `onerror` from firing after `done` has already been processed.
- **Counselor view toggle**: postMessage to iframe toggles `show-counselor` CSS class on `<body>`.
- **Graduated student guard**: backend returns 400 for graduated students.
- **Rate limit**: 20 requests per entity per user per 24-hour rolling window (separate from plan chat limit).

---

## Shared Component: Chat Panel

### Elements
- **Header bar**: "AI Assistant" title + "Beta" badge
- **API key notice** (shown when `chatDisabled`): yellow warning box with configurable text
- **Message list** (scrollable flex column):
  - Empty state: italic hint text (configurable via `hintText` prop)
  - `MessageBubble` for each message
- **Chat error** (below messages): red error text
- **Input area** (hidden when `chatDisabled`):
  - `<textarea>` — 2 rows, resizable: none, max-height 120px
    - Placeholder: "Type a message..."
    - Disabled when `chatLoading`
    - `aria-label="Chat message input"`
  - Send `<button>` — "Send" / "..." (loading)
    - Disabled when `chatLoading || !chatInput.trim()`
    - Gray when disabled, primary when active
    - `aria-label="Send message"`

### MessageBubble
- **User messages**: right-aligned, primary background, white text, rounded (except bottom-right)
- **Assistant messages**: left-aligned, gray background (#f3f4f6), dark text, rounded (except bottom-left)
- **System messages**: left-aligned, yellow background (#fef3c7), brown text, 1px border, italic
- All: max-width 85%, pre-wrap, word-break

### Key Behaviors
- Enter sends message (Shift+Enter for newline)
- Auto-scrolls to bottom on new messages
- On 503 response: disables chat permanently, shows system message about API unavailability
- On 429 response: shows system message about daily limit
- After successful send: reloads plan via `loadPlan()` to reflect AI changes

---

## Shared Component: Plan Section Editor (TipTap)

### Elements
- **Section label** — "Editing: {sectionKey}"
- **Toolbar buttons**:
  - **Bold** (`<strong>B</strong>`) — toggles bold, active state highlighted
  - **Italic** (`<em>I</em>`) — toggles italic, active state highlighted
  - **Bullet List** (`• List`) — toggles bullet list, active state highlighted
- **Editor content area** — TipTap `<EditorContent>`, min-height 400px, white background
  - Click anywhere focuses editor
  - Uses StarterKit extensions
- **Action buttons** (right-aligned row):
  - **Cancel** — closes editor without saving, disabled while saving
  - **Reset to Default** — calls `onReset()`, disabled while saving
  - **Save** — calls `onSave(editor.getHTML())`, disabled while saving or if no editor
    - Primary background when active, gray when disabled
    - Label: "Save" / "Saving..."

---

## Shared Component: PlanProgress

### Elements
- **Progress bar** — 400px max-width, 6px height, rounded
  - Fill width: `(stageIndex + 1) / 4 * 95`% max, 100% when done
  - Transition: width 0.8s ease-out
- **Stage label** — medium text, secondary color
  - "Analyzing student data..." / "Matching programmes..." / "Generating plan..." / "Formatting..." / "Done!"
- **Stage dots** — 4 circles, 10px each
  - Filled (primary) when stage reached; unfilled (border) otherwise
  - Transition: background 0.3s

### Stage Timing
1. `analyzing` — 3000ms
2. `matching` — 5000ms
3. `generating` — 12000ms
4. `formatting` — indefinite (waits for done)

---

## Shared Component: PlanRadarChart (Recharts)

### Elements
- **Card container** — surface background, rounded border
- **Title** — "Academic Strengths"
- **RadarChart** (Recharts `<RadarChart>`) — 350px height
  - `<PolarGrid>` — border color grid lines
  - `<PolarAngleAxis>` — subject names, 13px font, 500 weight
  - `<PolarRadiusAxis>` — domain [0, 7], 8 ticks, 90° angle
  - **Student radar** — solid primary color, 30% opacity fill, 2px stroke
  - **Benchmark radar** — error color, no fill, 2px dashed stroke
  - `<Legend>` — "Your Grades" + benchmark label

### Key Behaviors
- Requires ≥3 subjects to render (returns null otherwise)
- Translates subject codes via i18n `t('subjects.CODE')`
- Grade mapping: `5** → 7, 5* → 6, 5 → 5, 4 → 4, 3 → 3, 2 → 2, 1 → 1, U → 0, A → 6, B → 4, C → 3`

---

## HTML Plan Output Structure

Generated by `generate_html_plan()` in `plan_generator.py`. Self-contained HTML document with inline CSS.

### Template Variants

| Template | Primary Color | Background | Border Style |
|---|---|---|---|
| `professional` | `#2563eb` (blue) | `#ffffff` | `1px solid #e5e7eb`, shadow |
| `modern` | `#0d9488` (teal) | `#f5f5f5` | `1px solid #e5e7eb`, shadow |
| `minimal` | `#111827` (black) | `#ffffff` | `1px solid #d1d5db`, no shadow |

### HTML Sections (in order)

1. **Header** (`.header`)
   - "University Application Strategy" label (uppercase, primary color)
   - Student name `<h1>`
   - Subtitle: "Prepared {date}{year_of_study}"
   - JUPAS milestone badge (if applicable): date + days remaining, red/amber styling
   - **Counselor-only**: "Best-5 Aggregate: N" (`class="counselor-only"`)

2. **Metrics Row** (`.metrics-row`)
   - 4 metric cards in flex row:
     - **Best-5 Score** — `counselor-only`, primary-light background
     - **Top Grade** — green-light background, shows best raw grade
     - **Target Schools** — amber-light background, count of eligible schools (max 8)
     - **Subjects** — primary-light background, total subject count

3. **Assessment** (`.assessment`)
   - Left-bordered box with primary color, primary-light background
   - AI-generated overall assessment text (if provided)
   - Omitted if no `ai_assessment`

4. **Academic Strengths** (`.section`)
   - SVG Radar Chart (inline, not Recharts):
     - Polygon grid with 7 levels
     - Axis lines from center
     - Student polygon (primary color, 25% opacity fill)
     - Benchmark polygon (red dashed, from programme median)
     - Subject labels around perimeter
     - Legend: "Your Grades" + benchmark label
   - Requires ≥3 subjects; shows message otherwise
   - Per-subject benchmark: weighted by programme scoring_formula if available

5. **Target Programmes** (`.section`)
   - Up to 8 school cards (`.school-card`):
     - **School header row**:
       - Display name: "Major — School" (or just school name)
       - JUPAS code in `school-meta`
       - **Counselor-only**: match percentage badge (blue ≥80%, green ≥60%, amber <60%)
     - Programme-specific deadline tags (interview, portfolio, audition) with colored pills
     - "Why this works for you" label + rationale text
     - "What to focus on" label + action items list (if any)
   - Section override support: `school_N_rationale` key replaces auto-generated rationale

6. **Application Roadmap** (`.section`)
   - Description: "Your month-by-month action plan..."
   - Table (`.data-table`):
     - Columns: When | What To Do | Priority | School
     - Priority pills: red (High), amber (Medium), green (Low)
   - Fallback action items generated if AI doesn't provide them:
     - Grade improvement tasks (for subjects below Grade 4)
     - "Finalise JUPAS preference list" (Dec)
     - "Complete personal statement first draft" (Nov)
     - "Request reference letters" (Oct)
     - "Research application requirements" (Sep)

7. **Areas to Strengthen** (`.section`)
   - Description text
   - Gap pills (amber background) for each skill gap
   - Fallback: suggests building extracurricular profile if none exists

8. **Language Readiness** (`.section`)
   - Shows IELTS overall band if available
   - Otherwise: "IELTS score not yet on file..."

9. **Appendix** (`.section`)
   - **Grade Records table**: Subject | Sitting | Grade | Year
   - **Counselor-only: Match Scores table**: School | Match% | Eligible (Yes/No)
   - Best-5 Aggregate (counselor-only)
   - Data source attribution + last updated date

10. **Footer** (`.footer`)
    - "Generated by Intelligent Academic Advisor" + timestamp

### Dual-Layer Visibility

- **Student view** (default): `.counselor-only { display: none; }`
- **Counselor view**: `.show-counselor .counselor-only { display: block; }` / `display: inline;`
- Toggled via `postMessage`: `show-counselor` / `hide-counselor` / `toggle-counselor`
- Script listener embedded in plan HTML

### Print Styles (`@media print`)
- Hides: `.no-print`, `nav`, `.chat-panel`, `button`
- Removes: box-shadow, page-break-inside: avoid on sections/cards
- Forces: `-webkit-print-color-adjust: exact`
- Page: A4, 1.5cm margins
- Counselor elements always hidden in print

### Plan Type: HIGH_SCHOOL
- Simplified plan with:
  - Header: "Academic Progress Report" (instead of "University Application Strategy")
  - Subject Analysis table: Subject | Grade | Action
  - Grade color coding: green (≥5), amber (4), red (<4)
  - Actions: "Maintain", "Aim for Grade 5", "Focus area — seek additional support"
  - No school cards, no roadmap, no radar chart

---

## Backend: Plan Generation Pipeline

### Background Task (`_generate_plan_task`)
1. Mark job `RUNNING`
2. Load student from DB
3. Build student data via `build_student_data()` (single canonical source)
4. Build student dict via `build_student_dict_for_plan()`
5. Run matching against all schools via `run_matching()`
6. AI enhancement (non-blocking):
   - Sends anonymized student profile to LLM
   - Requests: school_rationales, action_items, overall_assessment
   - Max 1500 tokens, temperature 0.3
   - Failure is swallowed (logged, not raised)
7. Generate HTML via `generate_html_plan()`
8. Build recommended schools list (top 5 eligible)
9. Upsert `AcademicPlan` row (version incremented)
10. Create `PlanHistory` snapshot with grade/target data
11. Mark job `DONE`

### Permissions
- Plan generation requires `plan_generation` feature with `read_write` permission
- All plan endpoints require student ownership (user_id match or same organisation)
- Consultant endpoints verify organisation-scoped access

### AI Security
- Student real name is NOT sent to third-party AI provider
- Only anonymized data: "Year N HKDSE candidate"
- Real name used only locally in generated HTML

---

## API Endpoint Summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/students/:id/plan` | Enqueue async plan generation |
| GET | `/api/v1/students/:id/plan/status` | Poll generation job status |
| GET | `/api/v1/students/:id/plan` | Get current plan |
| GET | `/api/v1/students/:id/plans/history` | List plan history |
| DELETE | `/api/v1/students/:id/plans/history/:planId` | Delete history entry |
| POST | `/api/v1/students/:id/plan/chat` | AI chat (plan route) |
| PATCH | `/api/v1/students/:id/plan/template` | Change template |
| PATCH | `/api/v1/students/:id/plan/section` | Edit section override |
| DELETE | `/api/v1/students/:id/plan/section/:key` | Reset section override |
| GET | `/api/v1/students/:id/plan/export-pdf` | Export as PDF |
| GET | `/api/v1/students/:id/plans/history/:planId/export-pdf` | Export history as PDF |
| POST | `/api/v1/students/:id/plan/release` | Release plan to student |
| GET | `/api/v1/students/:id/plan/release-status` | Check release status |
| GET | `/api/v1/consultant/tasks/:taskId/stream` | SSE stream generation |
| GET | `/api/v1/consultant/tasks/:taskId/status` | Consultant task status |
| POST | `/api/v1/consultant/tasks/:taskId/save` | Save SSE output |
| POST | `/api/v1/consultant/tasks/:taskId/chat` | AI chat (consultant route) |
| GET | `/api/v1/student/plan` | Student's own plan (student role) |
