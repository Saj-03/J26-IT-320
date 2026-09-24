import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, JSON, ForeignKey, Integer, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class WellbeingProfile(Base):
    __tablename__ = "wellbeing_profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal: Mapped[str] = mapped_column(String)                 # e.g. "fitness", "weight_loss"
    activity_level: Mapped[str] = mapped_column(String)       # low / medium / high
    available_minutes: Mapped[int] = mapped_column(Integer, default=20)
    equipment: Mapped[list] = mapped_column(JSON, default=list)
    diet_pref: Mapped[str] = mapped_column(String, default="any")  # veg / non-veg
    sleep_hours: Mapped[float] = mapped_column(Float, default=7)
    recovery_mode: Mapped[bool] = mapped_column(Boolean, default=False)  # set by C4 signal


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    exercise_minutes: Mapped[int] = mapped_column(Integer, default=0)
    completed_recommendation: Mapped[bool] = mapped_column(Boolean, default=False)


class Habit(Base):
    __tablename__ = "habits"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String)                 # "drink water", "sleep by 11"
    streak: Mapped[int] = mapped_column(Integer, default=0)
    last_done: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
