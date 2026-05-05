"""
app/schemas/v2/transcripts.py

Pydantic schemas for transcript upload v2 endpoints.
REQ-067
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class TranscriptUploadResponse(BaseModel):
    job_id: UUID
    status: str

    model_config = {"from_attributes": True}


class TranscriptStatusResponse(BaseModel):
    id: UUID
    student_id: UUID
    processing_status: str
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ParsedGradeSuggestion(BaseModel):
    subject_code: Optional[str] = None
    subject_name: str
    raw_grade: str


class TranscriptParsedResponse(BaseModel):
    id: UUID
    student_id: UUID
    processing_status: str
    uploaded_at: datetime
    suggestions: list[ParsedGradeSuggestion]
    parser_confidence: Optional[float] = None
    raw_text_excerpt: Optional[str] = None

    model_config = {"from_attributes": True}
