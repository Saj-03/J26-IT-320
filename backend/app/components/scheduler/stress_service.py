"""
Component 3 - STRESS STATUS (Module F, step F1): read Component 4's wellbeing signal safely.

C4 writes a RiskSignal into the shared signal_events table (signal_type "RISK")
every time the student journals / taps a mood. Here we decide what the scheduler
should do with it - nothing is changed yet (proposals come in F3).

Decision order (first match wins):
  1. student turned stress adaptation off      -> "off"   (student stays in control)
  2. experiment mode is not "adaptive"         -> "off"   (static / attention_only groups get no stress changes)
  3. no signal (or student stopped sharing)    -> "none"  (normal schedule)
  4. signal older than 24 h                    -> "none"  (stale = fall back to normal, proposal rule)
  5. risk LOW                                  -> "none"
  6. already proposed for this level in 24 h   -> "already_proposed"  (C4 sends many signals - no spam)
  7. MODERATE / HIGH                           -> "propose_changes"

GET only reads - no audit rows here. Proposals (F3) are audited when they are made.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.components.scheduler.models import ScheduleChange
from app.components.scheduler.settings_service import get_settings
from app.shared.integration.models import SignalEvent

SIGNAL_MAX_AGE = timedelta(hours=app_settings.RISK_SIGNAL_MAX_AGE_HOURS)   # same rule as the integration validator
PROPOSAL_COOLDOWN = timedelta(hours=24)
LEVEL_RANK = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
STRESS_TRIGGER = "wellbeing_signal"     # ScheduleChange.trigger for stress proposals


def latest_signal(db: Session, user) -> SignalEvent | None:
    """Newest accepted RiskSignal from C4 for this student (C4 uses the pseudonymous research id)."""
    return (db.query(SignalEvent)
              .filter(SignalEvent.signal_type == "RISK",
                      SignalEvent.student_id == user.research_id,
                      SignalEvent.status == "ACCEPTED")
              .order_by(SignalEvent.received_at.desc())
              .first())


def last_stress_proposal(db: Session, user, since: datetime) -> ScheduleChange | None:
    """Newest stress proposal made after `since`."""
    return (db.query(ScheduleChange)
              .filter(ScheduleChange.user_id == user.id,
                      ScheduleChange.trigger == STRESS_TRIGGER,
                      ScheduleChange.created_at >= since)
              .order_by(ScheduleChange.created_at.desc())
              .first())


def proposed_level(db: Session, change: ScheduleChange) -> str:
    """Risk level of the signal that caused an earlier proposal (LOW if unknown)."""
    event = db.get(SignalEvent, change.signal_event_id) if change.signal_event_id else None
    return event.payload.get("risk_level", "LOW") if event else "LOW"


def stress_status(db: Session, user, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    prefs = get_settings(db, user)
    signal = latest_signal(db, user)
    payload = signal.payload if signal else {}
    level = payload.get("risk_level")

    status = {
        "level": level,
        "risk_score": payload.get("risk_score"),
        "trend": payload.get("trend"),
        "signal_event_id": signal.event_id if signal else None,
        "signal_received_at": signal.received_at if signal else None,
        "fresh": bool(signal) and now - signal.received_at <= SIGNAL_MAX_AGE,
        "adaptation_on": prefs["stress_adaptation_enabled"],
        "mode": prefs["mode"],
    }

    def decide(action: str, reason: str) -> dict:
        return {**status, "action": action, "reason": reason}

    if not prefs["stress_adaptation_enabled"]:
        return decide("off", "You turned stress-based changes off - your schedule is never changed for stress.")
    if prefs["mode"] != "adaptive":
        return decide("off", "This study phase uses a fixed schedule - no stress-based changes.")
    if signal is None:
        return decide("none", "No wellbeing signal shared - your normal schedule is used.")
    if not status["fresh"]:
        return decide("none", "The last wellbeing signal is more than a day old - your normal schedule is used.")
    if level == "LOW":
        return decide("none", "Your wellbeing looks steady - your normal schedule is used.")

    earlier = last_stress_proposal(db, user, now - PROPOSAL_COOLDOWN)
    if earlier and LEVEL_RANK[level] <= LEVEL_RANK[proposed_level(db, earlier)]:
        return decide("already_proposed", "We already suggested lighter changes today.")
    return decide("propose_changes", f"Your wellbeing signal is {level.lower()} - we can suggest a lighter plan.")
