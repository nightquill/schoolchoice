# Intelligent Academic Advisor — Preferences & Product Definition
*Single source of truth for all agents. Do not deviate from this document.*

---

## 0. Skills Development Protocol

Every agent in this system must maintain a skills file at `skills/<agent-name>.md`.
After completing any significant task, the agent appends what it learned:
reusable patterns, mistakes made and corrected, efficient approaches discovered,
tool usage insights, and domain knowledge acquired (e.g. HKDSE grading rules,
SQLAlchemy relationship patterns, React state management patterns).
Skills files are written for reuse across future projects — write them as if
briefing a new agent inheriting your role. Skills files are never deleted,
only appended. Product-manager reads all skills files at the start of every run.

---

## 1. Product Overview

An intelligent academic advising web application for Hong Kong secondary school
students. The system maintains rich student profiles, models the HKDSE grading
system accurately, maintains school profiles with real admission data, runs a
hybrid matching algorithm to rank school fit, and generates a detailed,
web-viewable academic plan for each student. The primary exam system is HKDSE.
Support for A-Level, IB, and custom grading systems is present in the UI but
HKDSE is the fully implemented path for the MVP.
Now this is a web-based internal tool for academic advising organizations.

The system enables counselors to:
- Input student data
- Evaluate school options
- Generate recommendations
- Produce actionable plans

---

## 2. Tech Stack

- Frontend: React
- Backend: FastAPI
- Database: PostgreSQL
- Matchmaking / ML: Python (scikit-learn, XGBoost, SHAP) — within the backend service
- Document generation: backend produces HTML report served via the frontend
- All agents use the agent .md file structure with YAML frontmatter

---

## 3. Data Schema & Ontology

The data model is an ontology linking core entities. All entities must tolerate
missing fields — no required field beyond a primary key and owner reference.
External IDs (e.g. HKDSE candidate number) must be linkable as optional fields.

### 3.1 Core Entities

**Student**
- id, account_id (FK)
- personal: full_name, date_of_birth, age (derived), gender, address, phone, email
- academic: class_name, year_of_study, candidate_number (HKDSE)
- language: preferred_language, ielts_score, ielts_date, other_language_scores (JSONB)
- teacher_evaluation: JSONB field storing structured teacher comments and ratings
  per subject (subject, teacher_name, rating 1–5, comment, date)
- extra_curricular: JSONB array (activity, role, years, achievement)
- awards: JSONB array (title, level, year)
- financial_aid_flag: boolean
- notes: free text

**GradeSystem**
- id, name: enum [HKDSE, A_LEVEL, IB, CUSTOM]
- description

**Subject**
- id, grade_system_id (FK)
- name, code, category: enum [CORE, ELECTIVE, OTHER_LANGUAGE, APPLIED_LEARNING]
- is_compulsory: boolean
- hkdse_subject_code: nullable, for official HKDSE subjects only

**StudentSubjectGrade**
- id, student_id (FK), subject_id (FK)
- year_of_exam, sitting: enum [MOCK, TRIAL, OFFICIAL]
- raw_grade: string (e.g. "5**", "A", "7")
- predicted_grade: string (populated when sitting != OFFICIAL and official not yet available)
- transcript_uploaded: boolean
- transcript_file_path: nullable string
- notes: string

**Transcript**
- id, student_id (FK)
- file_path, uploaded_at, parsed_data: JSONB (structured extraction of transcript)

**School**
- id
- name, name_zh (Chinese name)
- type: enum [UNIVERSITY, POLYTECHNIC, COMMUNITY_COLLEGE, VOCATIONAL]
- location, website, description
- minimum_entry_score: integer (HKDSE aggregate, nullable)
- required_subjects: JSONB array of subject codes with minimum grades
- language_requirements: JSONB (e.g. IELTS minimum)
- faculties: JSONB array
- notable_programs: JSONB array
- acceptance_rate: float nullable
- average_admitted_score: float nullable
- scholarship_available: boolean
- data_source, data_last_updated

**StudentSchoolTarget**
- id, student_id (FK), school_id (FK)
- student_rank: integer (student's own preference order)
- match_score: float (computed by matchmaking engine)
- eligibility_pass: boolean
- shap_explanation: JSONB (feature importance for this student–school pair)
- status: enum [CONSIDERING, APPLIED, ADMITTED, REJECTED, WITHDRAWN]

**AcademicPlan**
- id, student_id (FK)
- generated_at
- recommended_schools: JSONB ordered list with rationale per school
- action_items: JSONB array (task, deadline, related_school_id, priority)
- html_content: text (the full rendered plan document)
- version: integer

### 3.2 Key Relationships

- Student →[has many]→ StudentSubjectGrade
- Student →[has many]→ StudentSchoolTarget →[references]→ School
- Student →[has one]→ AcademicPlan
- Subject →[belongs to]→ GradeSystem
- StudentSubjectGrade →[references]→ Subject

### 3.3 Schema Rules

- All timestamps: created_at, updated_at on every mutable table
- Primary keys: UUID
- JSONB used for variable-structure data (teacher evaluations, language scores,
  SHAP output, parsed transcript data)
- Missing fields: nullable everywhere except PKs and required FKs
- No field may be removed without a migration and a PM ruling

---

## 4. HKDSE Grade System (Primary Implementation)

### 4.1 Grading Scale

Grades: 5**, 5*, 5, 4, 3, 2, 1, U (unclassified), X (absent)
Numeric equivalents for scoring: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0

### 4.2 Compulsory Subjects (all students must have these)

- Chinese Language (CHLA)
- English Language (ENGL)
- Mathematics (MATH) — Compulsory Part
- Liberal Studies / Citizenship and Social Development (CSD)

### 4.3 Elective Subjects (student selects typically 2–3)

Arts & Humanities:
- Chinese History (CHIH), Chinese Literature (CHIL), History (HIST)
- Geography (GEOG), Tourism and Hospitality Studies (TOUR)
- Visual Arts (VART), Music (MUSC)
- Ethics and Religious Studies (ERS), Physical Education (PE)

Business & Economics:
- Economics (ECON), Business, Accounting and Financial Studies (BAFS)

STEM:
- Biology (BIOL), Chemistry (CHEM), Physics (PHYS)
- Combined Science (CSCI), Integrated Science (ISCI)
- Mathematics Extended Module 1 (M1), Mathematics Extended Module 2 (M2)
- Information and Communication Technology (ICT)
- Design and Applied Technology (DAT), Health Management and Social Care (HMSC)
- Technology and Living (TL)

Languages:
- French (FREN), German (GERM), Japanese (JAPA), Spanish (SPAN)
- Putonghua (PTH)

Applied Learning (ApL): stored as free text subject name, graded Attained / Attained with Distinction

### 4.4 Predicted Grades

When a subject's sitting is MOCK or TRIAL and no OFFICIAL grade exists,
the system should display a predicted grade. Prediction logic (backend):
- If only one sitting exists: use that grade as predicted
- If multiple mock/trial sittings exist: use the most recent, with a note
- If teacher_evaluation contains a rating for that subject: factor it in
  (weighted average: 70% latest sitting, 30% teacher rating mapped to grade scale)
- Predicted grades are always visually distinguished from official grades in the UI

### 4.5 Transcript

A student may upload a transcript PDF or image. The backend parses it
(extract subject names and grades) and stores results in Transcript.parsed_data.
Parsed grades are suggested to the user for confirmation — never auto-saved.

---

## 5. Student Profile — Full Field List

The student profile UI must expose all fields below, grouped into tabs or sections:

**Personal Information**
- Full name, preferred name, date of birth, age (auto-calculated), gender, address,
  phone, email

**Academic Information**
- School year / class, HKDSE candidate number, grade system selector
  (HKDSE / A-Level / IB / Custom — radio buttons or tabs, HKDSE default)

**Grades**
- Subject grade entry table: one row per subject
- Columns: Subject (dropdown from subject list), Sitting (Mock/Trial/Official),
  Grade (dropdown matching selected grade system), Predicted Grade (auto or manual),
  Transcript uploaded (checkbox), Notes
- Ability to add multiple sittings for the same subject

**Language Scores**
- IELTS: overall band, listening, reading, writing, speaking, test date
- TOEFL, SAT, other: free-form additional entries (label + score + date)

**Teacher Evaluations**
- Per-subject entries: subject, teacher name, rating (1–5 stars), written comment, date

**Extracurricular & Awards**
- Extracurricular: activity name, role, years active, achievement description
- Awards: title, awarding body, level (school/district/regional/international), year

**Notes**
- Free text field for counsellor notes

---

## 6. School Profile

Users add schools to a student's target list from a school database.
Each school in the database has its own profile page.

**School Profile Page displays:**
- Name (English and Chinese), type, location, website
- Minimum HKDSE entry requirements (aggregate score and per-subject requirements)
- Language requirements (IELTS minimum if applicable)
- Notable programs / faculties
- Acceptance rate, average admitted score (if available)
- Scholarship information
- Data source and last updated date

**Student–School Target List:**
- Student can add schools to their personal target list
- Each entry shows: match score, eligibility pass/fail, SHAP explanation summary,
  student's own preference rank, current application status
- Student can drag to reorder their preference ranking

---

## 7. Data Agent

A dedicated agent gathers, structures, and maintains external data for the system.
It follows the same agent .md file structure as all other agents.

### 7.1 Data Sources (priority order)
1. HKDSE official statistics (HKEAA published reports)
2. JUPAS entry score data (publicly released)
3. Individual university admissions pages
4. Any other publicly available structured source

### 7.2 Data Agent Responsibilities
- Gather real HKDSE subject lists, codes, and grade distributions
- Gather Hong Kong university and tertiary institution profiles with admission
  requirements (minimum scores, required subjects, language requirements)
- Gather JUPAS historical median and lower quartile entry scores per program
- Structure all gathered data as seed SQL or JSON ready for database import
- Document every source URL, access date, and data freshness in
  data/sources.md
- Flag any data that is estimated or inferred rather than officially published
- Refresh data when preferences.md indicates a new academic year

### 7.3 Efficient Token Consumption Rules for Data Agent
- Fetch index pages first; extract URLs; then fetch only relevant detail pages
- Use CSS selectors or explicit section targeting — never process full page HTML
  when a table or section is sufficient
- Cache fetched content to disk under data/cache/ before processing; do not
  re-fetch a URL already in cache during the same run
- Process tables row-by-row; extract only columns that map to schema fields
- Write extracted data to data/raw/<source_name>.json incrementally; do not
  hold large datasets in memory
- Summarise what was gathered in data/sources.md after each source is processed,
  so a partial run can resume without duplicating work
- Never fetch the same URL twice in one run

### 7.4 Data Agent Output
- data/sources.md — source registry with URL, date, freshness, confidence level
- data/raw/<source>.json — raw extracted data per source
- data/processed/schools.json — cleaned, schema-aligned school records
- data/processed/subjects.json — HKDSE subject list with codes and categories
- data/processed/jupas_scores.json — historical JUPAS entry scores
- data/seed/seed_schools.sql — ready-to-run INSERT statements for School table
- data/seed/seed_subjects.sql — ready-to-run INSERT statements for Subject table

---

## 8. Matchmaking Algorithm

The matching engine lives entirely in the backend as a Python service module.
It is not an LLM — it is a deterministic + ML pipeline that outputs scores
and decisions. It must be explainable to counsellors and parents.

### 8.1 Step 1 — Eligibility Filter (Hard Rules)

Before any scoring, apply hard constraints. A school fails eligibility if:
- Student's best HKDSE aggregate (best 5 subjects including compulsory) is below
  the school's minimum_entry_score
- Student is missing a subject required by the school (e.g. specific science subject)
  with no equivalent
- Student's IELTS score is below the school's language_requirements minimum
  (if the student has an IELTS score on file)

Schools failing eligibility are still shown to the student but clearly marked
INELIGIBLE with the specific failing criterion stated.

### 8.2 Step 2 — Scoring Model

For eligible schools, compute a fit_score (0.0–1.0) per student–school pair.

Primary method: weighted multi-criteria scoring
- Academic fit (50%): ratio of student's aggregate to school's average_admitted_score
  (capped at 1.0). If average_admitted_score is null, use minimum_entry_score + 2.
- Subject alignment (20%): proportion of student's elective subjects that match
  the school's notable programs' typical subject requirements
- Language fit (15%): IELTS score relative to school requirement; 1.0 if no requirement
- Interest / program alignment (15%): tagged match between student extracurriculars
  and school's notable programs (keyword overlap, normalised 0–1)

Secondary method (when historical data is available):
- XGBoost classifier trained on historical student–school outcome pairs
- Features: aggregate score, subject grades, IELTS, extracurricular count, award level
- Output: probability of admission (0–1)
- When trained model exists, final score = 0.6 × weighted_score + 0.4 × ml_probability

SHAP values must be computed for every student–school pair scored by the ML model.
Store as shap_explanation JSONB on StudentSchoolTarget. Display top 3 contributing
features to the user in plain English.

### 8.3 Step 3 — Ranking

Sort eligible schools by fit_score descending.
Apply a preference adjustment: if student has ranked a school in their target list,
boost that school's display rank by one position per preference rank point above median.
(This reflects the Gale-Shapley principle that student preference matters alongside fit.)

### 8.4 Step 4 — Output

Return an ordered list of schools with: fit_score, eligibility_pass,
top SHAP features (if ML scored), and a one-sentence plain-English rationale.
This list populates the AcademicPlan and the student's target school list.

---

## 9. Academic Plan Document

The academic plan is a rich, web-viewable HTML document generated by the backend
and stored in AcademicPlan.html_content. It is rendered in the frontend as a
full-page view and must be printable.

### 9.1 Document Sections

1. **Student Summary** — name, year, grade system, current aggregate score
2. **Academic Profile** — table of all subjects with grades, predicted grades flagged
3. **Recommended Schools** — ordered list, top N (default 5), for each:
   - School name, type, fit score (displayed as percentage), eligibility status
   - Why this school fits: plain-English paragraph using SHAP feature rationale
   - Admission requirements vs student's current standing (gap analysis table)
   - Recommended actions specific to this school
4. **Action Plan Timeline** — chronological checklist:
   - Each item: task description, deadline, related school(s), priority (High/Med/Low)
   - Grouped by quarter (e.g. Q3 2025: Improve Physics mock grade to 4+)
5. **Skill & Activity Gaps** — extracurricular or award gaps relative to target schools
6. **Language Readiness** — IELTS status vs requirements, recommended score to achieve
7. **Appendix** — raw grade table, data sources used for school profiles

### 9.2 Format Requirements

- Rendered as styled HTML (inline CSS, no external dependencies)
- Printable: @media print stylesheet included
- No JavaScript in the document (static HTML only)
- Backend endpoint: GET /api/v1/students/{id}/plan returns the HTML document
- Frontend renders it in an iframe or dedicated full-page route

---

## 10. Account Settings

A basic account settings page accessible from the main navigation.

Fields:
- Email address (display only, not editable — contact admin to change)
- Display name
- Password change (current password, new password, confirm new password)
- Preferred language: English / 中文
- Notification preferences: email notifications on/off (placeholder, not wired)
- Delete account (requires password confirmation — soft delete only, sets account inactive)

---

## 11. Pages (Full List)

- Login / Register
- Dashboard (overview of all students for a counsellor, or own profile for a student)
- Student Profile (tabbed: Personal, Grades, Language, Teacher Evaluations, Activities)
- Student Target Schools (list with match scores, drag to reorder)
- School Directory (searchable/filterable list of all schools in database)
- School Profile (individual school detail page)
- Academic Plan (full-page HTML plan view)
- Account Settings
- Admin: Data Refresh (trigger data-agent re-run — admin only)

---

## 12. User Roles

- **Counsellor**: views and edits any student profile, generates plans, sees all students

---

## 13. Non-Functional Requirements

- All API responses under 500ms for read operations (excluding plan generation)
- Plan generation may take up to 10 seconds; use a background task with polling
- Transcript parsing is async; user is notified when parsing is complete
- All user data encrypted at rest (PostgreSQL column-level encryption for sensitive fields
  or full-disk encryption — SA to decide and document in ADR)
- WCAG AA accessibility for all UI components
- Mobile-responsive layout for all pages

---

## 14. Out of Scope for MVP

- Real-time JUPAS application submission
- Integration with HKEAA live results system
- Payment or subscription management
- Alumni tracking or long-term outcome data collection
  (schema allows for it but UI and logic not built)
- A/B testing or analytics instrumentation

---

## 9. React Navigation Rules (Mandatory)

All agents writing React code MUST follow these rules without exception:

- **Never call `navigate()` during render.** Always call it inside `useEffect` or an event handler (onClick, onSubmit, etc.).
- **Redirect-on-auth pattern:** If a page redirects already-authenticated users, use:
  ```js
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);
  if (isAuthenticated) return null;
  ```
- **API response unwrapping:** Always check the shape of API responses. FastAPI list endpoints return `{ items: [], total: 0 }` or `{ <resource>s: [], total: 0 }`. Never pass the whole object to `setState` when the component expects an array. Always unwrap: `.then((data) => setState(data.items || data.<resource>s || []))`.
- **Invalid CSS in style props:** Never write `'-var(--token)'` — this is invalid. Use `'0'`, `calc()`, or a literal pixel value instead.
- **Integration engineer must verify:** Before declaring any page done, test that switching to that page does not produce a blank screen.


## 15. Academic Plan — Visualisation

The academic plan document must include embedded charts rendered via Chart.js (loaded from CDN, version 4). Charts are rendered inline in the HTML document and must work when printed (static fallback values encoded in the chart config).

Required charts:
- Subject Grade Profile: horizontal bar chart showing each subject and its grade (numeric equivalent), with a reference line at the school's minimum required score. One chart per recommended school.
- School Fit Radar: radar/spider chart with axes for Academic Fit, Subject Alignment, Language Fit, and Program Alignment scores (the four components of the matchmaking scoring model). One chart per recommended school.
- Action Plan Timeline: a visual Gantt-style horizontal timeline grouping action items by quarter and priority (High = red, Medium = amber, Low = green). Rendered as SVG, not Chart.js.

All chart data is embedded as JSON in a <script> tag within the HTML document. No external API calls from the document itself.

---

## 16. Counsellor AI Chat (Plan Editing)

A chat panel is displayed alongside the Academic Plan view in the frontend.
The counsellor can type natural language instructions to modify the plan.

AI Provider: Google Gemini 2.5 Flash via the Google Generative AI Python SDK
(pip install google-generativeai). API key stored as GEMINI_API_KEY environment
variable in the backend. Never exposed to the frontend.
Rationale: no credit card required, no expiry, 250 requests/day free tier sufficient
for low-frequency counsellor usage, simple SDK, stable support.

Architecture:
- The chat panel sends: the counsellor's message + the current AcademicPlan's
  structured data fields (recommended_schools list with scores and rationale,
  action_items list) as JSON context. It does NOT send the full HTML.
- The backend calls the Gemini API with a system prompt instructing the model
  to return a JSON patch object specifying only the fields to change.
  Example patch: { "recommended_schools[0].rationale": "new text",
  "recommended_schools[0].fit_score": 0.82 }
- The backend applies the patch to the AcademicPlan record, increments the
  version number, regenerates the HTML, and returns the updated plan.
- The frontend re-renders the plan view with the new HTML.

Supported counsellor instructions the system prompt must handle:
- Change the wording or tone of a school's rationale paragraph
- Adjust a fit score for a school (override the algorithm's score)
- Add, edit, or remove an action item
- Change the priority of an action item
- Reorder the recommended schools list
- Change the student summary text

Rate limiting: max 20 AI chat requests per plan per day per counsellor account,
enforced in the backend. Return a clear error message when limit is reached.

New backend endpoint: POST /api/v1/students/{id}/plan/chat
- Request body: { "message": string }
- Response: updated AcademicPlan object

## 17. Plan Document — Editable Templates

The plan document supports a small set of design templates selectable by the counsellor. This is not a free-form canvas — it is template switching with per-section rich text editing.

Templates (3 total, backend stores template_id on AcademicPlan):
- Professional: white background, dark navy headings, serif body font (Georgia), formal tone markers
- Modern: light grey background, teal accent colour, sans-serif (Inter), generous whitespace
- Minimal: pure white, black text only, no colour accents, maximum information density

Template selection:
- A toolbar above the plan view shows three template buttons with a thumbnail preview label.
- Selecting a template saves template_id to the AcademicPlan record and re-renders the HTML with the new template's CSS.
- New backend endpoint: PATCH /api/v1/students/{id}/plan/template — body: { "template_id": string }

Per-section rich text editing:
- Each named section of the plan (Student Summary, per-school rationale paragraphs, Action Plan notes) has an Edit button visible only to Counsellor and Admin roles.
- Clicking Edit opens that section as a rich text editor (use TipTap). The counsellor can change wording, bold/italic text, and bullet points. No layout changes — text content only.
- Saving a section sends a PATCH to /api/v1/students/{id}/plan/section — body: { "section_key": string, "html_content": string }
- Edited sections are stored in AcademicPlan as an overrides JSONB field: { section_key: edited_html }. When regenerating the plan HTML, overrides take precedence over auto-generated content for that section.
- A Reset Section button reverts a section to the algorithm-generated content by deleting its key from the overrides field.

New AcademicPlan fields to add to schema:
- template_id: string (default: "professional")
- overrides: JSONB (default: {})
