"""History router - paginated past analyses for the current user.

All endpoints require an authenticated user and filter by ``user_id`` to
enforce object-level ownership. The list endpoint eager-loads each
analysis's edges and medications so we can return ``medication_count`` and
``max_severity`` without an N+1 query per row.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db
from app.models.analysis import Analysis
from app.models.interaction_edge import Severity
from app.models.user import User
from app.schemas.history import (
    AnalysisListItem,
    HistoryListResponse,
    SeverityLiteral,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/history", tags=["history"])


# Priority used to pick the worst severity across an analysis's edges.
_SEVERITY_PRIORITY: dict[Severity, int] = {
    Severity.green: 1,
    Severity.yellow: 2,
    Severity.red: 3,
}


def _compute_max_severity(analysis: Analysis) -> SeverityLiteral | None:
    """Return the worst-severity literal for an analysis, or ``None``.

    Assumes ``analysis.edges`` is already eager-loaded.
    """
    if not analysis.edges:
        return None
    worst = max(analysis.edges, key=lambda e: _SEVERITY_PRIORITY[e.severity])
    return worst.severity.value  # type: ignore[return-value]


@router.get("/", response_model=HistoryListResponse)
async def list_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HistoryListResponse:
    """Return a paginated list of the current user's past analyses."""
    # Total count for pagination - filtered by user_id (ownership).
    total = db.execute(
        select(func.count(Analysis.id)).where(Analysis.user_id == current_user.id)
    ).scalar_one()

    # Page query with eager loading of edges + medications to avoid N+1
    # when computing ``max_severity`` and ``medication_count`` per row.
    rows = (
        db.execute(
            select(Analysis)
            .where(Analysis.user_id == current_user.id)
            .options(
                selectinload(Analysis.edges),
                selectinload(Analysis.medications),
            )
            .order_by(Analysis.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        .scalars()
        .all()
    )

    items = [
        AnalysisListItem(
            id=a.id,
            status=a.status,
            summary=a.summary,
            created_at=a.created_at,
            medication_count=len(a.medications),
            max_severity=_compute_max_severity(a),
        )
        for a in rows
    ]

    return HistoryListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/compare", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def compare_analyses(
    _current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Compare two analyses side-by-side. Post-MVP; currently a 501 stub."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="History compare is not yet available.",
    )


__all__ = ["router"]
