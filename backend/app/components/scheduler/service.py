from datetime import datetime, timedelta
from types import SimpleNamespace

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.components.scheduler.models import (
    AdaptationChange, AdaptationProposal, BlockStatus, BlockType, ChangeDecision, ChangeType,
    ExperimentAssignment, FocusSession, ProposalStatus, ScheduleBlock, ScheduleMode, Subtask,
    Task, TaskStatus, XPEvent,
)
from app.components.scheduler.engine import constraint_scheduler, attention_model, stress_rules, gamification
from app.shared.integration.models import SignalEvent

# The engine still speaks the old words; map the new load levels to them
_ENGINE_LOAD = {"heavy": "heavy", "medium": "medium", "light": "low"}


def latest_risk_signal(db: Session, research_id: str) -> SignalEvent | None:
    return (db.query(SignalEvent)
              .filter_by(signal_type="RISK", student_id=research_id, status="ACCEPTED")
              .order_by(SignalEvent.received_at.desc()).first())


def latest_risk_level(db: Session, research_id: str) -> str | None:
    ev = latest_risk_signal(db, research_id)
    return ev.payload["risk_level"] if ev else None


def user_mode(db: Session, user) -> ScheduleMode:
    """Research pilot: static or adaptive. Students without an assignment get adaptive."""
    a = db.query(ExperimentAssignment).filter_by(user_id=user.id).first()
    return a.mode if a else ScheduleMode.ADAPTIVE


def _work_items(db: Session, user):
    """Open work to schedule: each open subtask, or the whole task when it has no subtasks.

    Returned as simple objects with the fields the engine expects
    (id, deadline, priority, estimated_minutes, cognitive_load, status).
    """
    items = []
    tasks = db.query(Task).filter(Task.user_id == user.id, Task.status != TaskStatus.DONE).all()
    for t in tasks:
        open_subs = [s for s in t.subtasks if s.status != TaskStatus.DONE]
        if open_subs:
            for s in open_subs:
                items.append(SimpleNamespace(
                    id=s.id, subtask_id=s.id, title=f"{t.title}: {s.title}", deadline=t.deadline,
                    priority=t.priority, estimated_minutes=s.estimated_minutes,
                    cognitive_load=_ENGINE_LOAD[s.load.value], status="pending"))
        elif not t.subtasks:
            items.append(SimpleNamespace(
                id=t.id, subtask_id=None, title=t.title, deadline=t.deadline, priority=t.priority,
                estimated_minutes=t.estimated_minutes, cognitive_load="medium", status="pending"))
    return items


def build_plan(db: Session, user, adaptive: bool | None = None):
    """Plan open work into ScheduleBlocks. adaptive=None -> use the participant's assigned mode."""
    mode = user_mode(db, user) if adaptive is None else (ScheduleMode.ADAPTIVE if adaptive else ScheduleMode.STATIC)
    now = datetime.utcnow()
    items = _work_items(db, user)
    sessions = db.query(FocusSession).filter_by(user_id=user.id).all()
    peaks = attention_model.peak_windows(sessions) if mode == ScheduleMode.ADAPTIVE else None
    plan = constraint_scheduler.schedule(items, now, peaks)

    # Replace future planned focus blocks with the new plan
    (db.query(ScheduleBlock)
       .filter(ScheduleBlock.user_id == user.id, ScheduleBlock.status == BlockStatus.PLANNED,
               ScheduleBlock.block_type == BlockType.FOCUS, ScheduleBlock.start_at >= now)
       .delete(synchronize_session=False))
    out = []
    for it in items:
        start = plan.get(it.id)
        if start and it.subtask_id:
            db.add(ScheduleBlock(user_id=user.id, subtask_id=it.subtask_id, start_at=start,
                                 end_at=start + timedelta(minutes=it.estimated_minutes),
                                 block_type=BlockType.FOCUS, mode=mode))
        out.append({"id": it.id, "title": it.title, "start": start,
                    "load": it.cognitive_load, "deadline": it.deadline})
    db.commit()
    return {"mode": mode.value,
            "peak_hours": sorted(peaks or []),
            "pomodoro": attention_model.adaptive_pomodoro(attention_model.attention_capacity(sessions)),
            "tasks": out}


def propose_adaptation(db: Session, user) -> dict:
    """Stress-based SUGGESTION. Saved as one proposal + one row per change (student decides)."""
    signal = latest_risk_signal(db, user.research_id)
    risk = signal.payload["risk_level"] if signal else None
    now = datetime.utcnow()
    blocks = (db.query(ScheduleBlock)
                .filter(ScheduleBlock.user_id == user.id, ScheduleBlock.status == BlockStatus.PLANNED,
                        ScheduleBlock.block_type == BlockType.FOCUS, ScheduleBlock.start_at >= now)
                .all())
    # Engine view of each planned block (deadline/priority/load come from its subtask's task)
    view, by_id = [], {}
    for b in blocks:
        if not b.subtask_id:
            continue
        s = db.get(Subtask, b.subtask_id)
        view.append(SimpleNamespace(id=b.id, status="pending", deadline=s.task.deadline,
                                    priority=s.task.priority, cognitive_load=_ENGINE_LOAD[s.load.value]))
        by_id[b.id] = b
    result = stress_rules.propose_changes(view, risk, now)

    proposal = AdaptationProposal(user_id=user.id, risk_signal_id=signal.event_id if signal else None)
    action_map = {"split": ChangeType.SPLIT, "defer_1_day": ChangeType.DEFER, "insert_recovery_block": ChangeType.RECOVERY}
    for c in result["changes"]:
        ctype = action_map[c["action"]]
        b = by_id.get(c["task_id"])
        new_start = new_end = None
        if ctype == ChangeType.DEFER and b:
            new_start, new_end = b.start_at + timedelta(days=1), b.end_at + timedelta(days=1)
        elif ctype == ChangeType.RECOVERY:
            new_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            new_end = new_start + timedelta(minutes=c.get("minutes", 30))
        proposal.changes.append(AdaptationChange(
            schedule_block_id=b.id if b else None, change_type=ctype,
            old_start_at=b.start_at if b else None, old_end_at=b.end_at if b else None,
            new_start_at=new_start, new_end_at=new_end, reason=c.get("why", "Recovery break")))
    if proposal.changes:
        db.add(proposal)
        db.commit()
    return {"proposal_id": proposal.id if proposal.changes else None, "reason": result["reason"],
            "changes": [{"id": ch.id, "type": ch.change_type.value, "reason": ch.reason,
                         "new_start_at": ch.new_start_at} for ch in proposal.changes]}


def decide_proposal(db: Session, proposal: AdaptationProposal, decision: str) -> None:
    """Whole-proposal decision: accepted / rejected / restored."""
    if decision == "accepted":
        proposal.status = ProposalStatus.ACCEPTED
        for ch in proposal.changes:
            ch.decision = ChangeDecision.ACCEPTED
    elif decision == "rejected":
        proposal.status = ProposalStatus.REJECTED
        for ch in proposal.changes:
            ch.decision = ChangeDecision.REJECTED
    elif decision == "restored":
        proposal.status = ProposalStatus.RESTORED
    proposal.decided_at = datetime.utcnow()
    db.commit()


def total_xp(db: Session, user) -> int:
    return db.query(func.sum(XPEvent.xp_amount)).filter_by(user_id=user.id).scalar() or 0


def complete_task(db: Session, user, task: Task) -> dict:
    task.status = TaskStatus.DONE
    db.commit()
    # event_key is UNIQUE: completing the same task twice never gives XP twice
    try:
        # XP follows the hardest step of the task (no steps -> medium)
        loads = {s.load.value for s in task.subtasks}
        load = "heavy" if "heavy" in loads else "low" if loads == {"light"} else "medium"
        db.add(XPEvent(user_id=user.id, event_key=f"task-done:{task.id}",
                       xp_amount=gamification.xp_for_task(load), reason=f"Completed {task.title}"))
        db.commit()
    except IntegrityError:
        db.rollback()
    total = total_xp(db, user)
    return {"total_xp": total, "level": gamification.level_from_xp(total)}
