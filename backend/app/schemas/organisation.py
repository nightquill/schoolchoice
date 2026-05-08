"""Pydantic schemas for Organisation resources."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator
import re


class OrganisationCreate(BaseModel):
    """Request body for creating an organisation."""
    name: str
    slug: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Organisation name must not be empty")
        return v.strip()

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens")
        return v


class OrganisationResponse(BaseModel):
    """Response body for organisation endpoints."""
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganisationMemberResponse(BaseModel):
    """A member within an organisation."""
    user_id: UUID
    email: str
    display_name: Optional[str] = None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}
