"""Pydantic v2 schemas for the Interactions module.

Two layers of schemas live here:

1. **LLM contract schemas** (``LLMEdge``, ``LLMRisk``, ``LLMAnalysisResult``) -
   the exact JSON shape we require Claude to emit. These are validated against
   the model's response *before* anything is persisted.
2. **API schemas** (``AnalyzeRequest``, ``AnalysisResponse``, etc.) - request
   and response shapes for ``/api/v1/interactions``.

NOTE: Medication names, dosages, edge explanations, and analysis summaries are
PHI-equivalent and must never be logged at INFO/DEBUG.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.medication import MedicationResponse


# ---------------------------------------------------------------------------
# Severity literal (re-used across LLM + API responses)
# ---------------------------------------------------------------------------
SeverityLiteral = Literal["red", "yellow", "green"]


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    """Payload for ``POST /api/v1/interactions/analyze``."""

    medication_ids: list[int] = Field(
        min_length=2,
        description="At least two medication IDs (analysis requires interactions)",
    )


# ---------------------------------------------------------------------------
# LLM contract schemas (validated against Claude's response)
# ---------------------------------------------------------------------------
class LLMEdge(BaseModel):
    """A single drug-drug interaction edge as emitted by the LLM."""

    drug_a: str = Field(min_length=1, max_length=200)
    drug_b: str = Field(min_length=1, max_length=200)
    severity: SeverityLiteral
    explanation: str = Field(min_length=1)


class LLMRisk(BaseModel):
    """One of the top-3 risks as emitted by the LLM."""

    rank: Literal[1, 2, 3]
    title: str = Field(min_length=1, max_length=200)
    plain_language: str = Field(min_length=1)


class LLMAnalysisResult(BaseModel):
    """Top-level LLM contract.

    Contract is enforced at parse time:
    - ``risks`` must be exactly 3 entries (one per rank)
    - ``doctor_questions`` must be at least 3 entries
    """

    summary: str = Field(min_length=1)
    edges: list[LLMEdge]
    risks: list[LLMRisk] = Field(min_length=3, max_length=3)
    doctor_questions: list[str] = Field(min_length=3)


# ---------------------------------------------------------------------------
# API response schemas
# ---------------------------------------------------------------------------
class InteractionEdgeResponse(BaseModel):
    """Public representation of an ``InteractionEdge`` row."""

    model_config = ConfigDict(from_attributes=True)

    drug_a: str
    drug_b: str
    severity: SeverityLiteral
    explanation: str


class RiskResponse(BaseModel):
    """Public representation of a ``Risk`` row."""

    model_config = ConfigDict(from_attributes=True)

    rank: int
    title: str
    plain_language_description: str


class DoctorQuestionResponse(BaseModel):
    """Public representation of a ``DoctorQuestion`` row."""

    model_config = ConfigDict(from_attributes=True)

    question: str
    position: int


class AnalysisResponse(BaseModel):
    """Full analysis response (graph + risks + questions + summary)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Literal["pending", "completed", "failed"]
    summary: str
    created_at: datetime
    completed_at: datetime | None
    medications: list[MedicationResponse]
    edges: list[InteractionEdgeResponse]
    risks: list[RiskResponse]
    doctor_questions: list[DoctorQuestionResponse]


class AnalysisListItem(BaseModel):
    """Compact list item for the history view.

    ``max_severity`` is computed from the analysis's edges (red > yellow >
    green); ``None`` when the analysis has no edges yet.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Literal["pending", "completed", "failed"]
    summary: str
    created_at: datetime
    medication_count: int
    max_severity: SeverityLiteral | None


__all__ = [
    "AnalyzeRequest",
    "LLMEdge",
    "LLMRisk",
    "LLMAnalysisResult",
    "InteractionEdgeResponse",
    "RiskResponse",
    "DoctorQuestionResponse",
    "AnalysisResponse",
    "AnalysisListItem",
    "SeverityLiteral",
]
