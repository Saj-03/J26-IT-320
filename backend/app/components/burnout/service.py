import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap, WellbeingSignal
from app.components.burnout.ml.fusion import fuse
from app.shared.integration.contracts import RiskSignal


def compute_signal(db: Session, user) -> WellbeingSignal:
    since = datetime.utcnow() - timedelta(days=7)
    j = db.query(func.avg(JournalEntry.sentiment)).filter(JournalEntry.user_id == user.id, JournalEntry.created_at >= since).scalar()
    c = db.query(func.avg(ChatMessage.sentiment)).filter(ChatMessage.user_id == user.id, ChatMessage.role == "user", ChatMessage.created_at >= since).scalar()
    m = db.query(func.avg(MoodTap.mood)).filter(MoodTap.user_id == user.id, MoodTap.created_at >= since).scalar()
    deviation = None   # filled from C3 DeviationSignal in the integrated system
    result = fuse(deviation, j, c, m)
    sig = WellbeingSignal(user_id=user.id, **result)
    db.add(sig); db.commit(); db.refresh(sig)
    return sig


def to_risk_signal(sig: WellbeingSignal, research_id: str) -> RiskSignal:
    """Package our output in the agreed C4 -> C3 contract."""
    return RiskSignal(event_id=str(uuid.uuid4()), student_id=research_id,
                      risk_score=sig.risk_score, risk_level=sig.risk_level,
                      trend="STABLE", timestamp=datetime.now(timezone.utc))
