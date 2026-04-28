---
phase: "05"
plan: "03"
subsystem: school-choice-task-definition
tags: [yaml-task, matching-rules, jinja2-templates, task-engine-tests]
dependency_graph:
  requires: [TaskEngine, load_task_yaml, load_rules_yaml, RecommendationEngine]
  provides: [academic_plan.yaml, matching_rules.yaml, base_plan.html.j2, professional.html.j2, modern.html.j2, minimal.html.j2, test_task_engine.py]
  affects: [task_engine.py, yaml_loader.py, recommendation_engine.py]
tech_stack:
  added: []
  patterns: [yaml-task-definition, jinja2-template-inheritance, css-variable-theming, html-escape-filter]
key_files:
  created:
    - backend/app/modules/school_choice/tasks/academic_plan.yaml
    - backend/app/modules/school_choice/rules/matching_rules.yaml
    - backend/app/platform/templates/base_plan.html.j2
    - backend/app/modules/school_choice/templates/professional.html.j2
    - backend/app/modules/school_choice/templates/modern.html.j2
    - backend/app/modules/school_choice/templates/minimal.html.j2
    - backend/tests/test_task_engine.py
  modified: []
decisions:
  - "Jinja2 template inheritance: base_plan.html.j2 provides blocks (styles, content, scripts) that domain templates extend"
  - "html_escape custom filter used for all AI-generated text in templates (T-05-10 XSS mitigation)"
  - "TASK_DIRS fixture patches paths for pytest runs from backend/ directory"
metrics:
  duration: "4m 56s"
  completed: "2026-04-28T18:42:56Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 0
  tests_added: 12
  tests_total_passing: 198
---

# Phase 5 Plan 03: School Choice Task Definition, Templates, and Tests Summary

YAML-driven task definition (academic_plan.yaml) with matching rules, Jinja2 template hierarchy (base + 3 themes), and 12 TaskEngine unit/integration tests covering YAML loading, truncation, PII blocklist, and confidence guardrails.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create academic_plan.yaml, matching_rules.yaml, and base Jinja2 template | 550faf1 | academic_plan.yaml, matching_rules.yaml, base_plan.html.j2 |
| 2 | Create 3 domain Jinja2 templates (professional, modern, minimal) | 0abb1d6 | professional.html.j2, modern.html.j2, minimal.html.j2 |
| 3 | Unit and integration tests for TaskEngine | d450f36 | test_task_engine.py |

## What Was Built

### academic_plan.yaml
School choice task definition with data_slots (student, matchmaker), system/user prompt templates with grounding rules, JSON output_schema with required fields (student_summary, recommended_schools, action_plan), max_tokens=4096, temperature=0.3, enable_chat=true, max_context_tokens=60000. Links to TaskEngine.load_task("academic_plan") via task_id.

### matching_rules.yaml
School choice eligibility and scoring rules: 2 comparison rules (minimum_aggregate_score, ielts_requirement) plus 1 custom hook (required_subjects), scoring weights summing to 1.0 (academic_fit 0.50, subject_alignment 0.20, language_fit 0.15, interest_alignment 0.15), ML model config with blend_weight=0.4 and shap_enabled=true, confidence thresholds (high=0.7, medium=0.4).

### base_plan.html.j2
Platform-level base Jinja2 template with HTML5 doctype, Chart.js CDN, CSS reset, CSS variables for theming, print-safe styles, and three Jinja2 blocks: styles, content, scripts. Provides plan-container, section, header, table, school-card, score-bar, and confidence-badge CSS classes.

### Domain Templates (professional, modern, minimal)
Three templates extending base_plan.html.j2 via template inheritance. Each overrides CSS variables for its theme:
- professional: #1e3a5f heading, Georgia serif, 32px gap
- modern: #0d9488 heading, Inter sans-serif, 40px gap, rounded 12px corners
- minimal: #1a1a1a heading, system-ui, 16px gap, no box-shadow, sharp edges

All templates render: header, student summary, academic profile table, recommended schools with fit score bars and confidence badges, action plan table, skill gaps list, language readiness. Chart.js scripts injected via chart_data context variable.

### test_task_engine.py (12 tests)
- TestLoadTask (4): YAML loading, not-found ValueError, validate_all returns empty, field values
- TestTruncation (3): reduces to top 5 with shap removal, does not mutate original, keeps highest scores
- TestPIIBlocklist (2): rejects medical_notes in prompt, blocklist contains expected fields
- TestConfidenceGuardrail (3): LOW for 0.3 completeness, MEDIUM for 0.55, HIGH for 0.85

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Mitigations Implemented

| Threat ID | Mitigation | Location |
|-----------|-----------|----------|
| T-05-08 | System prompt includes 5 explicit grounding rules preventing fabrication; output_schema validates structure | academic_plan.yaml |
| T-05-09 | Only data_slots fields (student, matchmaker) enter the prompt; PII blocklist test confirms medical_notes blocked | test_task_engine.py TestPIIBlocklist |
| T-05-10 | All AI-generated text passed through html_escape filter in all 3 domain templates | professional/modern/minimal.html.j2 |

## Known Stubs

None -- all templates are fully functional with complete section rendering and Chart.js integration.

## TDD Gate Compliance

- RED: test_task_engine.py written with 12 test functions (Task 3 is TDD-flagged)
- GREEN: All 12 tests pass against existing TaskEngine implementation (from Plan 01) plus new YAML artifacts
- REFACTOR: No refactoring needed

## Verification

- All 12 new tests pass: `pytest tests/test_task_engine.py -v` (0.10s)
- Full suite regression: 198 tests pass (12 new + 186 existing)
- YAML loading verified: load_task_yaml() parses academic_plan.yaml, load_rules_yaml() parses matching_rules.yaml
- Template files verified: all 3 extend base, contain correct CSS variables and html_escape filter usage
- Existing plan_generator.py NOT modified

## Self-Check: PASSED

All 7 files verified on disk. All 3 task commits verified in git log.
