"""
app/services/alert_service.py

Generates in-app alerts by querying student data for common issues:
missing grades, missing targets, at-risk targets, and stale data.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Student, User
from app.modules.school_choice.models.models import (
    StudentSchoolTarget,
    StudentSubjectGrade,
)

# Severity ordering for sort (lower = higher priority)
_SEVERITY_ORDER = {"error": 0, "warning": 1, "info": 2}


def generate_alerts(
    db: Session,
    *,
    user_id: Optional[UUID] = None,
    organisation_id: Optional[UUID] = None,
) -> list[dict]:
    """
    Scan student data and return a list of alert dicts.

    Each alert: {type, severity, student_id, student_name, message}
    Sorted by severity: errors first, then warnings, then info.
    """
    alerts: list[dict] = []

    # Build base student query scoped to user/org
    q = db.query(Student)
    if user_id is not None:
        q = q.filter(Student.user_id == user_id)
    if organisation_id is not None:
        q = q.filter(Student.organisation_id == organisation_id)

    students = q.all()

    # Pre-fetch grade counts per student
    grade_counts: dict[UUID, int] = {}
    grade_latest: dict[UUID, datetime] = {}
    grade_rows = (
        db.query(
            StudentSubjectGrade.student_id,
            func.count(StudentSubjectGrade.id).label("cnt"),
            func.max(StudentSubjectGrade.updated_at).label("latest"),
        )
        .group_by(StudentSubjectGrade.student_id)
        .all()
    )
    for row in grade_rows:
        grade_counts[row.student_id] = row.cnt
        grade_latest[row.student_id] = row.latest

    # Pre-fetch at-risk student IDs
    at_risk_student_ids = set()
    at_risk_rows = (
        db.query(StudentSchoolTarget.student_id)
        .filter(StudentSchoolTarget.at_risk == True)  # noqa: E712
        .distinct()
        .all()
    )
    for row in at_risk_rows:
        at_risk_student_ids.add(row.student_id)

    # Pre-fetch target counts per student
    target_counts: dict[UUID, int] = {}
    simple_target_rows = (
        db.query(
            StudentSchoolTarget.student_id,
            func.count(StudentSchoolTarget.id).label("cnt"),
        )
        .group_by(StudentSchoolTarget.student_id)
        .all()
    )
    for row in simple_target_rows:
        target_counts[row.student_id] = row.cnt

    # Pre-fetch all targets with scores for dubious choice detection
    all_targets = (
        db.query(StudentSchoolTarget)
        .filter(StudentSchoolTarget.match_score.isnot(None))
        .all()
    )
    # Group targets by student
    targets_by_student: dict[UUID, list] = {}
    for t in all_targets:
        targets_by_student.setdefault(t.student_id, []).append(t)

    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(days=30)

    for student in students:
        sid = student.id
        sname = student.name or "Unnamed"

        # Missing grades
        if grade_counts.get(sid, 0) == 0:
            alerts.append({
                "type": "missing_grades",
                "severity": "warning",
                "student_id": str(sid),
                "student_name": sname,
                "message": f"{sname} has no subject grades recorded.",
            })

        # Missing targets
        if target_counts.get(sid, 0) == 0:
            alerts.append({
                "type": "missing_targets",
                "severity": "info",
                "student_id": str(sid),
                "student_name": sname,
                "message": f"{sname} has no target schools set.",
            })

        # At-risk targets
        if sid in at_risk_student_ids:
            alerts.append({
                "type": "at_risk_target",
                "severity": "error",
                "student_id": str(sid),
                "student_name": sname,
                "message": f"{sname} has at-risk target school(s) below admission threshold.",
            })

        # Dubious choice detection — per-choice, not per-student
        student_targets = targets_by_student.get(sid, [])
        for tgt in student_targets:
            score = float(tgt.match_score) if tgt.match_score is not None else None
            if score is None:
                continue
            prog_label = tgt.programme_name or (tgt.intended_majors[0] if tgt.intended_majors else None)
            school_obj = tgt.school
            school_label = getattr(school_obj, "name", "Unknown") if school_obj else "Unknown"
            choice_label = f"{school_label} — {prog_label}" if prog_label else school_label

            # Too conservative: this choice is very safe (>85%)
            if score > 0.85:
                alerts.append({
                    "type": "dubious_conservative",
                    "severity": "info",
                    "student_id": str(sid),
                    "student_name": sname,
                    "message": f"{sname}: {choice_label} ({int(score*100)}% match) — may be too conservative. Consider a more competitive option.",
                })
            # Too ambitious: this choice is a significant reach (<25%)
            if score < 0.25:
                alerts.append({
                    "type": "dubious_ambitious",
                    "severity": "warning",
                    "student_id": str(sid),
                    "student_name": sname,
                    "message": f"{sname}: {choice_label} ({int(score*100)}% match) — may be too ambitious. Consider a safer alternative.",
                })

        # Stale data
        latest = grade_latest.get(sid)
        if latest is not None:
            # Ensure timezone-aware comparison
            if latest.tzinfo is None:
                latest = latest.replace(tzinfo=timezone.utc)
            if latest < stale_threshold:
                alerts.append({
                    "type": "stale_data",
                    "severity": "warning",
                    "student_id": str(sid),
                    "student_name": sname,
                    "message": f"{sname}'s grade data has not been updated in over 30 days.",
                })

    # Sort by severity priority
    alerts.sort(key=lambda a: _SEVERITY_ORDER.get(a["severity"], 99))

    return alerts
