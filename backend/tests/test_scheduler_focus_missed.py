"""
Tests for missed sessions: a planned session that was never started.
Fixed clock: the task was planned for PLANNED; NOW is 31 minutes later (past the 30-min grace).
"""
from datetime import datetime, timedelta

from app.components.scheduler import focus_service as fs
from app.components.scheduler.models import FocusSession, SchedulerSettings, Task

PLANNED = datetime(2026, 10, 20, 4, 0)
NOW = PLANNED + timedelta(minutes=31)


def planned_task(db, user, status="pending", planned=PLANNED, load="heavy"):
    t = Task(user_id=user.id, title="Report", deadline=PLANNED + timedelta(days=2),
             estimated_minutes=60, cognitive_load=load, status=status, scheduled_start=planned)
    db.add(t); db.commit()
    return t


# ---------------------------------------------------------------------------
# When is a session missed?
# ---------------------------------------------------------------------------
def test_not_started_after_grace_is_missed(env):
    _, db, current, _ = env
    task = planned_task(db, current["user"])
    missed = fs.check_missed_sessions(db, current["user"], now=NOW)
    assert len(missed) == 1
    m = missed[0]
    assert (m.task_id, m.was_missed, m.completed, m.actual_minutes, m.started_at, m.task_load) == \
           (task.id, True, False, 0, PLANNED, "heavy")


def test_still_inside_grace_period_is_not_missed(env):
    _, db, current, _ = env
    planned_task(db, current["user"])
    assert fs.check_missed_sessions(db, current["user"], now=PLANNED + timedelta(minutes=20)) == []


def test_started_session_is_not_missed(env):
    _, db, current, _ = env
    me = current["user"]
    task = planned_task(db, me)
    db.add(FocusSession(user_id=me.id, task_id=task.id, started_at=PLANNED + timedelta(minutes=10),
                        ended_at=PLANNED + timedelta(minutes=35), planned_minutes=25, actual_minutes=25))
    db.commit()
    assert fs.check_missed_sessions(db, me, now=NOW) == []


def test_starting_a_bit_early_also_counts(env):
    _, db, current, _ = env
    me = current["user"]
    task = planned_task(db, me)
    db.add(FocusSession(user_id=me.id, task_id=task.id, started_at=PLANNED - timedelta(minutes=40),
                        ended_at=PLANNED - timedelta(minutes=15), planned_minutes=25, actual_minutes=25))
    db.commit()
    assert fs.check_missed_sessions(db, me, now=NOW) == []


def test_done_task_is_not_missed(env):
    _, db, current, _ = env
    planned_task(db, current["user"], status="done")
    assert fs.check_missed_sessions(db, current["user"], now=NOW) == []


def test_task_without_planned_time_is_ignored(env):
    _, db, current, _ = env
    planned_task(db, current["user"], planned=None)
    assert fs.check_missed_sessions(db, current["user"], now=NOW) == []


# ---------------------------------------------------------------------------
# Safety
# ---------------------------------------------------------------------------
def test_never_recorded_twice(env):
    _, db, current, _ = env
    planned_task(db, current["user"])
    fs.check_missed_sessions(db, current["user"], now=NOW)
    assert fs.check_missed_sessions(db, current["user"], now=NOW + timedelta(hours=2)) == []
    assert db.query(FocusSession).count() == 1


def test_nothing_recorded_when_tracking_off(env):
    _, db, current, _ = env
    me = current["user"]
    db.add(SchedulerSettings(user_id=me.id, focus_tracking_enabled=False)); db.commit()
    planned_task(db, me)
    assert fs.check_missed_sessions(db, me, now=NOW) == []
    assert db.query(FocusSession).count() == 0


def test_other_students_tasks_untouched(env):
    _, db, current, other = env
    planned_task(db, other)
    assert fs.check_missed_sessions(db, current["user"], now=NOW) == []


def test_missed_is_not_an_active_session(env):
    _, db, current, _ = env
    planned_task(db, current["user"])
    fs.check_missed_sessions(db, current["user"], now=NOW)
    assert fs.get_active_session(db, current["user"]) is None


# ---------------------------------------------------------------------------
# History / dashboard
# ---------------------------------------------------------------------------
def test_missed_not_in_completion_rate(env):
    _, db, current, _ = env
    me = current["user"]
    planned_task(db, me)
    fs.check_missed_sessions(db, me, now=NOW)
    db.add(FocusSession(user_id=me.id, started_at=NOW, ended_at=NOW + timedelta(minutes=25),
                        planned_minutes=25, actual_minutes=25, completed=True))
    db.commit()

    summary = fs.focus_history(db, me)["summary"]
    assert (summary["sessions"], summary["missed"], summary["completion_rate"]) == (1, 1, 1.0)


def test_history_can_hide_missed(env):
    client, db, current, _ = env
    planned_task(db, current["user"])
    fs.check_missed_sessions(db, current["user"], now=NOW)
    url = "/api/scheduler/focus/history"
    assert client.get(url).json()["total"] == 1
    assert client.get(url, params={"include_missed": "false"}).json()["total"] == 0


def test_check_endpoint(env):
    client, db, current, _ = env
    planned_task(db, current["user"], planned=datetime.utcnow() - timedelta(hours=2))
    body = client.post("/api/scheduler/focus/missed/check").json()
    assert len(body["new_missed"]) == 1 and body["new_missed"][0]["was_missed"] is True
    assert client.post("/api/scheduler/focus/missed/check").json()["new_missed"] == []   # safe to repeat
