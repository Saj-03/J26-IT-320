from datetime import datetime
from pydantic import BaseModel


class TaskIn(BaseModel):
    title: str
    deadline: datetime
    estimated_minutes: int
    cognitive_load: str = "medium"
    priority: int = 3


class FocusIn(BaseModel):
    task_id: str | None = None
    started_at: datetime
    planned_minutes: int
    actual_minutes: int
    completed: bool


class DecisionIn(BaseModel):
    decision: str   # accepted / edited / rejected
