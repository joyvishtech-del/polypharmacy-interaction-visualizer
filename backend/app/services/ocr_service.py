"""OCR service for medication photo scans.

Phase 1 STUB. This module wraps ``pytesseract`` and applies naive heuristics
to pull a likely medication name (first non-empty line) and dosage
(``\\d+\\s*(mg|mcg|g|ml)`` regex) out of the raw OCR text.

A production deployment should replace these heuristics with a clinical NER
model (e.g. spaCy + scispaCy, or a hosted clinical NLP API). The OCR raw
text is PHI-equivalent and MUST NOT be logged at INFO/DEBUG levels.
"""
from __future__ import annotations

import logging
import re
from io import BytesIO
from typing import TYPE_CHECKING

from app.config import settings
from app.schemas.medication import OcrCandidate

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Heuristic patterns
# ---------------------------------------------------------------------------
# Match a number (optionally decimal) followed by a unit. Case-insensitive.
# Examples that match: ``500 mg``, ``5mg``, ``2.5 ml``, ``100MCG``.
_DOSAGE_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\b",
    re.IGNORECASE,
)


def _guess_name(raw_text: str) -> str | None:
    """Pick a likely medication name from the OCR text.

    Heuristic: take the first non-empty line, stripped of trailing
    punctuation. Returns ``None`` if the text is entirely whitespace.
    """
    for line in raw_text.splitlines():
        cleaned = line.strip().strip(".,;:")
        if cleaned:
            # Cap at 200 chars to align with ``Medication.name`` column.
            return cleaned[:200]
    return None


def _guess_dosage(raw_text: str) -> str | None:
    """Pull the first ``<number> <unit>`` token out of the OCR text."""
    match = _DOSAGE_PATTERN.search(raw_text)
    if not match:
        return None
    number, unit = match.group(1), match.group(2).lower()
    return f"{number} {unit}"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def extract_medication(image_bytes: bytes, photo_url: str = "") -> OcrCandidate:
    """Run OCR over ``image_bytes`` and return a candidate medication.

    Parameters
    ----------
    image_bytes:
        Raw image data (JPEG/PNG/WEBP).
    photo_url:
        Pass-through value for the candidate's ``photo_url`` field. The
        caller (router) typically supplies a signed URL.

    Returns
    -------
    OcrCandidate
        ``name`` and ``dosage`` may be ``None`` when heuristics fail.
        ``raw_text`` is always populated (empty string on OCR error).

    Notes
    -----
    Phase 1 stub: heuristics only. Production should swap in a clinical NER
    model. Never log ``raw_text`` -- it is PHI-equivalent.
    """
    raw_text = ""

    try:
        # Local import keeps pytesseract optional at module-import time.
        import pytesseract
        from PIL import Image

        if settings.TESSERACT_PATH:
            # Honour the configured tesseract binary path (Windows / Docker).
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_PATH

        with Image.open(BytesIO(image_bytes)) as image:
            raw_text = pytesseract.image_to_string(image) or ""
    except Exception:
        # Swallow OCR errors so the user can still confirm manually with the
        # uploaded photo. Log at WARNING without including any text content.
        logger.warning("ocr.extract_failed", exc_info=True)
        raw_text = ""

    candidate = OcrCandidate(
        name=_guess_name(raw_text),
        dosage=_guess_dosage(raw_text),
        raw_text=raw_text,
        photo_url=photo_url,
    )
    # Log only counts/flags -- never the OCR content itself.
    logger.info(
        "ocr.extract_completed",
        extra={
            "raw_text_length": len(raw_text),
            "name_detected": candidate.name is not None,
            "dosage_detected": candidate.dosage is not None,
        },
    )
    return candidate


__all__ = ["extract_medication"]
