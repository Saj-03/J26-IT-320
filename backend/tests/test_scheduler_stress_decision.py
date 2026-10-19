"""Tests for stress proposal decisions (Module F, F4): accept / edit / reject and restore (undo)."""
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.components.scheduler import stress_service as ss
from app.components.scheduler.models import Commitment, FocusSession, SchedulerAuditLog, Task
from app.shared.integration.models import SignalEvent

NOW = datetime(2026, 10, 17, 10, 0)


@pytest.fixture()
def proposal(env):
    """A HIGH proposal: [0] split "DB design", [1] move "Reading", [2] rest break."""
    _, db, current, _ = env
    me = current["user"]
    db.add(SignalEvent(event_id="ev", signal_type="RISK", student_id=me.research_id, status="ACCEPTED",
                       received_at=NOW - timedelta(hours=1),
                       payload={"risk_level": "HIGH", "risk_score": 0.8, "trend": "RISING"}))
    heavy = Task(user_id=me.id, title="DB design", deadline=NOW + timedelta(days=7), estimated_minutes=70,
                 priority=3, cognitive_load="heavy")
    light = Task(user_id=me.id, title="Reading", deadline=NOW + timedelta(days=7), estimated_minutes=60,
                 priority=1, cognitive_load="low", scheduled_start=NOW + timedelta(hours=5))
    db.add_all([heavy, light])
    db.commit()
    change = ss.propose(db, me, now=NOW)
    assert [c["action"] for c in change.change_set] == ["split", "move", "rest"]
    return db, me, change, heavy, light


def pieces(db, parent):
    return db.query(Task).filter_by(parent_id=parent.id).order_by(Task.title).all()


# ---------------------------------------------------------------------------
# Accept / edit / reject
# ---------------------------------------------------------------------------
def test_accept_applies_everything(proposal):
    db, me, change, heavy, light = proposal
    ss.decide(db, me, change.id, "accepted", now=NOW)
    db.refresh(light)
    assert light.scheduled_start == NOW + timedelta(days=3)                       # moved
    assert [(p.title, p.estimated_minutes, p.source) for p in pieces(db, heavy)] == [
        ("DB design (part 1/3)", 25, "scheduler"), ("DB design (part 2/3)", 25, "scheduler"),
        ("DB design (part 3/3)", 20, "scheduler")]
    block = db.query(Commitment).one()
    assert (block.kind, block.start_at, block.end_at - block.start_at) == (
        "protected_block", datetime(2026, 10, 17, 11, 0), timedelta(minutes=30))
    assert change.decision == "accepted" and all(a["applied"] for a in change.edited_change_set)


def test_edit_applies_only_kept_changes(proposal):
    db, me, change, heavy, light = proposal
    ss.decide(db, me, change.id, "edited", keep=[1], now=NOW)                    # only the move
    db.refresh(light)
    assert light.scheduled_start == NOW + timedelta(days=3)
    assert pieces(db, heavy) == [] and db.query(Commitment).count() == 0


def test_reject_changes_nothing(proposal):
    db, me, change, heavy, light = proposal
    ss.decide(db, me, change.id, "rejected", now=NOW)
    db.refresh(light)
    assert light.scheduled_start == NOW + timedelta(hours=5)
    assert pieces(db, heavy) == [] and db.query(Commitment).count() == 0
    assert change.edited_change_set == []


def test_safety_checked_again_at_decision_time(proposal):
    db, me, change, heavy, light = proposal
    light.status = "in_progress"                       # student started a focus session on it after the proposal
    db.add(FocusSession(user_id=me.id, task_id=light.id, started_at=NOW, planned_minutes=25))
    db.commit()
    ss.decide(db, me, change.id, "accepted", now=NOW)
    moved = change.edited_change_set[1]
    assert (moved["applied"], moved["skipped_because"]) == (False, "you are working on it now")
    db.refresh(light)
    assert light.scheduled_start == NOW + timedelta(hours=5)


def test_decide_only_once_and_bad_keep(proposal):
    db, me, change, *_ = proposal
    with pytest.raises(HTTPException) as e:
        ss.decide(db, me, change.id, "edited", keep=[7], now=NOW)
    assert e.value.status_code == 422
    ss.decide(db, me, change.id, "rejected", now=NOW)
    with pytest.raises(HTTPException) as e:
        ss.decide(db, me, change.id, "accepted", now=NOW)
    assert e.value.status_code == 409


def test_decision_is_audited_for_M5(proposal):
    db, me, change, *_ = proposal
    ss.decide(db, me, change.id, "edited", keep=[0, 2], now=NOW)
    row = db.query(SchedulerAuditLog).filter_by(event_type="stress_proposal_decided").one()
    assert row.details["offered"] == ["split", "move", "rest"]
    assert row.details["applied"] == ["split", "rest"] and row.details["decision"] == "edited"


# ---------------------------------------------------------------------------
# Restore (undo)
# ---------------------------------------------------------------------------
def test_restore_puts_the_old_plan_back(proposal):
    db, me, change, heavy, light = proposal
    ss.decide(db, me, change.id, "accepted", now=NOW)
    ss.restore(db, me, change.id, now=NOW + timedelta(minutes=10))
    db.refresh(light)
    assert light.scheduled_start == NOW + timedelta(hours=5)
    assert pieces(db, heavy) == [] and db.query(Commitment).count() == 0
    assert change.decision == "restored"


def test_restore_keeps_pieces_already_started(proposal):
    db, me, change, heavy, _ = proposal
    ss.decide(db, me, change.id, "accepted", now=NOW)
    first = pieces(db, heavy)[0]
    first.status = "done"
    db.commit()
    ss.restore(db, me, change.id, now=NOW)
    assert [p.title for p in pieces(db, heavy)] == ["DB design (part 1/3)"]     # finished work is never deleted


def test_restore_only_after_accept(proposal):
    db, me, change, *_ = proposal
    with pytest.raises(HTTPException) as e:
        ss.restore(db, me, change.id, now=NOW)
    assert e.value.status_code == 409


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def test_endpoints_and_ownership(env):
    client, db, current, other = env
    me = current["user"]
    db.add(SignalEvent(event_id="live", signal_type="RISK", student_id=me.research_id, status="ACCEPTED",
                       received_at=datetime.utcnow(), payload={"risk_level": "MODERATE", "risk_score": 0.5, "trend": "STABLE"}))
    db.add(Task(user_id=me.id, title="Reading", deadline=datetime.utcnow() + timedelta(days=7),
                estimated_minutes=60, priority=1, cognitive_load="low"))
    db.commit()
    pid = client.post("/api/scheduler/stress/propose").json()["id"]
    url = f"/api/scheduler/stress/proposals/{pid}"

    assert client.post(f"{url}/decision", json={"decision": "edited"}).status_code == 422       # keep missing
    assert client.post(f"{url}/decision", json={"decision": "accepted", "keep": [0]}).status_code == 422

    current["user"] = other
    assert client.post(f"{url}/decision", json={"decision": "accepted"}).status_code == 404     # not mine
    current["user"] = me

    body = client.post(f"{url}/decision", json={"decision": "accepted"}).json()
    assert body["decision"] == "accepted" and body["applied"][0]["applied"] is True
    assert client.get("/api/scheduler/stress/proposals").json() == []                          # no longer waiting
    assert client.post(f"{url}/restore").json()["decision"] == "restored"
