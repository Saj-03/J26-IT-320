"""Proposal 3.2.2: a student can leave the study and have their research records deleted; the app keeps working."""
from app.components.scheduler.models import SchedulerAuditLog, Task
from app.components.scheduler.research import research_export, research_service
from tests.test_scheduler_research_export import NOW, setup_pilot

URL = "/api/scheduler/research/me"


def test_leaving_the_study(env, monkeypatch):
    client, db, current, other = env
    me = current["user"]
    setup_pilot(db, me, other)
    monkeypatch.setattr(research_service.settings, "SCHEDULER_RESEARCHER_EMAILS", "me@test.lk")
    assert {r["research_id"] for r in research_export.export_rows(db, me, NOW)} == {other.research_id}
    tasks_before = db.query(Task).filter_by(user_id=other.id).count()

    current["user"] = other                                           # the participant asks
    assert client.get(URL).json()["research_withdrawn_at"] is None
    assert client.post(f"{URL}/withdraw", json={}).status_code == 422          # must confirm on purpose
    r = client.post(f"{URL}/withdraw", json={"confirm": True})
    assert r.status_code == 200 and r.json()["records_deleted"] >= 1
    assert client.get(URL).json()["research_withdrawn_at"] is not None
    assert db.query(SchedulerAuditLog).filter_by(user_id=other.id).count() == 0   # research records gone
    assert db.query(Task).filter_by(user_id=other.id).count() == tasks_before     # app data kept
    assert client.post(f"{URL}/withdraw", json={"confirm": True}).status_code == 200   # asking twice is fine

    current["user"] = me                                              # the researcher no longer sees them
    assert research_export.export_rows(db, me, NOW) == []
    assert research_service.participants(db, me)["participants"] == []
