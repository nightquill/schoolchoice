"""
app/schemas/v2/targets.py

Pydantic schemas for StudentSchoolTarget v2 endpoints.
REQ-069
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class TargetCreate(BaseModel):
    school_id: UUID
    student_rank: Optional[int] = None
    status: str = "CONSIDERING"
    intended_majors: Optional[list[str]] = None
    year_of_entry: Optional[int] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"CONSIDERING", "APPLIED", "ADMITTED", "REJECTED", "WITHDRAWN"}
        if v.upper() not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v.upper()


class TargetUpdate(BaseModel):
    student_rank: Optional[int] = None
    status: Optional[str] = None
    intended_majors: Optional[list[str]] = None
    year_of_entry: Optional[int] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"CONSIDERING", "APPLIED", "ADMITTED", "REJECTED", "WITHDRAWN"}
        if v.upper() not in allowed:
            raise ValueError(f"status must be one of {allowed}")
        return v.upper()


class TargetReorder(BaseModel):
    ordered_ids: list[UUID]


class TargetResponse(BaseModel):
    id: UUID
    student_id: UUID
    school_id: UUID
    school_name: Optional[str] = None
    student_rank: Optional[int] = None
    match_score: Optional[float] = None
    eligibility_pass: Optional[bool] = None
    shap_explanation: Optional[Any] = None
    failing_criteria: Optional[list[str]] = None
    intended_majors: Optional[list] = None
    year_of_entry: Optional[int] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TargetListResponse(BaseModel):
    targets: list[TargetResponse]
    total: int
