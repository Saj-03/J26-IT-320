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


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "No profile found. Complete the assessment first.")
    return {
        "goal": p.goal,
        "activity_level": p.activity_level,
        "available_minutes": p.available_minutes,
        "equipment": p.equipment,
        "diet_pref": p.diet_pref,
        "sleep_hours": p.sleep_hours,
        "workload_intensity_score": p.workload_intensity_score,
        "stress_score": p.stress_score,
        "burnout_score": p.burnout_score,
        "bmi": p.bmi,
        "physical_limitations": p.physical_limitations,
        "recovery_mode": p.recovery_mode,
    }


@router.get("/recommendations")
def recommendations(is_exam_period: bool = False, use_baseline: bool = False, db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Create your wellbeing profile first")
    
    profile_dict = {
        "workload_intensity_score": p.workload_intensity_score,
        "stress_score": p.stress_score,
        "burnout_score": p.burnout_score,
        "bmi": p.bmi,
        "available_minutes": p.available_minutes,
        "physical_limitations": p.physical_limitations,
        "equipment_access": " ".join(p.equipment) if p.equipment else "None",
        "dietary_preference": p.diet_pref,
        "sleep_deficit": max(0.0, 7.5 - p.sleep_hours)
    }

    if use_baseline:
        res = recommender.get_baseline_recommendations(profile_dict)
    else:
        res = recommender.get_adaptive_recommendations(profile_dict, is_exam_period=is_exam_period)

    formatted_exercises = []
    for w in res.get("recommended_workouts", []):
        w_dict = dict(w)
        w_dict["name"] = w_dict.get("title") or w_dict.get("name") or "Workout Routine"
        w_dict["minutes"] = int(w_dict.get("adapted_duration_mins") or w_dict.get("time_per_workout") or w_dict.get("duration_mins") or 20)
        formatted_exercises.append(w_dict)

    formatted_meals = []
    for m in res.get("recommended_meals", []):
        m_dict = dict(m)
        m_dict["name"] = m_dict.get("meal_name") or m_dict.get("name") or m_dict.get("title") or "Healthy Meal"
        m_dict["region"] = m_dict.get("cuisine") or m_dict.get("diet_category") or ("Vegetarian" if m_dict.get("vegetarian") else "Balanced")
        formatted_meals.append(m_dict)

    return {
        "recovery_mode": p.recovery_mode,
        "model_version": res["model_version"],
        "context_aware": res["context_aware"],
        "exercises": formatted_exercises,
        "meals": formatted_meals
    }


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
