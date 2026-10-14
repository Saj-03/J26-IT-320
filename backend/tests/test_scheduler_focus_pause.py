"""
Tests for pausing and resuming a focus session (FR-05) - part 2.
Service tests use a fixed clock (T0) so pause lengths are exact.
"""
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.components.scheduler import focus_service as fs
from app.components.scheduler.models import FocusSession, SchedulerAuditLog
from app.components.scheduler.schemas import FocusStartIn

URL = "/api/scheduler/focus"
T0 = datetime(2026, 10, 20, 4, 0)          # session start (fixed clock)


def start(db, user):
    return fs.start_session(db, user, FocusStartIn(), now=T0)["session"]


# ---------------------------------------------------------------------------
# Counting pauses and pause time
# ---------------------------------------------------------------------------
def test_one_pause_is_counted(env):
    _, db, current, _ = env
    me = current["user"]
    s = start(db, me)
    fs.pause_session(db, me, s.id, now=T0 + timedelta(minutes=10))
    s = fs.resume_session(db, me, s.id, now=T0 + timedelta(minutes=13))
    assert (s.pause_count, s.paused_seconds, s.paused_minutes, s.paused_at) == (1, 180, 3, None)


def test_many_pauses_add_up(env):
    _, db, current, _ = env
    me = current["user"]
    s = start(db, me)
    # 3 short pauses of 20 seconds each = 60 seconds in total
    for i in range(3):
        at = T0 + timedelta(minutes=5 * (i + 1))
        fs.pause_session(db, me, s.id, now=at)
        s = fs.resume_session(db, me, s.id, now=at + timedelta(seconds=20))
    assert (s.pause_count, s.paused_seconds, s.paused_minutes) == (3, 60, 1)   # not rounded to 0


# ---------------------------------------------------------------------------
# Wrong order of actions
# ---------------------------------------------------------------------------
def test_cannot_pause_twice(env):
    _, db, current, _ = env
    me = current["user"]
    s = start(db, me)
    fs.pause_session(db, me, s.id, now=T0 + timedelta(minutes=1))
    with pytest.raises(HTTPException) as e:
        fs.pause_session(db, me, s.id, now=T0 + timedelta(minutes=2))
    assert e.value.status_code == 409


def test_cannot_resume_when_not_paused(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    with pytest.raises(HTTPException) as e:
        fs.resume_session(db, current["user"], s.id, now=T0 + timedelta(minutes=1))
    assert e.value.status_code == 409


def test_cannot_pause_an_ended_session(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    s.ended_at = T0 + timedelta(minutes=25); db.commit()
    with pytest.raises(HTTPException) as e:
        fs.pause_session(db, current["user"], s.id, now=T0 + timedelta(minutes=30))
    assert e.value.status_code == 409


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def test_pause_resume_through_api(env):
    client, db, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]

    paused = client.post(f"{URL}/{sid}/pause").json()
    assert paused["paused_at"] is not None and paused["pause_count"] == 1
    assert client.get(f"{URL}/active").json()["paused_at"] is not None   # app can show "Paused"

    resumed = client.post(f"{URL}/{sid}/resume").json()
    assert resumed["paused_at"] is None

    events = [e.event_type for e in db.query(SchedulerAuditLog).order_by(SchedulerAuditLog.created_at)]
    assert events == ["focus_started", "focus_paused", "focus_resumed"]


def test_other_student_cannot_pause_my_session(env):
    client, _, current, other = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    current["user"] = other
    assert client.post(f"{URL}/{sid}/pause").status_code == 404


def test_unknown_session_is_404(env):
    client, *_ = env
    assert client.post(f"{URL}/does-not-exist/pause").status_code == 404


def test_paused_session_still_blocks_new_start(env):
    client, db, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    client.post(f"{URL}/{sid}/pause")
    assert client.post(f"{URL}/start", json={}).status_code == 409
    assert db.query(FocusSession).count() == 1
