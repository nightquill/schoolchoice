"""
app/schemas/v2/grades.py

Pydantic schemas for StudentSubjectGrade v2 endpoints.
REQ-068
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class SubjectGradeCreate(BaseModel):
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None  # resolved to subject_id server-side if subject_id omitted
    year_of_exam: Optional[int] = None
    sitting: str  # MOCK | TRIAL | OFFICIAL
    raw_grade: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("sitting")
    @classmethod
    def validate_sitting(cls, v: str) -> str:
        allowed = {"MOCK", "TRIAL", "OFFICIAL"}
        if v.upper() not in allowed:
            raise ValueError(f"sitting must be one of {allowed}")
        return v.upper()


class SubjectGradeUpdate(BaseModel):
    year_of_exam: Optional[int] = None
    sitting: Optional[str] = None
    raw_grade: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("sitting")
    @classmethod
    def validate_sitting(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"MOCK", "TRIAL", "OFFICIAL"}
        if v.upper() not in allowed:
            raise ValueError(f"sitting must be one of {allowed}")
        return v.upper()


class SubjectGradeResponse(BaseModel):
    id: UUID
    student_id: UUID
    subject_id: UUID
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    year_of_exam: Optional[int] = None
    sitting: str
    raw_grade: Optional[str] = None
    predicted_grade: Optional[str] = None
    transcript_uploaded: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": False}


class SubjectGradeListResponse(BaseModel):
    grades: list[SubjectGradeResponse]
    total: int

    model_config = {"from_attributes": False}
