"""
app/api/v1/routes/recommendations.py

Recommendation generation and retrieval endpoints — all protected.
Routes are nested under /students/{student_id}/.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.recommendation import RecommendationResponse
from app.services import matching_service

router = APIRouter(tags=["recommendations"])


# REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040
@router.post(
    "/students/{student_id}/recommendations",
    response_model=list[RecommendationResponse],
    status_code=status.HTTP_201_CREATED,
)
def generate_recommendations(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Trigger the matching engine for the student.
    Replaces any previously stored recommendations and returns top-5.
    REQ-016, REQ-017, REQ-018, REQ-019, REQ-020, REQ-027, REQ-029, REQ-035, REQ-040
    """
    recs = matching_service.generate_recommendations(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    # Convert DB score (0–100) to API score (0.0–1.0)
    result = []
    for rec in recs:
        item = RecommendationResponse(
            id=rec.id,
            student_id=rec.student_id,
            school_id=rec.school_id,
            school_name=rec.school_name,
            score=float(rec.score) / 100.0,
            explanation=rec.explanation,
            gaps=rec.gaps,
            rank=rec.rank,
            created_at=rec.created_at,
        )
        result.append(item)
    return result


# REQ-020, REQ-027, REQ-034, REQ-037
@router.get(
    "/students/{student_id}/recommendations",
    response_model=list[RecommendationResponse],
    status_code=status.HTTP_200_OK,
)
def get_recommendations(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve stored recommendations for a student without re-running the engine.
    Returns empty array if none have been generated.
    REQ-020, REQ-027, REQ-034, REQ-037
    """
    recs = matching_service.get_recommendations(
        db, student_id=student_id, user_id=current_user.id,
        organisation_id=getattr(current_user, "active_organisation_id", None),
    )
    result = []
    for rec in recs:
        item = RecommendationResponse(
            id=rec.id,
            student_id=rec.student_id,
            school_id=rec.school_id,
            school_name=rec.school_name,
            score=float(rec.score) / 100.0,
            explanation=rec.explanation,
            gaps=rec.gaps,
            rank=rec.rank,
            created_at=rec.created_at,
        )
        result.append(item)
    return result
