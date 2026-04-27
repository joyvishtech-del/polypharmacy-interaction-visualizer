"""Dashboard router - aggregate summary for the current user.

Single endpoint that proxies into ``services.dashboard_service.get_summary``;
all data is scoped by ``user_id`` for ownership enforcement.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import DashboardSummary
from app.services import dashboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummary:
    """Return the dashboard aggregate snapshot for the current user."""
    return dashboard_service.get_summary(db, current_user.id)


__all__ = ["router"]
