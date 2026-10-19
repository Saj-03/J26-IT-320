"""FR-16: alert on a sustained drop in focus quality or study habit, with dismiss."""
from datetime import datetime, timedelta

from app.components.scheduler import alert_service
from app.components.scheduler.models import FocusSession

NOW = datetime(2026, 10, 19, 12, 0)


def add(db, user, days_ago, completed, rating=None):
    start = NOW - timedelta(days=days_ago, hours=1)
    db.add(FocusSession(user_id=user.id, started_at=start, ended_at=start + timedelta(minutes=25),
                        planned_minutes=25, actual_minutes=25 if completed else 8, completed=completed,
                        focus_rating=rating))


def usual_weeks(db, user):
    """Days 8-28: a session most days, 90% finished."""
    for d in range(8, 28):
        add(db, user, d, completed=d % 10 != 0, rating=4)


def test_no_alert_without_enough_history(env):
    _, db, current, _ = env
    add(db, current["user"], 1, False)
    db.commit()
    assert alert_service.focus_alert(db, current["user"], NOW)["alert"] is False


def test_steady_student_gets_no_alert(env):
    _, db, current, _ = env
    usual_weeks(db, current["user"])
    for d in range(0, 7):
        add(db, current["user"], d, completed=True, rating=4)
    db.commit()
    assert alert_service.focus_alert(db, current["user"], NOW)["alert"] is False


def test_quality_drop_alert_and_dismiss(env):
    client, db, current, _ = env
    usual_weeks(db, current["user"])
    for d in range(0, 5):
        add(db, current["user"], d, completed=d == 0, rating=2)        # 1 of 5 finished
    db.commit()
    a = alert_service.focus_alert(db, current["user"], NOW)
    assert a["alert"] and a["kind"] == "quality"
    assert a["details"]["usual"]["finished_rate"] >= 0.85 and a["details"]["recent"]["finished_rate"] == 0.2
    assert "diagnos" not in a["message"].lower()

    assert client.post("/api/scheduler/focus/alert/dismiss", json={"kind": "quality"}).status_code == 200
    assert alert_service.snoozed(db, current["user"], "quality", datetime.utcnow())


def test_habit_drop_alert(env):
    _, db, current, _ = env
    usual_weeks(db, current["user"])                                     # ~6.7 study days a week
    add(db, current["user"], 2, completed=True, rating=4)                # only 1 day this week
    db.commit()
    a = alert_service.focus_alert(db, current["user"], NOW)
    assert a["alert"] and a["kind"] == "habit"
