import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(String, nullable=True)   # subtask of a big task
    title: Mapped[str] = mapped_column(String)
    deadline: Mapped[datetime] = mapped_column(DateTime)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    cognitive_load: Mapped[str] = mapped_column(String, default="medium")  # low/medium/heavy
    priority: Mapped[int] = mapped_column(Integer, default=3)
    source: Mapped[str] = mapped_column(String, default="student")        # student / career / physical
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")        # pending/done/missed


class FocusSession(Base):
    __tablename__ = "focus_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    planned_minutes: Mapped[int] = mapped_column(Integer)
    actual_minutes: Mapped[int] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean)


class ScheduleChange(Base):
    """Every adaptive change is logged + the student's decision (override)."""
    __tablename__ = "schedule_changes"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String)
    change_set: Mapped[list] = mapped_column(JSON)
    decision: Mapped[str] = mapped_column(String, default="proposed")   # accepted/edited/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RewardEvent(Base):
    __tablename__ = "reward_events"
    id: Mapped[str] = mapped_column(String, primary_key=True)    # idempotency key
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String)                    # xp / badge / streak
    amount: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
