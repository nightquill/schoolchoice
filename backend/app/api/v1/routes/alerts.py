"""
app/api/v1/routes/alerts.py

GET /alerts — returns in-app alerts for the current user's students.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.services.alert_service import generate_alerts

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/alerts")
def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return alerts for the authenticated user's students."""
    org_id = getattr(current_user, "active_organisation_id", None)
    alerts = generate_alerts(db, user_id=current_user.id, organisation_id=org_id)
    return {"alerts": alerts, "count": len(alerts)}
