"""JUPAS application cycle milestones — updated manually each admission cycle."""
from __future__ import annotations

JUPAS_CYCLE_YEAR = 2026

JUPAS_MILESTONES = [
    {"label": "JUPAS application opens", "date": "2025-09-01", "category": "application"},
    {"label": "School reference letters deadline", "date": "2025-10-31", "category": "preparation"},
    {"label": "Personal statement draft", "date": "2025-11-15", "category": "preparation"},
    {"label": "Band A submission deadline", "date": "2025-12-08", "category": "application"},
    {"label": "HKDSE exam period", "date": "2026-03-28", "category": "exam"},
    {"label": "HKDSE exam ends", "date": "2026-05-10", "category": "exam"},
    {"label": "Band A/B/C revision period", "date": "2026-05-20", "category": "application"},
    {"label": "Revision period ends", "date": "2026-06-05", "category": "application"},
    {"label": "HKDSE results release", "date": "2026-07-15", "category": "results"},
    {"label": "Main round offers", "date": "2026-08-10", "category": "results"},
]


def get_next_milestone(today_str: str) -> dict | None:
    for m in JUPAS_MILESTONES:
        if m["date"] >= today_str:
            return m
    return None


def get_all_milestones() -> list[dict]:
    return JUPAS_MILESTONES
