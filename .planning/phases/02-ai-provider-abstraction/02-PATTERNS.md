# Phase 2: AI Provider Abstraction - Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/app/core/ai_service.py` | service | request-response | `backend/app/modules/school_choice/services/plan_chat_service.py` | role-match |
| `backend/app/core/config.py` | config | — | `backend/app/core/config.py` (self — extend) | exact |
| `backend/app/modules/school_choice/services/plan_chat_service.py` | service | request-response | self (modify in place) | exact |
| `backend/app/modules/school_choice/health.py` | utility | request-response | `backend/app/platform/health.py` | role-match |
| `backend/requirements.txt` | config | — | `backend/requirements.txt` (self — modify) | exact |

---

## Pattern Assignments

### `backend/app/core/ai_service.py` (service, request-response)

**Analog:** `backend/app/modules/school_choice/services/plan_chat_service.py`

This is a new file with no direct analog in the codebase. The closest structural model is `plan_chat_service.py` for its HTTPException error signaling pattern. The function signature and internal structure are left to Claude's discretion (D-05 in CONTEXT.md), guided by the patterns below.

**Imports pattern** — follow the style of `plan_chat_service.py` lines 1–26:
```python
"""
app/core/ai_service.py

LiteLLM-backed AI service wrapper. Single entry point for all AI calls.
Maps AI_PROVIDER + AI_MODEL settings to LiteLLM model string and
invokes litellm.completion() synchronously.
"""
from __future__ import annotations

import logging
from typing import Any

import litellm
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)
```

**Provider → model string construction** (implement per D-07):
```python
_PROVIDER_DEFAULTS: dict[str, str] = {
    "openai": "gpt-4o",
    "anthropic": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.5-flash",
}

def _build_model_string() -> str:
    """Construct LiteLLM model string from AI_PROVIDER + AI_MODEL settings."""
    provider = settings.AI_PROVIDER
    model = settings.AI_MODEL or _PROVIDER_DEFAULTS.get(provider)
    if not model:
        raise HTTPException(
            status_code=503,
            detail="AI_MODEL must be set explicitly for openai-compatible providers.",
        )
    return f"{provider}/{model}"
```

**Core call pattern** (implement per D-05, D-06, D-08, D-09):
```python
def call_ai(messages: list[dict[str, str]], **kwargs: Any) -> str:
    """
    Call AI provider via LiteLLM. Returns response text.
    Raises HTTP 502 on bad AI response, 503 on provider unreachable/unconfigured.
    """
    if not settings.AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI chat is not available: AI_API_KEY is not configured.",
        )
    model_string = _build_model_string()
    try:
        response = litellm.completion(
            model=model_string,
            messages=messages,
            api_key=settings.AI_API_KEY,
            api_base=settings.AI_BASE_URL or None,
            timeout=settings.AI_TIMEOUT,
            **kwargs,
        )
        return response.choices[0].message.content.strip()
    except litellm.AuthenticationError as exc:
        raise HTTPException(status_code=503, detail=f"AI provider authentication failed: {exc}")
    except litellm.ServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"AI provider unreachable: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}")
```

**Error handling pattern** — mirror `plan_chat_service.py` lines 152–157 (503 for missing config, 502 for bad response):
```python
# plan_chat_service.py lines 152-157 — pattern to match:
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise HTTPException(
        status_code=503,
        detail="AI chat is not available: GEMINI_API_KEY is not configured.",
    )
# ...
except json.JSONDecodeError as exc:
    raise HTTPException(
        status_code=502,
        detail=f"AI returned invalid JSON: {exc}",
    )
```

---

### `backend/app/core/config.py` (config — extend in place)

**Analog:** `backend/app/core/config.py` lines 1–38 (self)

**Existing pattern** (lines 1–38 — do not change any existing field):
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
```

**Fields to add** (append after CORS block, before the `settings = Settings()` line):
```python
    # AI provider (D-01, D-02, D-03, D-04, D-09)
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""
    AI_MODEL: str = ""          # empty = use smart default per provider
    AI_BASE_URL: str = ""       # required only for openai-compatible endpoints
    AI_TIMEOUT: int = 30        # seconds
```

**Convention note:** All fields use `str = ""` (not `Optional[str]`) so Pydantic does not require them at startup — deployers who do not use AI features can omit them. `AI_PROVIDER` defaults to `"gemini"` to preserve backward compatibility with current deployments that have `GEMINI_API_KEY` set. If `AI_API_KEY` is empty, `call_ai()` raises 503 rather than crashing at import time.

---

### `backend/app/modules/school_choice/services/plan_chat_service.py` (service — modify in place)

**Analog:** self — targeted replacement of lines 169–176

**Lines to remove** (lines 169–176, the Gemini SDK block):
```python
# REMOVE these lines:
import google.generativeai as genai  # type: ignore[import]

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.5-flash")
response = model.generate_content(
    f"{SYSTEM_PROMPT}\n\nCurrent plan data:\n{context_json}\n\nCounsellor instruction: {message}"
)
raw_text: str = response.text.strip()
```

**Replacement pattern** (messages array per D-10, call_ai per D-05):
```python
from app.core.ai_service import call_ai

messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": f"Current plan data:\n{context_json}\n\nCounsellor instruction: {message}"},
]
raw_text = call_ai(messages)
```

**Key preservation constraints** (D-12):
- `SYSTEM_PROMPT` constant (lines 31–43) — unchanged
- `_check_and_increment_rate_limit()` (lines 50–79) — unchanged
- `_apply_patch()` (lines 88–129) — unchanged
- JSON fence stripping block (lines 179–182) — unchanged
- `json.loads(raw_text)` + HTTP 502 on JSONDecodeError (lines 184–189) — unchanged

**What else changes in this file:**
- Remove `import os` if `GEMINI_API_KEY` check is the only use (check line 14 — `os` is also used nowhere else in this file; remove it)
- Remove the `api_key = os.environ.get("GEMINI_API_KEY") / if not api_key: raise HTTPException(503, ...)` block (lines 152–157) — `call_ai()` now owns this check
- The `handle_chat` docstring line 1 reference to "Gemini 2.5 Flash" and module docstring should be updated to remove Gemini-specific references

---

### `backend/app/modules/school_choice/health.py` (utility — modify in place)

**Analog:** `backend/app/platform/health.py` (health callback architecture) and `backend/app/modules/school_choice/health.py` (self — module health callback pattern)

**Existing callback pattern** (`health.py` lines 1–30 — structural model to follow):
```python
def check_health() -> dict:
    """Report XGBoost model availability for the school_choice module."""
    try:
        from app.modules.school_choice.services.matchmaker_v2 import _get_model
        model = _get_model()
        if model is None:
            return {"xgboost_model": "unavailable", "scoring_mode": "rule_only"}
        return {"xgboost_model": "loaded", "scoring_mode": "hybrid"}
    except Exception as e:
        return {"xgboost_model": "error", "detail": str(e)}
```

**Extension pattern** — add AI provider status to the returned dict (D-13):
```python
def check_health() -> dict:
    """Report XGBoost model and AI provider status for the school_choice module."""
    result: dict = {}

    # XGBoost model check (unchanged)
    try:
        from app.modules.school_choice.services.matchmaker_v2 import _get_model
        model = _get_model()
        result["xgboost_model"] = "loaded" if model is not None else "unavailable"
        result["scoring_mode"] = "hybrid" if model is not None else "rule_only"
    except Exception as e:
        result["xgboost_model"] = "error"
        result["xgboost_detail"] = str(e)

    # AI provider check (D-13)
    try:
        from app.core.config import settings
        if not settings.AI_API_KEY:
            result["ai_provider"] = settings.AI_PROVIDER
            result["ai_status"] = "unconfigured"
        else:
            # Lightweight reachability: attempt a minimal completion
            # (implementation detail left to Claude's discretion per CONTEXT.md)
            result["ai_provider"] = settings.AI_PROVIDER
            result["ai_status"] = "configured"
    except Exception as e:
        result["ai_provider"] = "unknown"
        result["ai_status"] = "error"
        result["ai_detail"] = str(e)

    return result
```

**Registration point** — `check_health()` is already registered as a module health callback via `backend/app/platform/module_loader.py`. No change to registration logic needed; the extended return dict flows automatically into the `/health` response under `modules.school_choice`.

---

### `backend/requirements.txt` (config — modify in place)

**Analog:** self (lines 1–22)

**Change:**
```
# REMOVE:
google-generativeai

# ADD (place with other third-party libs):
litellm
```

**Note:** `google-generativeai` is not present in the current `requirements.txt` (confirmed by reading the file — it was imported inline in `plan_chat_service.py` lines 170 as `import google.generativeai as genai` without being in requirements). Verify with `pip show google-generativeai` before assuming a removal step is needed. `litellm` must be added as a new line.

---

## Shared Patterns

### HTTPException Error Signaling
**Source:** `backend/app/modules/school_choice/services/plan_chat_service.py` lines 152–157, 186–189
**Apply to:** `ai_service.py` — all error paths
```python
# 503 = provider unconfigured or unreachable
raise HTTPException(
    status_code=503,
    detail="AI chat is not available: AI_API_KEY is not configured.",
)
# 502 = provider reachable but returned bad data
raise HTTPException(
    status_code=502,
    detail=f"AI returned invalid JSON: {exc}",
)
```

### Pydantic Settings Extension
**Source:** `backend/app/core/config.py` lines 12–38
**Apply to:** `config.py` — new AI fields
```python
# Pattern: optional fields use typed defaults, not Optional[str]
# Fields used at startup must have defaults so app starts without them set.
AI_PROVIDER: str = "gemini"
AI_API_KEY: str = ""
```

### Module Health Callback Pattern
**Source:** `backend/app/modules/school_choice/health.py` lines 11–30 and `backend/app/platform/health.py` lines 51–90
**Apply to:** `health.py` extension for AI provider status
```python
# Pattern: return a flat dict, never raise, wrap everything in try/except
def check_health() -> dict:
    try:
        # ... check something
        return {"key": "value"}
    except Exception as e:
        return {"key": "error", "detail": str(e)}
```

### Import Convention
**Source:** All files in `backend/app/`
**Apply to:** `ai_service.py`
```python
from __future__ import annotations  # always first
# stdlib imports
# third-party imports
# local imports (app.core.*, app.db.*, app.modules.*)
```

---

## No Analog Found

All files have analogs. No entries needed here.

---

## Metadata

**Analog search scope:** `backend/app/core/`, `backend/app/modules/school_choice/`, `backend/app/platform/`, `backend/app/api/v1/routes/`
**Files scanned:** 8 files read in full
**Pattern extraction date:** 2026-04-24
