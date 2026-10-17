"""
Step 3.3 - Simulate focus sessions for the synthetic students.

Every fake student (from hidden_profiles.csv) "uses the focus timer" for 8 weeks.
For each session we work out the chance it succeeds from the HIDDEN profile:

    good:  close to the student's peak hour
    bad:   close to the low hour, longer than their capacity, heavy task,
           many sessions earlier the same day (fatigue), stress week
    plus:  a daily mood and per-session randomness nobody can predict

Then a coin is flipped with that chance -> completed yes/no, real minutes,
pauses, rating. Some planned sessions are missed, a few are left open (auto-closed).

The rows use the same columns as the focus_sessions table, so the M1 code
works on simulated data now and on real pilot data later without changes.
`true_p_success` is the hidden chance - only for checking M1, NEVER a model input.

Run (from backend/):  .venv\\Scripts\\python -m ml_training.scheduler.simulate_sessions --seed 42
In:   ml_training/scheduler/data/hidden_profiles.csv   (Step 3.2)
Out:  ml_training/scheduler/data/sessions.csv
"""
import argparse
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from ml_training.scheduler.simulate_students import SIM_WEEKS

HERE = Path(__file__).resolve().parent
PROFILES = HERE / "data" / "hidden_profiles.csv"
OUT = HERE / "data" / "sessions.csv"

START_DAY = datetime(2026, 1, 5)            # a Monday (Sri Lanka time)
SL_OFFSET = timedelta(hours=5, minutes=30)  # same as commitment_service.SL_OFFSET (DB stores UTC)

# Study day runs 07:00 .. 02:00 next morning. Hours after midnight are written 24, 25
# so a late-night session still belongs to the same study day.
DAY_FIRST_HOUR, DAY_LAST_HOUR = 7.0, 26.0

# --- Behaviour of the app / student (assumptions) ---
LOGGED_SHARE = 0.7              # part of weekly study time done with the focus timer
MAX_SESSIONS_PER_DAY = 6
AT_HABIT_HOUR = 0.5             # half the sessions near the hour they like, the rest anywhere
DEFAULT_TIMER = 25              # static mode suggestion (same as focus_service.DEFAULT_FOCUS)
KEEP_DEFAULT = 0.5              # half the time the student keeps the 25-min suggestion
TIMER_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90]
LOAD_SHARES = {"low": 0.30, "medium": 0.45, "heavy": 0.25}
RATING_GIVEN = 0.6              # rating is optional - 60% of sessions get one
MISSED_SCALE = 0.25             # missed chance = 0.25 x (1 - success chance)
AUTO_CLOSED = 0.01              # 1% of sessions are left open and closed by the system
COMPLETION_THRESHOLD = 0.8      # same as focus_service.COMPLETION_THRESHOLD

# --- How strongly each hidden value moves the success chance (log-odds, assumptions) ---
PEAK_BOOST = 1.0      # at the peak hour
LOW_DROP = 1.0        # at the low hour
HOUR_SPREAD = 1.5     # the peak/low effect fades over ~1.5 hours
OVER_CAPACITY = 2.0   # per "100% longer than capacity"
LOAD_SCALE = 5.0      # heavy_penalty 0.05..0.35 -> -0.25..-1.75 for heavy, half for medium
FATIGUE_SCALE = 5.0   # per session already done today
STRESS_DROP = 1.2     # x stress_sensitivity in a stress week
MOOD_SD = 0.4         # day-to-day mood (shared by all sessions of a day)
NOISE_SCALE = 5.0     # noise 0.05..0.15 -> session randomness sd 0.25..0.75

SESSION_COLUMNS = [
    "id", "user_id", "started_at", "ended_at", "planned_minutes", "actual_minutes", "break_minutes",
    "completed", "pause_count", "paused_seconds", "paused_minutes", "was_missed", "auto_closed",
    "is_valid", "focus_rating", "task_load", "mode", "timer_recommended", "timer_overridden",
    "true_p_success",
]


def sigmoid(x: float) -> float:
    return 1 / (1 + np.exp(-x))


def logit(p: float) -> float:
    return float(np.log(p / (1 - p)))


def clock_gap(a: float, b: float) -> float:
    """Hours between two clock times, going round midnight (23.5 and 0.5 -> 1)."""
    d = abs(a - b) % 24
    return min(d, 24 - d)


def bump(hour: float, centre: float) -> float:
    """1 at the centre hour, fading to ~0 a few hours away (bell curve)."""
    return float(np.exp(-clock_gap(hour, centre) ** 2 / (2 * HOUR_SPREAD ** 2)))


def success_probability(p: dict, hour: float, planned: int, load: str,
                        earlier_today: int, stress_week: bool) -> float:
    """Chance a session succeeds, from the hidden profile only (no randomness)."""
    x = logit(p["base_success"])
    x += PEAK_BOOST * bump(hour, p["peak_hour"])
    x -= LOW_DROP * bump(hour, p["low_hour"])
    x -= OVER_CAPACITY * max(0.0, planned / p["capacity_minutes"] - 1)
    x -= LOAD_SCALE * p["heavy_penalty"] * {"low": 0.0, "medium": 0.5, "heavy": 1.0}[load]
    x -= FATIGUE_SCALE * p["fatigue_per_session"] * earlier_today
    if stress_week:
        x -= STRESS_DROP * p["stress_sensitivity"]
    return float(sigmoid(x))


def stress_week_set(value) -> set[int]:
    """'2;5' -> {2, 5}. Empty cell (no stress weeks) -> empty set."""
    if pd.isna(value) or value == "":
        return set()
    return {int(w) for w in str(value).split(";")}


def choose_timer(rng: np.random.Generator, capacity: float) -> int:
    """Keep the 25-min suggestion, or change it to something close to what they can manage."""
    if rng.random() < KEEP_DEFAULT:
        return DEFAULT_TIMER
    wish = capacity * rng.lognormal(0, 0.35)
    return min(TIMER_OPTIONS, key=lambda m: abs(m - wish))


def day_start_hours(rng: np.random.Generator, p: dict, n: int) -> list[float]:
    """n start times (study-day hours 7..26), some near the habit hour, the rest anywhere."""
    habit = p["peak_hour"] if p["peak_hour"] >= DAY_FIRST_HOUR else p["peak_hour"] + 24
    hours = [habit + rng.normal(0, 1.5) if rng.random() < AT_HABIT_HOUR
             else rng.uniform(DAY_FIRST_HOUR, DAY_LAST_HOUR - 1) for _ in range(n)]
    return sorted(float(np.clip(h, DAY_FIRST_HOUR, DAY_LAST_HOUR - 1)) for h in hours)


def break_for(minutes: int) -> int:
    """Same rule as focus_service.break_for."""
    return 5 if minutes <= 30 else 10


def simulate_student(rng: np.random.Generator, p: dict, weeks: int = SIM_WEEKS) -> list[dict]:
    """All sessions of one student, oldest first."""
    stress_weeks = stress_week_set(p["stress_weeks"])
    sessions_per_week = p["study_hours_per_week"] * 60 * LOGGED_SHARE / 30   # ~30 min per session
    rows = []

    for day in range(weeks * 7):
        n = min(int(rng.poisson(sessions_per_week / 7)), MAX_SESSIONS_PER_DAY)
        if n == 0:
            continue
        mood = rng.normal(0, MOOD_SD)
        stress = day // 7 in stress_weeks
        free_from = DAY_FIRST_HOUR     # sessions can't overlap
        done_today = 0                 # sessions really done earlier today (fatigue)

        for hour in day_start_hours(rng, p, n):
            hour = max(hour, free_from)
            if hour >= DAY_LAST_HOUR:
                break
            planned = choose_timer(rng, p["capacity_minutes"])
            load = rng.choice(list(LOAD_SHARES), p=list(LOAD_SHARES.values()))

            chance = success_probability(p, hour % 24, planned, load, done_today, stress)
            chance = float(sigmoid(logit(chance) + mood + rng.normal(0, p["noise"] * NOISE_SCALE)))

            start_utc = START_DAY + timedelta(days=day, hours=hour) - SL_OFFSET
            row = new_row(p, start_utc, planned, load, chance)

            if rng.random() < MISSED_SCALE * (1 - chance):          # never started
                row.update(ended_at=start_utc, was_missed=True, break_minutes=None)
            elif rng.random() < AUTO_CLOSED:                        # left open, closed by system
                row.update(ended_at=start_utc + timedelta(minutes=planned), auto_closed=True, is_valid=False)
            else:
                fill_outcome(rng, row, chance)
                done_today += 1
                free_from = hour + (row["actual_minutes"] + row["paused_minutes"] + row["break_minutes"]) / 60
            rows.append(row)
    return rows


def new_row(p: dict, start: datetime, planned: int, load: str, chance: float) -> dict:
    """A session row with focus_sessions defaults (nothing happened yet)."""
    return {
        "user_id": p["student_id"], "started_at": start, "ended_at": None,
        "planned_minutes": planned, "actual_minutes": 0, "break_minutes": break_for(planned),
        "completed": False, "pause_count": 0, "paused_seconds": 0, "paused_minutes": 0,
        "was_missed": False, "auto_closed": False, "is_valid": True, "focus_rating": None,
        "task_load": load, "mode": "static", "timer_recommended": False,
        "timer_overridden": planned != DEFAULT_TIMER, "true_p_success": round(chance, 4),
    }


def fill_outcome(rng: np.random.Generator, row: dict, chance: float) -> None:
    """Flip the coin: completed or stopped early, then minutes, pauses and rating."""
    planned = row["planned_minutes"]
    completed = bool(rng.random() < chance)
    if completed:
        actual = max(round(planned * rng.uniform(0.85, 1.0)), round(planned * COMPLETION_THRESHOLD + 0.5))
    else:
        actual = max(1, round(planned * rng.uniform(0.1, 0.75)))

    pauses = int(rng.poisson(0.4 if completed else 1.2))
    paused_seconds = int(sum(rng.uniform(60, 360) for _ in range(pauses)))

    rating = None
    if rng.random() < RATING_GIVEN:
        rating = int(np.clip(round(2 + 2 * completed + (chance - 0.5) + rng.normal(0, 0.8)), 1, 5))

    row.update(
        completed=completed, actual_minutes=int(actual),
        pause_count=pauses, paused_seconds=paused_seconds, paused_minutes=round(paused_seconds / 60),
        ended_at=row["started_at"] + timedelta(minutes=int(actual), seconds=paused_seconds),
        focus_rating=rating,
    )


def simulate_all(profiles: pd.DataFrame, seed: int, weeks: int = SIM_WEEKS) -> pd.DataFrame:
    """Sessions of every student. Each student has its own random stream (seed, index),
    so adding students later does not change the sessions of the earlier ones."""
    rows = []
    for i, p in enumerate(profiles.to_dict("records")):
        student_rows = simulate_student(np.random.default_rng([seed, i]), p, weeks)
        for n, row in enumerate(student_rows):
            row["id"] = f"{p['student_id']}-{n:05d}"
        rows.extend(student_rows)
    return pd.DataFrame(rows, columns=SESSION_COLUMNS)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate focus sessions for the synthetic students")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    parser.add_argument("--weeks", type=int, default=SIM_WEEKS, help="weeks to simulate")
    args = parser.parse_args()

    sessions = simulate_all(pd.read_csv(PROFILES), args.seed, args.weeks)
    sessions.to_csv(OUT, index=False)

    used = sessions[sessions["is_valid"] & ~sessions["was_missed"]]
    print(f"{len(sessions)} sessions for {sessions['user_id'].nunique()} students -> {OUT}")
    print(f"missed {sessions['was_missed'].mean():.1%} | auto-closed {sessions['auto_closed'].mean():.1%} | "
          f"completed (of started) {used['completed'].mean():.1%}")
    print(f"median {used.groupby('user_id').size().median():.0f} usable sessions per student")


if __name__ == "__main__":
    main()
