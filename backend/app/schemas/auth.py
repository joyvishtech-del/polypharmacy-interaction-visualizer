"""Pydantic v2 schemas for the auth module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    """Payload for ``POST /auth/register``."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    """Payload for ``POST /auth/login`` (JSON body)."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    """Payload for ``POST /auth/refresh`` and ``POST /auth/logout``."""

    refresh_token: str = Field(min_length=1)


class UpdateProfileRequest(BaseModel):
    """Payload for ``PUT /auth/me``."""

    full_name: str | None = Field(default=None, max_length=100)


class ForgotPasswordRequest(BaseModel):
    """Payload for ``POST /auth/forgot-password``."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for ``POST /auth/reset-password``."""

    token: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class TokenResponse(BaseModel):
    """Token pair (internal use only).

    No longer returned by any endpoint - the refresh token is delivered as an
    HttpOnly cookie. This shape remains because the auth service still uses it
    internally as a convenient container, and tests / callers may reference
    the type. Public endpoints return :class:`AccessTokenResponse` instead.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    """Access-token-only response.

    Returned by ``POST /auth/login`` and ``POST /auth/refresh``. The refresh
    token is set as an HttpOnly cookie by the same response and is NEVER
    serialised in the JSON body.
    """

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """Public-safe representation of a User."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_active: bool
    is_verified: bool
    role: UserRole
    created_at: datetime


__all__ = [
    "RegisterRequest",
    "LoginRequest",
    "RefreshRequest",
    "UpdateProfileRequest",
    "ForgotPasswordRequest",
    "ResetPasswordRequest",
    "TokenResponse",
    "AccessTokenResponse",
    "UserResponse",
]
