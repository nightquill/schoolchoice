# Phase 2: AI Provider Abstraction - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hardcoded Gemini SDK integration with a LiteLLM-backed multi-provider abstraction layer. All AI calls route through a single interface. Deployers configure their provider via environment variables (BYOK). School choice plan chat and AI features work with any configured provider. No new AI features are added — this is purely an abstraction and migration phase.

</domain>

<decisions>
## Implementation Decisions

### Provider Configuration
- **D-01:** Two primary env vars: `AI_PROVIDER` (openai, anthropic, gemini, openai-compatible) + `AI_API_KEY`. These are added to Pydantic `Settings` in `core/config.py`.
- **D-02:** Optional overrides: `AI_MODEL` (defaults per provider if not set) and `AI_BASE_URL` (required only for openai-compatible endpoints).
- **D-03:** Smart defaults when `AI_MODEL` is not set: openai→gpt-4o, anthropic→claude-sonnet-4-20250514, gemini→gemini-2.5-flash, openai-compatible→requires explicit AI_MODEL.
- **D-04:** Single provider at a time — one `AI_PROVIDER` + `AI_API_KEY` drives all AI calls. Multi-provider routing deferred to Phase 5 if needed.

### LiteLLM Integration
- **D-05:** Thin synchronous wrapper in `backend/app/core/ai_service.py`. Imports `litellm.completion()`, maps Settings env vars to LiteLLM params, exposes a simple `call_ai(messages, **kwargs)` function. All AI callers go through this single entry point.
- **D-06:** Synchronous only in Phase 2. Streaming and async deferred to Phase 5 (Consultant Engine) when real-time chat requires it.
- **D-07:** LiteLLM model string constructed from `AI_PROVIDER` + `AI_MODEL` (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, `gemini/gemini-2.5-flash`).

### Error Handling
- **D-08:** Fail fast with clear message — no retries, no fallback provider. Return HTTP 502 (bad AI response) or 503 (provider unreachable/unconfigured) with user-friendly error text.
- **D-09:** Configurable timeout via `AI_TIMEOUT` env var, defaulting to 30 seconds. Prevents hanging requests.

### Migration Path
- **D-10:** Plan chat converts from single-string prompt to standard messages array: `[{role:'system', content:SYSTEM_PROMPT}, {role:'user', content:context+instruction}]`. This is LiteLLM's native format.
- **D-11:** The `google-generativeai` SDK dependency is removed entirely. LiteLLM handles Gemini natively via the `gemini/` model prefix.
- **D-12:** JSON-patch contract in plan chat is preserved — the system prompt and response parsing logic stay the same, only the AI call mechanism changes.

### Health & Verification
- **D-13:** Health endpoint (from Phase 1 D-15) extended to report: which AI provider is configured and whether it is reachable (a lightweight test call or API key validation).
- **D-14:** Verification via manual test script — calls plan chat endpoint with a real plan, run with each provider's API key configured in sequence. Not automated in CI (requires real API keys).

### Claude's Discretion
- How Settings constructs the LiteLLM model string from AI_PROVIDER + AI_MODEL
- Internal structure of ai_service.py (helper functions, error mapping)
- How health endpoint checks AI provider reachability (test completion vs key validation)
- Exact error message wording for different failure modes
- Whether to add a lightweight integration test with mocked LiteLLM responses

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Project Context
- `.planning/REQUIREMENTS.md` — Phase 2 covers AI-01, AI-02, AI-03, AI-10
- `.planning/PROJECT.md` — Constraints: no Docker, BYOK support, non-technical deployers
- `.planning/ROADMAP.md` — Phase 2 goal and 4 success criteria

### Phase 1 Decisions (carry forward)
- `.planning/phases/01-platform-foundation/01-CONTEXT.md` — Module structure (D-07, D-08), config pattern, health endpoint design (D-15)

### Existing AI Code (must read before modifying)
- `backend/app/modules/school_choice/services/plan_chat_service.py` — Current Gemini integration: system prompt, JSON patch contract, rate limiting, HTML regeneration
- `backend/app/core/config.py` — Pydantic BaseSettings pattern to extend with AI env vars
- `backend/app/api/v1/routes/plan.py` — Plan chat API route that calls the service

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — Current architecture layers
- `.planning/codebase/STACK.md` — Current tech stack and dependencies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/core/config.py` — Pydantic BaseSettings; extend with AI_PROVIDER, AI_API_KEY, AI_MODEL, AI_BASE_URL, AI_TIMEOUT fields
- `backend/app/core/dependencies.py` — FastAPI dependency injection pattern; ai_service could follow same pattern if needed
- `backend/app/modules/school_choice/services/plan_chat_service.py` — Rate limiting logic, JSON patch parsing, HTML regeneration — all preserved, only the AI call changes

### Established Patterns
- Environment-driven config via Pydantic BaseSettings with `.env` file support
- Service functions called from route handlers (no class-based services)
- HTTP exceptions for error signaling (HTTPException with status codes)

### Integration Points
- `plan_chat_service.py:170-177` — The 8 lines of Gemini SDK code that get replaced with `call_ai()` invocation
- `core/config.py` — Add AI-related Settings fields here
- `requirements.txt` / `pyproject.toml` — Add `litellm`, remove `google-generativeai`
- Health endpoint — Extend with AI provider status check

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-ai-provider-abstraction*
*Context gathered: 2026-04-24*
