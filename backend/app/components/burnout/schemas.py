from typing import Literal
from pydantic import BaseModel, Field


class JournalIn(BaseModel):
    mode: Literal["text", "emoji", "voice"] = "text"
    text: str = Field(min_length=1, max_length=5000)


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context_grounded: bool = True   # False = Baseline 2 group in the pilot


class MoodIn(BaseModel):
    mood: int = Field(ge=1, le=5)


class SignalOut(BaseModel):
    """Student-facing: patterns and awareness, never a verdict."""
    risk_level: Literal["LOW", "MODERATE", "HIGH"]
    label: Literal["low", "moderate", "elevated"]     # use this wording in the UI
    risk_score: float = Field(ge=0, le=1)
    trend: Literal["FALLING", "STABLE", "RISING"]
    reasons: list[str]
    note: str = "This is not a diagnosis."


class SummaryOut(BaseModel):
    latest: SignalOut | None
    history: list[float]          # recent risk scores, oldest first (for the trend chart)
