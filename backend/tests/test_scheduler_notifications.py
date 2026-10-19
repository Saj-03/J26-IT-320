"""FR-11 notifications: built from real data; unread until the student opens the page."""
from datetime import datetime, timedelta

from app.components.scheduler import notification_service as ns
from app.components.scheduler.models import PlannedSession, RewardEvent, Task
from app.shared.integration.contracts import RiskSignal
from app.shared.integration.validator import record

URL = "/api/scheduler/notifications"


def test_empty_for_a_new_student(env):
    client, *_ = env
    assert client.get(URL).json() == {"items": [], "unread": 0}


def test_real_notifications_and_seen(env):
    client, db, current, other = env
    me, now = current["user"], datetime.utcnow()
    soon = Task(user_id=me.id, title="DBMS quiz", estimated_minutes=30, deadline=now + timedelta(hours=5))
    db.add(soon); db.flush()
    db.add(PlannedSession(user_id=me.id, task_id=soon.id, plan_id="p", start=now + timedelta(hours=1),
                          end=now + timedelta(hours=1, minutes=30), minutes=30))
    db.add(RewardEvent(id=f"badge-first_focus-{me.id}", user_id=me.id, kind="badge", amount=0, label="First Focus"))
    db.add(Task(user_id=other.id, title="Not mine", estimated_minutes=30, deadline=now + timedelta(hours=2)))
    db.commit()
    record(db, "RISK", RiskSignal(event_id="e1", student_id=me.research_id, risk_score=0.9, risk_level="HIGH",
                                  trend="RISING", timestamp=now), "ACCEPTED")

    body = client.get(URL).json()
    titles = [n["title"] for n in body["items"]]
    assert "A study session starts soon" in titles
    assert "DBMS quiz is due soon" in titles
    assert "New badge: First Focus" in titles
    assert "A lighter plan is suggested" in titles
    assert not any("Not mine" in t for t in titles)                      # only my own data
    assert body["unread"] == len(body["items"]) == 4

    client.post(f"{URL}/seen")
    assert client.get(URL).json()["unread"] == 0
