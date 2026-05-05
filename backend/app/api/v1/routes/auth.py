"""
app/api/v1/routes/auth.py

Authentication endpoints.
"""

from fastapi import APIRouter, Depends, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import Token, UserCreate, UserResponse
from app.services import auth_service

# Limiter instance — attached to the FastAPI app in main.py
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


# REQ-010, REQ-011, REQ-024
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new counselor account. REQ-010, REQ-011, REQ-024"""
    user = auth_service.register_user(db, email=payload.email, password=payload.password)
    return user


# REQ-010, REQ-011, REQ-031
@router.post("/login", response_model=Token, status_code=status.HTTP_200_OK)
@limiter.limit("15/minute")
def login(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    """Authenticate a counselor and return a JWT access token. REQ-010, REQ-011, REQ-031"""
    return auth_service.login_for_access_token(db, email=payload.email, password=payload.password)
