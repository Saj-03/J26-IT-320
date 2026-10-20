"""Pilot study: only researchers can see participants (by research ID) and set their experiment mode."""
from app.components.scheduler.research import research_service
from app.components.scheduler.models import SchedulerAuditLog, SchedulerSettings

URL = "/api/scheduler/research/participants"


def make_researcher(monkeypatch, email="me@test.lk"):
    monkeypatch.setattr(research_service.settings, "SCHEDULER_RESEARCHER_EMAILS", email)


def test_students_cannot_see_or_change_modes(env):
    client, _, _, other = env
    assert client.get("/api/scheduler/research/me").json() == {"is_researcher": False}
    assert client.get(URL).status_code == 403
    assert client.patch(f"{URL}/{other.research_id}", json={"mode": "static"}).status_code == 403


def test_researcher_sees_only_consenting_participants_without_names(env, monkeypatch):
    client, db, _, other = env
    make_researcher(monkeypatch)
    other.research_consent = True; db.commit()
    body = client.get(URL).json()
    assert client.get("/api/scheduler/research/me").json() == {"is_researcher": True}
    assert [p["research_id"] for p in body["participants"]] == [other.research_id]
    assert body["without_consent"] == 1                            # "me" did not consent
    assert "email" not in body["participants"][0] and "full_name" not in body["participants"][0]
    assert body["participants"][0]["mode"] == "adaptive"            # default


def test_researcher_sets_mode_and_group_and_it_is_audited(env, monkeypatch):
    client, db, _, other = env
    make_researcher(monkeypatch)
    other.research_consent = True; db.commit()
    r = client.patch(f"{URL}/{other.research_id}", json={"mode": "static", "pilot_group": "BA"})
    assert r.json() == {"research_id": other.research_id, "mode": "static", "pilot_group": "BA"}
    assert db.get(SchedulerSettings, other.id).mode == "static"
    log = db.query(SchedulerAuditLog).filter_by(user_id=other.id, event_type="pilot_mode_changed").one()
    assert log.details["old"]["mode"] == "adaptive" and log.details["new"]["mode"] == "static"
    assert client.patch(f"{URL}/{other.research_id}", json={"mode": "wrong"}).status_code == 422
    assert client.patch(f"{URL}/P-nobody", json={"mode": "static"}).status_code == 404


def test_research_overview_uses_real_cohort_data(env, monkeypatch):
    from datetime import datetime, timedelta
    from app.components.scheduler.models import FocusSession, Task
    client, db, current, other = env
    assert client.get("/api/scheduler/research/overview").status_code == 403
    make_researcher(monkeypatch)
    other.research_consent = True
    now = datetime.utcnow()
    for done in (True, True, False):
        start = now - timedelta(hours=3)
        db.add(FocusSession(user_id=other.id, started_at=start, ended_at=start + timedelta(minutes=25),
                            planned_minutes=25, actual_minutes=25 if done else 5, completed=done))
    db.add(Task(user_id=other.id, title="t", estimated_minutes=30, status="done", deadline=now, completed_at=now))
    db.commit()
    body = client.get("/api/scheduler/research/overview").json()
    assert body["kpis"]["participants"] == 1 and body["kpis"]["active_7d"] == 1
    assert body["kpis"]["focus_completion_pct"] == 67 and body["kpis"]["task_completion_pct"] == 100
    assert body["session_outcomes"]["Finished"] == 2 and body["session_outcomes"]["Stopped early"] == 1
    assert body["participants"][0]["research_id"] == other.research_id
    assert other.email not in str(body)
