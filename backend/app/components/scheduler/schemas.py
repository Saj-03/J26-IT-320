from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

from app.components.scheduler.models import SessionOutcome, TaskSource


class TaskIn(BaseModel):
    title: str
    description: str | None = None
    deadline: datetime
    estimated_minutes: int = Field(gt=0)
    priority: int = Field(default=3, ge=1, le=5)
    source: TaskSource = TaskSource.MANUAL


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
