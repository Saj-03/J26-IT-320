"""
Component 3 - FOCUS SESSIONS (FR-05, FR-15).

Part 1 (this file for now): starting a session.

    1. Student picks a task and presses "Start"
    2. System suggests a timer length            -> recommend_timer()
    3. Student can keep it or change it           -> start_session()
       (if they change it, timer_overridden = True is saved)

Every session saves the context at that moment (task load, mode, was the
timer changed?) so it can be used later as training data for M1.
"""
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.components.scheduler.engine import attention_model
from app.components.scheduler.models import FocusSession, SchedulerSettings, Task
from app.components.scheduler.schemas import FocusStartIn
from app.components.scheduler.task_service import audit, get_own_task

DEFAULT_FOCUS = 25            # classic Pomodoro
DEFAULT_BREAK = 5
MIN_HISTORY_SESSIONS = 5      # completed sessions needed before we trust the student's history


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def get_settings(db: Session, user) -> SchedulerSettings | None:
    return db.get(SchedulerSettings, user.id)


def get_mode(db: Session, user) -> str:
    """Experiment mode: static (baseline) / adaptive / attention_only."""
    s = get_settings(db, user)
    return s.mode if s else "adaptive"


def get_active_session(db: Session, user) -> FocusSession | None:
    """The session that is running now (started, not ended), if any."""
    return (db.query(FocusSession)
              .filter(FocusSession.user_id == user.id,
                      FocusSession.ended_at.is_(None),
                      FocusSession.was_missed.is_(False))
              .first())


def break_for(focus_minutes: int) -> int:
    """Short sessions get a 5 min break, longer ones 10 min."""
    return DEFAULT_BREAK if focus_minutes <= 30 else 10


# ---------------------------------------------------------------------------
# 1. Suggest a timer length
# ---------------------------------------------------------------------------
def recommend_timer(db: Session, user) -> dict:
    """
    Decide the suggested focus length. Checked in this order:

      1. student fixed their own timer in settings  -> use it
      2. static mode (pilot baseline)               -> always 25 / 5
      3. adaptive mode, enough history              -> learned from past sessions
      4. adaptive mode, no history yet              -> onboarding survey answer
      5. nothing known                              -> 25 / 5

    TODO (Step 6): step 3 will use the M1 Focus Success Network instead of rules.
    """
    s = get_settings(db, user)

    # 1. Student's own fixed timer always wins (student control)
    if s and s.fixed_timer_minutes:
        m = s.fixed_timer_minutes
        return {"focus_minutes": m, "break_minutes": break_for(m), "source": "student_fixed",
                "reason": "You set a fixed timer in your settings"}

    # 2. Static mode = the baseline in the experiment, never personalised
    if get_mode(db, user) == "static":
        return {"focus_minutes": DEFAULT_FOCUS, "break_minutes": DEFAULT_BREAK, "source": "static_default",
                "reason": "Standard 25-minute Pomodoro"}

    # 3. Adaptive mode with enough history -> learn from completed sessions
    done = (db.query(FocusSession)
              .filter(FocusSession.user_id == user.id, FocusSession.completed.is_(True))
              .all())
    if len(done) >= MIN_HISTORY_SESSIONS:
        timer = attention_model.adaptive_pomodoro(attention_model.attention_capacity(done))
        return {**timer, "source": "history_rules",
                "reason": f"Based on your last {len(done)} completed sessions"}

    # 4. Not enough history yet -> use what the student told us in the survey
    if s and s.usual_focus_minutes and s.usual_focus_minutes != DEFAULT_FOCUS:
        m = max(15, min(s.usual_focus_minutes, 50))
        return {"focus_minutes": m, "break_minutes": break_for(m), "source": "survey",
                "reason": "Based on how long you said you usually focus"}

    # 5. Nothing known
    return {"focus_minutes": DEFAULT_FOCUS, "break_minutes": DEFAULT_BREAK, "source": "default",
            "reason": "Starting with a standard 25-minute session until we learn your pattern"}


# ---------------------------------------------------------------------------
# 2. Start a session
# ---------------------------------------------------------------------------
def start_session(db: Session, user, data: FocusStartIn, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()

    # Ethics: the student can turn focus tracking off
    s = get_settings(db, user)
    if s and not s.focus_tracking_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Focus tracking is turned off in your settings")

    # Only one running session at a time
    if get_active_session(db, user):
        raise HTTPException(status.HTTP_409_CONFLICT, "You already have a running focus session")

    # The task (if given) must be the student's and still open
    task: Task | None = None
    if data.task_id:
        task = get_own_task(db, user, data.task_id)
        if task.status in ("done", "cancelled"):
            raise HTTPException(status.HTTP_409_CONFLICT, f"This task is already {task.status}")

    # Suggested length vs the length the student actually chose
    rec = recommend_timer(db, user)
    chosen = data.planned_minutes or rec["focus_minutes"]
    overridden = chosen != rec["focus_minutes"]

    session = FocusSession(
        user_id=user.id,
        task_id=task.id if task else None,
        started_at=now,
        planned_minutes=chosen,
        break_minutes=rec["break_minutes"] if not overridden else break_for(chosen),
        # context saved for research / M1 training
        task_load=task.cognitive_load if task else None,
        mode=get_mode(db, user),
        timer_recommended=rec["source"] != "student_fixed",   # True = the system picked the length
        timer_overridden=overridden,
    )
    db.add(session)

    if task and task.status == "pending":
        task.status = "in_progress"

    db.flush()
    audit(db, user.id, "focus_started", session_id=session.id, task_id=session.task_id,
          suggested=rec["focus_minutes"], chosen=chosen, overridden=overridden, source=rec["source"])
    db.commit()
    db.refresh(session)
    return {"session": session, "recommendation": rec}
