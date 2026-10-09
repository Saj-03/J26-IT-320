"""Audit log of every integration message (idempotency + traceability)."""
from datetime import datetime
from sqlalchemy import String, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class SignalEvent(Base):
    __tablename__ = "signal_events"
    event_id: Mapped[str] = mapped_column(String, primary_key=True)   # duplicate event_id = rejected
    signal_type: Mapped[str] = mapped_column(String, index=True)
    student_id: Mapped[str] = mapped_column(String, index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String)                       # ACCEPTED / STALE / DUPLICATE
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
