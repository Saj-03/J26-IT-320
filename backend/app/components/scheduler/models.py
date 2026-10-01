"""
Component 3 - Adaptive Scheduler: database tables.

Reuses shared tables (not duplicated here):
  * users           -> app.shared.users.models.User
  * signal_events   -> app.shared.integration.models.SignalEvent
                       (a risk signal from Component 4 is a row with signal_type="RISK")

All ids are UUID strings, the same as the shared `users` table.
All datetimes are stored in UTC (naive), the same as the rest of the backend.
"""
import enum
import uuid
from datetime import datetime, time

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer,
    SmallInteger, String, Text, Time, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _enum(enum_cls, name: str) -> Enum:
    """Store the enum's lowercase VALUE as text + a CHECK constraint.

    native_enum=False keeps it a plain VARCHAR, so adding a new choice later
    is a simple migration (no Postgres ALTER TYPE).
    """
    return Enum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


# --------------------------------------------------------------------------- #
# Enums (fixed choices)
# --------------------------------------------------------------------------- #
class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class TaskSource(str, enum.Enum):
    MANUAL = "manual"
    NATURAL_LANGUAGE = "natural_language"
    VOICE = "voice"
    CAREER = "career"              # task sent by Component 2 (career)


class LoadLevel(str, enum.Enum):
    HEAVY = "heavy"
    MEDIUM = "medium"
    LIGHT = "light"


class LoadSource(str, enum.Enum):
    MODEL = "model"                # predicted by the ML model
    RULE = "rule"                  # fallback keyword / rule
    USER = "user"                  # the student changed it


class CommitmentType(str, enum.Enum):
    LECTURE = "lecture"
    WORK = "work"
    GYM = "gym"
    PERSONAL = "personal"
    SOCIAL = "social"


class BlockType(str, enum.Enum):
    FOCUS = "focus"
    RECOVERY = "recovery"


class ScheduleMode(str, enum.Enum):
    STATIC = "static"              # control group (static baseline)
    ADAPTIVE = "adaptive"


class BlockStatus(str, enum.Enum):
    PLANNED = "planned"
    DONE = "done"
    MISSED = "missed"
    SKIPPED = "skipped"


class SessionOutcome(str, enum.Enum):
    YES = "yes"
    PARTLY = "partly"
    NO = "no"


class ProposalStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PARTIALLY_ACCEPTED = "partially_accepted"
    RESTORED = "restored"          # accepted, then the student restored the original plan


class ChangeType(str, enum.Enum):
    DEFER = "defer"
    SPLIT = "split"
    RECOVERY = "recovery"
    SHORTEN = "shorten"


class ChangeDecision(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EDITED = "edited"


# --------------------------------------------------------------------------- #
# 1. Tasks the student needs to finish
# --------------------------------------------------------------------------- #
class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("priority BETWEEN 1 AND 5", name="ck_tasks_priority_1_5"),
        CheckConstraint("estimated_minutes > 0", name="ck_tasks_estimated_minutes_positive"),
        Index("ix_tasks_user_deadline", "user_id", "deadline"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline: Mapped[datetime] = mapped_column(DateTime, index=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    priority: Mapped[int] = mapped_column(SmallInteger, default=3)
    status: Mapped[TaskStatus] = mapped_column(_enum(TaskStatus, "task_status"), default=TaskStatus.TODO)
    source: Mapped[TaskSource] = mapped_column(_enum(TaskSource, "task_source"), default=TaskSource.MANUAL)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Deleting a task deletes its subtasks (ORM cascade + ON DELETE CASCADE in the DB)
    subtasks: Mapped[list["Subtask"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", passive_deletes=True,
        order_by="Subtask.order_index",
    )


# --------------------------------------------------------------------------- #
# 2. Small steps of a task (task breakdown)
# --------------------------------------------------------------------------- #
class Subtask(Base):
    __tablename__ = "subtasks"
    __table_args__ = (
        UniqueConstraint("task_id", "order_index", name="uq_subtasks_task_order"),
        CheckConstraint("estimated_minutes > 0", name="ck_subtasks_estimated_minutes_positive"),
        CheckConstraint("actual_minutes IS NULL OR actual_minutes >= 0", name="ck_subtasks_actual_minutes_non_negative"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    order_index: Mapped[int] = mapped_column(Integer)
    load: Mapped[LoadLevel] = mapped_column(_enum(LoadLevel, "load_level"), default=LoadLevel.MEDIUM)
    load_source: Mapped[LoadSource] = mapped_column(_enum(LoadSource, "load_source"), default=LoadSource.RULE)
    estimated_minutes: Mapped[int] = mapped_column(Integer)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(_enum(TaskStatus, "subtask_status"), default=TaskStatus.TODO)

    task: Mapped[Task] = relationship(back_populates="subtasks")


# --------------------------------------------------------------------------- #
# 3. Fixed weekly commitments (lectures, work, gym...) - the scheduler must avoid these
# --------------------------------------------------------------------------- #
class Commitment(Base):
    __tablename__ = "commitments"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_commitments_day_0_6"),
        CheckConstraint("end_time > start_time", name="ck_commitments_end_after_start"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    type: Mapped[CommitmentType] = mapped_column(_enum(CommitmentType, "commitment_type"))
    day_of_week: Mapped[int] = mapped_column(SmallInteger)        # 0 = Monday ... 6 = Sunday
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)


# --------------------------------------------------------------------------- #
# 4. When the student is free to study
# --------------------------------------------------------------------------- #
class Availability(Base):
    __tablename__ = "availabilities"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="ck_availabilities_day_0_6"),
        CheckConstraint("end_time > start_time", name="ck_availabilities_end_after_start"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day_of_week: Mapped[int] = mapped_column(SmallInteger)        # 0 = Monday ... 6 = Sunday
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)


# --------------------------------------------------------------------------- #
# 5. A planned slot on the calendar (focus work or a recovery break)
# --------------------------------------------------------------------------- #
class ScheduleBlock(Base):
    __tablename__ = "schedule_blocks"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="ck_schedule_blocks_end_after_start"),
        Index("ix_schedule_blocks_user_start", "user_id", "start_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # NULL for recovery breaks (they are not linked to any subtask)
    subtask_id: Mapped[str | None] = mapped_column(ForeignKey("subtasks.id", ondelete="SET NULL"), nullable=True, index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    block_type: Mapped[BlockType] = mapped_column(_enum(BlockType, "block_type"), default=BlockType.FOCUS)
    mode: Mapped[ScheduleMode] = mapped_column(_enum(ScheduleMode, "block_mode"), default=ScheduleMode.ADAPTIVE)
    status: Mapped[BlockStatus] = mapped_column(_enum(BlockStatus, "block_status"), default=BlockStatus.PLANNED)


# --------------------------------------------------------------------------- #
# 6. A real focus session + the student's self-report (no camera tracking)
# --------------------------------------------------------------------------- #
class FocusSession(Base):
    __tablename__ = "focus_sessions"
    __table_args__ = (
        CheckConstraint("focus_rating IS NULL OR focus_rating BETWEEN 1 AND 5", name="ck_focus_sessions_rating_1_5"),
        CheckConstraint("planned_minutes > 0", name="ck_focus_sessions_planned_positive"),
        CheckConstraint("actual_minutes IS NULL OR actual_minutes >= 0", name="ck_focus_sessions_actual_non_negative"),
        CheckConstraint("pause_count >= 0", name="ck_focus_sessions_pause_count_non_negative"),
        Index("ix_focus_sessions_user_started", "user_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # SET NULL keeps the session history (needed for attention learning) if a subtask is deleted
    subtask_id: Mapped[str | None] = mapped_column(ForeignKey("subtasks.id", ondelete="SET NULL"), nullable=True, index=True)
    schedule_block_id: Mapped[str | None] = mapped_column(ForeignKey("schedule_blocks.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    planned_minutes: Mapped[int] = mapped_column(Integer)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pause_count: Mapped[int] = mapped_column(Integer, default=0)
    focus_rating: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)     # optional 1-5 stars
    outcome: Mapped[SessionOutcome | None] = mapped_column(_enum(SessionOutcome, "session_outcome"), nullable=True)
    ended_early: Mapped[bool] = mapped_column(Boolean, default=False)

    @property
    def completed(self) -> bool:
        """Used by the attention model: the student did the full session and did not say 'no'."""
        return not self.ended_early and self.outcome != SessionOutcome.NO


# --------------------------------------------------------------------------- #
# 7. What we learned about the student's attention (one row per student)
# --------------------------------------------------------------------------- #
class AttentionProfile(Base):
    __tablename__ = "attention_profiles"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    capacity_minutes: Mapped[int] = mapped_column(Integer, default=25)
    break_minutes: Mapped[int] = mapped_column(Integer, default=5)
    peak_window: Mapped[str | None] = mapped_column(String(32), nullable=True)   # e.g. "09:00-11:00"
    low_window: Mapped[str | None] = mapped_column(String(32), nullable=True)    # e.g. "19:00-21:00"
    sessions_used: Mapped[int] = mapped_column(Integer, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)    # True = still using 25 / 5 fallback
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# --------------------------------------------------------------------------- #
# 8. A stress-based suggestion ("We suggest a lighter plan for today")
# --------------------------------------------------------------------------- #
class AdaptationProposal(Base):
    __tablename__ = "adaptation_proposals"
    __table_args__ = (Index("ix_adaptation_proposals_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # The Component 4 risk signal that caused this proposal (shared integration table)
    risk_signal_id: Mapped[str | None] = mapped_column(ForeignKey("signal_events.event_id", ondelete="SET NULL"), nullable=True, index=True)
    status: Mapped[ProposalStatus] = mapped_column(_enum(ProposalStatus, "proposal_status"), default=ProposalStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    changes: Mapped[list["AdaptationChange"]] = relationship(
        back_populates="proposal", cascade="all, delete-orphan", passive_deletes=True,
    )


# --------------------------------------------------------------------------- #
# 9. One row per suggested change, with its reason and the student's decision
# --------------------------------------------------------------------------- #
class AdaptationChange(Base):
    __tablename__ = "adaptation_changes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    proposal_id: Mapped[str] = mapped_column(ForeignKey("adaptation_proposals.id", ondelete="CASCADE"), index=True)
    # NULL for a new recovery break (no existing block yet)
    schedule_block_id: Mapped[str | None] = mapped_column(ForeignKey("schedule_blocks.id", ondelete="SET NULL"), nullable=True, index=True)
    change_type: Mapped[ChangeType] = mapped_column(_enum(ChangeType, "change_type"))
    # old_* = the original plan (kept so "Restore original plan" works)
    old_start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    old_end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    new_start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    new_end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reason: Mapped[str] = mapped_column(String(300))
    is_protected: Mapped[bool] = mapped_column(Boolean, default=False)   # due soon -> never moved
    decision: Mapped[ChangeDecision] = mapped_column(_enum(ChangeDecision, "change_decision"), default=ChangeDecision.PENDING)

    proposal: Mapped[AdaptationProposal] = relationship(back_populates="changes")


# --------------------------------------------------------------------------- #
# 10. XP given to the student (event_key is unique -> the same XP is never given twice)
# --------------------------------------------------------------------------- #
class XPEvent(Base):
    __tablename__ = "xp_events"
    __table_args__ = (Index("ix_xp_events_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    event_key: Mapped[str] = mapped_column(String(120), unique=True)    # e.g. "subtask-done:<id>"
    xp_amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --------------------------------------------------------------------------- #
# 11. Badges the student earned (each badge only once per student)
# --------------------------------------------------------------------------- #
class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_code", name="uq_user_badges_user_badge"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_code: Mapped[str] = mapped_column(String(64))
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --------------------------------------------------------------------------- #
# 12. Record of important scheduler actions (research traceability)
# --------------------------------------------------------------------------- #
class AuditLog(Base):
    # Prefixed so it cannot clash with a future team-wide audit table
    __tablename__ = "scheduler_audit_logs"
    __table_args__ = (Index("ix_scheduler_audit_logs_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    # SET NULL keeps the research record if the account is deleted
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64))                   # e.g. "proposal.accepted"
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# --------------------------------------------------------------------------- #
# 13. Research pilot: does this participant get the static or the adaptive scheduler?
# --------------------------------------------------------------------------- #
class ExperimentAssignment(Base):
    __tablename__ = "experiment_assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    mode: Mapped[ScheduleMode] = mapped_column(_enum(ScheduleMode, "experiment_mode"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Researcher who assigned it (NULL = assigned automatically)
    assigned_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
