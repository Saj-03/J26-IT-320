"""
Component 3 - HTTP endpoints, all under /api/scheduler.

Routers stay thin: read the request -> call a service function -> return the result.
Every endpoint needs a logged-in student (get_current_user).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.scheduler import schemas, service, task_service, commitment_service, focus_service
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


# ===========================================================================
# COMMITMENTS  (FR-02) - lectures, work, clubs = busy time
# ===========================================================================
@router.post("/commitments", response_model=schemas.CommitmentOut, status_code=status.HTTP_201_CREATED)
def create_commitment(data: schemas.CommitmentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Add a weekly (e.g. Monday lecture) or one-off busy time."""
    return commitment_service.create_commitment(db, user, data)


@router.get("/commitments", response_model=list[schemas.CommitmentOut])
def list_commitments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """All my commitments."""
    return commitment_service.list_commitments(db, user)


@router.get("/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def get_commitment(commitment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return commitment_service.get_own_commitment(db, user, commitment_id)


@router.patch("/commitments/{commitment_id}", response_model=schemas.CommitmentOut)
def update_commitment(commitment_id: str, data: schemas.CommitmentUpdate,
                      db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Change some fields (send only what changed)."""
    return commitment_service.update_commitment(db, user, commitment_id, data)


@router.delete("/commitments/{commitment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commitment(commitment_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    commitment_service.delete_commitment(db, user, commitment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# FREE TIME + CONFLICTS
# ===========================================================================
@router.get("/availability", response_model=schemas.AvailabilityOut)
def availability(days: int = Query(7, ge=1, le=28, description="how many days ahead"),
                 db: Session = Depends(get_db), user=Depends(get_current_user)):
    """My free study time per day (study window minus commitments)."""
    return commitment_service.get_availability(db, user, days)


@router.get("/conflicts", response_model=list[schemas.ConflictOut])
def conflicts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Clashing commitments and deadlines I can't meet with my free time."""
    return commitment_service.detect_conflicts(db, user)


# ===========================================================================
# FOCUS SESSIONS  (FR-05, FR-15)
# ===========================================================================
@router.get("/focus/recommendation", response_model=schemas.TimerRecommendationOut)
def timer_recommendation(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Suggested timer length - show this before the student presses Start."""
    return focus_service.recommend_timer(db, user)


@router.post("/focus/start", response_model=schemas.FocusStartOut, status_code=status.HTTP_201_CREATED)
def start_focus(data: schemas.FocusStartIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Start a session. Leave planned_minutes empty to accept the suggestion."""
    return focus_service.start_session(db, user, data)


@router.get("/focus/active", response_model=schemas.FocusSessionOut | None)
def active_focus(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """The running session (null if none) - lets the app restore the timer after a refresh."""
    return focus_service.get_active_session(db, user)


@router.get("/plan")
def plan(adaptive: bool = True, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """adaptive=false gives the STATIC baseline used in the controlled pilot."""
    return service.build_plan(db, user, adaptive)


@router.post("/focus")
def log_focus(data: schemas.FocusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """OLD endpoint: logs an already-finished session in one call (kept for the current frontend)."""
    ended = data.started_at + timedelta(minutes=data.actual_minutes)   # finished -> never "active"
    db.add(FocusSession(user_id=user.id, ended_at=ended, **data.model_dump())); db.commit()
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
