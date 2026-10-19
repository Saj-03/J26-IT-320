"""FR-12: research export - Table 3 metrics per participant x mode, research IDs only, totals match the DB."""
import csv
import io
from datetime import datetime, timedelta

from app.components.scheduler import research_export, research_service
from app.components.scheduler.models import FocusSession, ScheduleChange, SchedulerAuditLog, Task
from app.components.scheduler.stress_service import STRESS_TRIGGER
from app.shared.integration.models import SignalEvent

URL = "/api/scheduler/research/export.csv"
NOW = datetime(2026, 10, 19, 12, 0)


def setup_pilot(db, me, other):
    """'other' consents: 3 static days, then the researcher switches them to adaptive."""
    other.research_consent = True
    switch = NOW - timedelta(days=3)
    db.add(SchedulerAuditLog(user_id=other.id, event_type="pilot_mode_changed", created_at=switch,
                             details={"old": {"mode": "static", "pilot_group": "AB"},
                                      "new": {"mode": "adaptive", "pilot_group": "AB"}}))
    for days_ago, mode, done in [(6, "static", True), (5, "static", False), (2, "adaptive", True), (1, "adaptive", True)]:
        start = NOW - timedelta(days=days_ago)
        db.add(FocusSession(user_id=other.id, started_at=start, ended_at=start + timedelta(minutes=25),
                            planned_minutes=25, actual_minutes=25 if done else 10, completed=done, mode=mode,
                            timer_recommended=mode == "adaptive"))
    for days_ago, ok in [(5, True), (1, False)]:                       # one on time (static), one late (adaptive)
        deadline = NOW - timedelta(days=days_ago)
        db.add(Task(user_id=other.id, title="secret title", estimated_minutes=60, actual_minutes=90,
                    predicted_minutes=80, status="done", deadline=deadline, scheduled_start=deadline - timedelta(hours=5),
                    completed_at=deadline - timedelta(hours=1) if ok else deadline + timedelta(hours=1)))
    db.add(SignalEvent(event_id="ev1", signal_type="RISK", student_id=other.research_id, payload={},
                       status="ACCEPTED", received_at=NOW - timedelta(days=1, minutes=30)))
    db.add(ScheduleChange(user_id=other.id, trigger=STRESS_TRIGGER, signal_event_id="ev1", reason="r",
                          change_set=[], decision="accepted", created_at=NOW - timedelta(days=1)))
    start = NOW - timedelta(days=2)                                       # not consenting -> never exported
    db.add(FocusSession(user_id=me.id, started_at=start, ended_at=start + timedelta(minutes=25),
                        planned_minutes=25, actual_minutes=25, completed=True))
    db.commit()


def test_students_cannot_export(env):
    client, *_ = env
    assert client.get(URL).status_code == 403


def test_export_splits_by_mode_and_matches_the_database(env, monkeypatch):
    client, db, current, other = env
    monkeypatch.setattr(research_service.settings, "SCHEDULER_RESEARCHER_EMAILS", "me@test.lk")
    setup_pilot(db, current["user"], other)
    rows = {r["mode"]: r for r in research_export.export_rows(db, current["user"], NOW)}

    assert set(rows) == {"static", "adaptive"}
    assert all(r["research_id"] == other.research_id for r in rows.values())   # consenting student only
    assert rows["static"]["focus_completion_rate"] == 0.5 and rows["adaptive"]["focus_completion_rate"] == 1.0
    assert rows["static"]["deadline_adherence"] == 1.0 and rows["adaptive"]["deadline_adherence"] == 0.0
    assert rows["static"]["duration_mae_student"] == 30 and rows["static"]["duration_mae_m3"] == 10
    assert rows["adaptive"]["timer_acceptance"] == 1.0
    assert rows["adaptive"]["deferral_acceptance"] == 1.0
    assert rows["adaptive"]["risk_handling_median_min"] == 30.0
    # totals match the database (FR-12 acceptance test)
    db_sessions = db.query(FocusSession).filter_by(user_id=other.id).count()
    assert sum(r["sessions_started"] for r in rows.values()) == db_sessions


def test_csv_has_no_identifiers(env, monkeypatch):
    client, db, current, other = env
    monkeypatch.setattr(research_service.settings, "SCHEDULER_RESEARCHER_EMAILS", "me@test.lk")
    setup_pilot(db, current["user"], other)
    r = client.get(URL)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.text
    assert "secret title" not in text and other.email not in text and other.full_name not in text
    header = next(csv.reader(io.StringIO(text)))
    assert header == research_export.COLUMNS


def test_peak_window_stability_is_high_for_a_steady_student():
    from app.components.scheduler.commitment_service import SL_OFFSET
    sessions = []
    for d in range(28):                                                 # 4 weeks: always 20:00 good, 09:00 bad
        for hour, done in ((20, True), (9, False)):
            start = datetime(2026, 9, 1) + timedelta(days=d, hours=hour) - SL_OFFSET
            sessions.append(FocusSession(started_at=start, ended_at=start + timedelta(minutes=25), planned_minutes=25,
                                         actual_minutes=25 if done else 8, completed=done, task_load="medium",
                                         pause_count=0, paused_seconds=0, paused_minutes=0, was_missed=False,
                                         is_valid=True, mode="adaptive", timer_recommended=False, timer_overridden=False))
    value = research_export.peak_window_stability(sessions)
    assert value is not None and 0.5 <= value <= 1.0
