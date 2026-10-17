"""Tests for the C3 -> C4 weekly summary (DeviationSignal)."""
from datetime import datetime, timedelta

from app.shared.integration import c3_weekly_summary as ws
from app.components.scheduler.models import FocusSession, SchedulerAuditLog, Task
from app.shared.integration.contracts import DeviationSignal
from app.shared.integration.models import SignalEvent

# Week of Monday 12 Oct 2026 (Sri Lanka) = Sunday 11 Oct 18:30 UTC .. Sunday 18 Oct 18:30 UTC
WEEK = datetime(2026, 10, 11, 18, 30)
NOW = datetime(2026, 10, 20, 4, 0)            # Tuesday of the next week


def task(db, user, title, day, status="pending", task_type="assignment"):
    """A task due `day` days after the week start (+ 12 h, so it is mid-day in Sri Lanka)."""
    db.add(Task(user_id=user.id, title=title, deadline=WEEK + timedelta(days=day, hours=12),
                estimated_minutes=60, status=status, task_type=task_type))
    db.commit()


def missed(db, user, day):
    t = WEEK + timedelta(days=day, hours=3)
    db.add(FocusSession(user_id=user.id, started_at=t, ended_at=t, planned_minutes=25, was_missed=True))
    db.commit()


def test_week_start_is_monday_midnight_sri_lanka():
    assert ws.week_start_of(datetime(2026, 10, 14, 10, 0)) == WEEK              # a Wednesday
    assert ws.week_start_of(datetime(2026, 10, 11, 18, 29)) == WEEK - timedelta(days=7)   # Sunday 23:59 SL
    assert ws.last_finished_week(NOW) == WEEK


def test_the_five_numbers(env):
    _, db, current, _ = env
    me = current["user"]
    task(db, me, "A", 0, status="done")
    task(db, me, "B", 0, status="done")            # same day as A
    task(db, me, "C", 3)
    task(db, me, "D", 5, status="done")
    task(db, me, "Dropped", 2, status="cancelled")  # not counted
    task(db, me, "Next week", 8)                    # not this week
    missed(db, me, 1)
    missed(db, me, 4)
    missed(db, me, 9)                               # next week
    assert ws.weekly_summary(db, me, WEEK) == {
        "task_completion_rate": 0.75, "missed_sessions": 2, "task_load": 4,
        "deadline_density": round(3 / 7, 3), "semester_phase": "mid_semester",
    }


def test_empty_week_and_exam_period(env):
    _, db, current, _ = env
    me = current["user"]
    assert ws.weekly_summary(db, me, WEEK)["task_completion_rate"] == 1.0      # nothing was due
    task(db, me, "Revise", 2, task_type="exam_prep")
    assert ws.weekly_summary(db, me, WEEK)["semester_phase"] == "exam_period"


def test_sent_in_the_c4_contract_and_only_once(env):
    _, db, current, _ = env
    me = current["user"]
    task(db, me, "A", 1, status="done")
    first = ws.send_week(db, me, WEEK, now=NOW)
    again = ws.send_week(db, me, WEEK, now=NOW)
    assert (first["status"], again["status"]) == ("SENT", "ALREADY_SENT")

    event = db.query(SignalEvent).one()
    assert (event.signal_type, event.student_id, event.status) == ("DEVIATION", me.research_id, "ACCEPTED")
    DeviationSignal.model_validate(event.payload)                                # C4 can read it
    assert event.payload["task_completion_rate"] == 1.0
    assert db.query(SchedulerAuditLog).filter_by(event_type="deviation_signal_sent").count() == 1


def test_nothing_sent_when_tracking_is_off(env):
    client, db, current, _ = env
    client.patch("/api/scheduler/settings", json={"focus_tracking_enabled": False})
    assert ws.send_week(db, current["user"], WEEK, now=NOW)["status"] == "TRACKING_OFF"
    assert db.query(SignalEvent).count() == 0


def test_backfill_sends_oldest_first(env):
    _, db, current, _ = env
    sent = ws.send_recent_weeks(db, current["user"], weeks=3, now=NOW)
    assert [s["week_start"] for s in sent] == ["2026-09-27", "2026-10-04", "2026-10-11"]
    newest = db.query(SignalEvent).order_by(SignalEvent.received_at.desc()).first()
    assert newest.payload["week_start"].startswith("2026-10-11")              # C4 reads the newest as "this week"


def test_endpoint_and_other_students_untouched(env):
    client, db, current, other = env
    body = client.post("/api/scheduler/integration/weekly-summary?weeks=2").json()
    assert [b["status"] for b in body] == ["SENT", "SENT"]
    assert client.post("/api/scheduler/integration/weekly-summary?weeks=13").status_code == 422
    assert db.query(SignalEvent).filter_by(student_id=other.research_id).count() == 0
