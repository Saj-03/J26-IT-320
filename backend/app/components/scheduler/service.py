from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.components.scheduler.models import Task, FocusSession, RewardEvent
from app.components.scheduler.engine import constraint_scheduler, attention_model, stress_rules, gamification
from app.shared.integration.models import SignalEvent


def latest_risk_level(db: Session, research_id: str) -> str | None:
    ev = (db.query(SignalEvent)
            .filter_by(signal_type="RISK", student_id=research_id, status="ACCEPTED")
            .order_by(SignalEvent.received_at.desc()).first())
    return ev.payload["risk_level"] if ev else None


def build_plan(db: Session, user, adaptive: bool = True):
    tasks = db.query(Task).filter_by(user_id=user.id, status="pending").all()
    sessions = db.query(FocusSession).filter_by(user_id=user.id).all()
    peaks = attention_model.peak_windows(sessions) if adaptive else None
    plan = constraint_scheduler.schedule(tasks, datetime.utcnow(), peaks)
    for t in tasks:
        t.scheduled_start = plan.get(t.id)
    db.commit()
    return {"mode": "adaptive" if adaptive else "static-baseline",
            "peak_hours": sorted(peaks or []),
            "pomodoro": attention_model.adaptive_pomodoro(attention_model.attention_capacity(sessions)),
            "tasks": [{"id": t.id, "title": t.title, "start": t.scheduled_start,
                       "load": t.cognitive_load, "deadline": t.deadline} for t in tasks]}


def complete_task(db: Session, user, task: Task) -> dict:
    task.status = "done"
    key = f"task-{task.id}"
    if not db.get(RewardEvent, key):
        db.add(RewardEvent(id=key, user_id=user.id, kind="xp", amount=gamification.xp_for_task(task.cognitive_load)))
    db.commit()
    total = db.query(func.sum(RewardEvent.amount)).filter_by(user_id=user.id).scalar() or 0
    return {"total_xp": total, "level": gamification.level_from_xp(total)}
