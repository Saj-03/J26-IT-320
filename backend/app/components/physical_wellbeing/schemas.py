from datetime import date
from pydantic import BaseModel


class ProfileIn(BaseModel):
    goal: str
    activity_level: str
    available_minutes: int
    equipment: list[str] = []
    diet_pref: str = "any"
    sleep_hours: float = 7
    workload_intensity_score: float = 50.0
    stress_score: float = 3.0
    burnout_score: float = 3.0
    bmi: float = 22.0
    physical_limitations: str = ""


class ActivityIn(BaseModel):
    day: date
    steps: int
    exercise_minutes: int
    completed_recommendation: bool = False


class HabitIn(BaseModel):
    name: str
