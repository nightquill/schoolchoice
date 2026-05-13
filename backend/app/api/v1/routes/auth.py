"""
app/api/v1/routes/auth.py

Authentication endpoints.
"""

from fastapi import APIRouter, Depends, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from fastapi import HTTPException
from app.db.session import get_db
from app.db.models import User
from app.schemas.user import Token, UserCreate, UserResponse
from app.services import auth_service
from app.core.security import verify_password, create_access_token
from pydantic import BaseModel

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


class StudentLoginRequest(BaseModel):
    candidate_number: str
    password: str


@router.post("/student-login", response_model=Token, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
def student_login(request: Request, payload: StudentLoginRequest, db: Session = Depends(get_db)):
    """Authenticate a student by candidate_number + password. Returns JWT with student_id claim."""
    from app.modules.school_choice.models.models import Student
    from app.db.models import OrganisationMembership

    # Find user with role=student linked to a student with this candidate_number
    student = db.query(Student).filter(Student.candidate_number == payload.candidate_number).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No student found with this candidate number.")

    user = db.query(User).filter(User.student_id == student.id, User.role == "student").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No login account for this student. Contact your counsellor.")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")

    # Build JWT with student_id
    membership = db.query(OrganisationMembership).filter(OrganisationMembership.user_id == user.id).first()
    token_data = {
        "sub": str(user.id),
        "org_id": str(membership.organisation_id) if membership else None,
        "student_id": str(user.student_id),
    }
    from app.core.config import settings
    from datetime import timedelta
    token = create_access_token(data=token_data, expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": token, "token_type": "bearer", "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}
