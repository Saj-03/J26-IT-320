import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap, WellbeingSignal, BurnoutPreference, TipEvent
from app.components.burnout.ml.fusion import fuse
from app.components.burnout.ml.deviation_detector import deviation_score, deviation_detail
from app.components.burnout import tips
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
    """(deviation score, latest DeviationSignal payload) from C3 signals. (None, None) if missing/stale."""
    d, p = behaviour_detail(db, research_id)
    return (None if d is None else d["score"]), p


def behaviour_detail(db: Session, research_id: str) -> tuple[dict | None, dict | None]:
    """({score, top_factors}, latest DeviationSignal payload). (None, None) if missing/stale.
    Only the integration audit log is read - never the Scheduler's own tables."""
    evs = (db.query(SignalEvent)
             .filter(SignalEvent.signal_type == "DEVIATION", SignalEvent.student_id == research_id,
                     SignalEvent.status.in_(["ACCEPTED", "STALE"]))
             .order_by(SignalEvent.received_at.desc()).limit(12).all())
    if not evs or datetime.utcnow() - evs[0].received_at > DEVIATION_MAX_AGE:
        return None, None
    # oldest first so the baseline reads naturally; newest event is the one being scored
    detail = deviation_detail([_row(e.payload) for e in reversed(evs[1:])], _row(evs[0].payload))
    return detail, evs[0].payload


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
    detail, _ = behaviour_detail(db, user.research_id)
    result = fuse(None if detail is None else detail["score"], j, c, m)

    prev = (db.query(WellbeingSignal).filter_by(user_id=user.id)
              .order_by(WellbeingSignal.created_at.desc()).first())
    trend = _trend(prev, result["risk_score"])
    sig = WellbeingSignal(user_id=user.id, risk_score=result["risk_score"], risk_level=result["risk_level"],
                          inputs={"signals": result["inputs"], "reasons": result["reasons"], "trend": trend,
                                  "factors": [] if detail is None else detail["top_factors"]})
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


def get_prefs(db: Session, user) -> BurnoutPreference:
    p = db.get(BurnoutPreference, user.id)
    if p is None:
        p = BurnoutPreference(user_id=user.id, share_with_scheduler=True, chat_enabled=False)
        db.add(p); db.commit(); db.refresh(p)
    return p


def set_prefs(db: Session, user, share: bool | None, chat: bool | None) -> BurnoutPreference:
    p = get_prefs(db, user)
    if share is not None:
        p.share_with_scheduler = share
    if chat is not None:
        p.chat_enabled = chat
    p.updated_at = datetime.utcnow()
    db.commit(); db.refresh(p)
    return p


def chat_grounded(user) -> bool:
    """Baseline 2 (proposal 3.3): participants listed in BASELINE2_IDS talk to the same agent WITHOUT academic context.
    Assigned by the researcher (not by the student), so the comparison group is controlled."""
    from app.core.config import settings
    ids = {i.strip() for i in settings.BASELINE2_IDS.split(",") if i.strip()}
    return user.research_id not in ids


def log_tip_event(db: Session, user, category: str, action: str) -> bool:
    """Record shown / tried / dismissed. A 'shown' is stored once per category per day so refreshing does not inflate it."""
    if action == "shown":
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if (db.query(TipEvent).filter(TipEvent.user_id == user.id, TipEvent.category == category,
                                      TipEvent.action == "shown", TipEvent.created_at >= start).first()):
            return False
    db.add(TipEvent(user_id=user.id, category=category, action=action)); db.commit()
    return True


def delete_my_data(db: Session, user) -> dict:
    """Erase everything Component 4 holds about this student, including what it sent to other components.
    The Scheduler's own behaviour data (DeviationSignal) belongs to Component 3 and is not touched here."""
    n = {}
    for name, model in (("journal", JournalEntry), ("chat", ChatMessage), ("mood", MoodTap), ("signals", WellbeingSignal), ("tips", TipEvent)):
        n[name] = db.query(model).filter(model.user_id == user.id).delete()
    n["sent_signals"] = (db.query(SignalEvent)
                           .filter(SignalEvent.student_id == user.research_id, SignalEvent.signal_type.in_(["RISK", "RECOVERY"]))
                           .delete(synchronize_session=False))
    db.commit()
    return n


def publish(db: Session, user) -> WellbeingSignal:
    """Run fusion, then log RiskSignal (-> Scheduler) and RecoverySignal (-> Physical) in the audit log.
    If the student turned sharing off, the signal stays private: nothing is sent to other components."""
    sig = compute_signal(db, user)
    if not get_prefs(db, user).share_with_scheduler:
        return sig
    record(db, "RISK", to_risk_signal(sig, user.research_id), "ACCEPTED")
    record(db, "RECOVERY", to_recovery_signal(sig, user.research_id), "ACCEPTED")
    return sig


def summary(db: Session, user, n: int = 14) -> dict:
    rows = (db.query(WellbeingSignal).filter_by(user_id=user.id)
              .order_by(WellbeingSignal.created_at.desc()).limit(n).all())
    if not rows:
        return {"latest": None, "history": [], "signals": {}, "factors": [], "tip": None}
    inp = rows[0].inputs or {}
    sig = inp.get("signals", {})
    factors = inp.get("factors", [])
    return {"latest": to_out(rows[0]), "history": [r.risk_score for r in reversed(rows)],
            "signals": sig, "factors": factors, "tip": tips.choose_tip(sig, factors, user.id)}


def build_context(db: Session, user) -> dict | None:
    """Grounding for the chat agent, taken from the C3 DeviationSignal (not from Scheduler tables)."""
    score, p = latest_behaviour(db, user.research_id)
    if not p:
        return None
    dev = ("no baseline yet" if score is None else
           "quite different from usual" if score > 0.6 else
           "slightly different from usual" if score > 0.3 else "about normal")
    return {"task_load": p["task_load"], "completion_rate": p["task_completion_rate"], "deviation": dev}


# ---------------------------------------------------------------- demo / evaluation scenarios
DEMO_JOURNALS = {
    "bad": ["I am exhausted and I cannot cope with all these deadlines.",
            "Everything feels overwhelming, I keep falling behind and I am so stressed.",
            "I did not sleep, I feel hopeless about this semester."],
    "normal": ["Good day, finished my tasks and still had time to relax.",
               "Feeling fine, a bit busy but manageable."],
}
DEMO_MOODS = {"bad": [1, 2, 1], "normal": [4, 4, 5]}


def seed_demo(db: Session, user, scenario: str = "bad") -> WellbeingSignal:
    """Replace this student's recent history with a scripted scenario and run the real pipeline.
    6 normal weeks of Scheduler behaviour (the personal baseline) + a current week that is normal or 'bad'.
    Uses the real fusion; only the inputs are scripted. For demos and the evaluation scenarios."""
    from app.components.burnout.models import JournalEntry, MoodTap
    from app.components.burnout.nlp.sentiment import sentiment
    from app.shared.integration.mock_signals import mock_deviation_signal

    bad = scenario == "bad"
    now = datetime.utcnow()
    db.query(SignalEvent).filter(SignalEvent.signal_type == "DEVIATION", SignalEvent.student_id == user.research_id).delete()
    for model in (JournalEntry, MoodTap, ChatMessage):
        db.query(model).filter(model.user_id == user.id, model.created_at >= now - timedelta(days=7)).delete()

    for w in range(7, 0, -1):                      # w=1 is the current week, 2..7 are the baseline
        p = mock_deviation_signal(user.research_id, bad_week=(bad and w == 1), seed=w)
        db.add(SignalEvent(event_id=p["event_id"], signal_type="DEVIATION", student_id=user.research_id,
                           payload=p, status="ACCEPTED", received_at=now - timedelta(days=7 * (w - 1), hours=1 if w == 1 else 0)))
    for i, t in enumerate(DEMO_JOURNALS[scenario]):
        db.add(JournalEntry(user_id=user.id, mode="text", text=t, sentiment=sentiment(t), emotion="demo",
                            created_at=now - timedelta(hours=i + 1)))
    for i, m in enumerate(DEMO_MOODS[scenario]):
        db.add(MoodTap(user_id=user.id, mood=m, created_at=now - timedelta(hours=i + 1)))
    db.commit()
    return publish(db, user)
