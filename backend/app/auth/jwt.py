"""JWT and password hashing helpers.

This module owns:
- Access / refresh JWT creation and decoding
- Password hashing via bcrypt (passlib)
- Refresh-token sha256 hashing for at-rest storage

Tokens follow the contract:
- Access:  ``{"sub": <user_id:str>, "exp": <int>, "type": "access"}``
- Refresh: ``{"sub": <user_id:str>, "exp": <int>, "type": "refresh", "jti": <uuid4:str>}``
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not hashed:
        return False
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# Refresh token hashing (at-rest)
# ---------------------------------------------------------------------------
def hash_refresh_token(token: str) -> str:
    """Return the sha256 hex digest of a refresh token for storage/lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# JWT creation / decoding
# ---------------------------------------------------------------------------
def create_access_token(user_id: int | str, extra: dict[str, Any] | None = None) -> str:
    """Create a signed access token for ``user_id``."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int | str) -> tuple[str, str, datetime]:
    """Create a signed refresh token.

    Returns
    -------
    tuple[str, str, datetime]
        ``(plaintext_jwt, sha256_hash, expires_at)``. The plaintext is returned
        once to the client; only the hash is persisted server-side.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    jti = uuid.uuid4().hex
    payload = {
        "sub": str(user_id),
        "exp": expires_at,
        "type": "refresh",
        "jti": jti,
    }
    plaintext = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return plaintext, hash_refresh_token(plaintext), expires_at


def decode_token(token: str) -> dict[str, Any] | None:
    """Decode and verify a JWT. Returns ``None`` on any failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


__all__ = [
    "hash_password",
    "verify_password",
    "hash_refresh_token",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
]
