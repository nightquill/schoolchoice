"""
app/api/v1/routes/organisations.py

Admin-only CRUD endpoints for organisation management.
"""
from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import require_role
from app.db.models import Organisation, OrganisationMembership, User
from app.db.session import get_db
from app.schemas.organisation import OrganisationCreate, OrganisationResponse

router = APIRouter(prefix="/organisations", tags=["organisations"])


# ---------------------------------------------------------------------------
# Inline request model
# ---------------------------------------------------------------------------

class AddMemberRequest(BaseModel):
    user_id: UUID
    role: str = "member"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-") or "org"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=OrganisationResponse,
)
def create_organisation(
    payload: OrganisationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Create a new organisation. Auto-generates slug from name if not provided."""
    slug = payload.slug or _slugify(payload.name)

    org = Organisation(
        name=payload.name,
        slug=slug,
    )
    db.add(org)
    try:
        db.commit()
        db.refresh(org)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An organisation with slug '{slug}' already exists",
        )
    return org


@router.get("", response_model=dict)
def list_organisations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List all active organisations (paginated)."""
    query = db.query(Organisation).filter(Organisation.is_active == True)  # noqa: E712
    total = query.count()
    orgs = query.offset(skip).limit(limit).all()
    return {
        "items": [OrganisationResponse.model_validate(o).model_dump() for o in orgs],
        "total": total,
    }


@router.get("/{org_id}", response_model=OrganisationResponse)
def get_organisation(
    org_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Get a single organisation by ID."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )
    return org


@router.post(
    "/{org_id}/members",
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    org_id: UUID,
    payload: AddMemberRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Add a user to an organisation."""
    # Verify org exists
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    # Verify user exists
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    membership = OrganisationMembership(
        organisation_id=org_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    db.add(membership)
    try:
        db.commit()
        db.refresh(membership)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organisation",
        )
    return {
        "id": str(membership.id),
        "organisation_id": str(org_id),
        "user_id": str(payload.user_id),
        "role": membership.role,
    }


@router.get("/{org_id}/members")
def list_members(
    org_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """List all members of an organisation."""
    org = db.query(Organisation).filter(Organisation.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found",
        )

    memberships = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.organisation_id == org_id)
        .all()
    )

    items = []
    for m in memberships:
        user = db.query(User).filter(User.id == m.user_id).first()
        items.append({
            "user_id": str(m.user_id),
            "email": user.email if user else None,
            "display_name": user.display_name if user else None,
            "role": m.role,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {"items": items, "total": len(items)}
