"""Auth service - business logic for registration, login, and token rotation.

Routers stay thin and call into these functions. Custom exceptions
(``ConflictError``, ``ForbiddenError``, ``OwnershipError``) are translated to
JSON responses by the handlers in ``app.main``.
"""
from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.config import settings
from app.exceptions import ConflictError, ForbiddenError, OwnershipError
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    UpdateProfileRequest,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Token containers
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class IssuedTokens:
    """A freshly issued access + refresh pair, plus the cookie expiry hint.

    The router pulls ``access_token`` for the JSON body and uses
    ``refresh_token`` + ``refresh_expires_at`` to set the HttpOnly cookie.
    """

    access_token: str
    refresh_token: str
    refresh_expires_at: datetime


# ---------------------------------------------------------------------------
# Registration / authentication
# ---------------------------------------------------------------------------
def register_user(db: Session, payload: RegisterRequest) -> User:
    """Create a new user. Raises ``ConflictError`` if email is taken."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("user.registered id=%s", user.id)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Verify credentials. Raises ``ForbiddenError`` on any failure."""
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.hashed_password:
        raise ForbiddenError("Invalid email or password")
    if not verify_password(password, user.hashed_password):
        raise ForbiddenError("Invalid email or password")
    if not user.is_active:
        raise ForbiddenError("Account is inactive")
    return user


# ---------------------------------------------------------------------------
# Token issuance / rotation / revocation
# ---------------------------------------------------------------------------
def issue_token_pair(db: Session, user: User) -> IssuedTokens:
    """Create an access/refresh pair, persisting only the refresh hash."""
    access = create_access_token(user.id)
    refresh_plain, refresh_hash, expires_at = create_refresh_token(user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            revoked=False,
        )
    )
    db.commit()
    return IssuedTokens(
        access_token=access,
        refresh_token=refresh_plain,
        refresh_expires_at=expires_at,
    )


def rotate_refresh_token(db: Session, refresh_token: str) -> IssuedTokens:
    """Validate, revoke the old refresh token, and issue a fresh pair."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ForbiddenError("Invalid refresh token")

    sub = payload.get("sub")
    if not sub:
        raise ForbiddenError("Invalid refresh token")

    token_hash = hash_refresh_token(refresh_token)
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if record is None or record.revoked:
        raise ForbiddenError("Refresh token has been revoked")
    if record.expires_at <= datetime.now(timezone.utc):
        raise ForbiddenError("Refresh token has expired")
    if str(record.user_id) != str(sub):
        raise OwnershipError("Refresh token")

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None or not user.is_active:
        raise ForbiddenError("Account is inactive")

    # Rotate: revoke old, issue new
    record.revoked = True
    db.add(record)
    db.commit()

    return issue_token_pair(db, user)


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    """Mark a refresh token as revoked. Idempotent on missing/invalid tokens."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        return  # silently ignore — logout should be idempotent

    token_hash = hash_refresh_token(refresh_token)
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if record is None:
        return
    if not record.revoked:
        record.revoked = True
        db.add(record)
        db.commit()


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
def update_profile(
    db: Session, user: User, payload: UpdateProfileRequest
) -> User:
    """Apply allowed profile fields. Email/role/role-change live elsewhere."""
    if payload.full_name is not None:
        user.full_name = payload.full_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
_PASSWORD_RESET_TTL = timedelta(hours=1)


def create_password_reset(db: Session, email: str) -> None:
    """Issue a password-reset token for ``email``.

    Behavior is uniform whether or not the user exists - the function returns
    silently for unknown emails so callers cannot probe for valid accounts.
    On success a row is inserted into ``password_reset_tokens`` and a
    structured log entry is emitted (the plaintext token is NEVER logged).
    """
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # No enumeration: indistinguishable from the success path to callers.
        logger.info("auth.password_reset.unknown_email")
        return

    plaintext = secrets.token_urlsafe(32)
    token_hash = hash_refresh_token(plaintext)  # sha256 hex digest
    expires_at = datetime.now(timezone.utc) + _PASSWORD_RESET_TTL

    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    db.commit()

    # TODO(MVP): integrate email provider (SendGrid / SES / Postmark).
    logger.warning(
        "auth.password_reset.token_issued user_id=%s would_email=true",
        user.id,
    )

    # Dev-only: surface the plaintext URL on the application logger so local
    # devs can complete the flow without an email provider. Gated on
    # ENVIRONMENT so this never fires in staging/prod.
    if settings.ENVIRONMENT == "development":
        logger.warning(
            "auth.password_reset.dev_url user_id=%s url=%s/reset-password?token=%s",
            user.id,
            settings.FRONTEND_ORIGIN,
            plaintext,
        )


def reset_password(db: Session, token: str, new_password: str) -> None:
    """Consume a password-reset token and update the user's password.

    Validation failures raise the same ``ForbiddenError`` so a caller cannot
    distinguish an unknown token from an expired or already-used one. On
    success the token is marked used, the password is rehashed, and ALL of
    the user's refresh tokens are revoked (industry best-practice on
    password change so any sessions an attacker may already hold are killed).
    """
    token_hash = hash_refresh_token(token)
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )

    now = datetime.now(timezone.utc)
    if (
        record is None
        or record.used_at is not None
        or record.expires_at <= now
    ):
        raise ForbiddenError("Invalid or expired reset token")

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None or not user.is_active:
        raise ForbiddenError("Invalid or expired reset token")

    user.hashed_password = hash_password(new_password)
    record.used_at = now

    # Revoke ALL active refresh tokens for this user — password change is a
    # session-invalidation event.
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked.is_(False),
    ).update({RefreshToken.revoked: True}, synchronize_session=False)

    db.commit()
    logger.warning("auth.password_reset.completed user_id=%s", user.id)


__all__ = [
    "IssuedTokens",
    "register_user",
    "authenticate_user",
    "issue_token_pair",
    "rotate_refresh_token",
    "revoke_refresh_token",
    "update_profile",
    "create_password_reset",
    "reset_password",
]
