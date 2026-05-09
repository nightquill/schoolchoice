"""PDPO consent tracking model (Decision #20)."""
from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.sql import func

from app.db.models import Base, UUID, _utcnow


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE", name="fk_consent_student_id"),
        nullable=False,
        index=True,
    )
    consent_type = Column(
        String(50),
        nullable=False,
        comment="DATA_PROCESSING | AI_ANALYSIS | EXPORT | SHARING",
    )
    granted_at = Column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)
    granted_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
