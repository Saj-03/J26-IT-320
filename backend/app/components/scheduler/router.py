from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.scheduler import schemas, service
from app.components.scheduler.models import AdaptationProposal, FocusSession, Subtask, Task

router = APIRouter()


@router.post("/tasks", response_model=schemas.TaskRead)
def add_task(data: schemas.TaskCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = Task(user_id=user.id, **data.model_dump(exclude={"subtasks"}))
    t.subtasks = [Subtask(**s.model_dump()) for s in data.subtasks]
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.get("/tasks", response_model=list[schemas.TaskRead])
def list_tasks(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(Task).filter_by(user_id=user.id).order_by(Task.deadline).all()


@router.get("/plan")
def plan(adaptive: bool | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """By default uses the participant's assigned mode (ExperimentAssignment).
    adaptive=false forces the STATIC baseline used in the controlled pilot."""
    return service.build_plan(db, user, adaptive)


@router.post("/focus")
def log_focus(data: schemas.FocusIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(FocusSession(user_id=user.id, **data.model_dump())); db.commit()
    return {"ok": True}


@router.post("/adapt")
def adapt(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return service.propose_adaptation(db, user)


@router.post("/changes/{proposal_id}/decision")
def decide(proposal_id: str, data: schemas.DecisionIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.get(AdaptationProposal, proposal_id)
    if not p or p.user_id != user.id:
        raise HTTPException(404)
    service.decide_proposal(db, p, data.decision)
    return {"ok": True}


@router.post("/tasks/{task_id}/complete")
def complete(task_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    t = db.get(Task, task_id)
    if not t or t.user_id != user.id:
        raise HTTPException(404)
    return service.complete_task(db, user, t)
