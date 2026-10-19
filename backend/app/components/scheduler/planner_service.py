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
from app.components.scheduler.engine import cp_scheduler, m1_predictor, m3_predictor
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


def work_left(task: Task, predicted: int | None = None) -> int:
    """Minutes still to do = (M3 prediction if we have it, else the student's estimate) - done."""
    total = predicted or task.predicted_minutes or task.estimated_minutes
    return max(total - (task.actual_minutes or 0), 0)


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
def attention_fit(settings: dict, profile: dict, sessions, hours: list[int], piece_minutes: int, now: datetime):
    """(fit function for the engine, where it came from).  fit(hour, minutes, load) -> chance 0..1"""
    if settings["mode"] == "static":
        return None, "none"

    if profile["source"] == "m1_model":
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
def solve(db: Session, user, now: datetime, today_cap: int | None = None) -> dict:
    """Make a plan with CP-SAT but do NOT save it (used by build_plan and the missed-session preview).
    today_cap: a lower study cap for today only (voice planner: "I'm tired today")."""
    settings = get_settings(db, user)
    tasks, fixed = open_tasks(db, user, now)
    # Load the focus history and study hours ONCE (each database trip to Neon costs ~0.3 s)
    hours = [h % 24 for h in range(settings["day_start_hour"], settings["day_end_hour"])]
    if settings["mode"] == "static":                                  # baseline: no attention at all
        sessions, profile = [], {"source": "static"}
    else:
        sessions = attention_service.usable_sessions(db, user)
        profile = attention_service.attention_profile(db, user, now, sessions, hours)
    focus, rest, timer_source = piece_size(db, user, settings, profile)
    fit, attention_source = attention_fit(settings, profile, sessions, hours, focus, now)

    # M3: tasks made before the model (no prediction yet) get one now; a student's own choice is kept
    durations = {}
    if m3_predictor.available():
        past = m3_predictor.history(db, user.id)
        durations = {t.id: m3_predictor.predict(t.estimated_minutes, t.cognitive_load, t.task_type, past)["minutes"]
                     for t in tasks if t.predicted_minutes is None}
    items = [WorkItem(t.id, work_left(t, durations.get(t.id)), t.deadline, t.priority, t.cognitive_load)
             for t in tasks]
    result = cp_scheduler.schedule(items, free_time(db, user, fixed, now), now,
                                   piece_minutes=focus, break_minutes=rest,
                                   day_cap_minutes=settings["max_study_minutes_per_day"],
                                   study_day=study_day, local_hour=local_hour, fit=fit,
                                   day_caps={study_day(now): today_cap} if today_cap is not None else None)
    return {"settings": settings, "tasks": tasks, "result": result, "durations": durations, "focus_minutes": focus,
            "break_minutes": rest, "timer_source": timer_source, "attention_source": attention_source,
            "peak_hours": profile["peak_hours"] if attention_source == "m1_model" else []}


def build_plan(db: Session, user, now: datetime | None = None, today_cap: int | None = None) -> dict:
    began = time.perf_counter()
    now = now or datetime.utcnow()
    plan = solve(db, user, now, today_cap)
    settings, tasks, result = plan["settings"], plan["tasks"], plan["result"]

    # Replace the future part of the old plan (the past stays for the research data)
    db.query(PlannedSession).filter(PlannedSession.user_id == user.id,
                                    PlannedSession.start >= now).delete(synchronize_session=False)
    plan_id = str(uuid.uuid4())
    first_start = {}
    for s in result["sessions"]:
        db.add(PlannedSession(user_id=user.id, task_id=s["task_id"], plan_id=plan_id, start=s["start"],
                              end=s["end"], minutes=s["minutes"], break_minutes=s["break_minutes"],
                              piece=s["piece"], piece_count=s["of"], chance=s["chance"],
                              mode=settings["mode"], created_at=now))
        first_start.setdefault(s["task_id"], s["start"])
    for t in tasks:
        t.scheduled_start = first_start.get(t.id)                    # None = could not be planned
        if t.id in plan["durations"]:
            t.predicted_minutes = plan["durations"][t.id]            # save the new M3 prediction

    latency_ms = round((time.perf_counter() - began) * 1000)         # NFR-01: p95 must stay under 2 s
    db.add(SchedulerAuditLog(user_id=user.id, event_type="plan_generated", mode=settings["mode"],
                             latency_ms=latency_ms, created_at=now,
                             details={"plan_id": plan_id, "status": result["status"], "tasks": len(tasks),
                                      "sessions": len(result["sessions"]), "unplaced": len(result["unplaced"]),
                                      "attention": plan["attention_source"], "focus_minutes": plan["focus_minutes"],
                                      "today_cap": today_cap}))
    db.commit()

    return {**plan_view(db, user, now, settings["mode"]), "plan_id": plan_id, "status": result["status"],
            "latency_ms": latency_ms, "focus_minutes": plan["focus_minutes"], "break_minutes": plan["break_minutes"],
            "timer_source": plan["timer_source"], "attention_source": plan["attention_source"],
            "peak_hours": plan["peak_hours"], "unplaced": unplaced_view(tasks, result["unplaced"])}


def unplaced_view(tasks: list[Task], unplaced: list[dict]) -> list[dict]:
    title = {t.id: t.title for t in tasks}
    return [{"task_id": u["task_id"], "title": title[u["task_id"]], "minutes": u["minutes"],
             "reason": "Not enough free time before the deadline"} for u in unplaced]


def plan_view(db: Session, user, now: datetime | None = None, mode: str | None = None) -> dict:
    """The student's planned pieces from now on, with the task title and load."""
    now = now or datetime.utcnow()
    rows = (db.query(PlannedSession, Task)
              .join(Task, Task.id == PlannedSession.task_id)
              .filter(PlannedSession.user_id == user.id, PlannedSession.end > now,
                      Task.status.in_(OPEN))
              .order_by(PlannedSession.start).all())
    return {"mode": mode or get_settings(db, user)["mode"],
            "sessions": [{"id": p.id, "task_id": t.id, "title": t.title, "load": t.cognitive_load,
                          "start": p.start, "end": p.end, "minutes": p.minutes,
                          "break_minutes": p.break_minutes, "piece": p.piece, "of": p.piece_count,
                          "chance": p.chance, "deadline": t.deadline} for p, t in rows]}


# ---------------------------------------------------------------------------
# 4. Suggested steps (FR-03): a big task cut into steps that fit the student's focus length
# ---------------------------------------------------------------------------
def suggest_steps(db: Session, user, task_id: str) -> dict:
    """Preview only: 180 min with a 50-min focus length -> 4 steps of 45 min (same cut as the planner)."""
    from app.components.scheduler.task_service import get_own_task
    task = get_own_task(db, user, task_id)
    timer = recommend_timer(db, user)                          # M1 / rules / survey / default
    minutes = work_left(task)
    count, size = cp_scheduler.piece_plan(minutes, timer["focus_minutes"]) if minutes else (0, 0)
    sizes = [size] * (count - 1) + [minutes - size * (count - 1)] if count else []
    return {"task_id": task.id, "focus_minutes": timer["focus_minutes"], "source": timer["source"],
            "reason": timer["reason"],
            "steps": [{"title": f"{task.title} - step {i}/{count}", "minutes": m, "load": task.cognitive_load}
                      for i, m in enumerate(sizes, start=1)]}


def create_suggested_steps(db: Session, user, task_id: str) -> Task:
    """Create the suggested steps as subtasks (only for a task that has no steps yet)."""
    from fastapi import HTTPException
    from app.components.scheduler.task_service import audit, drop_planned_pieces, get_own_task
    task = get_own_task(db, user, task_id)
    if task.parent_id:
        raise HTTPException(400, "A step cannot be split again")
    if db.query(Task.id).filter(Task.parent_id == task.id).first():
        raise HTTPException(409, "This task already has steps")
    plan = suggest_steps(db, user, task_id)
    if not plan["steps"]:
        raise HTTPException(400, "Nothing left to split")
    for s in plan["steps"]:
        db.add(Task(user_id=user.id, parent_id=task.id, title=s["title"], description=task.description,
                    task_type=task.task_type, deadline=task.deadline, estimated_minutes=s["minutes"],
                    priority=task.priority, is_flexible=True, cognitive_load=task.cognitive_load,
                    load_set_by_student=task.load_set_by_student, source="scheduler"))
    drop_planned_pieces(db, [task.id])                          # the big task is now planned through its steps
    audit(db, user.id, "steps_suggested_created", task_id=task.id, steps=len(plan["steps"]),
          focus_minutes=plan["focus_minutes"], source=plan["source"])
    db.commit()
    return task


# ---------------------------------------------------------------------------
# 5. Missed sessions -> recovery plan (FR-09)
# ---------------------------------------------------------------------------
MISSED_LOOKBACK_DAYS = 7
STARTED_EARLY_MINUTES = 60          # a focus session up to 1 h before the planned time still counts


def missed_pieces(db: Session, user, now: datetime) -> list[tuple[PlannedSession, Task]]:
    """
    Planned pieces whose time is over, whose task is still open, and that were not started.
    A piece made before the latest "Plan my week" has already been re-planned, so it is not counted.
    """
    from sqlalchemy import func
    from app.components.scheduler.models import FocusSession
    last_plan = (db.query(func.max(SchedulerAuditLog.created_at))
                   .filter_by(user_id=user.id, event_type="plan_generated").scalar())
    rows = (db.query(PlannedSession, Task)
              .join(Task, Task.id == PlannedSession.task_id)
              .filter(PlannedSession.user_id == user.id, PlannedSession.end <= now,
                      PlannedSession.end > now - timedelta(days=MISSED_LOOKBACK_DAYS),
                      Task.status.in_(OPEN))
              .order_by(PlannedSession.start).all())
    if last_plan:
        rows = [(p, t) for p, t in rows if p.end > last_plan]
    if not rows:
        return []
    started = (db.query(FocusSession.task_id, FocusSession.started_at)
                 .filter(FocusSession.user_id == user.id, FocusSession.was_missed.is_(False),
                         FocusSession.task_id.in_({t.id for _, t in rows})).all())
    return [(p, t) for p, t in rows
            if not any(tid == t.id and at >= p.start - timedelta(minutes=STARTED_EARLY_MINUTES)
                       for tid, at in started)]


def recovery_preview(db: Session, user, now: datetime | None = None) -> dict:
    """Missed pieces + where a new plan would put that work (nothing is saved - the student decides)."""
    now = now or datetime.utcnow()
    missed = missed_pieces(db, user, now)
    if not missed:
        return {"missed": [], "moves": [], "at_risk": [], "deadlines_ok": True}
    plan = solve(db, user, now)
    missed_tasks = {t.id: t for _, t in missed}
    first_new = {}
    for s in plan["result"]["sessions"]:
        first_new.setdefault(s["task_id"], s["start"])
    left = {u["task_id"]: u["minutes"] for u in plan["result"]["unplaced"]}
    return {
        "missed": [{"task_id": t.id, "title": t.title, "start": p.start, "end": p.end, "minutes": p.minutes,
                    "piece": p.piece, "of": p.piece_count} for p, t in missed],
        "moves": [{"task_id": tid, "title": t.title, "new_start": first_new[tid]}
                  for tid, t in missed_tasks.items() if tid in first_new],
        "at_risk": unplaced_view(plan["tasks"], plan["result"]["unplaced"]),      # deadlines rechecked
        "deadlines_ok": not left,
    }
