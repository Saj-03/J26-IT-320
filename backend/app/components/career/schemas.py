from pydantic import BaseModel


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
