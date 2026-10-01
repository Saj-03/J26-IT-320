"""
Pydantic schemas = the shape of data going IN to and OUT of the API.

  *Create  -> body of a POST (required fields)
  *Update  -> body of a PATCH (every field optional, only sent fields change)
  *Read    -> what the API returns (built straight from the database row)
"""
from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.components.scheduler.models import (
    CommitmentType, LoadLevel, LoadSource, SessionOutcome, TaskSource, TaskStatus,
)

Title = Field(min_length=1, max_length=200)
DayOfWeek = Field(ge=0, le=6, description="0 = Monday ... 6 = Sunday")


class _Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)   # allows Read.model_validate(db_row)


class _TimeRange(BaseModel):
    """Shared check: end_time must be after start_time (when both are given)."""

    @model_validator(mode="after")
    def _end_after_start(self):
        start, end = getattr(self, "start_time", None), getattr(self, "end_time", None)
        if start is not None and end is not None and end <= start:
            raise ValueError("end_time must be after start_time")
        return self


# --------------------------------------------------------------------------- #
# Subtask
# --------------------------------------------------------------------------- #
class SubtaskCreate(BaseModel):
    title: str = Title
    order_index: int = Field(ge=0)
    load: LoadLevel = LoadLevel.MEDIUM
    load_source: LoadSource = LoadSource.RULE
    estimated_minutes: int = Field(gt=0)


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    order_index: int | None = Field(default=None, ge=0)
    load: LoadLevel | None = None
    load_source: LoadSource | None = None   # set to "user" when the student changes the load tag
    estimated_minutes: int | None = Field(default=None, gt=0)
    actual_minutes: int | None = Field(default=None, ge=0)
    status: TaskStatus | None = None


class SubtaskRead(_Read):
    id: str
    task_id: str
    title: str
    order_index: int
    load: LoadLevel
    load_source: LoadSource
    estimated_minutes: int
    actual_minutes: int | None
    status: TaskStatus


# --------------------------------------------------------------------------- #
# Task
# --------------------------------------------------------------------------- #
class TaskCreate(BaseModel):
    title: str = Title
    description: str | None = None
    deadline: datetime
    estimated_minutes: int = Field(gt=0)
    priority: int = Field(default=3, ge=1, le=5)
    source: TaskSource = TaskSource.MANUAL
    subtasks: list[SubtaskCreate] = Field(default_factory=list)   # optional breakdown sent with the task


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    deadline: datetime | None = None
    estimated_minutes: int | None = Field(default=None, gt=0)
    priority: int | None = Field(default=None, ge=1, le=5)
    status: TaskStatus | None = None


class TaskRead(_Read):
    id: str
    user_id: str
    title: str
    description: str | None
    deadline: datetime
    estimated_minutes: int
    priority: int
    status: TaskStatus
    source: TaskSource
    created_at: datetime
    updated_at: datetime
    subtasks: list[SubtaskRead] = []


# --------------------------------------------------------------------------- #
# Commitment (fixed weekly events the scheduler must avoid)
# --------------------------------------------------------------------------- #
class CommitmentCreate(_TimeRange):
    title: str = Title
    type: CommitmentType
    day_of_week: int = DayOfWeek
    start_time: time
    end_time: time
    is_recurring: bool = True


class CommitmentUpdate(_TimeRange):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    type: CommitmentType | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    is_recurring: bool | None = None


class CommitmentRead(_Read):
    id: str
    user_id: str
    title: str
    type: CommitmentType
    day_of_week: int
    start_time: time
    end_time: time
    is_recurring: bool


# --------------------------------------------------------------------------- #
# Availability (when the student is free to study)
# --------------------------------------------------------------------------- #
class AvailabilityCreate(_TimeRange):
    day_of_week: int = DayOfWeek
    start_time: time
    end_time: time


class AvailabilityUpdate(_TimeRange):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None


class AvailabilityRead(_Read):
    id: str
    user_id: str
    day_of_week: int
    start_time: time
    end_time: time


# --------------------------------------------------------------------------- #
# Used by the existing endpoints
# --------------------------------------------------------------------------- #
class FocusIn(BaseModel):
    subtask_id: str | None = None
    schedule_block_id: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    planned_minutes: int = Field(gt=0)
    actual_minutes: int | None = Field(default=None, ge=0)
    pause_count: int = Field(default=0, ge=0)
    focus_rating: int | None = Field(default=None, ge=1, le=5)
    outcome: SessionOutcome | None = None
    ended_early: bool = False


class DecisionIn(BaseModel):
    decision: Literal["accepted", "rejected", "restored"]
