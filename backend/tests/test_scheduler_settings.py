"""Tests for GET/PATCH /settings - student preferences and controls."""
from datetime import datetime

from app.components.scheduler import commitment_service as cs
from app.components.scheduler import focus_service as fs
from app.components.scheduler.models import FocusSession, SchedulerSettings

URL = "/api/scheduler/settings"


# ---------------------------------------------------------------------------
# Read / change
# ---------------------------------------------------------------------------
def test_defaults_without_writing_to_database(env):
    client, db, *_ = env
    body = client.get(URL).json()
    assert (body["mode"], body["day_start_hour"], body["day_end_hour"], body["usual_focus_minutes"]) == \
           ("adaptive", 8, 22, 25)
    assert db.query(SchedulerSettings).count() == 0


def test_change_only_sent_fields(env):
    client, *_ = env
    body = client.patch(URL, json={"day_start_hour": 6, "usual_focus_minutes": 40}).json()
    assert (body["day_start_hour"], body["day_end_hour"], body["usual_focus_minutes"]) == (6, 22, 40)
    assert client.get(URL).json()["day_start_hour"] == 6              # saved


def test_preferred_hours_cleaned(env):
    client, *_ = env
    assert client.patch(URL, json={"preferred_hours": [20, 9, 9, 10]}).json()["preferred_hours"] == [9, 10, 20]


def test_fixed_timer_can_be_cleared(env):
    client, *_ = env
    client.patch(URL, json={"fixed_timer_minutes": 45})
    assert client.patch(URL, json={"fixed_timer_minutes": None}).json()["fixed_timer_minutes"] is None


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def test_student_cannot_change_experiment_mode(env):
    client, *_ = env
    assert client.patch(URL, json={"mode": "static"}).status_code == 422
    assert client.patch(URL, json={"pilot_group": "AB"}).status_code == 422


def test_window_checked_with_old_values(env):
    client, *_ = env
    client.patch(URL, json={"day_start_hour": 18})                     # 18:00 - 22:00 is fine
    assert client.patch(URL, json={"day_end_hour": 19}).status_code == 422   # only 1 hour


def test_bad_values_rejected(env):
    client, *_ = env
    for bad in ({"day_start_hour": 25}, {"preferred_hours": [24]}, {"usual_focus_minutes": 5},
                {"max_study_minutes_per_day": 2000}):
        assert client.patch(URL, json=bad).status_code == 422


# ---------------------------------------------------------------------------
# Settings really change behaviour
# ---------------------------------------------------------------------------
def test_study_window_changes_free_time(env):
    client, db, current, _ = env
    client.patch(URL, json={"day_start_hour": 6, "day_end_hour": 24})
    now = datetime(2026, 10, 18, 18, 30)                               # Monday 00:00 Sri Lanka
    assert cs.get_availability(db, current["user"], days=1, now=now)["total_free_minutes"] == 18 * 60


def test_survey_focus_length_used_for_timer(env):
    client, *_ = env
    client.patch(URL, json={"usual_focus_minutes": 35})
    assert client.get("/api/scheduler/focus/recommendation").json()["focus_minutes"] == 35


def test_tracking_off_blocks_new_sessions(env):
    client, *_ = env
    client.patch(URL, json={"focus_tracking_enabled": False})
    assert client.post("/api/scheduler/focus/start", json={}).status_code == 403


def test_tracking_off_stops_running_session(env):
    client, db, *_ = env
    sid = client.post("/api/scheduler/focus/start", json={}).json()["session"]["id"]
    client.patch(URL, json={"focus_tracking_enabled": False})

    s = db.get(FocusSession, sid)
    assert (s.ended_at is not None, s.is_valid, s.actual_minutes) == (True, False, 0)


def test_stopped_session_not_in_dashboard_numbers(env):
    client, db, current, _ = env
    client.post("/api/scheduler/focus/start", json={})
    client.patch(URL, json={"focus_tracking_enabled": False})
    summary = fs.focus_history(db, current["user"])["summary"]
    assert (summary["sessions"], summary["completion_rate"]) == (0, None)


def test_each_student_has_own_settings(env):
    client, _, current, other = env
    client.patch(URL, json={"day_start_hour": 5})
    current["user"] = other
    assert client.get(URL).json()["day_start_hour"] == 8
