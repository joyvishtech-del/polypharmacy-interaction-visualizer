"""S3-compatible object storage service for medication photos.

Wraps ``boto3`` to upload medication photos with private ACL and to mint
short-lived signed URLs for client display. Bucket / endpoint / credentials
come from ``app.config.settings`` so they can be swapped between MinIO (dev)
and AWS S3 (prod) without code changes.

Privacy rule: photos contain PHI-equivalent data and MUST be uploaded
private. Reads happen through pre-signed URLs only.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.exceptions import AppException

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
ALLOWED_CONTENT_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)

CONTENT_TYPE_TO_EXT: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# 10 MB upload cap (also enforced at the router boundary).
MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024


class StorageError(AppException):
    """Raised on object-storage upload / signing failures."""

    status_code = 502
    code = "STORAGE_ERROR"


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------
def _build_client() -> Any:
    """Construct a boto3 S3 client honouring the optional custom endpoint.

    Using a function (rather than a module-level singleton) keeps the import
    side-effect-free and lets tests patch ``boto3.client`` cleanly.
    """
    kwargs: dict[str, Any] = {
        "region_name": settings.S3_REGION or "us-east-1",
        "config": BotoConfig(signature_version="s3v4"),
    }
    if settings.S3_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY_ID
    if settings.S3_SECRET_ACCESS_KEY:
        kwargs["aws_secret_access_key"] = settings.S3_SECRET_ACCESS_KEY
    if settings.S3_ENDPOINT_URL:
        # MinIO or another S3-compatible target.
        kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def upload_medication_photo(
    user_id: int,
    file_bytes: bytes,
    content_type: str,
) -> str:
    """Upload a medication photo and return its object key.

    Parameters
    ----------
    user_id:
        Owner of the photo. Embedded in the object key so storage-level
        listings are partitioned per user.
    file_bytes:
        Raw bytes of the image. Caller is responsible for the 10MB cap, but
        we re-check here as defence-in-depth.
    content_type:
        MIME type. Must be one of :data:`ALLOWED_CONTENT_TYPES`.

    Returns
    -------
    str
        The object key (``medications/{user_id}/{uuid}.{ext}``) -- *not* a
        URL. Use :func:`signed_url` to get a fetchable URL for clients.

    Raises
    ------
    StorageError
        On invalid content type, oversized payload, or boto3 failure.
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise StorageError(f"Unsupported content type: {content_type}")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise StorageError("Uploaded file exceeds 10MB limit")

    ext = CONTENT_TYPE_TO_EXT[content_type]
    object_key = f"medications/{user_id}/{uuid.uuid4().hex}.{ext}"

    client = _build_client()
    try:
        client.put_object(
            Bucket=settings.S3_BUCKET,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
            ACL="private",
        )
    except (BotoCoreError, ClientError) as exc:
        # Never log the bytes / file content itself.
        logger.exception(
            "storage.upload_failed",
            extra={"user_id": user_id, "bytes": len(file_bytes)},
        )
        raise StorageError("Failed to upload medication photo") from exc

    logger.info(
        "storage.upload_succeeded",
        extra={"user_id": user_id, "bytes": len(file_bytes)},
    )
    return object_key


def signed_url(object_key: str, expires: int = 3600) -> str:
    """Generate a short-lived pre-signed GET URL for a stored object.

    Parameters
    ----------
    object_key:
        The key returned from :func:`upload_medication_photo`.
    expires:
        Seconds until the URL expires (default 1 hour, capped at 7 days).

    Raises
    ------
    StorageError
        If boto3 cannot mint the URL.
    """
    if expires < 1:
        expires = 1
    if expires > 7 * 24 * 3600:
        expires = 7 * 24 * 3600

    client = _build_client()
    try:
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": object_key},
            ExpiresIn=expires,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.exception("storage.sign_failed")
        raise StorageError("Failed to sign medication photo URL") from exc


__all__ = [
    "ALLOWED_CONTENT_TYPES",
    "MAX_UPLOAD_BYTES",
    "StorageError",
    "upload_medication_photo",
    "signed_url",
]
