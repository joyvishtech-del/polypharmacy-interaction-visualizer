"""Shared FastAPI dependencies.

Provides the canonical ``get_db`` re-export plus authenticated-user resolution.
The auth dependencies decode the bearer JWT, fetch the user row, and enforce
``is_active`` / role checks via the project's custom exceptions.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.exceptions import ForbiddenError

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.user import User


# Re-export ``get_db`` from the database module so routers can depend on
# ``app.dependencies.get_db`` without a deep import. DATABASE-AGENT defines the
# real session factory; this import is intentionally late-bound at call time
# during Phase 1 since ``database.py`` may not yet exist when this file is
# imported in isolation.
def get_db() -> "Session":
    """Yield a SQLAlchemy session.

    Thin re-export of ``app.database.get_db`` so it stays the canonical source.
    """
    from app.database import get_db as _get_db  # local import: avoid hard dep

    yield from _get_db()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: "Session" = Depends(get_db),
) -> "User":
    """Resolve the current authenticated user from the bearer JWT.

    Raises ``ForbiddenError`` for any token that is missing, malformed, of the
    wrong type, expired, or that resolves to a missing/inactive user.
    """
    # Local imports keep this module importable in isolation during Phase 1
    # tooling and prevent circular imports with ``app.auth.jwt``.
    from app.auth.jwt import decode_token
    from app.models.user import User

    if not token:
        raise ForbiddenError("Authentication required")

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise ForbiddenError("Invalid or expired token")

    sub = payload.get("sub")
    if not sub:
        raise ForbiddenError("Invalid token payload")

    try:
        user_id = int(sub)
    except (TypeError, ValueError) as exc:
        raise ForbiddenError("Invalid token payload") from exc

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise ForbiddenError("User is not available")
    return user


async def get_current_admin(
    user: "User" = Depends(get_current_user),
) -> "User":
    """Resolve the current admin user.

    Raises ``ForbiddenError`` if the authenticated user does not have the
    ``admin`` role.
    """
    from app.models.user import UserRole

    if user.role != UserRole.admin:
        raise ForbiddenError("Admin privileges required")
    return user
