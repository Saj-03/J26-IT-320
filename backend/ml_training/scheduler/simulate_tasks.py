"""
M3 Step 1 - Synthetic tasks: what the student ESTIMATED vs how long it REALLY took.

Every fake student (hidden_profiles.csv) gets ~tasks_per_week tasks for 8 weeks.
For each task:
    true minutes     = typical effort of its load (light / medium / heavy)       (assumption)
    student estimate = true / (planning bias x load bias)  + guessing noise, rounded to a "nice" number
    actual minutes   = true x day-to-day noise   (in the app: the focus minutes logged for the task)

Hidden per student (M3 never sees these, it must learn them from the student's past tasks):
    estimation_bias  - from hidden_profiles.csv (survey: worse deadline habit -> bigger underestimate)
    load bias        - heavy work is underestimated more, light work a bit less        (assumption,
                       planning fallacy grows with task complexity: Buehler et al. 1994; Kahneman & Tversky 1979)

Titles come from the 241 labelled student tasks of M2 (data/m2_seed_tasks.csv), so the text is realistic.

Run (from backend/):  python -m ml_training.scheduler.simulate_tasks
Out:                  ml_training/scheduler/data/tasks.csv   (git-ignored, re-made from the seed)
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
PROFILES = HERE / "data" / "hidden_profiles.csv"
SEED_TASKS = HERE / "data" / "m2_seed_tasks.csv"
OUT = HERE / "data" / "tasks.csv"
SIM_WEEKS = 8

# assumption: typical real effort (median minutes, spread) per load
TRUE_EFFORT = {"low": (35, 0.35), "medium": (75, 0.35), "heavy": (150, 0.35)}
# assumption: per-student extra bias by load (median multiplier, spread)
LOAD_BIAS = {"low": (0.95, 0.08), "medium": (1.0, 0.08), "heavy": (1.15, 0.10)}
GUESS_NOISE = 0.15          # a student's estimate is never exact (log spread)
DAY_NOISE = 0.12            # the same task takes a bit more / less on different days
NICE_MINUTES = np.array([15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480])

# Task type from the title (same idea as the app's task types)
TYPE_WORDS = [
    ("exam_prep", ("exam", "quiz", "past paper", "revise", "revision", "mcq", "test")),
    ("lecture_review", ("lecture", "slides", "notes", "recording")),
    ("reading", ("read", "chapter", "article", "paper summary")),
    ("project", ("project", "app", "system", "prototype", "website", "backend", "frontend", "api")),
]


def task_type(title: str) -> str:
    t = title.lower()
    for kind, words in TYPE_WORDS:
        if any(w in t for w in words):
            return kind
    return "assignment"


def nice(minutes: float) -> int:
    """Students write round numbers: 53 -> 60, 100 -> 90."""
    return int(NICE_MINUTES[np.abs(NICE_MINUTES - minutes).argmin()])


def simulate_student(rng: np.random.Generator, p: pd.Series, seed_tasks: pd.DataFrame) -> list[dict]:
    load_bias = {load: float(rng.lognormal(np.log(m), s)) for load, (m, s) in LOAD_BIAS.items()}
    rows = []
    for week in range(SIM_WEEKS):
        n = max(1, int(p["tasks_per_week"]) + int(rng.integers(-1, 2)))
        for _ in range(n):
            pick = seed_tasks.iloc[int(rng.integers(len(seed_tasks)))]
            load = pick["label"]
            median, spread = TRUE_EFFORT[load]
            true = float(rng.lognormal(np.log(median), spread))
            estimate = nice(true / (p["estimation_bias"] * load_bias[load]) * rng.lognormal(0, GUESS_NOISE))
            actual = max(5, round(true * rng.lognormal(0, DAY_NOISE)))
            day = week * 7 + int(rng.integers(7))                     # the day the task was finished
            rows.append({"student_id": p["student_id"], "week": week, "day": day, "title": pick["text"],
                         "load": load, "task_type": task_type(pick["text"]),
                         "estimated_minutes": estimate, "actual_minutes": actual,
                         "hidden_load_bias": round(load_bias[load], 3)})
    rows.sort(key=lambda r: r["day"])
    for i, r in enumerate(rows):
        r["task_id"] = f"{p['student_id']}-t{i:03d}"
    return rows


def simulate_all(profiles: pd.DataFrame, seed_tasks: pd.DataFrame, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = [r for _, p in profiles.iterrows() for r in simulate_student(rng, p, seed_tasks)]
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate estimated vs actual task durations (M3 data)")
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    tasks = simulate_all(pd.read_csv(PROFILES), pd.read_csv(SEED_TASKS), args.seed)
    tasks.to_csv(OUT, index=False)
    ratio = tasks["actual_minutes"] / tasks["estimated_minutes"]
    print(f"{len(tasks)} tasks for {tasks['student_id'].nunique()} students -> {OUT}")
    print(f"actual / estimate: median {ratio.median():.2f}, "
          f"{(ratio > 1).mean():.0%} of tasks took longer than the student thought")
    print(tasks.groupby("load")[["estimated_minutes", "actual_minutes"]].median().round(0).to_string())


if __name__ == "__main__":
    main()
