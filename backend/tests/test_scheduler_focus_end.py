"""
Tests for ending a focus session (FR-05) - part 3:
  real focus time = time passed - pause time, optional 1..5 rating.
Service tests use a fixed clock (T0).
"""
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.components.scheduler import focus_service as fs
from app.components.scheduler.schemas import FocusEndIn, FocusStartIn

URL = "/api/scheduler/focus"
T0 = datetime(2026, 10, 20, 4, 0)


def at(minutes, seconds=0):
    """A time `minutes` after the session started."""
    return T0 + timedelta(minutes=minutes, seconds=seconds)


def start(db, user):
    return fs.start_session(db, user, FocusStartIn(), now=T0)["session"]


# ---------------------------------------------------------------------------
# Real focus time
# ---------------------------------------------------------------------------
def test_no_pauses_focus_time_is_time_passed(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    s = fs.end_session(db, current["user"], s.id, FocusEndIn(), now=at(25))["session"]
    assert (s.actual_minutes, s.ended_at) == (25, at(25))


def test_pause_time_is_removed(env):
    _, db, current, _ = env
    me = current["user"]
    s = start(db, me)
    fs.pause_session(db, me, s.id, now=at(10))
    fs.resume_session(db, me, s.id, now=at(15))              # 5 min pause
    s = fs.end_session(db, me, s.id, FocusEndIn(), now=at(30))["session"]
    assert s.actual_minutes == 25                             # 30 passed - 5 paused


def test_ending_while_paused_closes_the_pause(env):
    _, db, current, _ = env
    me = current["user"]
    s = start(db, me)
    fs.pause_session(db, me, s.id, now=at(20))
    s = fs.end_session(db, me, s.id, FocusEndIn(), now=at(30))["session"]   # still paused at the end
    assert (s.actual_minutes, s.paused_minutes, s.paused_at) == (20, 10, None)


def test_ending_early_gives_short_time(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    s = fs.end_session(db, current["user"], s.id, FocusEndIn(), now=at(7, 40))["session"]
    assert (s.planned_minutes, s.actual_minutes) == (25, 8)   # rounded to nearest minute


# ---------------------------------------------------------------------------
# Rating
# ---------------------------------------------------------------------------
def test_rating_given_at_end(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    s = fs.end_session(db, current["user"], s.id, FocusEndIn(focus_rating=4), now=at(25))["session"]
    assert s.focus_rating == 4


def test_rating_is_optional(env):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    r = client.post(f"{URL}/{sid}/end")                       # no body at all
    assert r.status_code == 200 and r.json()["session"]["focus_rating"] is None


def test_rate_after_ending(env):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    client.post(f"{URL}/{sid}/end", json={})
    assert client.post(f"{URL}/{sid}/rating", json={"focus_rating": 2}).json()["focus_rating"] == 2


@pytest.mark.parametrize("bad", [0, 6])
def test_rating_must_be_1_to_5(env, bad):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    assert client.post(f"{URL}/{sid}/end", json={"focus_rating": bad}).status_code == 422


def test_cannot_rate_running_session(env):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    assert client.post(f"{URL}/{sid}/rating", json={"focus_rating": 3}).status_code == 409


# ---------------------------------------------------------------------------
# State rules
# ---------------------------------------------------------------------------
def test_cannot_end_twice(env):
    _, db, current, _ = env
    s = start(db, current["user"])
    fs.end_session(db, current["user"], s.id, FocusEndIn(), now=at(25))
    with pytest.raises(HTTPException) as e:
        fs.end_session(db, current["user"], s.id, FocusEndIn(), now=at(26))
    assert e.value.status_code == 409


def test_after_end_no_active_session_and_new_one_can_start(env):
    client, *_ = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    client.post(f"{URL}/{sid}/end", json={})
    assert client.get(f"{URL}/active").json() is None
    assert client.post(f"{URL}/start", json={}).status_code == 201


def test_other_student_cannot_end_or_rate(env):
    client, _, current, other = env
    sid = client.post(f"{URL}/start", json={}).json()["session"]["id"]
    current["user"] = other
    assert client.post(f"{URL}/{sid}/end", json={}).status_code == 404
    assert client.post(f"{URL}/{sid}/rating", json={"focus_rating": 3}).status_code == 404
