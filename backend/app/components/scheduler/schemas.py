"""
Component 3 - request / response shapes (Pydantic).

    *Create  = what the student SENDS when making something
    *Update  = what the student SENDS when changing something (every field optional)
    *Out     = what the API SENDS BACK

Validation here means bad data never reaches the database
(e.g. a deadline in the past, priority 9, a 0-minute task).
"""
from datetime import datetime, time, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Allowed values - must match the constants in models.py
CognitiveLoad = Literal["low", "medium", "heavy"]
TaskType = Literal["assignment", "exam_prep", "lecture_review", "project", "reading", "career", "other"]
TaskStatus = Literal["pending", "in_progress", "done", "missed", "cancelled"]


def to_utc_naive(value: datetime | None) -> datetime | None:
    """
    The database stores times as UTC without a timezone.
    The browser usually sends "2026-10-20T10:00:00+05:30" -> convert it to UTC first.
    """
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


# ===========================================================================
# TASKS
# ===========================================================================
class TaskCreate(BaseModel):
    """Body of POST /api/scheduler/tasks"""
    model_config = ConfigDict(extra="forbid")   # reject unknown fields (catches typos)

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    task_type: TaskType = "other"
    deadline: datetime
    estimated_minutes: int = Field(ge=5, le=24 * 60)        # 5 minutes .. 1 day
    priority: int = Field(default=3, ge=1, le=5)             # 1 = low, 5 = high
    is_flexible: bool = True

    # Optional: if the student picks the load, we keep it.
    # If empty, the system decides (later: M2 classifier, for now "medium").
    cognitive_load: CognitiveLoad | None = None

    # Optional: makes this task a SUBTASK of another task
    parent_id: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty")
        return v

    @field_validator("deadline")
    @classmethod
    def deadline_in_future(cls, v: datetime) -> datetime:
        v = to_utc_naive(v)
        if v <= datetime.utcnow():
            raise ValueError("deadline must be in the future")
        return v


class TaskUpdate(BaseModel):
    """Body of PATCH /api/scheduler/tasks/{id} - send only the fields you want to change."""
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    task_type: TaskType | None = None
    deadline: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=5, le=24 * 60)
    priority: int | None = Field(default=None, ge=1, le=5)
    is_flexible: bool | None = None
    cognitive_load: CognitiveLoad | None = None   # changing this = student overrides the AI
    status: TaskStatus | None = None

    @field_validator("deadline")
    @classmethod
    def normalise_deadline(cls, v: datetime | None) -> datetime | None:
        # Past deadlines are allowed here (e.g. fixing a typo on an old task),
        # only the timezone is normalised.
        return to_utc_naive(v)


class TaskOut(BaseModel):
    """One task as returned by the API."""
    model_config = ConfigDict(from_attributes=True)   # build directly from the SQLAlchemy row

    id: str
    parent_id: str | None
    title: str
    description: str | None
    task_type: str
    deadline: datetime
    estimated_minutes: int
    priority: int
    is_flexible: bool

    cognitive_load: str
    load_confidence: float | None
    load_set_by_student: bool
    predicted_minutes: int | None

    source: str
    scheduled_start: datetime | None
    status: str
    actual_minutes: int | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskDetailOut(TaskOut):
    """GET /tasks/{id} - the task plus its subtasks."""
    subtasks: list[TaskOut] = []


# Old name kept so existing code/tests that import TaskIn still work.
TaskIn = TaskCreate


# ===========================================================================
# COMMITMENTS  (FR-02) - lectures, work hours = time the scheduler can't use
# ===========================================================================
CommitmentKind = Literal["lecture", "work", "extracurricular", "personal", "protected_block"]


class CommitmentCreate(BaseModel):
    """
    Body of POST /api/scheduler/commitments

    Two types:
      weekly   -> is_recurring=true,  weekday + start_time + end_time (Sri Lanka time)
      one-off  -> is_recurring=false, start_at + end_at
    """
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    kind: CommitmentKind = "lecture"
    is_recurring: bool = True

    # weekly
    weekday: int | None = Field(default=None, ge=0, le=6)   # 0 = Monday, 6 = Sunday
    start_time: time | None = None                          # e.g. "08:30"
    end_time: time | None = None                            # e.g. "10:30"

    # one-off
    start_at: datetime | None = None
    end_at: datetime | None = None

    # optional: only repeat inside this date range (e.g. this semester)
    valid_from: datetime | None = None
    valid_until: datetime | None = None

    @field_validator("start_at", "end_at", "valid_from", "valid_until")
    @classmethod
    def utc(cls, v):
        return to_utc_naive(v)

    @model_validator(mode="after")
    def check_times(self):
        # Weekly: need day + start + end, and end after start
        if self.is_recurring:
            if self.weekday is None or self.start_time is None or self.end_time is None:
                raise ValueError("weekly commitment needs weekday, start_time and end_time")
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time (split overnight items in two)")
        # One-off: need start + end, and end after start
        else:
            if self.start_at is None or self.end_at is None:
                raise ValueError("one-off commitment needs start_at and end_at")
            if self.end_at <= self.start_at:
                raise ValueError("end_at must be after start_at")
        if self.valid_from and self.valid_until and self.valid_until <= self.valid_from:
            raise ValueError("valid_until must be after valid_from")
        return self


class CommitmentUpdate(BaseModel):
    """Body of PATCH /commitments/{id} - send only what changed (checked again after merging)."""
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: CommitmentKind | None = None
    is_recurring: bool | None = None
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class CommitmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    kind: str
    is_recurring: bool
    weekday: int | None
    start_time: time | None
    end_time: time | None
    start_at: datetime | None
    end_at: datetime | None
    valid_from: datetime | None
    valid_until: datetime | None
    created_at: datetime


# ===========================================================================
# AVAILABILITY + CONFLICTS
# ===========================================================================
class SlotOut(BaseModel):
    """One block of free time (UTC)."""
    start: datetime
    end: datetime
    minutes: int


class DayAvailabilityOut(BaseModel):
    date: str              # Sri Lanka date, e.g. "2026-10-14"
    free_minutes: int
    slots: list[SlotOut]


class AvailabilityOut(BaseModel):
    days: list[DayAvailabilityOut]
    total_free_minutes: int


class ConflictOut(BaseModel):
    type: Literal["overlap", "impossible_deadline"]
    message: str                 # plain-language explanation for the student
    ids: list[str]               # commitment ids (overlap) or task ids (deadline)


# ===========================================================================
# FOCUS SESSIONS  (FR-05, FR-15)
# ===========================================================================
TimerSource = Literal["student_fixed", "static_default", "history_rules", "survey", "default"]


class TimerRecommendationOut(BaseModel):
    """The timer length the system suggests before a session starts."""
    focus_minutes: int
    break_minutes: int
    source: TimerSource      # where the number came from (shown to the student + kept for research)
    reason: str              # plain-language explanation


class FocusStartIn(BaseModel):
    """Body of POST /focus/start"""
    model_config = ConfigDict(extra="forbid")

    task_id: str | None = None                                       # which task (optional)
    planned_minutes: int | None = Field(default=None, ge=5, le=180)  # empty = accept the suggestion


class FocusEndIn(BaseModel):
    """Body of POST /focus/{id}/end - the rating is optional."""
    model_config = ConfigDict(extra="forbid")

    focus_rating: int | None = Field(default=None, ge=1, le=5)   # "How was your focus?" 1..5


class FocusRatingIn(BaseModel):
    """Body of POST /focus/{id}/rating - rate after the session ended."""
    model_config = ConfigDict(extra="forbid")

    focus_rating: int = Field(ge=1, le=5)


class FocusSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str | None
    started_at: datetime
    ended_at: datetime | None
    planned_minutes: int
    actual_minutes: int
    completed: bool
    pause_count: int
    paused_at: datetime | None       # not null = paused right now
    paused_seconds: int
    paused_minutes: int
    focus_rating: int | None
    task_load: str | None
    mode: str
    was_missed: bool                 # planned but never started
    auto_closed: bool                # left open too long -> closed by the system
    is_valid: bool                   # False = not used for M1 training
    timer_recommended: bool
    timer_overridden: bool


class FocusSummaryOut(BaseModel):
    """
    Numbers for the dashboard, over ALL sessions that match the filters.
    Missed sessions are counted separately - they are NOT in the completion rate
    (completion rate = completed / sessions that were actually started).
    """
    sessions: int                      # started sessions
    missed: int                        # planned sessions that were never started
    auto_closed: int                   # sessions left open too long (not in the numbers below)
    completed: int
    completion_rate: float | None      # 0..1, None if there are no sessions
    total_focus_minutes: int
    average_focus_minutes: float | None
    total_pauses: int
    average_rating: float | None       # only sessions that were rated


class MissedCheckOut(BaseModel):
    """Response of POST /focus/missed/check"""
    new_missed: list[FocusSessionOut]  # missed sessions found in this check


class FocusHistoryOut(BaseModel):
    """Response of GET /focus/history"""
    items: list[FocusSessionOut]       # one page, newest first
    total: int                         # how many sessions match (all pages)
    summary: FocusSummaryOut


class FocusEndOut(BaseModel):
    """Response of POST /focus/{id}/end: the finished session + rewards."""
    session: FocusSessionOut
    xp_awarded: int          # 0 if the session was not completed
    total_xp: int
    level: int


class FocusStartOut(BaseModel):
    """Response of POST /focus/start: the new session + what we had suggested."""
    session: FocusSessionOut
    recommendation: TimerRecommendationOut


# ===========================================================================
# SETTINGS - one row per student
# ===========================================================================
class SettingsOut(BaseModel):
    """What GET /settings returns. mode / pilot_group are shown but the student can't change them."""
    model_config = ConfigDict(from_attributes=True)

    mode: str
    pilot_group: str | None
    day_start_hour: int
    day_end_hour: int
    max_study_minutes_per_day: int
    preferred_hours: list[int]
    usual_focus_minutes: int
    focus_tracking_enabled: bool
    stress_adaptation_enabled: bool
    fixed_timer_minutes: int | None


class SettingsUpdate(BaseModel):
    """
    Body of PATCH /settings - send only what changed.
    mode and pilot_group are NOT here on purpose: only the researcher sets them
    (if a student could change their own mode, the pilot experiment would break).
    """
    model_config = ConfigDict(extra="forbid")      # sending "mode" -> 422

    day_start_hour: int | None = Field(default=None, ge=0, le=23)
    day_end_hour: int | None = Field(default=None, ge=1, le=24)
    max_study_minutes_per_day: int | None = Field(default=None, ge=60, le=16 * 60)
    preferred_hours: list[int] | None = Field(default=None, max_length=24)
    usual_focus_minutes: int | None = Field(default=None, ge=10, le=120)
    focus_tracking_enabled: bool | None = None
    stress_adaptation_enabled: bool | None = None
    fixed_timer_minutes: int | None = Field(default=None, ge=5, le=180)   # send null to clear

    @field_validator("preferred_hours")
    @classmethod
    def valid_hours(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if any(h < 0 or h > 23 for h in v):
            raise ValueError("hours must be between 0 and 23")
        return sorted(set(v))                         # remove duplicates, keep in order


# ===========================================================================
# STRESS ADAPTATION (Module F)
# ===========================================================================
StressAction = Literal["none", "propose_changes", "already_proposed", "off"]


class StressStatusOut(BaseModel):
    """What the scheduler does with Component 4's latest wellbeing signal."""
    level: Literal["LOW", "MODERATE", "HIGH"] | None   # None = no signal shared
    risk_score: float | None
    trend: Literal["FALLING", "STABLE", "RISING"] | None
    signal_event_id: str | None
    signal_received_at: datetime | None
    fresh: bool                      # received in the last 24 h
    adaptation_on: bool              # student's own switch (settings)
    mode: str                        # experiment mode
    action: StressAction             # what happens next
    reason: str                      # plain-language explanation for the student


# ===========================================================================
# OLD ENDPOINTS (kept so the current frontend keeps working)
# ===========================================================================
class FocusIn(BaseModel):
    task_id: str | None = None
    started_at: datetime
    planned_minutes: int
    actual_minutes: int
    completed: bool


class DecisionIn(BaseModel):
    decision: str   # accepted / edited / rejected
