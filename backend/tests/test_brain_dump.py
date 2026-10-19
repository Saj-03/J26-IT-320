"""Voice planner preview: one paragraph -> editable items. Nothing is saved."""
from datetime import datetime, timedelta

from app.components.scheduler import brain_dump_service as bd
from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.models import Commitment, PlannedSession, SchedulerAuditLog, Task

NOW = datetime(2026, 10, 19, 3, 30)                 # Monday 09:00 in Sri Lanka
TODAY = (NOW + SL_OFFSET).date()
TOMORROW = TODAY + timedelta(days=1)
SAID = ("I have a software engineering lecture tomorrow from 8 to 10, then work shift from 2 to 6. "
        "Finish the machine learning report by friday, about 3 hours. "
        "Add eggs and bread to my shopping list. I'm really tired today. Plan my day.")


def test_split_pieces_keeps_the_connector_with_the_next_piece():
    pieces = bd.split_pieces("lecture 8 to 10 and then work 2 to 6. Buy milk")
    assert pieces == ["lecture 8 to 10", "and then work 2 to 6", "Buy milk"]


def test_short_title_drops_times_and_fillers():
    from ml_training.scheduler.m4_slots import extract
    piece = "I have a SE lecture tomorrow from 8 to 10"
    assert bd.short_title(piece, extract(piece, TODAY).found) == "SE lecture"


def test_preview_reads_a_whole_day(env):
    _, db, current, _ = env
    out = bd.preview(db, current["user"], SAID, NOW)
    by_type = {}
    for item in out["items"]:
        by_type.setdefault(item["type"], []).append(item)

    lecture, work = by_type["commitment"][:2]
    assert (lecture["date"], lecture["start"], lecture["end"], lecture["kind"]) == (TOMORROW, "08:00", "10:00", "lecture")
    assert (work["start"], work["end"], work["kind"], work["after_previous"]) == ("14:00", "18:00", "work", True)

    report = by_type["task_academic"][0]
    assert "machine learning report" in report["title"].lower()
    assert report["duration_minutes"] == 180 and report["deadline"].weekday() == 4      # "about 3 hours" merged in
    assert by_type["task_personal"][0]["title"].lower().startswith("eggs and bread")
    assert out["energy"] == "low" and out["plan_requested"] is True
    assert db.query(Task).count() == 0 and db.query(Commitment).count() == 0            # preview saves nothing


def test_endpoint(env):
    client, *_ = env
    r = client.post("/api/scheduler/brain-dump", json={"text": "wake me up at 6. what's the weather"})
    assert r.status_code == 200
    items = r.json()["items"]
    assert items[0]["type"] == "routine" and items[0]["start"] == "06:00"
    assert items[-1]["type"] == "other" and items[-1]["include"] is False
    assert client.post("/api/scheduler/brain-dump", json={"text": ""}).status_code == 422


def _cards():
    """What the review screen sends after the student checked the cards (relative to the real clock)."""
    today = (datetime.utcnow() + SL_OFFSET).date()
    return today, [
        {"type": "commitment", "title": "SE lecture", "kind": "lecture", "date": str(today + timedelta(days=1)),
         "start": "08:00", "end": "10:00", "model_type": "commitment", "confidence": 0.97},
        {"type": "task_academic", "title": "ML report", "kind": "project", "deadline": str(today + timedelta(days=4)),
         "duration_minutes": 180, "model_type": "task_academic", "confidence": 0.9},
        {"type": "task_personal", "title": "Buy eggs", "model_type": "task_academic", "confidence": 0.55,
         "changed": ["type"]},
    ]


def test_confirm_saves_tasks_and_commitments(env):
    client, db, *_ = env
    today, cards = _cards()
    r = client.post("/api/scheduler/brain-dump/confirm", json={"items": cards, "dropped": 1})
    assert r.status_code == 201, r.text
    body = r.json()
    assert [t["title"] for t in body["tasks"]] == ["ML report", "Buy eggs"] and body["planned"] is False

    lecture = db.query(Commitment).one()
    assert (lecture.kind, lecture.is_recurring) == ("lecture", False)
    assert lecture.start_at + SL_OFFSET == datetime.combine(today + timedelta(days=1), datetime.min.time()).replace(hour=8)
    tasks = {t.title: t for t in db.query(Task).all()}
    report, eggs = tasks["ML report"], tasks["Buy eggs"]
    assert (report.task_type, report.estimated_minutes, report.load_set_by_student) == ("project", 180, False)
    assert (report.deadline + SL_OFFSET).date() == today + timedelta(days=4)
    assert eggs.task_type == "other" and (eggs.deadline + SL_OFFSET).date() == today + timedelta(days=2)

    log = db.query(SchedulerAuditLog).filter_by(event_type="brain_dump_confirmed").one()
    assert log.details["dropped"] == 1
    assert log.details["items"][2] == {"model_type": "task_academic", "saved_type": "task_personal",
                                       "confidence": 0.55, "changed": ["type"]}


def test_confirm_checks_every_card_before_saving(env):
    client, db, *_ = env
    _, cards = _cards()
    cards.append({"type": "commitment", "title": "Gym"})                 # no start time
    r = client.post("/api/scheduler/brain-dump/confirm", json={"items": cards})
    assert r.status_code == 422
    assert r.json()["detail"] == [{"card": 4, "title": "Gym", "problem": "a commitment needs a start time"}]
    assert db.query(Task).count() == 0 and db.query(Commitment).count() == 0    # nothing half saved


def test_confirm_low_energy_plans_a_lighter_today(env):
    client, db, *_ = env
    _, cards = _cards()
    r = client.post("/api/scheduler/brain-dump/confirm", json={"items": cards, "energy": "low", "plan": True})
    assert r.status_code == 201, r.text
    body = r.json()
    cap = body["today_cap_minutes"]
    assert body["planned"] is True and body["sessions"] > 0 and cap > 0

    from app.components.scheduler.planner_service import study_day
    today = study_day(datetime.utcnow())
    planned_today = sum(s.minutes for s in db.query(PlannedSession).all() if study_day(s.start) == today)
    assert planned_today <= cap
