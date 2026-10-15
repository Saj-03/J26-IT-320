from datetime import date
from typing import Any, Optional
from pydantic import BaseModel, Field


class ProfileIn(BaseModel):
    goal: str = "fitness"
    goals: list[str] = []
    activity_level: str = "medium"
    available_minutes: int = 20
    equipment: list[str] = []
    diet_pref: str = "any"
    meal_style: str = "both"
    allergies: str = ""
    avoid_foods: str = ""
    favourite_foods: str = ""
    preferred_time: str = "morning"
    preferred_activities: list[str] = []
    sleep_hours: float = 7.0
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


class MealSlotItem(BaseModel):
    name: str
    slot: str
    calories: float = 0.0
    protein: float = 0.0
    carbs: float = 0.0
    fat: float = 0.0
    prep_time: float = 15.0
    cuisine: str = "Sri Lankan / Balanced"
    diet_category: str = "Balanced"
    description: str = ""
    adherence_probability: float = 0.85


class ExerciseItem(BaseModel):
    name: str
    minutes: int = 20
    calories_burned: float = 150.0
    intensity: str = "Moderate"
    equipment: str = "Bodyweight / Home"
    limitation_warning: bool = False
    adherence_probability: float = 0.85
    description: str = ""


class DayPlan(BaseModel):
    day_number: int
    day_name: str
    date: str
    exercise: dict
    meals: dict[str, list[dict]]


class WeekPlanResponse(BaseModel):
    model_version: str
    context_aware: bool
    is_exam_period: bool
    effective_available_minutes: float
    user_preferences: dict[str, Any]
    days: list[DayPlan]

