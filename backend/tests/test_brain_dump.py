"""Voice planner preview: one paragraph -> editable items. Nothing is saved."""
from datetime import datetime, timedelta

from app.components.scheduler import brain_dump_service as bd
from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.models import Commitment, Task

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
