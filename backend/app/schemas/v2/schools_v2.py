"""
app/schemas/v2/schools_v2.py

Pydantic schemas for School v2 endpoints.
REQ-070, REQ-071
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class SchoolV2Response(BaseModel):
    id: UUID
    name: str
    name_zh: Optional[str] = None
    type: Optional[str] = None
    location: str
    website: Optional[str] = None
    description: Optional[str] = None
    minimum_entry_score: Optional[int] = None
    required_subjects: Optional[Any] = None
    language_requirements: Optional[Any] = None
    faculties: Optional[Any] = None
    notable_programs: Optional[Any] = None
    acceptance_rate: Optional[float] = None
    average_admitted_score: Optional[float] = None
    scholarship_available: Optional[bool] = None
    data_source: Optional[str] = None
    data_last_updated: Optional[date] = None
    notes: Optional[str] = None
    is_custom: Optional[bool] = None
    major_requirements: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SchoolSearchParams(BaseModel):
    q: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    min_score: Optional[int] = None
    max_score: Optional[int] = None
    page: int = 1
    page_size: int = 20
