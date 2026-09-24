"""Student account. Uses a pseudonymous research ID (privacy NFR)."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, SmallInteger
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True)  # stored lower-cased
    full_name: Mapped[str] = mapped_column(String)
    hashed_password: Mapped[str] = mapped_column(String)
    university: Mapped[str | None] = mapped_column(String, nullable=True)
    year_of_study: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    research_id: Mapped[str] = mapped_column(String, unique=True, default=lambda: "P-" + uuid.uuid4().hex[:8])
    research_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
