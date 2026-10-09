"""
PILLAR 1 - Constraint-based scheduler (also the STATIC BASELINE for the experiment).
Rules: earliest deadline first, then priority; fit into free slots; never after deadline.
When attention data exists, heavy tasks go into peak windows.
"""
from datetime import datetime, timedelta


def free_slots(day_start: datetime, days: int = 7, start_h: int = 8, end_h: int = 22):
    slots = []
    for d in range(days):
        base = (day_start + timedelta(days=d)).replace(minute=0, second=0, microsecond=0)
        for h in range(start_h, end_h):
            slots.append(base.replace(hour=h))
    return slots


def schedule(tasks, now: datetime, peak_hours: set[int] | None = None):
    """Returns {task_id: start_datetime}. peak_hours=None -> static baseline mode."""
    order = sorted(tasks, key=lambda t: (t.deadline, -t.priority))
    used, plan = set(), {}
    slots = [s for s in free_slots(now) if s > now]
    for t in order:
        candidates = [s for s in slots if s not in used and s + timedelta(minutes=t.estimated_minutes) <= t.deadline]
        if peak_hours and t.cognitive_load == "heavy":
            peak = [s for s in candidates if s.hour in peak_hours]
            candidates = peak or candidates
        if candidates:
            plan[t.id] = candidates[0]
            used.add(candidates[0])
    return plan
