import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap, WellbeingSignal
from app.components.burnout.ml.fusion import fuse
from app.components.burnout.ml.deviation_detector import deviation_score
from app.components.burnout.schemas import SignalOut
from app.shared.integration.contracts import RiskSignal, RecoverySignal
from app.shared.integration.models import SignalEvent
from app.shared.integration.validator import record

LABEL = {"LOW": "low", "MODERATE": "moderate", "HIGH": "elevated"}
DEVIATION_MAX_AGE = timedelta(days=10)     # weekly signal; older than this = treated as missing
TREND_DELTA = 0.08


def _row(p: dict) -> list[float]:
    return [p["task_completion_rate"], p["missed_sessions"], p["task_load"], p["deadline_density"]]


def latest_behaviour(db: Session, research_id: str) -> tuple[float | None, dict | None]:
    """(deviation score, latest DeviationSignal payload) from C3 signals. (None, None) if missing/stale.
    Only the integration audit log is read - never the Scheduler's own tables."""
    evs = (db.query(SignalEvent)
             .filter(SignalEvent.signal_type == "DEVIATION", SignalEvent.student_id == research_id,
                     SignalEvent.status.in_(["ACCEPTED", "STALE"]))
             .order_by(SignalEvent.received_at.desc()).limit(12).all())
    if not evs or datetime.utcnow() - evs[0].received_at > DEVIATION_MAX_AGE:
        return None, None
    # oldest first so the baseline reads naturally; newest event is the one being scored
    score = deviation_score([_row(e.payload) for e in reversed(evs[1:])], _row(evs[0].payload))
    return score, evs[0].payload


def _trend(prev: WellbeingSignal | None, score: float) -> str:
    if prev is None:
        return "STABLE"
    d = score - prev.risk_score
    return "RISING" if d > TREND_DELTA else "FALLING" if d < -TREND_DELTA else "STABLE"


def compute_signal(db: Session, user) -> WellbeingSignal:
    since = datetime.utcnow() - timedelta(days=7)
    j = db.query(func.avg(JournalEntry.sentiment)).filter(JournalEntry.user_id == user.id, JournalEntry.created_at >= since).scalar()
    c = db.query(func.avg(ChatMessage.sentiment)).filter(ChatMessage.user_id == user.id, ChatMessage.role == "user", ChatMessage.created_at >= since).scalar()
    m = db.query(func.avg(MoodTap.mood)).filter(MoodTap.user_id == user.id, MoodTap.created_at >= since).scalar()
    deviation, _ = latest_behaviour(db, user.research_id)
    result = fuse(deviation, j, c, m)

    prev = (db.query(WellbeingSignal).filter_by(user_id=user.id)
              .order_by(WellbeingSignal.created_at.desc()).first())
    trend = _trend(prev, result["risk_score"])
    sig = WellbeingSignal(user_id=user.id, risk_score=result["risk_score"], risk_level=result["risk_level"],
                          inputs={"signals": result["inputs"], "reasons": result["reasons"], "trend": trend})
    db.add(sig); db.commit(); db.refresh(sig)
    return sig


def to_out(sig: WellbeingSignal) -> SignalOut:
    inp = sig.inputs or {}
    return SignalOut(risk_level=sig.risk_level, label=LABEL[sig.risk_level], risk_score=sig.risk_score,
                     trend=inp.get("trend", "STABLE"), reasons=inp.get("reasons", []))


def to_risk_signal(sig: WellbeingSignal, research_id: str) -> RiskSignal:
    """Package our output in the agreed C4 -> C3 contract."""
    return RiskSignal(event_id=str(uuid.uuid4()), student_id=research_id,
                      risk_score=sig.risk_score, risk_level=sig.risk_level,
                      trend=(sig.inputs or {}).get("trend", "STABLE"), timestamp=datetime.now(timezone.utc))


def to_recovery_signal(sig: WellbeingSignal, research_id: str) -> RecoverySignal:
    """C4 -> Physical Wellbeing. LOW = normal plan; MODERATE/HIGH = recovery recommendations."""
    mode = sig.risk_level != "LOW"
    severity = {"LOW": "MILD", "MODERATE": "MODERATE", "HIGH": "HIGH"}[sig.risk_level]
    return RecoverySignal(event_id=str(uuid.uuid4()), student_id=research_id, recovery_mode=mode,
                          severity=severity, timestamp=datetime.now(timezone.utc))


def publish(db: Session, user) -> WellbeingSignal:
    """Run fusion, then log RiskSignal (-> Scheduler) and RecoverySignal (-> Physical) in the audit log."""
    sig = compute_signal(db, user)
    record(db, "RISK", to_risk_signal(sig, user.research_id), "ACCEPTED")
    record(db, "RECOVERY", to_recovery_signal(sig, user.research_id), "ACCEPTED")
    return sig


def summary(db: Session, user, n: int = 14) -> dict:
    rows = (db.query(WellbeingSignal).filter_by(user_id=user.id)
              .order_by(WellbeingSignal.created_at.desc()).limit(n).all())
    return {"latest": to_out(rows[0]) if rows else None,
            "history": [r.risk_score for r in reversed(rows)]}


def build_context(db: Session, user) -> dict | None:
    """Grounding for the chat agent, taken from the C3 DeviationSignal (not from Scheduler tables)."""
    score, p = latest_behaviour(db, user.research_id)
    if not p:
        return None
    dev = ("no baseline yet" if score is None else
           "quite different from usual" if score > 0.6 else
           "slightly different from usual" if score > 0.3 else "about normal")
    return {"task_load": p["task_load"], "completion_rate": p["task_completion_rate"], "deviation": dev}
