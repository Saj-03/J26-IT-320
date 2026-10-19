"""Tests for the stress safety rules (Module F, F2): which tasks may never be changed."""
from datetime import datetime, timedelta

from app.components.scheduler import stress_service as ss
from app.components.scheduler.models import FocusSession, Task

NOW = datetime(2026, 10, 17, 10, 0)


def add_task(db, user, title, days=5.0, **kw):
    """A task due `days` from NOW. Defaults = a normal changeable task."""
    t = Task(user_id=user.id, title=title, deadline=NOW + timedelta(days=days), estimated_minutes=60,
             **{"priority": 3, "is_flexible": True, "status": "pending", "cognitive_load": "medium"} | kw)
    db.add(t)
    db.commit()
    return t


def reasons(db, user):
    """title -> reason, for locked and changeable tasks."""
    out = ss.task_safety(db, user, now=NOW)
    return ({r["title"]: r["reason"] for r in out["locked"]},
            {r["title"]: r["reason"] for r in out["changeable"]})


def test_normal_future_flexible_task_is_changeable(env):
    _, db, current, _ = env
    add_task(db, current["user"], "Read chapter 5", days=5)
    locked, changeable = reasons(db, current["user"])
    assert locked == {} and changeable == {"Read chapter 5": "flexible, due in 5 days"}


def test_every_lock_rule(env):
    _, db, current, _ = env
    me = current["user"]
    add_task(db, me, "Finished", status="done")
    add_task(db, me, "Dropped", status="cancelled")
    working = add_task(db, me, "Working now", status="in_progress")
    db.add(FocusSession(user_id=me.id, task_id=working.id, started_at=NOW, planned_minutes=25))   # timer running
    add_task(db, me, "Started yesterday", status="in_progress")      # started once, no timer now -> may be eased
    add_task(db, me, "Fixed one", is_flexible=False)
    add_task(db, me, "Overdue", days=-1)
    add_task(db, me, "Due tomorrow", days=20 / 24)
    add_task(db, me, "Final project", priority=5)
    locked, changeable = reasons(db, me)
    assert changeable == {"Started yesterday": "flexible, due in 5 days"}
    assert locked == {
        "Finished": "already done", "Dropped": "already cancelled", "Working now": "you are working on it now",
        "Fixed one": "you marked it as fixed", "Overdue": "its deadline has passed",
        "Due tomorrow": "due in 20 hours - too close to move", "Final project": "top priority",
    }


def test_48_hour_border(env):
    _, db, current, _ = env
    add_task(db, current["user"], "Exactly 48 h", days=2)            # inside the window -> locked
    add_task(db, current["user"], "Just over", days=2.1)
    locked, changeable = reasons(db, current["user"])
    assert "Exactly 48 h" in locked and "Just over" in changeable


def test_parent_locked_but_its_steps_are_checked(env):
    _, db, current, _ = env
    parent = add_task(db, current["user"], "Big report", days=10)
    add_task(db, current["user"], "Step 1", days=1, parent_id=parent.id)    # urgent step
    add_task(db, current["user"], "Step 2", days=6, parent_id=parent.id)
    locked, changeable = reasons(db, current["user"])
    assert locked["Big report"] == "its steps are checked one by one"
    assert "Step 1" in locked and "Step 2" in changeable


def test_only_my_tasks_and_endpoint(env):
    client, db, current, other = env
    add_task(db, other, "Not mine")
    add_task(db, current["user"], "Mine", days=30)
    body = client.get("/api/scheduler/stress/task-safety").json()
    assert [r["title"] for r in body["changeable"]] == ["Mine"] and body["locked"] == []
