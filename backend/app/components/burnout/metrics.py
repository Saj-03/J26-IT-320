"""
Pilot metrics from the proposal (Table 1), computed from the platform logs. Counts and timestamps only: no journal or chat text is read.
  - chat engagement   : chat sessions per week (a session = user messages with < 30 min between them)
  - conversation depth: user turns per session  (context-grounded vs Baseline 2 group)
  - journal adoption  : days with at least one entry, per week
  - tip click-through : tips tried / tips shown
"""
from datetime import datetime, timedelta
from statistics import mean

from sqlalchemy.orm import Session

from app.components.burnout import service
from app.components.burnout.models import JournalEntry, ChatMessage, TipEvent

SESSION_GAP = timedelta(minutes=30)


def _sessions(times: list[datetime]) -> list[int]:
    """Turns per session from sorted user-message times."""
    out, n, prev = [], 0, None
    for t in sorted(times):
        if prev is None or t - prev <= SESSION_GAP:
            n += 1
        else:
            out.append(n); n = 1
        prev = t
    if n:
        out.append(n)
    return out


def participant_metrics(db: Session, user, weeks: int = 7, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    since = now - timedelta(weeks=weeks)
    chat_times = [m.created_at for m in db.query(ChatMessage).filter(
        ChatMessage.user_id == user.id, ChatMessage.role == "user", ChatMessage.created_at >= since)]
    sessions = _sessions(chat_times)
    jdays = {e.created_at.date() for e in db.query(JournalEntry).filter(JournalEntry.user_id == user.id, JournalEntry.created_at >= since)}
    tips = db.query(TipEvent).filter(TipEvent.user_id == user.id, TipEvent.created_at >= since).all()
    shown = sum(t.action == "shown" for t in tips)
    tried = sum(t.action == "tried" for t in tips)
    return {"research_id": user.research_id,
            "group": "grounded" if service.chat_grounded(user) else "baseline2",
            "tip_policy": service.tip_policy(user),
            "chat_sessions_per_week": round(len(sessions) / weeks, 2),
            "turn_depth": round(mean(sessions), 2) if sessions else None,
            "journal_days_per_week": round(len(jdays) / weeks, 2),
            "tips_shown": shown, "tips_tried": tried,
            "tip_click_through": round(tried / shown, 2) if shown else None}


def group_summary(rows: list[dict]) -> dict:
    """Mean of each metric per group (ignores participants with no data for that metric)."""
    out = {}
    for g in ("grounded", "baseline2"):
        rs = [r for r in rows if r["group"] == g]
        def m(k):
            v = [r[k] for r in rs if r[k] is not None]
            return round(mean(v), 2) if v else None
        out[g] = {"n": len(rs), "chat_sessions_per_week": m("chat_sessions_per_week"), "turn_depth": m("turn_depth"),
                  "journal_days_per_week": m("journal_days_per_week"), "tip_click_through": m("tip_click_through")}
    return out


def tip_policy_summary(rows: list[dict]) -> dict:
    """Tip click-through (tried / shown) per tip policy: learned (bandit) versus fixed rules."""
    out = {}
    for pol in ("rules", "bandit"):
        rs = [r for r in rows if r.get("tip_policy") == pol]
        shown = sum(r["tips_shown"] for r in rs); tried = sum(r["tips_tried"] for r in rs)
        out[pol] = {"n": len(rs), "tips_shown": shown, "tips_tried": tried, "click_through": round(tried / shown, 2) if shown else None}
    return out
