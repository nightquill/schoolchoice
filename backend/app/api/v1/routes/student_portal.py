"""
Student Portal API — student-facing endpoints for grades, choices, submission, and match scores.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_student
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.models import (
    JupasProgramme,
    Student,
    StudentSchoolTarget,
    StudentSubjectGrade,
    Subject,
)
from app.modules.school_choice.models.submissions import StudentChoiceSubmission
from app.modules.school_choice.services.jupas_scorer import score_student_for_programme

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/student", tags=["student-portal"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ChoiceItem(BaseModel):
    rank: int
    jupas_code: str
    programme_name: str
    school_name: str | None = None
    notes: str | None = None


class ChoicesPayload(BaseModel):
    choices: list[ChoiceItem]


# ---------------------------------------------------------------------------
# 1. GET /student/grades
# ---------------------------------------------------------------------------

@router.get("/grades")
def get_student_grades(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Return read-only grades for the authenticated student."""
    rows = (
        db.query(StudentSubjectGrade, Subject)
        .join(Subject, StudentSubjectGrade.subject_id == Subject.id)
        .filter(StudentSubjectGrade.student_id == user.student_id)
        .all()
    )
    grades = []
    for grade, subject in rows:
        grades.append({
            "subject_code": subject.code,
            "subject_name": subject.name,
            "sitting": grade.sitting,
            "year_of_exam": grade.year_of_exam,
            "raw_grade": grade.raw_grade,
            "predicted_grade": grade.predicted_grade,
        })
    return {"grades": grades}


# ---------------------------------------------------------------------------
# 2. GET /student/choices
# ---------------------------------------------------------------------------

@router.get("/choices")
def get_student_choices(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Return current draft/pending/revision_requested submission."""
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == user.student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission:
        return {"submission": None}
    return {
        "submission": {
            "id": str(submission.id),
            "status": submission.status,
            "choices": submission.choices,
            "counsellor_notes": submission.counsellor_notes,
            "flagged_choices": submission.flagged_choices,
            "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
            "reviewed_at": submission.reviewed_at.isoformat() if submission.reviewed_at else None,
        }
    }


# ---------------------------------------------------------------------------
# 3. PUT /student/choices
# ---------------------------------------------------------------------------

@router.put("/choices")
def save_student_choices(
    payload: ChoicesPayload,
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Save choices as draft or revision. Blocks if submission is pending."""
    choices = payload.choices

    # Validate: max 25 choices
    if len(choices) > 25:
        raise HTTPException(status_code=400, detail="Maximum 25 choices allowed")

    # Validate: no duplicate jupas_codes
    codes = [c.jupas_code for c in choices]
    if len(codes) != len(set(codes)):
        raise HTTPException(status_code=400, detail="Duplicate jupas_codes not allowed")

    # Validate: all jupas_codes exist
    existing_codes = {
        row[0]
        for row in db.query(JupasProgramme.jupas_code)
        .filter(JupasProgramme.jupas_code.in_(codes))
        .all()
    }
    missing = set(codes) - existing_codes
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown jupas_codes: {sorted(missing)}",
        )

    # Find existing editable submission
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )

    # Block if there is a pending submission
    pending = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status == "pending",
        )
        .first()
    )
    if pending:
        raise HTTPException(
            status_code=409,
            detail="Cannot edit choices while a submission is pending review",
        )

    choices_json = [c.model_dump() for c in choices]

    if submission:
        submission.choices = choices_json
        submission.updated_at = datetime.now(timezone.utc)
    else:
        submission = StudentChoiceSubmission(
            student_id=user.student_id,
            status="draft",
            choices=choices_json,
        )
        db.add(submission)

    db.commit()
    db.refresh(submission)

    return {
        "id": str(submission.id),
        "status": submission.status,
        "choices": submission.choices,
    }


# ---------------------------------------------------------------------------
# 4. POST /student/choices/submit
# ---------------------------------------------------------------------------

@router.post("/choices/submit")
def submit_choices(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Submit draft/revision_requested submission for counsellor approval. Rate limited."""
    from app.db.models import Organisation, OrganisationMembership

    # Rate limit: check how many submissions in the last N hours (configurable per org)
    membership = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == user.id).first()
    max_per_day = 3  # default
    if membership:
        org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
        if org and org.metadata_:
            import json as _json
            try:
                meta = _json.loads(org.metadata_) if isinstance(org.metadata_, str) else org.metadata_
                max_per_day = meta.get("submission_rate_limit", 3) if isinstance(meta, dict) else 3
            except (ValueError, TypeError):
                pass

    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_count = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.submitted_at != None,  # noqa: E711
            StudentChoiceSubmission.submitted_at >= cutoff,
        )
        .count()
    )
    if recent_count >= max_per_day:
        raise HTTPException(
            status_code=429,
            detail=f"Submission rate limit reached ({max_per_day} per 24 hours). Please try again later.",
        )

    submission = (
        db.query(StudentChoiceSubmission)
        .filter(
            StudentChoiceSubmission.student_id == user.student_id,
            StudentChoiceSubmission.status.in_(["draft", "revision_requested"]),
        )
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="No draft or revision-requested submission found")

    if not submission.choices:
        raise HTTPException(status_code=400, detail="Cannot submit empty choices")

    submission.status = "pending"
    submission.submitted_at = datetime.now(timezone.utc)
    submission.counsellor_notes = None  # Clear previous notes on resubmit
    submission.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(submission)

    return {"id": str(submission.id), "status": "pending"}


# ---------------------------------------------------------------------------
# 5. GET /student/choices/match
# ---------------------------------------------------------------------------

@router.get("/choices/match")
def get_match_scores(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Real-time match scores for each choice in the current submission."""
    submission = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == user.student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .first()
    )
    if not submission or not submission.choices:
        return {"scores": []}

    # Build student grades dict: subject_code -> grade string
    grade_rows = (
        db.query(StudentSubjectGrade, Subject)
        .join(Subject, StudentSubjectGrade.subject_id == Subject.id)
        .filter(StudentSubjectGrade.student_id == user.student_id)
        .all()
    )
    student_grades: dict[str, str] = {}
    for grade, subject in grade_rows:
        raw = grade.raw_grade or grade.predicted_grade
        if raw:
            student_grades[subject.code] = raw

    has_grades = len(student_grades) > 0

    scores: list[dict[str, Any]] = []
    for choice in submission.choices:
        jupas_code = choice.get("jupas_code") if isinstance(choice, dict) else getattr(choice, "jupas_code", None)
        if not jupas_code:
            continue

        if not has_grades:
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": "No grade data",
            })
            continue

        programme = (
            db.query(JupasProgramme)
            .filter(JupasProgramme.jupas_code == jupas_code)
            .first()
        )
        if not programme:
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": f"Programme {jupas_code} not found",
            })
            continue

        programme_dict = {
            "jupas_code": programme.jupas_code,
            "name": programme.name,
            "scoring_formula": programme.scoring_formula or {},
            "minimum_requirements": programme.minimum_requirements or {},
            "admission_stats": programme.admission_stats or {},
        }

        try:
            result = score_student_for_programme(student_grades, programme_dict)
            scores.append({
                "jupas_code": jupas_code,
                "match_score": result.get("admission_probability"),
                "eligible": result.get("eligible", result.get("meets_requirements")),
                "risk_level": result.get("risk_level"),
            })
        except Exception as exc:
            logger.warning("Scoring failed for %s: %s", jupas_code, exc)
            scores.append({
                "jupas_code": jupas_code,
                "match_score": None,
                "eligible": None,
                "risk_level": None,
                "note": "Scoring error",
            })

    return {"scores": scores}


# ---------------------------------------------------------------------------
# 6. GET /student/choices/history
# ---------------------------------------------------------------------------

@router.get("/choices/history")
def get_submission_history(
    user: User = Depends(get_current_student),
    db: Session = Depends(get_db),
):
    """Return all submissions for this student, newest first."""
    submissions = (
        db.query(StudentChoiceSubmission)
        .filter(StudentChoiceSubmission.student_id == user.student_id)
        .order_by(StudentChoiceSubmission.updated_at.desc())
        .all()
    )
    return {
        "submissions": [
            {
                "id": str(s.id),
                "status": s.status,
                "choices": s.choices,
                "counsellor_notes": s.counsellor_notes,
                "flagged_choices": s.flagged_choices,
                "submitted_at": s.submitted_at.isoformat() if s.submitted_at else None,
                "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in submissions
        ]
    }


# ---------------------------------------------------------------------------
# 7. GET /student/plan — student views released plan
# ---------------------------------------------------------------------------

@router.get("/plan")
def student_get_plan(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.models import AcademicPlan
    plan = db.query(AcademicPlan).filter(AcademicPlan.student_id == student.id).first()
    if not plan or not plan.released_at:
        raise HTTPException(status_code=404, detail="No plan released yet")
    return {
        "html_content": plan.html_content,
        "release_note": plan.release_note,
        "released_at": plan.released_at.isoformat(),
        "version": plan.version,
    }


# ---------------------------------------------------------------------------
# 8. Grade builds (student portal)
# ---------------------------------------------------------------------------

@router.get("/grade-builds")
def student_list_builds(db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    builds = db.query(GradeBuild).filter(GradeBuild.student_id == student.id).order_by(GradeBuild.created_at).all()
    return {"builds": [{"id": str(b.id), "name": b.name, "grades": b.grades} for b in builds]}


@router.post("/grade-builds")
def student_create_build(body: dict, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    count = db.query(GradeBuild).filter(GradeBuild.student_id == student.id).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 grade builds")
    build = GradeBuild(student_id=student.id, name=body.get("name", "Build"), grades=body.get("grades", {}))
    db.add(build)
    db.commit()
    db.refresh(build)
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.put("/grade-builds/{build_id}")
def student_update_build(build_id: str, body: dict, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    if "name" in body:
        build.name = body["name"]
    if "grades" in body:
        build.grades = body["grades"]
    db.commit()
    return {"id": str(build.id), "name": build.name, "grades": build.grades}


@router.delete("/grade-builds/{build_id}")
def student_delete_build(build_id: str, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    db.delete(build)
    db.commit()
    return {"deleted": True}


@router.post("/grade-builds/{build_id}/scores")
def student_score_build(build_id: str, db: Session = Depends(get_db), student: Student = Depends(get_current_student)):
    from app.modules.school_choice.models.grade_builds import GradeBuild
    build = db.query(GradeBuild).filter(GradeBuild.id == build_id, GradeBuild.student_id == student.id).first()
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    targets = db.query(StudentSchoolTarget).filter(StudentSchoolTarget.student_id == student.id).all()
    results = []
    for t in targets:
        if not t.jupas_code:
            continue
        prog = db.query(JupasProgramme).filter(JupasProgramme.jupas_code == t.jupas_code).first()
        if not prog:
            continue
        prog_dict = {"jupas_code": prog.jupas_code, "name": prog.name, "scoring_formula": prog.scoring_formula or {}, "minimum_requirements": prog.minimum_requirements or {}, "admission_stats": prog.admission_stats or {}}
        try:
            score = score_student_for_programme(build.grades, prog_dict)
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": score.get("admission_probability"), "eligible": score.get("eligible")})
        except Exception:
            results.append({"jupas_code": prog.jupas_code, "programme_name": prog.name, "match_score": None, "eligible": None})
    return {"build_id": str(build.id), "scores": results}
