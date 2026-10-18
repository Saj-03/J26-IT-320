"""Pilot study: only researchers can see participants (by research ID) and set their experiment mode."""
from app.components.scheduler import research_service
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
