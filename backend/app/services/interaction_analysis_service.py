"""Business logic for the Interactions module.

Routers stay thin and call into these functions. Custom exceptions
(``NotFoundError``, ``OwnershipError``) are translated to JSON responses by
the handlers in ``app.main``.

Privacy contract (CLAUDE.md):
- Every query filters by ``user_id`` to enforce object-level ownership.
- Medication names, dosages, and the LLM's raw output are never logged at
  INFO/DEBUG. Only sanitised counts and IDs are emitted.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session, selectinload

from app.exceptions import NotFoundError
from app.models.analysis import Analysis, AnalysisStatus
from app.models.doctor_question import DoctorQuestion
from app.models.interaction_edge import InteractionEdge, Severity
from app.models.medication import Medication
from app.models.risk import Risk
from app.services import llm_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
_SEVERITY_RANK: dict[Severity, int] = {
    Severity.green: 0,
    Severity.yellow: 1,
    Severity.red: 2,
}


def _max_severity(edges: list[InteractionEdge]) -> Severity | None:
    """Return the most severe edge severity, or ``None`` if no edges."""
    if not edges:
        return None
    return max(edges, key=lambda e: _SEVERITY_RANK[e.severity]).severity


def _load_user_medications(
    db: Session, user_id: int, medication_ids: list[int]
) -> list[Medication]:
    """Load medications, enforcing ownership.

    Raises ``NotFoundError`` if any requested ID is missing or belongs to a
    different user. Order in the returned list matches ``medication_ids``.
    """
    unique_ids = list(dict.fromkeys(medication_ids))  # preserve order, dedupe
    rows = (
        db.query(Medication)
        .filter(Medication.user_id == user_id, Medication.id.in_(unique_ids))
        .all()
    )
    if len(rows) != len(unique_ids):
        # Same error for "missing" vs "not yours" - prevents enumeration.
        raise NotFoundError("Medication")

    by_id = {m.id: m for m in rows}
    return [by_id[mid] for mid in unique_ids]


# ---------------------------------------------------------------------------
# Run analysis
# ---------------------------------------------------------------------------
def run_analysis(
    db: Session, user_id: int, medication_ids: list[int]
) -> Analysis:
    """Run an LLM-driven interaction analysis and persist the result.

    Steps:
    1. Load + ownership-check all medications.
    2. Create an Analysis row with ``status=pending``.
    3. Call the LLM client (Pydantic-validated response).
    4. On success: persist edges/risks/doctor questions, mark completed.
    5. On failure: mark failed, store sanitised message in ``summary``.

    The Analysis row is always persisted - the failure case is observable
    via ``status`` so the UI can surface a retry affordance.
    """
    medications = _load_user_medications(db, user_id, medication_ids)

    analysis = Analysis(
        user_id=user_id,
        summary="",
        status=AnalysisStatus.pending,
    )
    analysis.medications = list(medications)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    logger.info(
        "analysis.start id=%s user=%s med_count=%d",
        analysis.id,
        user_id,
        len(medications),
    )

    # MVP: synchronous LLM call in-request. Post-MVP, swap this to
    # ``BackgroundTasks`` or a job queue and have ``/analyze`` return the
    # pending Analysis immediately.
    try:
        result = llm_client.analyze_interactions(medications)
    except RuntimeError as exc:
        # Sanitised message only - never echo LLM output back to the user.
        analysis.status = AnalysisStatus.failed
        analysis.summary = f"Analysis failed: {exc}"
        analysis.completed_at = datetime.now(timezone.utc)
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        logger.error(
            "analysis.failed id=%s user=%s reason=%s",
            analysis.id,
            user_id,
            type(exc).__name__,
        )
        return analysis

    # Persist children. Cascade-on-Analysis-delete is configured at the model
    # layer, so we just add rows here.
    for edge in result.edges:
        db.add(
            InteractionEdge(
                analysis_id=analysis.id,
                drug_a=edge.drug_a,
                drug_b=edge.drug_b,
                severity=Severity(edge.severity),
                explanation=edge.explanation,
            )
        )
    for risk in result.risks:
        db.add(
            Risk(
                analysis_id=analysis.id,
                rank=risk.rank,
                title=risk.title,
                plain_language_description=risk.plain_language,
            )
        )
    for position, question in enumerate(result.doctor_questions):
        db.add(
            DoctorQuestion(
                analysis_id=analysis.id,
                question=question,
                position=position,
            )
        )

    analysis.summary = result.summary
    analysis.status = AnalysisStatus.completed
    analysis.completed_at = datetime.now(timezone.utc)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    logger.info(
        "analysis.complete id=%s edges=%d risks=%d questions=%d",
        analysis.id,
        len(result.edges),
        len(result.risks),
        len(result.doctor_questions),
    )
    return analysis


# ---------------------------------------------------------------------------
# Read / delete
# ---------------------------------------------------------------------------
def _get_owned_analysis(
    db: Session, user_id: int, analysis_id: int
) -> Analysis:
    """Fetch an Analysis owned by ``user_id`` with relations eager-loaded."""
    analysis = (
        db.query(Analysis)
        .options(
            selectinload(Analysis.medications),
            selectinload(Analysis.edges),
            selectinload(Analysis.risks),
            selectinload(Analysis.doctor_questions),
        )
        .filter(Analysis.id == analysis_id, Analysis.user_id == user_id)
        .first()
    )
    if analysis is None:
        raise NotFoundError("Analysis")
    return analysis


def get_analysis(db: Session, user_id: int, analysis_id: int) -> Analysis:
    """Fetch an analysis (with all relations) belonging to ``user_id``."""
    return _get_owned_analysis(db, user_id, analysis_id)


def delete_analysis(db: Session, user_id: int, analysis_id: int) -> None:
    """Delete an analysis owned by ``user_id``.

    Cascades to ``InteractionEdge``, ``Risk``, ``DoctorQuestion``, and the
    ``AnalysisMedication`` join rows via the model-level cascade rules.
    """
    analysis = (
        db.query(Analysis)
        .filter(Analysis.id == analysis_id, Analysis.user_id == user_id)
        .first()
    )
    if analysis is None:
        raise NotFoundError("Analysis")

    db.delete(analysis)
    db.commit()
    logger.info(
        "analysis.deleted id=%s user=%s", analysis_id, user_id
    )


# ---------------------------------------------------------------------------
# List / pagination
# ---------------------------------------------------------------------------
def list_analyses(
    db: Session, user_id: int, limit: int = 20, offset: int = 0
) -> list[dict[str, object]]:
    """Return paginated ``AnalysisListItem``-shaped dicts for ``user_id``.

    Each item carries a computed ``medication_count`` and a ``max_severity``
    derived from the analysis's edges.
    """
    analyses = (
        db.query(Analysis)
        .options(
            selectinload(Analysis.medications),
            selectinload(Analysis.edges),
        )
        .filter(Analysis.user_id == user_id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    items: list[dict[str, object]] = []
    for a in analyses:
        max_sev = _max_severity(a.edges)
        items.append(
            {
                "id": a.id,
                "status": a.status.value,
                "summary": a.summary,
                "created_at": a.created_at,
                "medication_count": len(a.medications),
                "max_severity": max_sev.value if max_sev is not None else None,
            }
        )
    return items


__all__ = [
    "run_analysis",
    "get_analysis",
    "delete_analysis",
    "list_analyses",
]
