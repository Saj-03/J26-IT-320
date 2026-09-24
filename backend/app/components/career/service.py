"""Business logic layer - router calls service, service calls ml/."""
from sqlalchemy.orm import Session
from app.components.career.models import CareerProfile
from app.components.career.ml import recommender, skill_gap, roadmap


def save_profile(db: Session, user_id: str, data) -> CareerProfile:
    profile = db.query(CareerProfile).filter_by(user_id=user_id).first() or CareerProfile(user_id=user_id)
    for k, v in data.model_dump().items():
        setattr(profile, k, v)
    db.add(profile); db.commit(); db.refresh(profile)
    return profile


def top_careers(profile: CareerProfile):
    return recommender.recommend(profile.skills, profile.interests, profile.extracurricular)


def gap_and_roadmap(profile: CareerProfile, career: str):
    gap = skill_gap.analyse(career, profile.skills)
    return gap, roadmap.generate(gap["missing"])
