"""
Component 3 (Scheduler) -> Component 4 (Burnout): WEEKLY BEHAVIOUR SUMMARY (DeviationSignal).

Kept here in shared/integration (next to contracts.py) because it is the part C3 SENDS
to another component. Owner: IT23270206 (Scheduler). Endpoint: POST /api/scheduler/integration/weekly-summary

Once a week, for every student, we summarise how their study week went and send it
to Component 4 through the shared integration log (signal_type "DEVIATION").
C4's Isolation Forest compares it with the student's usual weeks - an unusual week
raises their wellbeing risk, which comes back to us as a RiskSignal (stress_service).

The 5 numbers (one study week = Monday 00:00 .. Sunday 24:00, Sri Lanka time):
  task_completion_rate : tasks due this week that are done (1.0 if nothing was due)
  missed_sessions      : planned focus sessions that were never started
  task_load            : tasks due this week (cancelled ones not counted)
  deadline_density     : share of the 7 days that have at least one deadline (0..1)
  semester_phase       : "exam_period" if exam preparation is due this week, else "mid_semester"

Rules:
  * focus tracking off -> nothing is sent (ethics: the student opted out)
  * each week is sent once (fixed event id per student + week; a repeat is ignored)
  * only FINISHED weeks are sent
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.components.scheduler.commitment_service import SL_OFFSET
from app.components.scheduler.models import FocusSession, Task
from app.components.scheduler.settings_service import get_settings
from app.components.scheduler.task_service import audit
from app.shared.integration.contracts import DeviationSignal
from app.shared.integration.validator import is_duplicate, record

WEEK = timedelta(days=7)
MAX_BACKFILL_WEEKS = 12          # C4 reads at most the last 12 weeks


def week_start_of(moment: datetime) -> datetime:
    """Monday 00:00 Sri Lanka time of the week containing `moment`, as UTC (naive, like the DB)."""
    local = moment + SL_OFFSET
    monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return monday - SL_OFFSET


def last_finished_week(now: datetime) -> datetime:
    """Start of the week before the current one."""
    return week_start_of(now) - WEEK


def weekly_summary(db: Session, user, week_start: datetime) -> dict:
    """The 5 numbers for one study week."""
    week_end = week_start + WEEK
    due = (db.query(Task)
             .filter(Task.user_id == user.id, Task.status != "cancelled",
                     Task.deadline >= week_start, Task.deadline < week_end)
             .all())
    missed = (db.query(FocusSession)
                .filter(FocusSession.user_id == user.id, FocusSession.was_missed.is_(True),
                        FocusSession.started_at >= week_start, FocusSession.started_at < week_end)
                .count())

    done = sum(t.status == "done" for t in due)
    deadline_days = {((t.deadline + SL_OFFSET).date()) for t in due}
    return {
        "task_completion_rate": round(done / len(due), 3) if due else 1.0,
        "missed_sessions": missed,
        "task_load": len(due),
        "deadline_density": round(len(deadline_days) / 7, 3),
        "semester_phase": "exam_period" if any(t.task_type == "exam_prep" for t in due) else "mid_semester",
    }


def event_id_for(user, week_start: datetime) -> str:
    """Same student + same week -> same id, so a week is never sent twice."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"ihusd/deviation/{user.research_id}/{week_start.date()}"))


def send_week(db: Session, user, week_start: datetime, now: datetime | None = None) -> dict:
    """Send one week's summary to C4. Returns {"status": SENT / ALREADY_SENT / TRACKING_OFF, ...}."""
    now = now or datetime.utcnow()
    week = week_start.date().isoformat()
    if not get_settings(db, user)["focus_tracking_enabled"]:
        return {"week_start": week, "status": "TRACKING_OFF"}

    event_id = event_id_for(user, week_start)
    if is_duplicate(db, event_id):
        return {"week_start": week, "status": "ALREADY_SENT", "event_id": event_id}

    numbers = weekly_summary(db, user, week_start)
    signal = DeviationSignal(event_id=event_id, student_id=user.research_id,
                             week_start=week_start.replace(tzinfo=timezone.utc),
                             timestamp=now.replace(tzinfo=timezone.utc), **numbers)
    audit(db, user.id, "deviation_signal_sent", event_id=event_id, week_start=week, **numbers)
    record(db, "DEVIATION", signal, "ACCEPTED")          # commits (audit row is saved with it)
    return {"week_start": week, "status": "SENT", "event_id": event_id, **numbers}


def send_recent_weeks(db: Session, user, weeks: int = 1, now: datetime | None = None) -> list[dict]:
    """Send the last `weeks` finished weeks, OLDEST first (C4 treats the newest one as "this week")."""
    now = now or datetime.utcnow()
    weeks = max(1, min(weeks, MAX_BACKFILL_WEEKS))
    last = last_finished_week(now)
    return [send_week(db, user, last - WEEK * back, now) for back in range(weeks - 1, -1, -1)]


def send_all_students(db: Session, now: datetime | None = None) -> list[dict]:
    """Weekly job: last finished week for every student (run once a week, e.g. Monday morning)."""
    from app.shared.users.models import User
    return [{"student_id": u.research_id, **send_recent_weeks(db, u, 1, now)[0]} for u in db.query(User).all()]
