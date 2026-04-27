"""Medications router.

Mounted under ``/api/v1/medications``. Every endpoint requires an
authenticated user, and every database query MUST filter by
``Medication.user_id == current_user.id``.

Privacy rules (enforced here):

1. Missing-or-not-yours rows raise :class:`NotFoundError` (404), not 403,
   so the API does not leak whether a row exists for another user.
2. Logs only ever include user IDs, medication IDs, and counts -- never
   medication names, dosages, notes, or OCR raw text.
3. Stored ``photo_url`` is the object key; responses always return a
   short-lived signed URL.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import (
    APIRouter,
    Depends,
    File,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.exceptions import AppException, ForbiddenError, NotFoundError
from app.models.medication import Medication, MedicationSource
from app.models.user import User
from app.schemas.medication import (
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    OcrCandidate,
    OcrConfirm,
)
from app.services import ocr_service, storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/medications", tags=["medications"])


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_UPLOAD_BYTES = storage_service.MAX_UPLOAD_BYTES


class PayloadTooLargeError(AppException):
    """Raised when an uploaded photo exceeds the 10MB cap."""

    status_code = 413
    code = "PAYLOAD_TOO_LARGE"


class UnsupportedMediaTypeError(AppException):
    """Raised when an uploaded photo's MIME type is not supported."""

    status_code = 415
    code = "UNSUPPORTED_MEDIA_TYPE"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_owned_medication(
    db: Session, medication_id: int, user_id: int
) -> Medication:
    """Fetch a medication owned by ``user_id`` or raise ``NotFoundError``.

    We deliberately raise 404 (not 403) for rows owned by another user so
    the API does not leak existence of resources across accounts.
    """
    med = (
        db.query(Medication)
        .filter(
            Medication.id == medication_id,
            Medication.user_id == user_id,
        )
        .first()
    )
    if med is None:
        raise NotFoundError("Medication")
    return med


def _to_response(med: Medication) -> MedicationResponse:
    """Build a response, swapping the stored object key for a signed URL."""
    photo_url: str | None = None
    if med.photo_url:
        try:
            photo_url = storage_service.signed_url(med.photo_url)
        except storage_service.StorageError:
            # Signing failures shouldn't break the read path -- omit the URL
            # rather than 500. Caller can retry.
            logger.warning(
                "medications.sign_url_failed",
                extra={"medication_id": med.id, "user_id": med.user_id},
            )
            photo_url = None

    return MedicationResponse(
        id=med.id,
        name=med.name,
        dosage=med.dosage,
        frequency=med.frequency,
        start_date=med.start_date,
        notes=med.notes,
        source=med.source,
        photo_url=photo_url,
        created_at=med.created_at,
    )


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------
@router.get("/", response_model=list[MedicationResponse])
async def list_medications(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MedicationResponse]:
    """Return the current user's medications, paginated."""
    rows = (
        db.query(Medication)
        .filter(Medication.user_id == current_user.id)
        .order_by(Medication.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    logger.info(
        "medications.list",
        extra={
            "user_id": current_user.id,
            "count": len(rows),
            "limit": limit,
            "offset": offset,
        },
    )
    return [_to_response(m) for m in rows]


@router.post(
    "/",
    response_model=MedicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_medication(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationResponse:
    """Create a manually entered medication for the current user."""
    med = Medication(
        user_id=current_user.id,
        name=payload.name,
        dosage=payload.dosage,
        frequency=payload.frequency,
        start_date=payload.start_date,
        notes=payload.notes,
        source=MedicationSource.manual,
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    logger.info(
        "medications.created",
        extra={
            "user_id": current_user.id,
            "medication_id": med.id,
            "source": MedicationSource.manual.value,
        },
    )
    return _to_response(med)


@router.get("/{medication_id}", response_model=MedicationResponse)
async def get_medication(
    medication_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationResponse:
    """Fetch a single medication by id (ownership-scoped)."""
    med = _get_owned_medication(db, medication_id, current_user.id)
    return _to_response(med)


@router.put("/{medication_id}", response_model=MedicationResponse)
async def update_medication(
    medication_id: int,
    payload: MedicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationResponse:
    """Update a medication owned by the current user."""
    med = _get_owned_medication(db, medication_id, current_user.id)

    updates: dict[str, Any] = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(med, field, value)

    db.commit()
    db.refresh(med)

    logger.info(
        "medications.updated",
        extra={
            "user_id": current_user.id,
            "medication_id": med.id,
            "fields_updated": sorted(updates.keys()),
        },
    )
    return _to_response(med)


@router.delete(
    "/{medication_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def delete_medication(
    medication_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete a medication owned by the current user."""
    med = _get_owned_medication(db, medication_id, current_user.id)
    db.delete(med)
    db.commit()

    logger.info(
        "medications.deleted",
        extra={"user_id": current_user.id, "medication_id": medication_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# OCR scan flow
# ---------------------------------------------------------------------------
@router.post("/scan", response_model=OcrCandidate)
async def scan_medication(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> OcrCandidate:
    """Upload a medication-bottle photo and run OCR.

    The photo is persisted (private ACL) regardless of whether the user
    eventually confirms -- orphan cleanup is a post-MVP concern. The
    ``OcrCandidate`` returned here is *not* persisted as a Medication
    row; the client must follow up with ``POST /scan/confirm``.
    """
    content_type = (file.content_type or "").lower()
    if content_type not in storage_service.ALLOWED_CONTENT_TYPES:
        raise UnsupportedMediaTypeError(
            "Photo must be image/jpeg, image/png, or image/webp"
        )

    # Read up to MAX+1 bytes to detect oversize without loading unbounded data.
    file_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise PayloadTooLargeError("Photo exceeds 10MB upload limit")
    if not file_bytes:
        raise PayloadTooLargeError("Uploaded photo is empty")

    object_key = storage_service.upload_medication_photo(
        user_id=current_user.id,
        file_bytes=file_bytes,
        content_type=content_type,
    )

    # Embed a signed URL in the candidate so the frontend can preview the
    # photo while the user reviews/edits the OCR fields.
    preview_url = storage_service.signed_url(object_key)

    candidate = ocr_service.extract_medication(
        image_bytes=file_bytes,
        photo_url=preview_url,
    )
    # Replace the preview with the raw object key so the confirm step can
    # store a stable reference rather than a soon-to-expire signed URL.
    candidate = OcrCandidate(
        name=candidate.name,
        dosage=candidate.dosage,
        raw_text=candidate.raw_text,
        photo_url=object_key,
    )

    logger.info(
        "medications.scan",
        extra={
            "user_id": current_user.id,
            "bytes": len(file_bytes),
            "name_detected": candidate.name is not None,
            "dosage_detected": candidate.dosage is not None,
        },
    )
    return candidate


@router.post(
    "/scan/confirm",
    response_model=MedicationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_scanned_medication(
    payload: OcrConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MedicationResponse:
    """Persist a Medication from a reviewed OCR candidate.

    The ``photo_url`` field on the payload is treated as the storage object
    key returned by ``/scan``. We persist the key (not a signed URL) so
    the row stays valid after the URL expires; ``_to_response`` mints a
    fresh signed URL on read.

    Object keys are formatted ``medications/{user_id}/{uuid}.{ext}``. We
    require the prefix to match the current user so a malicious client
    cannot attach another user's photo key to their own medication record.
    """
    expected_prefix = f"medications/{current_user.id}/"
    if not payload.photo_url.startswith(expected_prefix):
        raise ForbiddenError("photo_url does not belong to current user")

    med = Medication(
        user_id=current_user.id,
        name=payload.name,
        dosage=payload.dosage,
        frequency=payload.frequency,
        start_date=payload.start_date,
        notes=payload.notes,
        source=MedicationSource.ocr,
        photo_url=payload.photo_url,
        ocr_raw_text=payload.raw_text,
    )
    db.add(med)
    db.commit()
    db.refresh(med)

    logger.info(
        "medications.scan_confirmed",
        extra={
            "user_id": current_user.id,
            "medication_id": med.id,
            "source": MedicationSource.ocr.value,
        },
    )
    return _to_response(med)


__all__ = ["router"]
