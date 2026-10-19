"""
Component 3 - NOTIFICATIONS (FR-11): a few useful notes, built from real data each time (nothing stored).

    Schedule      - next study session starts soon, a deadline within 24 h, missed sessions to re-plan
    Focus         - focus quality / habit dropped (FR-16)
    Wellbeing     - Component 4's signal -> a lighter plan is suggested
    Achievements  - badges and milestones of the last 7 days

"Unread" = newer than the last time the student opened the notifications page
(saved as a "notifications_seen" audit row).
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.components.scheduler import alert_service, planner_service, stress_service
from app.components.scheduler.models import PlannedSession, RewardEvent, SchedulerAuditLog, Task
from app.components.scheduler.task_service import audit

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

    # --- Wellbeing: Component 4 signal -> lighter plan suggested ---
    status = stress_service.stress_status(db, user, now)
    if status.get("action") == "propose_changes":
        items.append(note(f"stress-{status.get('signal_event_id')}", "Wellbeing", "heart",
                          "A lighter plan is suggested", status.get("reason") or "Your wellbeing signal is high.",
                          status.get("signal_received_at") or now, "/app/schedule/adjusted"))

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
