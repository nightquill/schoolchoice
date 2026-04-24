---
phase: 1
slug: platform-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 01-01-01 | 01 | 1 | PLAT-01 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | PLAT-02 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 1 | PLAT-04 | — | N/A | unit | `cd backend && python -m pytest tests/ -x -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The 60-test suite already exercises all features that must remain green.

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
