"""
Component 3 - HTTP endpoints, all under /api/scheduler.

Routers stay thin: read the request -> call a service function -> return the result.
Every endpoint needs a logged-in student (get_current_user).
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.scheduler import schemas, service, task_service
from app.components.scheduler.models import Task, FocusSession, ScheduleChange
from app.components.scheduler.engine import stress_rules

router = APIRouter()


# ===========================================================================
# TASKS  (FR-01, FR-03)
# ===========================================================================
@router.post("/tasks", response_model=schemas.TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Add a task (or a subtask, by sending parent_id)."""
    return task_service.create_task(db, user, data)


@router.get("/tasks", response_model=list[schemas.TaskOut])
def list_tasks(
    status_filter: schemas.TaskStatus | None = Query(None, alias="status", description="e.g. pending"),
    top_level_only: bool = Query(False, description="true = hide subtasks"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """All my tasks, earliest deadline first."""
    return task_service.list_tasks(db, user, status_filter, top_level_only)


@router.get("/tasks/{task_id}", response_model=schemas.TaskDetailOut)
def get_task(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """One task with its subtasks."""
    return task_service.get_task_detail(db, user, task_id)


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task(task_id: str, data: schemas.TaskUpdate,
                db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Change some fields of a task (send only what changed)."""
    return task_service.update_task(db, user, task_id, data)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete a task and its subtasks (focus history is kept)."""
    task_service.delete_task(db, user, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/plan")
def plan(adaptive: bool = True, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """adaptive=false gives the STATIC baseline used in the controlled pilot."""
    return service.build_plan(db, user, adaptive)


@router.post("/focus")
def log_focus(data: schemas.FocusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(FocusSession(user_id=user.id, **data.model_dump())); db.commit()
    return {"ok": True}


@router.post("/adapt")
def adapt(db: Session = Depends(get_db), user=Depends(get_current_user)):
    risk = service.latest_risk_level(db, user.research_id)
    tasks = db.query(Task).filter_by(user_id=user.id).all()
    proposal = stress_rules.propose_changes(tasks, risk, datetime.utcnow())
    ch = ScheduleChange(user_id=user.id, reason=proposal["reason"], change_set=proposal["changes"])
    db.add(ch); db.commit()
    return {"change_id": ch.id, **proposal}


@router.post("/changes/{change_id}/decision")
def decide(change_id: str, data: schemas.DecisionIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    ch = db.get(ScheduleChange, change_id)
    if not ch or ch.user_id != user.id:
        raise HTTPException(404)
    ch.decision = data.decision; db.commit()
    return {"ok": True}


@router.post("/tasks/{task_id}/complete")
def complete(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = db.get(Task, task_id)
    if not t or t.user_id != user.id:
        raise HTTPException(404)
    return service.complete_task(db, user, t)
