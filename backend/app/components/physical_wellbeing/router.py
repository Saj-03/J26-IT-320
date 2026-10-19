import datetime
import hashlib
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.physical_wellbeing import schemas, service
from app.components.physical_wellbeing.models import (
    WellbeingProfile, ActivityLog, Habit, WorkoutFeedback,
    PhysicalPlanSnapshot, PeerChallenge, PeerChallengeMember,
)
from app.components.physical_wellbeing.ml import recommender

router = APIRouter()

# ── Image URL lookup maps (keyed by curated meal/exercise id) ─────────────────
# Uses stable Unsplash photos matched to each food and workout type.
_MEAL_IMAGES: dict[str, str] = {
    # Sri Lankan Breakfasts
    "sl_bf_1": "https://images.unsplash.com/photo-1627308595229-7830a5c18cb1?w=600&q=80",   # milk rice
    "sl_bf_2": "https://images.unsplash.com/photo-1630851840628-a81d5c3a0b45?w=600&q=80",   # string hoppers
    "sl_bf_3": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",   # coconut roti
    "sl_bf_4": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",       # chickpeas
    "sl_bf_5": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80",   # mung beans
    "sl_bf_6": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",   # egg hopper
    "sl_bf_7": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",   # roast bread + egg
    "sl_bf_8": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",       # cowpea
    # Sri Lankan Lunches
    "sl_lu_1": "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=600&q=80",   # rice & curry
    "sl_lu_2": "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=600&q=80",   # rice & soya
    "sl_lu_3": "https://images.unsplash.com/photo-1588347818033-c2f3cca63a70?w=600&q=80",   # fish curry
    "sl_lu_4": "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=600&q=80",   # red rice
    "sl_lu_5": "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=600&q=80",   # polos curry
    "sl_lu_6": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",   # egg curry
    # Sri Lankan Dinners
    "sl_dn_1": "https://images.unsplash.com/photo-1630851840628-a81d5c3a0b45?w=600&q=80",   # string hoppers dinner
    "sl_dn_2": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",   # roast paan
    "sl_dn_3": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?w=600&q=80",   # vegetable soup
    "sl_dn_4": "https://images.unsplash.com/photo-1588347818033-c2f3cca63a70?w=600&q=80",   # idiyappam fish
    "sl_dn_5": "https://images.unsplash.com/photo-1551183053-bf91798d454c?w=600&q=80",       # stir-fried noodles
    "sl_dn_6": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&q=80",   # grilled chicken
    # Sri Lankan Snacks
    "sl_sn_1": "https://images.unsplash.com/photo-1562159278-1253a58da141?w=600&q=80",       # king coconut
    "sl_sn_2": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",       # energy balls
    "sl_sn_3": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",   # roasted nuts
    "sl_sn_4": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",   # banana
    "sl_sn_5": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80",   # yogurt papaya
    "sl_sn_6": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",   # guava
    # International Breakfasts
    "int_bf_1": "https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=600&q=80",  # oatmeal
    "int_bf_2": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80",  # avocado toast
    "int_bf_3": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80",  # greek yogurt
    # International Lunches
    "int_lu_1": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",  # salmon quinoa
    "int_lu_2": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80",      # chickpea stew
    "int_lu_3": "https://images.unsplash.com/photo-1584184924103-e310d9dc82fc?w=600&q=80",  # lettuce wraps
    "int_lu_4": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",  # lentil salad
    # International Dinners
    "int_dn_1": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&q=80",  # grilled chicken
    "int_dn_2": "https://images.unsplash.com/photo-1551183053-bf91798d454c?w=600&q=80",      # pasta lentil
    "int_dn_3": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",  # baked cod
    "int_dn_4": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80",  # tofu stir-fry
    # International Snacks
    "int_sn_1": "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=600&q=80",  # apple peanut butter
    "int_sn_2": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80",  # nuts
    "int_sn_3": "https://images.unsplash.com/photo-1541014741259-de529411b96a?w=600&q=80",  # hummus veggies
}

_EXERCISE_IMAGES: dict[str, str] = {
    "ex_15_walk":   "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    "ex_15_dance":  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    "ex_15_jog":    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80",
    "ex_15_1":      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
    "ex_15_2":      "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    "ex_15_3":      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
    "ex_20_walk":   "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    "ex_20_zumba":  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    "ex_20_jog":    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80",
    "ex_20_bands":  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80",
    "ex_20_1":      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
    "ex_20_2":      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
    "ex_20_3":      "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&q=80",
    "ex_20_4":      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80",
    "ex_30_1":      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80",
    "ex_30_2":      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
    "ex_30_3":      "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&q=80",
    "ex_30_4":      "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80",
    "ex_30_zumba":  "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&q=80",
    "ex_30_run":    "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80",
    "ex_30_mat":    "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&q=80",
    "ex_45_1":      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    "ex_45_knee_safe": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&q=80",
    "ex_45_2":      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&q=80",
    "ex_45_3":      "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&q=80",
    "ex_60_1":      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80",
    "ex_60_2":      "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80",
}

# Fallbacks by cuisine / slot / intensity when id not found
_MEAL_FALLBACKS: dict[str, str] = {
    "sri_lankan": "https://images.unsplash.com/photo-1631515242808-497c3fbd3972?w=600&q=80",
    "western":    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    "default":    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
}
_EXERCISE_FALLBACK = "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=80"


def _inject_meal_image(meal: dict) -> dict:
    if meal.get("image"):
        return meal
    meal_id = meal.get("id", "")
    cuisine = meal.get("cuisine", "default")
    img = _MEAL_IMAGES.get(meal_id) or _MEAL_FALLBACKS.get(cuisine) or _MEAL_FALLBACKS["default"]
    return {**meal, "image": img}


def _inject_exercise_image(ex: dict) -> dict:
    if ex.get("image"):
        return ex
    ex_id = ex.get("id", "")
    img = _EXERCISE_IMAGES.get(ex_id) or _EXERCISE_FALLBACK
    return {**ex, "image": img}


def _inject_plan_images(plan: dict) -> dict:
    """Recursively inject images into a week-plan structure."""
    if not isinstance(plan, dict):
        return plan
    days = plan.get("days")
    if not days:
        return plan
    new_days = []
    for day in days:
        if not isinstance(day, dict):
            new_days.append(day)
            continue
        new_day = dict(day)
        # Exercise
        if new_day.get("exercise"):
            new_day["exercise"] = _inject_exercise_image(dict(new_day["exercise"]))
        # Meals by slot
        if new_day.get("meals"):
            new_meals = {}
            for slot_key, slot_list in new_day["meals"].items():
                if isinstance(slot_list, list):
                    new_meals[slot_key] = [_inject_meal_image(dict(m)) if isinstance(m, dict) else m for m in slot_list]
                else:
                    new_meals[slot_key] = slot_list
            new_day["meals"] = new_meals
        new_days.append(new_day)
    return {**plan, "days": new_days}



def _challenge_payload(db: Session, challenge: PeerChallenge, member_id: str | None = None) -> dict:
    members = (db.query(PeerChallengeMember)
               .filter_by(challenge_id=challenge.id)
               .order_by(PeerChallengeMember.joined_at.asc())
               .all())
    mine = next((member for member in members if member.id == member_id), None) if member_id else None
    return {
        "id": challenge.id,
        "title": challenge.title,
        "goal_text": challenge.goal_text,
        "target_text": challenge.target_text,
        "metric": challenge.metric,
        "target": challenge.target,
        "duration_days": challenge.duration_days,
        "created_at": challenge.created_at.isoformat(),
        "ends_at": challenge.ends_at.isoformat(),
        "invite_code": challenge.invite_code,
        "my_score": mine.score if mine else None,
        "team_score": sum(member.score for member in members),
        "participant_count": len(members),
        "invitee_count": sum(1 for member in members if member.user_id is None),
        "participants": [
            {
                "nickname": member.nickname,
                "has_contributed": member.score > 0,
                "is_me": bool(mine and member.id == mine.id),
            }
            for member in members
        ],
    }


def _check_challenge_amount(challenge: PeerChallenge, amount: int) -> None:
    limits = {"minutes": 240, "steps": 10000, "workouts": 5}
    if amount > limits[challenge.metric]:
        raise HTTPException(422, f"A single check-in can be at most {limits[challenge.metric]} {challenge.metric}")


def _challenge_is_open(challenge: PeerChallenge) -> bool:
    return challenge.ends_at >= datetime.datetime.utcnow()


@router.get("/challenges")
def list_peer_challenges(db: Session = Depends(get_db), user=Depends(get_current_user)):
    memberships = db.query(PeerChallengeMember).filter_by(user_id=user.id).all()
    result = []
    for member in memberships:
        challenge = db.get(PeerChallenge, member.challenge_id)
        if challenge:
            result.append(_challenge_payload(db, challenge, member.id))
    return result


@router.post("/challenges")
def create_peer_challenge(data: schemas.PeerChallengeCreateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    nickname = data.nickname.strip()
    title = data.title.strip()
    if len(nickname) < 2 or not title:
        raise HTTPException(422, "Add a challenge name and a nickname with at least 2 characters")
    now = datetime.datetime.utcnow()
    challenge = PeerChallenge(
        owner_id=user.id,
        title=title,
        goal_text=data.goal_text.strip(),
        target_text=(data.target_text or str(data.target)).strip(),
        metric=data.metric,
        target=data.target,
        duration_days=data.duration_days,
        created_at=now,
        ends_at=now + datetime.timedelta(days=data.duration_days),
    )
    db.add(challenge)
    db.flush()
    member = PeerChallengeMember(challenge_id=challenge.id, user_id=user.id, nickname=nickname, score=0)
    db.add(member)
    db.commit()
    db.refresh(challenge)
    db.refresh(member)
    return _challenge_payload(db, challenge, member.id)


@router.delete("/challenges/{challenge_id}")
def delete_peer_challenge(challenge_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    challenge = db.get(PeerChallenge, challenge_id)
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if challenge.owner_id != user.id:
        raise HTTPException(403, "Only the challenge owner can delete it")
    db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id).delete(synchronize_session=False)
    db.delete(challenge)
    db.commit()
    return {"ok": True}


@router.get("/challenges/invite/{invite_code}")
def get_invited_challenge(
    invite_code: str,
    db: Session = Depends(get_db),
    participant_token: str | None = Header(default=None, alias="X-Challenge-Token"),
):
    challenge = db.query(PeerChallenge).filter_by(invite_code=invite_code).first()
    if not challenge:
        raise HTTPException(404, "Challenge invite not found")
    member_id = None
    if participant_token:
        token_hash = hashlib.sha256(participant_token.encode()).hexdigest()
        member = db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id, guest_token_hash=token_hash).first()
        member_id = member.id if member else None
    return _challenge_payload(db, challenge, member_id)


@router.post("/challenges/invite/{invite_code}/join")
def join_peer_challenge(
    invite_code: str,
    data: schemas.PeerChallengeJoinIn,
    db: Session = Depends(get_db),
    participant_token: str | None = Header(default=None, alias="X-Challenge-Token"),
):
    challenge = db.query(PeerChallenge).filter_by(invite_code=invite_code).first()
    if not challenge:
        raise HTTPException(404, "Challenge invite not found")
    if not _challenge_is_open(challenge):
        raise HTTPException(410, "This challenge has ended")
    nickname = data.nickname.strip()
    if len(nickname) < 2:
        raise HTTPException(422, "Nickname must contain at least 2 characters")

    if participant_token:
        token_hash = hashlib.sha256(participant_token.encode()).hexdigest()
        existing = db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id, guest_token_hash=token_hash).first()
        if existing:
            existing.nickname = nickname
            db.commit()
            return {"challenge": _challenge_payload(db, challenge, existing.id), "participant_token": participant_token}

    member_count = db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id).count()
    if member_count >= 6:
        raise HTTPException(409, "This squad is full (6 people max)")

    token = secrets.token_urlsafe(32)
    member = PeerChallengeMember(
        challenge_id=challenge.id,
        user_id=None,
        nickname=nickname,
        score=0,
        guest_token_hash=hashlib.sha256(token.encode()).hexdigest(),
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return {"challenge": _challenge_payload(db, challenge, member.id), "participant_token": token}


@router.post("/challenges/invite/{invite_code}/score")
def update_guest_challenge_score(
    invite_code: str,
    data: schemas.PeerChallengeGuestProgressIn,
    db: Session = Depends(get_db),
):
    challenge = db.query(PeerChallenge).filter_by(invite_code=invite_code).first()
    if not challenge:
        raise HTTPException(404, "Challenge invite not found")
    if not _challenge_is_open(challenge):
        raise HTTPException(410, "This challenge has ended")
    _check_challenge_amount(challenge, data.amount)
    token_hash = hashlib.sha256(data.participant_token.encode()).hexdigest()
    member = db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id, guest_token_hash=token_hash).first()
    if not member:
        raise HTTPException(403, "Join the challenge before adding your score")
    member.score += data.amount
    db.commit()
    return _challenge_payload(db, challenge, member.id)


@router.post("/challenges/{challenge_id}/score")
def update_member_challenge_score(
    challenge_id: str,
    data: schemas.PeerChallengeProgressIn,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    challenge = db.get(PeerChallenge, challenge_id)
    if not challenge:
        raise HTTPException(404, "Challenge not found")
    if not _challenge_is_open(challenge):
        raise HTTPException(410, "This challenge has ended")
    _check_challenge_amount(challenge, data.amount)
    member = db.query(PeerChallengeMember).filter_by(challenge_id=challenge.id, user_id=user.id).first()
    if not member:
        raise HTTPException(403, "You are not a member of this challenge")
    member.score += data.amount
    db.commit()
    return _challenge_payload(db, challenge, member.id)


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
        "assessment_data": p.assessment_data or {},
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


@router.put("/profile/plan-duration")
def update_plan_duration(data: schemas.PlanDurationIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    profile = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not profile:
        raise HTTPException(404, "Complete your wellbeing assessment first")
    assessment_data = dict(profile.assessment_data or {})
    assessment_data.update({
        "planDurationDays": data.days_count,
        "planDurationAmount": str(data.days_count),
        "planDurationUnit": "days",
    })
    profile.assessment_data = assessment_data
    db.commit()
    return {"days_count": data.days_count}


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


def _attach_behavior_history(db: Session, user_id: str, profile_dict: dict) -> dict:
    """Use up to 14 days of explicit check-ins; don't infer skips from missing logs."""
    since = datetime.date.today() - datetime.timedelta(days=13)
    feedback = (db.query(WorkoutFeedback)
                .filter(WorkoutFeedback.user_id == user_id, WorkoutFeedback.day >= since)
                .order_by(WorkoutFeedback.day.desc()).all())
    count = len(feedback)
    completed = sum(1 for item in feedback if item.did_workout)
    rate = completed / count if count else None
    difficulty_answers = [item.difficulty for item in feedback if item.did_workout and item.difficulty]
    hard_sessions = sum(1 for answer in difficulty_answers if answer in {"Difficult", "Very Difficult"})
    target = int(profile_dict.get("available_minutes", 20))
    if count >= 3 and rate < 0.5:
        target = max(10, round(target * 0.75))
        reason = "shorter_sessions_after_recent_missed_workouts"
    elif len(difficulty_answers) >= 2 and hard_sessions / len(difficulty_answers) >= 0.5:
        target = max(10, round(target * 0.75))
        reason = "shorter_sessions_after_difficult_feedback"
    elif count >= 3 and rate >= 0.8:
        target = min(target, 30)
        reason = "maintaining_duration_after_consistent_workouts"
    else:
        reason = "building_history" if count < 3 else "maintaining_current_duration"
    profile_dict["behavior_adaptation"] = {
        "check_ins": count,
        "completed": completed,
        "completion_rate": round(rate, 2) if rate is not None else None,
        "difficulty_responses": len(difficulty_answers),
        "difficult_sessions": hard_sessions,
        "latest_difficulty": difficulty_answers[0] if difficulty_answers else None,
        "target_minutes": target,
        "reason": reason,
    }
    return profile_dict


def _attach_plan_history(db: Session, user_id: str, profile_dict: dict) -> dict:
    """Summarize only past scheduled items so new plans can rotate recommendations."""
    today = datetime.date.today()
    since = today - datetime.timedelta(days=13)
    snapshots = (db.query(PhysicalPlanSnapshot)
                 .filter(PhysicalPlanSnapshot.user_id == user_id,
                         PhysicalPlanSnapshot.plan_date >= since,
                         PhysicalPlanSnapshot.plan_date < today)
                 .order_by(PhysicalPlanSnapshot.plan_date.desc(),
                           PhysicalPlanSnapshot.created_at.desc()).all())
    exercise_days, meal_days = {}, {}
    for snapshot in snapshots:
        for day in (snapshot.plan_data or {}).get("days", []):
            try:
                day_date = datetime.date.fromisoformat(str(day.get("date", ""))[:10])
            except (TypeError, ValueError):
                continue
            if not since <= day_date < today:
                continue
            exercise_name = (day.get("exercise") or {}).get("name")
            if exercise_name:
                exercise_days.setdefault(exercise_name, set()).add(day_date.isoformat())
            for slot_items in (day.get("meals") or {}).values():
                for meal in slot_items if isinstance(slot_items, list) else []:
                    meal_name = meal.get("name") if isinstance(meal, dict) else None
                    if meal_name:
                        meal_days.setdefault(meal_name, set()).add(day_date.isoformat())
    profile_dict["plan_history"] = {
        "exercise_counts": {name: len(days) for name, days in exercise_days.items()},
        "meal_counts": {name: len(days) for name, days in meal_days.items()},
    }
    return profile_dict


@router.get("/recommendations")
def recommendations(is_exam_period: bool = False, use_baseline: bool = False, db: Session = Depends(get_db), user=Depends(get_current_user)):
    p = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Create your wellbeing profile first")
    
    profile_dict = _attach_plan_history(db, user.id, _attach_behavior_history(db, user.id, _profile_to_dict(p)))

    if use_baseline:
        res = recommender.get_baseline_recommendations(profile_dict)
    else:
        res = recommender.get_adaptive_recommendations(profile_dict, is_exam_period=is_exam_period)

    formatted_exercises = []
    for w in res.get("recommended_workouts", []):
        w_dict = dict(w)
        w_dict["name"] = w_dict.get("name") or w_dict.get("title") or "Workout Routine"
        w_dict["minutes"] = int(w_dict.get("minutes") or w_dict.get("duration_mins") or w_dict.get("time_per_workout") or 20)
        formatted_exercises.append(_inject_exercise_image(w_dict))

    formatted_meals = []
    for m in res.get("recommended_meals", []):
        m_dict = dict(m)
        m_dict["name"] = m_dict.get("name") or m_dict.get("meal_name") or "Healthy Meal"
        m_dict["region"] = m_dict.get("cuisine") or m_dict.get("diet_category") or "Balanced"
        formatted_meals.append(_inject_meal_image(m_dict))

    # Inject images into today_slots as well
    today_slots_raw = res.get("today_slots")
    if today_slots_raw and isinstance(today_slots_raw, dict):
        today_slots_raw = {
            slot: [_inject_meal_image(dict(m)) if isinstance(m, dict) else m for m in items]
            if isinstance(items, list) else items
            for slot, items in today_slots_raw.items()
        }

    return {
        "recovery_mode": p.recovery_mode or False,
        "model_version": res["model_version"],
        "context_aware": res["context_aware"],
        "is_exam_period": res.get("is_exam_period", is_exam_period),
        "effective_available_minutes": res.get("effective_available_minutes", p.available_minutes),
        "user_preferences": profile_dict,
        "exercises": formatted_exercises,
        "meals": formatted_meals,
        "today_slots": today_slots_raw,
        "safety_analysis": res.get("safety_analysis"),
        "behavior_adaptation": profile_dict.get("behavior_adaptation")
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
    
    profile_dict = _attach_plan_history(db, user.id, _attach_behavior_history(db, user.id, _profile_to_dict(p)))
    plan = recommender.generate_week_plan(
        profile_dict,
        is_exam_period=is_exam_period,
        use_baseline=use_baseline,
        num_days=days_count
    )
    plan = _inject_plan_images(plan)
    plan_date = datetime.date.today()
    snapshot = db.query(PhysicalPlanSnapshot).filter_by(
        user_id=user.id,
        plan_date=plan_date,
        days_count=days_count,
        is_exam_period=is_exam_period,
        use_baseline=use_baseline,
    ).first()
    if snapshot:
        snapshot.plan_data = plan
        snapshot.created_at = datetime.datetime.utcnow()
    else:
        db.add(PhysicalPlanSnapshot(
            user_id=user.id,
            plan_date=plan_date,
            days_count=days_count,
            is_exam_period=is_exam_period,
            use_baseline=use_baseline,
            plan_data=plan,
        ))
    db.commit()
    return plan


@router.get("/week-plan/history")
def list_week_plan_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    snapshots = (db.query(PhysicalPlanSnapshot)
                 .filter_by(user_id=user.id)
                 .order_by(PhysicalPlanSnapshot.plan_date.desc(), PhysicalPlanSnapshot.created_at.desc())
                 .limit(90).all())
    return [
        {
            "id": snapshot.id,
            "plan_date": snapshot.plan_date.isoformat(),
            "days_count": snapshot.days_count,
            "is_exam_period": snapshot.is_exam_period,
            "use_baseline": snapshot.use_baseline,
            "model_version": snapshot.plan_data.get("model_version", "Saved plan"),
            "created_at": snapshot.created_at.isoformat(),
        }
        for snapshot in snapshots
    ]


@router.get("/week-plan/history/{snapshot_id}")
def get_week_plan_snapshot(snapshot_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    snapshot = db.query(PhysicalPlanSnapshot).filter_by(id=snapshot_id, user_id=user.id).first()
    if not snapshot:
        raise HTTPException(404, "Saved plan not found")
    return {
        "id": snapshot.id,
        "plan_date": snapshot.plan_date.isoformat(),
        "days_count": snapshot.days_count,
        "plan": snapshot.plan_data,
    }


@router.delete("/week-plan/history/{snapshot_id}")
def delete_week_plan_snapshot(snapshot_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    snapshot = db.query(PhysicalPlanSnapshot).filter_by(id=snapshot_id, user_id=user.id).first()
    if not snapshot:
        raise HTTPException(404, "Saved plan not found")
    db.delete(snapshot)
    db.commit()
    return {"ok": True}


@router.post("/activity/workout-feedback")
def save_workout_feedback(data: schemas.WorkoutFeedbackIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    feedback = db.query(WorkoutFeedback).filter_by(user_id=user.id, day=data.day).first()
    if feedback:
        # Idempotent daily check-in; allow correcting today's answer without double-counting minutes.
        was_completed = feedback.did_workout
        previous_minutes = feedback.workout_minutes
        feedback.did_workout = data.did_workout
        feedback.workout_minutes = data.workout_minutes if data.did_workout else 0
        if data.difficulty is not None:
            feedback.difficulty = data.difficulty
        activity = db.query(ActivityLog).filter_by(user_id=user.id, day=data.day).first()
        if data.did_workout:
            minute_delta = data.workout_minutes - (previous_minutes if was_completed else 0)
            if activity:
                activity.exercise_minutes = max(0, activity.exercise_minutes + minute_delta)
                activity.completed_recommendation = True
            else:
                db.add(ActivityLog(user_id=user.id, day=data.day, steps=0,
                                   exercise_minutes=data.workout_minutes, completed_recommendation=True))
        elif was_completed and activity:
            activity.exercise_minutes = max(0, activity.exercise_minutes - previous_minutes)
            activity.completed_recommendation = False
    else:
        feedback = WorkoutFeedback(user_id=user.id, day=data.day, did_workout=data.did_workout,
                                   workout_minutes=data.workout_minutes if data.did_workout else 0,
                                   difficulty=data.difficulty)
        db.add(feedback)
        if data.did_workout:
            activity = db.query(ActivityLog).filter_by(user_id=user.id, day=data.day).first()
            if activity:
                activity.exercise_minutes += data.workout_minutes
                activity.completed_recommendation = True
            else:
                db.add(ActivityLog(user_id=user.id, day=data.day, steps=0,
                                   exercise_minutes=data.workout_minutes, completed_recommendation=True))
    db.commit()
    return {"ok": True, "day": data.day.isoformat(), "did_workout": data.did_workout}


@router.get("/activity")
def get_activity_summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = datetime.date.today()
    # Today's activity
    today_log = db.query(ActivityLog).filter_by(user_id=user.id, day=today).first()
    today_feedback = db.query(WorkoutFeedback).filter_by(user_id=user.id, day=today).first()
    
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
            "workout_feedback": today_feedback.did_workout if today_feedback else None,
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
