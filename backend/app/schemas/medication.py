"""Pydantic v2 schemas for the Medications module.

Schema contract:
- ``MedicationCreate`` / ``MedicationUpdate`` -> request bodies
- ``MedicationResponse`` -> shared response shape (``photo_url`` is a signed URL
  populated by the service layer, not the raw object key)
- ``OcrCandidate`` / ``OcrConfirm`` -> photo-scan two-step flow

NOTE: Medication names, dosages, and OCR raw text are PHI-equivalent and must
never be logged at INFO/DEBUG. Schemas here are data containers only.
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.medication import MedicationSource


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
class MedicationCreate(BaseModel):
    """Payload for ``POST /api/v1/medications`` (manual entry)."""

    name: str = Field(min_length=1, max_length=200)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    start_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class MedicationUpdate(BaseModel):
    """Payload for ``PUT /api/v1/medications/{id}``.

    All fields are optional; only those provided will be updated.
    """

    name: str | None = Field(default=None, min_length=1, max_length=200)
    dosage: str | None = Field(default=None, min_length=1, max_length=100)
    frequency: str | None = Field(default=None, min_length=1, max_length=100)
    start_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


# ---------------------------------------------------------------------------
# OCR flow
# ---------------------------------------------------------------------------
class OcrCandidate(BaseModel):
    """Result of running OCR over an uploaded medication photo.

    Returned by ``POST /api/v1/medications/scan`` *without* persisting a
    Medication row. ``name`` and ``dosage`` are best-effort heuristic guesses
    and may be ``None`` when the OCR text cannot be parsed; the user is
    expected to review/edit before confirming.
    """

    name: str | None = None
    dosage: str | None = None
    raw_text: str
    photo_url: str = Field(description="Signed URL or object key for the stored photo")


class OcrConfirm(BaseModel):
    """Payload for ``POST /api/v1/medications/scan/confirm``.

    The user has reviewed and (potentially) edited the OCR candidate. All
    user-editable fields are required at confirmation; ``photo_url`` and
    ``raw_text`` are echoed back from the candidate so we can persist them.
    """

    name: str = Field(min_length=1, max_length=200)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    start_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    photo_url: str = Field(min_length=1, max_length=1000)
    raw_text: str


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class MedicationResponse(BaseModel):
    """Public representation of a Medication row.

    ``photo_url`` is populated with a short-lived signed URL by the router
    when the row's stored value is an object key.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    dosage: str
    frequency: str
    start_date: date | None
    notes: str | None
    source: MedicationSource
    photo_url: str | None
    created_at: datetime


__all__ = [
    "MedicationCreate",
    "MedicationUpdate",
    "MedicationResponse",
    "OcrCandidate",
    "OcrConfirm",
]
