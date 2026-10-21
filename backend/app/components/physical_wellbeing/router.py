import datetime
import hashlib
import secrets
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.core.config import settings
from app.components.physical_wellbeing import schemas, service
from app.components.physical_wellbeing.models import (
    WellbeingProfile, ActivityLog, Habit, WorkoutFeedback,
    PhysicalPlanSnapshot, PlanCheckIn, FavoriteItem, PeerChallenge, PeerChallengeMember,
)
from app.components.physical_wellbeing.ml import recommender
from app.components.physical_wellbeing import coach_service

router = APIRouter()

# ── Image URL lookup maps (keyed by curated meal/exercise id) ─────────────────
# Dish-specific image URLs keyed to the recommender's curated meal IDs.
_MEAL_IMAGES: dict[str, str] = {
    # Sri Lankan Breakfasts
    "sl_bf_1": "https://media.timeout.com/images/105182825/750/562/image.jpg",  # kiribath
    "sl_bf_2": "https://www.gzrecipes.com/content/uploads/sites/3/2025/11/IMG_8402-scaled-7-69258b600775d6-79927654.jpg",  # string hoppers
    "sl_bf_3": "https://srilankatravelpages.com/my_content/uploads/2023/10/Pol-Rotti-1.jpg",  # coconut roti
    "sl_bf_4": "https://shamilasobers.com/wp-content/uploads/2021/09/finished-chickpeas-with-coconut-5-scaled.jpg",  # chickpeas with coconut
    "sl_bf_5": "https://i.ebayimg.com/images/g/RccAAOSwXCVkIPYB/s-l1600.jpg",  # mung beans with coconut
    "sl_bf_6": "https://images.squarespace-cdn.com/content/v1/59899fa9f9a61eda9f9f0394/1569641649157-6FD5L1I11RZT6SSKLVZL/Sri%2BLankan%2Bhoppers",  # egg hopper
    # Roast paan, dhal and egg; source: https://secondscolombo.com/
    "sl_bf_7": "https://secondscolombo.com/assets/img/breakfast_dhal.jpg",
    "sl_bf_8": "https://sp-ao.shortpixel.ai/client/to_auto%2Cq_lossless%2Cret_img%2Cw_800%2Ch_534/https%3A/foodcnr.com/wp-content/uploads/2015/07/Cowpea-curry-Sri-Lanka.jpg",  # cowpea curry
    # Sri Lankan Lunches
    "sl_lu_1": "https://halmek.co.jp/media/article/image/b929d69fa8978fe08137885d56cbc31f.jpg",  # Sri Lankan rice and curry
    # Sri Lankan red rice and curry platter; source: https://www.arise-app.com/dish/Sri-Lankan-Style-Rice-and-Curry
    "sl_lu_2": "https://www.arise-app.com/images/dishes/en/sri-lankan-style-rice-and-curry-qgerkx.webp",
    "sl_lu_3": "https://www.maggi.lk/sites/default/files/styles/home_stage_944_531/public/srh_recipes/eb1f3828805f8be9c7bb30dc086626ce.jpg?h=4f5b30f1&itok=hWZlAfZS",  # fish ambul thiyal
    # Sri Lankan red rice platter with dhal, greens and vegetable sides; source: https://halmek.co.jp/favorite/c/hobby/919
    "sl_lu_4": "https://halmek.co.jp/media/uploads/895e2a9e49912132983b2fe585ce6cd91552971286.3906.jpg",
    "sl_lu_5": "https://www.hlimg.com/images/stories/738X538/young-jackfruit-curry-polos_1549685713-8927e.jpg?dpr=2.6&w=400",  # polos curry
    "sl_lu_6": "https://ordernow.lk/images/sri_lankan_rice_curry_veg_egg.webp",  # egg curry and rice
    # Sri Lankan Dinners
    # String hoppers served with kiri hodi; source: https://hellopure.com.au/blogs/recipes/kiri-hodi-coconut-milk-curry-h6-a-staple-of-sri-lankan-family-life-this-mild-coconut-curry-is-simple-delicious-h6
    "sl_dn_1": "https://hellopure.com.au/cdn/shop/articles/KH_2048x.jpg?v=1688537642",
    "sl_dn_2": "https://navarisi.com/assets/img/menu/3.png",  # roast paan, dhal and sambol
    "sl_dn_3": "https://images.happycow.net/venues/1024/43/71/hcmp437159_3186661.jpeg",  # vegetable soup and toast
    "sl_dn_4": "https://i.pinimg.com/736x/59/f3/e2/59f3e25aacabf7b1ab115525fc3befda.jpg",  # idiyappam and fish curry
    "sl_dn_5": "https://delmart.lk/images/item2/nova_tech_zone_7066976420231007124212pm.jpg",  # rice noodles and vegetables
    "sl_dn_6": "https://10.com.au/ip/s3/2019/06/14/6c1ced95381918aac691d6b39626c056-344710.jpg?image-profile=image_full&io=landscape",  # bread, dhal and chicken
    # Sri Lankan Snacks
    # Opened king coconut drink; source: https://eightyflavors.com/sips-of-ceylon-8-essential-drinks-to-have-in-sri-lanka/
    "sl_sn_1": "https://eightyflavors.com/wp-content/uploads/2020/06/DSC_0042-1024x683.jpg",
    "sl_sn_2": "https://m.media-amazon.com/images/I/718E3hQd8yL._SL1280_.jpg",  # Samaposha aggala
    "sl_sn_3": "https://www.greendna.in/cdn/shop/files/roastedh_speanuts_1024x1024%402x.jpg?v=1711354875",  # roasted peanuts
    "sl_sn_4": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&q=80",   # banana
    # Pexels photo of a yogurt bowl with papaya; source page: https://www.pexels.com/photo/top-view-of-a-bowl-of-yogurt-12042271/
    "sl_sn_5": "https://images.pexels.com/photos/12042271/pexels-photo-12042271.jpeg?cs=srgb&dl=pexels-alice-louise-karow-164968996-12042271.jpg&fm=jpg",
    "sl_sn_6": "https://services.kpnfresh.com/media/v1/products/images/d98da0c7-060b-4cfa-86bd-a199541a47e7/guava-salad.webp?c_type=C1",  # guava
    # International Breakfasts
    "int_bf_1": "https://www.arise-app.com/images/dishes/pt/banana-com-aveia-chia-psyllium-e-canela-2xux69.webp",  # oats, banana and chia
    "int_bf_2": "https://recipesinsight.com/wp-content/uploads/2025/04/5a8db425-798e-481c-8063-316e7baa0e89-768x768.webp",  # avocado toast
    # Exact berries-and-walnuts match; source: https://www.solin.stream/recipes/255855/creamy-greek-yogurt-bowl-with-fresh-berries-and-honey
    "int_bf_3": "https://res.cloudinary.com/solin-fitness/image/upload/c_scale%2Cw_800%2Cq_auto%2Cf_auto/single-meal-images/srroczkksbghselyscyd",
    # International Lunches
    "int_lu_1": "https://www.menuistia.com/img/rcpe/lemon_herb_grilled_salmon_with_quinoa_and_steamed_broccoli.webp",  # salmon, quinoa and broccoli
    "int_lu_2": "https://data.thefeedfeed.com/static/2020/09/23/16008697815f6b55952f9ed.png",  # chickpea and spinach stew
    "int_lu_3": "https://res.cloudinary.com/solin-fitness/image/upload/c_scale%2Cw_800%2Cq_auto%2Cf_auto/single-meal-images/g3puocx0iccrq3osmpou",  # turkey, avocado and quinoa
    "int_lu_4": "https://recipesbytabitha.com/assets/images/1768709099861-oaqbm5rm.webp",  # lentil feta salad
    # International Dinners
    # Exact dish match; source: https://www.solin.stream/recipes/115761/seared-chicken-breast-with-roasted-asparagus-and-sweet-potato
    "int_dn_1": "https://res.cloudinary.com/solin-fitness/image/upload/c_scale%2Cw_800%2Cq_auto%2Cf_auto/single-meal-images/urmsxuy07jq0jao7hj7s",
    "int_dn_2": "https://static.wixstatic.com/media/372d0d_c6802a0ccb214755b640873ac33d1c31~mv2.jpg/v1/fill/w_750%2Ch_750%2Cal_c%2Cq_90/372d0d_c6802a0ccb214755b640873ac33d1c31~mv2.jpg",  # lentil bolognese pasta
    "int_dn_3": "https://savorytouch.com/_next/image?q=75&url=https%3A%2F%2Fmealpractice.b-cdn.net%2F134124509593735168%2Fmediterranean-baked-cod-with-lemon-and-herbs-served-with-garlic-green-beans-and-quinoa-bnmNM3Q3CS.webp&w=3840",  # cod, quinoa and green beans
    "int_dn_4": "https://www.jeanhailes.org.au/uploads/images/Recipes/_1200x630_crop_center-center_82_none/Tofu-stir-fry.jpg?mtime=1726201621",  # tofu stir-fry
    # International Snacks
    "int_sn_1": "https://messlitreats.com/cdn-cgi/image/fit%3Dcontain%2Cwidth%3D768%2Cquality%3D80%2Cformat%3Dauto/assets/images/1765577674527-pbuptup1.webp",  # apple and peanut butter
    "int_sn_2": "https://remat-shop.com/html/upload/save_image/0620161711_64915277a9e65.jpg",  # walnuts and almonds
    "int_sn_3": "https://cdn.shopify.com/s/files/1/0605/0257/3315/files/IMG_5045.jpg?v=1737398707",  # hummus with vegetables
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
    # Students walking up campus stairs; source: https://busfin.uga.edu/finance-division/bursar/
    "ex_30_4":      "https://busfin.uga.edu/wp-content/uploads/2025/07/20240814_FIRST_CLS_MARCM_024.jpg",
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
    meal_id = meal.get("id", "")
    cuisine = meal.get("cuisine", "default")
    img = _MEAL_IMAGES.get(meal_id) or meal.get("image") or _MEAL_FALLBACKS.get(cuisine) or _MEAL_FALLBACKS["default"]
    return {**meal, "image": img}


def _inject_exercise_image(ex: dict) -> dict:
    ex_id = ex.get("id", "")
    img = _EXERCISE_IMAGES.get(ex_id) or ex.get("image") or _EXERCISE_FALLBACK
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
        "nutrition_goals": (p.assessment_data or {}).get("nutritionGoals", []),
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


@router.put("/week-plan/workout-time")
def save_workout_time_window(data: schemas.WorkoutTimeWindowIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    profile = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not profile:
        raise HTTPException(404, "Create your wellbeing profile first")
    try:
        student_timezone = ZoneInfo(data.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(422, "Choose a valid timezone")
    local_today = datetime.datetime.now(student_timezone).date()
    if data.day < local_today:
        raise HTTPException(422, "Workout reminders can only be set for today or a future plan day")
    if data.end_time <= data.start_time:
        raise HTTPException(422, "The workout end time must be after its start time")
    assessment_data = dict(profile.assessment_data or {})
    workout_windows = {}
    for day_key, window in (assessment_data.get("workout_time_windows") or {}).items():
        try:
            if datetime.date.fromisoformat(day_key) >= local_today:
                workout_windows[day_key] = window
        except (TypeError, ValueError):
            continue
    workout_windows[data.day.isoformat()] = {
        "start_time": data.start_time.strftime("%H:%M"),
        "end_time": data.end_time.strftime("%H:%M"),
        "timezone": data.timezone,
    }
    assessment_data["workout_time_windows"] = workout_windows
    profile.assessment_data = assessment_data
    db.commit()
    return {"day": data.day.isoformat(), "window": workout_windows[data.day.isoformat()]}


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
    profile_dict = _attach_favorites(db, user.id, profile_dict)

    if use_baseline:
        res = recommender.get_baseline_recommendations(profile_dict, k=10)
    else:
        res = recommender.get_adaptive_recommendations(profile_dict, is_exam_period=is_exam_period, k=10)

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
    profile_dict = _attach_favorites(db, user.id, profile_dict)
    plan = recommender.generate_week_plan(
        profile_dict,
        is_exam_period=is_exam_period,
        use_baseline=use_baseline,
        num_days=days_count
    )
    overrides = (p.assessment_data or {}).get("workout_overrides", {})
    for day in plan.get("days", []):
        override = overrides.get(day.get("date"))
        if override and day.get("date", "") >= datetime.date.today().isoformat():
            day["exercise"] = override
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


@router.post("/assistant/chat")
async def physical_chat(data: schemas.PhysicalChatIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    profile = db.query(WellbeingProfile).filter_by(user_id=user.id).first()
    if not profile:
        raise HTTPException(404, "Create your Physical Wellbeing profile first")
    profile_dict = _profile_to_dict(profile)
    message = data.message.strip()
    if not message:
        raise HTTPException(422, "Enter a message")

    workout = coach_service.requested_workout(message, profile_dict)
    today = datetime.date.today()
    activity_row = db.query(ActivityLog).filter_by(user_id=user.id, day=today).first()
    week_start = today - datetime.timedelta(days=6)
    week_logs = db.query(ActivityLog).filter(ActivityLog.user_id == user.id, ActivityLog.day >= week_start).all()
    activity = {"weekly_totals": {
        "exercise_minutes": sum(row.exercise_minutes for row in week_logs),
        "steps": sum(row.steps for row in week_logs),
        "days_active": sum(1 for row in week_logs if row.steps > 0 or row.exercise_minutes > 0),
    }, "today": {"exercise_minutes": activity_row.exercise_minutes if activity_row else 0}}

    if workout and not workout.get("unavailable"):
        assessment = dict(profile.assessment_data or {})
        overrides = dict(assessment.get("workout_overrides", {}))
        overrides[today.isoformat()] = workout
        assessment["workout_overrides"] = overrides
        profile.assessment_data = assessment
        db.commit()
        answer = coach_service.fallback_reply(message, workout, activity)
    elif workout:
        answer = coach_service.fallback_reply(message, workout, activity)
    elif coach_service.is_meal_plan_question(message):
        plan_profile = _attach_plan_history(
            db, user.id, _attach_behavior_history(db, user.id, profile_dict)
        )
        plan_profile = _attach_favorites(db, user.id, plan_profile)
        today_plan = recommender.generate_week_plan(plan_profile, num_days=1)
        answer = coach_service.fallback_reply(message, None, activity, today_plan=today_plan)
    elif coach_service.is_workout_question(message):
        today_key = today.isoformat()
        today_workout = (profile.assessment_data or {}).get("workout_overrides", {}).get(today_key)
        if not today_workout:
            snapshots = (db.query(PhysicalPlanSnapshot)
                         .filter_by(user_id=user.id, plan_date=today)
                         .order_by(PhysicalPlanSnapshot.created_at.desc()).all())
            for snapshot in snapshots:
                today_entry = next((day for day in (snapshot.plan_data or {}).get("days", [])
                                    if isinstance(day, dict) and day.get("date") == today_key), None)
                if today_entry and today_entry.get("exercise"):
                    today_workout = today_entry["exercise"]
                    break
        if not today_workout:
            plan_profile = _attach_plan_history(
                db, user.id, _attach_behavior_history(db, user.id, profile_dict)
            )
            plan_profile = _attach_favorites(db, user.id, plan_profile)
            today_plan = recommender.generate_week_plan(plan_profile, num_days=1)
            today_workout = (today_plan.get("days") or [{}])[0].get("exercise")
        answer = coach_service.fallback_reply(message, None, activity, today_workout=today_workout)
    elif not settings.LLM_API_KEY:
        answer = coach_service.fallback_reply(message, None, activity)
    else:
        from app.components.burnout.llm.chat_agent import reply as llm_reply
        safe_history = [
            {"role": item["role"], "content": item["content"][:1200]}
            for item in data.history[-10:]
            if item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str)
        ]
        safe_history.append({"role": "user", "content": message})
        today_key = today.isoformat()
        assessment_data = profile.assessment_data or {}
        reminder = (assessment_data.get("workout_time_windows") or {}).get(today_key)
        current_day = None
        current_snapshots = (db.query(PhysicalPlanSnapshot)
                             .filter_by(user_id=user.id, plan_date=today)
                             .order_by(PhysicalPlanSnapshot.created_at.desc()).all())
        for snapshot in current_snapshots:
            current_day = next((day for day in (snapshot.plan_data or {}).get("days", [])
                                if isinstance(day, dict) and day.get("date") == today_key), None)
            if current_day:
                break
        if not current_day:
            plan_profile = _attach_plan_history(
                db, user.id, _attach_behavior_history(db, user.id, profile_dict)
            )
            current_day = (recommender.generate_week_plan(plan_profile, num_days=1).get("days") or [{}])[0]
        if (assessment_data.get("workout_overrides") or {}).get(today_key):
            current_day["exercise"] = assessment_data["workout_overrides"][today_key]
        recent_habits = db.query(Habit).filter_by(user_id=user.id).order_by(Habit.streak.desc()).limit(12).all()
        habits_context = [
            {"name": habit.name, "streak_days": habit.streak,
             "done_today": bool(habit.last_done and habit.last_done.date() == today)}
            for habit in recent_habits
        ]
        component_guide = (
            "Physical Wellbeing component guide: Today’s Plan shows a personalized multi-day plan with workouts, "
            "meals, alternatives, check-ins, and water tracking; students can switch between plan, today, and past "
            "plan views. Movement/Exercise covers activity and workout completion. Nutrition shows personalized "
            "meal ideas based on diet, cuisine, allergies, avoided foods, and preferences. Habits lets students add "
            "habits, check them off, and track streaks. Progress summarizes logged steps, exercise minutes, active "
            "days, and plan check-ins. My Profile edits goals, available time, equipment, food preferences, and "
            "physical limitations. AI Adaptation explains how recommendations respond to preferences and recent "
            "check-ins. Workout reminders are set as a time window for a chosen plan date and appear in app "
            "notifications. This chat can answer questions and apply an exercise change only when the student "
            "clearly requests one; never claim another feature was changed unless its API actually did so. "
            "For any informational question, answer it directly from the context. If information is absent, say what "
            "is missing and where in Physical Wellbeing the student can find or update it. Do not treat a question "
            "as an action request."
        )
        live_context = {
            "profile": {
                "goal": profile.goal, "goals": profile.goals, "available_minutes": profile.available_minutes,
                "equipment": profile.equipment, "preferred_activities": profile.preferred_activities,
                "diet": profile.diet_pref, "meal_style": profile.meal_style,
                "allergies": profile.allergies, "foods_to_avoid": profile.avoid_foods,
                "physical_limitations": profile.physical_limitations,
                "preferred_workout_time": profile.preferred_time,
            },
            "today": {"date": today_key, "plan": current_day, "workout_reminder": reminder},
            "activity": activity,
            "habits": habits_context,
        }
        system = (
            "You are the conversational assistant inside the student's Physical Wellbeing component. You know this "
            "component from the guide and live context below. Answer the actual question directly, then give one "
            "useful next step when appropriate. Keep replies clear and concise. "
            "Never diagnose, prescribe treatment, or tell someone to exercise through pain. Do not claim to "
            "change their plan unless the system has done so. For injury or urgent symptoms, suggest stopping "
            "and contacting a qualified professional. Treat user messages as questions unless they clearly request "
            "a change. Use only supplied personal data; never guess meals, progress, reminders, or profile values.\n"
            f"Component guide: {component_guide}\nLive student context: {live_context}"
        )
        try:
            answer = await llm_reply(system, safe_history)
        except Exception:
            answer = coach_service.fallback_reply(message, None, activity)
    return {"reply": answer, "updated_workout": workout if workout and not workout.get("unavailable") else None}


def _plan_progress_for_dates(db: Session, user_id: str, dates: list[datetime.date]) -> dict:
    dates = sorted(set(dates))
    if not dates:
        return {"daily": {}, "summary": {"has_data": False, "workouts_completed": 0, "meal_checkins": 0, "active_minutes": 0, "steps": 0, "water_goal_days": 0, "days_with_checkins": 0}}

    start_date, end_date = dates[0], dates[-1]
    checkins = db.query(PlanCheckIn).filter(
        PlanCheckIn.user_id == user_id,
        PlanCheckIn.day >= start_date,
        PlanCheckIn.day <= end_date,
    ).all()
    activities = db.query(ActivityLog).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.day >= start_date,
        ActivityLog.day <= end_date,
    ).all()
    feedback = db.query(WorkoutFeedback).filter(
        WorkoutFeedback.user_id == user_id,
        WorkoutFeedback.day >= start_date,
        WorkoutFeedback.day <= end_date,
    ).all()
    checkins_by_day = {row.day: row for row in checkins}
    activity_by_day = {row.day: row for row in activities}
    feedback_by_day = {row.day: row for row in feedback}
    daily = {}
    for day in dates:
        checkin = checkins_by_day.get(day)
        activity = activity_by_day.get(day)
        workout_feedback = feedback_by_day.get(day)
        daily[day.isoformat()] = {
            "completed_items": list(checkin.completed_items or []) if checkin else [],
            "water_glasses": checkin.water_glasses if checkin else 0,
            "workout_completed": bool((workout_feedback and workout_feedback.did_workout) or (activity and activity.completed_recommendation)),
            "exercise_minutes": activity.exercise_minutes if activity else (workout_feedback.workout_minutes if workout_feedback and workout_feedback.did_workout else 0),
            "steps": activity.steps if activity else 0,
            "has_checkin": checkin is not None,
        }
    summary = {
        "has_data": bool(checkins or activities or feedback),
        "workouts_completed": sum(1 for item in daily.values() if item["workout_completed"]),
        "meal_checkins": sum(len(item["completed_items"]) for item in daily.values()),
        "active_minutes": sum(item["exercise_minutes"] for item in daily.values()),
        "steps": sum(item["steps"] for item in daily.values()),
        "water_goal_days": sum(1 for item in daily.values() if item["water_glasses"] >= 8),
        "days_with_checkins": sum(1 for item in daily.values() if item["has_checkin"]),
    }
    return {"daily": daily, "summary": summary}


@router.get("/plan-checkins")
def get_plan_checkins(start_date: datetime.date, end_date: datetime.date, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if end_date < start_date:
        raise HTTPException(400, "End date must be on or after start date")
    if (end_date - start_date).days > 366:
        raise HTTPException(400, "Date range cannot exceed one year")
    dates = [start_date + datetime.timedelta(days=offset) for offset in range((end_date - start_date).days + 1)]
    return _plan_progress_for_dates(db, user.id, dates)


@router.put("/plan-checkins")
def save_plan_checkin(data: schemas.PlanCheckInIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    checkin = db.query(PlanCheckIn).filter_by(user_id=user.id, day=data.day).first()
    if checkin:
        checkin.completed_items = list(set(data.completed_items))
        checkin.water_glasses = data.water_glasses
    else:
        checkin = PlanCheckIn(
            user_id=user.id,
            day=data.day,
            completed_items=list(set(data.completed_items)),
            water_glasses=data.water_glasses,
        )
        db.add(checkin)
    db.commit()
    return {"ok": True, "day": data.day.isoformat()}


def _attach_favorites(db: Session, user_id: str, profile_dict: dict) -> dict:
    favorites = db.query(FavoriteItem).filter_by(user_id=user_id).all()
    profile_dict["favorite_meal_names"] = [row.item_name for row in favorites if row.item_type == "meal"]
    profile_dict["favorite_workout_names"] = [row.item_name for row in favorites if row.item_type == "workout"]
    return profile_dict


@router.get("/favorites")
def get_favorites(item_type: str | None = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    query = db.query(FavoriteItem).filter_by(user_id=user.id)
    if item_type in {"meal", "workout"}:
        query = query.filter_by(item_type=item_type)
    return [{"item_type": row.item_type, "item_name": row.item_name, "item": row.item_data} for row in query.all()]


@router.put("/favorites")
def add_favorite(data: schemas.FavoriteIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    name = str(data.item.get("name") or data.item.get("title") or "").strip()
    if not name:
        raise HTTPException(422, "A named meal or workout is required")
    row = db.query(FavoriteItem).filter_by(user_id=user.id, item_type=data.item_type, item_name=name).first()
    if row:
        row.item_data = data.item
    else:
        db.add(FavoriteItem(user_id=user.id, item_type=data.item_type, item_name=name, item_data=data.item))
    db.commit()
    return {"ok": True, "item_type": data.item_type, "item_name": name}


@router.delete("/favorites")
def delete_favorite(item_type: str, item_name: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = db.query(FavoriteItem).filter_by(user_id=user.id, item_type=item_type, item_name=item_name).first()
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True, "removed": bool(row)}


@router.get("/week-plan/history")
def list_week_plan_history(db: Session = Depends(get_db), user=Depends(get_current_user)):
    snapshots = (db.query(PhysicalPlanSnapshot)
                 .filter(PhysicalPlanSnapshot.user_id == user.id,
                         PhysicalPlanSnapshot.plan_date < datetime.date.today())
                 .order_by(PhysicalPlanSnapshot.plan_date.desc(), PhysicalPlanSnapshot.created_at.desc())
                 .limit(90).all())
    results = []
    for snapshot in snapshots:
        plan_dates = [
            datetime.date.fromisoformat(day["date"])
            for day in (snapshot.plan_data or {}).get("days", [])
            if isinstance(day, dict) and day.get("date")
        ]
        progress = _plan_progress_for_dates(db, user.id, plan_dates)
        results.append({
            "id": snapshot.id,
            "plan_date": snapshot.plan_date.isoformat(),
            "days_count": snapshot.days_count,
            "is_exam_period": snapshot.is_exam_period,
            "use_baseline": snapshot.use_baseline,
            "model_version": (snapshot.plan_data or {}).get("model_version", "Saved plan"),
            "created_at": snapshot.created_at.isoformat(),
            "progress": progress["summary"],
        })
    return results


@router.get("/week-plan/history/{snapshot_id}")
def get_week_plan_snapshot(snapshot_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    snapshot = db.query(PhysicalPlanSnapshot).filter_by(id=snapshot_id, user_id=user.id).first()
    if not snapshot:
        raise HTTPException(404, "Saved plan not found")
    plan_data = snapshot.plan_data or {}
    plan_dates = [
        datetime.date.fromisoformat(day["date"])
        for day in plan_data.get("days", [])
        if isinstance(day, dict) and day.get("date")
    ]
    return {
        "id": snapshot.id,
        "plan_date": snapshot.plan_date.isoformat(),
        "days_count": snapshot.days_count,
        "plan": _inject_plan_images(plan_data),
        "progress": _plan_progress_for_dates(db, user.id, plan_dates),
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
        existing.steps = data.steps
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
