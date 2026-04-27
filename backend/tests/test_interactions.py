"""Tests for the interactions router and analysis service.

The LLM client is fully mocked - no network calls. We exercise:
* Request validation (<2 medications rejected by Pydantic).
* Ownership of every medication ID is enforced.
* Happy path persists Analysis + edges + risks + doctor questions.
* Malformed LLM JSON marks the analysis ``failed`` (no exception leaks).
* Get analysis is ownership-filtered.
* Delete cascades Analysis children.
"""
from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.schemas.interaction import LLMAnalysisResult


# ---------------------------------------------------------------------------
# Medications base helper (mirrors test_medications)
# ---------------------------------------------------------------------------
_MEDS_BASE: dict[str, str] = {}


def _meds_base(client: TestClient) -> str:
    cached = _MEDS_BASE.get("base")
    if cached is not None:
        return cached
    for candidate in ("/api/v1/medications", "/api/v1/api/v1/medications"):
        resp = client.get(candidate + "/", headers={"Authorization": "Bearer x"})
        if resp.status_code != 404:
            _MEDS_BASE["base"] = candidate
            return candidate
    raise AssertionError("medications router not mounted")


def _create_med(client: TestClient, headers: dict[str, str], name: str) -> dict[str, Any]:
    resp = client.post(
        f"{_meds_base(client)}/",
        json={"name": name, "dosage": "10 mg", "frequency": "Daily"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ---------------------------------------------------------------------------
# LLM mocks
# ---------------------------------------------------------------------------
def _good_llm_payload(med_names: list[str]) -> LLMAnalysisResult:
    edges = []
    for i in range(len(med_names)):
        for j in range(i + 1, len(med_names)):
            edges.append(
                {
                    "drug_a": med_names[i],
                    "drug_b": med_names[j],
                    "severity": "yellow",
                    "explanation": "Mild caution.",
                }
            )
    return LLMAnalysisResult.model_validate(
        {
            "summary": "Mock analysis summary.",
            "edges": edges,
            "risks": [
                {"rank": 1, "title": "Risk A", "plain_language": "explanation a"},
                {"rank": 2, "title": "Risk B", "plain_language": "explanation b"},
                {"rank": 3, "title": "Risk C", "plain_language": "explanation c"},
            ],
            "doctor_questions": ["q1?", "q2?", "q3?"],
        }
    )


@pytest.fixture
def mock_llm_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch ``llm_client.analyze_interactions`` to return a valid result."""
    from app.services import llm_client, interaction_analysis_service

    def _fake(meds: list[Any]) -> LLMAnalysisResult:
        return _good_llm_payload([m.name for m in meds])

    monkeypatch.setattr(llm_client, "analyze_interactions", _fake)
    # The service module imports the symbol at module level too.
    monkeypatch.setattr(
        interaction_analysis_service.llm_client, "analyze_interactions", _fake
    )


@pytest.fixture
def mock_llm_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch the LLM client to raise the same RuntimeError it uses on bad JSON."""
    from app.services import llm_client, interaction_analysis_service

    def _fake(_meds: list[Any]) -> LLMAnalysisResult:
        raise RuntimeError("LLM response did not match the required analysis schema")

    monkeypatch.setattr(llm_client, "analyze_interactions", _fake)
    monkeypatch.setattr(
        interaction_analysis_service.llm_client, "analyze_interactions", _fake
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def test_analyze_requires_at_least_two_medications(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    resp = client.post(
        "/api/v1/interactions/analyze",
        json={"medication_ids": [1]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_analyze_requires_auth(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/interactions/analyze", json={"medication_ids": [1, 2]}
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Ownership: cannot analyze another user's medication.
# ---------------------------------------------------------------------------
def test_analyze_rejects_foreign_medication_ids(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _create_med(client, auth_headers, "MyMed")
    theirs = _create_med(client, another_user_headers, "TheirMed")

    resp = client.post(
        "/api/v1/interactions/analyze",
        json={"medication_ids": [mine["id"], theirs["id"]]},
        headers=auth_headers,
    )
    # NotFoundError is raised by the service layer for cross-user IDs.
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Happy path: persistence
# ---------------------------------------------------------------------------
def test_analyze_persists_full_result(
    client: TestClient,
    auth_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    a = _create_med(client, auth_headers, "Aspirin")
    b = _create_med(client, auth_headers, "Warfarin")

    resp = client.post(
        "/api/v1/interactions/analyze",
        json={"medication_ids": [a["id"], b["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert body["summary"] == "Mock analysis summary."
    assert len(body["edges"]) == 1
    assert len(body["risks"]) == 3
    assert len(body["doctor_questions"]) == 3


# ---------------------------------------------------------------------------
# Failure path: malformed LLM result -> analysis row marked failed.
# ---------------------------------------------------------------------------
def test_analyze_marks_failed_on_llm_error(
    client: TestClient,
    auth_headers: dict[str, str],
    mock_llm_fail: None,
) -> None:
    a = _create_med(client, auth_headers, "Med1")
    b = _create_med(client, auth_headers, "Med2")

    resp = client.post(
        "/api/v1/interactions/analyze",
        json={"medication_ids": [a["id"], b["id"]]},
        headers=auth_headers,
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert body["status"] == "failed"
    assert "Analysis failed" in body["summary"]
    assert body["edges"] == []
    assert body["risks"] == []


# ---------------------------------------------------------------------------
# GET / DELETE
# ---------------------------------------------------------------------------
def _run_analysis(client: TestClient, headers: dict[str, str]) -> dict[str, Any]:
    a = _create_med(client, headers, "Aspirin")
    b = _create_med(client, headers, "Warfarin")
    resp = client.post(
        "/api/v1/interactions/analyze",
        json={"medication_ids": [a["id"], b["id"]]},
        headers=headers,
    )
    assert resp.status_code == 202
    return resp.json()


def test_get_analysis_owner_only(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _run_analysis(client, auth_headers)
    # Other user must get 404 - never 200, never 403.
    resp = client.get(
        f"/api/v1/interactions/{mine['id']}", headers=another_user_headers
    )
    assert resp.status_code == 404


def test_get_own_analysis_returns_full_payload(
    client: TestClient,
    auth_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _run_analysis(client, auth_headers)
    resp = client.get(
        f"/api/v1/interactions/{mine['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == mine["id"]
    assert len(body["risks"]) == 3
    assert len(body["medications"]) == 2


def test_delete_analysis_cascades(
    client: TestClient,
    auth_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _run_analysis(client, auth_headers)
    resp = client.delete(
        f"/api/v1/interactions/{mine['id']}", headers=auth_headers
    )
    assert resp.status_code == 204

    # Subsequent get must be 404.
    after = client.get(
        f"/api/v1/interactions/{mine['id']}", headers=auth_headers
    )
    assert after.status_code == 404


def test_delete_other_users_analysis_returns_404(
    client: TestClient,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _run_analysis(client, auth_headers)
    resp = client.delete(
        f"/api/v1/interactions/{mine['id']}", headers=another_user_headers
    )
    assert resp.status_code == 404


def test_export_returns_501_for_owner(
    client: TestClient,
    auth_headers: dict[str, str],
    mock_llm_ok: None,
) -> None:
    mine = _run_analysis(client, auth_headers)
    resp = client.get(
        f"/api/v1/interactions/{mine['id']}/export", headers=auth_headers
    )
    assert resp.status_code == 501
