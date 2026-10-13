"""Tests for GET /focus/history - finished sessions + dashboard summary."""
from datetime import datetime, timedelta

from app.components.scheduler.models import FocusSession, Task

URL = "/api/scheduler/focus/history"
DAY = datetime(2026, 10, 20, 4, 0)


def add_session(db, user, days_ago=0, minutes=25, completed=True, rating=None, pauses=0,
                task=None, ended=True):
    """Put a session straight into the database."""
    start = DAY - timedelta(days=days_ago)
    s = FocusSession(user_id=user.id, task_id=task.id if task else None, started_at=start,
                     ended_at=start + timedelta(minutes=minutes) if ended else None,
                     planned_minutes=25, actual_minutes=minutes, completed=completed,
                     focus_rating=rating, pause_count=pauses)
    db.add(s); db.commit()
    return s


def test_empty_history(env):
    client, *_ = env
    body = client.get(URL).json()
    assert body["items"] == [] and body["total"] == 0
    assert body["summary"]["completion_rate"] is None


def test_newest_first_and_running_session_excluded(env):
    client, db, current, _ = env
    me = current["user"]
    old = add_session(db, me, days_ago=3)
    new = add_session(db, me, days_ago=1)
    add_session(db, me, days_ago=0, ended=False)              # still running
    ids = [s["id"] for s in client.get(URL).json()["items"]]
    assert ids == [new.id, old.id]


def test_summary_numbers(env):
    client, db, current, _ = env
    me = current["user"]
    add_session(db, me, minutes=25, completed=True, rating=4, pauses=1)
    add_session(db, me, minutes=25, completed=True, rating=2)
    add_session(db, me, minutes=10, completed=False, pauses=3)       # not rated
    s = client.get(URL).json()["summary"]
    assert s == {"sessions": 3, "missed": 0, "completed": 2, "completion_rate": 0.667,
                 "total_focus_minutes": 60, "average_focus_minutes": 20.0,
                 "total_pauses": 4, "average_rating": 3.0}


def test_filter_by_completed(env):
    client, db, current, _ = env
    add_session(db, current["user"], completed=True)
    add_session(db, current["user"], completed=False)
    assert client.get(URL, params={"completed": "false"}).json()["total"] == 1


def test_filter_by_date_range(env):
    client, db, current, _ = env
    for d in (1, 5, 10):
        add_session(db, current["user"], days_ago=d)
    params = {"from": (DAY - timedelta(days=7)).isoformat(), "to": DAY.isoformat()}
    assert client.get(URL, params=params).json()["total"] == 2


def test_filter_by_task(env):
    client, db, current, _ = env
    me = current["user"]
    task = Task(user_id=me.id, title="Report", deadline=DAY + timedelta(days=3), estimated_minutes=60)
    db.add(task); db.commit()
    add_session(db, me, task=task)
    add_session(db, me)
    assert client.get(URL, params={"task_id": task.id}).json()["total"] == 1


def test_pagination_but_summary_covers_everything(env):
    client, db, current, _ = env
    for d in range(5):
        add_session(db, current["user"], days_ago=d)
    body = client.get(URL, params={"limit": 2, "offset": 2}).json()
    assert len(body["items"]) == 2
    assert body["total"] == 5 and body["summary"]["sessions"] == 5


def test_only_my_sessions(env):
    client, db, current, other = env
    add_session(db, other)
    assert client.get(URL).json()["total"] == 0


def test_bad_limit_rejected(env):
    client, *_ = env
    assert client.get(URL, params={"limit": 1000}).status_code == 422
