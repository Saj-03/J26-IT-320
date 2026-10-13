"""
Tests for part 4: after End the system decides
  * completed or not  (focused >= 80% of the plan)  -> label for M1
  * XP (completed sessions only, never twice)
  * task.actual_minutes (focus minutes added to the task)
"""
from datetime import datetime, timedelta

import pytest

from app.components.scheduler import focus_service as fs
from app.components.scheduler.models import RewardEvent, Task
from app.components.scheduler.schemas import FocusEndIn, FocusStartIn

URL = "/api/scheduler/focus"
T0 = datetime(2026, 10, 20, 4, 0)


def at(minutes):
    return T0 + timedelta(minutes=minutes)


def make_task(db, user, load="heavy"):
    t = Task(user_id=user.id, title="Report", deadline=T0 + timedelta(days=3),
             estimated_minutes=120, cognitive_load=load)
    db.add(t); db.commit()
    return t


def run(db, user, focus_minutes, task=None, planned=25):
    """Start a session, end it after `focus_minutes`, return the end result."""
    s = fs.start_session(db, user, FocusStartIn(task_id=task.id if task else None,
                                                planned_minutes=planned), now=T0)["session"]
    return fs.end_session(db, user, s.id, FocusEndIn(), now=at(focus_minutes))


# ---------------------------------------------------------------------------
# Completed label (80% rule)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("focused, expected", [
    (25, True),    # full session
    (20, True),    # exactly 80%
    (19, False),   # just under 80%
    (5, False),    # stopped very early
])
def test_completed_rule(env, focused, expected):
    _, db, current, _ = env
    assert run(db, current["user"], focused)["session"].completed is expected


def test_pause_time_does_not_count_towards_completion(env):
    _, db, current, _ = env
    me = current["user"]
    s = fs.start_session(db, me, FocusStartIn(), now=T0)["session"]
    fs.pause_session(db, me, s.id, now=at(10))
    fs.resume_session(db, me, s.id, now=at(20))              # 10 min pause
    out = fs.end_session(db, me, s.id, FocusEndIn(), now=at(25))
    assert (out["session"].actual_minutes, out["session"].completed) == (15, False)


# ---------------------------------------------------------------------------
# XP
# ---------------------------------------------------------------------------
def test_completed_heavy_session_gets_more_xp(env):
    _, db, current, _ = env
    me = current["user"]
    out = run(db, me, 25, task=make_task(db, me, "heavy"))
    assert out["xp_awarded"] == round(25 * 1.5)               # heavy = x1.5
    assert out["total_xp"] == 38 and out["level"] == 1


def test_session_without_task_counts_as_medium(env):
    _, db, current, _ = env
    assert run(db, current["user"], 25)["xp_awarded"] == 30   # 25 x 1.2


def test_no_xp_when_not_completed(env):
    _, db, current, _ = env
    out = run(db, current["user"], 10)
    assert out["xp_awarded"] == 0
    assert db.query(RewardEvent).count() == 0


def test_xp_never_given_twice_for_same_session(env):
    _, db, current, _ = env
    me = current["user"]
    session = run(db, me, 25)["session"]
    assert fs.award_focus_xp(db, me, session) == 0            # second try gives nothing
    assert db.query(RewardEvent).count() == 1


def test_xp_adds_up_to_levels(env):
    _, db, current, _ = env
    me = current["user"]
    for i in range(6):                                        # 6 x 30 xp = 180
        out = run(db, me, 25)
    assert out["total_xp"] == 180 and out["level"] == 1
    assert run(db, me, 25)["level"] == 2                       # 210 xp -> level 2


# ---------------------------------------------------------------------------
# Task minutes
# ---------------------------------------------------------------------------
def test_focus_minutes_added_to_task(env):
    _, db, current, _ = env
    me = current["user"]
    task = make_task(db, me)
    run(db, me, 25, task=task)
    run(db, me, 10, task=task)                                # not completed, minutes still count
    db.refresh(task)
    assert task.actual_minutes == 35


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def test_end_api_returns_rewards(env):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    body = client.post(f"{URL}/{sid}/end", json={}).json()
    assert set(body) == {"session", "xp_awarded", "total_xp", "level"}
    assert body["session"]["completed"] is False              # ended straight away
    assert body["xp_awarded"] == 0
