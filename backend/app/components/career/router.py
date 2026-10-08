from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.dependencies import get_current_user
from app.components.career import schemas, service
from app.components.career.models import CareerProfile
from app.components.career.ml import interview_eval
from app.components.career.routes import router as acrds_router

router = APIRouter()
# ACRDS MVP endpoints (health, recommend-careers, gap-analysis, roadmap, careers)
router.include_router(acrds_router)


def _profile(db, user):
    p = db.query(CareerProfile).filter_by(user_id=user.id).first()
    if not p:
        raise HTTPException(404, "Complete the career questionnaire first")
    return p


@router.post("/profile")
def submit_profile(data: schemas.ProfileIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return {"id": service.save_profile(db, user.id, data).id}


@router.get("/recommendations", response_model=list[schemas.CareerMatch])
def recommendations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return service.top_careers(_profile(db, user))


@router.get("/skill-gap/{career}")
def skill_gap(career: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    gap, steps = service.gap_and_roadmap(_profile(db, user), career)
    return {"gap": gap, "roadmap": steps}


@router.post("/interview/answer")
def evaluate_answer(data: schemas.AnswerIn, user=Depends(get_current_user)):
    reference = f"A strong answer about {data.question} using the STAR method with a concrete result."
    return {"content_score": interview_eval.content_score(data.answer, reference),
            "voice": interview_eval.voice_feedback(data.speech_rate_wpm, data.filler_count),
            "face": interview_eval.face_feedback(data.eye_contact_ratio)}
