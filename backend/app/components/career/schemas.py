"""
ACRDS request/response schemas.

VIVA: "Pydantic validates every request before it reaches the logic, so a
skill rating of 7 or a confidence of 0 is rejected with a clear 422 error."
"""
from typing import Optional

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
    explanation: str
    matching_skills: list[str]
    missing_skills: list[str]
    recommended_courses: list[str]
    recommended_projects: list[str]
    recommended_certifications: list[str]


class RecommendationResponse(BaseModel):
    student_id: Optional[str] = None
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
