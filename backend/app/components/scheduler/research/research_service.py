"""
Component 3 - PILOT STUDY: the researcher assigns each participant's experiment mode (proposal 3.1).

    static          = baseline scheduler (no attention learning, no stress adaptation)
    adaptive        = attention learning + stress-responsive adaptation
    attention_only  = ablation: attention learning only

Who is a researcher?  Emails listed in SCHEDULER_RESEARCHER_EMAILS in backend/.env (comma-separated).
Everyone else gets 403 - students can never change their mode.

Privacy (NFR-05): participants are shown by research_id only - never name or email -
and only students who gave research consent are listed.
"""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.components.scheduler.models import FocusSession, SchedulerSettings, Task
from app.components.scheduler.settings_service import DEFAULTS
from app.components.scheduler.tasks.task_service import audit
from app.shared.users.models import User


def researcher_emails() -> set[str]:
    return {e.strip().lower() for e in settings.SCHEDULER_RESEARCHER_EMAILS.split(",") if e.strip()}


def is_researcher(user) -> bool:
    return user.email.lower() in researcher_emails()


def require_researcher(user) -> None:
    if not is_researcher(user):
        raise HTTPException(403, "Only researchers can see or change pilot modes")


def participants(db: Session, user) -> dict:
    """Consenting students with their mode, group and a little activity (no names)."""
    require_researcher(user)
    students = db.query(User).filter(User.research_consent.is_(True)).order_by(User.created_at).all()
    ids = [s.id for s in students]
    settings = {r.user_id: r for r in db.query(SchedulerSettings).filter(SchedulerSettings.user_id.in_(ids))}
    sessions = dict(db.query(FocusSession.user_id, func.count())
                      .filter(FocusSession.user_id.in_(ids), FocusSession.completed.is_(True))
                      .group_by(FocusSession.user_id).all())
    done = dict(db.query(Task.user_id, func.count())
                  .filter(Task.user_id.in_(ids), Task.status == "done")
                  .group_by(Task.user_id).all())
    last = dict(db.query(FocusSession.user_id, func.max(FocusSession.started_at))
                  .filter(FocusSession.user_id.in_(ids)).group_by(FocusSession.user_id).all())
    rows = [{"research_id": s.research_id,
             "mode": settings[s.id].mode if s.id in settings else DEFAULTS["mode"],
             "pilot_group": settings[s.id].pilot_group if s.id in settings else None,
             "completed_sessions": sessions.get(s.id, 0), "tasks_done": done.get(s.id, 0),
             "last_active": last.get(s.id)} for s in students]
    without_consent = db.query(User).filter(User.research_consent.is_(False)).count()
    return {"participants": rows, "without_consent": without_consent}


def set_mode(db: Session, user, research_id: str, mode: str | None, pilot_group: str | None,
             now: datetime | None = None) -> dict:
    """Change one participant's experiment mode / counterbalancing group. Every change is audited."""
    require_researcher(user)
    student = db.query(User).filter(User.research_id == research_id, User.research_consent.is_(True)).first()
    if student is None:
        raise HTTPException(404, "No consenting participant with this research ID")
    row = db.get(SchedulerSettings, student.id)
    if row is None:
        row = SchedulerSettings(user_id=student.id, **DEFAULTS)
        db.add(row)
    old = {"mode": row.mode, "pilot_group": row.pilot_group}
    if mode is not None:
        row.mode = mode
    if pilot_group is not None:
        row.pilot_group = pilot_group or None                      # "" clears the group
    audit(db, student.id, "pilot_mode_changed", by_researcher=True, old=old,
          new={"mode": row.mode, "pilot_group": row.pilot_group})
    db.commit()
    return {"research_id": research_id, "mode": row.mode, "pilot_group": row.pilot_group}


# ---------------------------------------------------------------------------
# Research Dashboard overview (all consenting participants together - research IDs only)
# ---------------------------------------------------------------------------
OVERVIEW_DAYS = 7
OUTCOME_DAYS = 30
EFFECT_DAYS = 7               # compare the risk score in the 7 days after an accepted lighter plan


def overview(db: Session, user, now: datetime | None = None) -> dict:
    """KPIs, cohort charts and a participant table from real data (no camera, no sample numbers)."""
    from datetime import timedelta
    from statistics import fmean
    from app.components.scheduler.models import ScheduleChange
    from app.components.scheduler.rewards.progress_service import study_day
    from app.components.scheduler.stress.stress_service import STRESS_TRIGGER
    from app.shared.integration.models import SignalEvent

    require_researcher(user)
    now = now or datetime.utcnow()
    students = db.query(User).filter(User.research_consent.is_(True)).all()
    ids = [s.id for s in students]
    research_ids = [s.research_id for s in students]
    week_ago, month_ago = now - timedelta(days=OVERVIEW_DAYS), now - timedelta(days=OUTCOME_DAYS)

    sessions = db.query(FocusSession).filter(FocusSession.user_id.in_(ids), FocusSession.started_at >= month_ago).all()
    started = [s for s in sessions if s.ended_at and s.is_valid and not s.was_missed]
    tasks = db.query(Task).filter(Task.user_id.in_(ids)).all()
    signals = (db.query(SignalEvent).filter(SignalEvent.signal_type == "RISK", SignalEvent.status == "ACCEPTED",
                                            SignalEvent.student_id.in_(research_ids))
                 .order_by(SignalEvent.received_at).all())
    proposals = (db.query(ScheduleChange).filter(ScheduleChange.user_id.in_(ids),
                                                 ScheduleChange.trigger == STRESS_TRIGGER).all())

    def pct(part, whole):
        return round(100 * part / whole) if whole else None

    # --- KPIs ---
    planned = [t for t in tasks if t.scheduled_start or t.status == "done"]
    latest = {e.student_id: e.payload.get("risk_score") for e in signals}          # last one wins (sorted)
    kpis = {
        "participants": len(students),
        "active_7d": len({s.user_id for s in started if s.started_at >= week_ago}),
        "task_completion_pct": pct(sum(t.status == "done" for t in planned), len(planned)),
        "focus_completion_pct": pct(sum(s.completed for s in started), len(started)),
        "avg_stress_pct": round(100 * fmean(latest.values())) if latest else None,
    }

    # --- charts ---
    today = study_day(now)
    days = [today - timedelta(days=OVERVIEW_DAYS - 1 - i) for i in range(OVERVIEW_DAYS)]
    stress_by_day = {d: [] for d in days}
    done_by_day = {d: 0 for d in days}
    for e in signals:
        if study_day(e.received_at) in stress_by_day:
            stress_by_day[study_day(e.received_at)].append(e.payload.get("risk_score", 0))
    for t in tasks:
        if t.status == "done" and t.completed_at and study_day(t.completed_at) in done_by_day:
            done_by_day[study_day(t.completed_at)] += 1
    outcomes = {
        "Finished": sum(s.completed for s in started),
        "Stopped early": sum(not s.completed for s in started),
        "Auto-closed": sum(bool(s.auto_closed) for s in sessions),
        "Missed": sum(bool(s.was_missed) for s in sessions),
    }
    weeks = []
    for w in range(4, 0, -1):
        start, end = now - timedelta(days=7 * w), now - timedelta(days=7 * (w - 1))
        made = [p for p in proposals if start <= p.created_at < end]
        weeks.append({"label": "This wk" if w == 1 else f"-{w - 1} wk", "proposed": len(made),
                      "accepted": sum(p.decision in ("accepted", "edited") for p in made)})

    # --- intervention effect: next risk score after an accepted lighter plan vs the one that caused it ---
    by_event = {e.event_id: e for e in signals}
    changes = []
    for p in proposals:
        before = by_event.get(p.signal_event_id)
        if p.decision not in ("accepted", "edited") or before is None or not before.payload.get("risk_score"):
            continue
        after = next((e for e in signals if e.student_id == before.student_id
                      and p.created_at < e.received_at <= p.created_at + timedelta(days=EFFECT_DAYS)), None)
        if after:
            changes.append((after.payload["risk_score"] - before.payload["risk_score"]) / before.payload["risk_score"])
    effect = {"cases": len(changes), "avg_change_pct": round(100 * fmean(changes)) if changes else None}

    # --- participant table ---
    trend = {e.student_id: e.payload.get("trend") for e in signals}
    last_active = {}
    for s in started:
        last_active[s.user_id] = max(last_active.get(s.user_id, s.started_at), s.started_at)
    table = []
    for s in students:
        mine = [x for x in started if x.user_id == s.id]
        table.append({"research_id": s.research_id,
                      "tasks_done": sum(t.user_id == s.id and t.status == "done" for t in tasks),
                      "focus_completion_pct": pct(sum(x.completed for x in mine), len(mine)),
                      "stress_trend": trend.get(s.research_id), "last_active": last_active.get(s.id)})

    return {"kpis": kpis,
            "stress_by_day": [{"label": d.strftime("%a"), "value": round(100 * fmean(v)) if v else None}
                              for d, v in stress_by_day.items()],
            "tasks_done_by_day": [{"label": d.strftime("%a"), "value": n} for d, n in done_by_day.items()],
            "session_outcomes": outcomes, "adjustments_by_week": weeks, "intervention_effect": effect,
            "participants": table}
