"""Interactions router - run, fetch, and delete interaction analyses.

All endpoints are mounted under ``/api/v1/interactions`` (the ``/api/v1``
prefix is applied in ``main.py``). Every endpoint requires authentication
via ``get_current_user`` and enforces ownership in the service layer.

Privacy contract: medication names, the LLM's raw output, and analysis
summaries are PHI-equivalent and must never be logged.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.interaction import (
    AnalysisResponse,
    AnalyzeRequest,
)
from app.services import interaction_analysis_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/interactions", tags=["interactions"])


# ---------------------------------------------------------------------------
# Run analysis
# ---------------------------------------------------------------------------
@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def analyze(
    payload: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    """Run an interaction analysis on the supplied medication IDs.

    MVP implementation runs the LLM call synchronously in-request. Post-MVP
    this should be moved to ``BackgroundTasks`` or a job queue so the
    endpoint can return ``202`` immediately with a ``pending`` analysis.
    """
    # TODO(post-MVP): replace synchronous run_analysis with a BackgroundTasks
    # / queue dispatch so this endpoint returns immediately with status=pending.
    analysis = interaction_analysis_service.run_analysis(
        db, current_user.id, payload.medication_ids
    )
    logger.info(
        "interactions.analyze id=%s user=%s status=%s",
        analysis.id,
        current_user.id,
        analysis.status.value,
    )
    return AnalysisResponse.model_validate(analysis)


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------
@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    """Return the full analysis (graph, risks, questions, summary)."""
    analysis = interaction_analysis_service.get_analysis(
        db, current_user.id, analysis_id
    )
    return AnalysisResponse.model_validate(analysis)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------
@router.delete(
    "/{analysis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete an analysis owned by the current user (cascades to children)."""
    interaction_analysis_service.delete_analysis(
        db, current_user.id, analysis_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Export (post-MVP stub)
# ---------------------------------------------------------------------------
@router.get(
    "/{analysis_id}/export",
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def export_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """PDF/printable report - stub.

    Verifies ownership so we return a consistent 404 vs 501 surface, then
    returns 501 until the post-MVP PDF generator lands.
    """
    # Ownership check: keeps the surface area consistent with the other
    # endpoints (404 for missing, 501 for "not built yet").
    interaction_analysis_service.get_analysis(
        db, current_user.id, analysis_id
    )
    return JSONResponse(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        content={
            "code": "NOT_IMPLEMENTED",
            "message": "PDF export is not yet available (post-MVP).",
        },
    )


__all__ = ["router"]
