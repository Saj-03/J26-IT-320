"""
Component 3 - FOCUS DECLINE ALERT (FR-16, Objective 7).

Compares the last RECENT_DAYS with the student's usual level (the USUAL_DAYS before that):
    quality - finished sessions dropped by >= QUALITY_DROP, or the 1-5 focus rating by >= RATING_DROP
    habit   - study days per week fell to half (or less) of the usual
Only fires with enough history, never uses medical words, and can be dismissed
(the same kind of alert then stays quiet for SNOOZE_DAYS). Every alert shown / dismissed is audited.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.components.scheduler.models import FocusSession, SchedulerAuditLog
from app.components.scheduler.rewards.progress_service import study_day
from app.components.scheduler.tasks.task_service import audit

RECENT_DAYS, USUAL_DAYS = 7, 21
MIN_USUAL_SESSIONS, MIN_RECENT_SESSIONS = 6, 3
QUALITY_DROP = 0.25            # finished-session rate, e.g. 80% -> 55%
RATING_DROP = 1.0              # average 1-5 focus rating
MIN_RATINGS = 3
HABIT_SHARE = 0.5              # study days per week at or below half the usual
MIN_USUAL_DAYS_PER_WEEK = 3
SNOOZE_DAYS = 7
DISMISSED = "focus_alert_dismissed"

MESSAGES = {
    "quality": ("Your focus sessions have been harder this week",
                "You finished fewer sessions than usual. Shorter sessions in your best hours often help - "
                "and a tough week is normal."),
    "habit": ("You have studied on fewer days this week",
              "Small, regular sessions keep momentum. Even one short session today counts."),
}


def sessions_between(db: Session, user, start: datetime, end: datetime) -> list[FocusSession]:
    return (db.query(FocusSession)
              .filter(FocusSession.user_id == user.id, FocusSession.started_at >= start,
                      FocusSession.started_at < end, FocusSession.ended_at.isnot(None),
                      FocusSession.is_valid.is_(True), FocusSession.was_missed.is_(False)).all())


def summary(sessions: list[FocusSession], days: int) -> dict:
    ratings = [s.focus_rating for s in sessions if s.focus_rating]
    return {"sessions": len(sessions),
            "finished_rate": round(sum(s.completed for s in sessions) / len(sessions), 2) if sessions else None,
            "avg_rating": round(sum(ratings) / len(ratings), 2) if len(ratings) >= MIN_RATINGS else None,
            "days_per_week": round(len({study_day(s.started_at) for s in sessions}) * 7 / days, 1)}


def snoozed(db: Session, user, kind: str, now: datetime) -> bool:
    rows = (db.query(SchedulerAuditLog.details)
              .filter(SchedulerAuditLog.user_id == user.id, SchedulerAuditLog.event_type == DISMISSED,
                      SchedulerAuditLog.created_at >= now - timedelta(days=SNOOZE_DAYS)).all())
    return any(d.get("kind") == kind for (d,) in rows)


def focus_alert(db: Session, user, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    recent_start = now - timedelta(days=RECENT_DAYS)
    recent = summary(sessions_between(db, user, recent_start, now), RECENT_DAYS)
    usual = summary(sessions_between(db, user, recent_start - timedelta(days=USUAL_DAYS), recent_start), USUAL_DAYS)
    details = {"recent": recent, "usual": usual}
    none = {"alert": False, "kind": None, "title": None, "message": None, "details": details}
    if usual["sessions"] < MIN_USUAL_SESSIONS:
        return none                                              # not enough history to compare

    kind = None
    if recent["sessions"] >= MIN_RECENT_SESSIONS and (
            usual["finished_rate"] - recent["finished_rate"] >= QUALITY_DROP
            or (recent["avg_rating"] and usual["avg_rating"]
                and usual["avg_rating"] - recent["avg_rating"] >= RATING_DROP)):
        kind = "quality"
    elif (usual["days_per_week"] >= MIN_USUAL_DAYS_PER_WEEK
          and recent["days_per_week"] <= usual["days_per_week"] * HABIT_SHARE):
        kind = "habit"
    if kind is None or snoozed(db, user, kind, now):
        return none
    title, message = MESSAGES[kind]
    return {"alert": True, "kind": kind, "title": title, "message": message, "details": details}


def dismiss(db: Session, user, kind: str, now: datetime | None = None) -> dict:
    audit(db, user.id, DISMISSED, kind=kind)
    db.commit()
    return {"dismissed": kind, "quiet_for_days": SNOOZE_DAYS}
