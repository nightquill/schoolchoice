"""
app/schemas/v2/account.py

Pydantic schemas for account settings v2 endpoints.
REQ-079
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


class AccountResponse(BaseModel):
    id: UUID
    email: str
    display_name: Optional[str] = None
    preferred_language: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    organisation_id: Optional[str] = None
    organisation_name: Optional[str] = None
    organisation_slug: Optional[str] = None
    org_role: Optional[str] = None

    model_config = {"from_attributes": True}


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    preferred_language: Optional[str] = None

    @field_validator("preferred_language")
    @classmethod
    def validate_language(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"en", "zh-HK"}
        if v not in allowed:
            raise ValueError(f"preferred_language must be one of {allowed}")
        return v


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str

    @field_validator("confirm_new_password")
    @classmethod
    def passwords_match(cls, v: str, info: object) -> str:
        # Access new_password from info.data (Pydantic v2)
        data = getattr(info, "data", {})
        if "new_password" in data and v != data["new_password"]:
            raise ValueError("new_password and confirm_new_password do not match")
        return v
