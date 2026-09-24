"""
Checks from the C3 proposal: schema version, freshness, duplicate event id.
If a signal is stale or missing, the scheduler FALLS BACK to normal mode.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.config import settings
from app.shared.integration.models import SignalEvent


def is_duplicate(db: Session, event_id: str) -> bool:
    return db.get(SignalEvent, event_id) is not None


def is_stale(ts: datetime) -> bool:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - ts
    return age > timedelta(hours=settings.RISK_SIGNAL_MAX_AGE_HOURS)


def record(db: Session, signal_type: str, payload, status: str) -> None:
    db.add(SignalEvent(event_id=payload.event_id, signal_type=signal_type,
                       student_id=payload.student_id,
                       payload=payload.model_dump(mode="json"), status=status))
    db.commit()
