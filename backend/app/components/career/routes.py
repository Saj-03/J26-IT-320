"""
ACRDS MVP endpoints (mounted under /api/career via router.py).

VIVA: "Routes only validate input and call services - all logic lives in
services/, so it can be unit-tested without the web layer."
These endpoints are stateless: the profile is sent in the request body,
so they can be demonstrated directly from Swagger (/docs).
"""
from fastapi import APIRouter, HTTPException

from app.components.career.schemas import (
    CareerSelectionRequest,
    GapAnalysisResponse,
    RecommendationResponse,
    RoadmapResponse,
    StudentCareerProfile,
    to_dict,
)
from app.components.career.services.career_data import get_career, load_careers
from app.components.career.services.gap_analysis import analyse_gaps
from app.components.career.services.recommender import recommend_careers
from app.components.career.services.roadmap import generate_roadmap

router = APIRouter()


def _career_or_404(career_id: str) -> dict:
    career = get_career(career_id)
    if not career:
        raise HTTPException(404, f"Unknown career_id '{career_id}'")
    return career


@router.get("/health")
def health():
    return {"status": "running", "component": "Career Readiness (ACRDS)",
            "careers_loaded": len(load_careers())}


@router.get("/careers")
def list_careers():
    return list(load_careers())


@router.get("/careers/{career_id}")
def career_detail(career_id: str):
    return _career_or_404(career_id)


@router.post("/recommend-careers", response_model=RecommendationResponse)
def recommend(profile: StudentCareerProfile):
    return {"student_id": profile.student_id, "recommendations": recommend_careers(to_dict(profile))}


@router.post("/gap-analysis", response_model=GapAnalysisResponse)
def gap_analysis(body: CareerSelectionRequest):
    return analyse_gaps(to_dict(body.profile), _career_or_404(body.career_id))


@router.post("/roadmap", response_model=RoadmapResponse)
def roadmap(body: CareerSelectionRequest):
    gaps = analyse_gaps(to_dict(body.profile), _career_or_404(body.career_id))
    items = generate_roadmap(gaps)
    message = (f"{len(items)} skill(s) to develop for {gaps['career_name']}." if items
               else f"You already meet every core skill level for {gaps['career_name']}.")
    return {"career_id": gaps["career_id"], "career_name": gaps["career_name"],
            "readiness_percentage": gaps["readiness_percentage"], "roadmap": items, "message": message}
