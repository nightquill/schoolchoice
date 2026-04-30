"""
app/api/v1/routes/account.py

Account settings endpoints.
REQ-079
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import get_password_hash, verify_password
from app.db.models import User
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
    current_user: User = Depends(get_current_user),
):
    """Return current user account info. REQ-079"""
    return current_user


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
    return user


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
    """Soft-delete account by setting is_active=False. REQ-079"""
    user = db.merge(current_user)
    user.is_active = False
    db.commit()
    return {"message": "Account deactivated successfully"}
