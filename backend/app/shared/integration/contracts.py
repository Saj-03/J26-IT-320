"""
INTEGRATION CONTRACTS - the agreed JSON messages between the 4 components.

VIVA: "Components never read each other's tables directly. They talk through
these versioned, validated contracts. That keeps responsibility boundaries clear."

  C4 Burnout   --RiskSignal-------->  C3 Scheduler, Physical Wellbeing
  C3 Scheduler --DeviationSignal--->  C4 Burnout
  C4 Burnout   --RecoverySignal---->  Physical Wellbeing
  Career       --RoadmapActivity--->  C3 Scheduler   (student must approve)
  Physical     --ProtectedBlock---->  C3 Scheduler
"""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"


class RiskSignal(BaseModel):
    """Component 4 -> Component 3 (payload from C3 proposal, Appendix 4)."""
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    event_id: str
    student_id: str                      # pseudonymous research id
    risk_score: float = Field(ge=0, le=1)
    risk_level: Literal["LOW", "MODERATE", "HIGH"]
    trend: Literal["FALLING", "STABLE", "RISING"]
    timestamp: datetime


class DeviationSignal(BaseModel):
    """Component 3 -> Component 4 (weekly behavioural deviation)."""
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    event_id: str
    student_id: str
    week_start: datetime
    task_completion_rate: float
    missed_sessions: int
    task_load: int
    deadline_density: float
    semester_phase: str
    timestamp: datetime


class RecoverySignal(BaseModel):
    """Component 4 -> Physical Wellbeing (switch to recovery recommendations)."""
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    event_id: str
    student_id: str
    recovery_mode: bool
    severity: Literal["MILD", "MODERATE", "HIGH"]
    timestamp: datetime


class RoadmapActivity(BaseModel):
    """Career (ACRDS) -> Scheduler: optional development task."""
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    event_id: str
    student_id: str
    title: str
    suggested_deadline: datetime
    importance: int = Field(ge=1, le=5)
    estimated_minutes: int


class ProtectedBlock(BaseModel):
    """Physical Wellbeing -> Scheduler: time to protect for exercise/recovery."""
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    event_id: str
    student_id: str
    start: datetime
    end: datetime
    reason: str
