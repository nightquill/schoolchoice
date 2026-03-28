"""
app/schemas/school.py

Pydantic schemas for school resources.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SchoolCreate(BaseModel):
    """Request body for POST /schools."""

    name: str
    location: str
    min_academic_requirements: dict
    key_strengths: list[str]
    notes: str | None = None


class SchoolUpdate(BaseModel):
    """Request body for PUT /schools/{id}. All required fields; notes optional."""

    name: str
    location: str
    min_academic_requirements: dict
    key_strengths: list[str]
    notes: str | None = None


class SchoolResponse(BaseModel):
    """Response body for school endpoints."""

    id: UUID
    name: str
    location: str
    min_academic_requirements: dict
    key_strengths: list[str]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SchoolListItem(BaseModel):
    """Abbreviated school object returned in GET /schools list."""

    id: UUID
    name: str
    location: str
    key_strengths: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}
