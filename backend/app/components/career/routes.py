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
    InterviewAnswerRequest,
    InterviewFeedback,
    InterviewQuestionSet,
    InterviewReport,
    InterviewReportRequest,
    RecommendationResponse,
    RoadmapResponse,
    StudentCareerProfile,
    to_dict,
)
from app.components.career.services.career_data import get_career, load_careers
from app.components.career.services.career_model import model_info
from app.components.career.services.gap_analysis import analyse_gaps
from app.components.career.services.interview_evaluator import build_report, evaluate_answer
from app.components.career.services.interview_questions import get_question, has_questions, select_questions
from app.components.career.services.llm_feedback import generate_llm_feedback, llm_status
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
            "careers_loaded": len(load_careers()), "trained_model": model_info(),
            "llm_feedback": llm_status()}


@router.get("/careers")
def list_careers():
    return list(load_careers())


@router.get("/careers/{career_id}")
def career_detail(career_id: str):
    return _career_or_404(career_id)


@router.post("/recommend-careers", response_model=RecommendationResponse)
def recommend(profile: StudentCareerProfile):
    info = model_info()
    method = (f"hybrid: {info['alpha']} x {info['model']} family model + {round(1 - info['alpha'], 1)} x cosine"
              if info["loaded"] else "cosine (no trained model found)")
    return {"student_id": profile.student_id, "scoring_method": method,
            "recommendations": recommend_careers(to_dict(profile))}


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


# ---------------------------------------------------------------------------
# AI Interview Simulator
# ---------------------------------------------------------------------------
PRIVACY_NOTES = [
    "Interview practice feedback is advisory.",
    "Raw audio/video will not be stored.",
    "Facial presence refers only to observable presentation cues, not personality or emotion detection.",
]


@router.get("/interview/questions/{career_id}", response_model=InterviewQuestionSet)
def interview_questions(career_id: str, variant: int = 0):
    career = _career_or_404(career_id)
    if not has_questions(career_id):
        raise HTTPException(404, f"No interview questions for '{career_id}'")
    return {"career_id": career_id, "career_name": career["career_name"], "variant": variant,
            "questions": select_questions(career_id, variant), "privacy_notes": PRIVACY_NOTES}


@router.post("/interview/evaluate", response_model=InterviewFeedback)
def interview_evaluate(body: InterviewAnswerRequest):
    _career_or_404(body.career_id)
    question = get_question(body.question_id)
    if not question:
        raise HTTPException(404, f"Unknown question_id '{body.question_id}'")
    result = evaluate_answer(question, body.answer_text, body.mode, body.speaking_seconds,
                             body.face_presence_ratio, body.facing_camera_ratio, body.frames_analyzed)
    # Scoring is finished. The LLM (if configured and allowed) only adds richer written feedback;
    # on any failure it returns None and the rule-based feedback above is used as-is.
    llm = generate_llm_feedback(question, body.answer_text, result) if body.use_llm else None
    result["llm_feedback"] = llm
    result["feedback_source"] = f"rule-based + LLM ({llm['provider']})" if llm else "rule-based"
    return result


@router.post("/interview/report", response_model=InterviewReport)
def interview_report(body: InterviewReportRequest):
    career = _career_or_404(body.career_id)
    return build_report(career["career_name"], [to_dict(r) for r in body.results])
