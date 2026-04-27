"""Auth router - registration, login, token rotation, profile.

All endpoints are mounted under ``/api/v1/auth`` (the ``/api/v1`` prefix is
applied in ``main.py``).

Refresh tokens are delivered as HttpOnly cookies (Secure / SameSite per
config). The JSON response body only ever carries the short-lived access
token, which the frontend keeps in memory.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.exceptions import ForbiddenError
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserResponse,
)
from app.services import auth_service

logger = logging.getLogger(__name__)

# Limiter is initialised here so it can be referenced as a decorator. The same
# instance is mounted on ``app.state.limiter`` in ``main.py``.
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Cookie helpers
# ---------------------------------------------------------------------------
REFRESH_COOKIE_NAME = "refresh_token"
# Scope the cookie to the auth namespace so it isn't sent on every API call.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(
    response: Response, refresh_token: str, expires_at: datetime
) -> None:
    """Attach the HttpOnly refresh-token cookie to ``response``."""
    now = datetime.now(timezone.utc)
    # Honour the JWT expiry but cap by the configured refresh TTL so a stale
    # ``expires_at`` cannot extend the cookie lifetime.
    seconds_until_expiry = max(0, int((expires_at - now).total_seconds()))
    max_age = min(
        seconds_until_expiry,
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Drop the HttpOnly refresh-token cookie."""
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


# ---------------------------------------------------------------------------
# Registration / login / refresh / logout
# ---------------------------------------------------------------------------
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
) -> User:
    """Create a new account.

    No tokens are issued here on purpose - the frontend calls ``/login``
    after a successful register so the cookie is set via the same code path.
    """
    return auth_service.register_user(db, payload)


@router.post("/login", response_model=AccessTokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Exchange email/password for an access token + refresh cookie."""
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    issued = auth_service.issue_token_pair(db, user)
    _set_refresh_cookie(response, issued.refresh_token, issued.refresh_expires_at)
    return AccessTokenResponse(access_token=issued.access_token)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    """Rotate the refresh-token cookie and return a fresh access token.

    The refresh token is read from the ``refresh_token`` HttpOnly cookie -
    there is no JSON body. A missing cookie is a 403, indistinguishable from
    a revoked or expired token to avoid probing.
    """
    cookie_value = request.cookies.get(REFRESH_COOKIE_NAME)
    if not cookie_value:
        raise ForbiddenError("Refresh token missing")

    issued = auth_service.rotate_refresh_token(db, cookie_value)
    _set_refresh_cookie(response, issued.refresh_token, issued.refresh_expires_at)
    return AccessTokenResponse(access_token=issued.access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    """Revoke the refresh token (read from cookie) and clear the cookie."""
    cookie_value = request.cookies.get(REFRESH_COOKIE_NAME)
    if cookie_value:
        auth_service.revoke_refresh_token(db, cookie_value)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    """Return the currently authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Update mutable profile fields for the current user."""
    return auth_service.update_profile(db, current_user, payload)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete the current user and cascade to all owned data.

    Cascade rules on the User model remove RefreshTokens, PasswordResetTokens,
    Medications, Analyses (and their Edges/Risks/DoctorQuestions). Photos in
    object storage are NOT deleted here -- a post-MVP background job should
    sweep orphan keys under ``medications/{user_id}/``.
    """
    db.delete(current_user)
    db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Issue a password-reset token (and, post-MVP, dispatch the email).

    Always returns 200 with the same generic message regardless of whether
    the email is known, to avoid account enumeration.
    """
    auth_service.create_password_reset(db, payload.email)
    return {
        "message": (
            "If an account exists for that address, a reset link has been sent."
        )
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Consume a reset token and update the password.

    Invalid/expired/used tokens all return the same 403 to avoid probing.
    """
    auth_service.reset_password(db, payload.token, payload.new_password)
    return {"message": "Password updated."}


__all__ = ["router", "limiter"]
