"""
ACRDS request/response schemas.

VIVA: "Pydantic validates every request before it reaches the logic, so a
skill rating of 7 or a confidence of 0 is rejected with a clear 422 error."
"""
import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    # Allow the field name 'model_probability' (Pydantic reserves the 'model_' prefix by default)
    model_config = ConfigDict(protected_namespaces=())

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
    faculties: list[str] = []     # faculties this career suits
    faculty_match: bool = True   # False = outside the student's faculty (shown only to fill the list)


class Persona(BaseModel):
    """Skill-readiness group from the K-Means model (guidance only, not used for ranking)."""
    name: str                  # Developing | Progressing | Advanced
    description: str
    advice: str
    average_skill_level: float


class RecommendationResponse(BaseModel):
    student_id: Optional[str] = None
    scoring_method: str = "cosine"
    persona: Optional[Persona] = None
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


class RoadmapMilestone(BaseModel):
    id: str  # courses | tools | projects | cert | interview
    title: str
    description: str
    timeframe: str
    items: list[str] = []


class RoadmapResponse(BaseModel):
    career_id: str
    career_name: str
    readiness_percentage: float
    roadmap: list[RoadmapItem]
    message: str
    milestones: list[RoadmapMilestone] = []  # career-specific steps (courses, tools, projects, ...)


# ---------------------------------------------------------------------------
# AI Interview Simulator
# ---------------------------------------------------------------------------
class InterviewQuestionOut(BaseModel):
    id: str
    category: str  # Introduction | Technical | Behavioural
    question: str
    tip: str
    question_en: Optional[str] = None  # English original (answers are given and scored in English)


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


class CoachFeedbackResponse(BaseModel):
    llm_feedback: Optional[LLMFeedback] = None   # None = no provider, opted out, or the call failed


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
# Saved progress (per logged-in student)
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Career Fit Quiz (after the top 5 careers; helps the student choose, never changes the ranking)
# ---------------------------------------------------------------------------
class FitInterestOption(BaseModel):
    id: str
    text: str


class FitInterestQuestion(BaseModel):
    id: str
    question: str
    options: list[FitInterestOption]


class FitScenario(BaseModel):
    id: str
    career_id: str
    career_name: str
    skill: str
    skill_label: str
    scenario: str
    options: list[str]


class FitQuizOut(BaseModel):
    variant: int
    interest_questions: list[FitInterestQuestion]
    scenarios: list[FitScenario]
    advisory: str


class FitCheckRequest(BaseModel):
    question_id: str = Field(max_length=40)
    option: int = Field(ge=0, le=5)


class FitCheckResponse(BaseModel):
    question_id: str
    option: int
    points: int
    max_points: int
    best_option: int
    result: Literal["best", "good", "miss"]
    why: str


class FitScenarioAnswer(BaseModel):
    career_id: str = Field(max_length=60)
    question_id: str = Field(max_length=40)
    option: int = Field(ge=0, le=5)
    enjoyment: int = Field(ge=0, le=2, description="0 not for me, 1 maybe, 2 love it")


class FitScoreRequest(BaseModel):
    interests: dict[str, str] = Field(description="interest question id -> option id")
    scenarios: list[FitScenarioAnswer] = Field(min_length=1, max_length=5,
                                               description="In the recommended order (used to break ties)")

    @field_validator("interests")
    @classmethod
    def _small(cls, v):
        if len(v) > 20:
            raise ValueError("too many answers")
        return v


class FitResult(BaseModel):
    career_id: str
    career_name: str
    fit: int
    interest_match: int
    enjoyment: int
    scenario_points: int
    career_types: list[str]
    rank: int


class FitScoreResponse(BaseModel):
    interest_profile: dict[str, int]
    top_types: list[str]
    results: list[FitResult]
    best_fit_career_id: Optional[str] = None
    summary: str
    advisory: str


class SavedStateIn(BaseModel):
    data: dict


class SavedStateOut(BaseModel):
    user_id: str
    data: dict
    updated_at: Optional[datetime] = None


class InterviewHistoryIn(BaseModel):
    career_id: str
    report: InterviewReport


class InterviewHistoryItem(BaseModel):
    id: str
    career_id: str
    career_name: str
    overall_score: float
    readiness_band: str
    questions_answered: int
    created_at: datetime


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


# ---------------------------------------------------------------------------
# CV Builder
# ---------------------------------------------------------------------------
# A draft may be incomplete, so most fields are optional; limits keep one CV small (< ~60 KB).
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
PHONE_PATTERN = r"^[0-9+()\-\s]{6,25}$"
MONTH_PATTERN = r"^(\d{4}-(0[1-9]|1[0-2]))?$"  # "YYYY-MM" from <input type="month">, or empty
CVTemplate = Literal["modern", "ats", "creative"]


def _optional_pattern(value: str, pattern: str, message: str) -> str:
    value = (value or "").strip()
    if value and not re.match(pattern, value):
        raise ValueError(message)
    return value


def _optional_url(value: str) -> str:
    value = (value or "").strip()
    if value and (" " in value or "." not in value):
        raise ValueError("Enter a valid link, e.g. https://github.com/yourname")
    return value


class CVPersonal(BaseModel):
    full_name: str = Field("", max_length=100)
    headline: str = Field("", max_length=120)
    email: str = Field("", max_length=120)
    phone: str = Field("", max_length=30)
    location: str = Field("", max_length=100)
    linkedin: str = Field("", max_length=200)
    website: str = Field("", max_length=200)  # GitHub / portfolio

    _email = field_validator("email")(lambda cls, v: _optional_pattern(v, EMAIL_PATTERN, "Enter a valid email address"))
    _phone = field_validator("phone")(lambda cls, v: _optional_pattern(v, PHONE_PATTERN, "Enter a valid phone number"))
    _links = field_validator("linkedin", "website")(lambda cls, v: _optional_url(v))


class CVDates(BaseModel):
    start: str = Field("", pattern=MONTH_PATTERN)
    end: str = Field("", pattern=MONTH_PATTERN)
    current: bool = False  # "Present"


class CVEducation(CVDates):
    institution: str = Field("", max_length=150)
    degree: str = Field("", max_length=150)
    field: str = Field("", max_length=150)
    gpa: str = Field("", max_length=20)
    achievements: str = Field("", max_length=800)


class CVExperience(CVDates):
    company: str = Field("", max_length=150)
    position: str = Field("", max_length=150)
    responsibilities: str = Field("", max_length=2000)
    achievements: str = Field("", max_length=1200)


class CVProject(BaseModel):
    title: str = Field("", max_length=150)
    description: str = Field("", max_length=2000)
    technologies: str = Field("", max_length=300)
    link: str = Field("", max_length=200)

    _link = field_validator("link")(lambda cls, v: _optional_url(v))


class CVCertification(BaseModel):
    name: str = Field("", max_length=150)
    issuer: str = Field("", max_length=150)
    date: str = Field("", pattern=MONTH_PATTERN)


class CVActivity(BaseModel):
    role: str = Field("", max_length=150)        # e.g. Team leader, Volunteer
    organisation: str = Field("", max_length=150)  # e.g. IEEE Student Branch
    description: str = Field("", max_length=800)


class CVDocument(BaseModel):
    template: CVTemplate = "modern"
    career_id: Optional[str] = Field(None, max_length=60)  # ACRDS career the CV is tailored to
    personal: CVPersonal = CVPersonal()
    summary: str = Field("", max_length=1500)
    education: list[CVEducation] = Field(default_factory=list, max_length=10)
    technical_skills: list[str] = Field(default_factory=list, max_length=40)
    soft_skills: list[str] = Field(default_factory=list, max_length=30)
    experience: list[CVExperience] = Field(default_factory=list, max_length=15)
    projects: list[CVProject] = Field(default_factory=list, max_length=15)
    certifications: list[CVCertification] = Field(default_factory=list, max_length=20)
    activities: list[CVActivity] = Field(default_factory=list, max_length=15)

    @field_validator("technical_skills", "soft_skills")
    @classmethod
    def _clean_skills(cls, skills: list[str]) -> list[str]:
        out = []
        for skill in skills:
            skill = " ".join(str(skill).split())[:60]
            if skill and skill.lower() not in {s.lower() for s in out}:
                out.append(skill)
        return out


class CVOut(BaseModel):
    cv: Optional[CVDocument] = None
    updated_at: Optional[datetime] = None


CVTask = Literal["summary", "experience", "project", "tailor"]


class CVAssistRequest(BaseModel):
    """Only the fields the chosen task needs are sent to the AI provider. There are no name,
    email, phone, address or link fields here at all, so contact details cannot be sent."""
    task: CVTask
    career_id: Optional[str] = Field(None, max_length=60)
    headline: str = Field("", max_length=120)
    summary: str = Field("", max_length=1500)
    position: str = Field("", max_length=150)
    responsibilities: str = Field("", max_length=2000)
    achievements: str = Field("", max_length=1200)
    title: str = Field("", max_length=150)
    description: str = Field("", max_length=2000)
    technologies: str = Field("", max_length=300)
    skills: list[str] = Field(default_factory=list, max_length=70)
    project_titles: list[str] = Field(default_factory=list, max_length=15)
    experience_positions: list[str] = Field(default_factory=list, max_length=15)


class CVAssistResponse(BaseModel):
    task: CVTask
    text: str = ""                                  # summary / tailored summary suggestion
    headline: str = ""                              # tailor: suggested headline
    bullets: list[str] = []                         # experience / project bullet points
    highlight_skills: list[str] = []                # tailor: subset of the student's own skills
    tips: list[str] = []
    removed: int = 0                                # suggestions dropped by the "no invented numbers" check
    provider: str = ""
    model: str = ""
