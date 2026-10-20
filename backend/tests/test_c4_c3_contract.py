"""
C4 -> C3 contract tests (FR-06, proposal Table 4 "integration verification"):
valid, stale, missing, duplicate and malformed risk signals, end to end into the scheduler.

The "valid" signal is built EXACTLY like Component 4 builds it on origin/Sajalee--Burnout-Component
(burnout/service.py to_risk_signal + validator.record), so these tests break if the contract drifts.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.shared.integration.contracts import RiskSignal
from app.shared.integration.models import SignalEvent
from app.shared.integration.router import router as integration_router
from app.shared.integration.validator import record

STATUS = "/api/scheduler/stress/status"


@pytest.fixture()
def both(env):
    """The scheduler test client + a client for the shared integration endpoints (same database)."""
    client, db, current, other = env
    api = FastAPI()
    api.include_router(integration_router, prefix="/api/integration")
    api.dependency_overrides[get_db] = lambda: db
    return client, TestClient(api), db, current["user"]


def c4_signal(research_id, level="HIGH", score=0.82, when=None):
    """Same fields and types as Component 4's to_risk_signal()."""
    return RiskSignal(event_id=str(uuid.uuid4()), student_id=research_id, risk_score=score, risk_level=level,
                      trend="RISING", timestamp=when or datetime.now(timezone.utc))


def test_valid_signal_from_c4_reaches_the_scheduler(both):
    client, _, db, me = both
    record(db, "RISK", c4_signal(me.research_id), "ACCEPTED")          # exactly what C4 does
    status = client.get(STATUS).json()
    assert status["level"] == "HIGH" and status["action"] == "already_proposed"   # proposal made by itself
    waiting = client.get(STATUS.replace("status", "proposals")).json()
    assert len(waiting) == 1 and waiting[0]["decision"] == "proposed"             # waiting for the student


def test_missing_signal_means_normal_schedule(both):
    client, *_ = both
    status = client.get(STATUS).json()
    assert status["level"] is None and status["action"] != "propose_changes"


def test_stale_signal_is_marked_and_ignored(both):
    client, intake, db, me = both
    old = c4_signal(me.research_id, when=datetime.now(timezone.utc) - timedelta(hours=30))
    r = intake.post("/api/integration/risk-signal", json=old.model_dump(mode="json"))
    assert r.json()["status"] == "STALE"
    assert client.get(STATUS).json()["action"] != "propose_changes"   # never acts on old data


def test_duplicate_signal_is_stored_once(both):
    _, intake, db, me = both
    body = c4_signal(me.research_id).model_dump(mode="json")
    assert intake.post("/api/integration/risk-signal", json=body).json()["status"] == "ACCEPTED"
    assert intake.post("/api/integration/risk-signal", json=body).json()["status"] == "DUPLICATE"
    assert db.query(SignalEvent).filter_by(event_id=body["event_id"]).count() == 1


@pytest.mark.parametrize("change", [
    {"risk_level": "VERY_HIGH"},                 # unknown level
    {"risk_score": 1.7},                         # out of range
    {"schema_version": "2.0"},                   # wrong contract version
    {"trend": None},                             # missing field
])
def test_malformed_signal_is_rejected(both, change):
    _, intake, db, me = both
    body = {**c4_signal(me.research_id).model_dump(mode="json"), **change}
    assert intake.post("/api/integration/risk-signal", json=body).status_code == 422
    assert db.query(SignalEvent).count() == 0
