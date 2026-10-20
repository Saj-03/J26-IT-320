"""
Component 3 - STRESS STATUS (Module F, step F1): read Component 4's wellbeing signal safely.

C4 writes a RiskSignal into the shared signal_events table (signal_type "RISK")
every time the student journals / taps a mood. Here we decide what the scheduler
should do with it - nothing is changed yet (proposals come in F3).

Decision order (first match wins):
  1. student turned stress adaptation off      -> "off"   (student stays in control)
  2. experiment mode is not "adaptive"         -> "off"   (static / attention_only groups get no stress changes)
  3. no signal (or student stopped sharing)    -> "none"  (normal schedule)
  4. signal older than 24 h                    -> "none"  (stale = fall back to normal, proposal rule)
  5. risk LOW                                  -> "none"
  6. already proposed for this level in 24 h   -> "already_proposed"  (C4 sends many signals - no spam)
  7. MODERATE / HIGH                           -> "propose_changes"

GET only reads - no audit rows here. Proposals (F3) are audited when they are made.

SAFETY (step F2): before any change is suggested, every task is checked.
A task is LOCKED (never changed for stress) when it is:
  finished / cancelled / missed, being worked on now, marked fixed by the student,
  past its deadline, due within 48 h, top priority (5), or a parent task with steps
  (its steps are checked instead). Everything else is CHANGEABLE.

PROPOSALS (step F3): only CHANGEABLE tasks, nothing is applied until the student accepts (F4).
  MODERATE -> move up to 2 lighter tasks 2 days later
  HIGH     -> split heavy tasks into 25-min pieces, move up to 3 lighter tasks 3 days later,
              add a 30-min rest block
  A task is only moved if there is still at least 1 day + its own time left before the deadline.

DECISIONS (step F4): the student accepts all, keeps only some (edited), or rejects.
  Each kept change is safety-checked AGAIN (things may have changed since the proposal).
  Applied changes can be undone ("restore") - moved tasks go back, created pieces/breaks are removed.
"""
import hashlib
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings as app_settings
from app.components.scheduler.tasks.commitment_service import SL_OFFSET
from app.components.scheduler.models import Commitment, FocusSession, ScheduleChange, SchedulerAuditLog, Task
from app.components.scheduler.settings_service import get_settings
from app.components.scheduler.tasks.task_service import audit, drop_planned_pieces
from app.shared.integration.models import SignalEvent

SIGNAL_MAX_AGE = timedelta(hours=app_settings.RISK_SIGNAL_MAX_AGE_HOURS)   # same rule as the integration validator
URGENT_WINDOW = timedelta(hours=app_settings.URGENT_DEADLINE_WINDOW_HOURS)  # due within 48 h = never moved
TOP_PRIORITY = 5
PROPOSAL_COOLDOWN = timedelta(hours=24)
LEVEL_RANK = {"LOW": 0, "MODERATE": 1, "HIGH": 2}
STRESS_TRIGGER = "wellbeing_signal"     # ScheduleChange.trigger for stress proposals


def latest_signal(db: Session, user) -> SignalEvent | None:
    """Newest accepted RiskSignal from C4 for this student (C4 uses the pseudonymous research id)."""
    return (db.query(SignalEvent)
              .filter(SignalEvent.signal_type == "RISK",
                      SignalEvent.student_id == user.research_id,
                      SignalEvent.status == "ACCEPTED")
              .order_by(SignalEvent.received_at.desc())
              .first())


def last_stress_proposal(db: Session, user, since: datetime) -> ScheduleChange | None:
    """Newest stress proposal made after `since`."""
    return (db.query(ScheduleChange)
              .filter(ScheduleChange.user_id == user.id,
                      ScheduleChange.trigger == STRESS_TRIGGER,
                      ScheduleChange.created_at >= since)
              .order_by(ScheduleChange.created_at.desc())
              .first())


def proposed_level(db: Session, change: ScheduleChange) -> str:
    """Risk level of the signal that caused an earlier proposal (LOW if unknown)."""
    event = db.get(SignalEvent, change.signal_event_id) if change.signal_event_id else None
    return event.payload.get("risk_level", "LOW") if event else "LOW"


def stress_status(db: Session, user, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    prefs = get_settings(db, user)
    signal = latest_signal(db, user)
    payload = signal.payload if signal else {}
    level = payload.get("risk_level")

    status = {
        "level": level,
        "risk_score": payload.get("risk_score"),
        "trend": payload.get("trend"),
        "signal_event_id": signal.event_id if signal else None,
        "signal_received_at": signal.received_at if signal else None,
        "fresh": bool(signal) and now - signal.received_at <= SIGNAL_MAX_AGE,
        "adaptation_on": prefs["stress_adaptation_enabled"],
        "mode": prefs["mode"],
    }

    def decide(action: str, reason: str) -> dict:
        return {**status, "action": action, "reason": reason}

    if not prefs["stress_adaptation_enabled"]:
        return decide("off", "You turned stress-based changes off - your schedule is never changed for stress.")
    if prefs["mode"] != "adaptive":
        return decide("off", "This study phase uses a fixed schedule - no stress-based changes.")
    if signal is None:
        return decide("none", "No wellbeing signal shared - your normal schedule is used.")
    if not status["fresh"]:
        return decide("none", "The last wellbeing signal is more than a day old - your normal schedule is used.")
    if level == "LOW":
        return decide("none", "Your wellbeing looks steady - your normal schedule is used.")

    earlier = last_stress_proposal(db, user, now - PROPOSAL_COOLDOWN)
    if earlier and LEVEL_RANK[level] <= LEVEL_RANK[proposed_level(db, earlier)]:
        return decide("already_proposed", "We already suggested lighter changes today.")
    return decide("propose_changes", f"Your wellbeing signal is {level.lower()} - we can suggest a lighter plan.")


# ---------------------------------------------------------------------------
# F2 - Safety: which tasks may be changed for stress?
# ---------------------------------------------------------------------------
def time_left(deadline: datetime, now: datetime) -> str:
    """'due in 20 hours' / 'due in 3 days' - for the plain-language reasons."""
    hours = (deadline - now).total_seconds() / 3600
    return f"due in {round(hours)} hours" if hours < 48 else f"due in {round(hours / 24)} days"


def lock_reason(task: Task, now: datetime, has_steps: bool = False, focusing: bool = False) -> str | None:
    """Why this task must NOT be changed for stress, or None if it is safe to change.
    The first matching rule is the reason shown to the student."""
    if task.status in ("done", "cancelled", "missed"):
        return f"already {task.status}"
    if focusing:                     # a focus session on it is running right now ("in_progress" alone only
        return "you are working on it now"   # means it was started once - that task can still be eased)
    if not task.is_flexible:
        return "you marked it as fixed"
    if task.deadline <= now:
        return "its deadline has passed"
    if task.deadline - now <= URGENT_WINDOW:
        return f"{time_left(task.deadline, now)} - too close to move"
    if task.priority >= TOP_PRIORITY:
        return "top priority"
    if has_steps:
        return "its steps are checked one by one"
    return None


def focusing_now(db: Session, user) -> set[str]:
    """Tasks with a focus session that has not ended yet."""
    return {tid for (tid,) in db.query(FocusSession.task_id).filter(FocusSession.user_id == user.id,
                                                                    FocusSession.ended_at.is_(None),
                                                                    FocusSession.task_id.isnot(None))}


def task_safety(db: Session, user, now: datetime | None = None) -> dict:
    """Split the student's tasks into changeable and locked, each with a reason (earliest deadline first)."""
    now = now or datetime.utcnow()
    tasks = db.query(Task).filter(Task.user_id == user.id).order_by(Task.deadline).all()
    parents = {t.parent_id for t in tasks if t.parent_id}
    focusing = focusing_now(db, user)

    changeable, locked = [], []
    for t in tasks:
        reason = lock_reason(t, now, has_steps=t.id in parents, focusing=t.id in focusing)
        row = {"task_id": t.id, "title": t.title, "deadline": t.deadline, "priority": t.priority,
               "cognitive_load": t.cognitive_load, "reason": reason or f"flexible, {time_left(t.deadline, now)}"}
        (locked if reason else changeable).append(row)
    return {"changeable": changeable, "locked": locked}


# ---------------------------------------------------------------------------
# F3 - Proposals: a lighter plan, made only from CHANGEABLE tasks
# ---------------------------------------------------------------------------
PLAN_BY_LEVEL = {          # what each level may suggest
    "MODERATE": {"move": 2, "move_days": 2, "split": False, "rest_minutes": 0},
    "HIGH":     {"move": 3, "move_days": 3, "split": True,  "rest_minutes": 30},
}
SPLIT_PIECE = 25                       # minutes per piece (one Pomodoro)
MOVE_BUFFER = timedelta(days=1)        # a moved task still needs 1 day + its own time before the deadline


def split_minutes(total: int, piece: int = SPLIT_PIECE) -> list[int]:
    """70 -> [25, 25, 20]"""
    return [min(piece, total - start) for start in range(0, total, piece)]


def can_move(task: Task, new_start: datetime) -> bool:
    return task.deadline - new_start >= MOVE_BUFFER + timedelta(minutes=task.estimated_minutes)


def move_target(now: datetime, days: int, day_start_hour: int) -> datetime:
    """'3 days later' = the START of that study day (e.g. Thu 08:00 Sri Lanka time), not 'now + 72 h' (23:30)."""
    local_day = (now + SL_OFFSET + timedelta(days=days)).date()
    return datetime.combine(local_day, datetime.min.time()).replace(hour=day_start_hour) - SL_OFFSET


def build_changes(tasks: list[Task], level: str, now: datetime, day_start_hour: int = 8) -> list[dict]:
    """The list of suggested changes (nothing is saved or applied here)."""
    plan = PLAN_BY_LEVEL[level]
    changes = []

    # 1. HIGH: big heavy tasks -> 25-min pieces (steps can't be split again)
    split_ids = set()
    if plan["split"]:
        for t in tasks:
            if t.cognitive_load == "heavy" and t.parent_id is None and t.estimated_minutes > SPLIT_PIECE:
                pieces = split_minutes(t.estimated_minutes)
                split_ids.add(t.id)
                changes.append({"action": "split", "task_id": t.id, "title": t.title, "pieces": pieces,
                                "reason": f"Heavy task - {len(pieces)} short pieces are easier on a stressful day."})

    # 2. Move the lightest tasks a few days later: lowest priority first, then the latest deadline
    new_start = move_target(now, plan["move_days"], day_start_hour)
    candidates = sorted((t for t in tasks if t.id not in split_ids),
                        key=lambda t: (t.priority, -t.deadline.timestamp()))
    moved = 0
    for t in candidates:
        if moved == plan["move"]:
            break
        if not can_move(t, new_start):
            continue
        changes.append({"action": "move", "task_id": t.id, "title": t.title,
                        "from": t.scheduled_start.isoformat() if t.scheduled_start else None,
                        "to": new_start.isoformat(),
                        "reason": f"Priority {t.priority}, {time_left(t.deadline, now)} - there is still time later."})
        moved += 1

    # 3. HIGH: a short rest block
    if plan["rest_minutes"]:
        changes.append({"action": "rest", "task_id": None, "title": "Rest break", "minutes": plan["rest_minutes"],
                        "reason": "A short break with no study helps you recover."})
    return changes


def summary_reason(level: str, changes: list[dict]) -> str:
    """One sentence for the top of the proposal."""
    n = {a: sum(c["action"] == a for c in changes) for a in ("move", "split", "rest")}
    parts = []
    if n["move"]:
        parts.append(f"move {n['move']} lighter task{'s' if n['move'] > 1 else ''} a little later")
    if n["split"]:
        parts.append(f"split {n['split']} heavy task{'s' if n['split'] > 1 else ''} into short pieces")
    if n["rest"]:
        parts.append("add a short rest break")
    return f"Your wellbeing signal is {level.lower()}. We suggest to " + ", ".join(parts) + ". Nothing changes until you accept."


def propose(db: Session, user, now: datetime | None = None, automatic: bool = False) -> ScheduleChange:
    """Make a stress proposal (saved as 'proposed'). 409 if no proposal is needed or nothing is safe to change."""
    now = now or datetime.utcnow()
    status = stress_status(db, user, now)
    if status["action"] != "propose_changes":
        raise HTTPException(409, status["reason"])

    ids = [row["task_id"] for row in task_safety(db, user, now)["changeable"]]
    tasks = db.query(Task).filter(Task.id.in_(ids)).all() if ids else []
    changes = build_changes(tasks, status["level"], now, get_settings(db, user)["day_start_hour"])
    if not changes:                                    # MODERATE with nothing safe to move
        raise HTTPException(409, "None of your tasks can be changed safely right now - your plan stays as it is.")

    touched = {c["task_id"] for c in changes if c["task_id"]}
    change = ScheduleChange(
        user_id=user.id, trigger=STRESS_TRIGGER, signal_event_id=status["signal_event_id"],
        reason=summary_reason(status["level"], changes), change_set=changes,
        # snapshot for "restore" (F4)
        previous_plan=[{"task_id": t.id, "scheduled_start": t.scheduled_start.isoformat() if t.scheduled_start else None,
                        "estimated_minutes": t.estimated_minutes} for t in tasks if t.id in touched],
        created_at=now,
    )
    db.add(change)
    db.flush()
    audit(db, user.id, "stress_proposal_created", change_id=change.id, level=status["level"],
          signal_event_id=status["signal_event_id"], actions=[c["action"] for c in changes], automatic=automatic,
          # evaluation "risk-update handling": time from the valid C4 update to the proposed change
          seconds_after_signal=round((now - status["signal_received_at"]).total_seconds()))
    db.commit()
    return change


def lock_key(user_id: str) -> int:
    """A stable 63-bit number for this student's proposal lock."""
    return int(hashlib.sha256(f"stress-proposal:{user_id}".encode()).hexdigest()[:15], 16)


def auto_propose(db: Session, user, now: datetime | None = None) -> ScheduleChange | None:
    """
    Proposal 4.3: when a valid ELEVATED risk update arrives, the system makes the proposed change set by itself
    (the student does not have to ask). Nothing is applied - the student still accepts / edits / rejects.
    C4 writes its signal straight into the shared table, so C3 checks when the student's app checks in
    (notifications every 2 minutes, the stress page). Once per signal: the 24 h cooldown stops repeats, and
    "nothing can be changed safely" is logged once for that signal.
    """
    now = now or datetime.utcnow()
    if stress_status(db, user, now)["action"] != "propose_changes":
        return None
    # Two requests at the same moment (the schedule page asks for status AND proposals together) both saw
    # "no proposal yet" and both made one. A per-student database lock lets only one of them make it; the
    # other waits, checks again and finds the proposal. (Postgres only; SQLite tests run one at a time.)
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key(user.id)})
    status = stress_status(db, user, now)
    if status["action"] != "propose_changes":
        db.commit()                                      # releases the lock
        return None
    tried =(db.query(SchedulerAuditLog.details)
               .filter(SchedulerAuditLog.user_id == user.id, SchedulerAuditLog.event_type == "stress_nothing_safe")
               .all())
    if any((d or {}).get("signal_event_id") == status["signal_event_id"] for (d,) in tried):
        db.commit()
        return None
    try:
        return propose(db, user, now, automatic=True)
    except HTTPException as e:                           # nothing safe to change: the plan stays, logged once
        audit(db, user.id, "stress_nothing_safe", signal_event_id=status["signal_event_id"], reason=e.detail)
        db.commit()
        return None


def list_proposals(db: Session, user) -> list[ScheduleChange]:
    """Stress proposals still waiting for the student's decision, newest first."""
    return (db.query(ScheduleChange)
              .filter(ScheduleChange.user_id == user.id, ScheduleChange.trigger == STRESS_TRIGGER,
                      ScheduleChange.decision == "proposed")
              .order_by(ScheduleChange.created_at.desc())
              .all())


# ---------------------------------------------------------------------------
# F4 - Decide: accept / edit (keep some) / reject, and restore (undo)
# ---------------------------------------------------------------------------
def get_own_proposal(db: Session, user, change_id: str) -> ScheduleChange:
    change = db.get(ScheduleChange, change_id)
    if change is None or change.user_id != user.id or change.trigger != STRESS_TRIGGER:
        raise HTTPException(404, "Proposal not found")
    return change


def apply_one(db: Session, user, item: dict, now: datetime) -> dict:
    """Apply one change. Returns the item + what happened (applied / skipped + reason, ids it created)."""
    done = dict(item)
    if item["action"] == "rest":
        start = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        block = Commitment(user_id=user.id, title="Rest break", kind="protected_block", is_recurring=False,
                           start_at=start, end_at=start + timedelta(minutes=item["minutes"]))
        db.add(block)
        db.flush()
        return done | {"applied": True, "created_ids": [block.id]}

    task = db.get(Task, item["task_id"])
    has_steps = task is not None and db.query(Task.id).filter(Task.parent_id == task.id).first() is not None
    why_not = "task was deleted" if task is None else lock_reason(task, now, has_steps,
                                                                   focusing=task.id in focusing_now(db, user))
    if why_not:                                          # safety check again at decision time
        return done | {"applied": False, "skipped_because": why_not}

    drop_planned_pieces(db, [task.id])                   # the old "Plan my week" pieces no longer fit
    if item["action"] == "move":
        task.scheduled_start = datetime.fromisoformat(item["to"])
        return done | {"applied": True}

    # split -> one step (subtask) per piece; the parent stays as the "big task"
    pieces = [Task(user_id=user.id, parent_id=task.id, title=f"{task.title} (part {i}/{len(item['pieces'])})",
                   description=task.description, task_type=task.task_type, deadline=task.deadline,
                   estimated_minutes=minutes, priority=task.priority, is_flexible=True,
                   cognitive_load=task.cognitive_load, source="scheduler")
              for i, minutes in enumerate(item["pieces"], start=1)]
    db.add_all(pieces)
    db.flush()
    return done | {"applied": True, "created_ids": [p.id for p in pieces]}


def decide(db: Session, user, change_id: str, decision: str, keep: list[int] | None = None,
           now: datetime | None = None) -> ScheduleChange:
    """accepted = apply all, edited = apply only the `keep` positions, rejected = apply nothing."""
    now = now or datetime.utcnow()
    change = get_own_proposal(db, user, change_id)
    if change.decision != "proposed":
        raise HTTPException(409, f"This proposal was already {change.decision}")

    if decision == "edited":
        if not keep or any(i < 0 or i >= len(change.change_set) for i in keep):
            raise HTTPException(422, "keep must list the positions of the changes you want (0, 1, ...)")
        chosen = [change.change_set[i] for i in sorted(set(keep))]
    else:
        chosen = change.change_set if decision == "accepted" else []

    applied = [apply_one(db, user, item, now) for item in chosen]
    change.decision = decision
    change.decided_at = now
    change.edited_change_set = applied                   # what was really applied (or skipped, and why)
    audit(db, user.id, "stress_proposal_decided", change_id=change.id, decision=decision,
          offered=[c["action"] for c in change.change_set],
          applied=[a["action"] for a in applied if a["applied"]],
          skipped=[a["action"] for a in applied if not a["applied"]])
    db.commit()
    return change


def restore(db: Session, user, change_id: str, now: datetime | None = None) -> ScheduleChange:
    """Undo an accepted/edited proposal: moved tasks go back, unstarted pieces and future breaks are removed."""
    now = now or datetime.utcnow()
    change = get_own_proposal(db, user, change_id)
    if change.decision not in ("accepted", "edited"):
        raise HTTPException(409, "Only an accepted proposal can be undone")

    before = {p["task_id"]: p for p in change.previous_plan or []}
    kept = []                                            # things we could NOT undo (already started / done)
    for item in change.edited_change_set or []:
        if not item["applied"]:
            continue
        if item["action"] == "move":
            task = db.get(Task, item["task_id"])
            if task is not None:
                drop_planned_pieces(db, [task.id])
                old = before.get(task.id, {}).get("scheduled_start")
                task.scheduled_start = datetime.fromisoformat(old) if old else None
        elif item["action"] == "split":
            for piece in db.query(Task).filter(Task.id.in_(item["created_ids"])).all():
                if piece.status == "pending":
                    drop_planned_pieces(db, [piece.id], future_only=False)
                    db.delete(piece)
                else:
                    kept.append(piece.title)
        elif item["action"] == "rest":
            for block in db.query(Commitment).filter(Commitment.id.in_(item["created_ids"])).all():
                if block.start_at > now:
                    db.delete(block)

    change.decision = "restored"
    change.decided_at = now
    audit(db, user.id, "stress_proposal_restored", change_id=change.id, kept_started_pieces=kept)
    db.commit()
    return change
