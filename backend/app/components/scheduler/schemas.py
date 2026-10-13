"""
Component 3 - request / response shapes (Pydantic).

    *Create  = what the student SENDS when making something
    *Update  = what the student SENDS when changing something (every field optional)
    *Out     = what the API SENDS BACK

Validation here means bad data never reaches the database
(e.g. a deadline in the past, priority 9, a 0-minute task).
"""
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
# FOCUS SESSIONS / DECISIONS  (unchanged for now - rewritten in Step 2)
# ===========================================================================
class FocusIn(BaseModel):
    task_id: str | None = None
    started_at: datetime
    planned_minutes: int
    actual_minutes: int
    completed: bool


class DecisionIn(BaseModel):
    decision: str   # accepted / edited / rejected
