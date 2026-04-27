"""Dashboard aggregation service.

Single public entry point: :func:`get_summary`. Every query is filtered by
``user_id`` to enforce object-level ownership (no broken-object-level-auth).
Eager loading is used for the last-analysis edge lookup so we avoid an N+1
when computing ``max_severity``.
"""
from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.analysis import Analysis, AnalysisStatus
from app.models.interaction_edge import Severity
from app.models.medication import Medication
from app.schemas.dashboard import DashboardSummary, RecentActivityEvent
from app.schemas.history import SeverityLiteral

logger = logging.getLogger(__name__)


# Priority ordering used to pick the "worst" severity across an analysis's
# interaction edges. Higher number == more severe.
_SEVERITY_PRIORITY: dict[Severity, int] = {
    Severity.green: 1,
    Severity.yellow: 2,
    Severity.red: 3,
}


def _max_severity(analysis: Analysis | None) -> SeverityLiteral | None:
    """Return the worst-severity edge for an analysis, or ``None`` if empty.

    Assumes ``analysis.edges`` has been eager-loaded by the caller.
    """
    if analysis is None or not analysis.edges:
        return None

    worst = max(analysis.edges, key=lambda e: _SEVERITY_PRIORITY[e.severity])
    return worst.severity.value  # type: ignore[return-value]


def get_summary(db: Session, user_id: int) -> DashboardSummary:
    """Build the dashboard summary aggregate for ``user_id``.

    Computes:
      * ``medication_count``: total medications owned by the user.
      * ``last_analysis_at``: ``completed_at`` of the most recent completed
        analysis (``None`` if the user has never completed one).
      * ``last_analysis_max_severity``: worst severity across the most recent
        completed analysis's edges (``red`` > ``yellow`` > ``green``).
      * ``recent_activity``: top 5 most recent events across med-creates and
        analysis-runs, ordered by their timestamp descending.
    """
    # ---- Medication count (single COUNT query) -----------------------------
    medication_count = (
        db.execute(
            select(func.count(Medication.id)).where(Medication.user_id == user_id)
        ).scalar_one()
    )

    # ---- Last completed analysis (eager-load edges to avoid N+1) -----------
    last_completed: Analysis | None = (
        db.execute(
            select(Analysis)
            .where(
                Analysis.user_id == user_id,
                Analysis.status == AnalysisStatus.completed,
                Analysis.completed_at.is_not(None),
            )
            .options(selectinload(Analysis.edges))
            .order_by(Analysis.completed_at.desc())
            .limit(1)
        ).scalar_one_or_none()
    )

    last_analysis_at = last_completed.completed_at if last_completed else None
    last_analysis_max_severity = _max_severity(last_completed)

    # ---- Recent activity (top 5 across two streams, merged in Python) ------
    # Pulling 5 of each is sufficient because the merged top-5 cannot draw
    # more than 5 from a single stream. This keeps queries bounded.
    recent_meds = (
        db.execute(
            select(Medication.id, Medication.name, Medication.created_at)
            .where(Medication.user_id == user_id)
            .order_by(Medication.created_at.desc())
            .limit(5)
        ).all()
    )
    recent_analyses = (
        db.execute(
            select(Analysis.id, Analysis.summary, Analysis.created_at)
            .where(Analysis.user_id == user_id)
            .order_by(Analysis.created_at.desc())
            .limit(5)
        ).all()
    )

    events: list[RecentActivityEvent] = []
    for med_id, med_name, created_at in recent_meds:
        events.append(
            RecentActivityEvent(
                type="med_added",
                occurred_at=created_at,
                label=f"Added {med_name}",
                ref_id=med_id,
            )
        )
    for analysis_id, summary, created_at in recent_analyses:
        # Analyses always have a non-null summary column (default ""); fall
        # back to a generic label when no summary text is available yet
        # (e.g. still pending).
        label = summary.strip() if summary and summary.strip() else "Interaction analysis"
        # Trim long summaries for the activity feed without leaking the full
        # clinical text into a UI-bound string field.
        if len(label) > 80:
            label = label[:77] + "..."
        events.append(
            RecentActivityEvent(
                type="analysis_run",
                occurred_at=created_at,
                label=label,
                ref_id=analysis_id,
            )
        )

    events.sort(key=lambda e: e.occurred_at, reverse=True)
    recent_activity = events[:5]

    return DashboardSummary(
        medication_count=medication_count,
        last_analysis_at=last_analysis_at,
        last_analysis_max_severity=last_analysis_max_severity,
        recent_activity=recent_activity,
    )


__all__ = ["get_summary"]
