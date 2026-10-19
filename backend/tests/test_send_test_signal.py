"""scripts/send_test_signal.py: a pretend C4 signal -> proposal made by itself -> --remove cleans everything."""
from app.components.scheduler.models import ScheduleChange
from app.shared.integration.models import SignalEvent
from scripts import send_test_signal as script


def test_send_then_remove(env):
    client, db, current, _ = env
    me = current["user"]
    script.send(db, me, "HIGH")
    assert db.query(SignalEvent).count() == 1
    waiting = client.get("/api/scheduler/stress/proposals").json()           # the app checks in
    assert len(waiting) == 1
    client.post(f"/api/scheduler/stress/proposals/{waiting[0]['id']}/decision", json={"decision": "accepted"})
    script.remove(db, me)
    assert db.query(SignalEvent).count() == 0 and db.query(ScheduleChange).count() == 0
