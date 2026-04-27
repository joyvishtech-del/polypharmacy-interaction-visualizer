"""Tests for the auth router: register, login, refresh, logout, /me, rate limit."""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient


# Cookie name + scoped path used by the auth router. Tests assert on these
# directly so a future rename surfaces as a test failure.
REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_cookie_header(resp) -> str:
    """Concatenated ``Set-Cookie`` headers (httpx returns one per cookie)."""
    return "\n".join(resp.headers.get_list("set-cookie"))


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
def test_register_success(client: TestClient) -> None:
    email = f"new-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "New User"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == email
    assert body["full_name"] == "New User"
    assert body["is_active"] is True
    assert "id" in body


def test_register_duplicate_email(client: TestClient) -> None:
    email = f"dup-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "password123", "full_name": "A"}
    first = client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["code"] == "CONFLICT"


def test_register_password_too_short(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "x@example.com", "password": "short", "full_name": "X"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
def test_login_success(client: TestClient) -> None:
    email = f"login-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "L"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    # Refresh token must NOT appear in the JSON body any more.
    assert "refresh_token" not in body

    # The refresh token lives in a Set-Cookie header.
    set_cookie = _set_cookie_header(resp)
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert f"Path={REFRESH_COOKIE_PATH}" in set_cookie
    # The TestClient cookie jar carries the cookie to subsequent calls.
    assert REFRESH_COOKIE in client.cookies


def test_login_wrong_password(client: TestClient) -> None:
    email = f"wp-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "L"},
    )
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "wrongpassword"},
    )
    assert resp.status_code == 403


def test_login_unknown_email(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "password123"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Refresh rotation
# ---------------------------------------------------------------------------
def test_refresh_rotation_revokes_old_token(client: TestClient) -> None:
    email = f"rot-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "R"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert login.status_code == 200
    old_refresh = client.cookies.get(REFRESH_COOKIE)
    assert old_refresh

    rotated = client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    body = rotated.json()
    assert "access_token" in body
    assert "refresh_token" not in body
    new_refresh = client.cookies.get(REFRESH_COOKIE)
    assert new_refresh
    assert new_refresh != old_refresh

    # Old refresh must be rejected. We must replay it explicitly because the
    # cookie jar has already been overwritten with the rotated value.
    replay = client.post(
        "/api/v1/auth/refresh",
        cookies={REFRESH_COOKIE: old_refresh},
    )
    assert replay.status_code == 403

    # Newly issued refresh token still works (cookie jar already carries it).
    again = client.post("/api/v1/auth/refresh")
    assert again.status_code == 200


def test_refresh_with_no_cookie_is_403(client: TestClient) -> None:
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 403


def test_refresh_with_garbage_cookie(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/refresh",
        cookies={REFRESH_COOKIE: "not-a-jwt"},
    )
    assert resp.status_code == 403


def test_refresh_with_access_token_rejected(client: TestClient) -> None:
    """The refresh endpoint must reject access-type JWTs."""
    email = f"acc-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "A"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    ).json()
    resp = client.post(
        "/api/v1/auth/refresh",
        cookies={REFRESH_COOKIE: login["access_token"]},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------
def test_logout_revokes_refresh_and_clears_cookie(client: TestClient) -> None:
    email = f"out-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "O"},
    )
    client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    refresh = client.cookies.get(REFRESH_COOKIE)
    assert refresh

    out = client.post("/api/v1/auth/logout")
    assert out.status_code == 204

    # The Set-Cookie response should clear the cookie (Max-Age=0 or empty value).
    set_cookie = _set_cookie_header(out)
    assert f"{REFRESH_COOKIE}=" in set_cookie
    assert ("Max-Age=0" in set_cookie) or (f'{REFRESH_COOKIE}="";' in set_cookie) or (
        f"{REFRESH_COOKIE}=;" in set_cookie
    )

    # The token is now revoked - replaying it must fail.
    after = client.post(
        "/api/v1/auth/refresh",
        cookies={REFRESH_COOKIE: refresh},
    )
    assert after.status_code == 403


def test_logout_without_cookie_is_idempotent(client: TestClient) -> None:
    """Logout silently no-ops when no cookie is present."""
    resp = client.post("/api/v1/auth/logout")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# /me
# ---------------------------------------------------------------------------
def test_me_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 403


def test_me_with_bad_token_returns_403(client: TestClient) -> None:
    resp = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer garbage"}
    )
    assert resp.status_code == 403


def test_me_returns_current_user(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "email" in body
    assert body["is_active"] is True


def test_update_me_full_name(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.put(
        "/api/v1/auth/me",
        json={"full_name": "Updated Name"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Updated Name"


# ---------------------------------------------------------------------------
# Forgot / reset password
# ---------------------------------------------------------------------------
def test_forgot_password_unknown_email_returns_200(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nobody@example.com"},
    )
    assert resp.status_code == 200
    # No token row should exist for an unknown email.
    from app.models.password_reset_token import PasswordResetToken

    # Use the test session via the dependency to count rows.
    # We can introspect through a fresh client request; simpler: rely on the
    # shared test engine.
    from tests.conftest import TestSessionLocal

    with TestSessionLocal() as s:
        count = s.query(PasswordResetToken).count()
    assert count == 0


def test_forgot_password_existing_email_creates_token_row(
    client: TestClient,
) -> None:
    email = f"fp-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "F"},
    )
    resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": email},
    )
    assert resp.status_code == 200

    from app.models.password_reset_token import PasswordResetToken
    from app.models.user import User
    from tests.conftest import TestSessionLocal

    with TestSessionLocal() as s:
        user = s.query(User).filter(User.email == email).first()
        assert user is not None
        rows = (
            s.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == user.id)
            .all()
        )
        assert len(rows) == 1
        assert rows[0].used_at is None


def test_reset_password_with_invalid_token_is_403(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={"token": "totally-bogus", "new_password": "newpassword456"},
    )
    assert resp.status_code == 403


def test_reset_password_full_flow(client: TestClient) -> None:
    """Issue a reset, consume it, and verify password + session invalidation."""
    from app.auth.jwt import hash_refresh_token
    from app.models.password_reset_token import PasswordResetToken
    from app.models.refresh_token import RefreshToken
    from app.models.user import User
    from tests.conftest import TestSessionLocal

    email = f"rp-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "RP"},
    )
    # Establish an active refresh token first; it must be revoked by reset.
    client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert client.cookies.get(REFRESH_COOKIE)

    # Trigger a reset and pull the plaintext token by reversing through the
    # hash: the service stores only the sha256 hex, so we generate a known
    # value here by inserting a row directly with a known plaintext.
    plaintext = "known-plaintext-test-token"
    with TestSessionLocal() as s:
        user = s.query(User).filter(User.email == email).first()
        assert user is not None
        s.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_refresh_token(plaintext),
                expires_at=__import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                )
                + __import__("datetime").timedelta(hours=1),
            )
        )
        s.commit()

    # Consume it.
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": plaintext, "new_password": "newpassword456"},
    )
    assert reset.status_code == 200

    # All refresh tokens for this user must now be revoked.
    with TestSessionLocal() as s:
        user = s.query(User).filter(User.email == email).first()
        assert user is not None
        active = (
            s.query(RefreshToken)
            .filter(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
            .count()
        )
        assert active == 0
        # The reset token itself must be marked used.
        used = (
            s.query(PasswordResetToken)
            .filter(PasswordResetToken.user_id == user.id)
            .first()
        )
        assert used is not None
        assert used.used_at is not None

    # Drop the now-invalid refresh cookie so the next login is clean.
    client.cookies.clear()

    # Old password must fail.
    bad = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "password123"},
    )
    assert bad.status_code == 403

    # New password must succeed.
    good = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "newpassword456"},
    )
    assert good.status_code == 200


def test_reset_password_token_is_single_use(client: TestClient) -> None:
    from app.auth.jwt import hash_refresh_token
    from app.models.password_reset_token import PasswordResetToken
    from app.models.user import User
    from tests.conftest import TestSessionLocal

    email = f"single-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password123", "full_name": "S"},
    )
    plaintext = "another-known-plaintext"
    with TestSessionLocal() as s:
        user = s.query(User).filter(User.email == email).first()
        assert user is not None
        s.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_refresh_token(plaintext),
                expires_at=__import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                )
                + __import__("datetime").timedelta(hours=1),
            )
        )
        s.commit()

    first = client.post(
        "/api/v1/auth/reset-password",
        json={"token": plaintext, "new_password": "newpassword456"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/auth/reset-password",
        json={"token": plaintext, "new_password": "yetanotherpw789"},
    )
    assert second.status_code == 403


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
@pytest.mark.usefixtures("rate_limited")
def test_login_rate_limit_fires(client: TestClient) -> None:
    """slowapi-decorated login must 429 after the configured threshold."""
    payload = {"email": "rl@example.com", "password": "password123"}

    last_status = None
    for _ in range(10):
        last_status = client.post("/api/v1/auth/login", json=payload).status_code
        if last_status == 429:
            break

    assert last_status == 429
