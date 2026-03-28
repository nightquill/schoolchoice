"""
app/schemas/v2/plan_chat.py

Pydantic schemas for the counsellor AI chat endpoint.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PlanChatRequest(BaseModel):
    message: str


class PlanChatResponse(BaseModel):
    plan_id: str
    version: int
    html_content: Optional[str] = None
    message: str  # assistant's reply to show in the chat panel
