---
phase: 5
slug: consultant-engine
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-28
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q --tb=short` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q --tb=short`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v && cd ../frontend && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | AI-04, AI-05 | — | N/A | unit | `grep + python import checks` | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | AI-06 | — | N/A | unit | `pytest tests/test_ai_service_stream.py -v -x` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | AI-04, AI-05 | — | N/A | unit | `python -c imports + ls` | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | AI-07, AI-08 | — | N/A | unit | `python -c imports` | N/A | ⬜ pending |
| 05-02-02 | 02 | 1 | AI-07, AI-08, AI-09 | — | N/A | unit | `pytest tests/test_recommendation_engine.py -v -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | AI-04, AI-06 | — | N/A | unit | `python -c load + test -f` | N/A | ⬜ pending |
| 05-03-02 | 03 | 2 | AI-06 | — | N/A | unit | `grep + test -f` | N/A | ⬜ pending |
| 05-03-03 | 03 | 2 | AI-04, AI-06 | — | N/A | unit | `pytest tests/test_task_engine.py -v -x` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 3 | AI-05, AI-06 | — | N/A | integration | `python import + grep` | N/A | ⬜ pending |
| 05-04-02 | 04 | 3 | AI-05, AI-06 | — | N/A | integration | `pytest tests/test_consultant_routes.py -v -x` | ❌ W0 | ⬜ pending |
| 05-05-01 | 05 | 3 | AI-09 | — | N/A | unit | `test -f + grep` | N/A | ⬜ pending |
| 05-05-02 | 05 | 3 | AI-05, AI-06 | — | N/A | unit | `test -f + grep` | N/A | ⬜ pending |
| 05-06-01 | 06 | 4 | All | — | N/A | integration | `pytest tests/ -x -q` | N/A | ⬜ pending |
| 05-06-02 | 06 | 4 | All | — | N/A | manual | checkpoint:human-verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_ai_service_stream.py` — behavioral tests for call_ai_stream() SSE format (AI-06)
- [ ] `tests/test_recommendation_engine.py` — unit tests for RecommendationEngine, confidence tiers, SHAP (AI-07, AI-08, AI-09)
- [ ] `tests/test_task_engine.py` — integration tests for TaskEngine execute_task flow (AI-04, AI-05)
- [ ] `tests/test_consultant_routes.py` — endpoint tests for stream/save/status routes (AI-05, AI-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE streaming renders progressively in browser | AI-06 | Requires real browser interaction with EventSource | Open entity page, trigger generation, observe streaming text appearance |
| Chart.js renders correctly in generated HTML | AI-04 | Visual verification of chart rendering | Generate plan, inspect chart renders in browser |
| Print/PDF export preserves styling | AI-04 | Requires browser print preview | Generate plan, Ctrl+P, verify layout |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
