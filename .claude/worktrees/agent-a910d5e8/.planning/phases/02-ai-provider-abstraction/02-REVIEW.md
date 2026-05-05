---
phase: 02-ai-provider-abstraction
reviewed: 2026-04-24T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - backend/app/core/ai_service.py
  - backend/tests/test_ai_service.py
  - backend/app/core/config.py
  - backend/requirements.txt
  - backend/.env.example
  - backend/tests/conftest.py
  - backend/app/modules/school_choice/services/plan_chat_service.py
  - backend/app/api/v1/routes/plan.py
  - backend/app/modules/school_choice/health.py
  - backend/tests/test_v2_routes.py
  - backend/scripts/__init__.py
  - backend/scripts/test_ai_provider.py
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-24T12:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 2 introduces a LiteLLM-backed AI service abstraction layer (`ai_service.py`), wires it into the existing plan chat service, adds health-check reporting for AI provider status, and includes a manual verification script. The architecture is clean: a single `call_ai()` entry point wraps `litellm.completion()` with sensible provider defaults, error mapping, and config-driven model selection.

Two critical issues were found: a potential `AttributeError` crash when the AI provider returns a response with `None` content, and a stored XSS vulnerability in the plan section editing endpoint. Four warnings address silent error swallowing, information leakage in error messages, and a missing dependency version pin.

## Critical Issues

### CR-01: AttributeError crash when AI response content is None

**File:** `backend/app/core/ai_service.py:65`
**Issue:** `response.choices[0].message.content` can be `None` for certain LiteLLM responses (e.g., tool-call-only responses, content-filter refusals, or malformed provider responses). Calling `.strip()` on `None` raises `AttributeError`, which falls through to the generic `except Exception` handler and returns a 502 with the raw exception string -- obscuring the root cause.
**Fix:**
```python
content = response.choices[0].message.content
if content is None:
    raise HTTPException(
        status_code=502,
        detail="AI provider returned an empty response.",
    )
return content.strip()
```

### CR-02: Stored XSS via unsanitized HTML in plan section overrides

**File:** `backend/app/api/v1/routes/plan.py:487-522` (the `edit_plan_section` endpoint)
**Issue:** The `html_content` field from `EditSectionRequest` is stored directly into `plan.overrides` and then rendered into the plan HTML without any sanitization. A counsellor (or attacker with a counsellor's token) can inject `<script>` tags that execute in any browser viewing the generated plan. The schema (`plan_edit.py:20`) has no validation on `html_content` beyond it being a string.
**Fix:** Sanitize the HTML before storing it. Use a library like `bleach` or `nh3` to strip dangerous tags:
```python
import nh3

# In edit_plan_section, before storing:
safe_html = nh3.clean(body.html_content)
overrides[body.section_key] = safe_html
```
Alternatively, add a Pydantic field validator on `EditSectionRequest.html_content` that strips script tags and event handlers.

## Warnings

### WR-01: Silent exception swallowing during student data loading

**File:** `backend/app/modules/school_choice/services/plan_chat_service.py:227`
**Issue:** The `except Exception: pass` block at line 227 silently swallows all errors during student data loading for plan regeneration. If the student ORM query fails (e.g., DB connection issue, schema mismatch), the plan silently regenerates with empty/minimal data, corrupting the plan output without any indication to the caller or logs.
**Fix:** Log the exception so failures are observable:
```python
except Exception as exc:
    logger.warning("Failed to load student data for plan regeneration: %s", exc)
```

### WR-02: Same silent exception swallowing in plan.py helper

**File:** `backend/app/api/v1/routes/plan.py:615`
**Issue:** Identical pattern to WR-01 -- `_load_student_and_results()` has `except Exception: pass` that silently degrades plan regeneration quality.
**Fix:**
```python
except Exception as exc:
    import logging
    logging.getLogger(__name__).warning(
        "Failed to load student data for regeneration: %s", exc
    )
```

### WR-03: Internal exception details leaked to API clients

**File:** `backend/app/core/ai_service.py:68,71,74`
**Issue:** All three exception handlers interpolate the raw exception object into `HTTPException.detail`, which is returned to the client. This can leak internal details like API endpoint URLs, provider error internals, or stack trace fragments. For example, `litellm.AuthenticationError` may include the API base URL or partial key info in its string representation.
**Fix:** Return generic messages to the client and log the full exception server-side:
```python
except litellm.AuthenticationError as exc:
    logger.error("AI provider authentication failed: %s", exc)
    raise HTTPException(status_code=503, detail="AI provider authentication failed.")
except litellm.ServiceUnavailableError as exc:
    logger.error("AI provider unreachable: %s", exc)
    raise HTTPException(status_code=503, detail="AI provider is temporarily unavailable.")
except Exception as exc:
    logger.error("AI provider error: %s", exc)
    raise HTTPException(status_code=502, detail="Unexpected error communicating with AI provider.")
```

### WR-04: litellm dependency has no version pin

**File:** `backend/requirements.txt:22`
**Issue:** `litellm` is listed without a version constraint. LiteLLM releases frequently with breaking changes to provider mappings and exception classes. A `pip install` could pull a version that changes the `AuthenticationError` or `ServiceUnavailableError` class hierarchy, breaking the error handling in `ai_service.py`.
**Fix:**
```
litellm>=1.40,<2.0
```
Pin to a known-good range after verifying the current installed version.

## Info

### IN-01: Stale docstring reference to "Gemini" in plan_chat_service

**File:** `backend/app/modules/school_choice/services/plan_chat_service.py:89,155,169`
**Issue:** Comments and the `_apply_patch` docstring still reference "Gemini" specifically (e.g., "Strip markdown code fences if Gemini wraps in them", "Build compact context for Gemini") despite the service now being provider-agnostic via LiteLLM. This is misleading for maintainers.
**Fix:** Replace "Gemini" with "the AI provider" in comments at lines 89, 155, and 169.

### IN-02: Numbered step list in handle_chat docstring is out of sync

**File:** `backend/app/modules/school_choice/services/plan_chat_service.py:141-151`
**Issue:** The docstring lists step "1. Call AI provider (raises 503 if unconfigured)" followed by "2. Enforce rate limit" then "3. Call AI provider via call_ai()". Steps 1 and 3 are duplicates -- the actual code only calls AI once (step 3). The rate limit check happens first in the code (line 153).
**Fix:** Update the docstring to match the actual flow:
```python
"""
Process one counsellor chat message:
1. Enforce rate limit
2. Call AI provider via call_ai()
3. Apply returned patch to plan
4. Regenerate HTML
5. Persist to DB
6. Return PlanChatResponse
"""
```

---

_Reviewed: 2026-04-24T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
