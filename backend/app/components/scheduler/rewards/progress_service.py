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

from app.components.scheduler.tasks.commitment_service import SL_OFFSET
from app.components.scheduler.rewards import gamification
from app.components.scheduler.models import FocusSession, RewardEvent, ScheduleChange, Task
from app.components.scheduler.stress.stress_service import STRESS_TRIGGER
from app.components.scheduler.tasks.task_service import drop_planned_pieces
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


# MILESTONES = long-term goals with bonus XP (Objective 7). code -> (title, what is counted, target, bonus XP)
MILESTONES = {
    "focus_1h":   ("First hour of focus",   "focus_minutes", 60, 20),
    "focus_10h":  ("10 hours of focus",     "focus_minutes", 600, 50),
    "focus_25h":  ("25 hours of focus",     "focus_minutes", 1500, 100),
    "focus_50h":  ("50 hours of focus",     "focus_minutes", 3000, 150),
    "tasks_10":   ("10 tasks finished",     "tasks_done", 10, 40),
    "tasks_25":   ("25 tasks finished",     "tasks_done", 25, 80),
    "tasks_50":   ("50 tasks finished",     "tasks_done", 50, 150),
    "days_7":     ("7 study days",          "study_days", 7, 30),
    "days_30":    ("30 study days",         "study_days", 30, 100),
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
    from app.components.scheduler.focus.attention_service import attention_profile   # M1, only when needed
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


def milestone_counts(db: Session, user, done: list[FocusSession]) -> dict[str, int]:
    """Focused minutes (all valid sessions), finished tasks and study days so far."""
    minutes = (db.query(func.sum(FocusSession.actual_minutes))
                 .filter(FocusSession.user_id == user.id, FocusSession.is_valid.is_(True),
                         FocusSession.was_missed.is_(False)).scalar() or 0)
    tasks = db.query(Task).filter(Task.user_id == user.id, Task.status == "done").count()
    return {"focus_minutes": int(minutes), "tasks_done": tasks,
            "study_days": len({study_day(x.started_at) for x in done})}


def award_milestones(db: Session, user, counts: dict[str, int]) -> list[str]:
    """Give each reached milestone once, with its bonus XP (id = "milestone-<code>-<user>")."""
    new = []
    for code, (title, what, target, xp) in MILESTONES.items():
        key = f"milestone-{code}-{user.id}"
        if counts[what] >= target and db.get(RewardEvent, key) is None:
            db.add(RewardEvent(id=key, user_id=user.id, kind="milestone", amount=xp, label=title))
            new.append(code)
    return new


def check_progress(db: Session, user, now: datetime | None = None) -> dict:
    """XP, level, streak and badges. New badges are given here (safe to call often)."""
    now = now or datetime.utcnow()
    done = completed_sessions(db, user)
    s = streak({study_day(x.started_at) for x in done}, stress_days(db, user), study_day(now))
    progress = badge_progress(db, user, done, s["current"])
    new = award_badges(db, user, progress)
    counts = milestone_counts(db, user, done)
    new_milestones = award_milestones(db, user, counts)
    db.commit()
    reached = {r.id: r.created_at for r in db.query(RewardEvent).filter_by(user_id=user.id, kind="milestone")}

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
        "milestones": [{"code": code, "title": title, "target": target, "xp": xp,
                        "progress": min(counts[what], target), "unit": what,
                        "earned": f"milestone-{code}-{user.id}" in reached,
                        "earned_at": reached.get(f"milestone-{code}-{user.id}")}
                       for code, (title, what, target, xp) in MILESTONES.items()],
        "new_milestones": new_milestones,
    }


def complete_task(db: Session, user, task: Task) -> dict:
    task.status = "done"
    task.completed_at = task.completed_at or datetime.utcnow()
    drop_planned_pieces(db, [task.id])          # finished -> its future planned pieces are free time again
    key = f"task-{task.id}"
    if not db.get(RewardEvent, key):
        db.add(RewardEvent(id=key, user_id=user.id, kind="xp", amount=gamification.xp_for_task(task.cognitive_load)))
    db.commit()
    total = db.query(func.sum(RewardEvent.amount)).filter_by(user_id=user.id).scalar() or 0
    return {"total_xp": total, "level": gamification.level_from_xp(total)}
