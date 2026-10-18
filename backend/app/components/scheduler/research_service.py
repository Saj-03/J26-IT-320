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
from app.components.scheduler.task_service import audit
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
