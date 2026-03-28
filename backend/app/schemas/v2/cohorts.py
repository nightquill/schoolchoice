"""
app/schemas/v2/cohorts.py

Pydantic schemas for StudentCohort and related endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class CohortCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CohortUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CohortAddMembers(BaseModel):
    student_ids: list[UUID]


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class CohortMemberResponse(BaseModel):
    """Slim student summary as a cohort member."""
    model_config = {"from_attributes": False}

    id: UUID
    full_name: str
    class_name: Optional[str] = None
    year_of_study: Optional[int] = None


class CohortResponse(BaseModel):
    model_config = {"from_attributes": False}

    id: UUID
    name: str
    description: Optional[str] = None
    member_count: int
    created_at: datetime
    updated_at: datetime


class CohortDetailResponse(BaseModel):
    model_config = {"from_attributes": False}

    id: UUID
    name: str
    description: Optional[str] = None
    members: list[CohortMemberResponse]
    created_at: datetime
    updated_at: datetime


class CohortListResponse(BaseModel):
    model_config = {"from_attributes": False}

    cohorts: list[CohortResponse]
    total: int


# ---------------------------------------------------------------------------
# Stats schemas
# ---------------------------------------------------------------------------

class SubjectStatEntry(BaseModel):
    model_config = {"from_attributes": False}

    subject_code: str
    subject_name: str
    sitting: str
    count: int          # students with a grade for this subject/sitting
    mean: float         # mean numeric grade
    variance: float     # population variance
    grade_distribution: dict[str, int]  # {"5**": 2, "4": 5, ...}


class CohortStatsResponse(BaseModel):
    model_config = {"from_attributes": False}

    cohort_id: UUID
    cohort_name: str
    member_count: int
    subject_stats: list[SubjectStatEntry]


# ---------------------------------------------------------------------------
# Student search schema (used by GET /cohorts/students/search)
# ---------------------------------------------------------------------------

class StudentSearchResult(BaseModel):
    model_config = {"from_attributes": False}

    id: UUID
    full_name: str
    class_name: Optional[str] = None
    year_of_study: Optional[int] = None
    candidate_number: Optional[str] = None


class StudentSearchResponse(BaseModel):
    model_config = {"from_attributes": False}

    students: list[StudentSearchResult]
    total: int
