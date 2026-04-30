"""
app/schemas/v2/jsonb_models.py

Pydantic validation models for JSONB array fields on Student.
Used to validate incoming data on write endpoints before persisting.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, field_validator


class AwardSchema(BaseModel):
    title: str
    year: Optional[int] = None
    level: Optional[str] = None


class TeacherEvaluationSchema(BaseModel):
    subject_code: str
    teacher_name: str
    rating: int
    comments: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be 1-5")
        return v


class ExtracurricularSchema(BaseModel):
    activity: str
    role: Optional[str] = None
    years: Optional[str] = None
    description: Optional[str] = None


class LanguageScoreSchema(BaseModel):
    label: str
    score: float
    date: Optional[str] = None

    @field_validator("score")
    @classmethod
    def validate_score(cls, v):
        if not 0 <= v <= 9:
            raise ValueError("Score must be 0-9")
        return v
