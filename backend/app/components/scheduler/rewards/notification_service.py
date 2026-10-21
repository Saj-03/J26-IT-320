"""
Component 3 - NOTIFICATIONS (FR-11): a few useful notes, built from real data each time.

    Schedule      - next study session starts soon, a deadline within 24 h, missed sessions to re-plan
    Focus         - focus quality / habit dropped (FR-16)
    Wellbeing     - Component 4's signal -> a lighter plan is suggested
    Achievements  - badges and milestones of the last 7 days

"Unread" = newer than the last time the student opened the notifications page
(saved as a "notifications_seen" audit row).
"""
from datetime import datetime, timedelta, date, time, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.components.scheduler.focus import alert_service
from app.components.scheduler.planning import planner_service
from app.components.scheduler.stress import stress_service
from app.components.scheduler.models import PlannedSession, RewardEvent, SchedulerAuditLog, Task
from app.components.scheduler.tasks.task_service import audit
from app.components.physical_wellbeing.models import WellbeingProfile

SOON_HOURS = 3                 # "your session starts in ..." if it starts within 3 h
DUE_HOURS = 24
ACHIEVEMENT_DAYS = 7
SEEN = "notifications_seen"
OPEN = ("pending", "in_progress")


def note(key, category, icon, title, body, at, link):
    return {"id": key, "category": category, "icon": icon, "title": title, "body": body, "at": at, "link": link}


def notifications(db: Session, user, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    items = []

    # --- Wellbeing: per-day workout reminder windows set from the physical plan ---
    profile = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    windows = (profile.assessment_data or {}).get("workout_time_windows", {}) if profile else {}
    for day_key, window in (windows or {}).items():
        try:
            workout_day = date.fromisoformat(day_key)
            local_start = time.fromisoformat(window["start_time"])
            local_end = time.fromisoformat(window["end_time"])
            tz = ZoneInfo(window["timezone"])
            reminder_at = datetime.combine(workout_day, local_start, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
            end_at = datetime.combine(workout_day, local_end, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
        except (KeyError, TypeError, ValueError, ZoneInfoNotFoundError):
            continue
        if reminder_at <= now and now <= end_at + timedelta(hours=24):
            try:
                delivery_at = datetime.fromisoformat(window["delivered_at"]) if window.get("delivered_at") else None
            except (TypeError, ValueError):
                delivery_at = None
            if delivery_at is not None and delivery_at.tzinfo is not None:
                delivery_at = delivery_at.astimezone(timezone.utc).replace(tzinfo=None)
            if delivery_at is None:
                delivery_at = now
                updated_window = dict(window)
                updated_window["delivered_at"] = delivery_at.isoformat()
                windows = dict(windows)
                windows[day_key] = updated_window
                profile_data = dict(profile.assessment_data or {})
                profile_data["workout_time_windows"] = windows
                profile.assessment_data = profile_data
                db.commit()
            items.append(note(
                f"workout-reminder-{workout_day.isoformat()}", "Wellbeing", "timer", "Your workout window is starting",
                f"Your workout time is {local_start.strftime('%I:%M %p').lstrip('0')}–{local_end.strftime('%I:%M %p').lstrip('0')}. Open today's plan when you're ready.",
                delivery_at, "/app/physical/plan",
            ))

    # --- Schedule: next planned session soon ---
    nxt = (db.query(PlannedSession, Task).join(Task, Task.id == PlannedSession.task_id)
             .filter(PlannedSession.user_id == user.id, PlannedSession.start >= now,
                     PlannedSession.start <= now + timedelta(hours=SOON_HOURS), Task.status.in_(OPEN))
             .order_by(PlannedSession.start).first())
    if nxt:
        p, t = nxt
        items.append(note(f"soon-{p.id}", "Schedule", "timer", "A study session starts soon",
                          f"{t.title} · {p.minutes} min", p.start - timedelta(hours=SOON_HOURS), "/app/schedule"))

    # --- Schedule: deadlines within 24 h ---
    due = (db.query(Task).filter(Task.user_id == user.id, Task.status.in_(OPEN), Task.parent_id.is_(None),
                                 Task.deadline > now, Task.deadline <= now + timedelta(hours=DUE_HOURS))
             .order_by(Task.deadline).all())
    for t in due:
        items.append(note(f"due-{t.id}", "Schedule", "calendar", f"{t.title} is due soon",
                          "Due within 24 hours. Open the task to see what is left.",
                          t.deadline - timedelta(hours=DUE_HOURS), f"/app/tasks/detail?id={t.id}"))

    # --- Schedule: missed sessions (FR-09) ---
    missed = planner_service.missed_pieces(db, user, now)
    if missed:
        last = max(p.end for p, _ in missed)
        items.append(note(f"missed-{last.isoformat()}", "Schedule", "calendar",
                          f"You missed {len(missed)} study session{'s' if len(missed) > 1 else ''}",
                          "That's okay - we have a new plan ready for you to check.", last, "/app/schedule"))

    # --- Focus: quality / habit drop (FR-16) ---
    alert = alert_service.focus_alert(db, user, now)
    if alert["alert"]:
        items.append(note(f"focus-{alert['kind']}-{now:%Y%W}", "Focus", "timer", alert["title"], alert["message"],
                          now.replace(hour=0, minute=0, second=0, microsecond=0), "/app/focus/setup"))

    # --- Wellbeing: Component 4 signal -> a lighter plan is made by itself, waiting for the student ---
    stress_service.auto_propose(db, user, now)
    for p in stress_service.list_proposals(db, user):
        items.append(note(f"stress-{p.id}", "Wellbeing", "heart", "A lighter plan is ready for you to check",
                          p.reason, p.created_at, "/app/schedule/adjusted"))

    # --- Achievements: badges + milestones of the last week ---
    rewards = (db.query(RewardEvent).filter(RewardEvent.user_id == user.id, RewardEvent.kind.in_(("badge", "milestone")),
                                            RewardEvent.created_at >= now - timedelta(days=ACHIEVEMENT_DAYS))
                 .order_by(RewardEvent.created_at.desc()).all())
    for r in rewards:
        kind = "badge" if r.kind == "badge" else "milestone"
        body = f"+{r.amount} XP bonus" if r.amount else "Added to your badges."
        items.append(note(r.id, "Achievements", "trophy", f"New {kind}: {r.label}", body, r.created_at, "/app/progress"))

    items.sort(key=lambda n: n["at"], reverse=True)
    seen = (db.query(SchedulerAuditLog.created_at)
              .filter_by(user_id=user.id, event_type=SEEN)
              .order_by(SchedulerAuditLog.created_at.desc()).first())
    last_seen = seen[0] if seen else None
    for n in items:
        n["unread"] = last_seen is None or n["at"] > last_seen
    return {"items": items, "unread": sum(n["unread"] for n in items)}


def mark_seen(db: Session, user, now: datetime | None = None) -> dict:
    db.add(SchedulerAuditLog(user_id=user.id, event_type=SEEN, details={}, created_at=now or datetime.utcnow()))
    db.commit()
    return {"unread": 0}
