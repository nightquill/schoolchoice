"""
app/schemas/action_plan.py

Pydantic schemas for action plan resources.
The API contract exposes plain-text fields (not lists) matching the DB columns.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActionPlanResponse(BaseModel):
    """Response body for action plan endpoints."""

    id: UUID
    student_id: UUID
    academic_targets: str
    extracurricular_direction: str
    preparation_steps: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ActionPlanCreate(BaseModel):
    """Internal create schema (used by service layer)."""

    academic_targets: str
    extracurricular_direction: str
    preparation_steps: str
