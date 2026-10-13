"""
Component 3 - FOCUS SESSIONS (FR-05, FR-15).

    1. Student picks a task and presses "Start"
    2. System suggests a timer length            -> recommend_timer()
    3. Student can keep it or change it           -> start_session()
       (if they change it, timer_overridden = True is saved)
    4. Student can pause and resume               -> pause_session() / resume_session()
       (number of pauses + total pause time are saved)
    5. Student presses "End"                      -> end_session()
       (real focus time = time passed - pause time, optional 1..5 rating)
    6. System decides "completed" or not           -> is_completed()
       (completed sessions earn XP, focus minutes are added to the task)
    7. History list + dashboard numbers           -> focus_history()
    8. Planned sessions that never started        -> check_missed_sessions()

Every session saves the context at that moment (task load, mode, was the
timer changed?) so it can be used later as training data for M1.
"""
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.components.scheduler.engine import attention_model, gamification
from app.components.scheduler.models import FocusSession, RewardEvent, SchedulerSettings, Task
from app.components.scheduler.schemas import FocusEndIn, FocusStartIn
from app.components.scheduler.task_service import audit, get_own_task

DEFAULT_FOCUS = 25            # classic Pomodoro
DEFAULT_BREAK = 5
MIN_HISTORY_SESSIONS = 5      # completed sessions needed before we trust the student's history
COMPLETION_THRESHOLD = 0.8    # focused >= 80% of the planned time -> "completed"
MISSED_GRACE_MINUTES = 30     # a planned session is "missed" if not started 30 min after its time
EARLY_START_MINUTES = 60      # starting up to 1 hour early still counts as doing the planned session


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


# ---------------------------------------------------------------------------
# 3. Pause / resume
# ---------------------------------------------------------------------------
def get_own_running_session(db: Session, user, session_id: str) -> FocusSession:
    """A session of this student that has not ended yet (else 404 / 409)."""
    session = db.get(FocusSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Focus session not found")
    if session.ended_at is not None or session.was_missed:
        raise HTTPException(status.HTTP_409_CONFLICT, "This session has already ended")
    return session


def pause_session(db: Session, user, session_id: str, now: datetime | None = None) -> FocusSession:
    """
    Pause the timer.
    Pauses are a signal for M1: many pauses = attention was harder to keep.
    """
    now = now or datetime.utcnow()
    session = get_own_running_session(db, user, session_id)
    if session.paused_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session is already paused")

    session.paused_at = now
    session.pause_count += 1
    audit(db, user.id, "focus_paused", session_id=session.id, pause_number=session.pause_count)
    db.commit()
    db.refresh(session)
    return session


def resume_session(db: Session, user, session_id: str, now: datetime | None = None) -> FocusSession:
    """Continue the timer and add this pause's length to the total."""
    now = now or datetime.utcnow()
    session = get_own_running_session(db, user, session_id)
    if session.paused_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Session is not paused")

    this_pause = max(int((now - session.paused_at).total_seconds()), 0)
    session.paused_seconds += this_pause
    session.paused_minutes = round(session.paused_seconds / 60)
    session.paused_at = None
    audit(db, user.id, "focus_resumed", session_id=session.id, pause_seconds=this_pause)
    db.commit()
    db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# 4. End
# ---------------------------------------------------------------------------
def end_session(db: Session, user, session_id: str, data: FocusEndIn,
                now: datetime | None = None) -> dict:
    """
    Stop the session and work out how long the student really focused:

        real focus time = (end - start) - all pause time

    If the student presses End while paused, that last pause is closed first
    (the paused minutes are not counted as focus).

    Then: completed or not, task minutes, XP.
    Returns {session, xp_awarded, total_xp, level}.
    """
    now = now or datetime.utcnow()
    session = get_own_running_session(db, user, session_id)

    # 1. Close a pause that is still open
    if session.paused_at is not None:
        session.paused_seconds += max(int((now - session.paused_at).total_seconds()), 0)
        session.paused_minutes = round(session.paused_seconds / 60)
        session.paused_at = None

    # 2. Real focus time
    passed_seconds = (now - session.started_at).total_seconds()
    focus_seconds = max(passed_seconds - session.paused_seconds, 0)
    session.actual_minutes = round(focus_seconds / 60)
    session.ended_at = now

    # 3. Optional self-rating
    if data.focus_rating is not None:
        session.focus_rating = data.focus_rating

    # 4. Completed or not? (this is the label M1 learns to predict)
    session.completed = is_completed(session.actual_minutes, session.planned_minutes)

    # 5. Add the focused minutes to the task
    if session.task_id:
        task = db.get(Task, session.task_id)
        task.actual_minutes = (task.actual_minutes or 0) + session.actual_minutes

    # 6. XP - only for completed sessions (no penalty for stopping early)
    xp = award_focus_xp(db, user, session) if session.completed else 0

    audit(db, user.id, "focus_ended", session_id=session.id, planned=session.planned_minutes,
          actual=session.actual_minutes, pauses=session.pause_count, completed=session.completed,
          xp=xp, rated=data.focus_rating is not None)
    db.commit()
    db.refresh(session)
    return {"session": session, "xp_awarded": xp, **xp_status(db, user)}


def is_completed(actual_minutes: int, planned_minutes: int) -> bool:
    """A session counts as completed when the student focused for at least 80% of the plan."""
    return actual_minutes >= COMPLETION_THRESHOLD * planned_minutes


def award_focus_xp(db: Session, user, session: FocusSession) -> int:
    """
    Give XP for a completed session.
    The reward id "focus-<session id>" makes it impossible to get XP twice for one session.
    """
    key = f"focus-{session.id}"
    if db.get(RewardEvent, key):
        return 0
    xp = gamification.xp_for_focus(session.actual_minutes, session.task_load)
    db.add(RewardEvent(id=key, user_id=user.id, kind="xp", amount=xp, label="Focus session completed"))
    return xp


def xp_status(db: Session, user) -> dict:
    """Total XP and level (shown after the session ends)."""
    db.flush()                                       # include XP added in this request
    total = db.query(func.sum(RewardEvent.amount)).filter(RewardEvent.user_id == user.id).scalar() or 0
    return {"total_xp": total, "level": gamification.level_from_xp(total)}


def rate_session(db: Session, user, session_id: str, rating: int) -> FocusSession:
    """Add or change the 1..5 rating after the session has ended."""
    session = db.get(FocusSession, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Focus session not found")
    if session.ended_at is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "End the session before rating it")

    session.focus_rating = rating
    audit(db, user.id, "focus_rated", session_id=session.id, rating=rating)
    db.commit()
    db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# 5. History (dashboard + data for M1)
# ---------------------------------------------------------------------------
def focus_history(db: Session, user, date_from: datetime | None = None, date_to: datetime | None = None,
                  task_id: str | None = None, completed: bool | None = None,
                  include_missed: bool = True, limit: int = 50, offset: int = 0) -> dict:
    """
    Finished sessions, newest first, plus summary numbers.

    Filters are optional:
        date_from / date_to  -> only sessions that started in this range
        task_id              -> only sessions for one task
        completed            -> only completed (true) or only stopped early (false)
        include_missed       -> false = hide sessions that were planned but never started

    The summary is calculated over ALL matching sessions, not just this page.
    """
    query = db.query(FocusSession).filter(FocusSession.user_id == user.id,
                                          FocusSession.ended_at.isnot(None))   # running ones are not history
    if date_from:
        query = query.filter(FocusSession.started_at >= date_from)
    if date_to:
        query = query.filter(FocusSession.started_at < date_to)
    if task_id:
        query = query.filter(FocusSession.task_id == task_id)
    if completed is not None:
        query = query.filter(FocusSession.completed.is_(completed))
    if not include_missed:
        query = query.filter(FocusSession.was_missed.is_(False))

    matching = query.order_by(FocusSession.started_at.desc()).all()
    page = matching[offset: offset + limit]
    return {"items": page, "total": len(matching), "summary": summarise(matching)}


def summarise(sessions: list[FocusSession]) -> dict:
    """Simple totals and averages for the dashboard."""
    missed = sum(1 for s in sessions if s.was_missed)
    sessions = [s for s in sessions if not s.was_missed]   # the rest is about STARTED sessions
    count = len(sessions)
    done = sum(1 for s in sessions if s.completed)
    minutes = sum(s.actual_minutes for s in sessions)
    ratings = [s.focus_rating for s in sessions if s.focus_rating is not None]
    return {
        "sessions": count,
        "missed": missed,
        "completed": done,
        "completion_rate": round(done / count, 3) if count else None,
        "total_focus_minutes": minutes,
        "average_focus_minutes": round(minutes / count, 1) if count else None,
        "total_pauses": sum(s.pause_count for s in sessions),
        "average_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
    }


# ---------------------------------------------------------------------------
# 6. Missed sessions (planned but never started)
# ---------------------------------------------------------------------------
def check_missed_sessions(db: Session, user, now: datetime | None = None) -> list[FocusSession]:
    """
    Find planned sessions the student did not start, and record them.

    A task's planned session is MISSED when:
      * it has a planned time (scheduled_start) and 30 min have passed since then
      * the task is not done / cancelled
      * no session for this task was started from 1 hour before the planned time onwards
      * it was not already recorded as missed

    Missed sessions are saved as FocusSession rows with was_missed=True and 0 minutes,
    so M1 also learns "the student did not manage to start at this time".
    The app calls this when it opens; it is safe to call many times.
    """
    now = now or datetime.utcnow()

    # Ethics: no tracking -> nothing recorded
    s = get_settings(db, user)
    if s and not s.focus_tracking_enabled:
        return []

    cutoff = now - timedelta(minutes=MISSED_GRACE_MINUTES)
    planned_tasks = (db.query(Task)
                       .filter(Task.user_id == user.id,
                               Task.scheduled_start.isnot(None),
                               Task.scheduled_start <= cutoff,
                               Task.status.in_(("pending", "in_progress")))
                       .all())

    new_missed = []
    for task in planned_tasks:
        planned_at = task.scheduled_start

        # Did the student start any session for this task around / after the planned time?
        # (this also finds an earlier "missed" record, so nothing is recorded twice)
        already = (db.query(FocusSession.id)
                     .filter(FocusSession.task_id == task.id,
                             FocusSession.started_at >= planned_at - timedelta(minutes=EARLY_START_MINUTES))
                     .first())
        if already:
            continue

        planned_minutes = recommend_timer(db, user)["focus_minutes"]
        missed = FocusSession(
            user_id=user.id, task_id=task.id,
            started_at=planned_at, ended_at=planned_at,       # never ran -> zero length
            planned_minutes=planned_minutes, actual_minutes=0,
            completed=False, was_missed=True,
            task_load=task.cognitive_load, mode=get_mode(db, user),
        )
        db.add(missed)
        db.flush()
        audit(db, user.id, "focus_missed", session_id=missed.id, task_id=task.id,
              planned_at=planned_at.isoformat())
        new_missed.append(missed)

    db.commit()
    return new_missed
