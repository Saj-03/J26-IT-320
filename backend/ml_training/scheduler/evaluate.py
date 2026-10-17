"""
Step 4 - Shared evaluation for every attention model (rules now, M1 tomorrow).

Every model is tested in the SAME way, so the comparison is fair:
  * split by time: each student's first 6 weeks = train, last 2 weeks = test
    (we predict the future from the past, like in real use)
  * 3 questions, 3 scores:
      1. Will the next session succeed?         -> AUC, Brier score, log loss
      2. What is the student's best (peak) hour? -> hours away from the hidden peak
      3. How many minutes will they focus?      -> capacity error (proposal metric)

Works on simulated sessions now and on real pilot sessions later
(peak/capacity truth only exists for simulated students).
"""
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

HERE = Path(__file__).resolve().parent
SESSIONS = HERE / "data" / "sessions.csv"
PROFILES = HERE / "data" / "hidden_profiles.csv"

START_DAY = datetime(2026, 1, 5)            # first day of the simulation (same as simulate_sessions)
SL_OFFSET = timedelta(hours=5, minutes=30)  # UTC -> Sri Lanka time
DAY_CHANGE_HOUR = 3                         # a "study day" ends at 03:00 (late-night work counts to the day before)
TRAIN_WEEKS = 6


def clock_gap(a: float, b: float) -> float:
    """Hours between two clock times, going round midnight (23 and 1 -> 2)."""
    d = abs(a - b) % 24
    return min(d, 24 - d)


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load_sessions(path: Path = SESSIONS) -> pd.DataFrame:
    """Read sessions and add Sri Lanka time columns: hour (0-23), study day, week."""
    df = pd.read_csv(path, parse_dates=["started_at", "ended_at"])
    return add_local_time(df)


def add_local_time(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    local = df["started_at"] + SL_OFFSET
    df["hour"] = local.dt.hour
    df["weekday"] = (local - timedelta(hours=DAY_CHANGE_HOUR)).dt.weekday    # 0 = Monday
    df["day"] = (local - START_DAY - timedelta(hours=DAY_CHANGE_HOUR)).dt.days
    df["week"] = df["day"] // 7
    return df


def started(df: pd.DataFrame) -> pd.DataFrame:
    """Sessions that really ran: valid and not missed (these have a completed yes/no)."""
    return df[df["is_valid"] & ~df["was_missed"]]


def split_by_week(df: pd.DataFrame, train_weeks: int = TRAIN_WEEKS) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Past (train) and future (test) for every student."""
    return df[df["week"] < train_weeks], df[df["week"] >= train_weeks]


# ---------------------------------------------------------------------------
# Scores
# ---------------------------------------------------------------------------
def success_scores(completed: pd.Series, predicted: pd.Series) -> dict:
    """Question 1. AUC: 0.5 = guessing, 1 = perfect. Brier / log loss: lower = better."""
    y = completed.astype(int).to_numpy()
    p = np.clip(predicted.to_numpy(dtype=float), 1e-6, 1 - 1e-6)
    return {
        "auc": round(float(roc_auc_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 4),
        "log_loss": round(float(log_loss(y, p)), 4),
    }


def peak_scores(predicted_peak: pd.Series, profiles: pd.DataFrame) -> dict:
    """Question 2. predicted_peak: student_id -> hour. Compared with the hidden peak hour."""
    truth = profiles.set_index("student_id")["peak_hour"]
    gaps = pd.Series({sid: clock_gap(h, truth[sid]) for sid, h in predicted_peak.items()})
    return {
        "mean_error_hours": round(float(gaps.mean()), 3),
        "within_1h": round(float((gaps <= 1).mean()), 4),
        "within_2h": round(float((gaps <= 2).mean()), 4),
    }


def capacity_scores(predicted_minutes: pd.Series, test: pd.DataFrame, profiles: pd.DataFrame) -> dict:
    """Question 3. predicted_minutes: student_id -> minutes.
    mae_next_sessions = |prediction - real minutes| over the test sessions (proposal metric).
    mae_hidden        = |prediction - hidden capacity| (only for simulated students)."""
    rows = started(test)
    pred = rows["user_id"].map(predicted_minutes)
    truth = profiles.set_index("student_id")["capacity_minutes"]
    hidden = pd.Series({sid: abs(m - truth[sid]) for sid, m in predicted_minutes.items()})
    return {
        "mae_next_sessions": round(float((pred - rows["actual_minutes"]).abs().mean()), 2),
        "mae_hidden": round(float(hidden.mean()), 2),
    }
