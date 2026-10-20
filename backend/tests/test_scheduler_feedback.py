"""1-5 ratings for the evaluation: stress suggestion helpfulness + timer usefulness (once each)."""
from datetime import datetime, timedelta

from app.components.scheduler.models import FocusSession, ScheduleChange, SchedulerAuditLog
from app.components.scheduler.stress.stress_service import STRESS_TRIGGER


def test_stress_suggestion_can_be_rated_once_after_deciding(env):
    client, db, current, _ = env
    change = ScheduleChange(user_id=current["user"].id, trigger=STRESS_TRIGGER, reason="High stress",
                            change_set=[], decision="proposed")
    db.add(change); db.commit()
    url = f"/api/scheduler/stress/proposals/{change.id}/rating"
    assert client.post(url, json={"rating": 4}).status_code == 409          # not decided yet
    change.decision = "accepted"; db.commit()
    assert client.post(url, json={"rating": 4}).json() == {"id": change.id, "rating": 4}
    assert client.post(url, json={"rating": 5}).status_code == 409          # only once
    assert client.post(url, json={"rating": 9}).status_code == 422
    log = db.query(SchedulerAuditLog).filter_by(event_type="stress_proposal_rated").one()
    assert log.details == {"change_id": change.id, "rating": 4, "decision": "accepted"}


def test_timer_can_be_rated_once_after_the_session(env):
    client, db, current, other = env
    start = datetime.utcnow() - timedelta(hours=1)
    s = FocusSession(user_id=current["user"].id, started_at=start, planned_minutes=50, timer_recommended=True)
    db.add(s); db.commit()
    url = f"/api/scheduler/focus/{s.id}/timer-rating"
    assert client.post(url, json={"rating": 3}).status_code == 409          # still running
    s.ended_at = start + timedelta(minutes=50); db.commit()
    assert client.post(url, json={"rating": 3}).status_code == 200
    assert client.post(url, json={"rating": 3}).status_code == 409
    current["user"] = other
    assert client.post(url, json={"rating": 3}).status_code == 404          # not your session
    log = db.query(SchedulerAuditLog).filter_by(event_type="timer_rated").one()
    assert log.details["recommended"] is True and log.details["planned"] == 50
