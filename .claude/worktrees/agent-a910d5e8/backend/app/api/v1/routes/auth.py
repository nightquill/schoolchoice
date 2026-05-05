"""
app/api/v1/routes/auth.py

Authentication endpoints.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import Token, UserCreate, UserResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


# REQ-010, REQ-011, REQ-024
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new counselor account. REQ-010, REQ-011, REQ-024"""
    user = auth_service.register_user(db, email=payload.email, password=payload.password)
    return user


# REQ-010, REQ-011, REQ-031
@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
def login(payload: UserCreate, db: Session = Depends(get_db)):
    """Authenticate a counselor and return a JWT access token. REQ-010, REQ-011, REQ-031"""
    return auth_service.login_for_access_token(db, email=payload.email, password=payload.password)
