"""
Component 3 - student ratings for the evaluation (proposal Table 3).

    stress proposal  "How helpful was this suggestion?" 1-5   -> deferral appropriateness
    focus timer      "Was the suggested length useful?" 1-5   -> adaptive timer acceptance

Saved in the audit log (no new tables): one rating per proposal / session, a second try gets 409.
The research export reads them back from there.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.components.scheduler.models import FocusSession, SchedulerAuditLog
from app.components.scheduler.stress_service import get_own_proposal
from app.components.scheduler.task_service import audit

PROPOSAL_RATED = "stress_proposal_rated"
TIMER_RATED = "timer_rated"


def already_rated(db: Session, user, event: str, key: str, value: str) -> bool:
    rows = db.query(SchedulerAuditLog.details).filter_by(user_id=user.id, event_type=event).all()
    return any(d.get(key) == value for (d,) in rows)


def rate_proposal(db: Session, user, change_id: str, rating: int) -> dict:
    change = get_own_proposal(db, user, change_id)
    if change.decision == "proposed":
        raise HTTPException(409, "Decide on the suggestion first")
    if already_rated(db, user, PROPOSAL_RATED, "change_id", change.id):
        raise HTTPException(409, "You already rated this suggestion")
    audit(db, user.id, PROPOSAL_RATED, change_id=change.id, rating=rating, decision=change.decision)
    db.commit()
    return {"id": change.id, "rating": rating}


def rate_timer(db: Session, user, session_id: str, rating: int) -> dict:
    session = db.get(FocusSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(404, "Session not found")
    if session.ended_at is None:
        raise HTTPException(409, "End the session first")
    if already_rated(db, user, TIMER_RATED, "session_id", session.id):
        raise HTTPException(409, "You already rated this timer")
    audit(db, user.id, TIMER_RATED, session_id=session.id, rating=rating, planned=session.planned_minutes,
          recommended=session.timer_recommended, overridden=session.timer_overridden)
    db.commit()
    return {"id": session.id, "rating": rating}
