"""
C3 END-TO-END: one student uses the whole scheduler, step by step, through the real API.
(Each feature also has its own test file - this one checks that they work TOGETHER.)

    lecture + 3 tasks -> Plan my week -> no clash, before deadlines, daily cap
    -> edit a task (its pieces go) -> plan again
    -> a focus session -> XP
    -> a planned piece is missed -> recovery preview
    -> C4 says stress HIGH -> proposal -> accept -> the plan changes by itself and RESPECTS the move
    -> restore (undo) -> weekly summary to C4 -> notifications / insights
"""
from datetime import datetime, timedelta

from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.models import PlannedSession, ScheduleChange, SchedulerAuditLog, Task
from app.components.scheduler.planner_service import study_day
from app.shared.integration.models import SignalEvent

API = "/api/scheduler"


def utc(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "")).replace(tzinfo=None)


def sessions_of(client, task_id=None):
    out = client.get(f"{API}/plan").json()["sessions"]
    return [s for s in out if task_id is None or s["task_id"] == task_id]


def test_student_journey(env):
    client, db, current, _ = env
    me = current["user"]
    now = datetime.utcnow()
    tomorrow = (now + SL_OFFSET).date() + timedelta(days=1)

    # 1. a lecture tomorrow 08:00-10:00 (Sri Lanka) + three tasks
    lecture_start = datetime.combine(tomorrow, datetime.min.time()).replace(hour=8) - SL_OFFSET
    r = client.post(f"{API}/commitments", json={"title": "SE lecture", "kind": "lecture", "is_recurring": False,
                                                "start_at": lecture_start.isoformat(),
                                                "end_at": (lecture_start + timedelta(hours=2)).isoformat()})
    assert r.status_code == 201, r.text
    ids = {}
    for title, minutes, days, priority, load in [("ML report", 180, 5, 3, "heavy"), ("Reading", 60, 6, 2, "low"),
                                                 ("Quiz prep", 90, 2, 4, "medium")]:
        r = client.post(f"{API}/tasks", json={"title": title, "estimated_minutes": minutes, "priority": priority,
                                              "deadline": (now + timedelta(days=days)).isoformat(),
                                              "cognitive_load": load})
        assert r.status_code == 201, r.text
        ids[title] = r.json()["id"]

    # 2. Plan my week: every task planned, no clash with the lecture, before deadlines, daily cap kept
    plan = client.post(f"{API}/plan").json()
    assert not plan["unplaced"], plan["unplaced"]
    per_day = {}
    for s in plan["sessions"]:
        start, end = utc(s["start"]), utc(s["end"])
        assert end <= lecture_start or start >= lecture_start + timedelta(hours=2), "clash with the lecture"
        task = db.get(Task, s["task_id"])
        assert end <= task.deadline, "planned after the deadline"
        per_day[study_day(start)] = per_day.get(study_day(start), 0) + s["minutes"]
    cap = client.get(f"{API}/settings").json()["max_study_minutes_per_day"]
    assert max(per_day.values()) <= cap
    assert client.get(f"{API}/conflicts").json() == [] or all(
        c.get("kind") != "clash" for c in client.get(f"{API}/conflicts").json())

    # 3. the schedule changes BY ITSELF: a longer task, a new commitment, a finished task
    assert sum(s["minutes"] for s in sessions_of(client, ids["ML report"])) >= 180
    client.patch(f"{API}/tasks/{ids['ML report']}", json={"estimated_minutes": 240})
    assert sum(s["minutes"] for s in sessions_of(client, ids["ML report"])) >= 240      # no button pressed
    first = min(utc(s["start"]) for s in sessions_of(client))
    client.post(f"{API}/commitments", json={"title": "Club", "kind": "extracurricular", "is_recurring": False,
                                            "start_at": (first - timedelta(minutes=30)).isoformat(),
                                            "end_at": (first + timedelta(hours=3)).isoformat()})
    assert all(not (first - timedelta(minutes=30) < utc(s["end"]) and utc(s["start"]) < first + timedelta(hours=3))
               for s in sessions_of(client)), "a piece is still inside the new commitment"

    # 4. a focus session, then the task is finished -> XP, and its planned pieces leave the schedule
    xp_before = client.get(f"{API}/progress").json()["total_xp"]
    started = client.post(f"{API}/focus/start", json={"task_id": ids["Quiz prep"], "planned_minutes": 25})
    assert started.status_code == 201, started.text
    assert client.post(f"{API}/focus/{started.json()['session']['id']}/end", json={"focus_rating": 4}).status_code == 200
    assert client.post(f"{API}/tasks/{ids['Quiz prep']}/complete").status_code == 200
    assert client.get(f"{API}/progress").json()["total_xp"] > xp_before
    assert sessions_of(client, ids["Quiz prep"]) == []

    # 5. a planned piece that was missed -> the recovery preview finds it a new place
    #    (the plan was made yesterday: move the plan records back one day)
    for log in db.query(SchedulerAuditLog).filter_by(event_type="plan_generated"):
        log.created_at -= timedelta(days=1)
    db.add(PlannedSession(user_id=me.id, task_id=ids["Reading"], plan_id="old", start=now - timedelta(hours=3),
                          end=now - timedelta(hours=2), minutes=60, break_minutes=10, piece=1, piece_count=1,
                          mode="adaptive", created_at=now - timedelta(days=1)))
    db.commit()
    recovery = client.get(f"{API}/plan/recovery").json()
    assert any(m["task_id"] == ids["Reading"] for m in recovery["missed"]), recovery

    # 6. C4 says stress is HIGH -> proposal -> accept -> the schedule changes by itself
    db.add(SignalEvent(event_id="journey", signal_type="RISK", student_id=me.research_id, status="ACCEPTED",
                       received_at=now, payload={"risk_level": "HIGH", "risk_score": 0.8, "trend": "RISING"}))
    db.commit()
    # the app checks in (notifications poll) -> the proposal is made BY ITSELF, nothing applied yet
    notes = client.get(f"{API}/notifications").json()["items"]
    assert any(n["title"] == "A lighter plan is ready for you to check" for n in notes)
    waiting = client.get(f"{API}/stress/proposals").json()
    assert len(waiting) == 1 and waiting[0]["decision"] == "proposed"
    assert client.get(f"{API}/notifications").status_code == 200
    assert len(client.get(f"{API}/stress/proposals").json()) == 1                  # once per signal, no repeats
    proposal = waiting[0]
    log = db.query(SchedulerAuditLog).filter_by(event_type="stress_proposal_created").one()
    assert log.details["automatic"] is True and log.details["seconds_after_signal"] >= 0
    assert all("old_start" in c for c in proposal["change_set"])                    # NFR-08: old slot -> new slot
    moves = [c for c in proposal["change_set"] if c["action"] == "move"]
    assert moves, proposal["change_set"]
    accepted = client.post(f"{API}/stress/proposals/{proposal['id']}/decision", json={"decision": "accepted"})
    assert accepted.status_code == 200, accepted.text
    for move in moves:                                   # re-planned, and nothing before the new start
        pieces = sessions_of(client, move["task_id"])
        assert pieces, "a moved task must be planned again"
        assert all(utc(s["start"]) >= utc(move["to"]) for s in pieces), "the plan ignored the move"
    client.post(f"{API}/plan")                           # Plan my week again: the move must still hold
    for move in moves:
        assert all(utc(s["start"]) >= utc(move["to"]) for s in sessions_of(client, move["task_id"]))

    # 7. undo -> the moved task may be planned early again, and the plan is rebuilt
    restored = client.post(f"{API}/stress/proposals/{proposal['id']}/restore")
    assert restored.status_code == 200 and db.get(ScheduleChange, proposal["id"]).decision == "restored"
    for move in moves:
        assert sessions_of(client, move["task_id"])

    # 8. weekly summary to C4 + notifications + insights answer
    assert client.post(f"{API}/integration/weekly-summary").status_code == 200
    assert client.get(f"{API}/notifications").status_code == 200
    assert client.get(f"{API}/insights").status_code == 200
