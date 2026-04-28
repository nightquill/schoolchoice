---
phase: "05"
plan: "01"
subsystem: consultant-engine-core
tags: [task-engine, ai-streaming, yaml-config, pydantic-schemas]
dependency_graph:
  requires: []
  provides: [TaskEngine, call_ai_stream, TaskDefinition, ConsultantPlanOutput, load_task_yaml, load_rules_yaml]
  affects: [ai_service.py, yaml_loader.py, requirements.txt]
tech_stack:
  added: [jsonschema]
  patterns: [async-generator-sse, yaml-task-definition, pii-blocklist-scan, retry-with-self-correction]
key_files:
  created:
    - backend/app/platform/task_engine.py
    - backend/app/platform/schemas/__init__.py
    - backend/app/platform/schemas/consultant_output.py
    - backend/tests/test_ai_service_stream.py
  modified:
    - backend/app/core/ai_service.py
    - backend/app/platform/yaml_loader.py
    - backend/requirements.txt
decisions:
  - "Used litellm.acompletion with stream=True for async SSE streaming (mirrors existing call_ai pattern)"
  - "PII blocklist implemented as frozenset with string scan in build_messages (simple and effective for known field names)"
  - "Token counting wrapped in try/except as best-effort guard (fails gracefully if model string unavailable)"
metrics:
  duration: "4m 38s"
  completed: "2026-04-28T18:34:23Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 3
  tests_added: 6
  tests_total_passing: 165
---

# Phase 5 Plan 01: Consultant Engine Core Foundation Summary

TaskEngine class, call_ai_stream() async SSE generator, YAML task/rules loaders, and Pydantic output schemas for AI-validated consultant plan generation.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add call_ai_stream() and jsonschema dependency | 01c9d5c | ai_service.py, requirements.txt |
| 2 | Behavioral tests for call_ai_stream() | 9ff593c | test_ai_service_stream.py |
| 3 | TaskEngine, yaml_loader extensions, Pydantic schemas | 6d54614 | task_engine.py, yaml_loader.py, consultant_output.py |

## What Was Built

### call_ai_stream() (ai_service.py)
Async generator that wraps litellm.acompletion(stream=True) and yields SSE-formatted chunks. Mirrors the existing call_ai() error handling hierarchy: 503 for missing API key, auth failures, and provider unavailability; 502 for generic errors. Emits done sentinel ("event: done\ndata: \n\n") after stream completes.

### TaskEngine (task_engine.py)
Core execution engine with 6 methods:
- `load_task()` -- searches module then platform directories for YAML task definitions
- `build_messages()` -- resolves data slots, renders Jinja2 templates, scans for PII violations, checks token budget
- `execute_task()` -- full synchronous execution with retry loop (MAX_RETRIES=2, total 3 attempts), JSON parsing, jsonschema validation
- `_resolve_data_slots()` -- maps slot types (student, matchmaker) to actual DB/service data
- `_truncate_context()` -- reduces context size when over token ceiling (top 5, truncate rationales, remove SHAP)
- `validate_all_task_yamls()` -- startup validation for early failure detection

### yaml_loader extensions
- `load_task_yaml()` -- parses task YAML into TaskDefinition dataclass with required field validation
- `load_rules_yaml()` -- parses rules YAML with domain field validation

### Pydantic output schemas (consultant_output.py)
- `ConsultantPlanOutput` -- validates AI-generated plan JSON (student_summary, recommended_schools, skill_gaps, etc.)
- `SchoolRecommendation` -- per-school model with rationale min_length, fit_score range, confidence_tier enum
- `ConsultantTaskRequest`, `ConsultantSaveRequest`, `ConsultantTaskResponse` -- endpoint schemas

## Deviations from Plan

None -- plan executed exactly as written.

## Threat Mitigations Implemented

| Threat ID | Mitigation | Location |
|-----------|-----------|----------|
| T-05-01 | jsonschema.validate() on AI output before any DB write; retry with error context on failure | task_engine.py execute_task() |
| T-05-02 | PII blocklist scan in build_messages() rejects prompts containing medical_notes, disciplinary_record, sibling_data, ssn, dob | task_engine.py build_messages() |
| T-05-03 | yaml.safe_load() exclusively in load_task_yaml() and load_rules_yaml() | yaml_loader.py |
| T-05-04 | AI_TIMEOUT passed to litellm.acompletion(); max_context_tokens ceiling in build_messages() | ai_service.py, task_engine.py |

## Known Stubs

None -- all data paths are wired to real implementations (Student model query, matchmaker_v2.run_matching).

## Verification

All 165 tests pass (6 new streaming tests + 159 existing). No regressions.

## Self-Check: PASSED

All 7 files verified on disk. All 3 task commits verified in git log.
