"""
app/schemas/v2/admin_users.py

Pydantic schemas for admin user management endpoints (SEC-01, SEC-02).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class UserCreateAdmin(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None
    role: str = "counsellor"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"counsellor", "admin"}
        if v not in allowed:
            raise ValueError(f"role must be one of {allowed}")
        return v


class UserUpdateAdmin(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"counsellor", "admin"}
        if v not in allowed:
            raise ValueError(f"role must be one of {allowed}")
        return v


class UserAdminResponse(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
