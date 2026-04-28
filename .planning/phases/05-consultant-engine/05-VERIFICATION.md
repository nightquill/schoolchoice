---
phase: 05-consultant-engine
verified: 2026-04-28T19:30:00Z
status: gaps_found
score: 4/5
overrides_applied: 0
gaps:
  - truth: "User can open an AI chat panel for any entity, ask a question about that entity's data, and receive a streamed response without a page reload"
    status: failed
    reason: "Frontend calls POST /api/v1/consultant/tasks/{taskId}/chat via sendConsultantChat() but no corresponding backend endpoint exists in consultant.py. Only 3 endpoints exist: stream, status, save. Chat would return 404."
    artifacts:
      - path: "frontend/src/api/consultant.js"
        issue: "sendConsultantChat calls /api/v1/consultant/tasks/{taskId}/chat — endpoint does not exist"
      - path: "backend/app/api/v1/routes/consultant.py"
        issue: "Only 3 routes defined (@router.get stream, @router.get status, @router.post save) — no chat endpoint"
    missing:
      - "Add POST /consultant/tasks/{task_id}/chat endpoint to consultant.py that accepts entity_id and message, calls TaskEngine to build context, invokes call_ai for modification, and returns updated plan"
      - "Alternatively, wire the frontend to use the existing plan chat endpoint at /{student_id}/plan/chat (but this would not generalize for non-school-choice entities)"
human_verification:
  - test: "Navigate to /students/:id/consultant, click Generate Plan, observe SSE streaming tokens appearing progressively"
    expected: "Tokens appear within 1-2 seconds, plan renders after stream completes with confidence badges visible in iframe"
    why_human: "Requires running app with real AI provider API key to verify end-to-end SSE streaming"
  - test: "After plan generates, attempt to use the chat panel to modify the plan"
    expected: "Chat sends message and receives AI response (currently expected to fail with 404 until chat endpoint is added)"
    why_human: "Requires running app with real AI provider to verify chat integration"
  - test: "Switch template via selector and verify plan re-renders with new theme colors"
    expected: "Professional (blue), Modern (teal), Minimal (gray) each apply correctly"
    why_human: "Visual verification of template theming in rendered plan iframe"
  - test: "Resize browser to < 768px and verify single-column layout with collapsible chat"
    expected: "Chat panel collapses below plan, toggle button works"
    why_human: "Visual/interactive mobile layout verification"
---

# Phase 5: Consultant Engine Verification Report

**Phase Goal:** Users can trigger YAML-driven AI consultant tasks that stream structured output via SSE; school choice plan generation is migrated to the task engine; recommendation engine is generalized with configurable rules, scoring, and confidence badges across domains
**Verified:** 2026-04-28T19:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open an AI chat panel for any entity, ask a question about that entity's data, and receive a streamed response without a page reload | FAILED | Chat panel renders in UI (ConsultantTask.jsx line 650-684) but sendConsultantChat calls POST /api/v1/consultant/tasks/{taskId}/chat which has no backend endpoint — consultant.py only defines stream, status, save routes |
| 2 | User can trigger a school choice fit analysis as a single-click consultant task — the engine assembles data, runs AI, and produces a complete structured plan with streaming output | VERIFIED | GET /consultant/tasks/{task_id}/stream returns StreamingResponse with call_ai_stream(); TaskEngine.load_task + build_messages + data slot resolution wired; save endpoint validates via jsonschema + Pydantic + confidence guardrail; 50 tests pass |
| 3 | Developer can define a new consultant task by writing a YAML file — no Python code changes required to add task definitions or AI prompt templates | VERIFIED | academic_plan.yaml loads via TaskEngine.load_task("academic_plan"); TaskEngine searches TASK_DIRS; validate_all_task_yamls() runs at startup (main.py line 248); load_task_yaml parses into TaskDefinition dataclass |
| 4 | Each school recommendation displays an eligibility confidence indicator (e.g., LOW / MEDIUM / HIGH) reflecting how complete the student's data is | VERIFIED | Jinja2 templates (professional/modern/minimal.html.j2) render confidence badges with CSS classes .confidence-badge.high/.medium/.low; base_plan.html.j2 has CSS styling; save endpoint applies confidence guardrail via _apply_confidence_guardrail(); React ConfidenceBadge.jsx exists but is orphaned (not imported by ConsultantTask.jsx) — badges display via server-rendered HTML in plan iframe |
| 5 | The hybrid recommendation engine (eligibility rules + weighted scoring + optional XGBoost) works for the school choice domain and the configuration interface allows a second domain to plug in its own rules and weights | VERIFIED | RecommendationEngine (347 lines) with evaluate_eligibility, compute_weighted_score, blend_ml_score, compute_confidence_tier, is_shap_enabled, run_recommendations; hook-based architecture accepts domain-specific scoring_hooks dict and completeness_fn callable; matching_rules.yaml defines school_choice domain config; 21 recommendation engine tests pass |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/platform/task_engine.py` | TaskEngine class with load_task, build_messages, execute_task | VERIFIED | 299 lines, all methods present, wired to ai_service.py and yaml_loader.py |
| `backend/app/core/ai_service.py` | call_ai_stream async generator | VERIFIED | 127 lines, async def call_ai_stream with SSE format and done sentinel |
| `backend/app/platform/yaml_loader.py` | load_task_yaml and load_rules_yaml | VERIFIED | 121 lines, both functions present, called by TaskEngine |
| `backend/app/platform/schemas/consultant_output.py` | Pydantic output models | VERIFIED | 58 lines, ConsultantPlanOutput, SchoolRecommendation, ConsultantSaveRequest, ConsultantTaskResponse |
| `backend/app/platform/recommendation_engine.py` | RecommendationEngine | VERIFIED | 347 lines, 6 methods, 3 dataclasses, operator whitelist |
| `backend/app/modules/school_choice/tasks/academic_plan.yaml` | Task YAML definition | VERIFIED | task_id: academic_plan, data_slots, prompts, output_schema |
| `backend/app/modules/school_choice/rules/matching_rules.yaml` | Rules YAML | VERIFIED | domain: school_choice, confidence_thresholds, eligibility_rules, scoring_weights, ml_model |
| `backend/app/platform/templates/base_plan.html.j2` | Base HTML template | VERIFIED | block content, block styles, Chart.js CDN, confidence badge CSS |
| `backend/app/modules/school_choice/templates/professional.html.j2` | Professional theme | VERIFIED | extends base_plan.html.j2, heading color #1e3a5f |
| `backend/app/modules/school_choice/templates/modern.html.j2` | Modern theme | VERIFIED | extends base_plan.html.j2, heading color #0d9488 |
| `backend/app/modules/school_choice/templates/minimal.html.j2` | Minimal theme | VERIFIED | extends base_plan.html.j2, heading color #1a1a1a |
| `backend/app/api/v1/routes/consultant.py` | Consultant API router | VERIFIED | 3 endpoints (stream, status, save), rate limiting, query param auth |
| `backend/tests/test_ai_service_stream.py` | SSE streaming tests | VERIFIED | 6 tests, all pass |
| `backend/tests/test_recommendation_engine.py` | Recommendation engine tests | VERIFIED | 21 tests, all pass |
| `backend/tests/test_task_engine.py` | TaskEngine tests | VERIFIED | 12 tests, all pass |
| `backend/tests/test_consultant_routes.py` | Consultant route tests | VERIFIED | 11 tests, all pass |
| `frontend/src/pages/ConsultantTask/ConsultantTask.jsx` | Consultant page | VERIFIED | 31162 bytes, EventSource SSE, streamTokensRef, saveConsultantTask, TemplateSelector, PlanSectionEditor |
| `frontend/src/components/SSEStreamDisplay/SSEStreamDisplay.jsx` | SSE display component | VERIFIED | 3212 bytes, aria-live="polite", role="status", auto-scroll, blinking cursor |
| `frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx` | Confidence badge | ORPHANED | 3209 bytes, component is substantive with Popover, correct CSS variables, but NOT imported by ConsultantTask.jsx or any other file |
| `frontend/src/api/consultant.js` | API client | VERIFIED | saveConsultantTask, getConsultantTaskStatus, sendConsultantChat exports |
| `frontend/src/App.jsx` | Route registration | VERIFIED | /students/:id/consultant route added, /students/:id/plan preserved |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| task_engine.py | ai_service.py | from app.core.ai_service import call_ai | WIRED | Import at line 22, call_ai() used in execute_task |
| task_engine.py | yaml_loader.py | load_task_yaml | WIRED | Imported in load_task() method, called in load_task and validate_all_task_yamls |
| consultant.py | task_engine.py | TaskEngine() | WIRED | Imported and used in stream, save endpoints |
| consultant.py | ai_service.py | call_ai_stream | WIRED | Imported and called in stream endpoint |
| main.py | consultant.py | app.include_router(consultant.router) | WIRED | Line 241 |
| main.py | task_engine.py | validate_all_task_yamls | WIRED | Line 248 |
| academic_plan.yaml | task_engine.py | TaskEngine.load_task("academic_plan") | WIRED | Test test_load_task_yaml passes |
| professional.html.j2 | base_plan.html.j2 | extends "base_plan.html.j2" | WIRED | All 3 templates extend base |
| ConsultantTask.jsx | SSEStreamDisplay.jsx | import SSEStreamDisplay | WIRED | Line 11, rendered at lines 593 and 629 |
| ConsultantTask.jsx | consultant.js | import saveConsultantTask | WIRED | Line 17, called in done handler |
| ConsultantTask.jsx | ConfidenceBadge.jsx | (expected import) | NOT_WIRED | ConfidenceBadge never imported; badges rendered via Jinja2 in iframe instead |
| consultant.js sendConsultantChat | consultant.py /chat | POST endpoint | NOT_WIRED | Frontend calls /api/v1/consultant/tasks/{taskId}/chat — endpoint does not exist on backend |
| App.jsx | ConsultantTask.jsx | Route /students/:id/consultant | WIRED | Lines 25, 60 |
| dependencies.py | consultant.py | get_current_user_or_query_token | WIRED | Defined at line 69, used in stream endpoint |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ConsultantTask.jsx | streamTokens | EventSource from /consultant/tasks/{id}/stream | SSE tokens from call_ai_stream (requires AI provider key) | FLOWING (via AI provider) |
| ConsultantTask.jsx | plan | saveConsultantTask -> DB -> getPlan | AcademicPlan DB row with html_content | FLOWING |
| ConsultantTask.jsx | student | getStudent(id) | Student DB row | FLOWING |
| consultant.py stream | messages | TaskEngine.build_messages -> DB student + matchmaker | Real DB queries via _resolve_data_slots | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All phase 5 tests pass | `pytest tests/test_ai_service_stream.py test_recommendation_engine.py test_task_engine.py test_consultant_routes.py` | 50 passed in 0.48s | PASS |
| Full suite no regressions | `pytest tests/ -x -q` | 209 passed in 3.22s | PASS |
| Frontend builds | `npx vite build` | Built in 711ms, no errors | PASS |
| TaskEngine.load_task("academic_plan") | Via test_load_task_yaml test | Passes with correct task_id, data_slots | PASS |
| Confidence tier computation | Via test_confidence_tier_high/medium/low | Returns correct tiers for 0.85/0.55/0.3 | PASS |
| PII blocklist enforcement | Via test_pii_blocklist_rejects_medical_notes | ValueError raised for PII fields | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-04 | 01, 03 | Developer can define guided AI workflows in YAML | SATISFIED | TaskDefinition dataclass, academic_plan.yaml, load_task_yaml, validate_all_task_yamls |
| AI-05 | 01, 04 | Guided workflow engine executes YAML-defined workflows with session state | SATISFIED | TaskEngine.execute_task, SSE stream endpoint, save endpoint with validation |
| AI-06 | 03, 04 | School choice plan generation rebuilt as guided workflow on platform engine | SATISFIED | academic_plan.yaml task definition, stream/save endpoints, ConsultantTaskPage |
| AI-07 | 02 | Hybrid recommendation engine generalized: configurable eligibility rules + weighted scoring + optional ML | SATISFIED | RecommendationEngine with evaluate_eligibility, compute_weighted_score, blend_ml_score, matching_rules.yaml |
| AI-08 | 02 | SHAP explainability available for any domain module using ML scoring component | SATISFIED | is_shap_enabled() reads from rules YAML config, shap_fn parameter in run_recommendations |
| AI-09 | 02, 05 | Eligibility confidence indicator shows data completeness level on each recommendation | SATISFIED | compute_confidence_tier returns LOW/MEDIUM/HIGH, confidence_thresholds configurable via YAML, badges rendered in Jinja2 templates |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| frontend/src/components/ConfidenceBadge/ConfidenceBadge.jsx | - | ORPHANED: Component exists (122 lines, substantive) but never imported by any file | WARNING | Unused code; confidence badges display via Jinja2 templates instead |
| frontend/src/api/consultant.js | 18-22 | sendConsultantChat calls non-existent backend endpoint /consultant/tasks/{taskId}/chat | BLOCKER | Chat feature broken — will return 404 |
| frontend/src/api/consultant.js | 24-29 | changeConsultantTemplate calls non-existent backend endpoint /consultant/tasks/{taskId}/template | INFO | Function defined but not called in ConsultantTask.jsx (template uses existing plan API) |

### Human Verification Required

### 1. SSE Streaming End-to-End

**Test:** Navigate to /students/:id/consultant, click Generate Plan, observe SSE streaming
**Expected:** Tokens appear progressively, plan renders after completion with confidence badges in iframe
**Why human:** Requires running app with real AI provider API key

### 2. Chat Modification (Currently Blocked)

**Test:** After plan generates, attempt to use chat panel to modify plan
**Expected:** Will fail with 404 until consultant chat backend endpoint is added
**Why human:** Requires running app with real AI provider

### 3. Template Switching

**Test:** Click through Professional/Modern/Minimal templates
**Expected:** Plan re-renders with correct theme colors (blue/teal/gray)
**Why human:** Visual verification of themed rendering

### 4. Mobile Responsiveness

**Test:** Resize to < 768px, verify single-column layout
**Expected:** Chat panel collapsible below plan content
**Why human:** Interactive layout verification

### Gaps Summary

**1 gap blocking goal achievement:**

The consultant chat feature is broken. The frontend ConsultantTask.jsx renders a chat panel and calls `sendConsultantChat()` which POSTs to `/api/v1/consultant/tasks/{taskId}/chat`. This endpoint does not exist in `consultant.py` (which only defines stream, status, and save). The user will see a chat panel but any message sent will return a 404 error.

This blocks Roadmap SC #1: "User can open an AI chat panel for any entity, ask a question about that entity's data, and receive a streamed response without a page reload."

**Fix options:**
1. Add a POST `/consultant/tasks/{task_id}/chat` endpoint to `consultant.py` that loads the existing plan, builds a chat context with the AI output, calls `call_ai()`, and returns the modified plan
2. Alternatively, wire the frontend to use the existing plan chat endpoint at `/{student_id}/plan/chat` from `plan.py` (but this couples the consultant page to school-choice-specific routes)

The orphaned ConfidenceBadge React component is a WARNING but does not block the goal since confidence badges render correctly via the Jinja2 templates in the plan iframe.

---

_Verified: 2026-04-28T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
