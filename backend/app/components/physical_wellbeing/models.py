import uuid
from datetime import datetime, date
import secrets
from sqlalchemy import String, DateTime, Date, JSON, ForeignKey, Integer, Boolean, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class WellbeingProfile(Base):
    __tablename__ = "wellbeing_profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    goal: Mapped[str] = mapped_column(String, default="fitness")                 # primary goal
    goals: Mapped[list] = mapped_column(JSON, default=list)                     # list of selected goals
    activity_level: Mapped[str] = mapped_column(String, default="medium")       # low / medium / high
    available_minutes: Mapped[int] = mapped_column(Integer, default=20)
    equipment: Mapped[list] = mapped_column(JSON, default=list)
    diet_pref: Mapped[str] = mapped_column(String, default="any")               # veg / non-veg / vegan
    meal_style: Mapped[str] = mapped_column(String, default="both")             # sri_lankan / western / both
    allergies: Mapped[str] = mapped_column(String, default="")
    avoid_foods: Mapped[str] = mapped_column(String, default="")
    favourite_foods: Mapped[str] = mapped_column(String, default="")
    preferred_time: Mapped[str] = mapped_column(String, default="morning")     # morning / afternoon / evening
    preferred_activities: Mapped[list] = mapped_column(JSON, default=list)
    sleep_hours: Mapped[float] = mapped_column(Float, default=7.0)
    workload_intensity_score: Mapped[float] = mapped_column(Float, default=50.0)
    stress_score: Mapped[float] = mapped_column(Float, default=3.0)
    burnout_score: Mapped[float] = mapped_column(Float, default=3.0)
    bmi: Mapped[float] = mapped_column(Float, default=22.0)
    physical_limitations: Mapped[str] = mapped_column(String, default="")
    assessment_data: Mapped[dict] = mapped_column(JSON, default=dict)
    recovery_mode: Mapped[bool] = mapped_column(Boolean, default=False)  # set by C4 signal


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    exercise_minutes: Mapped[int] = mapped_column(Integer, default=0)
    completed_recommendation: Mapped[bool] = mapped_column(Boolean, default=False)


class WorkoutFeedback(Base):
    """One low-friction workout check-in per user per day, used for adaptation."""
    __tablename__ = "workout_feedback"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date)
    did_workout: Mapped[bool] = mapped_column(Boolean)
    workout_minutes: Mapped[int] = mapped_column(Integer, default=0)
    difficulty: Mapped[str | None] = mapped_column(String, nullable=True)


class Habit(Base):
    __tablename__ = "habits"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String)                 # "drink water", "sleep by 11"
    streak: Mapped[int] = mapped_column(Integer, default=0)
    last_done: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class PeerChallenge(Base):
    """A private, invite-only challenge. Stores no wellbeing profile data."""
    __tablename__ = "physical_peer_challenges"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    invite_code: Mapped[str] = mapped_column(String, unique=True, index=True, default=lambda: secrets.token_urlsafe(18))
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(80))
    metric: Mapped[str] = mapped_column(String(16))  # minutes, steps, workouts
    target: Mapped[int] = mapped_column(Integer)
    duration_days: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ends_at: Mapped[datetime] = mapped_column(DateTime)


class PeerChallengeMember(Base):
    """Only a challenge nickname and aggregate score are retained; guests have no app account."""
    __tablename__ = "physical_peer_challenge_members"
    __table_args__ = (UniqueConstraint("challenge_id", "user_id", name="uq_peer_challenge_member"),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    challenge_id: Mapped[str] = mapped_column(ForeignKey("physical_peer_challenges.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True, nullable=True)
    nickname: Mapped[str] = mapped_column(String(24))
    score: Mapped[int] = mapped_column(Integer, default=0)
    guest_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
