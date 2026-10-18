"""Module D - "Plan my week" inside the app (planner_service + /plan endpoints)."""
from datetime import datetime, timedelta

from app.components.scheduler import planner_service as planner
from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.models import (
    Commitment, FocusSession, PlannedSession, SchedulerAuditLog, SchedulerSettings, Task,
)

NOW = datetime(2026, 10, 17, 4, 30)               # Saturday 10:00 Sri Lanka time (UTC + 5:30)


def sl(moment):
    return moment + SL_OFFSET


def add_task(db, user, title, minutes, due_days=4, load="medium", **extra):
    t = Task(user_id=user.id, title=title, estimated_minutes=minutes, cognitive_load=load,
             deadline=NOW + timedelta(days=due_days), **extra)
    db.add(t); db.commit()
    return t


def evening_person(db, user, days=20):
    """M1 history: always finishes at 20:00, always gives up at 09:00 (Sri Lanka time)."""
    for d in range(1, days + 1):
        for hour, done in ((20, True), (9, False)):
            start = datetime(2026, 10, 17) - timedelta(days=d) + timedelta(hours=hour) - SL_OFFSET
            db.add(FocusSession(user_id=user.id, started_at=start, ended_at=start + timedelta(minutes=25),
                                planned_minutes=25, actual_minutes=25 if done else 8, completed=done,
                                task_load="medium"))
    db.commit()


def test_plan_respects_lectures_deadlines_and_saves_pieces(env):
    _, db, current, _ = env
    me = current["user"]
    db.add(Commitment(user_id=me.id, title="Lecture", is_recurring=False,
                      start_at=NOW, end_at=NOW + timedelta(hours=6)))          # 10:00-16:00 today
    a = add_task(db, me, "Report", 150, due_days=3)
    b = add_task(db, me, "Quiz prep", 40, due_days=1, load="low")

    out = planner.build_plan(db, me, NOW)
    s = out["sessions"]
    assert out["status"] in ("OPTIMAL", "FEASIBLE") and not out["unplaced"]
    assert sum(x["minutes"] for x in s if x["task_id"] == a.id) == 150
    assert sum(x["minutes"] for x in s if x["task_id"] == b.id) == 40
    for x in s:
        assert not (x["start"] < NOW + timedelta(hours=6) and x["end"] > NOW)      # not in the lecture
        assert 8 <= sl(x["start"]).hour and sl(x["end"]).hour <= 22                 # inside study window
        assert x["end"] <= x["deadline"]
    assert db.query(PlannedSession).count() == len(s)
    db.refresh(a)
    assert a.scheduled_start == min(x["start"] for x in s if x["task_id"] == a.id)


def test_adaptive_plan_puts_heavy_work_in_the_m1_peak(env):
    _, db, current, _ = env
    me = current["user"]
    evening_person(db, me)
    add_task(db, me, "ML past paper", 100, due_days=5, load="heavy")

    out = planner.build_plan(db, me, NOW)
    assert out["attention_source"] == "m1_model" and out["timer_source"] == "m1_model"
    assert out["sessions"] and all(abs(sl(x["start"]).hour - 20) <= 1 for x in out["sessions"])
    assert all(x["chance"] is not None for x in out["sessions"])


def test_static_mode_is_the_plain_baseline(env):
    _, db, current, _ = env
    me = current["user"]
    evening_person(db, me)
    db.add(SchedulerSettings(user_id=me.id, mode="static")); db.commit()
    add_task(db, me, "ML past paper", 120, due_days=5, load="heavy")

    out = planner.build_plan(db, me, NOW)
    assert (out["mode"], out["attention_source"], out["focus_minutes"]) == ("static", "none", 60)
    assert all(x["chance"] is None for x in out["sessions"])
    assert out["sessions"][0]["start"] == NOW                                       # as early as possible


def test_steps_are_planned_not_the_big_task_and_fixed_tasks_block_time(env):
    _, db, current, _ = env
    me = current["user"]
    big = add_task(db, me, "Final report", 300)
    step = add_task(db, me, "Write intro", 45, parent_id=big.id)
    fixed = add_task(db, me, "Group meeting", 120, is_flexible=False, scheduled_start=NOW)

    out = planner.build_plan(db, me, NOW)
    planned = {x["task_id"] for x in out["sessions"]}
    assert planned == {step.id}
    assert all(x["start"] >= NOW + timedelta(hours=2) for x in out["sessions"])  # meeting kept free
    db.refresh(fixed)
    assert fixed.scheduled_start == NOW                                             # fixed task not moved


def test_replanning_replaces_the_future_plan_and_is_audited(env):
    _, db, current, _ = env
    me = current["user"]
    add_task(db, me, "Report", 100)
    first = planner.build_plan(db, me, NOW)
    second = planner.build_plan(db, me, NOW)
    assert db.query(PlannedSession).count() == len(second["sessions"]) == len(first["sessions"])

    logs = db.query(SchedulerAuditLog).filter_by(event_type="plan_generated").all()
    assert len(logs) == 2 and all(log.latency_ms is not None for log in logs)
    assert max(log.latency_ms for log in logs) < 2000                              # NFR-01
    assert logs[0].details["sessions"] == len(first["sessions"])


def test_too_much_work_is_reported_not_forced(env):
    _, db, current, _ = env
    me = current["user"]
    t = add_task(db, me, "Thesis", 900, due_days=1)
    out = planner.build_plan(db, me, NOW)
    assert out["unplaced"][0]["task_id"] == t.id
    assert out["unplaced"][0]["reason"].startswith("Not enough free time")
    placed = sum(x["minutes"] for x in out["sessions"])
    assert placed + out["unplaced"][0]["minutes"] == 900


def test_endpoints_only_plan_my_own_tasks(env):
    client, _, current, other = env
    me = current["user"]
    soon = (datetime.utcnow() + timedelta(days=3)).isoformat()
    client.post("/api/scheduler/tasks", json={"title": "Mine", "deadline": soon, "estimated_minutes": 60})
    current["user"] = other
    client.post("/api/scheduler/tasks", json={"title": "Theirs", "deadline": soon, "estimated_minutes": 60})
    current["user"] = me

    built = client.post("/api/scheduler/plan")
    assert built.status_code == 200
    titles = {x["title"] for x in built.json()["sessions"]}
    assert titles == {"Mine"}
    shown = client.get("/api/scheduler/plan").json()
    assert [x["id"] for x in shown["sessions"]] == [x["id"] for x in built.json()["sessions"]]


def test_moving_or_deleting_a_task_removes_its_plan_pieces(env):
    client, db, current, _ = env
    soon = (datetime.utcnow() + timedelta(days=3)).isoformat()
    a = client.post("/api/scheduler/tasks", json={"title": "A", "deadline": soon, "estimated_minutes": 100}).json()
    b = client.post("/api/scheduler/tasks", json={"title": "B", "deadline": soon, "estimated_minutes": 60}).json()
    client.post("/api/scheduler/plan")
    assert db.query(PlannedSession).filter_by(task_id=a["id"]).count() == 4          # 100 min, 25-min timer

    later = (datetime.utcnow() + timedelta(days=2)).isoformat()
    client.patch(f"/api/scheduler/tasks/{a['id']}", json={"scheduled_start": later})   # moved by hand
    assert db.query(PlannedSession).filter_by(task_id=a["id"]).count() == 0
    assert {x["title"] for x in client.get("/api/scheduler/plan").json()["sessions"]} == {"B"}

    assert client.delete(f"/api/scheduler/tasks/{b['id']}").status_code == 204      # no foreign-key error
    assert db.query(PlannedSession).count() == 0
