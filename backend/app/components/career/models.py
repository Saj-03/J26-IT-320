import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    career: Mapped[str] = mapped_column(String)
    report: Mapped[dict] = mapped_column(JSON, default=dict)  # content + voice + face feedback
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
