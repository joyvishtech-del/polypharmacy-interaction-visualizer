"""Tests for the medications router (CRUD + ownership + OCR scan flow).

NOTE: At the time of writing the medications router carries its own
``/api/v1/medications`` prefix while ``main.py`` mounts it under ``/api/v1``,
so the live URL is ``/api/v1/api/v1/medications``. The ``_meds_url`` helper
discovers the actual base path on first use so the test suite stays
correct if/when the double-prefix bug is fixed.
"""
from __future__ import annotations

import io
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.schemas.medication import OcrCandidate


# ---------------------------------------------------------------------------
# URL discovery helper - resilient to the double-prefix bug.
# ---------------------------------------------------------------------------
_BASE_CACHE: dict[str, str] = {}


def _meds_base(client: TestClient) -> str:
    """Return whichever of the two candidate prefixes actually resolves."""
    cached = _BASE_CACHE.get("base")
    if cached is not None:
        return cached
    for candidate in ("/api/v1/medications", "/api/v1/api/v1/medications"):
        resp = client.get(candidate + "/", headers={"Authorization": "Bearer x"})
        # 401/403 == route exists but auth failed; 404 == not mounted there.
        if resp.status_code != 404:
            _BASE_CACHE["base"] = candidate
            return candidate
    raise AssertionError("medications router is not mounted at any known path")


def _create_med(client: TestClient, headers: dict[str, str], **overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "Aspirin",
        "dosage": "100 mg",
        "frequency": "Daily",
        "notes": None,
    }
    payload.update(overrides)
    resp = client.post(
        f"{_meds_base(client)}/", json=payload, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# Stub external services so no I/O happens.
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def _stub_external(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace storage_service + ocr_service with deterministic in-memory stubs."""
    from app.services import ocr_service, storage_service
    from app.routers import medications as meds_router

    def _fake_upload(user_id: int, file_bytes: bytes, content_type: str) -> str:
        # Return a deterministic object key without hitting boto.
        return f"medications/{user_id}/fake-key.jpg"

    def _fake_signed_url(object_key: str, expires: int = 3600) -> str:
        return f"https://example-cdn/{object_key}?sig=test"

    def _fake_extract(image_bytes: bytes, photo_url: str = "") -> OcrCandidate:
        return OcrCandidate(
            name="Aspirin",
            dosage="100 mg",
            raw_text="Aspirin 100 mg",
            photo_url=photo_url,
        )

    monkeypatch.setattr(storage_service, "upload_medication_photo", _fake_upload)
    monkeypatch.setattr(storage_service, "signed_url", _fake_signed_url)
    monkeypatch.setattr(ocr_service, "extract_medication", _fake_extract)
    # Router-imported names are bound at import time, patch them too.
    monkeypatch.setattr(meds_router.ocr_service, "extract_medication", _fake_extract)
    monkeypatch.setattr(meds_router.storage_service, "upload_medication_photo", _fake_upload)
    monkeypatch.setattr(meds_router.storage_service, "signed_url", _fake_signed_url)


# ---------------------------------------------------------------------------
# Auth gate
# ---------------------------------------------------------------------------
def test_list_requires_auth(client: TestClient) -> None:
    resp = client.get(f"{_meds_base(client)}/")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# CRUD: create / list
# ---------------------------------------------------------------------------
def test_create_manual_medication(client: TestClient, auth_headers: dict[str, str]) -> None:
    body = _create_med(client, auth_headers, name="Lipitor", dosage="20 mg")
    assert body["name"] == "Lipitor"
    assert body["dosage"] == "20 mg"
    assert body["source"] == "manual"


def test_list_returns_only_current_user_medications(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
) -> None:
    _create_med(client, auth_headers, name="Med-A")
    _create_med(client, another_user_headers, name="Med-B")

    resp = client.get(f"{_meds_base(client)}/", headers=auth_headers)
    assert resp.status_code == 200
    names = [m["name"] for m in resp.json()]
    assert names == ["Med-A"]


# ---------------------------------------------------------------------------
# Ownership: user A cannot access user B's row.
# ---------------------------------------------------------------------------
def test_get_other_users_med_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
) -> None:
    other = _create_med(client, another_user_headers)
    resp = client.get(
        f"{_meds_base(client)}/{other['id']}", headers=auth_headers
    )
    assert resp.status_code == 404


def test_update_other_users_med_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
) -> None:
    other = _create_med(client, another_user_headers)
    resp = client.put(
        f"{_meds_base(client)}/{other['id']}",
        json={"name": "hax"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_other_users_med_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
) -> None:
    other = _create_med(client, another_user_headers)
    resp = client.delete(
        f"{_meds_base(client)}/{other['id']}", headers=auth_headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update / delete happy path
# ---------------------------------------------------------------------------
def test_update_own_medication(client: TestClient, auth_headers: dict[str, str]) -> None:
    med = _create_med(client, auth_headers)
    resp = client.put(
        f"{_meds_base(client)}/{med['id']}",
        json={"dosage": "200 mg"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["dosage"] == "200 mg"


def test_delete_own_medication(client: TestClient, auth_headers: dict[str, str]) -> None:
    med = _create_med(client, auth_headers)
    resp = client.delete(
        f"{_meds_base(client)}/{med['id']}", headers=auth_headers
    )
    assert resp.status_code == 204

    after = client.get(
        f"{_meds_base(client)}/{med['id']}", headers=auth_headers
    )
    assert after.status_code == 404


# ---------------------------------------------------------------------------
# Scan: MIME + size validation
# ---------------------------------------------------------------------------
def test_scan_rejects_bad_mime(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        f"{_meds_base(client)}/scan",
        files={"file": ("evil.exe", b"MZ\x00\x00", "application/octet-stream")},
        headers=auth_headers,
    )
    assert resp.status_code == 415


def test_scan_rejects_oversize(client: TestClient, auth_headers: dict[str, str]) -> None:
    from app.services import storage_service

    too_big = b"\xff" * (storage_service.MAX_UPLOAD_BYTES + 1)
    resp = client.post(
        f"{_meds_base(client)}/scan",
        files={"file": ("big.jpg", io.BytesIO(too_big), "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 413


def test_scan_rejects_empty(client: TestClient, auth_headers: dict[str, str]) -> None:
    resp = client.post(
        f"{_meds_base(client)}/scan",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 413


# ---------------------------------------------------------------------------
# Scan: confirm flow persists a new Medication row.
# ---------------------------------------------------------------------------
def test_scan_then_confirm_persists_medication(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    scan = client.post(
        f"{_meds_base(client)}/scan",
        files={"file": ("pill.jpg", b"\x89PNG\r\n", "image/jpeg")},
        headers=auth_headers,
    )
    assert scan.status_code == 200, scan.text
    candidate = scan.json()
    assert candidate["name"] == "Aspirin"
    assert "photo_url" in candidate

    confirm = client.post(
        f"{_meds_base(client)}/scan/confirm",
        json={
            "name": candidate["name"],
            "dosage": candidate["dosage"],
            "frequency": "Daily",
            "photo_url": candidate["photo_url"],
            "raw_text": candidate["raw_text"],
        },
        headers=auth_headers,
    )
    assert confirm.status_code == 201, confirm.text
    assert confirm.json()["source"] == "ocr"
