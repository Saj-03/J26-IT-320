from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.physical_wellbeing import schemas, service
from app.components.physical_wellbeing.models import WellbeingProfile, ActivityLog, Habit
from app.components.physical_wellbeing.ml import recommender

router = APIRouter()


@router.post("/profile")
def save_profile(data: schemas.ProfileIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first() or WellbeingProfile(user_id=user.id)
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.add(p); db.commit()
    return {"ok": True}


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Create your wellbeing profile first")
    return {"recovery_mode": p.recovery_mode,
            "exercises": recommender.recommend_exercises(p),
            "meals": recommender.recommend_meals(p)}


@router.post("/activity")
def log_activity(data: schemas.ActivityIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    db.add(ActivityLog(user_id=user.id, **data.model_dump())); db.commit()
    return {"ok": True}


@router.post("/habits")
def add_habit(data: schemas.HabitIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    h = Habit(user_id=user.id, name=data.name); db.add(h); db.commit()
    return {"id": h.id}


@router.post("/habits/{habit_id}/done")
def habit_done(habit_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    h = db.get(Habit, habit_id)
    if not h or h.user_id != user.id:
        raise HTTPException(404)
    h = service.mark_habit_done(db, h)
    return {"streak": h.streak, "badge": service.badge_for(h.streak)}
