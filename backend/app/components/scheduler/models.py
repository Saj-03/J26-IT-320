"""
Component 3 - Adaptive Scheduler: database tables.

Owner: C.S.K.A.I.A. Kumara (IT23270206)

How the tables fit together (every table belongs to one student via user_id):

    users ─┬─< tasks ──────────< tasks          (a big task can have subtasks)
           ├─< commitments                     (lectures, work hours = busy time)
           ├─< focus_sessions >── tasks        (training data for the attention model M1)
           ├── scheduler_settings              (one row per student: mode, timer, opt-outs)
           ├─< schedule_changes                (stress-responsive proposals + student decision)
           ├─< reward_events                   (XP / badges / streaks)
           └─< scheduler_audit_log             (every important event, for research + NFR-10)

Privacy rules (proposal 3.2.2):
  * no raw wellbeing answers, video, screenshots or keystrokes are stored here
  * research exports use users.research_id, never names or emails
"""
import uuid
from datetime import datetime, time

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def new_id() -> str:
    """Random primary key (UUID as text) - works the same on SQLite and PostgreSQL."""
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Allowed values (kept as plain strings so the database stays simple).
# Use these constants in code instead of typing the strings by hand.
# ---------------------------------------------------------------------------
COGNITIVE_LOADS = ("low", "medium", "heavy")        # predicted by M2, student can change it
TASK_STATUSES = ("pending", "in_progress", "done", "missed", "cancelled")
TASK_TYPES = ("assignment", "exam_prep", "lecture_review", "project", "reading", "career", "other")
TASK_SOURCES = ("student", "career", "physical")      # who created the task
COMMITMENT_KINDS = ("lecture", "work", "extracurricular", "personal", "protected_block")
EXPERIMENT_MODES = ("static", "adaptive", "attention_only")
CHANGE_DECISIONS = ("proposed", "accepted", "edited", "rejected", "restored")


# ===========================================================================
# 1. TASKS  (FR-01, FR-03)
# ===========================================================================
class Task(Base):
    """
    One piece of academic work.

    A large task (e.g. "Final report") can be split into subtasks.
    Subtasks are normal Task rows whose parent_id points to the big task.
    """
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True, index=True)

    # --- What the student types in ---
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String, default="other")          # see TASK_TYPES
    deadline: Mapped[datetime] = mapped_column(DateTime, index=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer)                 # student's own guess
    priority: Mapped[int] = mapped_column(Integer, default=3)               # 1 (low) .. 5 (high)
    is_flexible: Mapped[bool] = mapped_column(Boolean, default=True)        # False = student fixed the time

    # --- What the AI adds (filled by the ML models later) ---
    cognitive_load: Mapped[str] = mapped_column(String, default="medium")   # see COGNITIVE_LOADS
    load_confidence: Mapped[float | None] = mapped_column(nullable=True)    # M2 probability, 0..1
    load_set_by_student: Mapped[bool] = mapped_column(Boolean, default=False)  # True = student overrode M2
    predicted_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # M3 median prediction

    # --- Planning and progress ---
    source: Mapped[str] = mapped_column(String, default="student")          # see TASK_SOURCES
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)  # see TASK_STATUSES
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # sum of focus sessions
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ===========================================================================
# 2. COMMITMENTS  (FR-02) - time the scheduler must NOT use
# ===========================================================================
class Commitment(Base):
    """
    Busy time: lectures, part-time work, clubs, or a protected exercise block
    sent by the Physical Wellbeing component.

    Two ways to store it:
      * weekly repeating  -> weekday + start_time + end_time   (e.g. every Monday 08:30-10:30)
      * one-off            -> start_at + end_at                (e.g. a club event on 12 Oct)
    """
    __tablename__ = "commitments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str] = mapped_column(String)                        # e.g. "SE lecture"
    kind: Mapped[str] = mapped_column(String, default="lecture")      # see COMMITMENT_KINDS

    # --- Weekly repeating version ---
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)     # 0 = Monday .. 6 = Sunday
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # --- One-off version ---
    start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Optional date range for recurring items (e.g. only this semester)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ===========================================================================
# 3. FOCUS SESSIONS  (FR-05) - the training data for M1 (Focus Success Network)
# ===========================================================================
class FocusSession(Base):
    """
    One Pomodoro-style focus session.

    "completed" is the label M1 learns to predict:
        did the student sustain the planned session (yes / no)?
    """
    __tablename__ = "focus_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("tasks.id"), nullable=True, index=True)

    # --- Timing ---
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    planned_minutes: Mapped[int] = mapped_column(Integer)          # what the timer was set to
    actual_minutes: Mapped[int] = mapped_column(Integer, default=0)  # real focused time (pauses excluded)
    break_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Behaviour signals ---
    completed: Mapped[bool] = mapped_column(Boolean, default=False)  # label for M1
    pause_count: Mapped[int] = mapped_column(Integer, default=0)
    paused_minutes: Mapped[int] = mapped_column(Integer, default=0)
    was_missed: Mapped[bool] = mapped_column(Boolean, default=False)  # planned but never started
    focus_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # optional 1..5 self-rating

    # --- Context copied at session time (so training data never changes later) ---
    task_load: Mapped[str | None] = mapped_column(String, nullable=True)     # load of the task then
    mode: Mapped[str] = mapped_column(String, default="adaptive")           # experiment mode then
    timer_recommended: Mapped[bool] = mapped_column(Boolean, default=False)  # length came from M1?
    timer_overridden: Mapped[bool] = mapped_column(Boolean, default=False)   # student changed it?


# ===========================================================================
# 4. SCHEDULER SETTINGS - one row per student
# ===========================================================================
class SchedulerSettings(Base):
    """
    Per-student preferences + which experiment mode they are in.

    The survey answers (preferred study hours, usual focus length) are the
    COLD-START fallback: used until the student has enough focus history.
    """
    __tablename__ = "scheduler_settings"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)

    # --- Pilot study ---
    mode: Mapped[str] = mapped_column(String, default="adaptive")       # see EXPERIMENT_MODES
    pilot_group: Mapped[str | None] = mapped_column(String, nullable=True)  # "AB" or "BA" (counterbalancing)

    # --- Study window the scheduler may use ---
    day_start_hour: Mapped[int] = mapped_column(Integer, default=8)
    day_end_hour: Mapped[int] = mapped_column(Integer, default=22)
    max_study_minutes_per_day: Mapped[int] = mapped_column(Integer, default=360)

    # --- Cold-start answers from the onboarding survey ---
    preferred_hours: Mapped[list] = mapped_column(JSON, default=list)   # e.g. [9, 10, 20]
    usual_focus_minutes: Mapped[int] = mapped_column(Integer, default=25)

    # --- Student control (ethics 3.7) ---
    focus_tracking_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    stress_adaptation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    fixed_timer_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # set = ignore M1

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ===========================================================================
# 5. SCHEDULE CHANGES  (FR-07, FR-08) - stress-responsive proposals
# ===========================================================================
class ScheduleChange(Base):
    """
    A change the system PROPOSES (never silently applied).
    The student accepts, edits, rejects, or later restores it - all recorded.
    """
    __tablename__ = "schedule_changes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)

    trigger: Mapped[str] = mapped_column(String, default="wellbeing_signal")  # wellbeing_signal / missed_session / deadline_risk
    signal_event_id: Mapped[str | None] = mapped_column(String, nullable=True)  # C4 event that caused it
    reason: Mapped[str] = mapped_column(String)                 # plain-language explanation (NFR-08)
    change_set: Mapped[list] = mapped_column(JSON)              # list of {task_id, action, old_slot, new_slot}
    previous_plan: Mapped[list | None] = mapped_column(JSON, nullable=True)  # snapshot used by "restore"
    edited_change_set: Mapped[list | None] = mapped_column(JSON, nullable=True)  # if student edited it

    decision: Mapped[str] = mapped_column(String, default="proposed")  # see CHANGE_DECISIONS
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ===========================================================================
# 6. REWARD EVENTS  (FR-10) - gamification
# ===========================================================================
class RewardEvent(Base):
    """
    XP, badge or streak reward.
    id is an IDEMPOTENCY KEY (e.g. "task-<task_id>") so the same reward
    can never be given twice, even if the request is retried (NFR-02).
    """
    __tablename__ = "reward_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String)                   # xp / badge / streak / milestone
    amount: Mapped[int] = mapped_column(Integer, default=0)     # XP points (0 for badges)
    label: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. badge name
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ===========================================================================
# 7. AUDIT LOG  (NFR-10) - every important event, used for the research export
# ===========================================================================
class SchedulerAuditLog(Base):
    """
    Append-only log: plan generated, signal received, change proposed,
    decision made, timer overridden, etc.  Never updated or deleted
    (except when a student asks to delete their research data).
    """
    __tablename__ = "scheduler_audit_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String, index=True)   # e.g. "plan_generated"
    details: Mapped[dict] = mapped_column(JSON, default=dict)      # small JSON, no personal text
    mode: Mapped[str | None] = mapped_column(String, nullable=True)  # experiment mode at that moment
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)  # for NFR-01 (p95 < 2 s)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
