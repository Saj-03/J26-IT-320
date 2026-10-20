"""
Tests for starting a focus session (FR-05, FR-15) - part 1:
  pick a task -> system suggests a timer -> student keeps or changes it.
"""
from datetime import datetime, timedelta

from app.components.scheduler.models import FocusSession, SchedulerAuditLog, SchedulerSettings, Task

URL = "/api/scheduler/focus"


def make_task(db, user, load="heavy", status="pending"):
    t = Task(user_id=user.id, title="Report", deadline=datetime.utcnow() + timedelta(days=3),
             estimated_minutes=120, cognitive_load=load, status=status)
    db.add(t); db.commit()
    return t


def settings(db, user, **values):
    s = SchedulerSettings(user_id=user.id, **values)
    db.add(s); db.commit()
    return s


def completed_sessions(db, user, minutes, count=5):
    for i in range(count):
        db.add(FocusSession(user_id=user.id, started_at=datetime.utcnow() - timedelta(days=i + 1),
                            ended_at=datetime.utcnow() - timedelta(days=i + 1) + timedelta(minutes=minutes),
                            planned_minutes=minutes, actual_minutes=minutes, completed=True))
    db.commit()


# ---------------------------------------------------------------------------
# Timer suggestion
# ---------------------------------------------------------------------------
def test_new_student_gets_25_minutes(env):
    client, *_ = env
    rec = client.get(f"{URL}/recommendation").json()
    assert (rec["focus_minutes"], rec["break_minutes"], rec["source"]) == (25, 5, "default")


def test_survey_answer_used_before_history_exists(env):
    client, db, current, _ = env
    settings(db, current["user"], usual_focus_minutes=40)
    rec = client.get(f"{URL}/recommendation").json()
    assert (rec["focus_minutes"], rec["source"]) == (40, "survey")


def test_m1_used_after_enough_sessions(env):
    client, db, current, _ = env
    completed_sessions(db, current["user"], minutes=35)
    rec = client.get(f"{URL}/recommendation").json()
    assert rec["source"] == "m1_model" and 15 <= rec["focus_minutes"] <= 50


def test_rules_used_when_model_missing(env, monkeypatch):
    from app.components.scheduler.ml import m1_predictor
    monkeypatch.setattr(m1_predictor, "available", lambda: False)
    client, db, current, _ = env
    completed_sessions(db, current["user"], minutes=35)
    rec = client.get(f"{URL}/recommendation").json()
    assert (rec["focus_minutes"], rec["break_minutes"], rec["source"]) == (35, 10, "history_rules")


def test_static_mode_always_25_even_with_history(env):
    client, db, current, _ = env
    settings(db, current["user"], mode="static")
    completed_sessions(db, current["user"], minutes=45)
    assert client.get(f"{URL}/recommendation").json()["source"] == "static_default"


def test_student_fixed_timer_wins(env):
    client, db, current, _ = env
    settings(db, current["user"], fixed_timer_minutes=50, mode="static")
    rec = client.get(f"{URL}/recommendation").json()
    assert (rec["focus_minutes"], rec["source"]) == (50, "student_fixed")


# ---------------------------------------------------------------------------
# Starting a session
# ---------------------------------------------------------------------------
def test_start_with_suggested_length(env):
    client, db, current, _ = env
    task = make_task(db, current["user"])
    r = client.post(f"{URL}/start", json={"task_id": task.id})
    assert r.status_code == 201
    s = r.json()["session"]
    assert (s["planned_minutes"], s["timer_overridden"], s["task_load"]) == (25, False, "heavy")
    db.refresh(task)
    assert task.status == "in_progress"


def test_student_changes_length_is_recorded(env):
    client, db, current, _ = env
    r = client.post(f"{URL}/start", json={"planned_minutes": 45})
    s = r.json()["session"]
    assert (s["planned_minutes"], s["timer_overridden"]) == (45, True)

    log = db.query(SchedulerAuditLog).filter_by(event_type="focus_started").one()
    assert (log.details["suggested"], log.details["chosen"], log.details["overridden"]) == (25, 45, True)


def test_only_one_running_session(env):
    client, *_ = env
    assert client.post(f"{URL}/start", json={}).status_code == 201
    assert client.post(f"{URL}/start", json={}).status_code == 409
    assert client.get(f"{URL}/active").json()["planned_minutes"] == 25


def test_no_active_session_returns_null(env):
    client, *_ = env
    assert client.get(f"{URL}/active").json() is None


def test_cannot_start_on_finished_task(env):
    client, db, current, _ = env
    task = make_task(db, current["user"], status="done")
    assert client.post(f"{URL}/start", json={"task_id": task.id}).status_code == 409


def test_cannot_start_on_someone_elses_task(env):
    client, db, current, other = env
    task = make_task(db, other)
    assert client.post(f"{URL}/start", json={"task_id": task.id}).status_code == 404


def test_tracking_turned_off_blocks_start(env):
    client, db, current, _ = env
    settings(db, current["user"], focus_tracking_enabled=False)
    assert client.post(f"{URL}/start", json={}).status_code == 403
    assert db.query(FocusSession).count() == 0          # nothing stored


def test_bad_length_rejected(env):
    client, *_ = env
    assert client.post(f"{URL}/start", json={"planned_minutes": 2}).status_code == 422
    assert client.post(f"{URL}/start", json={"planned_minutes": 500}).status_code == 422


def test_mode_saved_with_session(env):
    client, db, current, _ = env
    settings(db, current["user"], mode="static")
    s = client.post(f"{URL}/start", json={}).json()["session"]
    assert s["mode"] == "static"


def test_old_log_endpoint_does_not_leave_active_session(env):
    client, *_ = env
    client.post(URL, json={"started_at": datetime.utcnow().isoformat(), "planned_minutes": 25,
                           "actual_minutes": 25, "completed": True})
    assert client.get(f"{URL}/active").json() is None
