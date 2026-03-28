"""
app/schemas/v2/plan_edit.py

Pydantic schemas for plan template + section override endpoints.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, field_validator


class SetTemplateRequest(BaseModel):
    template_id: Literal["professional", "modern", "minimal"]


class EditSectionRequest(BaseModel):
    section_key: str
    html_content: str

    @field_validator("section_key")
    @classmethod
    def section_key_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("section_key must not be empty")
        return v.strip()
