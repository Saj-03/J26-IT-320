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


class Tip(BaseModel):
    text: str
    reason: str                    # always shown with the tip (FR7)
    category: str


class SummaryOut(BaseModel):
    latest: SignalOut | None
    history: list[float]          # recent risk scores, oldest first (for the trend chart)
    signals: dict[str, float] = {}   # per-signal risk 0..1; a missing key = no data for that signal
    factors: list[dict] = []         # which behaviour features moved most vs the student's own baseline
    tip: Tip | None = None           # only when >=2 signals agree


class JournalEntryOut(BaseModel):
    """The student's own entry. Text is private to them; other components only ever receive scores."""
    id: str
    text: str
    mode: str
    created_at: str      # ISO-8601 UTC ("Z"), formatted in the student's own timezone by the UI


class PreferencesIn(BaseModel):
    share_with_scheduler: bool | None = None
    chat_enabled: bool | None = None


class PreferencesOut(BaseModel):
    share_with_scheduler: bool
    chat_enabled: bool
