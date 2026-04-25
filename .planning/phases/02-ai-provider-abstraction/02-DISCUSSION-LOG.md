# Phase 2: AI Provider Abstraction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 02-ai-provider-abstraction
**Areas discussed:** Provider config model, LiteLLM integration depth, Error handling & resilience, Migration path for plan chat

---

## Provider Config Model

| Option | Description | Selected |
|--------|-------------|----------|
| Two env vars | AI_PROVIDER + AI_API_KEY with optional AI_MODEL and AI_BASE_URL | ✓ |
| LiteLLM native format | Use LiteLLM's own env var conventions (OPENAI_API_KEY etc.) | |
| Single model string | One AI_MODEL='provider/model' + AI_API_KEY | |

**User's choice:** Two env vars (Recommended)
**Notes:** Simple for non-technical deployers, covers BYOK

| Option | Description | Selected |
|--------|-------------|----------|
| Single provider | One AI_PROVIDER + AI_API_KEY for all calls | ✓ |
| Multi-provider | Per-feature provider config | |

**User's choice:** Single provider (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Smart defaults per provider | openai→gpt-4o, anthropic→claude-sonnet-4-20250514, gemini→gemini-2.5-flash | ✓ |
| Always require AI_MODEL | No defaults | |
| You decide | Claude picks | |

**User's choice:** Smart defaults per provider (Recommended)

---

## LiteLLM Integration Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Thin wrapper service | Single ai_service.py with call_ai() function, ~50 lines | ✓ |
| Async wrapper with streaming | Same but async with optional streaming | |
| LiteLLM proxy mode | Separate proxy server | |

**User's choice:** Thin wrapper service (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer streaming to Phase 5 | Keep sync in Phase 2, add async+streaming in Phase 5 | ✓ |
| Add async+streaming now | Build with streaming support from the start | |
| You decide | Claude picks | |

**User's choice:** Defer to Phase 5 (Recommended)

---

## Error Handling & Resilience

| Option | Description | Selected |
|--------|-------------|----------|
| Fail fast with clear message | No retries, no fallback, HTTP 502/503 with user-friendly error | ✓ |
| Retry once then fail | One automatic retry on transient errors | |
| Retry with exponential backoff | Up to 3 retries with backoff | |

**User's choice:** Fail fast with clear message (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 30-second default, configurable | AI_TIMEOUT env var defaults to 30s | ✓ |
| No timeout (provider default) | Let LiteLLM handle timeouts | |
| You decide | Claude picks | |

**User's choice:** 30-second default, configurable (Recommended)

---

## Migration Path for Plan Chat

| Option | Description | Selected |
|--------|-------------|----------|
| Standard messages array | Convert to [{role:'system',...}, {role:'user',...}] | ✓ |
| Keep single string | Wrap existing format, let LiteLLM handle | |

**User's choice:** Standard messages array (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Manual test script | Call plan chat with real provider keys, not automated in CI | ✓ |
| Mocked provider tests in CI | Mock LiteLLM responses, runs without API keys | |
| Both | Mocked CI tests + manual script | |

**User's choice:** Manual test script (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Remove google-generativeai entirely | LiteLLM handles Gemini natively, clean break | ✓ |
| Keep as fallback | Keep installed but unused | |
| You decide | Claude determines | |

**User's choice:** Remove entirely (Recommended)

---

## Claude's Discretion

- LiteLLM model string construction from AI_PROVIDER + AI_MODEL
- Internal ai_service.py structure
- Health endpoint AI provider reachability check method
- Error message wording
- Whether to add mocked integration tests

## Deferred Ideas

None — discussion stayed within phase scope
