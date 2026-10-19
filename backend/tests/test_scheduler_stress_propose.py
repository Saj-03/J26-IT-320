"""Tests for stress proposals (Module F, F3): a lighter plan from changeable tasks only."""
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.components.scheduler import stress_service as ss
from app.components.scheduler.models import SchedulerAuditLog, Task
from app.shared.integration.models import SignalEvent

NOW = datetime(2026, 10, 17, 10, 0)


def signal(db, user, level, hours_ago=1):
    db.add(SignalEvent(event_id=f"ev-{level}-{hours_ago}", signal_type="RISK", student_id=user.research_id,
                       status="ACCEPTED", received_at=NOW - timedelta(hours=hours_ago),
                       payload={"risk_level": level, "risk_score": 0.8, "trend": "RISING"}))
    db.commit()


def task(db, user, title, days=7, priority=3, load="medium", minutes=60, **kw):
    t = Task(user_id=user.id, title=title, deadline=NOW + timedelta(days=days), estimated_minutes=minutes,
             priority=priority, cognitive_load=load, **kw)
    db.add(t)
    db.commit()
    return t


def actions(change):
    return [(c["action"], c["title"]) for c in change.change_set]


# ---------------------------------------------------------------------------
# What gets suggested
# ---------------------------------------------------------------------------
def test_moderate_moves_the_two_lightest_tasks(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "MODERATE")
    task(db, me, "Important", priority=4)
    task(db, me, "Low A", priority=1, days=6)
    task(db, me, "Low B", priority=1, days=9)      # same priority, later deadline -> moved first
    task(db, me, "Medium", priority=2)
    change = ss.propose(db, me, now=NOW)
    assert actions(change) == [("move", "Low B"), ("move", "Low A")]
    assert change.change_set[0]["to"] == ss.move_target(NOW, 2, 8).isoformat()   # Mon 08:00 Sri Lanka time


def test_high_splits_heavy_moves_and_adds_rest(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "HIGH")
    task(db, me, "DB design", load="heavy", minutes=70)
    task(db, me, "Reading", priority=1)
    change = ss.propose(db, me, now=NOW)
    assert actions(change) == [("split", "DB design"), ("move", "Reading"), ("rest", "Rest break")]
    assert change.change_set[0]["pieces"] == [25, 25, 20]
    assert change.change_set[2]["minutes"] == 30


def test_locked_tasks_are_never_in_a_proposal(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "HIGH")
    task(db, me, "Due tomorrow", days=1, priority=1)
    task(db, me, "Fixed", priority=1, is_flexible=False)
    task(db, me, "Top", priority=5, load="heavy")
    change = ss.propose(db, me, now=NOW)
    assert actions(change) == [("rest", "Rest break")]          # only the break is left


def test_task_not_moved_if_deadline_too_close_after_the_move(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "MODERATE")
    task(db, me, "Due in 2.5 days", days=2.5, priority=1)    # moved to day+2 08:00 -> under 1 day + 60 min left
    with pytest.raises(HTTPException) as e:
        ss.propose(db, me, now=NOW)
    assert e.value.status_code == 409 and "can be changed safely" in e.value.detail


# ---------------------------------------------------------------------------
# Saved, audited, nothing applied
# ---------------------------------------------------------------------------
def test_proposal_is_saved_but_tasks_do_not_change(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "MODERATE")
    t = task(db, me, "Reading", priority=1)
    change = ss.propose(db, me, now=NOW)
    db.refresh(t)
    assert (change.decision, change.signal_event_id) == ("proposed", "ev-MODERATE-1")
    assert t.scheduled_start is None and t.estimated_minutes == 60           # untouched
    assert change.previous_plan == [{"task_id": t.id, "scheduled_start": None, "estimated_minutes": 60}]
    assert db.query(SchedulerAuditLog).filter_by(event_type="stress_proposal_created").count() == 1
    assert "Nothing changes until you accept" in change.reason


def test_no_proposal_when_not_needed(env):
    _, db, current, _ = env
    signal(db, current["user"], "LOW")
    with pytest.raises(HTTPException) as e:
        ss.propose(db, current["user"], now=NOW)
    assert e.value.status_code == 409


def test_second_proposal_same_day_is_blocked(env):
    _, db, current, _ = env
    me = current["user"]
    signal(db, me, "HIGH")
    task(db, me, "Reading", priority=1)
    ss.propose(db, me, now=NOW)
    with pytest.raises(HTTPException):
        ss.propose(db, me, now=NOW + timedelta(hours=1))          # cooldown from F1


def test_endpoints(env):
    client, db, current, _ = env
    me = current["user"]
    db.add(SignalEvent(event_id="live", signal_type="RISK", student_id=me.research_id, status="ACCEPTED",
                       received_at=datetime.utcnow(), payload={"risk_level": "HIGH", "risk_score": 0.8, "trend": "RISING"}))
    db.add(Task(user_id=me.id, title="Reading", deadline=datetime.utcnow() + timedelta(days=7),
                estimated_minutes=60, priority=1, cognitive_load="low"))
    db.commit()
    created = client.post("/api/scheduler/stress/propose")
    assert created.status_code == 201
    listed = client.get("/api/scheduler/stress/proposals").json()
    assert [p["id"] for p in listed] == [created.json()["id"]]
    assert client.post("/api/scheduler/stress/propose").status_code == 409     # already proposed today
