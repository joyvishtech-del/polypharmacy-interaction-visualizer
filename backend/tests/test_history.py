"""Tests for the history router.

Covers:
* List returns only the current user's analyses (ownership filter).
* Pagination respects limit / offset.
* /history/compare is a 501 stub.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.analysis import Analysis, AnalysisStatus
from app.models.interaction_edge import InteractionEdge, Severity


def _seed_analyses(
    db: Session, user_id: int, count: int, summary_prefix: str = "A"
) -> list[Analysis]:
    """Seed ``count`` completed analyses with one green edge each."""
    rows: list[Analysis] = []
    base = datetime.now(timezone.utc)
    for i in range(count):
        a = Analysis(
            user_id=user_id,
            summary=f"{summary_prefix}{i}",
            status=AnalysisStatus.completed,
            completed_at=base - timedelta(minutes=i),
        )
        db.add(a)
        db.flush()
        db.add(
            InteractionEdge(
                analysis_id=a.id,
                drug_a="X",
                drug_b="Y",
                severity=Severity.green,
                explanation="-",
            )
        )
        rows.append(a)
    db.commit()
    return rows


def _make_user_id(client: TestClient, db: Session, headers: dict[str, str]) -> int:
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Auth gate
# ---------------------------------------------------------------------------
def test_history_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/v1/history/")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Ownership: only the caller's analyses come back.
# ---------------------------------------------------------------------------
def test_history_only_returns_own_analyses(
    client: TestClient,
    db: Session,
    auth_headers: dict[str, str],
    another_user_headers: dict[str, str],
) -> None:
    me_id = _make_user_id(client, db, auth_headers)
    other_id = _make_user_id(client, db, another_user_headers)

    _seed_analyses(db, me_id, 2, summary_prefix="MINE-")
    _seed_analyses(db, other_id, 3, summary_prefix="THEIRS-")

    resp = client.get("/api/v1/history/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    summaries = [item["summary"] for item in body["items"]]
    assert all(s.startswith("MINE-") for s in summaries)


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------
def test_history_pagination_limit(
    client: TestClient,
    db: Session,
    auth_headers: dict[str, str],
) -> None:
    me_id = _make_user_id(client, db, auth_headers)
    _seed_analyses(db, me_id, 5)

    resp = client.get(
        "/api/v1/history/?limit=2&offset=0", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 5
    assert body["limit"] == 2
    assert body["offset"] == 0
    assert len(body["items"]) == 2


def test_history_pagination_offset(
    client: TestClient,
    db: Session,
    auth_headers: dict[str, str],
) -> None:
    me_id = _make_user_id(client, db, auth_headers)
    _seed_analyses(db, me_id, 4)

    resp = client.get(
        "/api/v1/history/?limit=10&offset=2", headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2


# ---------------------------------------------------------------------------
# /history/compare is post-MVP and returns 501.
# ---------------------------------------------------------------------------
def test_history_compare_returns_501(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    resp = client.get("/api/v1/history/compare", headers=auth_headers)
    assert resp.status_code == 501
