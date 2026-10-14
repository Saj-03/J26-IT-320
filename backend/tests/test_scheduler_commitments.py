"""
Tests for commitments, free time and conflicts (FR-02).

Free-time tests use a FIXED "now" so the answer is always the same:
    NOW = Monday 19 Oct 2026, 00:00 Sri Lanka time  (= Sunday 18:30 UTC)
    Study window = 08:00-22:00 Sri Lanka time = 840 minutes per day
"""
from datetime import datetime, time, timedelta

import pytest

from app.components.scheduler import commitment_service as cs
from app.components.scheduler.models import Commitment, Task

NOW = datetime(2026, 10, 18, 18, 30)       # UTC  (= Mon 19 Oct 00:00 in Sri Lanka)
MONDAY = 0


def add_weekly(db, user, title="SE lecture", day=MONDAY, start=(8, 30), end=(10, 30)):
    """Put a weekly commitment straight into the database."""
    c = Commitment(user_id=user.id, title=title, is_recurring=True, weekday=day,
                   start_time=time(*start), end_time=time(*end))
    db.add(c); db.commit()
    return c


# ---------------------------------------------------------------------------
# API: create / validate / update / delete
# ---------------------------------------------------------------------------
def test_create_weekly_commitment(env):
    client, *_ = env
    r = client.post("/api/scheduler/commitments",
                    json={"title": "SE lecture", "weekday": 0, "start_time": "08:30", "end_time": "10:30"})
    assert r.status_code == 201
    assert r.json()["start_time"] == "08:30:00"


def test_create_one_off_commitment(env):
    client, *_ = env
    r = client.post("/api/scheduler/commitments", json={
        "title": "Club event", "kind": "extracurricular", "is_recurring": False,
        "start_at": "2026-10-22T15:00:00", "end_at": "2026-10-22T17:00:00"})
    assert r.status_code == 201


@pytest.mark.parametrize("bad", [
    {"title": "x", "weekday": 0, "start_time": "10:00"},                          # no end time
    {"title": "x", "weekday": 0, "start_time": "10:00", "end_time": "09:00"},     # end before start
    {"title": "x", "weekday": 7, "start_time": "10:00", "end_time": "11:00"},     # no day 7
    {"title": "x", "is_recurring": False, "start_at": "2026-10-22T15:00:00"},     # no end_at
    {"title": "x", "kind": "party", "weekday": 0, "start_time": "10:00", "end_time": "11:00"},
])
def test_invalid_commitment_rejected(env, bad):
    client, *_ = env
    assert client.post("/api/scheduler/commitments", json=bad).status_code == 422


def test_update_is_checked_against_old_values(env):
    client, db, current, _ = env
    c = add_weekly(db, current["user"])                     # 08:30 - 10:30
    url = f"/api/scheduler/commitments/{c.id}"
    assert client.patch(url, json={"end_time": "08:00"}).status_code == 422   # before old start
    assert client.patch(url, json={"end_time": "11:00"}).json()["end_time"] == "11:00:00"


def test_other_student_cannot_see_or_delete(env):
    client, db, current, other = env
    c = add_weekly(db, current["user"])
    current["user"] = other
    assert client.get("/api/scheduler/commitments").json() == []
    assert client.delete(f"/api/scheduler/commitments/{c.id}").status_code == 404


# ---------------------------------------------------------------------------
# Free time
# ---------------------------------------------------------------------------
def test_free_time_without_commitments(env):
    _, db, current, _ = env
    a = cs.get_availability(db, current["user"], days=1, now=NOW)
    assert a["total_free_minutes"] == 14 * 60                # 08:00-22:00


def test_lecture_is_cut_out_of_free_time(env):
    _, db, current, _ = env
    add_weekly(db, current["user"])                          # Monday 08:30-10:30
    day = cs.get_availability(db, current["user"], days=1, now=NOW)["days"][0]

    assert day["date"] == "2026-10-19"
    assert day["free_minutes"] == 14 * 60 - 120
    # Two gaps: 08:00-08:30 and 10:30-22:00 Sri Lanka time (shown in UTC)
    assert [(s["start"].strftime("%H:%M"), s["minutes"]) for s in day["slots"]] == [("02:30", 30), ("05:00", 690)]


def test_weekly_lecture_only_on_its_day(env):
    _, db, current, _ = env
    add_weekly(db, current["user"])                          # Monday only
    days = cs.get_availability(db, current["user"], days=2, now=NOW)["days"]
    assert [d["free_minutes"] for d in days] == [720, 840]   # Monday less, Tuesday full


def test_past_time_today_is_not_free(env):
    _, db, current, _ = env
    noon = NOW + timedelta(hours=12)                         # 12:00 Sri Lanka time
    a = cs.get_availability(db, current["user"], days=1, now=noon)
    assert a["total_free_minutes"] == 10 * 60                # only 12:00-22:00 left


def test_short_gaps_are_ignored(env):
    _, db, current, _ = env
    add_weekly(db, current["user"], start=(8, 10), end=(10, 0))   # leaves a 10-min gap at 08:00
    day = cs.get_availability(db, current["user"], days=1, now=NOW)["days"][0]
    assert all(s["minutes"] >= cs.MIN_SLOT_MINUTES for s in day["slots"])


# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------
def test_overlapping_commitments_reported_once(env):
    _, db, current, _ = env
    add_weekly(db, current["user"], "Lecture", start=(9, 0), end=(11, 0))
    add_weekly(db, current["user"], "Part-time job", start=(10, 0), end=(12, 0))
    overlaps = [c for c in cs.detect_conflicts(db, current["user"], now=NOW) if c["type"] == "overlap"]
    assert len(overlaps) == 1


def test_impossible_deadline_detected(env):
    _, db, current, _ = env
    me = current["user"]
    add_weekly(db, me)                                       # Monday 08:30-10:30
    # Due Monday 12:00 Sri Lanka (06:30 UTC). Free before it = 30 + 90 = 120 min.
    deadline = datetime(2026, 10, 19, 6, 30)
    ok = Task(user_id=me.id, title="Short", deadline=deadline, estimated_minutes=120)
    db.add(ok); db.commit()
    assert cs.detect_conflicts(db, me, now=NOW) == []        # exactly fits

    ok.estimated_minutes = 150; db.commit()                  # now it does not fit
    problems = cs.detect_conflicts(db, me, now=NOW)
    assert [p["type"] for p in problems] == ["impossible_deadline"]


def test_parent_task_not_counted_twice(env):
    _, db, current, _ = env
    me = current["user"]
    deadline = datetime(2026, 10, 19, 16, 30)                # Monday 22:00 Sri Lanka, 840 min free
    parent = Task(user_id=me.id, title="Report", deadline=deadline, estimated_minutes=600)
    db.add(parent); db.commit()
    db.add(Task(user_id=me.id, parent_id=parent.id, title="Part 1", deadline=deadline, estimated_minutes=600))
    db.commit()
    assert cs.detect_conflicts(db, me, now=NOW) == []        # 600, not 1200
