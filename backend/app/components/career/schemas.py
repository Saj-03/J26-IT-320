"""
ACRDS request/response schemas.

VIVA: "Pydantic validates every request before it reaches the logic, so a
skill rating of 7 or a confidence of 0 is rejected with a clear 422 error."
"""
from typing import Literal, Optional

from pydantic import BaseModel, Field

# Fixed skill order - used for both the student vector and the career vector.
SKILL_KEYS = [
    "digital_literacy",
    "communication",
    "problem_solving",
    "leadership",
    "teamwork",
    "research",
    "data_analysis",
    "documentation",
    "creativity",
]


def to_dict(model: BaseModel) -> dict:
    """Works on Pydantic v2 (model_dump) and v1 (dict)."""
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


# ---------------------------------------------------------------------------
# Student career profile (survey input)
# ---------------------------------------------------------------------------
class SkillRatings(BaseModel):
    """Self-rated skills on a 1-5 scale."""
    digital_literacy: int = Field(..., ge=1, le=5)
    communication: int = Field(..., ge=1, le=5)
    problem_solving: int = Field(..., ge=1, le=5)
    leadership: int = Field(..., ge=1, le=5)
    teamwork: int = Field(..., ge=1, le=5)
    research: int = Field(..., ge=1, le=5)
    data_analysis: int = Field(..., ge=1, le=5)
    documentation: int = Field(..., ge=1, le=5)
    creativity: int = Field(..., ge=1, le=5)


class StudentCareerProfile(BaseModel):
    student_id: Optional[str] = None

    # Academic details
    academic_status: str = ""
    employment_status: str = ""
    faculty_field: str = ""
    degree_programme: str = ""
    academic_performance_trend: str = ""

    # Career details
    career_area_interest: str = ""
    preferred_career_role: str = ""
    career_confidence: int = Field(3, ge=1, le=5)
    previous_career_preference: str = ""

    # Skill ratings (1-5)
    skills: SkillRatings

    # Learning details
    preferred_learning_method: str = ""
    skill_learning_consistency: str = ""

    # Extracurricular details
    extracurricular_participation: str = ""
    extracurricular_type: str = ""
    highest_extracurricular_role: str = ""

    # Career readiness
    career_related_work_status: str = ""
    career_related_work_type: str = ""
    career_support_needed: list[str] = []


class CareerSelectionRequest(BaseModel):
    """Body for gap analysis and roadmap: the profile plus the chosen career."""
    career_id: str
    profile: StudentCareerProfile


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------
class CareerRecommendation(BaseModel):
    career_id: str
    career_name: str
    career_area: str
    description: str
    match_percentage: float
    skill_match_percentage: Optional[float] = None   # cosine skill match only
    model_probability: Optional[float] = None        # trained model's P(career family), if loaded
    explanation: str
    matching_skills: list[str]
    missing_skills: list[str]
    recommended_courses: list[str]
    recommended_projects: list[str]
    recommended_certifications: list[str]


class RecommendationResponse(BaseModel):
    student_id: Optional[str] = None
    scoring_method: str = "cosine"
    recommendations: list[CareerRecommendation]


class SkillGap(BaseModel):
    skill: str
    current_level: int
    required_level: int
    gap: int
    status: str  # Strong | Needs Improvement | Critical Gap


class GapAnalysisResponse(BaseModel):
    career_id: str
    career_name: str
    readiness_percentage: float
    skill_gaps: list[SkillGap]


class RoadmapItem(BaseModel):
    skill: str
    priority: str  # High | Medium
    course: str
    project: str
    task: str
    estimated_time: str
    reason: str


class RoadmapResponse(BaseModel):
    career_id: str
    career_name: str
    readiness_percentage: float
    roadmap: list[RoadmapItem]
    message: str


# ---------------------------------------------------------------------------
# AI Interview Simulator
# ---------------------------------------------------------------------------
class InterviewQuestionOut(BaseModel):
    id: str
    category: str  # Introduction | Technical | Behavioural
    question: str
    tip: str


class InterviewQuestionSet(BaseModel):
    career_id: str
    career_name: str
    variant: int
    questions: list[InterviewQuestionOut]
    privacy_notes: list[str]


class InterviewAnswerRequest(BaseModel):
    """Only text and numbers are accepted - never audio or video."""
    career_id: str
    question_id: str
    answer_text: str = Field(..., min_length=1, max_length=5000)
    mode: Literal["text", "voice"] = "text"
    speaking_seconds: Optional[float] = Field(None, ge=0, le=1800)
    # Computed in the browser by MediaPipe face detection (camera mode only)
    face_presence_ratio: Optional[float] = Field(None, ge=0, le=1)
    facing_camera_ratio: Optional[float] = Field(None, ge=0, le=1)
    frames_analyzed: Optional[int] = Field(None, ge=0)
    # Student opt-out: False keeps the answer text on our server (rule-based feedback only)
    use_llm: bool = True


class StarStructure(BaseModel):
    situation: bool
    task: bool
    action: bool
    result: bool
    score: float


class ContentScore(BaseModel):
    score: float
    semantic_similarity: float
    keyword_coverage: float
    matched_keywords: list[str]
    missing_keywords: list[str]
    structure: Optional[StarStructure] = None
    word_count: int
    scoring_method: str


class DeliveryScore(BaseModel):
    score: float
    words_per_minute: float
    speaking_seconds: float
    filler_count: int
    filler_words: list[str]
    pace_feedback: str


class PresentationScore(BaseModel):
    score: float
    face_presence_ratio: float
    facing_camera_ratio: float
    frames_analyzed: int
    feedback: list[str]


class LLMFeedback(BaseModel):
    """Optional coach-style feedback written by an LLM after normal scoring."""
    strengths: list[str]
    improvements: list[str]
    suggested_answer: str
    final_tip: str
    provider: str
    model: str


class InterviewFeedback(BaseModel):
    question_id: str
    question: str
    category: str
    mode: str
    overall_score: float
    content: ContentScore
    delivery: Optional[DeliveryScore] = None
    presentation: Optional[PresentationScore] = None
    strengths: list[str]
    improvements: list[str]
    sample_answer: str
    disclaimer: str
    llm_feedback: Optional[LLMFeedback] = None   # None = rule-based feedback only
    feedback_source: str = "rule-based"


class InterviewResultSummary(BaseModel):
    """One answered question, as sent back by the frontend for the report."""
    category: str
    overall_score: float = Field(..., ge=0, le=100)
    content_score: float = Field(..., ge=0, le=100)
    delivery_score: Optional[float] = Field(None, ge=0, le=100)
    presentation_score: Optional[float] = Field(None, ge=0, le=100)
    improvements: list[str] = []


class InterviewReportRequest(BaseModel):
    career_id: str
    results: list[InterviewResultSummary] = Field(..., min_length=1)


class InterviewReport(BaseModel):
    career_name: str
    questions_answered: int
    overall_score: float
    readiness_band: str
    dimension_scores: dict[str, Optional[float]]
    category_scores: dict[str, Optional[float]]
    strongest_area: str
    weakest_area: str
    focus_tips: list[str]
    disclaimer: str


# ---------------------------------------------------------------------------
# Legacy schemas - still used by router.py (profile / interview endpoints)
# ---------------------------------------------------------------------------
class ProfileIn(BaseModel):
    gpa: float
    skills: list[str]
    interests: list[str]
    extracurricular: list[str] = []
    stated_preference: str = ""


class CareerMatch(BaseModel):
    career: str
    score: float
    matched_skills: list[str]          # explainability NFR-10


class SkillGapOut(BaseModel):
    career: str
    have: list[str]
    missing: list[str]


class RoadmapStep(BaseModel):
    order: int
    skill: str
    activity: str
    est_weeks: int


class AnswerIn(BaseModel):
    career: str
    question: str
    answer: str
    speech_rate_wpm: float | None = None   # sent from browser (Web Speech API)
    filler_count: int | None = None
    eye_contact_ratio: float | None = None  # sent from browser (MediaPipe Face Mesh)
