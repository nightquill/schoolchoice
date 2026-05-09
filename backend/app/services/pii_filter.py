"""PII filter for PDPO compliance (Decision #20). Strips HKID patterns from text."""
from __future__ import annotations
import re

# HKID: 1-2 uppercase letters + 6-7 digits + optional check digit in parens
_HKID_PATTERN = re.compile(r'\b[A-Z]{1,2}\d{6,7}(?:\([0-9A-Z]\))?', re.IGNORECASE)


def strip_hkid(text: str) -> str:
    """Replace all HKID-like patterns with [HKID REDACTED]."""
    return _HKID_PATTERN.sub("[HKID REDACTED]", text)


def strip_pii(text: str) -> str:
    """Strip all known PII patterns from text."""
    return strip_hkid(text)
