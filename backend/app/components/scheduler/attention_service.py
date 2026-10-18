"""
Component 3 - ATTENTION PROFILE (Module C, FR-05 / FR-13 / FR-15) from the M1 model.

For a student with enough focus history, M1 tells us:
  * chance of completing a 25-min session at every hour of their study window
  * best (peak) and worst (low) hours
  * focus capacity (longest session before success drops) -> the suggested Pomodoro length

Not enough history (< 5 finished sessions) or no model -> the caller falls back to rules / survey.
"""
from datetime import datetime

from sqlalchemy.orm import Session

from app.components.scheduler.engine import m1_predictor
from app.components.scheduler.models import FocusSession
from app.components.scheduler.settings_service import get_settings

MIN_SESSIONS = 5            # same as focus_service.MIN_HISTORY_SESSIONS


def usable_sessions(db: Session, user) -> list[FocusSession]:
    """Finished, valid, really-started sessions (the same ones M1 was trained on), oldest first."""
    return (db.query(FocusSession)
              .filter(FocusSession.user_id == user.id, FocusSession.ended_at.isnot(None),
                      FocusSession.was_missed.is_(False), FocusSession.is_valid.is_(True))
              .order_by(FocusSession.started_at)
              .all())


def study_hours(db: Session, user) -> list[int]:
    """Hours of the student's study window, e.g. 8..21 (a window ending at 24 includes 23)."""
    s = get_settings(db, user)
    return [h % 24 for h in range(s["day_start_hour"], s["day_end_hour"])]


def attention_profile(db: Session, user, now: datetime | None = None,
                      sessions: list[FocusSession] | None = None, hours: list[int] | None = None) -> dict:
    """M1 profile, or the reason it is not available yet.
    sessions / hours can be passed in when the caller already loaded them (saves database trips)."""
    now = now or datetime.utcnow()
    sessions = usable_sessions(db, user) if sessions is None else sessions
    base = {"sessions_used": len(sessions), "min_sessions": MIN_SESSIONS}

    if len(sessions) < MIN_SESSIONS:
        return {**base, "source": "not_enough_history",
                "reason": f"{len(sessions)} of {MIN_SESSIONS} sessions done - we are still learning your pattern."}
    if not m1_predictor.available():
        return {**base, "source": "model_unavailable", "reason": "The focus model is not installed on this server."}

    profile = m1_predictor.M1Student(sessions, now).profile(hours or study_hours(db, user))
    best = profile["peak_hours"][0]
    return {**base, **profile, "source": "m1_model",
            "reason": f"From your last {len(sessions)} sessions: you focus best around {best:02d}:00 "
                      f"and can usually keep going for about {profile['capacity_minutes']} minutes."}


def m1_timer(db: Session, user, now: datetime | None = None) -> dict | None:
    """Suggested Pomodoro from M1, or None (caller falls back to rules)."""
    p = attention_profile(db, user, now)
    if p["source"] != "m1_model":
        return None
    focus = p["recommended_focus"]
    return {"focus_minutes": focus, "break_minutes": 5 if focus <= 30 else 10, "source": "m1_model",
            "reason": f"AI suggestion from your last {p['sessions_used']} sessions "
                      f"(best focus around {p['peak_hours'][0]:02d}:00)"}
