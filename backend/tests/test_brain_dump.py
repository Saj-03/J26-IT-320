"""Voice planner preview: one paragraph -> editable items. Nothing is saved."""
from datetime import datetime, timedelta

from app.components.scheduler.voice import brain_dump_service as bd
from app.components.scheduler.tasks.commitment_service import SL_OFFSET
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

    from app.components.scheduler.planning.planner_service import study_day
    today = study_day(datetime.utcnow())
    planned_today = sum(s.minutes for s in db.query(PlannedSession).all() if study_day(s.start) == today)
    assert planned_today <= cap


def test_preview_real_speech_without_full_stops(env):
    """Real Chrome speech-to-text (2026-10-19): few full stops, "tired" heard as "try"."""
    _, db, current, _ = env
    said = ("I have a soft engineering lecture tomorrow from 8:00 to 10:00, then work from 2:00 to 6:00. "
            "Finish the machine learning report by the Friday about 3 hours by.And breads I'm really try today plan my day.")
    items = bd.preview(db, current["user"], said, NOW)["items"]
    lecture, work = items[0], items[1]
    assert lecture["title"] == "Soft engineering lecture"                  # work is NOT glued onto the lecture
    assert (work["type"], work["title"], work["start"], work["end"]) == ("commitment", "Work", "14:00", "18:00")
    assert work["needs_check"] is True                                      # a guess from the clock time
    assert [i["title"] for i in items].count("Breads") == 1                 # its own card, not lost in one long piece
    energy = next(i for i in items if i["type"] == "energy")
    assert energy["kind"] is None and energy["needs_check"] is True        # "really try" -> no guess


def test_preview_real_speech_merged_numbers(env):
    """Real Chrome speech (2026-10-19): "from 2 to 6" heard as "from.26", "buy" heard as "by", no full stops."""
    _, db, current, _ = env
    said = ("I have a software engineering lecture tomorrow from 8:00 to 10:00, then work from.26 finish the machine "
            "learning report by Friday. About 3 hours by eggs and bread. I'm really tired today. Plan my day.")
    out = bd.preview(db, current["user"], said, NOW)
    titles = {i["title"]: i for i in out["items"]}
    work = titles["Work"]
    assert (work["start"], work["end"], work["date"]) == ("14:00", "18:00", TOMORROW)    # same day as the lecture
    report = titles["Finish the machine learning report"]
    assert report["duration_minutes"] == 180 and report["deadline"].weekday() == 4
    assert titles["Buy eggs and bread"]["type"] == "task_personal"
    assert out["energy"] == "low" and out["plan_requested"] is True


def test_clean_speech_keeps_real_times():
    assert bd.clean_speech("work from.26 then") == "work from 2 to 6. then"
    assert bd.split_pieces("Submit by 8.30 tonight. Gym") == ["Submit by 8.30 tonight", "Gym"]
    assert bd.split_pieces("lab from 2 to 4 tomorrow") == ["lab from 2 to 4 tomorrow"]


def test_preview_messy_speech_fillers_and_self_correction(env):
    """Real speech (2026-10-19): fillers, a corrected time ("6:00.9:00 PM") and a 10-hour breakfast."""
    _, db, current, _ = env
    said = ("Yeah, tomorrow I have lecture.6:00 AM to 6:00.9:00 PM. Sorry.And also I have a.I need to get the "
            "breakfast 8:00 AM to 6:00 PM.")
    out = bd.preview(db, current["user"], said, NOW)
    assert out["ignored"] == ["Yeah", "Sorry", "And", "also I have a"]          # no cards for filler
    lecture, breakfast = out["items"]
    assert (lecture["title"], lecture["start"], lecture["end"]) == ("Lecture", "06:00", "21:00")   # last time wins
    assert breakfast["warning"] and breakfast["needs_check"]                    # 10 hours -> check the times


def test_clean_speech_self_repair():
    assert bd.clean_speech("meeting at 5 sorry 6") == "meeting at 6"
    assert bd.clean_speech("lab from 8:00 to 9:00.10:00") == "lab from 8:00 to 10:00"


def test_preview_time_said_after_the_event(env):
    """Real speech (2026-10-20): "lecture for. So 8:00 AM to 6:00 PM" - the time belongs to the lecture;
    "And not only that", "Can you do it" are filler, not cards."""
    _, db, current, _ = env
    said = ("I have soft engineering lecture for.So 8:00 AM to 6:00 PM.And also.I want to get a breakfast during "
            "that time.And not only that, I need plan my day.Can you do it?")
    out = bd.preview(db, current["user"], said, NOW)
    lecture = out["items"][0]
    assert (lecture["title"], lecture["start"], lecture["end"]) == ("Soft engineering lecture", "08:00", "18:00")
    assert sum(i["type"] == "commitment" for i in out["items"]) == 1          # no separate "So" card
    assert {"And not only that", "Can you do it"} <= set(out["ignored"])
    assert out["plan_requested"] is True
