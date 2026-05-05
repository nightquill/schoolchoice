---
phase: 1
slug: platform-foundation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | BUG-01,BUG-02,BUG-03,BUG-04,SEC-05 | — | HTML escaping, rolling rate limit | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | BUG-04,SEC-05 | — | SQLite compat, PyYAML dep | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | PLAT-01 | — | N/A | unit | `cd backend && python -c "from app.platform.yaml_loader import ..."` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | PLAT-02 | — | N/A | unit | `cd backend && python -m pytest tests/test_platform.py -x -v` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | PLAT-04,PLAT-05,BUG-05 | — | N/A | unit | `cd backend && python -c "from app.platform.module_loader import ..."` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | PLAT-08,SEC-03,SEC-04 | — | Health endpoint auth-free | unit | `cd backend && python -m pytest tests/test_platform.py -x -v` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | PLAT-06 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-04-02 | 04 | 2 | PLAT-06 | — | N/A | unit | `cd backend && python -c "import yaml; ..."` | ✅ | ⬜ pending |
| 01-05-01 | 05 | 3 | PLAT-06 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-05-02 | 05 | 3 | PLAT-06 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-06-01 | 06 | 4 | PLAT-07,PLAT-08,SEC-03,SEC-04 | — | N/A | integration | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-06-02 | 06 | 4 | PLAT-07 | — | N/A | integration | `cd backend && python -m pytest tests/ -x -v` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- `tests/test_platform.py` — created by Plan 01-02 Task 2 and extended by Plan 01-03 Task 2 (Wave 1). Tests entity YAML loading, CRUD generation, module discovery, health endpoint, and ORM parity check.

Note: test_platform.py is created during Wave 1 execution (not pre-existing). All other tests (60 existing) are already in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| YAML entity auto-generates CRUD endpoints | PLAT-01 | Requires running server + HTTP calls | Start dev server, POST/GET/PUT/DELETE to `/api/v1/{entity}/` |
| Health endpoint reports all subsystems | PLAT-08 | Requires running server with DB + model | Start dev server, GET `/health`, verify JSON keys |
| Startup logs report diagnostics | PLAT-07 | Requires inspecting stdout | Start dev server, check terminal output for ORM parity, XGBoost, CORS |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
