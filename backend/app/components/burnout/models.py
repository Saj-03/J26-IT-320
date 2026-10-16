import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, JSON, ForeignKey, Float, Integer, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    mode: Mapped[str] = mapped_column(String)            # text / emoji / voice
    text: Mapped[str] = mapped_column(Text)
    sentiment: Mapped[float] = mapped_column(Float)      # VADER compound (-1..1)
    emotion: Mapped[str] = mapped_column(String)         # DistilBERT label
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String)            # user / assistant
    content: Mapped[str] = mapped_column(Text)
    sentiment: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MoodTap(Base):
    __tablename__ = "mood_taps"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    mood: Mapped[int] = mapped_column(Integer)           # 1 (low) .. 5 (great)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WellbeingSignal(Base):
    """Output of the fusion layer - what gets sent to Scheduler / Physical."""
    __tablename__ = "wellbeing_signals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    risk_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String)
    inputs: Mapped[dict] = mapped_column(JSON)           # traceability: which signals contributed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class BurnoutPreference(Base):
    """Student's own choices (FR11 / NFR5). Own table so the shared users table is not touched."""
    __tablename__ = "burnout_preferences"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    share_with_scheduler: Mapped[bool] = mapped_column(Boolean, default=True)   # off = signals stay private to the student
    chat_enabled: Mapped[bool] = mapped_column(Boolean, default=False)          # chat is opt-in
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
