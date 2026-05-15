"""
app/schemas/student.py

Pydantic schemas for student profile resources.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class StudentCreate(BaseModel):
    """Request body for POST /students."""

    name: str
    candidate_number: Optional[str] = None
    grades: Optional[dict] = {}
    interests: Optional[list[str]] = []
    strengths_weaknesses: Optional[str] = ""
    target_region: Optional[str] = "local"

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Student name is required.")
        return v.strip()


class StudentUpdate(BaseModel):
    """Request body for PUT /students/{id}. All fields required for full update."""

    name: str
    grades: dict
    interests: list[str]
    strengths_weaknesses: str
    target_region: Literal["local", "international"]


class StudentResponse(BaseModel):
    """Response body for student endpoints."""

    id: UUID
    user_id: UUID
    name: str
    grades: dict
    interests: list[str]
    strengths_weaknesses: str
    target_region: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudentListItem(BaseModel):
    """Abbreviated student object returned in GET /students list."""

    id: UUID
    name: str
    full_name: str | None = None
    target_region: str
    created_at: datetime
    updated_at: datetime
    has_plan: bool = False
    plan_generated_at: datetime | None = None
    year_of_study: int | None = None
    class_name: str | None = None
    has_at_risk_targets: bool = False

    model_config = {"from_attributes": True}


class StudentFullResponse(BaseModel):
    """
    Full v2 student profile response.
    Includes all v1 fields plus all v2 additions.
    The `full_name` field maps to the model's `name` column.
    Flat IELTS fields are extracted from the `ielts_score` JSONB object.
    """

    id: UUID
    user_id: UUID
    # v1
    name: str
    grades: Optional[dict] = {}
    interests: Optional[list] = []
    strengths_weaknesses: Optional[str] = ""
    target_region: Optional[str] = "local"
    created_at: datetime
    updated_at: datetime
    # v2 identity fields
    full_name: Optional[str] = None
    preferred_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    class_name: Optional[str] = None
    year_of_study: Optional[int] = None
    candidate_number: Optional[str] = None
    financial_aid_flag: Optional[bool] = False
    preferred_language: Optional[str] = "en"
    notes: Optional[str] = None
    personal_statement: Optional[str] = None
    is_graduated: Optional[bool] = False
    graduation_year: Optional[int] = None
    final_school_id: Optional[UUID] = None
    final_major: Optional[str] = None
    # Flat IELTS fields (expanded from ielts_score JSONB)
    ielts_score: Optional[Any] = None
    ielts_listening: Optional[float] = None
    ielts_reading: Optional[float] = None
    ielts_writing: Optional[float] = None
    ielts_speaking: Optional[float] = None
    ielts_date: Optional[str] = None
    other_language_scores: Optional[list] = []
    # v2 JSONB arrays
    teacher_evaluation: Optional[list] = []
    extra_curricular: Optional[list] = []
    awards: Optional[list] = []

    model_config = {"from_attributes": True}


class StudentProfileUpdate(BaseModel):
    """Request body for PUT /students/{id}/profile — all v2 profile fields."""

    full_name: Optional[str] = None
    preferred_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    class_name: Optional[str] = None
    year_of_study: Optional[int] = None
    candidate_number: Optional[str] = None
    financial_aid_flag: Optional[bool] = None
    preferred_language: Optional[str] = None
    notes: Optional[str] = None
    personal_statement: Optional[str] = None
    is_graduated: Optional[bool] = None
    graduation_year: Optional[int] = None
    final_school_id: Optional[UUID] = None
    final_major: Optional[str] = None


class StudentGraduateRequest(BaseModel):
    """Request body for POST /students/{id}/graduate."""
    final_school_id: Optional[UUID] = None
    final_major: Optional[str] = None
    graduation_year: Optional[int] = None


class StudentLanguageScoresUpdate(BaseModel):
    """Request body for POST /students/{id}/language-scores."""

    ielts_score: Optional[float] = None
    ielts_listening: Optional[float] = None
    ielts_reading: Optional[float] = None
    ielts_writing: Optional[float] = None
    ielts_speaking: Optional[float] = None
    ielts_date: Optional[str] = None
    other_language_scores: Optional[list] = None
