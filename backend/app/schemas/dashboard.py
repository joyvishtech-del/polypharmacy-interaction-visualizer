"""Pydantic v2 schemas for the Dashboard module.

The dashboard surfaces a small aggregate snapshot for the currently
authenticated user: a medication count, the most recent analysis timestamp +
worst-severity flag, and a short feed of recent activity events.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.history import SeverityLiteral

# Recent-activity event type literal.
ActivityEventType = Literal["med_added", "analysis_run"]


class RecentActivityEvent(BaseModel):
    """A single entry in the dashboard's recent-activity feed.

    ``ref_id`` is the primary key of the underlying Medication or Analysis
    row so the frontend can deep-link to it. ``label`` is a short
    human-readable summary; medication names are PHI-equivalent and must
    never be logged from this object at INFO/DEBUG.
    """

    type: ActivityEventType
    occurred_at: datetime
    label: str
    ref_id: int


class DashboardSummary(BaseModel):
    """Aggregate snapshot returned by ``GET /api/v1/dashboard/summary``."""

    medication_count: int
    last_analysis_at: datetime | None = None
    last_analysis_max_severity: SeverityLiteral | None = None
    recent_activity: list[RecentActivityEvent] = Field(default_factory=list, max_length=5)


__all__ = [
    "ActivityEventType",
    "RecentActivityEvent",
    "DashboardSummary",
]
