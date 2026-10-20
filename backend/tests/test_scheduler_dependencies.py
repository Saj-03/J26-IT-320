"""FR-04 dependency constraints: 'do B after A', and the steps of a big task in their order."""
from datetime import datetime, timedelta

from app.components.scheduler.models import PlannedSession, Task
from tests.test_scheduler_cp import NOW, cp, free_days, run, task

API = "/api/scheduler"


def ends(sessions, task_id):
    return [s["end"] for s in sessions if s["task_id"] == task_id]


def starts(sessions, task_id):
    return [s["start"] for s in sessions if s["task_id"] == task_id]


# ---------------------------------------------------------------------------
# engine
# ---------------------------------------------------------------------------
def test_engine_b_starts_after_the_last_piece_of_a():
    a, b = task("A", 150, priority=1), task("B", 100, priority=5)     # B is more important -> would go first
    free = run([a, b])["sessions"]
    assert min(starts(free, "B")) < max(ends(free, "A"))              # without the rule B starts earlier
    out = cp.schedule([a, b], free_days(), NOW,
                      piece_minutes=50, break_minutes=10, day_cap_minutes=360,
                      study_day=lambda t: t.date(), local_hour=lambda t: t.hour, after={"B": ["A"]})
    s = out["sessions"]
    assert ends(s, "A") and starts(s, "B")
    assert min(starts(s, "B")) >= max(ends(s, "A"))


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def new_task(client, title, minutes=60, days=4, **extra):
    deadline = (datetime.utcnow() + timedelta(days=days)).isoformat()
    r = client.post(f"{API}/tasks", json={"title": title, "deadline": deadline, "estimated_minutes": minutes, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def pieces(db, task_id):
    return db.query(PlannedSession).filter_by(task_id=task_id).all()


def test_plan_keeps_the_order_the_student_asked_for(env):
    client, db, *_ = env
    a = new_task(client, "Collect survey data", 100, priority=1)
    b = new_task(client, "Analyse the survey", 60, priority=5, after_task_id=a["id"])
    assert b["after_task_id"] == a["id"]
    client.post(f"{API}/plan")
    assert pieces(db, a["id"]) and pieces(db, b["id"])
    assert min(p.start for p in pieces(db, b["id"])) >= max(p.end for p in pieces(db, a["id"]))


def test_steps_of_a_big_task_are_planned_in_order(env):
    client, db, *_ = env
    big = new_task(client, "Final report", 60, days=6)
    step1 = new_task(client, "Write the method", 60, days=5, parent_id=big["id"], priority=1)
    step2 = new_task(client, "Write the results", 60, days=5, parent_id=big["id"], priority=5)
    client.post(f"{API}/plan")
    assert min(p.start for p in pieces(db, step2["id"])) >= max(p.end for p in pieces(db, step1["id"]))


def test_a_finished_task_makes_nobody_wait(env):
    client, db, *_ = env
    a = new_task(client, "Read chapter 1", 60)
    b = new_task(client, "Quiz on chapter 1", 60, priority=5, after_task_id=a["id"])
    client.post(f"{API}/tasks/{a['id']}/complete")
    client.post(f"{API}/plan")
    assert pieces(db, b["id"])                                       # planned, no longer waiting


def test_bad_dependencies_are_refused(env):
    client, db, current, other = env
    a = new_task(client, "A")
    b = new_task(client, "B", after_task_id=a["id"])
    assert client.patch(f"{API}/tasks/{a['id']}", json={"after_task_id": a["id"]}).status_code == 422   # itself
    assert client.patch(f"{API}/tasks/{a['id']}", json={"after_task_id": b["id"]}).status_code == 422   # loop
    theirs = Task(user_id=other.id, title="Not mine", deadline=datetime.utcnow() + timedelta(days=3),
                  estimated_minutes=30)
    db.add(theirs)
    db.commit()
    assert client.patch(f"{API}/tasks/{a['id']}", json={"after_task_id": theirs.id}).status_code == 404
    assert client.patch(f"{API}/tasks/{b['id']}", json={"after_task_id": None}).json()["after_task_id"] is None


def test_deleting_a_task_frees_the_tasks_that_waited_for_it(env):
    client, db, *_ = env
    a = new_task(client, "A")
    b = new_task(client, "B", after_task_id=a["id"])
    assert client.delete(f"{API}/tasks/{a['id']}").status_code == 204
    db.expire_all()
    assert db.get(Task, b["id"]).after_task_id is None


def test_a_chain_of_ten_steps_still_gets_a_plan_in_time():
    """Found 2026-10-20: a stress split made 10 chained 25-min parts and CP-SAT returned NO plan in 1.2 s."""
    import time
    items = [task(f"P{i}", 25, due_days=5) for i in range(10)] + [task("R", 60, due_days=6), task("Q", 90, due_days=2)]
    t = time.time()
    out = cp.schedule(items, free_days(7), NOW, piece_minutes=25, break_minutes=5, day_cap_minutes=360,
                      study_day=lambda x: x.date(), local_hour=lambda x: x.hour,
                      chains={"steps:big": [f"P{i}" for i in range(10)]})
    assert out["status"] in ("OPTIMAL", "FEASIBLE") and not out["unplaced"]          # everything planned
    assert time.time() - t < 2.5                                      # NFR-01: 2 s target (test machines vary)
    parts = sorted((s for s in out["sessions"] if s["task_id"].startswith("P")), key=lambda s: int(s["task_id"][1:]))
    assert [s["task_id"] for s in parts] == [f"P{i}" for i in range(len(parts))]     # only a first part of the chain
    assert all(a["end"] <= b["start"] for a, b in zip(parts, parts[1:]))              # and in order
