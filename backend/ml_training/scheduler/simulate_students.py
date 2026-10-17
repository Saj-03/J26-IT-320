"""
Step 3.2 - Synthetic students (hidden profiles).

Every fake student gets a HIDDEN profile = the "truth" about how they focus:
when their best/worst hour is, how long they can focus, how much heavy tasks
and stress hurt them, etc. Later (Step 3.3) we simulate focus sessions from
these profiles. M1 only sees the sessions - if it can find the hidden values
again better than the simple rules, the model really learns something.

Where the numbers come from:
  * SURVEY (data/survey_priors.json): productive time, study hours, tasks/week,
    job + job hours, deadline habit, PSS-10 stress, how much stress affects tasks.
  * ASSUMPTION (survey did not ask): focus capacity, heavy-task penalty,
    fatigue, randomness. These are marked "assumption" below and must be
    explained as such in the thesis.

Run:  .venv\\Scripts\\python ml_training/scheduler/simulate_students.py --n 500 --seed 42
Out:  ml_training/scheduler/data/hidden_profiles.csv
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
PRIORS = HERE / "data" / "survey_priors.json"
OUT = HERE / "data" / "hidden_profiles.csv"

SIM_WEEKS = 8  # how long the simulation runs (Step 3.3)

# Survey answer "most productive time" -> possible peak hours (Sri Lanka time, 24 h).
# Late Night 21..24 -> 24 is written as 0 (midnight).
PEAK_HOURS = {
    "Morning": [7, 8, 9, 10, 11],
    "Afternoon": [12, 13, 14, 15, 16],
    "Evening": [17, 18, 19, 20],
    "Late Night": [21, 22, 23, 0],
}
STUDY_HOURS = list(range(7, 24)) + [0]   # hours a student could study at
MIN_PEAK_LOW_GAP = 5                     # the worst hour is at least 5 h away from the best one

# Survey bins -> (min, max) numbers. Open bins get a sensible upper end.
STUDY_HOURS_RANGE = {
    "Less than 5 hours": (2, 5), "5-10 hours": (5, 10), "11-15 hours": (11, 15),
    "16-20 hours": (16, 20), "More than 20 hours": (21, 30),
}
TASKS_RANGE = {"1-2": (1, 2), "3-5": (3, 5), "6-8": (6, 8), "More than 8": (9, 12)}

# "How often does stress affect your tasks?" -> how strongly stress lowers focus (0..1)
STRESS_SENSITIVITY = {"Never": 0.0, "Rarely": 0.25, "Sometimes": 0.5, "Often": 0.75, "Always": 1.0}

# How many of the 8 weeks are stressful (exam/deadline weeks), by PSS-10 level
STRESS_WEEKS = {"low": (0, 1), "moderate": (1, 2), "high": (2, 3)}


def load_priors(path: Path = PRIORS) -> dict:
    """Numbers made by survey_priors.py (Step 3.1)."""
    return json.loads(path.read_text(encoding="utf-8"))


def pick(rng: np.random.Generator, answer_shares: dict) -> str:
    """Pick one survey answer with the same chance as in the survey."""
    answers = list(answer_shares)
    chances = np.array(list(answer_shares.values()), dtype=float)
    return answers[rng.choice(len(answers), p=chances / chances.sum())]


def hour_gap(a: int, b: int) -> int:
    """Hours between two clock hours, going round midnight (23 and 1 -> 2)."""
    d = abs(a - b) % 24
    return min(d, 24 - d)


def pss_level(score: float) -> str:
    """Usual PSS-10 bands (same as survey_priors.py)."""
    return "low" if score <= 13 else "moderate" if score <= 26 else "high"


def make_student(rng: np.random.Generator, priors: dict, student_id: str) -> dict:
    """One fake student with a hidden profile."""
    # --- When they focus best / worst (survey) ---
    productive_time = pick(rng, priors["productive_time"])
    peak_hour = int(rng.choice(PEAK_HOURS[productive_time]))
    far_hours = [h for h in STUDY_HOURS if hour_gap(h, peak_hour) >= MIN_PEAK_LOW_GAP]
    low_hour = int(rng.choice(far_hours))

    # --- Deadline habit (survey, 1 = never before deadline .. 5 = always) ---
    before_deadline = int(pick(rng, priors["before_deadline"]))
    # better deadline habit -> more sessions succeed on a normal day
    base_success = float(np.clip(0.45 + 0.08 * before_deadline + rng.normal(0, 0.05), 0.3, 0.95))
    # worse habit -> tasks take longer than the student thinks (planning fallacy)
    estimation_bias = float(np.clip(rng.lognormal(np.log(1 + 0.08 * (5 - before_deadline)), 0.15), 0.7, 2.5))

    # --- Stress (survey) ---
    pss = priors["pss10"]
    pss10 = float(np.clip(rng.normal(pss["mean"], pss["sd"]), 0, 40))
    level = pss_level(pss10)
    sensitivity = STRESS_SENSITIVITY[pick(rng, priors["stress_affects_tasks"])]
    stress_sensitivity = float(np.clip(sensitivity + rng.normal(0, 0.1), 0, 1))
    low, high = STRESS_WEEKS[level]
    n_stress = int(rng.integers(low, high + 1))
    stress_weeks = sorted(int(w) for w in rng.choice(SIM_WEEKS, size=n_stress, replace=False))

    # --- How busy they are (survey) ---
    study_hours = float(rng.uniform(*STUDY_HOURS_RANGE[pick(rng, priors["study_hours_per_week"])]))
    tasks_low, tasks_high = TASKS_RANGE[pick(rng, priors["tasks_per_week"])]
    tasks_per_week = int(rng.integers(tasks_low, tasks_high + 1))
    has_job = bool(rng.random() < priors["job"]["share_with_job"])
    job = priors["job"]["hours_per_week"]
    job_hours = float(np.clip(rng.normal(job["mean"], job["sd"]), 4, 45)) if has_job else 0.0

    return {
        "student_id": student_id,
        "productive_time": productive_time,
        "peak_hour": peak_hour,
        "low_hour": low_hour,
        # assumption: median ~30 min (Pomodoro-like), most students 15-60 min
        "capacity_minutes": round(float(np.clip(rng.lognormal(np.log(30), 0.35), 10, 90)), 1),
        "base_success": round(base_success, 3),
        # assumption: heavy tasks lower success by 5-35 points (medium = half of it)
        "heavy_penalty": round(float(rng.uniform(0.05, 0.35)), 3),
        # assumption: each extra session in the same day lowers success a little
        "fatigue_per_session": round(float(rng.uniform(0.02, 0.10)), 3),
        "estimation_bias": round(estimation_bias, 3),
        "before_deadline": before_deadline,
        "pss10": round(pss10, 1),
        "pss_level": level,
        "stress_sensitivity": round(stress_sensitivity, 3),
        "stress_weeks": ";".join(str(w) for w in stress_weeks),   # e.g. "2;5" (0 = first week)
        "study_hours_per_week": round(study_hours, 1),
        "tasks_per_week": tasks_per_week,
        "task_choice": pick(rng, priors["task_choice"]),
        "has_job": has_job,
        "job_hours_per_week": round(job_hours, 1),
        # assumption: day-to-day randomness that no model can predict
        "noise": round(float(rng.uniform(0.05, 0.15)), 3),
    }


def make_students(n: int, seed: int, priors: dict) -> pd.DataFrame:
    """n fake students. Same seed -> exactly the same students (repeatable experiments)."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame([make_student(rng, priors, f"sim{i:04d}") for i in range(n)])


def main() -> None:
    parser = argparse.ArgumentParser(description="Make synthetic students with hidden profiles")
    parser.add_argument("--n", type=int, default=500, help="number of students")
    parser.add_argument("--seed", type=int, default=42, help="random seed")
    args = parser.parse_args()

    students = make_students(args.n, args.seed, load_priors())
    OUT.parent.mkdir(exist_ok=True)
    students.to_csv(OUT, index=False)

    print(f"{len(students)} students -> {OUT}")
    print("Productive time:", students["productive_time"].value_counts(normalize=True).round(3).to_dict())
    print(f"Has job: {students['has_job'].mean():.0%} | "
          f"capacity median {students['capacity_minutes'].median()} min | "
          f"PSS-10 mean {students['pss10'].mean():.1f}")


if __name__ == "__main__":
    main()
