"""
ACRDS MVP endpoints (mounted under /api/career via router.py).

VIVA: "Routes only validate input and call services - all logic lives in
services/, so it can be unit-tested without the web layer."
These endpoints are stateless: the profile is sent in the request body,
so they can be demonstrated directly from Swagger (/docs).
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import get_db

from app.components.career.schemas import (
    CareerSelectionRequest,
    GapAnalysisResponse,
    CoachFeedbackResponse,
    CVAssistRequest,
    CVAssistResponse,
    CVDocument,
    CVOut,
    InterviewAnswerRequest,
    InterviewHistoryIn,
    InterviewHistoryItem,
    SavedStateIn,
    SavedStateOut,
    InterviewFeedback,
    InterviewQuestionSet,
    InterviewReport,
    InterviewReportRequest,
    RecommendationResponse,
    RoadmapResponse,
    StudentCareerProfile,
    to_dict,
)
from app.components.career.services import i18n
from app.components.career.services.career_data import get_career, load_careers
from app.components.career.services.career_model import model_applies, model_info
from app.components.career.services.gap_analysis import analyse_gaps
from app.components.career.services.interview_evaluator import build_report, evaluate_answer
from app.components.career.services.interview_questions import get_question, select_questions
from app.components.career.services.llm_feedback import generate_llm_feedback, llm_status
from app.components.career.services.persona import assign_persona, load_persona_model
from app.components.career.services.recommender import recommend_careers
from app.components.career.services import cv_assistant, cv_store, saved_state
from app.components.career.services.roadmap import career_milestones, generate_roadmap

router = APIRouter()

# Optional ?language=en|si|ta on every endpoint. It changes only the text the student reads
# (names, explanations, feedback), never a score, ranking or gap - those are computed in English.
Language = Query("en", pattern="^(en|si|ta)$", description="Text language: en (English), si (Sinhala), ta (Tamil)")


def _career_or_404(career_id: str) -> dict:
    career = get_career(career_id)
    if not career:
        raise HTTPException(404, f"Unknown career_id '{career_id}'")
    return career


@router.get("/health")
def health():
    return {"status": "running", "component": "Career Readiness (ACRDS)",
            "careers_loaded": len(load_careers()), "trained_model": model_info(),
            "llm_feedback": llm_status(), "persona_model": load_persona_model() is not None}


@router.get("/careers")
def list_careers(language: str = Language):
    """All careers; with ?language=si|ta the name, area and description are translated."""
    return [{**c, **{f: i18n.career_field(c, f, language) for f in ("career_name", "career_area", "description")}}
            for c in load_careers()]


@router.get("/careers/{career_id}")
def career_detail(career_id: str):
    return _career_or_404(career_id)


@router.post("/recommend-careers", response_model=RecommendationResponse)
def recommend(profile: StudentCareerProfile, language: str = Language):
    info = model_info()
    data = to_dict(profile)
    if not info["loaded"]:
        method = "cosine (no trained model found)"
    elif not model_applies(data):
        method = f"cosine (trained model not used: too few {profile.faculty_field} students in its training data)"
    else:
        method = f"hybrid: {info['alpha']} x {info['model']} family model + {round(1 - info['alpha'], 1)} x cosine"
    return {"student_id": profile.student_id, "scoring_method": method,
            "persona": assign_persona(data["skills"], language),
            "recommendations": recommend_careers(data, lang=language)}


@router.post("/gap-analysis", response_model=GapAnalysisResponse)
def gap_analysis(body: CareerSelectionRequest, language: str = Language):
    return analyse_gaps(to_dict(body.profile), _career_or_404(body.career_id), language)


@router.post("/roadmap", response_model=RoadmapResponse)
def roadmap(body: CareerSelectionRequest, language: str = Language):
    career = _career_or_404(body.career_id)
    gaps = analyse_gaps(to_dict(body.profile), career, language)
    items = generate_roadmap(gaps, language)
    message = (i18n.t(language, "roadmap_message", n=len(items), career=gaps["career_name"]) if items
               else i18n.t(language, "roadmap_message_done", career=gaps["career_name"]))
    return {"career_id": gaps["career_id"], "career_name": gaps["career_name"],
            "readiness_percentage": gaps["readiness_percentage"], "roadmap": items, "message": message,
            "milestones": career_milestones(career, language)}


# ---------------------------------------------------------------------------
# AI Interview Simulator
# ---------------------------------------------------------------------------
def privacy_notes(lang: str = "en") -> list[str]:
    return [i18n.t(lang, f"privacy_{n}") for n in (1, 2, 3)]


PRIVACY_NOTES = privacy_notes()  # English (kept for existing imports)


@router.get("/interview/questions/{career_id}", response_model=InterviewQuestionSet)
def interview_questions(career_id: str, variant: int = 0, language: str = Language):
    career = _career_or_404(career_id)
    return {"career_id": career_id, "career_name": i18n.career_field(career, "career_name", language),
            "variant": variant, "questions": select_questions(career_id, variant, language),
            "privacy_notes": privacy_notes(language)}


@router.post("/interview/evaluate", response_model=InterviewFeedback)
def interview_evaluate(body: InterviewAnswerRequest, language: str = Language):
    _career_or_404(body.career_id)
    question = get_question(body.question_id)
    if not question:
        raise HTTPException(404, f"Unknown question_id '{body.question_id}'")
    result = evaluate_answer(question, body.answer_text, body.mode, body.speaking_seconds,
                             body.face_presence_ratio, body.facing_camera_ratio, body.frames_analyzed, language)
    # Scoring is finished. The LLM (if configured and allowed) only adds richer written feedback;
    # on any failure it returns None and the rule-based feedback above is used as-is.
    llm = generate_llm_feedback(question, body.answer_text, result, lang=language) if body.use_llm else None
    result["llm_feedback"] = llm
    result["feedback_source"] = f"rule-based + LLM ({llm['provider']})" if llm else "rule-based"
    return result


@router.post("/interview/coach-feedback", response_model=CoachFeedbackResponse)
def interview_coach_feedback(body: InterviewAnswerRequest, language: str = Language):
    """AI coach feedback on its own endpoint, so the UI can show the scores first
    (LLMs can take 10-40 s) and add the coach feedback when it arrives."""
    _career_or_404(body.career_id)
    question = get_question(body.question_id)
    if not question:
        raise HTTPException(404, f"Unknown question_id '{body.question_id}'")
    if not body.use_llm:
        return {"llm_feedback": None}
    result = evaluate_answer(question, body.answer_text, body.mode, body.speaking_seconds,
                             body.face_presence_ratio, body.facing_camera_ratio, body.frames_analyzed, language)
    return {"llm_feedback": generate_llm_feedback(question, body.answer_text, result, lang=language)}


@router.post("/interview/report", response_model=InterviewReport)
def interview_report(body: InterviewReportRequest, language: str = Language):
    career = _career_or_404(body.career_id)
    return build_report(i18n.career_field(career, "career_name", language), [to_dict(r) for r in body.results],
                        language)


# ---------------------------------------------------------------------------
# Saved progress - requires login; each student only ever sees their own data
# ---------------------------------------------------------------------------
@router.get("/me/state", response_model=SavedStateOut)
def get_my_state(db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = saved_state.get_state(db, user.id)
    return {"user_id": user.id, "data": row.data if row else {}, "updated_at": row.updated_at if row else None}


@router.put("/me/state", response_model=SavedStateOut)
def save_my_state(body: SavedStateIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if saved_state.state_too_large(body.data):
        raise HTTPException(413, "Saved career data is too large")
    row = saved_state.save_state(db, user.id, body.data)
    return {"user_id": user.id, "data": row.data, "updated_at": row.updated_at}


@router.delete("/me/state", status_code=204)
def clear_my_state(db: Session = Depends(get_db), user=Depends(get_current_user)):
    saved_state.clear_state(db, user.id)


@router.post("/me/interviews", response_model=InterviewHistoryItem)
def save_my_interview(body: InterviewHistoryIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    _career_or_404(body.career_id)
    row = saved_state.save_interview(db, user.id, body.career_id, to_dict(body.report))
    return _history_item(row)


@router.get("/me/interviews", response_model=list[InterviewHistoryItem])
def my_interviews(limit: int = 10, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return [_history_item(r) for r in saved_state.list_interviews(db, user.id, min(max(limit, 1), 50))]


def _history_item(row) -> dict:
    report = row.report or {}
    return {"id": row.id, "career_id": row.career, "career_name": report.get("career_name", row.career),
            "overall_score": report.get("overall_score", 0), "readiness_band": report.get("readiness_band", ""),
            "questions_answered": report.get("questions_answered", 0), "created_at": row.created_at}



# ---------------------------------------------------------------------------
# CV Builder (login required; each student can only reach their own CV)
# ---------------------------------------------------------------------------
@router.get("/me/cv", response_model=CVOut)
def get_my_cv(db: Session = Depends(get_db), user=Depends(get_current_user)):
    row = cv_store.get_cv(db, user.id)
    return {"cv": row.data if row else None, "updated_at": row.updated_at if row else None}


@router.put("/me/cv", response_model=CVOut)
def save_my_cv(body: CVDocument, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if body.career_id:
        _career_or_404(body.career_id)
    row = cv_store.save_cv(db, user.id, body.model_dump())
    return {"cv": row.data, "updated_at": row.updated_at}


@router.delete("/me/cv", status_code=204)
def delete_my_cv(db: Session = Depends(get_db), user=Depends(get_current_user)):
    cv_store.delete_cv(db, user.id)


@router.post("/cv/assist", response_model=CVAssistResponse)
def cv_assist(body: CVAssistRequest, user=Depends(get_current_user)):
    """Optional AI wording help. 503 when AI is not configured or the provider failed -
    the CV Builder then simply keeps working without it."""
    career = _career_or_404(body.career_id) if body.career_id else None
    request = body.model_dump()
    if not cv_assistant.task_payload(request):
        raise HTTPException(422, "Write some text first, then ask the AI to improve it.")
    if not llm_status()["enabled"]:
        raise HTTPException(503, "AI assistance is not available right now. You can keep writing your CV yourself.")
    result = cv_assistant.assist(request, career)
    if result is None:
        raise HTTPException(503, "The AI assistant did not respond. Please try again, or keep writing yourself.")
    return result
