"""
PILLAR 2 - Attention learning from focus-session history.
 * attention capacity = typical minutes the student actually sustains
 * peak windows       = hours of day with highest completion rate
 * adaptive Pomodoro  = session length based on capacity (not a fixed 25 min)
"""
from collections import defaultdict
from statistics import median


def attention_capacity(sessions) -> int:
    done = [s.actual_minutes for s in sessions if s.completed]
    return int(median(done)) if len(done) >= 3 else 25   # default Pomodoro until enough data


def peak_windows(sessions, top_n: int = 3) -> set[int]:
    stats = defaultdict(lambda: [0, 0])      # hour -> [completed, total]
    for s in sessions:
        h = s.started_at.hour
        stats[h][1] += 1
        stats[h][0] += int(s.completed)
    rated = [(h, c / t) for h, (c, t) in stats.items() if t >= 2]
    rated.sort(key=lambda x: x[1], reverse=True)
    return {h for h, _ in rated[:top_n]}


def adaptive_pomodoro(capacity: int) -> dict:
    focus = max(15, min(capacity, 50))
    return {"focus_minutes": focus, "break_minutes": 5 if focus <= 30 else 10}


def split_task(estimated_minutes: int, capacity: int) -> list[int]:
    """Decompose a big task into subtasks sized to attention capacity."""
    parts, left = [], estimated_minutes
    while left > 0:
        parts.append(min(capacity, left)); left -= capacity
    return parts
