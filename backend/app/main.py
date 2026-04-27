"""FastAPI application entrypoint.

Foundation Phase: app, CORS, exception handlers, and ``/health`` only.
Module routers will be wired in Phase 2 in the marked block below.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.exceptions import (
    AppException,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    RateLimitError,
)

logger = logging.getLogger(__name__)

OPENAPI_TAGS = [
    {"name": "health", "description": "Liveness / readiness probes."},
    {"name": "auth", "description": "Registration, login, token refresh, profile."},
    {"name": "medications", "description": "Medication CRUD and OCR scan flow."},
    {"name": "interactions", "description": "Run and retrieve interaction analyses."},
    {"name": "history", "description": "Past analyses for the current user."},
    {"name": "dashboard", "description": "Aggregated dashboard data."},
    {"name": "admin", "description": "Admin-only operations (post-MVP)."},
]

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    openapi_tags=OPENAPI_TAGS,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_cors_origins = {settings.FRONTEND_ORIGIN, settings.VITE_API_URL}
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in _cors_origins if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------
def _error_payload(exc: AppException) -> dict[str, str]:
    return {"code": exc.code, "message": exc.message}


@app.exception_handler(NotFoundError)
async def _not_found_handler(_: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_payload(exc))


@app.exception_handler(ConflictError)
async def _conflict_handler(_: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_payload(exc))


@app.exception_handler(ForbiddenError)
async def _forbidden_handler(_: Request, exc: ForbiddenError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_payload(exc))


@app.exception_handler(RateLimitError)
async def _rate_limit_handler(_: Request, exc: RateLimitError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_payload(exc))


@app.exception_handler(RateLimitExceeded)
async def _slowapi_rate_limit_handler(
    _: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Translate slowapi's ``RateLimitExceeded`` into the project error shape."""
    return JSONResponse(
        status_code=429,
        content={
            "code": "RATE_LIMITED",
            "message": f"Rate limit exceeded: {exc.detail}",
        },
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    """Lightweight liveness probe."""
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
# The auth router defines its own ``Limiter`` instance and decorates endpoints
# with ``@limiter.limit(...)``. We mount that same limiter on ``app.state`` and
# add ``SlowAPIMiddleware`` so the per-route limits actually fire. Other modules
# that need rate limiting should import ``app.routers.auth.limiter`` to share
# the storage (or replace this with a Redis-backed limiter post-MVP).
from app.routers import auth as auth_router  # noqa: E402

app.state.limiter = auth_router.limiter
app.add_middleware(SlowAPIMiddleware)


# ---------------------------------------------------------------------------
# Routers (Phase 2 — DO NOT EDIT WITHOUT THE OWNING MODULE AGENT)
# ---------------------------------------------------------------------------
# Each module agent appends its router include below. Keep this block as the
# single place where routers get included so it is easy to audit which
# endpoints are exposed.
#
# >>> ROUTER INCLUDES BEGIN >>>
from app.routers import (  # noqa: E402
    dashboard as dashboard_router,
    history as history_router,
    interactions as interactions_router,
    medications as medications_router,
)

app.include_router(auth_router.router, prefix="/api/v1")
app.include_router(medications_router.router, prefix="/api/v1")
app.include_router(interactions_router.router, prefix="/api/v1")
app.include_router(history_router.router, prefix="/api/v1")
app.include_router(dashboard_router.router, prefix="/api/v1")
# <<< ROUTER INCLUDES END <<<
# ---------------------------------------------------------------------------
