"""
Standalone verification script for the AI provider abstraction layer.

Usage:
  1. Set AI_PROVIDER and AI_API_KEY in your backend/.env
  2. cd backend && python -m scripts.test_ai_provider

The script sends two requests through call_ai():
  - A simple "reply HELLO" prompt to verify basic connectivity
  - A plan-chat-style prompt with JSON context to verify structured output

Prints provider/model info (never the API key) and exits 0 on success, 1 on failure.
"""
from __future__ import annotations

import json
import sys

from fastapi import HTTPException


def _print_header() -> None:
    print("=" * 60)
    print("  AI Provider Abstraction — Manual Verification")
    print("=" * 60)
    print()


def _print_config() -> None:
    from app.core.config import settings

    print(f"  AI_PROVIDER : {settings.AI_PROVIDER}")
    print(f"  AI_MODEL    : {settings.AI_MODEL or '(default)'}")
    print(f"  AI_BASE_URL : {settings.AI_BASE_URL or '(none)'}")
    print(f"  AI_TIMEOUT  : {settings.AI_TIMEOUT}s")
    print(f"  AI_API_KEY  : {'***configured***' if settings.AI_API_KEY else 'NOT SET'}")
    print()


def _test_simple_hello() -> bool:
    """Test 1: send a simple prompt and check for HELLO in the response."""
    from app.core.ai_service import call_ai

    print("[Test 1] Simple prompt — expecting 'HELLO' in response")
    messages = [{"role": "user", "content": "Reply with exactly: HELLO"}]

    try:
        response = call_ai(messages)
    except HTTPException as exc:
        print(f"  FAIL: HTTPException {exc.status_code} — {exc.detail}")
        return False
    except Exception as exc:
        print(f"  FAIL: {type(exc).__name__} — {exc}")
        return False

    contains_hello = "HELLO" in response.upper()
    print(f"  Response : {response!r}")
    print(f"  Contains 'HELLO': {contains_hello}")
    print()
    return contains_hello


def _test_json_patch() -> bool:
    """Test 2: send a plan-chat-style message and check for valid JSON response."""
    from app.core.ai_service import call_ai

    print("[Test 2] Plan-chat-style prompt — expecting valid JSON response")

    context = {
        "plan": {
            "name": "Test School Plan",
            "schools": [
                {"id": 1, "name": "Lincoln Elementary", "rank": 1},
                {"id": 2, "name": "Washington Middle", "rank": 2},
            ],
        }
    }

    messages = [
        {
            "role": "system",
            "content": (
                "You are a school-choice assistant. The user will provide their current "
                "plan as JSON. Respond ONLY with a JSON object representing a modification "
                "to the plan. Do not include any explanation, just the JSON."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Here is my current plan:\n```json\n{json.dumps(context, indent=2)}\n```\n\n"
                "Swap the ranks of the two schools. Return the full updated plan object as JSON only."
            ),
        },
    ]

    try:
        response = call_ai(messages)
    except HTTPException as exc:
        print(f"  FAIL: HTTPException {exc.status_code} — {exc.detail}")
        return False
    except Exception as exc:
        print(f"  FAIL: {type(exc).__name__} — {exc}")
        return False

    # Strip markdown code fences if present
    cleaned = response.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
        is_valid = isinstance(parsed, dict)
    except (json.JSONDecodeError, ValueError):
        is_valid = False

    print(f"  Response (first 200 chars): {response[:200]!r}")
    print(f"  Valid JSON object: {is_valid}")
    print()
    return is_valid


def main() -> int:
    """Run all verification tests. Returns 0 on full success, 1 on any failure."""
    _print_header()
    _print_config()

    results: list[tuple[str, bool]] = []

    results.append(("Simple HELLO prompt", _test_simple_hello()))
    results.append(("JSON patch prompt", _test_json_patch()))

    # Summary
    print("-" * 60)
    all_passed = True
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        if not passed:
            all_passed = False
        print(f"  [{status}] {name}")

    print()
    if all_passed:
        print("All tests passed. AI provider abstraction is working.")
    else:
        print("Some tests failed. Check output above for details.")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
