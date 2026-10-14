"""
Component 3 - COMMITMENTS, FREE TIME and CONFLICTS (FR-02).

Simple idea:
    free time = study window (e.g. 8am-10pm) - lectures/work/other commitments

Time zones:
    * Students type lecture times in Sri Lanka time (e.g. Monday 08:30).
    * The database and the API use UTC.
    * Sri Lanka is always UTC+05:30 (no daylight saving), so we just add/subtract 5h30m.
"""
from datetime import date, datetime, timedelta

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.components.scheduler.models import Commitment, SchedulerSettings, Task
from app.components.scheduler.schemas import CommitmentCreate, CommitmentUpdate
from app.components.scheduler.task_service import audit

SL_OFFSET = timedelta(hours=5, minutes=30)   # Sri Lanka time = UTC + 5:30
MIN_SLOT_MINUTES = 15                         # free gaps shorter than this are ignored
DEFAULT_DAY_START = 8                         # used if the student has no settings yet
DEFAULT_DAY_END = 22


# ===========================================================================
# CRUD
# ===========================================================================
def get_own_commitment(db: Session, user, commitment_id: str) -> Commitment:
    """Load a commitment of this student, or 404."""
    item = db.get(Commitment, commitment_id)
    if item is None or item.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commitment not found")
    return item


def create_commitment(db: Session, user, data: CommitmentCreate) -> Commitment:
    item = Commitment(user_id=user.id, **data.model_dump())
    db.add(item)
    db.flush()
    audit(db, user.id, "commitment_created", commitment_id=item.id, kind=item.kind)
    db.commit()
    db.refresh(item)
    return item


def list_commitments(db: Session, user) -> list[Commitment]:
    """Weekly ones first (by day and time), then one-off ones (by date)."""
    items = db.query(Commitment).filter(Commitment.user_id == user.id).all()
    return sorted(items, key=lambda c: (
        not c.is_recurring,
        c.weekday if c.is_recurring else 0,
        str(c.start_time or c.start_at),
    ))


def update_commitment(db: Session, user, commitment_id: str, data: CommitmentUpdate) -> Commitment:
    item = get_own_commitment(db, user, commitment_id)
    changes = data.model_dump(exclude_unset=True)

    # Merge old + new values and run the full CommitmentCreate checks again
    # (e.g. changing only end_time must still be after start_time).
    merged = {f: getattr(item, f) for f in CommitmentCreate.model_fields} | changes
    try:
        checked = CommitmentCreate(**merged)
    except ValidationError as e:
        raise HTTPException(422, e.errors(include_url=False, include_context=False, include_input=False))

    for field in changes:
        setattr(item, field, getattr(checked, field))
    audit(db, user.id, "commitment_updated", commitment_id=item.id, fields=sorted(changes))
    db.commit()
    db.refresh(item)
    return item


def delete_commitment(db: Session, user, commitment_id: str) -> None:
    item = get_own_commitment(db, user, commitment_id)
    db.delete(item)
    audit(db, user.id, "commitment_deleted", commitment_id=commitment_id)
    db.commit()


# ===========================================================================
# Turning commitments into real busy blocks
# ===========================================================================
def busy_blocks(commitments: list[Commitment], first_day: date, days: int) -> list[tuple]:
    """
    Expand commitments into concrete (start_utc, end_utc, commitment) blocks
    for the given Sri Lanka dates.

    Example: "every Monday 08:30-10:30" over 7 days -> one block on the Monday.
    """
    blocks = []
    for i in range(days):
        day = first_day + timedelta(days=i)
        for c in commitments:
            if not c.is_recurring or c.weekday != day.weekday():
                continue
            start = datetime.combine(day, c.start_time) - SL_OFFSET   # SL time -> UTC
            end = datetime.combine(day, c.end_time) - SL_OFFSET
            if c.valid_from and end <= c.valid_from:
                continue                                             # not started yet
            if c.valid_until and start >= c.valid_until:
                continue                                             # already finished
            blocks.append((start, end, c))

    # One-off items: keep them if they touch the date range
    range_start = datetime.combine(first_day, datetime.min.time()) - SL_OFFSET
    range_end = range_start + timedelta(days=days)
    for c in commitments:
        if not c.is_recurring and c.start_at < range_end and c.end_at > range_start:
            blocks.append((c.start_at, c.end_at, c))

    return sorted(blocks, key=lambda b: b[0])


def subtract(window_start: datetime, window_end: datetime, busy: list[tuple]) -> list[tuple]:
    """Cut busy blocks out of one time window -> list of free (start, end) gaps."""
    free, cursor = [], window_start
    for b_start, b_end, _ in busy:                     # busy is sorted by start
        if b_end <= cursor or b_start >= window_end:
            continue                                   # block is outside the window
        if b_start > cursor:
            free.append((cursor, b_start))             # gap before this block
        cursor = max(cursor, b_end)
    if cursor < window_end:
        free.append((cursor, window_end))              # gap after the last block
    return free


# ===========================================================================
# FREE TIME
# ===========================================================================
def study_window(db: Session, user) -> tuple[int, int]:
    """The hours the scheduler may use each day (from the student's settings)."""
    s = db.get(SchedulerSettings, user.id)
    if s is None:
        return DEFAULT_DAY_START, DEFAULT_DAY_END
    return s.day_start_hour, s.day_end_hour


def get_availability(db: Session, user, days: int = 7, now: datetime | None = None) -> dict:
    """
    Free time for the next `days` days, starting today (Sri Lanka date).
    Past time today is not counted as free.
    """
    now = now or datetime.utcnow()
    today = (now + SL_OFFSET).date()
    start_hour, end_hour = study_window(db, user)
    busy = busy_blocks(list_commitments(db, user), today, days)

    result, total = [], 0
    for i in range(days):
        day = today + timedelta(days=i)
        window_start = datetime.combine(day, datetime.min.time()) + timedelta(hours=start_hour) - SL_OFFSET
        window_end = datetime.combine(day, datetime.min.time()) + timedelta(hours=end_hour) - SL_OFFSET
        window_start = max(window_start, now)          # don't offer time that already passed

        slots = []
        if window_start < window_end:
            for s, e in subtract(window_start, window_end, busy):
                minutes = int((e - s).total_seconds() // 60)
                if minutes >= MIN_SLOT_MINUTES:
                    slots.append({"start": s, "end": e, "minutes": minutes})

        free = sum(s["minutes"] for s in slots)
        total += free
        result.append({"date": day.isoformat(), "free_minutes": free, "slots": slots})

    return {"days": result, "total_free_minutes": total}


def free_minutes_until(availability: dict, moment: datetime) -> int:
    """How many free minutes exist from now until `moment`."""
    total = 0
    for day in availability["days"]:
        for s in day["slots"]:
            if s["start"] >= moment:
                continue
            end = min(s["end"], moment)
            total += int((end - s["start"]).total_seconds() // 60)
    return total


# ===========================================================================
# CONFLICTS
# ===========================================================================
def detect_conflicts(db: Session, user, days: int = 14, now: datetime | None = None) -> list[dict]:
    """
    Two kinds of problems the student should know about:

    1. overlap              - two commitments at the same time
    2. impossible_deadline  - not enough free time left to finish the work
                              (checked in deadline order, like a real plan would:
                               earlier tasks use up the free time first)
    """
    now = now or datetime.utcnow()
    conflicts = []

    # --- 1. Overlapping commitments (each pair reported once) ---
    today = (now + SL_OFFSET).date()
    blocks = busy_blocks(list_commitments(db, user), today, 7)   # one week shows every weekly clash
    seen = set()
    for i, (s1, e1, c1) in enumerate(blocks):
        for s2, e2, c2 in blocks[i + 1:]:
            if s2 >= e1:
                break                                  # sorted: no later block can overlap
            pair = tuple(sorted((c1.id, c2.id)))
            if c1.id != c2.id and pair not in seen:
                seen.add(pair)
                conflicts.append({
                    "type": "overlap",
                    "message": f'"{c1.title}" and "{c2.title}" happen at the same time',
                    "ids": list(pair),
                })

    # --- 2. Deadlines that cannot be met ---
    availability = get_availability(db, user, days, now)
    horizon = now + timedelta(days=days)
    tasks = (db.query(Task)
               .filter(Task.user_id == user.id, Task.status.in_(("pending", "in_progress")),
                       Task.deadline > now, Task.deadline <= horizon)
               .order_by(Task.deadline).all())

    # A big task that has subtasks is skipped - its work is counted through its subtasks
    parents = {t.parent_id for t in db.query(Task.parent_id).filter(Task.user_id == user.id,
                                                                    Task.parent_id.isnot(None))}
    needed = 0
    for t in tasks:
        if t.id in parents:
            continue
        # Remaining work = (AI prediction if we have it, else student's estimate) - work already done
        remaining = (t.predicted_minutes or t.estimated_minutes) - (t.actual_minutes or 0)
        needed += max(remaining, 0)
        free = free_minutes_until(availability, t.deadline)
        if needed > free:
            conflicts.append({
                "type": "impossible_deadline",
                "message": (f'"{t.title}" needs about {needed} min of work before its deadline '
                            f'(including earlier tasks), but only {free} free min are left'),
                "ids": [t.id],
            })

    return conflicts
