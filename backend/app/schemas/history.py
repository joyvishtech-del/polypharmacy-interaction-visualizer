"""Pydantic v2 schemas for the History module.

Schemas describe paginated past analyses for a user. ``max_severity`` is the
worst severity across the analysis's interaction edges, computed by the
service layer from eager-loaded edges (red > yellow > green priority).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.analysis import AnalysisStatus

# Traffic-light severity literal shared across history + dashboard schemas.
SeverityLiteral = Literal["red", "yellow", "green"]


class AnalysisListItem(BaseModel):
    """A single row in the user's history list.

    ``max_severity`` is ``None`` when the analysis has no edges (e.g. still
    pending, failed, or completed with no interactions detected).
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: AnalysisStatus
    summary: str
    created_at: datetime
    medication_count: int
    max_severity: SeverityLiteral | None = None


class HistoryListResponse(BaseModel):
    """Paginated envelope for ``GET /api/v1/history``."""

    items: list[AnalysisListItem]
    total: int
    limit: int
    offset: int


__all__ = [
    "AnalysisListItem",
    "HistoryListResponse",
    "SeverityLiteral",
]
