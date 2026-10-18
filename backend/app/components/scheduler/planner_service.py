"""
Component 3 - MODULE D: "Plan my week" (FR-04, FR-14) - connects the CP-SAT engine to the app.

Steps of build_plan():
    1. open tasks -> work left        (big tasks with steps are planned through their steps)
    2. free time  = study window - commitments - fixed tasks - past time
    3. piece size = the student's focus timer (M1 / rules / survey);  static mode: 60-min blocks
    4. attention  = M1 chance per hour (adaptive);  survey hours (cold start);  none (static)
    5. CP-SAT places the pieces -> saved as PlannedSession rows, task.scheduled_start = first piece
    6. audit row with the time it took (NFR-01, NFR-10)
"""
import time
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.components.scheduler import attention_service
from app.components.scheduler.commitment_service import SL_OFFSET, get_availability, subtract
from app.components.scheduler.engine import cp_scheduler, m1_predictor
from app.components.scheduler.engine.cp_scheduler import WorkItem
from app.components.scheduler.focus_service import break_for, recommend_timer
from app.components.scheduler.models import PlannedSession, SchedulerAuditLog, Task
from app.components.scheduler.settings_service import get_settings

PLAN_DAYS = 7
DAY_CHANGE_HOUR = 3                       # work until 03:00 counts to the day before
SURVEY_HOUR_CHANCE, OTHER_HOUR_CHANCE = 0.7, 0.5     # cold start: hours the student said they like
OPEN = ("pending", "in_progress")


def local_hour(moment: datetime) -> int:
    return (moment + SL_OFFSET).hour


def study_day(moment: datetime):
    return (moment + SL_OFFSET - timedelta(hours=DAY_CHANGE_HOUR)).date()


# ---------------------------------------------------------------------------
# 1. What to plan
# ---------------------------------------------------------------------------
def open_tasks(db: Session, user, now: datetime) -> tuple[list[Task], list[Task]]:
    """(tasks to plan, fixed tasks).  A big task with steps is skipped - its steps are planned."""
    tasks = db.query(Task).filter(Task.user_id == user.id, Task.status.in_(OPEN)).all()
    parents = {t.parent_id for t in db.query(Task.parent_id).filter(Task.user_id == user.id,
                                                                    Task.parent_id.isnot(None))}
    leaves = [t for t in tasks if t.id not in parents]
    fixed = [t for t in leaves if not t.is_flexible and t.scheduled_start]
    flexible = [t for t in leaves if t.is_flexible and t.deadline > now and work_left(t) > 0]
    return flexible, fixed


def work_left(task: Task) -> int:
    """Minutes still to do = (M3 prediction if we have it, else the student's estimate) - done."""
    return max((task.predicted_minutes or task.estimated_minutes) - (task.actual_minutes or 0), 0)


def free_time(db: Session, user, fixed: list[Task], now: datetime) -> list[tuple[datetime, datetime]]:
    """Free gaps for the next PLAN_DAYS days, also without the tasks the student fixed in time."""
    busy = sorted((t.scheduled_start, t.scheduled_start + timedelta(minutes=t.estimated_minutes), t)
                  for t in fixed)
    gaps = []
    for day in get_availability(db, user, PLAN_DAYS, now)["days"]:
        for slot in day["slots"]:
            gaps += subtract(slot["start"], slot["end"], busy)
    return gaps


# ---------------------------------------------------------------------------
# 2. How to plan (depends on the experiment mode)
# ---------------------------------------------------------------------------
def attention_fit(db: Session, user, settings: dict, profile: dict, piece_minutes: int, now: datetime):
    """(fit function for the engine, where it came from).  fit(hour, minutes, load) -> chance 0..1"""
    if settings["mode"] == "static":
        return None, "none"

    if profile["source"] == "m1_model":
        sessions = attention_service.usable_sessions(db, user)
        hours = attention_service.study_hours(db, user)
        loads = ["heavy", "medium", "low"]
        questions = [(h, piece_minutes, load) for load in loads for h in hours]   # one batch for M1
        answers = m1_predictor.M1Student(sessions, now).chances(questions)
        table = {(h, load): p for (h, _, load), p in zip(questions, answers)}
        return (lambda hour, minutes, load: table.get((hour, load), 0.0)), "m1_model"

    liked = set(settings["preferred_hours"] or [])
    if liked:                                                          # cold start: survey answer
        return (lambda hour, minutes, load: SURVEY_HOUR_CHANCE if hour in liked else OTHER_HOUR_CHANCE), "survey"
    return None, "none"


def piece_size(db: Session, user, settings: dict, profile: dict) -> tuple[int, int, str]:
    """(focus minutes, break minutes, source) - same order as the focus timer suggestion."""
    if settings["mode"] == "static":                                   # baseline: plain 1-hour blocks
        m = cp_scheduler.STATIC_PIECE_MINUTES
        return m, break_for(m), "static_default"
    if not settings["fixed_timer_minutes"] and profile["source"] == "m1_model":
        m = profile["recommended_focus"]                               # M1 (profile already computed)
        return m, break_for(m), "m1_model"
    timer = recommend_timer(db, user)                                  # fixed timer / rules / survey
    return timer["focus_minutes"], timer["break_minutes"], timer["source"]


# ---------------------------------------------------------------------------
# 3. Build + save
# ---------------------------------------------------------------------------
def build_plan(db: Session, user, now: datetime | None = None) -> dict:
    began = time.perf_counter()
    now = now or datetime.utcnow()
    settings = get_settings(db, user)
    tasks, fixed = open_tasks(db, user, now)
    profile = ({"source": "static"} if settings["mode"] == "static"   # baseline: no attention at all
               else attention_service.attention_profile(db, user, now))   # M1 once, used twice below
    focus, rest, timer_source = piece_size(db, user, settings, profile)
    fit, attention_source = attention_fit(db, user, settings, profile, focus, now)

    items = [WorkItem(t.id, work_left(t), t.deadline, t.priority, t.cognitive_load) for t in tasks]
    result = cp_scheduler.schedule(items, free_time(db, user, fixed, now), now,
                                   piece_minutes=focus, break_minutes=rest,
                                   day_cap_minutes=settings["max_study_minutes_per_day"],
                                   study_day=study_day, local_hour=local_hour, fit=fit)

    # Replace the future part of the old plan (the past stays for the research data)
    db.query(PlannedSession).filter(PlannedSession.user_id == user.id,
                                    PlannedSession.start >= now).delete(synchronize_session=False)
    plan_id = str(uuid.uuid4())
    first_start = {}
    for s in result["sessions"]:
        db.add(PlannedSession(user_id=user.id, task_id=s["task_id"], plan_id=plan_id, start=s["start"],
                              end=s["end"], minutes=s["minutes"], break_minutes=s["break_minutes"],
                              piece=s["piece"], piece_count=s["of"], chance=s["chance"],
                              mode=settings["mode"]))
        first_start.setdefault(s["task_id"], s["start"])
    for t in tasks:
        t.scheduled_start = first_start.get(t.id)                    # None = could not be planned

    latency_ms = round((time.perf_counter() - began) * 1000)         # NFR-01: p95 must stay under 2 s
    db.add(SchedulerAuditLog(user_id=user.id, event_type="plan_generated", mode=settings["mode"],
                             latency_ms=latency_ms,
                             details={"plan_id": plan_id, "status": result["status"], "tasks": len(tasks),
                                      "sessions": len(result["sessions"]), "unplaced": len(result["unplaced"]),
                                      "attention": attention_source, "focus_minutes": focus}))
    db.commit()

    return {**plan_view(db, user, now), "plan_id": plan_id, "status": result["status"],
            "latency_ms": latency_ms, "focus_minutes": focus, "break_minutes": rest,
            "timer_source": timer_source, "attention_source": attention_source,
            "peak_hours": profile["peak_hours"] if attention_source == "m1_model" else [],
            "unplaced": unplaced_view(tasks, result["unplaced"])}


def unplaced_view(tasks: list[Task], unplaced: list[dict]) -> list[dict]:
    title = {t.id: t.title for t in tasks}
    return [{"task_id": u["task_id"], "title": title[u["task_id"]], "minutes": u["minutes"],
             "reason": "Not enough free time before the deadline"} for u in unplaced]


def plan_view(db: Session, user, now: datetime | None = None) -> dict:
    """The student's planned pieces from now on, with the task title and load."""
    now = now or datetime.utcnow()
    rows = (db.query(PlannedSession, Task)
              .join(Task, Task.id == PlannedSession.task_id)
              .filter(PlannedSession.user_id == user.id, PlannedSession.end > now,
                      Task.status.in_(OPEN))
              .order_by(PlannedSession.start).all())
    return {"mode": get_settings(db, user)["mode"],
            "sessions": [{"id": p.id, "task_id": t.id, "title": t.title, "load": t.cognitive_load,
                          "start": p.start, "end": p.end, "minutes": p.minutes,
                          "break_minutes": p.break_minutes, "piece": p.piece, "of": p.piece_count,
                          "chance": p.chance, "deadline": t.deadline} for p, t in rows]}
