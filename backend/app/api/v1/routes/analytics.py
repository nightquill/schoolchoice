"""
app/api/v1/routes/analytics.py

Data analysis endpoints — HKDSE trends, anonymized student directory.
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import School, Student, User
from app.db.models_v2 import CohortMembership, StudentSchoolTarget, StudentSubjectGrade, Subject
from app.db.session import get_db
from app.modules.school_choice.services.hkdse_service import grade_to_int

router = APIRouter(prefix="/analytics", tags=["analytics"])

GRADE_ORDER = ["5**", "5*", "5", "4", "3", "2", "1", "U"]


def _anon_id(student_id) -> str:
    """One-way hash of student ID for anonymization."""
    return hashlib.sha256(str(student_id).encode()).hexdigest()[:12]


def _int_to_grade(n: int) -> str:
    mapping = {7: "5**", 6: "5*", 5: "5", 4: "4", 3: "3", 2: "2", 1: "1", 0: "U"}
    return mapping.get(max(0, min(7, round(n))), "U")


# ---------------------------------------------------------------------------
# GET /analytics/hkdse-trends
# ---------------------------------------------------------------------------

@router.get("/hkdse-trends")
def get_hkdse_trends(
    sitting: Optional[str] = Query(None, description="MOCK | TRIAL | OFFICIAL"),
    cohort_id: Optional[UUID] = Query(None, description="Filter by cohort"),
    subject_code: Optional[str] = Query(None, description="Filter by subject code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregate grade distributions across all students for each subject/sitting.
    Optionally filter by sitting type and cohort.
    Returns per-subject mean, variance, grade distribution, and per-grade rates.
    Also returns subject combination frequency.
    """
    query = db.query(StudentSubjectGrade)
    if sitting:
        query = query.filter(StudentSubjectGrade.sitting == sitting.upper())

    # Cohort filter — restrict to student IDs in the cohort
    if cohort_id:
        member_ids = [
            m.student_id
            for m in db.query(CohortMembership).filter(CohortMembership.cohort_id == cohort_id).all()
        ]
        if not member_ids:
            return {"trends": [], "total_subjects": 0, "subject_combinations": []}
        query = query.filter(StudentSubjectGrade.student_id.in_(member_ids))

    # Filter by subject_code at query level via a subquery on Subject
    if subject_code:
        from app.db.models_v2 import Subject as _Subject
        matched_subject = (
            db.query(_Subject)
            .filter(_Subject.code == subject_code.upper())
            .first()
        )
        if matched_subject:
            query = query.filter(StudentSubjectGrade.subject_id == matched_subject.id)
        else:
            return {"trends": [], "total_subjects": 0, "subject_combinations": []}

    rows = query.all()

    # Group by (subject_id, sitting)
    groups: dict[tuple, list[str]] = defaultdict(list)
    # Track which subjects each student has (for combinations)
    student_subjects: dict[UUID, set[str]] = defaultdict(set)

    for row in rows:
        raw = row.raw_grade or row.predicted_grade
        if raw:
            groups[(row.subject_id, row.sitting)].append(raw)
            student_subjects[row.student_id].add(str(row.subject_id))

    result = []
    subject_cache: dict[UUID, Subject] = {}

    def _get_subject(sid):
        if sid not in subject_cache:
            s = db.query(Subject).filter(Subject.id == sid).first()
            if s:
                subject_cache[sid] = s
        return subject_cache.get(sid)

    for (subject_id, sitting_val), grades in sorted(groups.items(), key=lambda x: str(x[0])):
        subj = _get_subject(subject_id)
        if not subj:
            continue
        numerics = [grade_to_int(g) for g in grades]
        count = len(numerics)
        mean = sum(numerics) / count if count else 0.0
        variance = sum((x - mean) ** 2 for x in numerics) / count if count else 0.0

        dist: dict[str, int] = {}
        for g in grades:
            dist[g] = dist.get(g, 0) + 1

        # Per-grade rates (percentage of students achieving each grade or above)
        grade_rates: dict[str, float] = {}
        for g in GRADE_ORDER:
            g_num = grade_to_int(g)
            at_or_above = sum(1 for n in numerics if n >= g_num)
            grade_rates[g] = round(at_or_above / count * 100, 1) if count else 0.0

        # Normalize category to uppercase to match frontend expectations
        category = (subj.category or "").upper()

        result.append({
            "subject_code": subj.code,
            "subject_name": subj.name,
            "category": category,
            "sitting": sitting_val,
            "count": count,
            "mean": round(mean, 3),
            "variance": round(variance, 3),
            "grade_distribution": dist,
            "grade_rates": grade_rates,
        })

    # Sort by category then subject code
    result.sort(key=lambda x: (x.get("category", ""), x["subject_code"]))

    # Subject combinations — elective only (by subject code pairs, top 20)
    combo_counter: Counter = Counter()
    for student_id, subject_ids in student_subjects.items():
        codes = []
        for sid_str in subject_ids:
            try:
                subj = _get_subject(UUID(sid_str))
                if subj and (subj.category or "").upper() == "ELECTIVE":
                    codes.append(subj.code)
            except Exception:
                pass
        codes.sort()
        for size in range(2, min(len(codes) + 1, 5)):
            for combo in combinations(codes, size):
                combo_counter[" + ".join(combo)] += 1

    top_combos = [
        {"combination": combo, "frequency": freq}
        for combo, freq in combo_counter.most_common(20)
    ]

    return {"trends": result, "total_subjects": len(result), "subject_combinations": top_combos}


# ---------------------------------------------------------------------------
# GET /analytics/hkdse-population
# ---------------------------------------------------------------------------

@router.get("/hkdse-population")
def get_hkdse_population_stats(
    subject_code: Optional[str] = Query(None, description="Filter by subject code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return HKDSE population-level grade distribution statistics.
    Data sourced from data/processed/hkdse_subject_stats.json.
    In Docker the file is at /app/data/processed/hkdse_subject_stats.json.
    """
    stats_path = Path(__file__).parent.parent.parent.parent.parent / "data" / "processed" / "hkdse_subject_stats.json"

    if not stats_path.exists():
        return {"subjects": [], "metadata": {}}

    with open(stats_path) as f:
        data = json.load(f)

    subjects = data.get("subjects", [])
    if subject_code:
        subjects = [s for s in subjects if s.get("code", "").upper() == subject_code.upper()]

    return {"subjects": subjects, "metadata": data.get("metadata", {})}


# ---------------------------------------------------------------------------
# GET /analytics/popular-majors
# ---------------------------------------------------------------------------

@router.get("/popular-majors")
def get_popular_majors(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the most commonly intended majors across all target school entries
    and graduated students' final majors.
    """
    major_counts: dict[str, int] = defaultdict(int)

    # From target school intended_majors
    targets = db.query(StudentSchoolTarget).all()
    for t in targets:
        majors = t.intended_majors
        if majors and isinstance(majors, list):
            for m in majors:
                if m:
                    major_counts[str(m)] += 1

    # From graduated students' final_major
    graduated = db.query(Student).filter(Student.is_graduated == True).all()  # noqa: E712
    for s in graduated:
        if s.final_major:
            major_counts[str(s.final_major)] += 1

    sorted_majors = sorted(major_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return {
        "majors": [{"major": m, "count": c} for m, c in sorted_majors],
        "total_distinct": len(major_counts),
    }


# ---------------------------------------------------------------------------
# GET /analytics/student-directory
# ---------------------------------------------------------------------------

@router.get("/student-directory")
def get_student_directory(
    graduated_only: bool = Query(False, description="Show only graduated students"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Anonymized past student directory.
    Returns hashed student IDs with grade profiles and school outcomes.
    Graduated students also show final_school and final_major.
    Personal data (name, DOB, contact) is NOT included.
    """
    org_id = getattr(current_user, "active_organisation_id", None)
    if org_id:
        query = db.query(Student).filter(Student.organisation_id == org_id)
    else:
        query = db.query(Student).filter(Student.user_id == current_user.id)
    if graduated_only:
        query = query.filter(Student.is_graduated == True)  # noqa: E712
    students = query.all()

    # Preload subjects
    subject_map: dict[UUID, Subject] = {}

    def _subj(sid):
        if sid not in subject_map:
            s = db.query(Subject).filter(Subject.id == sid).first()
            if s:
                subject_map[sid] = s
        return subject_map.get(sid)

    records = []
    for student in students:
        grade_rows = student.subject_grades or []
        grades = {}
        for g in grade_rows:
            subj = _subj(g.subject_id)
            if subj and (g.raw_grade or g.predicted_grade):
                key = f"{subj.code}_{g.sitting}"
                grades[key] = g.raw_grade or g.predicted_grade

        targets = (
            db.query(StudentSchoolTarget)
            .filter(StudentSchoolTarget.student_id == student.id)
            .all()
        )
        outcomes = []
        for t in targets:
            outcomes.append({
                "school_id": str(t.school_id),
                "status": t.status,
                "match_score": float(t.match_score) if t.match_score else None,
                "eligibility_pass": t.eligibility_pass,
                "intended_majors": t.intended_majors,
                "year_of_entry": t.year_of_entry,
            })

        # Final destination for graduated students
        final_school_name = None
        if student.final_school_id:
            fs = db.query(School).filter(School.id == student.final_school_id).first()
            if fs:
                final_school_name = fs.name

        records.append({
            "anon_id": _anon_id(student.id),
            "class_name": student.class_name,
            "year_of_study": student.year_of_study,
            "is_graduated": student.is_graduated or False,
            "graduation_year": student.graduation_year,
            "final_school": final_school_name,
            "final_major": student.final_major,
            "grades": grades,
            "school_outcomes": outcomes,
        })

    return {"students": records, "total": len(records)}


# ---------------------------------------------------------------------------
# GET /analytics/subject-combinations
# ---------------------------------------------------------------------------

@router.get("/subject-combinations")
def get_subject_combinations(
    sitting: Optional[str] = Query(None),
    cohort_id: Optional[UUID] = Query(None),
    top_n: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Frequency of elective subject combinations across students."""
    query = db.query(StudentSubjectGrade)
    if sitting:
        query = query.filter(StudentSubjectGrade.sitting == sitting.upper())
    if cohort_id:
        member_ids = [
            m.student_id
            for m in db.query(CohortMembership).filter(CohortMembership.cohort_id == cohort_id).all()
        ]
        if not member_ids:
            return {"combinations": []}
        query = query.filter(StudentSubjectGrade.student_id.in_(member_ids))

    rows = query.all()
    subject_map: dict[UUID, Subject] = {}

    def _subj(sid):
        if sid not in subject_map:
            s = db.query(Subject).filter(Subject.id == sid).first()
            if s:
                subject_map[sid] = s
        return subject_map.get(sid)

    student_codes: dict[UUID, set[str]] = defaultdict(set)
    for row in rows:
        if row.raw_grade or row.predicted_grade:
            subj = _subj(row.subject_id)
            if subj and subj.category == "ELECTIVE":
                student_codes[row.student_id].add(subj.code)

    combo_counter: Counter = Counter()
    for codes in student_codes.values():
        sorted_codes = sorted(codes)
        for size in range(2, min(len(sorted_codes) + 1, 5)):
            for combo in combinations(sorted_codes, size):
                combo_counter[" + ".join(combo)] += 1

    return {
        "combinations": [
            {"combination": c, "frequency": f}
            for c, f in combo_counter.most_common(top_n)
        ]
    }


# ---------------------------------------------------------------------------
# Plan + Submission history (time-series analytics)
# ---------------------------------------------------------------------------
from datetime import datetime, timedelta, timezone


def _bucket_date(dt: datetime, granularity: str) -> str:
    """Bucket a datetime into a date string based on granularity."""
    if granularity == "weekly":
        monday = dt - timedelta(days=dt.weekday())
        return monday.strftime("%Y-%m-%d")
    elif granularity == "monthly":
        return dt.strftime("%Y-%m-01")
    else:
        return dt.strftime("%Y-%m-%d")


@router.get("/plan-history")
def get_plan_generation_history(
    granularity: str = Query("daily", description="daily | weekly | monthly"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Plan generation frequency over time, grouped by granularity."""
    from app.modules.school_choice.models.models import PlanGenerationJob

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    org_id = getattr(current_user, "active_organisation_id", None)

    query = db.query(PlanGenerationJob).filter(
        PlanGenerationJob.created_at >= cutoff,
        PlanGenerationJob.status == "DONE",
    )
    if org_id:
        query = query.join(Student, PlanGenerationJob.student_id == Student.id).filter(
            Student.organisation_id == org_id
        )

    jobs = query.all()

    buckets: dict[str, int] = defaultdict(int)
    for job in jobs:
        key = _bucket_date(job.created_at, granularity)
        buckets[key] += 1

    data = [{"date": k, "count": v} for k, v in sorted(buckets.items())]
    return {"data": data, "granularity": granularity, "total": sum(v for v in buckets.values())}


@router.get("/submission-history")
def get_submission_history(
    granularity: str = Query("daily", description="daily | weekly | monthly"),
    days: int = Query(90, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submission frequency over time: total created and approved, grouped by granularity."""
    from app.modules.school_choice.models.submissions import StudentChoiceSubmission

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    org_id = getattr(current_user, "active_organisation_id", None)

    query = db.query(StudentChoiceSubmission).filter(
        StudentChoiceSubmission.created_at >= cutoff,
    )
    if org_id:
        query = query.join(Student, StudentChoiceSubmission.student_id == Student.id).filter(
            Student.organisation_id == org_id
        )

    submissions = query.all()

    total_buckets: dict[str, int] = defaultdict(int)
    approved_buckets: dict[str, int] = defaultdict(int)

    for sub in submissions:
        key = _bucket_date(sub.created_at, granularity)
        total_buckets[key] += 1
        if sub.status == "approved" and sub.reviewed_at:
            approved_key = _bucket_date(sub.reviewed_at, granularity)
            approved_buckets[approved_key] += 1

    all_dates = sorted(set(list(total_buckets.keys()) + list(approved_buckets.keys())))
    data = [
        {"date": d, "total": total_buckets.get(d, 0), "approved": approved_buckets.get(d, 0)}
        for d in all_dates
    ]
    return {
        "data": data,
        "granularity": granularity,
        "total_submissions": sum(total_buckets.values()),
        "total_approved": sum(approved_buckets.values()),
    }
