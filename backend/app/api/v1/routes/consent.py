"""
app/api/v1/routes/consent.py

PDPO consent management endpoints (Decision #20).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.school_choice.models.consent import ConsentRecord

router = APIRouter(prefix="/consent", tags=["consent"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConsentGrantRequest(BaseModel):
    student_id: str = Field(..., description="UUID of the student")
    consent_type: str = Field(..., description="DATA_PROCESSING | AI_ANALYSIS | EXPORT | SHARING")
    granted_by: str | None = Field(None, description="Who granted consent (e.g. parent name)")
    notes: str | None = None


class ConsentRevokeRequest(BaseModel):
    pass  # no body needed; revoke is idempotent


class ConsentResponse(BaseModel):
    id: str
    student_id: str
    consent_type: str
    granted_at: datetime
    revoked_at: datetime | None = None
    granted_by: str | None = None
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
def grant_consent(
    payload: ConsentGrantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grant a consent record for a student."""
    record = ConsentRecord(
        id=uuid.uuid4(),
        student_id=uuid.UUID(payload.student_id),
        consent_type=payload.consent_type,
        granted_by=payload.granted_by,
        notes=payload.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return ConsentResponse(
        id=str(record.id),
        student_id=str(record.student_id),
        consent_type=record.consent_type,
        granted_at=record.granted_at,
        revoked_at=record.revoked_at,
        granted_by=record.granted_by,
        notes=record.notes,
    )


@router.get("/{student_id}", response_model=list[ConsentResponse])
def list_consent(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all consent records for a student."""
    records = (
        db.query(ConsentRecord)
        .filter(ConsentRecord.student_id == uuid.UUID(student_id))
        .order_by(ConsentRecord.granted_at.desc())
        .all()
    )
    return [
        ConsentResponse(
            id=str(r.id),
            student_id=str(r.student_id),
            consent_type=r.consent_type,
            granted_at=r.granted_at,
            revoked_at=r.revoked_at,
            granted_by=r.granted_by,
            notes=r.notes,
        )
        for r in records
    ]


@router.post("/{record_id}/revoke", response_model=ConsentResponse)
def revoke_consent(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke a consent record."""
    record = (
        db.query(ConsentRecord)
        .filter(ConsentRecord.id == uuid.UUID(record_id))
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Consent record not found")
    if record.revoked_at is not None:
        raise HTTPException(status_code=400, detail="Consent already revoked")
    record.revoked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return ConsentResponse(
        id=str(record.id),
        student_id=str(record.student_id),
        consent_type=record.consent_type,
        granted_at=record.granted_at,
        revoked_at=record.revoked_at,
        granted_by=record.granted_by,
        notes=record.notes,
    )
