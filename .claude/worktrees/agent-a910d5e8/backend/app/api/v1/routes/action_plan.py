"""
app/api/v1/routes/action_plan.py

Action plan generation and retrieval endpoints — all protected.
Routes are nested under /students/{student_id}/.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.action_plan import ActionPlanResponse
from app.services import action_plan_service

router = APIRouter(tags=["action-plan"])


# REQ-021, REQ-022, REQ-035, REQ-040
@router.post(
    "/students/{student_id}/action-plan",
    response_model=ActionPlanResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_action_plan(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate (or replace) an action plan for the student.
    REQ-021, REQ-022, REQ-035, REQ-040
    """
    return action_plan_service.generate_action_plan(
        db, student_id=student_id, user_id=current_user.id
    )


# REQ-021, REQ-022, REQ-034, REQ-038
@router.get(
    "/students/{student_id}/action-plan",
    response_model=ActionPlanResponse,
    status_code=status.HTTP_200_OK,
)
def get_action_plan(
    student_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the stored action plan for a student.
    Returns 404 if none has been generated yet.
    REQ-021, REQ-022, REQ-034, REQ-038
    """
    return action_plan_service.get_action_plan(
        db, student_id=student_id, user_id=current_user.id
    )
