"""
app/schemas/recommendation.py

Pydantic schemas for recommendation resources.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class RecommendationResponse(BaseModel):
    """Single recommendation object returned by recommendation endpoints."""

    id: UUID
    student_id: UUID
    school_id: UUID
    school_name: str
    score: float
    explanation: str
    gaps: str
    rank: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationListResponse(BaseModel):
    """Wrapper for a list of recommendations for a student."""

    recommendations: list[RecommendationResponse]
    student_id: UUID
