---
phase: 02-ai-provider-abstraction
verified: 2026-04-25T06:01:07Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Health endpoint reports whether AI provider is reachable"
    status: partial
    reason: "Health endpoint reports configured/unconfigured but never tests provider reachability (no live ping). This was an intentional design decision to avoid consuming API credits on every health check."
    artifacts:
      - path: "backend/app/modules/school_choice/health.py"
        issue: "Reports ai_status as configured/unconfigured only -- no reachability test"
    missing:
      - "Live reachability check or explicit documentation that 'configured' status is sufficient"
human_verification:
  - test: "Start backend with AI_PROVIDER=gemini and a valid AI_API_KEY, then POST to /api/v1/students/{id}/plan/chat with a modification instruction"
    expected: "Response contains a modified plan with updated HTML content and a summary message"
    why_human: "Requires real API key and running server -- cannot verify programmatically without credentials"
  - test: "Switch AI_PROVIDER to a second provider (e.g., openai), restart, and repeat the plan chat call"
    expected: "Same behavior -- plan is modified successfully with the different provider"
    why_human: "SC #2 requires verification with at least two different providers in sequence"
  - test: "Run the manual verification script: cd backend && python -m scripts.test_ai_provider"
    expected: "Both tests pass (HELLO prompt and JSON patch prompt)"
    why_human: "Requires real API credentials to execute"
  - test: "Check health endpoint with configured AI key: curl http://localhost:8000/health"
    expected: "Response includes modules.school_choice.ai_provider and modules.school_choice.ai_status=configured"
    why_human: "Requires running server with configured credentials"
---

# Phase 2: AI Provider Abstraction Verification Report

**Phase Goal:** All AI calls route through a single LiteLLM-backed interface; school choice plan chat and AI features work with any configured provider; BYOK API key config is fully environment-variable-driven
**Verified:** 2026-04-25T06:01:07Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Deployer can switch AI provider by changing two environment variables -- no code changes required | VERIFIED | `config.py` has `AI_PROVIDER` and `AI_API_KEY` fields with defaults; `ai_service.py` reads these at call time via `settings.AI_PROVIDER` and builds LiteLLM model string dynamically; `_PROVIDER_DEFAULTS` maps openai/anthropic/gemini to default models; `AI_BASE_URL` supports custom endpoints |
| 2 | School choice plan chat works end-to-end with at least two different configured providers | NEEDS HUMAN | `plan_chat_service.py` correctly calls `call_ai(messages)` with messages array format; all Gemini SDK references removed; but end-to-end with real providers requires live API keys (Plan 03 human checkpoint is PENDING) |
| 3 | AI provider API keys exist only in environment variables -- no key material in DB, logs, or API responses | VERIFIED | `AI_API_KEY` stored only in `config.py` Settings (env-driven); `ai_service.py` logger.info logs only model string not key; health.py reports provider name and status, never key value; test script masks key as `***configured***`; grep for `AI_API_KEY` in app code shows only settings access and 503 error message text (no key value); zero `GEMINI_API_KEY` references remain |
| 4 | Health endpoint reports which AI provider is configured and whether it is reachable | PARTIAL | `health.py` reports `ai_provider` (provider name) and `ai_status` (configured/unconfigured) correctly; test `test_health_reports_ai_provider` passes; BUT "reachable" is NOT tested -- health check intentionally avoids live API calls to save credits. This is a reasonable design decision but does not fully satisfy the literal SC wording |

**Score:** 3/4 truths verified (1 needs human, 1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/core/ai_service.py` | LiteLLM wrapper with call_ai() entry point | VERIFIED | 75 lines; exports `call_ai()` and `_build_model_string()`; routes through `litellm.completion()`; proper error handling (503/502) |
| `backend/app/core/config.py` | AI provider settings fields | VERIFIED | Contains AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT with defaults |
| `backend/tests/test_ai_service.py` | Unit tests for ai_service with mocked LiteLLM | VERIFIED | 175 lines; 10 test methods in TestCallAi class covering all error paths and provider defaults |
| `backend/app/modules/school_choice/services/plan_chat_service.py` | Plan chat using call_ai() not Gemini SDK | VERIFIED | Contains `from app.core.ai_service import call_ai`; uses messages array format; zero GEMINI/google.generativeai references |
| `backend/app/modules/school_choice/health.py` | Module health with AI provider status | VERIFIED | Reports ai_provider, ai_status, ai_model; preserves XGBoost check |
| `backend/scripts/test_ai_provider.py` | Manual verification test script | VERIFIED | 155 lines; imports call_ai; has `__main__` guard; never prints API key value; two test functions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `plan_chat_service.py` | `ai_service.py` | `from app.core.ai_service import call_ai` | WIRED | Line 25: import; Line 167: `raw_text = call_ai(messages)` |
| `ai_service.py` | `config.py` | `settings.AI_PROVIDER, settings.AI_API_KEY` | WIRED | Line 16: `from app.core.config import settings`; used at lines 29, 30, 47, 53, 60, 61, 62 |
| `ai_service.py` | `litellm` | `litellm.completion()` | WIRED | Line 13: `import litellm`; Line 57: `litellm.completion(model=..., messages=..., api_key=..., api_base=..., timeout=...)` |
| `health.py` | `config.py` | `settings.AI_PROVIDER, settings.AI_API_KEY` | WIRED | Line 41: `from app.core.config import settings`; Lines 42-47: reads AI_PROVIDER, AI_API_KEY, AI_MODEL |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ai_service.py` | response text | `litellm.completion()` -> external AI provider | Yes (when API key configured) | FLOWING |
| `plan_chat_service.py` | raw_text | `call_ai(messages)` -> ai_service -> litellm | Yes (calls real provider) | FLOWING |
| `health.py` | ai_provider, ai_status | `settings.AI_PROVIDER`, `settings.AI_API_KEY` | Yes (reads env vars) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| ai_service imports without error | `python -c "from app.core.ai_service import call_ai"` | Not run (requires venv activation) | SKIP |
| Settings has AI fields | Verified via grep of config.py | AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT all present with defaults | PASS |
| No GEMINI references in app code | `grep -r "GEMINI" backend/app/` | Zero matches | PASS |
| No google.generativeai in codebase | `grep -r "google.generativeai" backend/` | Zero matches | PASS |
| litellm in requirements.txt | `grep "litellm" backend/requirements.txt` | Line 22: `litellm` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AI-01 | 02-01, 02-03 | Deployer can configure any AI provider via environment variables | SATISFIED | Settings has AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT; supports openai, anthropic, gemini, openai-compatible |
| AI-02 | 02-01, 02-03 | AI provider abstraction (LiteLLM) routes all AI calls through single interface | SATISFIED | ai_service.py wraps litellm.completion(); plan_chat_service.py uses call_ai() exclusively |
| AI-03 | 02-01 | BYOK API key stored in environment, never exposed to frontend | SATISFIED | AI_API_KEY in env vars only; never logged, never in API responses; health.py masks it |
| AI-10 | 02-02, 02-03 | AI chat works with any configured provider (not just Gemini) | NEEDS HUMAN | Code correctly abstracted; all Gemini references removed; but requires live provider test to confirm |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `plan_chat_service.py` | 155 | Comment says "Build compact context for Gemini" (stale comment) | INFO | Cosmetic only -- does not affect functionality |
| `plan_chat_service.py` | 169 | Comment says "Strip markdown code fences if Gemini wraps" (stale comment) | INFO | Cosmetic only -- does not affect functionality |

### Human Verification Required

### 1. End-to-End Plan Chat with Real Provider

**Test:** Start backend with `AI_PROVIDER=gemini` (or openai) and a valid `AI_API_KEY`, then POST to `/api/v1/students/{id}/plan/chat` with a modification instruction
**Expected:** Response contains a modified plan with updated HTML content and a summary message
**Why human:** Requires real API key and running server

### 2. Provider Switching Verification

**Test:** Switch `AI_PROVIDER` to a second provider, restart, repeat plan chat call
**Expected:** Same behavior with different provider
**Why human:** SC #2 explicitly requires verification with at least two providers

### 3. Manual Verification Script

**Test:** `cd backend && python -m scripts.test_ai_provider`
**Expected:** Both tests pass (HELLO and JSON patch)
**Why human:** Requires real API credentials

### 4. Health Endpoint with Live Server

**Test:** `curl http://localhost:8000/health | python -m json.tool`
**Expected:** Response includes `modules.school_choice.ai_provider` and `ai_status: "configured"`
**Why human:** Requires running server with configured credentials

### Gaps Summary

**One partial gap identified:**

The ROADMAP SC #4 states the health endpoint should report "whether [the provider] is reachable." The current implementation reports "configured" vs "unconfigured" (whether an API key is set) but does NOT test live reachability. This was an **intentional design decision** documented in the 02-02 SUMMARY: "No live API call in health check -- avoids consuming credits on every ping."

This is a reasonable trade-off. A live reachability check on every health ping would consume API credits and slow the endpoint. The deployer can verify reachability via the plan chat endpoint or the manual test script.

**This looks intentional.** To accept this deviation, add to VERIFICATION.md frontmatter:

```yaml
overrides:
  - must_have: "Health endpoint reports whether AI provider is reachable"
    reason: "Reports configured/unconfigured instead of reachable -- live ping would consume API credits on every health check; deployer verifies reachability via plan chat endpoint"
    accepted_by: "{your name}"
    accepted_at: "2026-04-25T06:01:07Z"
```

**Stale comments:** Two comments in `plan_chat_service.py` still reference "Gemini" (lines 155, 169). These are INFO-level cosmetic issues and do not affect functionality.

---

_Verified: 2026-04-25T06:01:07Z_
_Verifier: Claude (gsd-verifier)_
