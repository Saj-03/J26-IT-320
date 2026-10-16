import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


def utc_now() -> datetime:
    """Current UTC time without tzinfo (the columns are naive DateTime); replaces deprecated utcnow()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class CareerProfile(Base):
    __tablename__ = "career_profiles"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    gpa: Mapped[float] = mapped_column(Float, default=0)
    skills: Mapped[list] = mapped_column(JSON, default=list)         # ["python", "sql", ...]
    interests: Mapped[list] = mapped_column(JSON, default=list)
    extracurricular: Mapped[list] = mapped_column(JSON, default=list)  # non-academic signals
    stated_preference: Mapped[str] = mapped_column(String, default="")
    selected_career: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    career: Mapped[str] = mapped_column(String)
    report: Mapped[dict] = mapped_column(JSON, default=dict)  # content + voice + face feedback
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)


class CareerFlowState(Base):
    """ACRDS: the student's latest career flow (survey profile, recommendations, persona,
    selected career, skill gap, roadmap) so it is still there after logging in again.
    InterviewSession above stores each finished interview practice report."""
    __tablename__ = "career_flow_states"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
