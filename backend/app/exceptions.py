"""Custom application exceptions.

These are raised from the service layer and translated to JSON responses by
exception handlers registered in ``main.py``.
"""
from __future__ import annotations


class AppException(Exception):
    """Base class for application-level errors."""

    status_code: int = 500
    code: str = "APP_ERROR"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppException):
    """Raised when a requested resource cannot be found."""

    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found")


class ConflictError(AppException):
    """Raised when an operation conflicts with existing state (e.g. duplicate)."""

    status_code = 409
    code = "CONFLICT"


class ForbiddenError(AppException):
    """Raised when the caller is authenticated but not allowed to act."""

    status_code = 403
    code = "FORBIDDEN"


class OwnershipError(ForbiddenError):
    """Raised when a user tries to access a resource they do not own."""

    code = "OWNERSHIP_VIOLATION"

    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(f"{resource} does not belong to current user")


class RateLimitError(AppException):
    """Raised when a caller exceeds an allowed request rate."""

    status_code = 429
    code = "RATE_LIMITED"
