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

from app.components.scheduler.models import FocusSession, SchedulerAuditLog, Task
from app.components.scheduler.schemas import TaskCreate, TaskUpdate

DEFAULT_LOAD = "medium"   # used until the M2 load classifier is ready


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def audit(db: Session, user_id: str, event_type: str, **details) -> None:
    """Add one row to the audit log (saved together with the caller's commit)."""
    db.add(SchedulerAuditLog(user_id=user_id, event_type=event_type, details=details))


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
    fields["cognitive_load"] = fields["cognitive_load"] or DEFAULT_LOAD
    # TODO (Step 8): when the student did not pick a load, ask the M2 classifier
    #                and store its confidence in load_confidence.

    task = Task(user_id=user.id, load_set_by_student=student_picked_load, **fields)
    db.add(task)
    db.flush()                                   # gives task.id before commit
    audit(db, user.id, "task_created", task_id=task.id, load=task.cognitive_load,
          estimated_minutes=task.estimated_minutes, is_subtask=bool(task.parent_id))
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
        task.load_set_by_student = True

    # Keep completed_at consistent with status
    if changes.get("status") == "done" and task.completed_at is None:
        task.completed_at = datetime.utcnow()
    elif "status" in changes and changes["status"] != "done":
        task.completed_at = None

    for field, value in changes.items():
        setattr(task, field, value)

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

    # 2. delete subtasks first, then the parent (foreign key order)
    db.query(Task).filter(Task.id.in_(subtask_ids)).delete(synchronize_session=False)
    db.delete(task)

    audit(db, user.id, "task_deleted", task_id=task_id, subtasks_deleted=len(subtask_ids))
    db.commit()
