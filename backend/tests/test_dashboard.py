"""Tests for the dashboard summary endpoint."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.analysis import Analysis, AnalysisStatus
from app.models.interaction_edge import InteractionEdge, Severity
from app.models.medication import Medication, MedicationSource


def _user_id(client: TestClient, headers: dict[str, str]) -> int:
    return client.get("/api/v1/auth/me", headers=headers).json()["id"]


# ---------------------------------------------------------------------------
# Auth gate
# ---------------------------------------------------------------------------
def test_dashboard_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/v1/dashboard/summary")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Empty state
# ---------------------------------------------------------------------------
def test_dashboard_empty_for_new_user(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["medication_count"] == 0
    assert body["last_analysis_at"] is None
    assert body["last_analysis_max_severity"] is None
    assert body["recent_activity"] == []


# ---------------------------------------------------------------------------
# Counts after seeding
# ---------------------------------------------------------------------------
def test_dashboard_counts_after_seed(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    uid = _user_id(client, auth_headers)
    db.add_all(
        [
            Medication(
                user_id=uid,
                name=f"Med-{i}",
                dosage="10 mg",
                frequency="Daily",
                source=MedicationSource.manual,
            )
            for i in range(3)
        ]
    )

    completed = Analysis(
        user_id=uid,
        summary="recent",
        status=AnalysisStatus.completed,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(completed)
    db.flush()
    db.add(
        InteractionEdge(
            analysis_id=completed.id,
            drug_a="A",
            drug_b="B",
            severity=Severity.yellow,
            explanation="-",
        )
    )
    db.commit()

    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["medication_count"] == 3
    assert body["last_analysis_at"] is not None
    assert body["last_analysis_max_severity"] == "yellow"


# ---------------------------------------------------------------------------
# Severity priority: red > yellow > green.
# ---------------------------------------------------------------------------
def test_dashboard_severity_priority_red_wins(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    uid = _user_id(client, auth_headers)

    a = Analysis(
        user_id=uid,
        summary="rainbow",
        status=AnalysisStatus.completed,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(a)
    db.flush()
    db.add_all(
        [
            InteractionEdge(
                analysis_id=a.id,
                drug_a="A",
                drug_b="B",
                severity=Severity.green,
                explanation="-",
            ),
            InteractionEdge(
                analysis_id=a.id,
                drug_a="A",
                drug_b="C",
                severity=Severity.yellow,
                explanation="-",
            ),
            InteractionEdge(
                analysis_id=a.id,
                drug_a="A",
                drug_b="D",
                severity=Severity.red,
                explanation="-",
            ),
        ]
    )
    db.commit()

    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["last_analysis_max_severity"] == "red"


def test_dashboard_severity_yellow_beats_green(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    uid = _user_id(client, auth_headers)
    a = Analysis(
        user_id=uid,
        summary="x",
        status=AnalysisStatus.completed,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(a)
    db.flush()
    db.add_all(
        [
            InteractionEdge(
                analysis_id=a.id,
                drug_a="A",
                drug_b="B",
                severity=Severity.yellow,
                explanation="-",
            ),
            InteractionEdge(
                analysis_id=a.id,
                drug_a="A",
                drug_b="C",
                severity=Severity.green,
                explanation="-",
            ),
        ]
    )
    db.commit()

    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.json()["last_analysis_max_severity"] == "yellow"


# ---------------------------------------------------------------------------
# Most-recent analysis is the one surfaced.
# ---------------------------------------------------------------------------
def test_dashboard_uses_most_recent_completed_analysis(
    client: TestClient, db: Session, auth_headers: dict[str, str]
) -> None:
    uid = _user_id(client, auth_headers)
    base = datetime.now(timezone.utc)

    older = Analysis(
        user_id=uid,
        summary="old",
        status=AnalysisStatus.completed,
        completed_at=base - timedelta(days=2),
    )
    newer = Analysis(
        user_id=uid,
        summary="new",
        status=AnalysisStatus.completed,
        completed_at=base,
    )
    db.add_all([older, newer])
    db.flush()
    db.add(
        InteractionEdge(
            analysis_id=older.id,
            drug_a="A",
            drug_b="B",
            severity=Severity.red,
            explanation="-",
        )
    )
    db.add(
        InteractionEdge(
            analysis_id=newer.id,
            drug_a="A",
            drug_b="B",
            severity=Severity.green,
            explanation="-",
        )
    )
    db.commit()

    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    body = resp.json()
    # The newer analysis (green) must be the one summarised, not the older red.
    assert body["last_analysis_max_severity"] == "green"
