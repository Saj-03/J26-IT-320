"""
Tests for auto-closing sessions the student forgot to end.
Rule: open 3 hours LONGER than planned -> closed, marked invalid, no XP, no task minutes.
"""
from datetime import datetime, timedelta


from app.components.scheduler import focus_service as fs
from app.components.scheduler.models import FocusSession, RewardEvent, Task

T0 = datetime(2026, 10, 20, 4, 0)


def open_session(db, user, planned=25, started=T0, task=None):
    """A running session put straight into the database."""
    s = FocusSession(user_id=user.id, task_id=task.id if task else None,
                     started_at=started, planned_minutes=planned)
    db.add(s); db.commit()
    return s


def after(minutes=0, hours=0):
    return T0 + timedelta(minutes=minutes, hours=hours)


# ---------------------------------------------------------------------------
# When is a session closed?
# ---------------------------------------------------------------------------
def test_forgotten_session_is_closed(env):
    _, db, current, _ = env
    s = open_session(db, current["user"], planned=25)
    closed = fs.auto_close_stale_sessions(db, current["user"], now=after(25, hours=3))
    assert closed == [s]
    assert (s.ended_at, s.actual_minutes, s.completed, s.auto_closed, s.is_valid) == \
           (after(25), 0, False, True, False)        # ends when the timer would have finished


def test_normal_running_session_is_left_alone(env):
    _, db, current, _ = env
    open_session(db, current["user"], planned=25)
    assert fs.auto_close_stale_sessions(db, current["user"], now=after(25, hours=2)) == []


def test_long_planned_session_gets_more_time(env):
    _, db, current, _ = env
    open_session(db, current["user"], planned=180)               # 3-hour study block
    assert fs.auto_close_stale_sessions(db, current["user"], now=after(hours=4)) == []   # still OK
    assert len(fs.auto_close_stale_sessions(db, current["user"], now=after(hours=6))) == 1


def test_paused_forgotten_session_is_closed(env):
    _, db, current, _ = env
    s = open_session(db, current["user"])
    s.paused_at = after(10); db.commit()
    fs.auto_close_stale_sessions(db, current["user"], now=after(hours=5))
    assert (s.auto_closed, s.paused_at) == (True, None)


def test_ended_sessions_are_not_touched(env):
    _, db, current, _ = env
    s = open_session(db, current["user"])
    s.ended_at = after(25); s.actual_minutes = 25; s.completed = True; db.commit()
    assert fs.auto_close_stale_sessions(db, current["user"], now=after(hours=10)) == []
    assert s.is_valid is True


# ---------------------------------------------------------------------------
# No fake rewards / minutes
# ---------------------------------------------------------------------------
def test_no_xp_and_no_task_minutes(env):
    _, db, current, _ = env
    me = current["user"]
    task = Task(user_id=me.id, title="Report", deadline=after(hours=48), estimated_minutes=60)
    db.add(task); db.commit()
    open_session(db, me, task=task)
    fs.auto_close_stale_sessions(db, me, now=after(hours=10))
    db.refresh(task)
    assert task.actual_minutes is None
    assert db.query(RewardEvent).count() == 0


# ---------------------------------------------------------------------------
# What the student sees
# ---------------------------------------------------------------------------
def test_forgotten_session_does_not_block_new_start(env):
    client, db, current, _ = env
    open_session(db, current["user"], started=datetime.utcnow() - timedelta(hours=10))
    assert client.get("/api/scheduler/focus/active").json() is None
    assert client.post("/api/scheduler/focus/start", json={}).status_code == 201


def test_pressing_end_hours_later_does_not_count_the_hours(env):
    client, db, current, _ = env
    s = open_session(db, current["user"], started=datetime.utcnow() - timedelta(hours=10))
    r = client.post(f"/api/scheduler/focus/{s.id}/end", json={})
    assert r.status_code == 409 and "automatically" in r.json()["detail"]
    db.refresh(s)
    assert s.actual_minutes == 0                                  # not 600 minutes


def test_kept_out_of_dashboard_numbers(env):
    _, db, current, _ = env
    me = current["user"]
    open_session(db, me, started=T0)
    fs.auto_close_stale_sessions(db, me, now=after(hours=10))
    good = FocusSession(user_id=me.id, started_at=after(hours=11), ended_at=after(25, hours=11),
                        planned_minutes=25, actual_minutes=25, completed=True)
    db.add(good); db.commit()

    summary = fs.focus_history(db, me)["summary"]
    assert (summary["sessions"], summary["auto_closed"], summary["completion_rate"],
            summary["total_focus_minutes"]) == (1, 1, 1.0, 25)


def test_other_students_sessions_untouched(env):
    _, db, current, other = env
    s = open_session(db, other)
    fs.auto_close_stale_sessions(db, current["user"], now=after(hours=10))
    assert s.ended_at is None
