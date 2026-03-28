"""
app/schemas/v2/plan.py

Pydantic schemas for plan generation v2 endpoints.
REQ-078
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PlanJobResponse(BaseModel):
    # ORM attribute is `id`; serialised as `job_id` in the response JSON.
    job_id: UUID = Field(validation_alias="id")
    status: str
    created_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class PlanStatusResponse(BaseModel):
    # ORM attribute is `id`; serialised as `job_id` in the response JSON.
    job_id: UUID = Field(validation_alias="id")
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


class PlanResponse(BaseModel):
    id: UUID
    student_id: UUID
    generated_at: Optional[datetime] = None
    version: int
    html_content: Optional[str] = None
    recommended_schools: Optional[Any] = None
    action_items: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlanHistoryItem(BaseModel):
    id: UUID
    student_id: UUID
    version: int
    plan_label: Optional[str] = None
    html_content: Optional[str] = None
    generated_at: Optional[datetime] = None
    recommended_schools: Optional[Any] = None
    action_items: Optional[Any] = None
    snapshot_data: Optional[Any] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanHistoryResponse(BaseModel):
    plans: list[PlanHistoryItem]
    total: int

    model_config = {"from_attributes": False}
