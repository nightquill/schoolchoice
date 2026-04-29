---
phase: 06
slug: deployment-and-production-readiness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) + vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | SEC-01 | — | Staff user gets 403 on admin routes | integration | `pytest tests/test_admin_users.py` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | SEC-02 | — | Admin can CRUD users via API | integration | `pytest tests/test_admin_users.py` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DEP-01 | — | generate_secrets.sh produces valid .env | script | `bash scripts/generate_secrets.sh && grep -q SECRET_KEY .env` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | DEP-02 | — | App refuses to start with placeholder secrets | integration | `pytest tests/test_startup_validation.py` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | DEP-03 | — | seed_demo.py creates demo data idempotently | script | `python scripts/seed_demo.py && python scripts/seed_demo.py` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | DEP-04 | — | vercel build succeeds | build | `cd frontend && npx vercel build` | ✅ | ⬜ pending |
| 06-04-02 | 04 | 2 | DEP-05 | — | GitHub Actions CI workflow passes | ci | `act -j test` (local) or PR check | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 2 | DEP-06 | — | Railway start command works | manual | See manual verifications | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_admin_users.py` — RBAC enforcement + admin user management tests (SEC-01, SEC-02)
- [ ] `backend/tests/test_startup_validation.py` — Startup env validation tests (DEP-02)

*Existing test infrastructure (pytest, vitest) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway deploy starts successfully | DEP-06 | Requires Railway platform access | Deploy to Railway, verify `uvicorn` starts on assigned port |
| Vercel deploy serves frontend | DEP-04 | Requires Vercel platform access | Run `vercel deploy`, navigate to URL, verify app loads |
| Full demo scenario works end-to-end | DEP-03 | Requires running database + both services | Run seed_demo.py, log in as demo user, verify sample data visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
