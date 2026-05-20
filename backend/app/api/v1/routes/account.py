"""
app/api/v1/routes/account.py

Account settings endpoints.
REQ-079
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import get_current_user
from app.core.security import get_password_hash, verify_password
from app.db.models import Organisation, OrganisationMembership, User
from app.db.session import get_db
from app.schemas.v2.account import AccountResponse, AccountUpdate, PasswordChange

router = APIRouter(prefix="/account", tags=["account-v2"])


# ---------------------------------------------------------------------------
# GET /account
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
)
def get_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current user account info. REQ-079"""
    user = db.merge(current_user)

    membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )

    org_data: dict = {}
    if membership:
        org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
        if org:
            org_data = {
                "organisation_id": str(org.id),
                "organisation_name": org.name,
                "organisation_slug": org.slug,
                "org_role": membership.role,
            }

    # For student users, display_name should be their student record name
    display_name = user.display_name
    if user.role == "student" and user.student_id:
        from app.modules.school_choice.models.models import Student as StudentModel
        linked_student = db.query(StudentModel).filter(StudentModel.id == user.student_id).first()
        if linked_student:
            display_name = linked_student.name

    return AccountResponse.model_validate({
        "id": user.id,
        "email": user.email,
        "display_name": display_name,
        "preferred_language": user.preferred_language,
        "role": user.role,
        "is_active": user.is_active,
        "can_manage_cohorts": getattr(user, "can_manage_cohorts", False) or user.role == "admin",
        "student_id": str(user.student_id) if user.student_id else None,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        **org_data,
    })


# ---------------------------------------------------------------------------
# PUT /account  — alias for PATCH (spec compatibility)
# ---------------------------------------------------------------------------

@router.put(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
)
def update_account_put(
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update display_name and preferred_language (PUT alias). REQ-079"""
    return update_account(payload=payload, db=db, current_user=current_user)


# ---------------------------------------------------------------------------
# PATCH /account
# ---------------------------------------------------------------------------

@router.patch(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
)
def update_account(
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update display_name and preferred_language. REQ-079"""
    # Merge the user into this session in case it came from a different session
    user = db.merge(current_user)

    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language

    db.commit()
    db.refresh(user)

    # Build response through same path as get_account to handle student_id conversion
    membership = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    org_data: dict = {}
    if membership:
        org = db.query(Organisation).filter(Organisation.id == membership.organisation_id).first()
        if org:
            org_data = {
                "organisation_id": str(org.id),
                "organisation_name": org.name,
                "organisation_slug": org.slug,
                "org_role": membership.role,
            }

    display_name = user.display_name
    if user.role == "student" and user.student_id:
        from app.modules.school_choice.models.models import Student as StudentModel
        linked_student = db.query(StudentModel).filter(StudentModel.id == user.student_id).first()
        if linked_student:
            display_name = linked_student.name

    return AccountResponse.model_validate({
        "id": user.id,
        "email": user.email,
        "display_name": display_name,
        "preferred_language": user.preferred_language,
        "role": user.role,
        "is_active": user.is_active,
        "can_manage_cohorts": getattr(user, "can_manage_cohorts", False) or user.role == "admin",
        "student_id": str(user.student_id) if user.student_id else None,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        **org_data,
    })


# ---------------------------------------------------------------------------
# POST /account/change-password
# ---------------------------------------------------------------------------

@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify current password, hash new password, update. REQ-079"""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.new_password != payload.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_password and confirm_new_password do not match",
        )

    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )

    user = db.merge(current_user)
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ---------------------------------------------------------------------------
# DELETE /account
# ---------------------------------------------------------------------------

@router.delete(
    "",
    status_code=status.HTTP_200_OK,
)
def delete_account(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete account by setting is_active=False + deleted_at. Unlink student_id. REQ-079"""
    from datetime import datetime, timezone
    user = db.merge(current_user)
    user.is_active = False
    user.deleted_at = datetime.now(timezone.utc)
    user.student_id = None
    db.commit()
    return {"message": "Account deactivated successfully"}


# ---------------------------------------------------------------------------
# POST /account/setup-organisation — onboarding org creation
# ---------------------------------------------------------------------------

class SetupOrgRequest(BaseModel):
    school_name: str
    email_domain: str | None = None


@router.post("/setup-organisation", status_code=status.HTTP_201_CREATED)
def setup_organisation(
    payload: SetupOrgRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create organisation during onboarding and add current user as owner."""
    user = db.merge(current_user)

    # Check if user already belongs to an org
    existing = (
        db.query(OrganisationMembership)
        .filter(OrganisationMembership.user_id == user.id)
        .first()
    )
    if existing:
        org = db.query(Organisation).filter(Organisation.id == existing.organisation_id).first()
        if org:
            # Update email_domain if provided on subsequent calls
            if payload.email_domain and not org.email_domain:
                org.email_domain = payload.email_domain
                db.commit()
            return {"id": str(org.id), "name": org.name, "already_existed": True}
        # Orphaned membership — clean it up
        db.delete(existing)
        db.flush()

    # Create org
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", payload.school_name.lower()).strip("-") or "school"
    org = Organisation(name=payload.school_name, slug=slug, email_domain=payload.email_domain)
    db.add(org)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        # Slug conflict — append user id fragment
        org = Organisation(name=payload.school_name, slug=f"{slug}-{str(user.id)[:8]}", email_domain=payload.email_domain)
        db.add(org)
        db.flush()

    # Add user as owner
    membership = OrganisationMembership(
        user_id=user.id,
        organisation_id=org.id,
        role="owner",
        permission="read_write",
    )
    db.add(membership)
    db.flush()

    # Auto-create the "All Students" default cohort for this org
    from app.services.default_cohort import get_or_create_default_cohort
    get_or_create_default_cohort(db, organisation_id=org.id, user_id=user.id)

    db.commit()
    db.refresh(org)
    return {"id": str(org.id), "name": org.name, "already_existed": False}


# ---------------------------------------------------------------------------
# GET /account/permissions — cohort permission matrix for current user
# ---------------------------------------------------------------------------

@router.get("/permissions")
def get_my_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the cohort permission matrix for the authenticated user."""
    from app.services.permission_service import resolve_user_permissions
    user = db.merge(current_user)
    perms = resolve_user_permissions(user, db)
    return {"cohorts": perms}
