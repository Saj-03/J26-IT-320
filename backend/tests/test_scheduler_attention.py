"""Tests for the M1 attention profile inside the app (Module C)."""
from datetime import datetime, timedelta

from app.components.scheduler.focus import attention_service as att
from app.components.scheduler.ml import m1_predictor
from app.components.scheduler.models import FocusSession

URL = "/api/scheduler/attention/profile"
NOW = datetime(2026, 10, 17, 10, 0)


def session(db, user, days_ago, sl_hour, completed, minutes=25):
    """A finished session that started at `sl_hour` Sri Lanka time, `days_ago` days before NOW."""
    start = datetime(2026, 10, 17) - timedelta(days=days_ago) + timedelta(hours=sl_hour) - timedelta(hours=5, minutes=30)
    db.add(FocusSession(user_id=user.id, started_at=start, ended_at=start + timedelta(minutes=minutes),
                        planned_minutes=minutes, actual_minutes=minutes if completed else 8,
                        completed=completed, task_load="medium"))


def evening_person(db, user, days=20):
    """Always finishes at 20:00, always gives up at 09:00."""
    for d in range(1, days + 1):
        session(db, user, d, 20, True)
        session(db, user, d, 9, False)
    db.commit()


def test_not_enough_history(env):
    client, db, current, _ = env
    for d in range(1, 4):
        session(db, current["user"], d, 20, True)
    db.commit()
    body = client.get(URL).json()
    assert (body["source"], body["sessions_used"], body["peak_hours"]) == ("not_enough_history", 3, None)


def test_model_missing_is_reported(env, monkeypatch):
    _, db, current, _ = env
    monkeypatch.setattr(m1_predictor, "available", lambda: False)
    evening_person(db, current["user"], days=5)
    assert att.attention_profile(db, current["user"], NOW)["source"] == "model_unavailable"


def test_m1_finds_the_evening_peak(env):
    _, db, current, _ = env
    evening_person(db, current["user"])
    p = att.attention_profile(db, current["user"], NOW)
    assert p["source"] == "m1_model" and p["sessions_used"] == 40
    chance = {row["hour"]: row["chance"] for row in p["hourly"]}
    assert chance[20] > chance[9]
    assert any(abs(h - 20) <= 1 for h in p["peak_hours"])
    assert any(abs(h - 9) <= 1 for h in p["low_hours"])
    assert 15 <= p["recommended_focus"] <= 50 and p["capacity_minutes"] in m1_predictor.TIMER_OPTIONS


def test_hours_follow_the_study_window(env):
    client, db, current, _ = env
    client.patch("/api/scheduler/settings", json={"day_start_hour": 6, "day_end_hour": 24})
    evening_person(db, current["user"], days=5)
    hours = [row["hour"] for row in att.attention_profile(db, current["user"], NOW)["hourly"]]
    assert hours == list(range(6, 24))


def test_invalid_and_missed_sessions_are_not_used(env):
    _, db, current, _ = env
    me = current["user"]
    evening_person(db, me, days=2)                                  # 4 good sessions
    t = datetime(2026, 10, 10, 10)
    db.add(FocusSession(user_id=me.id, started_at=t, ended_at=t, planned_minutes=25, was_missed=True))
    db.add(FocusSession(user_id=me.id, started_at=t, ended_at=t, planned_minutes=25, is_valid=False))
    db.commit()
    assert len(att.usable_sessions(db, me)) == 4


def test_late_night_belongs_to_the_day_before():
    s = FocusSession(started_at=datetime(2026, 10, 16, 19, 0), planned_minutes=25, actual_minutes=25,
                     completed=True, pause_count=0)                  # 00:30 Saturday in Sri Lanka
    t = FocusSession(started_at=datetime(2026, 10, 16, 14, 0), planned_minutes=25, actual_minutes=25,
                     completed=True, pause_count=0)                  # 19:30 Friday
    df = m1_predictor.history_frame([s, t])
    assert df["hour"].tolist() == [0, 19] and df["day"].iloc[0] == df["day"].iloc[1]
