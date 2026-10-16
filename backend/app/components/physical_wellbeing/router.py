import datetime
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
        if hasattr(p, k):
            setattr(p, k, v)
    db.add(p)
    db.commit()
    return {"ok": True}


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "No profile found. Complete the assessment first.")
    return {
        "goal": p.goal or "fitness",
        "goals": p.goals or ([p.goal] if p.goal else ["fitness"]),
        "activity_level": p.activity_level or "medium",
        "available_minutes": p.available_minutes or 20,
        "equipment": p.equipment or [],
        "diet_pref": p.diet_pref or "any",
        "meal_style": getattr(p, "meal_style", "both") or "both",
        "allergies": getattr(p, "allergies", "") or "",
        "avoid_foods": getattr(p, "avoid_foods", "") or "",
        "favourite_foods": getattr(p, "favourite_foods", "") or "",
        "preferred_time": getattr(p, "preferred_time", "morning") or "morning",
        "preferred_activities": getattr(p, "preferred_activities", []) or [],
        "sleep_hours": p.sleep_hours or 7.0,
        "workload_intensity_score": p.workload_intensity_score or 50.0,
        "stress_score": p.stress_score or 3.0,
        "burnout_score": p.burnout_score or 3.0,
        "bmi": p.bmi or 22.0,
        "physical_limitations": p.physical_limitations or "",
        "recovery_mode": p.recovery_mode or False,
    }


def _profile_to_dict(p: WellbeingProfile) -> dict:
    return {
        "workload_intensity_score": p.workload_intensity_score or 50.0,
        "stress_score": p.stress_score or 3.0,
        "burnout_score": p.burnout_score or 3.0,
        "bmi": p.bmi or 22.0,
        "available_minutes": p.available_minutes or 20,
        "physical_limitations": p.physical_limitations or "",
        "equipment": p.equipment or [],
        "equipment_access": " ".join(p.equipment) if p.equipment else "Home / Bodyweight",
        "diet_pref": p.diet_pref or "any",
        "dietary_preference": p.diet_pref or "any",
        "meal_style": getattr(p, "meal_style", "both") or "both",
        "allergies": getattr(p, "allergies", "") or "",
        "avoid_foods": getattr(p, "avoid_foods", "") or "",
        "favourite_foods": getattr(p, "favourite_foods", "") or "",
        "preferred_time": getattr(p, "preferred_time", "morning") or "morning",
        "preferred_activities": getattr(p, "preferred_activities", []) or [],
        "goal": p.goal or "fitness",
        "goals": p.goals or ([p.goal] if p.goal else ["fitness"]),
        "sleep_deficit": max(0.0, 7.5 - (p.sleep_hours or 7.0))
    }


@router.get("/recommendations")
def recommendations(is_exam_period: bool = False, use_baseline: bool = False, db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Create your wellbeing profile first")
    
    profile_dict = _profile_to_dict(p)

    if use_baseline:
        res = recommender.get_baseline_recommendations(profile_dict)
    else:
        res = recommender.get_adaptive_recommendations(profile_dict, is_exam_period=is_exam_period)

    formatted_exercises = []
    for w in res.get("recommended_workouts", []):
        w_dict = dict(w)
        w_dict["name"] = w_dict.get("name") or w_dict.get("title") or "Workout Routine"
        w_dict["minutes"] = int(w_dict.get("minutes") or w_dict.get("duration_mins") or w_dict.get("time_per_workout") or 20)
        formatted_exercises.append(w_dict)

    formatted_meals = []
    for m in res.get("recommended_meals", []):
        m_dict = dict(m)
        m_dict["name"] = m_dict.get("name") or m_dict.get("meal_name") or "Healthy Meal"
        m_dict["region"] = m_dict.get("cuisine") or m_dict.get("diet_category") or "Balanced"
        formatted_meals.append(m_dict)

    return {
        "recovery_mode": p.recovery_mode or False,
        "model_version": res["model_version"],
        "context_aware": res["context_aware"],
        "is_exam_period": res.get("is_exam_period", is_exam_period),
        "effective_available_minutes": res.get("effective_available_minutes", p.available_minutes),
        "user_preferences": profile_dict,
        "exercises": formatted_exercises,
        "meals": formatted_meals,
        "today_slots": res.get("today_slots"),
        "safety_analysis": res.get("safety_analysis")
    }


@router.get("/week-plan")
def get_week_plan(
    days_count: int = 7,
    is_exam_period: bool = False,
    use_baseline: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Create your wellbeing profile first")
    
    profile_dict = _profile_to_dict(p)
    return recommender.generate_week_plan(
        profile_dict,
        is_exam_period=is_exam_period,
        use_baseline=use_baseline,
        num_days=days_count
    )


@router.get("/activity")
def get_activity_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = datetime.date.today()
    # Today's activity
    today_log = db.query(ActivityLog).filter_by(user_id=user.id, day=today).first()
    
    # Last 7 days history
    seven_days_ago = today - datetime.timedelta(days=6)
    recent_logs = db.query(ActivityLog).filter(
        ActivityLog.user_id == user.id,
        ActivityLog.day >= seven_days_ago
    ).order_by(ActivityLog.day.asc()).all()

    # Build day map for the past 7 days
    history_by_date = {log.day.strftime("%Y-%m-%d"): log for log in recent_logs}
    days_data = []
    for i in range(7):
        d = seven_days_ago + datetime.timedelta(days=i)
        d_key = d.strftime("%Y-%m-%d")
        d_name = d.strftime("%a")
        log_entry = history_by_date.get(d_key)
        days_data.append({
            "day": d_name,
            "date": d_key,
            "steps": log_entry.steps if log_entry else 0,
            "exercise_minutes": log_entry.exercise_minutes if log_entry else 0
        })

    total_week_steps = sum(d["steps"] for d in days_data)
    total_week_exercise = sum(d["exercise_minutes"] for d in days_data)

    return {
        "today": {
            "steps": today_log.steps if today_log else 0,
            "exercise_minutes": today_log.exercise_minutes if today_log else 0,
            "completed_recommendation": today_log.completed_recommendation if today_log else False,
            "has_logged_today": today_log is not None
        },
        "weekly_totals": {
            "steps": total_week_steps,
            "exercise_minutes": total_week_exercise,
            "days_active": len([d for d in days_data if d["steps"] > 0 or d["exercise_minutes"] > 0])
        },
        "daily_history": days_data
    }


@router.post("/activity")
def log_activity(data: schemas.ActivityIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = data.day
    existing = db.query(ActivityLog).filter_by(user_id=user.id, day=today).first()
    if existing:
        existing.steps += data.steps
        existing.exercise_minutes += data.exercise_minutes
        if data.completed_recommendation:
            existing.completed_recommendation = True
    else:
        db.add(ActivityLog(user_id=user.id, **data.model_dump()))
    db.commit()
    return {"ok": True}


@router.get("/habits")
def get_user_habits(db: Session = Depends(get_db), user=Depends(get_current_user)):
    habits = db.query(Habit).filter_by(user_id=user.id).order_by(Habit.streak.desc()).all()
    today = datetime.date.today()
    result = []
    for h in habits:
        done_today = False
        if h.last_done:
            done_today = (h.last_done.date() == today)
        result.append({
            "id": h.id,
            "name": h.name,
            "streak": h.streak,
            "done": done_today,
            "last_done": h.last_done.isoformat() if h.last_done else None
        })
    return result


@router.post("/habits")
def add_habit(data: schemas.HabitIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    h = Habit(user_id=user.id, name=data.name.strip(), streak=0)
    db.add(h)
    db.commit()
    return {"id": h.id, "name": h.name, "streak": 0, "done": False}


@router.delete("/habits/{habit_id}")
def delete_habit(habit_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    h = db.get(Habit, habit_id)
    if not h or h.user_id != user.id:
        raise HTTPException(404, "Habit not found")
    db.delete(h)
    db.commit()
    return {"ok": True}


@router.post("/habits/{habit_id}/done")
def habit_done(habit_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    h = db.get(Habit, habit_id)
    if not h or h.user_id != user.id:
        raise HTTPException(404)
    h = service.mark_habit_done(db, h)
    today = datetime.date.today()
    done_today = (h.last_done.date() == today) if h.last_done else False
    return {"streak": h.streak, "done": done_today, "badge": service.badge_for(h.streak)}
