"""
Component 3 - GAMIFICATION PROGRESS (Module G, FR-10): XP, level, streak and badges.

STREAK = study days in a row with at least one completed focus session.
  * worked out from the sessions every time (never stored, so it can't get out of sync)
  * today without a session yet does not break it (the day is not over)
  * 1 "freeze" per week: one missed day per Mon-Sun week is forgiven
  * no punishment under stress: a day with a HIGH wellbeing signal from Component 4 never breaks it

BADGES are given once (RewardEvent id = "badge-<code>-<user>"), and are never taken away.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.engine import gamification
from app.components.scheduler.models import FocusSession, RewardEvent, ScheduleChange, Task
from app.components.scheduler.stress_service import STRESS_TRIGGER
from app.shared.integration.models import SignalEvent

DAY_CHANGE_HOUR = 3            # work until 03:00 counts to the day before (same as M1)
FREEZES_PER_WEEK = 1
MAX_STREAK_DAYS = 366
XP_PER_LEVEL = 200             # same as gamification.level_from_xp

# code -> (emoji, title, how to earn it, target)
BADGES = {
    "first_focus":     ("🌱", "First Focus",     "Complete your first focus session", 1),
    "deep_diver":      ("🧠", "Deep Diver",      "Complete a 45-minute session", 45),
    "week_warrior":    ("🔥", "Week Warrior",    "Reach a 7-day streak", 7),
    "peak_performer":  ("🎯", "Peak Performer",  "Finish 5 heavy sessions in your best focus hours", 5),
    "deadline_keeper": ("✅", "Deadline Keeper", "Finish 10 tasks before their deadline", 10),
    "self_care":       ("🌿", "Self-care",       "Accept a lighter plan on a stressful day", 1),
}


def study_day(moment: datetime) -> date:
    """Sri Lanka study day of a UTC time."""
    return (moment + SL_OFFSET - timedelta(hours=DAY_CHANGE_HOUR)).date()


def completed_sessions(db: Session, user) -> list[FocusSession]:
    return (db.query(FocusSession)
              .filter(FocusSession.user_id == user.id, FocusSession.completed.is_(True),
                      FocusSession.is_valid.is_(True), FocusSession.was_missed.is_(False))
              .all())


def stress_days(db: Session, user) -> set[date]:
    """Days on which Component 4 reported HIGH (these never break a streak)."""
    rows = (db.query(SignalEvent.received_at, SignalEvent.payload)
              .filter(SignalEvent.signal_type == "RISK", SignalEvent.student_id == user.research_id,
                      SignalEvent.status == "ACCEPTED")
              .all())
    return {study_day(at) for at, payload in rows if payload.get("risk_level") == "HIGH"}


def streak(active: set[date], protected: set[date], today: date) -> dict:
    """Count study days in a row, going back from today."""
    count, freezes_used, protected_used = 0, {}, 0
    day = today if today in active else today - timedelta(days=1)      # today not over yet
    for _ in range(MAX_STREAK_DAYS):
        if day in active:
            count += 1
        elif day in protected:
            protected_used += 1                                         # stressful day: skipped, not broken
        else:
            week = day - timedelta(days=day.weekday())                  # Monday of that week
            if freezes_used.get(week, 0) >= FREEZES_PER_WEEK:
                break
            freezes_used[week] = freezes_used.get(week, 0) + 1          # forgiven by this week's freeze
        day -= timedelta(days=1)

    this_week = today - timedelta(days=today.weekday())
    return {"current": count, "today_done": today in active,
            "freeze_left_this_week": FREEZES_PER_WEEK - freezes_used.get(this_week, 0),
            "stress_days_skipped": protected_used}


# ---------------------------------------------------------------------------
# Badges
# ---------------------------------------------------------------------------
def badge_progress(db: Session, user, done: list[FocusSession], current_streak: int) -> dict[str, int]:
    """How far the student is towards each badge (compared with the target)."""
    on_time = (db.query(Task)
                 .filter(Task.user_id == user.id, Task.status == "done", Task.completed_at.isnot(None),
                         Task.completed_at <= Task.deadline)
                 .count())
    relief = (db.query(ScheduleChange)
                .filter(ScheduleChange.user_id == user.id, ScheduleChange.trigger == STRESS_TRIGGER,
                        ScheduleChange.decision.in_(["accepted", "edited"]))
                .count())
    return {
        "first_focus": len(done),
        "deep_diver": max((s.actual_minutes for s in done), default=0),
        "week_warrior": current_streak,
        "peak_performer": heavy_in_peak(db, user, done),
        "deadline_keeper": on_time,
        "self_care": relief,
    }


def heavy_in_peak(db: Session, user, done: list[FocusSession]) -> int:
    """Completed heavy sessions that started in one of the student's M1 best hours."""
    heavy = [s for s in done if s.task_load == "heavy"]
    if not heavy:
        return 0
    from app.components.scheduler.attention_service import attention_profile   # M1, only when needed
    profile = attention_profile(db, user)
    if profile["source"] != "m1_model":
        return 0
    peaks = set(profile["peak_hours"])
    return sum((s.started_at + SL_OFFSET).hour in peaks for s in heavy)


def award_badges(db: Session, user, progress: dict[str, int]) -> list[str]:
    """Give every badge whose target is reached and not given yet. Returns the NEW ones."""
    new = []
    for code, (_, title, _, target) in BADGES.items():
        key = f"badge-{code}-{user.id}"
        if progress[code] >= target and db.get(RewardEvent, key) is None:
            db.add(RewardEvent(id=key, user_id=user.id, kind="badge", amount=0, label=title))
            new.append(code)
    return new


def check_progress(db: Session, user, now: datetime | None = None) -> dict:
    """XP, level, streak and badges. New badges are given here (safe to call often)."""
    now = now or datetime.utcnow()
    done = completed_sessions(db, user)
    s = streak({study_day(x.started_at) for x in done}, stress_days(db, user), study_day(now))
    progress = badge_progress(db, user, done, s["current"])
    new = award_badges(db, user, progress)
    db.commit()

    earned = {r.id: r.created_at for r in db.query(RewardEvent).filter_by(user_id=user.id, kind="badge")}
    total = db.query(func.sum(RewardEvent.amount)).filter(RewardEvent.user_id == user.id).scalar() or 0
    return {
        "total_xp": total,
        "level": gamification.level_from_xp(total),
        "xp_to_next_level": XP_PER_LEVEL - total % XP_PER_LEVEL,
        "streak": s,
        "badges": [{"code": code, "emoji": emoji, "title": title, "description": how,
                    "earned": f"badge-{code}-{user.id}" in earned,
                    "earned_at": earned.get(f"badge-{code}-{user.id}"),
                    "progress": min(progress[code], target), "target": target}
                   for code, (emoji, title, how, target) in BADGES.items()],
        "new_badges": new,
    }
