from datetime import date
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class ProfileIn(BaseModel):
    assessment_data: dict[str, Any] = Field(default_factory=dict)
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


class PlanDurationIn(BaseModel):
    days_count: int = Field(ge=1, le=31)


class PlanCheckInIn(BaseModel):
    day: date
    completed_items: list[Literal["bf", "lu", "dn", "sn"]] = Field(default_factory=list)
    water_glasses: int = Field(default=0, ge=0, le=8)


class FavoriteIn(BaseModel):
    item_type: Literal["meal", "workout"]
    item: dict[str, Any]


class ActivityIn(BaseModel):
    day: date
    steps: int
    exercise_minutes: int
    completed_recommendation: bool = False


class WorkoutFeedbackIn(BaseModel):
    day: date
    did_workout: bool
    workout_minutes: int = Field(default=0, ge=0, le=240)
    difficulty: Optional[str] = None


class HabitIn(BaseModel):
    name: str


class PeerChallengeCreateIn(BaseModel):
    title: str = Field(min_length=3, max_length=80)
    goal_text: str = Field(min_length=1, max_length=80)
    target_text: str | None = Field(default=None, max_length=120)
    metric: Literal["minutes", "steps", "workouts"]
    target: int = Field(gt=0)
    duration_days: int = Field(default=7, ge=1, le=30)
    nickname: str = Field(min_length=2, max_length=24)


class PeerChallengeJoinIn(BaseModel):
    nickname: str = Field(min_length=2, max_length=24)


class PeerChallengeProgressIn(BaseModel):
    amount: int = Field(gt=0, le=10000)


class PeerChallengeGuestProgressIn(PeerChallengeProgressIn):
    participant_token: str = Field(min_length=20, max_length=100)


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

