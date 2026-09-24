from datetime import date
from pydantic import BaseModel


class ProfileIn(BaseModel):
    goal: str
    activity_level: str
    available_minutes: int
    equipment: list[str] = []
    diet_pref: str = "any"
    sleep_hours: float = 7


class ActivityIn(BaseModel):
    day: date
    steps: int
    exercise_minutes: int
    completed_recommendation: bool = False


class HabitIn(BaseModel):
    name: str
