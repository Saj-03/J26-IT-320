"""
Component 3 - TASK logic (FR-01, FR-03).

The router only receives the HTTP request and calls these functions.
All rules about tasks live here, so they are easy to test and explain:

  * a student can only see / change their OWN tasks
  * subtasks are only one level deep (task -> subtasks, not deeper)
  * a subtask cannot be due after its parent task
  * deleting a task keeps its focus sessions (they are ML training data),
    the sessions are just unlinked from the task
  * every create / update / delete is written to the audit log
"""
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.components.scheduler.engine import m2_classifier, m3_predictor
from app.components.scheduler.models import FocusSession, PlannedSession, SchedulerAuditLog, Task
from app.components.scheduler.schemas import TaskCreate, TaskUpdate

DEFAULT_LOAD = "medium"   # used when the student picks nothing and the M2 model is not available


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
PLAN_FIELDS = {"scheduled_start", "estimated_minutes", "predicted_minutes", "deadline", "status", "is_flexible",
               "cognitive_load"}


def audit(db: Session, user_id: str, event_type: str, **details) -> None:
    """Add one row to the audit log (saved together with the caller's commit)."""
    db.add(SchedulerAuditLog(user_id=user_id, event_type=event_type, details=details))


def drop_planned_pieces(db: Session, task_ids: list[str], future_only: bool = True) -> None:
    """
    Remove "Plan my week" pieces of these tasks.
    Used when a task is moved by hand, split or deleted, so the old AI plan never shows a wrong time.
    future_only=False also removes past pieces (needed before deleting the task itself).
    """
    query = db.query(PlannedSession).filter(PlannedSession.task_id.in_(task_ids))
    if future_only:
        query = query.filter(PlannedSession.end > datetime.utcnow())
    query.delete(synchronize_session=False)


def get_own_task(db: Session, user, task_id: str) -> Task:
    """
    Load a task that belongs to this student.
    Returns 404 (not 403) for someone else's task, so we don't reveal it exists.
    """
    task = db.get(Task, task_id)
    if task is None or task.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


def check_parent(db: Session, user, parent_id: str, deadline: datetime) -> Task:
    """Rules for making a task a subtask of another task."""
    parent = get_own_task(db, user, parent_id)
    if parent.parent_id is not None:
        raise HTTPException(422,
                            "Subtasks cannot have their own subtasks")
    if deadline > parent.deadline:
        raise HTTPException(422,
                            "A subtask cannot be due after its parent task")
    return parent


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------
def create_task(db: Session, user, data: TaskCreate) -> Task:
    if data.parent_id:
        check_parent(db, user, data.parent_id, data.deadline)

    fields = data.model_dump()
    student_picked_load = fields["cognitive_load"] is not None
    confidence, load_source = None, "student"
    if not student_picked_load:
        # The student did not pick a load -> ask M2 (falls back to "medium" without the model)
        if m2_classifier.available():
            fields["cognitive_load"], confidence = m2_classifier.classify(data.title, data.description)
            load_source = "m2_model"
        else:
            fields["cognitive_load"], load_source = DEFAULT_LOAD, "default"

    task = Task(user_id=user.id, load_set_by_student=student_picked_load, load_confidence=confidence, **fields)
    db.add(task)
    db.flush()                                   # gives task.id before commit
    # M3: how long it will REALLY take, from the student's own past over-runs (None = keep the estimate)
    duration = m3_predictor.predict_task(db, task)
    task.predicted_minutes = duration["minutes"] if duration else None
    audit(db, user.id, "task_created", task_id=task.id, load=task.cognitive_load, load_source=load_source,
          load_confidence=confidence, estimated_minutes=task.estimated_minutes, is_subtask=bool(task.parent_id),
          predicted_minutes=task.predicted_minutes)
    db.commit()
    db.refresh(task)
    return task


def list_tasks(db: Session, user, status_filter: str | None = None,
               top_level_only: bool = False, parent_id: str | None = None) -> list[Task]:
    """All of the student's tasks, earliest deadline first, with optional filters."""
    query = db.query(Task).filter(Task.user_id == user.id)
    if status_filter:
        query = query.filter(Task.status == status_filter)
    if top_level_only:
        query = query.filter(Task.parent_id.is_(None))
    if parent_id:
        query = query.filter(Task.parent_id == parent_id)
    return query.order_by(Task.deadline, Task.priority.desc()).all()


def get_task_detail(db: Session, user, task_id: str) -> dict:
    """One task + its subtasks (for the task details page)."""
    task = get_own_task(db, user, task_id)
    subtasks = list_tasks(db, user, parent_id=task.id)
    return {**{c.name: getattr(task, c.name) for c in Task.__table__.columns}, "subtasks": subtasks}


def update_task(db: Session, user, task_id: str, data: TaskUpdate) -> Task:
    task = get_own_task(db, user, task_id)
    changes = data.model_dump(exclude_unset=True)      # only the fields the student sent

    # A subtask's new deadline must still fit inside its parent
    if "deadline" in changes and task.parent_id:
        check_parent(db, user, task.parent_id, changes["deadline"])

    # Student changed the load -> remember that they overrode the AI
    # (this becomes a corrected training label for the M2 classifier)
    if "cognitive_load" in changes:
        if not task.load_set_by_student and changes["cognitive_load"] != task.cognitive_load:
            # what M2 (or the default) said vs what the student says -> real accuracy data for M2
            audit(db, user.id, "load_overridden", task_id=task.id, was=task.cognitive_load,
                  now=changes["cognitive_load"], model_confidence=task.load_confidence)
        task.load_set_by_student = True

    # Keep completed_at consistent with status
    if changes.get("status") == "done" and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    elif "status" in changes and changes["status"] != "done":
        task.completed_at = None

    # Put at a time by hand -> it stays there (fixed); the planner plans the rest around it.
    # Un-scheduled (null) -> flexible again, the planner may place it.
    if "scheduled_start" in changes and "is_flexible" not in changes:
        changes["is_flexible"] = changes["scheduled_start"] is None

    # Moved by hand, new time / deadline / status -> the planned pieces of this task no longer fit
    if changes.keys() & PLAN_FIELDS:
        drop_planned_pieces(db, [task.id])

    # Student set the duration themselves (e.g. "keep my estimate") -> that wins over M3.
    # Sending null = "use the AI time again".
    student_duration = changes.get("predicted_minutes")
    if "predicted_minutes" in changes:
        audit(db, user.id, "duration_overridden" if student_duration else "duration_ai_restored",
              task_id=task.id, before=task.predicted_minutes, student=student_duration,
              estimated=task.estimated_minutes)

    for field, value in changes.items():
        setattr(task, field, value)

    # Estimate / load / type changed (or the student asked for the AI time) -> ask M3 again
    ask_again = changes.keys() & {"estimated_minutes", "cognitive_load", "task_type"}
    if ("predicted_minutes" in changes and student_duration is None) or (ask_again and "predicted_minutes" not in changes):
        duration = m3_predictor.predict_task(db, task)
        task.predicted_minutes = duration["minutes"] if duration else None

    audit(db, user.id, "task_updated", task_id=task.id, fields=sorted(changes))
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, user, task_id: str) -> None:
    """Delete a task and its subtasks. Focus sessions are kept but unlinked."""
    task = get_own_task(db, user, task_id)
    subtask_ids = [t.id for t in list_tasks(db, user, parent_id=task.id)]
    all_ids = [task.id, *subtask_ids]

    # 1. keep the focus history (ML training data), just remove the link
    db.query(FocusSession).filter(FocusSession.task_id.in_(all_ids)) \
      .update({FocusSession.task_id: None}, synchronize_session=False)

    # 2. planned pieces point to the tasks -> remove them first (foreign key)
    drop_planned_pieces(db, all_ids, future_only=False)

    # 3. delete subtasks first, then the parent (foreign key order)
    db.query(Task).filter(Task.id.in_(subtask_ids)).delete(synchronize_session=False)
    db.delete(task)

    audit(db, user.id, "task_deleted", task_id=task_id, subtasks_deleted=len(subtask_ids))
    db.commit()
