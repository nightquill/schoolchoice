# Skills: Product Manager
# Agent: product-manager
# Project: Intelligent Academic Advisor
# Last updated: 2026-03-27

---

## How to Structure a Delta Pipeline Run

### What a delta run is
A delta run is a subsequent pipeline execution after a baseline v1 run has already completed implementation. The purpose is to add new requirements without duplicating, breaking, or re-assigning what is already done.

### What to skip
- Do NOT re-assign REQ-IDs that already exist. The baseline REQ register is canonical. Even if a v1 requirement has been superseded or expanded, create a new REQ-ID for the expansion — do not modify the old one.
- Do NOT re-plan any component already marked IMPLEMENTED in the v1 RTM. List them in the Context section of each agent packet as "already done — do not re-assign or rebuild."
- Do NOT re-initialize agent packets from scratch. Issue _v2 packets that reference the v1 packet and explicitly list only what is new.
- Do NOT re-issue the pm_rulings.md. Create a fresh pm_rulings_v2.md starting from zero rulings.

### What to add
- New REQ-IDs starting immediately after the last baseline ID (v1 ended at REQ-042 → v2 starts at REQ-043).
- A new master requirements file (pm_master_requirements_v2.md) containing ONLY the new REQs with a header note pointing to the baseline file.
- A new RTM file (pm_rtm_v2.md) for the new REQs only.
- New agent packets (_v2.md) for every agent, including new agents introduced in this run.
- A separate packet for any new agent type (e.g., data-agent) that did not exist in v1.
- A skills/ directory with the PM's own skills file and stubs for all other agents.

### Continuity checklist
Before writing any v2 output file, answer:
1. What REQ-ID did the baseline end at? (Read pm_master_requirements.md last line.)
2. Are there any rulings from v1 that constrain v2 decisions? (Read pm_rulings.md.)
3. What is the current build state? (Read CHANGELOG.md.)
4. Are there any open bugs from v1 integration? (Read INTEGRATION_REPORT.md or CHANGELOG.md.)

---

## How to Handle REQ-ID Continuity Across Pipeline Runs

### The rule
REQ-IDs are sequential integers that never reset and never repeat. The counter is global across all pipeline runs for a project. If a new project starts, the counter resets to REQ-001.

### Implementation pattern
1. Always read the v1 requirements file before assigning any new IDs.
2. Find the last assigned ID (e.g., "42 requirements baseline" in the file footer).
3. Start the new sequence at last_id + 1.
4. In the v2 master requirements header, explicitly state: "REQ-NNN through REQ-MMM already assigned in pm_master_requirements.md and are DONE."
5. In the RTM, note the combined total: "Combined with v1 RTM: NNN total requirements across both runs."

### Why this matters
If an integration engineer or another agent reads requirements across pipeline runs, they can safely reference any REQ-ID without ambiguity. Duplicate IDs would create conflicting requirements that can't be resolved programmatically.

---

## Key Domain Knowledge: HKDSE Grading System

### What HKDSE is
The Hong Kong Diploma of Secondary Education (HKDSE) is the primary public examination for secondary school leavers in Hong Kong, administered by HKEAA (Hong Kong Examinations and Assessment Authority). It is the primary admission credential for JUPAS (Joint University Programmes Admissions System) applications to Hong Kong universities.

### Grade scale
Grades awarded: 5**, 5*, 5, 4, 3, 2, 1, U (Unclassified), X (Absent)
Numeric equivalents for aggregate computation: 5**=7, 5*=6, 5=5, 4=4, 3=3, 2=2, 1=1, U=0, X=0
Note: 5** and 5* are awarded only to the top performers and are distinct from grade 5.

### Aggregate calculation
University admission in Hong Kong uses the "best-5" aggregate: the sum of the best 5 subject scores including the 4 compulsory subjects where possible. Compulsory subjects must be included; then the best 1–2 elective scores fill the remaining slots.
Maximum possible aggregate: 7 × 5 = 35 (theoretical, extremely rare in practice).
Median admitted student aggregate for top universities (HKU, CUHK, HKUST): typically 22–28.

### Compulsory subjects (all HKDSE students)
- Chinese Language (CHLA)
- English Language (ENGL)
- Mathematics — Compulsory Part (MATH)
- Liberal Studies → renamed Citizenship and Social Development (CSD) from 2021

### Elective subjects
Students typically choose 2–3 elective subjects. Electives span: Arts & Humanities, Business & Economics, STEM, Languages.
Applied Learning (ApL) subjects are graded separately as "Attained" or "Attained with Distinction" — they do NOT count toward the HKDSE aggregate score but may be recognized by some programs.
Mathematics Extended Modules (M1, M2) are optional extensions of the Mathematics subject and do count toward the aggregate.

### Predicted grades
When official results are not yet available (student is in the year of the exam), counsellors use mock and trial exam results as proxies. A simple and defensible method: use the most recent sitting, factoring in teacher evaluation if available (70% latest sitting, 30% teacher rating). The system must always visually distinguish predicted from official grades.

### JUPAS
JUPAS is the central admissions system for publicly-funded university programs in Hong Kong. Institutions publish median and lower-quartile admitted scores annually. These are the most reliable data for modeling admission probability. JUPAS scores are publicly released after each academic year.

---

## Lessons Learned (v2 Pipeline Setup)

### Lesson 1: Scope the delta carefully before writing
Reading CHANGELOG.md before the v2 run saved significant re-work. The changelog contained the exact list of implemented v1 components, open bugs, and the last REQ-ID. Always read these files: CHANGELOG.md, pm_rulings.md, and the most recent INTEGRATION_REPORT.md.

### Lesson 2: New agent types need a full standalone packet
The Data Agent is entirely new in v2. It needed a standalone packet (pm_req_data_agent_v2.md) rather than an extension of an existing packet. For new agents, include: full context ("this agent did not exist in v1"), complete output file list, efficiency/process rules, and skills file instruction.

### Lesson 3: Skills files double as onboarding docs
Write skills files as if briefing a replacement agent who has never touched this project. Include not just "what I did" but "why" and "the domain knowledge required to do it." This is especially important for domain-specific knowledge like HKDSE grading rules that are not common knowledge.

### Lesson 4: Separate the ML requirements clearly
The v2 matchmaking requirements split into: rule-based mandatory (REQ-072, REQ-073), ML optional/should-have (REQ-074, REQ-075), and preference adjustment (REQ-076). Using a [ML] domain tag distinct from [BACKEND] helps agents and the RTM distinguish what must be built vs. what is an enhancement.

### Lesson 5: Async flows need explicit integration validation
Both plan generation and transcript parsing are async background tasks. These flows are easy to miss in integration testing because they require polling loops, not simple request/response validation. Assign explicit integration REQ-IDs (REQ-105, REQ-106) to force coverage.
