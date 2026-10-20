"""Tests for gamification progress (Module G): streak, freeze, stress protection, badges."""
from datetime import date, datetime, timedelta

from app.components.scheduler.rewards import progress_service as ps
from app.components.scheduler.models import FocusSession, RewardEvent, ScheduleChange, Task
from app.shared.integration.models import SignalEvent

TODAY = date(2026, 10, 15)                     # a Thursday
NOW = datetime(2026, 10, 15, 6, 0)             # 11:30 Sri Lanka time


def days(*offsets):
    """{TODAY - n} for each n."""
    return {TODAY - timedelta(days=n) for n in offsets}


# ---------------------------------------------------------------------------
# Streak rules (pure function)
# ---------------------------------------------------------------------------
def test_days_in_a_row():
    assert ps.streak(days(0, 1, 2), set(), TODAY)["current"] == 3


def test_today_not_done_yet_does_not_break_it():
    s = ps.streak(days(1, 2, 3), set(), TODAY)
    assert (s["current"], s["today_done"]) == (3, False)


def test_one_missed_day_per_week_is_forgiven():
    s = ps.streak(days(0, 2, 3), set(), TODAY)                 # yesterday (Wed) missed
    assert (s["current"], s["freeze_left_this_week"]) == (3, 0)


def test_second_missed_day_in_the_same_week_breaks_it():
    assert ps.streak(days(0, 2, 4), set(), TODAY)["current"] == 2     # Wed + Mon missed -> stops at Tue


def test_freeze_resets_every_week():
    # Thu..Mon this week done, last Sun missed (last week's freeze), last Sat done, last Fri missed (no freeze left)
    active = days(0, 1, 2, 3, 5)
    assert ps.streak(active, set(), TODAY)["current"] == 5


def test_stressful_days_never_break_it():
    s = ps.streak(days(0, 3), days(1, 2), TODAY)               # Wed + Tue were HIGH stress
    assert (s["current"], s["stress_days_skipped"], s["freeze_left_this_week"]) == (2, 2, 1)


def test_no_sessions_no_streak():
    assert ps.streak(set(), set(), TODAY)["current"] == 0


def test_late_night_counts_to_the_day_before():
    assert ps.study_day(datetime(2026, 10, 14, 19, 30)) == date(2026, 10, 14)   # 01:00 Thu in SL -> Wed


# ---------------------------------------------------------------------------
# Badges + endpoint
# ---------------------------------------------------------------------------
def done_session(db, user, days_ago, minutes=25, load="medium"):
    t = NOW - timedelta(days=days_ago)
    db.add(FocusSession(user_id=user.id, started_at=t, ended_at=t + timedelta(minutes=minutes),
                        planned_minutes=minutes, actual_minutes=minutes, completed=True, task_load=load))
    db.commit()


def badges(result):
    return {b["code"]: b for b in result["badges"]}


def test_first_badges_and_given_only_once(env):
    _, db, current, _ = env
    me = current["user"]
    done_session(db, me, 0, minutes=50)
    first = ps.check_progress(db, me, NOW)
    assert sorted(first["new_badges"]) == ["deep_diver", "first_focus"]
    assert ps.check_progress(db, me, NOW)["new_badges"] == []                # not given twice
    assert db.query(RewardEvent).filter_by(kind="badge").count() == 2
    assert badges(first)["deep_diver"]["earned"] and not badges(first)["week_warrior"]["earned"]


def test_week_warrior_from_streak(env):
    _, db, current, _ = env
    for d in range(7):
        done_session(db, current["user"], d)
    result = ps.check_progress(db, current["user"], NOW)
    assert result["streak"]["current"] == 7 and "week_warrior" in result["new_badges"]


def test_stress_signal_protects_streak(env):
    _, db, current, _ = env
    me = current["user"]
    done_session(db, me, 0)
    done_session(db, me, 3)
    for n in (1, 2):                                               # C4 said HIGH on the 2 missed days
        db.add(SignalEvent(event_id=f"s{n}", signal_type="RISK", student_id=me.research_id, status="ACCEPTED",
                           received_at=NOW - timedelta(days=n), payload={"risk_level": "HIGH"}))
    db.commit()
    assert ps.check_progress(db, me, NOW)["streak"]["current"] == 2


def test_deadline_keeper_and_self_care_progress(env):
    _, db, current, _ = env
    me = current["user"]
    for i in range(3):
        db.add(Task(user_id=me.id, title=f"T{i}", deadline=NOW + timedelta(days=1), estimated_minutes=30,
                    status="done", completed_at=NOW))
    db.add(Task(user_id=me.id, title="Late", deadline=NOW - timedelta(days=1), estimated_minutes=30,
                status="done", completed_at=NOW))                  # after the deadline -> not counted
    db.add(ScheduleChange(user_id=me.id, trigger="wellbeing_signal", reason="r", change_set=[], decision="accepted"))
    db.commit()
    b = badges(ps.check_progress(db, me, NOW))
    assert (b["deadline_keeper"]["progress"], b["deadline_keeper"]["target"]) == (3, 10)
    assert b["self_care"]["earned"]


def test_peak_performer_counts_heavy_sessions_in_m1_best_hours(env):
    _, db, current, _ = env
    me = current["user"]
    base = datetime(2026, 10, 15)
    for d in range(1, 16):                                        # evening person: 20:00 good, 09:00 bad
        for sl_hour, ok in ((20, True), (9, False)):
            t = base - timedelta(days=d) + timedelta(hours=sl_hour) - timedelta(hours=5, minutes=30)
            db.add(FocusSession(user_id=me.id, started_at=t, ended_at=t + timedelta(minutes=25), planned_minutes=25,
                                actual_minutes=25 if ok else 8, completed=ok, task_load="heavy"))
    db.commit()
    b = badges(ps.check_progress(db, me, NOW))
    assert b["peak_performer"]["earned"]                          # 15 heavy evening sessions in the peak


def test_endpoint_and_focus_end_reports_new_badges(env):
    client, *_ = env
    sid = client.post("/api/scheduler/focus/start", json={"planned_minutes": 5}).json()["session"]["id"]
    end = client.post(f"/api/scheduler/focus/{sid}/end").json()
    assert end["new_badges"] == [] and end["streak"] == 0         # 0 min -> not completed, no badge
    body = client.get("/api/scheduler/progress").json()
    assert body["level"] == 1 and len(body["badges"]) == len(ps.BADGES)


def test_milestones_give_bonus_xp_once(env):
    from datetime import datetime, timedelta
    from app.components.scheduler.models import FocusSession, RewardEvent
    client, db, current, _ = env
    start = datetime.utcnow() - timedelta(days=1)
    db.add(FocusSession(user_id=current["user"].id, started_at=start, ended_at=start + timedelta(minutes=70),
                        planned_minutes=70, actual_minutes=70, completed=True))
    db.commit()
    body = client.get("/api/scheduler/progress").json()
    first_hour = next(m for m in body["milestones"] if m["code"] == "focus_1h")
    assert first_hour["earned"] and first_hour["progress"] == 60 and "focus_1h" in body["new_milestones"]
    assert next(m for m in body["milestones"] if m["code"] == "focus_10h")["progress"] == 70
    again = client.get("/api/scheduler/progress").json()
    assert again["new_milestones"] == []
    assert db.query(RewardEvent).filter_by(kind="milestone").count() == 1
    assert again["total_xp"] == body["total_xp"]
