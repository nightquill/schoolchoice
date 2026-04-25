---
phase: 4
slug: import-and-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | `pytest.ini` / `vite.config.ts` |
| **Quick run command** | `cd backend && python -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DATA-01 | — | File type validation | unit | `pytest tests/test_import.py -k parse` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DATA-02 | — | Column mapping accuracy | unit | `pytest tests/test_import.py -k mapping` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DATA-03 | — | Validation error reporting | unit | `pytest tests/test_import.py -k validate` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | DATA-04 | — | Import commit atomicity | integration | `pytest tests/test_import.py -k commit` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | DATA-05 | — | Error CSV download | unit | `pytest tests/test_export.py -k error_csv` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DATA-06 | — | Entity CSV export | unit | `pytest tests/test_export.py -k entity_csv` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | DATA-07 | — | HTML report export | unit | `pytest tests/test_export.py -k html_export` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | DATA-08 | — | Search and filter | integration | `pytest tests/test_search.py` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_import.py` — stubs for DATA-01 through DATA-04
- [ ] `tests/test_export.py` — stubs for DATA-05 through DATA-07
- [ ] `tests/test_search.py` — stubs for DATA-08
- [ ] `openpyxl==3.0.9` added to requirements.txt

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Column-mapping UI drag/select | DATA-02 | Visual interaction | Upload CSV, verify column dropdowns appear, map columns, confirm preview updates |
| HTML report renders in browser | DATA-07 | Browser rendering | Export report, open downloaded .html in browser, verify layout and styling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
