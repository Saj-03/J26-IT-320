"""Insights: real numbers from the student's own data (no sample data)."""
from datetime import datetime, timedelta

from app.components.scheduler import insights_service
from app.components.scheduler.models import FocusSession, Task
from app.shared.integration.contracts import RiskSignal
from app.shared.integration.validator import record


def test_new_student_gets_empty_but_valid_insights(env):
    client, *_ = env
    body = client.get("/api/scheduler/insights").json()
    assert len(body["days"]) == 7 and all(d["tasks_done"] == 0 for d in body["days"])
    assert body["best_load"] is None and body["duration"]["recent"] == []
    assert body["by_hour"]["source"] == "none"


def test_insights_count_real_sessions_tasks_and_signals(env):
    _, db, current, other = env
    me, now = current["user"], datetime.utcnow()
    for i in range(4):
        start = now - timedelta(hours=2 + i)
        db.add(FocusSession(user_id=me.id, started_at=start, ended_at=start + timedelta(minutes=25), planned_minutes=25,
                            actual_minutes=25 if i < 3 else 10, completed=i < 3, task_load="heavy"))
    db.add(Task(user_id=me.id, title="Essay", estimated_minutes=60, actual_minutes=90, status="done",
                deadline=now + timedelta(days=1), completed_at=now - timedelta(hours=1)))
    db.add(Task(user_id=other.id, title="Not mine", estimated_minutes=60, actual_minutes=60, status="done",
                deadline=now, completed_at=now - timedelta(hours=1)))
    db.commit()
    record(db, "RISK", RiskSignal(event_id="r1", student_id=me.research_id, risk_score=0.62, risk_level="MODERATE",
                                  trend="STABLE", timestamp=now), "ACCEPTED")

    body = insights_service.insights(db, me, now)
    total_minutes = sum(d["focus_minutes"] for d in body["days"])
    assert total_minutes == 85 and sum(d["tasks_done"] for d in body["days"]) == 1
    assert body["week"]["tasks_done"] == 1 and body["week"]["focus_minutes"] == 85
    assert body["best_load"] == {"load": "heavy", "finished_pct": 75, "all": {"heavy": 75}}
    assert body["duration"]["usual_over_run"] == 1.5 and body["duration"]["recent"][0]["title"] == "Essay"
    assert body["stress"][-1]["value"] == 62
