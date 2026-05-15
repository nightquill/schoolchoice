"""
app/schemas/user.py

Pydantic schemas for authentication and user resources.
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class UserCreate(BaseModel):
    """Request body for POST /auth/register."""

    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserResponse(BaseModel):
    """Response body for POST /auth/register."""

    id: UUID
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """Response body for POST /auth/login."""

    access_token: str
    token_type: str
    expires_in: int
    must_change_password: bool = False


class TokenData(BaseModel):
    """Parsed JWT payload data."""

    email: str | None = None
