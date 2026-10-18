from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.components.scheduler.models import Task, RewardEvent
from app.components.scheduler.engine import gamification
from app.shared.integration.models import SignalEvent


def latest_risk_level(db: Session, research_id: str) -> str | None:
    ev = (db.query(SignalEvent)
            .filter_by(signal_type="RISK", student_id=research_id, status="ACCEPTED")
            .order_by(SignalEvent.received_at.desc()).first())
    return ev.payload["risk_level"] if ev else None


def complete_task(db: Session, user, task: Task) -> dict:
    task.status = "done"
    task.completed_at = task.completed_at or datetime.utcnow()
    key = f"task-{task.id}"
    if not db.get(RewardEvent, key):
        db.add(RewardEvent(id=key, user_id=user.id, kind="xp", amount=gamification.xp_for_task(task.cognitive_load)))
    db.commit()
    total = db.query(func.sum(RewardEvent.amount)).filter_by(user_id=user.id).scalar() or 0
    return {"total_xp": total, "level": gamification.level_from_xp(total)}
