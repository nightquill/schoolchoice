"""StudentChoiceSubmission — tracks student JUPAS programme choices through approval workflow."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, CheckConstraint, ForeignKey, String, Text, TIMESTAMP, Boolean, func
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from app.db.models import Base, UUID

_utcnow = lambda: datetime.now(timezone.utc)

class StudentChoiceSubmission(Base):
    __tablename__ = "student_choice_submissions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'pending', 'approved', 'revision_requested', 'rejected')",
            name="ck_scs_status",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE", name="fk_scs_student_id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="draft", server_default="'draft'")
    choices = Column(JSON, nullable=False, server_default="'[]'")
    counsellor_notes = Column(Text, nullable=True)
    flagged_choices = Column(JSON, nullable=True)  # [{rank: int, note: str}, ...]
    submitted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_at = Column(TIMESTAMP(timezone=True), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL", name="fk_scs_reviewed_by"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)

    student = relationship("Student")
