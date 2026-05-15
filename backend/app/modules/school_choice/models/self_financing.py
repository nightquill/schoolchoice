"""SelfFinancingProgramme — non-JUPAS sub-degree and self-financing degree programmes.

Completely separate from JupasProgramme. Different code scheme, different data sources.
Data sourced from CSPE/iPASS admission statistics (best-5 HKDSE scores).
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, ForeignKey, String, Text, Integer, Float, TIMESTAMP, func
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from app.db.models import Base, UUID

_utcnow = lambda: datetime.now(timezone.utc)


class SelfFinancingInstitution(Base):
    """A self-financing post-secondary institution (e.g. PolyU HKCC, HKU SPACE CC)."""
    __tablename__ = "sf_institutions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    code = Column(String(20), unique=True, nullable=False)  # e.g. "HKCC", "HUSPACECC"
    name = Column(String(255), nullable=False)
    name_zh = Column(String(255), nullable=True)
    parent_university = Column(String(255), nullable=True)  # e.g. "The Hong Kong Polytechnic University"
    location = Column(String(255), nullable=True)
    website = Column(String(500), nullable=True)
    tier = Column(Integer, nullable=True)  # 1, 2, or 3 from research
    articulation_rate = Column(Float, nullable=True)  # e.g. 0.90 for 90%
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)

    programmes = relationship("SelfFinancingProgramme", back_populates="institution")


class SelfFinancingProgramme(Base):
    """A sub-degree or self-financing degree programme — NOT JUPAS."""
    __tablename__ = "sf_programmes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    institution_id = Column(UUID(as_uuid=True), ForeignKey("sf_institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    programme_code = Column(String(30), nullable=True)  # e.g. "8C112-SDS" (institution-specific)
    name = Column(String(255), nullable=False)
    name_zh = Column(String(255), nullable=True)
    level = Column(String(30), nullable=False)  # "associate_degree", "higher_diploma", "diploma", "self_financing_degree"
    faculty = Column(String(255), nullable=True)  # e.g. "Division of Science, Engineering and Health Studies"
    # Admission stats: best-5 HKDSE score basis (same scale as JUPAS)
    admission_score_mean = Column(Float, nullable=True)
    admission_score_lq = Column(Float, nullable=True)  # lower quartile
    admission_score_uq = Column(Float, nullable=True)  # upper quartile
    admission_score_highest = Column(Float, nullable=True)
    admission_year = Column(Integer, nullable=True)  # e.g. 2025
    minimum_requirements = Column(JSON, nullable=True)  # {"general": "22222", ...}
    data_source = Column(String(255), nullable=True)  # e.g. "CSPE/iPASS 2025/26", "PolyU HKCC website"
    notes = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), default=_utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now(), default=_utcnow)

    institution = relationship("SelfFinancingInstitution", back_populates="programmes")
