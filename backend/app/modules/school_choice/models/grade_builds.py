"""Grade builds — hypothetical grade sets for what-if analysis."""
from __future__ import annotations
import uuid
from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from app.db.models import Base, UUID, _utcnow

class GradeBuild(Base):
    __tablename__ = "grade_builds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    grades = Column(JSON, nullable=False, server_default="'{}'")
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)
