"""
Component 3 - INSIGHTS for the Overview and AI Insights pages: real numbers only (no sample data).

    days            last 7 study days: tasks done, focus minutes, sessions, % sessions finished
    week            this week vs the week before (tasks done, focus minutes)
    by_hour         M1 chance of finishing a session at each study hour (or the real finished-% per hour)
    best_load       which effort level (light / medium / heavy) the student finishes most often
    duration        recent tasks: estimated vs actual (+ M3) and the usual over-run
    stress          Component 4's risk score per day (only what the student shared with the scheduler)
"""
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.components.scheduler.focus import attention_service
from app.components.scheduler.tasks.commitment_service import SL_OFFSET
from app.components.scheduler.models import FocusSession, Task
from app.components.scheduler.rewards.progress_service import study_day
from app.shared.integration.models import SignalEvent

DAYS = 7
MIN_LOGGED = 5
RECENT_TASKS = 5
MIN_PER_LOAD = 3


def insights(db: Session, user, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    today = study_day(now)
    first = today - timedelta(days=2 * DAYS - 1)
    since = now - timedelta(days=2 * DAYS + 1)

    sessions = (db.query(FocusSession)
                  .filter(FocusSession.user_id == user.id, FocusSession.started_at >= since,
                          FocusSession.ended_at.isnot(None), FocusSession.is_valid.is_(True),
                          FocusSession.was_missed.is_(False)).all())
    done = (db.query(Task).filter(Task.user_id == user.id, Task.status == "done",
                                  Task.completed_at >= since).all())

    per_day = defaultdict(lambda: {"tasks_done": 0, "focus_minutes": 0, "sessions": 0, "finished": 0})
    for s in sessions:
        d = per_day[study_day(s.started_at)]
        d["focus_minutes"] += s.actual_minutes
        d["sessions"] += 1
        d["finished"] += int(s.completed)
    for t in done:
        per_day[study_day(t.completed_at)]["tasks_done"] += 1

    days = []
    for i in range(DAYS):
        day = today - timedelta(days=DAYS - 1 - i)
        d = per_day[day]
        days.append({"date": day.isoformat(), "label": day.strftime("%a"), **d,
                     "finished_pct": round(100 * d["finished"] / d["sessions"]) if d["sessions"] else None})

    def total(key, start, end):
        return sum(v[key] for k, v in per_day.items() if start <= k <= end)
    this_start = today - timedelta(days=DAYS - 1)
    week = {"tasks_done": total("tasks_done", this_start, today),
            "tasks_done_before": total("tasks_done", first, this_start - timedelta(days=1)),
            "focus_minutes": total("focus_minutes", this_start, today),
            "focus_minutes_before": total("focus_minutes", first, this_start - timedelta(days=1))}

    return {"days": days, "week": week, "by_hour": by_hour(db, user, now), "best_load": best_load(db, user),
            "duration": duration(db, user), "stress": stress(db, user, today)}


def by_hour(db: Session, user, now: datetime) -> dict:
    """M1 chance per study hour; without M1, the real % of finished sessions per hour."""
    profile = attention_service.attention_profile(db, user, now)
    if profile["source"] == "m1_model":
        return {"source": "m1_model", "peak_hours": profile["peak_hours"], "low_hours": profile["low_hours"],
                "hours": [{"hour": h["hour"], "value": round(100 * h["chance"])} for h in profile["hourly"]]}
    rows = attention_service.usable_sessions(db, user)
    hours = defaultdict(lambda: [0, 0])
    for s in rows:
        h = (s.started_at + SL_OFFSET).hour
        hours[h][0] += int(s.completed)
        hours[h][1] += 1
    return {"source": "history" if rows else "none", "peak_hours": [], "low_hours": [],
            "hours": [{"hour": h, "value": round(100 * f / n)} for h, (f, n) in sorted(hours.items())]}


def best_load(db: Session, user) -> dict | None:
    """Effort level with the highest share of finished sessions (needs a few sessions of each)."""
    rows = attention_service.usable_sessions(db, user)
    stats = defaultdict(lambda: [0, 0])
    for s in rows:
        if s.task_load:
            stats[s.task_load][0] += int(s.completed)
            stats[s.task_load][1] += 1
    rates = {load: f / n for load, (f, n) in stats.items() if n >= MIN_PER_LOAD}
    if not rates:
        return None
    load = max(rates, key=rates.get)
    return {"load": load, "finished_pct": round(100 * rates[load]),
            "all": {k: round(100 * v) for k, v in rates.items()}}


def duration(db: Session, user) -> dict:
    """Recent finished tasks with logged time: estimate vs actual (+ M3), and the usual over-run."""
    rows = (db.query(Task).filter(Task.user_id == user.id, Task.status == "done",
                                  Task.actual_minutes >= MIN_LOGGED, Task.completed_at.isnot(None))
              .order_by(Task.completed_at.desc()).limit(30).all())
    ratios = sorted(t.actual_minutes / t.estimated_minutes for t in rows)
    usual = ratios[len(ratios) // 2] if ratios else None
    return {"tasks_used": len(rows), "usual_over_run": round(usual, 2) if usual else None,
            "recent": [{"title": t.title, "estimated": t.estimated_minutes, "actual": t.actual_minutes,
                        "predicted": t.predicted_minutes} for t in rows[:RECENT_TASKS]]}


def stress(db: Session, user, today) -> list[dict]:
    """Component 4's latest risk score per day (0-100) for the last 7 days - only shared, accepted signals."""
    since = datetime.combine(today - timedelta(days=DAYS), datetime.min.time())
    rows = (db.query(SignalEvent)
              .filter(SignalEvent.signal_type == "RISK", SignalEvent.student_id == user.research_id,
                      SignalEvent.status == "ACCEPTED", SignalEvent.received_at >= since)
              .order_by(SignalEvent.received_at).all())
    latest = {study_day(r.received_at): r.payload.get("risk_score") for r in rows}
    out = []
    for i in range(DAYS):
        day = today - timedelta(days=DAYS - 1 - i)
        score = latest.get(day)
        out.append({"label": day.strftime("%a"), "value": round(100 * score) if score is not None else None})
    return out
