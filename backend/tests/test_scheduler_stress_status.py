"""Tests for GET /stress/status - reading Component 4's wellbeing signal safely (Module F, F1)."""
from datetime import datetime, timedelta

from app.components.scheduler.stress import stress_service as ss
from app.components.scheduler.models import ScheduleChange, SchedulerSettings
from app.shared.integration.models import SignalEvent

URL = "/api/scheduler/stress/status"
NOW = datetime(2026, 10, 17, 10, 0)


def add_signal(db, user, level, hours_ago=1, status="ACCEPTED", event_id=None):
    """A RiskSignal row exactly like Component 4 writes it."""
    eid = event_id or f"ev-{level}-{hours_ago}-{status}"
    db.add(SignalEvent(event_id=eid, signal_type="RISK", student_id=user.research_id, status=status,
                       received_at=NOW - timedelta(hours=hours_ago),
                       payload={"risk_level": level, "risk_score": {"LOW": 0.2, "MODERATE": 0.5, "HIGH": 0.8}[level],
                                "trend": "RISING"}))
    db.commit()
    return eid


def status(db, current, **kw):
    return ss.stress_status(db, current["user"], now=NOW, **kw)


# ---------------------------------------------------------------------------
# Signal -> action
# ---------------------------------------------------------------------------
def test_no_signal_keeps_normal_schedule(env):
    client, *_ = env
    body = client.get(URL).json()
    assert (body["level"], body["action"], body["fresh"]) == (None, "none", False)


def test_high_signal_asks_for_changes(env):
    _, db, current, _ = env
    add_signal(db, current["user"], "HIGH")
    s = status(db, current)
    assert (s["level"], s["action"], s["fresh"], s["trend"]) == ("HIGH", "propose_changes", True, "RISING")


def test_low_signal_changes_nothing(env):
    _, db, current, _ = env
    add_signal(db, current["user"], "LOW")
    assert status(db, current)["action"] == "none"


def test_newest_signal_wins(env):
    _, db, current, _ = env
    add_signal(db, current["user"], "HIGH", hours_ago=5)
    add_signal(db, current["user"], "LOW", hours_ago=1)            # stress went down
    assert (status(db, current)["level"], status(db, current)["action"]) == ("LOW", "none")


def test_old_signal_falls_back_to_normal(env):
    _, db, current, _ = env
    add_signal(db, current["user"], "HIGH", hours_ago=25)
    s = status(db, current)
    assert (s["level"], s["fresh"], s["action"]) == ("HIGH", False, "none")


def test_rejected_signals_are_ignored(env):
    _, db, current, _ = env
    add_signal(db, current["user"], "HIGH", status="STALE")
    assert status(db, current)["level"] is None


def test_other_students_signal_is_not_mine(env):
    _, db, current, other = env
    add_signal(db, other, "HIGH")
    assert status(db, current)["level"] is None


# ---------------------------------------------------------------------------
# Student control + experiment
# ---------------------------------------------------------------------------
def test_student_switch_off_wins(env):
    client, db, current, _ = env
    add_signal(db, current["user"], "HIGH")
    client.patch("/api/scheduler/settings", json={"stress_adaptation_enabled": False})
    s = status(db, current)
    assert (s["action"], s["adaptation_on"], s["level"]) == ("off", False, "HIGH")


def test_static_group_gets_no_stress_changes(env):
    client, db, current, _ = env
    add_signal(db, current["user"], "HIGH")
    client.patch("/api/scheduler/settings", json={"usual_focus_minutes": 25})   # creates the settings row
    db.get(SchedulerSettings, current["user"].id).mode = "static"           # researcher sets the group
    db.commit()
    assert status(db, current)["action"] == "off"


# ---------------------------------------------------------------------------
# Cooldown - C4 sends a signal on every mood tap
# ---------------------------------------------------------------------------
def propose(db, user, event_id, hours_ago):
    db.add(ScheduleChange(user_id=user.id, trigger=ss.STRESS_TRIGGER, signal_event_id=event_id,
                          reason="test", change_set=[], created_at=NOW - timedelta(hours=hours_ago)))
    db.commit()


def test_same_level_not_proposed_twice_in_a_day(env):
    _, db, current, _ = env
    first = add_signal(db, current["user"], "HIGH", hours_ago=3)
    propose(db, current["user"], first, hours_ago=2)
    add_signal(db, current["user"], "HIGH", hours_ago=1)                    # another mood tap
    assert status(db, current)["action"] == "already_proposed"


def test_higher_level_can_propose_again(env):
    _, db, current, _ = env
    first = add_signal(db, current["user"], "MODERATE", hours_ago=3)
    propose(db, current["user"], first, hours_ago=2)
    add_signal(db, current["user"], "HIGH", hours_ago=1)                    # got worse
    assert status(db, current)["action"] == "propose_changes"


def test_cooldown_ends_after_a_day(env):
    _, db, current, _ = env
    first = add_signal(db, current["user"], "HIGH", hours_ago=30)
    propose(db, current["user"], first, hours_ago=25)
    add_signal(db, current["user"], "HIGH", hours_ago=1)
    assert status(db, current)["action"] == "propose_changes"
