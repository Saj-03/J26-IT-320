"""M3 inside the app: tasks get a realistic duration from the student's own past over-runs."""
from datetime import datetime, timedelta

import pytest

from app.components.scheduler.planning import planner_service as planner
from app.components.scheduler.ml import m3_predictor
from app.components.scheduler.models import SchedulerAuditLog, Task

SOON = lambda days=4: (datetime.utcnow() + timedelta(days=days)).isoformat()


@pytest.fixture()
def m3_on(env, monkeypatch):
    m3_predictor._load.cache_clear()
    monkeypatch.setattr(m3_predictor, "available", lambda: m3_predictor._load() is not None)
    if not m3_predictor.available():
        pytest.skip("M3 model file not trained")
    return env


def slow_history(db, user, n=12, ratio=1.8):
    """A student whose tasks always take ~1.8x what they say."""
    for i in range(n):
        done_at = datetime.utcnow() - timedelta(days=n - i)
        db.add(Task(user_id=user.id, title=f"Lab sheet {i}", estimated_minutes=60, actual_minutes=int(60 * ratio),
                    cognitive_load="medium", task_type="assignment", status="done",
                    deadline=done_at + timedelta(days=1), completed_at=done_at))
    db.commit()


def test_new_task_gets_a_longer_duration_for_a_slow_student(m3_on):
    client, db, current, _ = m3_on
    slow_history(db, current["user"])
    t = client.post("/api/scheduler/tasks", json={"title": "Lab sheet 13", "deadline": SOON(), "estimated_minutes": 60,
                                                 "cognitive_load": "medium", "task_type": "assignment"}).json()
    assert t["predicted_minutes"] >= 85                                  # learned "this student needs ~1.8x"
    d = client.get(f"/api/scheduler/tasks/{t['id']}/duration").json()
    assert d["source"] == "m3_model" and d["history_used"] == 12
    assert d["low"] <= d["predicted_minutes"] <= d["high"]


def test_student_can_keep_their_own_estimate_and_changes_ask_m3_again(m3_on):
    client, db, current, _ = m3_on
    slow_history(db, current["user"])
    t = client.post("/api/scheduler/tasks", json={"title": "Essay", "deadline": SOON(), "estimated_minutes": 60}).json()
    kept = client.patch(f"/api/scheduler/tasks/{t['id']}", json={"predicted_minutes": 60}).json()
    assert kept["predicted_minutes"] == 60
    assert db.query(SchedulerAuditLog).filter_by(event_type="duration_overridden").count() == 1

    d = client.get(f"/api/scheduler/tasks/{t['id']}/duration").json()
    assert d["predicted_minutes"] == 60 and d["model_minutes"] > 60                # kept own vs what M3 says
    back = client.patch(f"/api/scheduler/tasks/{t['id']}", json={"predicted_minutes": None}).json()
    assert back["predicted_minutes"] == d["model_minutes"]                          # "use the AI time again"
    assert db.query(SchedulerAuditLog).filter_by(event_type="duration_ai_restored").count() == 1

    bigger = client.patch(f"/api/scheduler/tasks/{t['id']}", json={"estimated_minutes": 120}).json()
    assert bigger["predicted_minutes"] > 120                             # new estimate -> new M3 answer


def test_plan_uses_the_predicted_duration_and_fills_old_tasks(m3_on):
    client, db, current, _ = m3_on
    me = current["user"]
    slow_history(db, me)
    old = Task(user_id=me.id, title="Old report", estimated_minutes=60, cognitive_load="medium",
               task_type="assignment", deadline=datetime.utcnow() + timedelta(days=4))   # made before M3
    db.add(old); db.commit()
    planned = client.post("/api/scheduler/plan").json()["sessions"]
    db.refresh(old)
    assert old.predicted_minutes and old.predicted_minutes >= 85
    assert sum(s["minutes"] for s in planned if s["task_id"] == old.id) == old.predicted_minutes
