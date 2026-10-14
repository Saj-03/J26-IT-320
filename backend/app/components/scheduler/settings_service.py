"""
Component 3 - STUDENT SETTINGS.

Why this exists:
  * free time uses the study window          (day_start_hour .. day_end_hour)
  * the timer suggestion uses                (fixed_timer_minutes, usual_focus_minutes)
  * cold start (before M1 has data) uses     (usual_focus_minutes, preferred_hours)
  * ethics - the student stays in control    (focus_tracking_enabled, stress_adaptation_enabled)

The student can NOT change mode / pilot_group (only the researcher can),
otherwise the static-vs-adaptive experiment would not be fair.
"""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.components.scheduler.models import FocusSession, SchedulerSettings
from app.components.scheduler.schemas import SettingsUpdate
from app.components.scheduler.task_service import audit

# Same values as the column defaults in models.py
DEFAULTS = {
    "mode": "adaptive",
    "pilot_group": None,
    "day_start_hour": 8,
    "day_end_hour": 22,
    "max_study_minutes_per_day": 360,
    "preferred_hours": [],
    "usual_focus_minutes": 25,
    "focus_tracking_enabled": True,
    "stress_adaptation_enabled": True,
    "fixed_timer_minutes": None,
}
MIN_WINDOW_HOURS = 2      # the study window must be at least 2 hours long


def get_settings(db: Session, user) -> dict:
    """The student's settings. No row yet -> defaults (nothing is written to the database)."""
    row = db.get(SchedulerSettings, user.id)
    if row is None:
        return dict(DEFAULTS)
    return {field: getattr(row, field) for field in DEFAULTS}


def update_settings(db: Session, user, data: SettingsUpdate, now: datetime | None = None) -> dict:
    changes = data.model_dump(exclude_unset=True)      # only the fields that were sent

    # Check the study window using old + new values together
    merged = get_settings(db, user) | changes
    if merged["day_end_hour"] - merged["day_start_hour"] < MIN_WINDOW_HOURS:
        raise HTTPException(422, f"Study window must be at least {MIN_WINDOW_HOURS} hours "
                                 f"(day_end_hour must be after day_start_hour)")

    # First change -> create the row
    row = db.get(SchedulerSettings, user.id)
    if row is None:
        row = SchedulerSettings(user_id=user.id, **DEFAULTS)
        db.add(row)

    for field, value in changes.items():
        setattr(row, field, value)

    # Ethics: tracking turned off -> stop the running session straight away
    # (it is closed and marked invalid, so no data from it is used)
    if changes.get("focus_tracking_enabled") is False:
        stop_running_session(db, user, now or datetime.utcnow())

    audit(db, user.id, "settings_updated", fields=sorted(changes),
          focus_tracking_enabled=merged["focus_tracking_enabled"],
          stress_adaptation_enabled=merged["stress_adaptation_enabled"])
    db.commit()
    return get_settings(db, user)


def stop_running_session(db: Session, user, now: datetime) -> None:
    """Close the running focus session (if any) and keep it out of all numbers and M1 training."""
    running = (db.query(FocusSession)
                 .filter(FocusSession.user_id == user.id,
                         FocusSession.ended_at.is_(None),
                         FocusSession.was_missed.is_(False))
                 .all())
    for session in running:
        session.ended_at = now
        session.paused_at = None
        session.actual_minutes = 0
        session.completed = False
        session.is_valid = False
        audit(db, user.id, "focus_stopped_tracking_off", session_id=session.id)
