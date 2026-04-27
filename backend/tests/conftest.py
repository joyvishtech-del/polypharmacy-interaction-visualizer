"""Shared pytest fixtures for the polypharmacy backend test suite.

The suite runs against an in-memory SQLite database so tests are self-
contained and do not require a running Postgres. To make SQLite cope with
the project's enum + JSON columns we:

* Force ``Settings`` env vars *before* importing app modules.
* Patch every ``sqlalchemy.Enum(...)`` invocation site to ``native_enum=False``
  via a ``conftest`` autouse monkeypatch on the SQLAlchemy ``Enum`` factory.
* Use a ``StaticPool`` so the same in-memory database is shared by every
  session opened by the app under test.
"""
from __future__ import annotations

import os
import sys
import uuid
from collections.abc import Generator
from pathlib import Path
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Environment defaults: Settings() reads from env at import time.
# ---------------------------------------------------------------------------
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "7")
os.environ.setdefault("ANTHROPIC_API_KEY", "")  # forces stub LLM
os.environ.setdefault("S3_BUCKET", "test-bucket")
os.environ.setdefault("S3_ACCESS_KEY_ID", "test")
os.environ.setdefault("S3_SECRET_ACCESS_KEY", "test")

# Make ``backend`` importable as the project root for ``from app.* import ...``.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


# ---------------------------------------------------------------------------
# Patch SQLAlchemy Enum to native_enum=False for SQLite compatibility.
# ---------------------------------------------------------------------------
# Postgres native enums don't exist on SQLite; the project models use
# ``Enum(MyEnum, name="...")`` everywhere, which on SQLite falls back to a
# CHECK constraint when ``native_enum=False``. We monkey-patch the Enum
# constructor *before* any model module is imported so model-level Enum
# columns get the override implicitly.
import sqlalchemy as _sa  # noqa: E402

_real_enum = _sa.Enum


def _enum_no_native(*args: Any, **kwargs: Any) -> Any:
    kwargs.setdefault("native_enum", False)
    return _real_enum(*args, **kwargs)


_sa.Enum = _enum_no_native  # type: ignore[assignment]
# Also patch the dialect-level Enum import paths used by mapped_column.
import sqlalchemy.types as _sa_types  # noqa: E402

_sa_types.Enum = _enum_no_native  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Build a single shared in-memory engine for the test session.
# ---------------------------------------------------------------------------
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)

TestSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=TEST_ENGINE, future=True
)

# Now safe to import models / app — Enum patch is in place.
from app.models.base import Base  # noqa: E402  (after patch)
from app.models import (  # noqa: E402,F401  (ensure all models register)
    Analysis,
    AnalysisMedication,
    AnalysisStatus,
    DoctorQuestion,
    InteractionEdge,
    Medication,
    MedicationSource,
    RefreshToken,
    Risk,
    Severity,
    User,
    UserRole,
)


# ---------------------------------------------------------------------------
# Disable slowapi rate limiting for the test suite.
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _disable_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Globally bypass the auth router's per-route rate limits.

    A handful of tests opt back in by re-enabling the limiter via the
    ``rate_limited`` fixture below.
    """
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router.limiter, "enabled", False)


@pytest.fixture
def rate_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-enable rate limiting for tests that explicitly want it."""
    from app.routers import auth as auth_router

    monkeypatch.setattr(auth_router.limiter, "enabled", True)
    # Reset the in-memory storage so previous tests don't bleed counts.
    try:
        auth_router.limiter.reset()
    except Exception:  # pragma: no cover - reset is best-effort
        pass


# ---------------------------------------------------------------------------
# Per-test database fixture: drop + create tables every test for isolation.
# ---------------------------------------------------------------------------
@pytest.fixture
def db() -> Generator[Session, None, None]:
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=TEST_ENGINE)


# ---------------------------------------------------------------------------
# FastAPI test client wired to the test DB.
# ---------------------------------------------------------------------------
@pytest.fixture
def client(db: Session, monkeypatch: pytest.MonkeyPatch):
    """A ``TestClient`` whose ``get_db`` dependency returns the test session.

    Imports ``app`` lazily so the env / Enum patches above take effect first.
    """
    from fastapi.testclient import TestClient

    from app.dependencies import get_db
    from app.main import app

    def _override_get_db() -> Generator[Session, None, None]:
        try:
            yield db
        finally:
            # Outer fixture cleans up; nothing to do here.
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth helpers: register a unique user and return its bearer headers.
# ---------------------------------------------------------------------------
def _register_and_login(client: Any, email: str, password: str = "password123") -> dict[str, str]:
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    assert reg.status_code == 201, reg.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers(client: Any) -> dict[str, str]:
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    return _register_and_login(client, email)


@pytest.fixture
def another_user_headers(client: Any) -> dict[str, str]:
    email = f"other-{uuid.uuid4().hex[:8]}@example.com"
    return _register_and_login(client, email)


# ---------------------------------------------------------------------------
# Convenience: low-level user factory for service-layer tests.
# ---------------------------------------------------------------------------
@pytest.fixture
def make_user(db: Session):
    from app.auth.jwt import hash_password
    from app.models.user import User as UserModel

    def _make(email: str | None = None, password: str = "password123") -> UserModel:
        e = email or f"u-{uuid.uuid4().hex[:8]}@example.com"
        user = UserModel(email=e, hashed_password=hash_password(password), full_name="Test")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make
