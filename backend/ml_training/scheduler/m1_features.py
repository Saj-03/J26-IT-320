"""
Step 5 - M1 inputs: turn a student's PAST sessions + one new session into numbers.

M1 answers: "If this student starts THIS session now, will they complete it?"
It gets two kinds of input:

  1. SEQUENCE (for the GRU) - the last 10 sessions, oldest first, one row each:
       hour, length, load, completed?, how much of it they did, pauses, gap to the next one
     -> the GRU reads "how things are going lately" (a bad week, stress, a good streak)

  2. CONTEXT (for the MLP) - the new session + a summary of ALL the past:
       hour, weekday, length, load, sessions already done today, hours since the last one,
       the student's past success: overall / near this hour / near this length / for this load
     -> the MLP combines "this situation" with "what this student is like"

Only the PAST is used (sessions that started before the new one), so there is no
peeking into the future. No student id is used, so M1 also works for a NEW student
(pilot) - it only needs their history, which can be empty (cold start).

numpy only (no torch) so the API can reuse it later.
"""
import numpy as np
import pandas as pd

HISTORY = 10                     # sessions the GRU sees
LOADS = ("low", "medium", "heavy")
HOUR_WIDTH = 1.0                 # "near this hour" = bell curve, ~1 h wide
LENGTH_WIDTH = 0.35              # "near this length" on a log2 scale (25 vs 35 min ~ 0.5)
PRIOR_WEIGHT = 2.0               # little evidence -> rate stays near the student's average
DEFAULT_RATE = 0.55              # success rate before we know anything (≈ survey-like sim average)
DEFAULT_FOCUS = 25

STEP_FEATURES = ["is_real", "hour_sin", "hour_cos", "length", "load_low", "load_medium", "load_heavy",
                 "completed", "done_share", "pauses", "gap_after"]
CONTEXT_FEATURES = ["hour_sin", "hour_cos", "weekday_sin", "weekday_cos", "length",
                    "load_low", "load_medium", "load_heavy", "earlier_today", "hours_since_last",
                    "n_past", "student_rate", "hour_rate", "hour_evidence", "length_rate",
                    "length_evidence", "load_rate", "length_vs_usual"]


def cyclic(value: float, period: float) -> tuple[float, float]:
    """23:00 and 01:00 are close -> put hours on a circle (sin, cos)."""
    angle = 2 * np.pi * value / period
    return float(np.sin(angle)), float(np.cos(angle))


def clock_gap(a: np.ndarray, b: float) -> np.ndarray:
    d = np.abs(a - b) % 24
    return np.minimum(d, 24 - d)


def log_length(minutes) -> np.ndarray:
    """25 min -> 0, 50 min -> 1, 12.5 min -> -1 (log2 scale around a 25-min Pomodoro)."""
    return np.log2(np.asarray(minutes, dtype=float) / DEFAULT_FOCUS)


def weighted_rate(weights: np.ndarray, completed: np.ndarray, prior: float) -> tuple[float, float]:
    """Smoothed success rate where closer past sessions count more. Returns (rate, evidence)."""
    w = float(weights.sum())
    return (float((weights * completed).sum()) + PRIOR_WEIGHT * prior) / (w + PRIOR_WEIGHT), w


class StudentHistory:
    """A student's past sessions as numpy arrays (sorted by start time)."""

    def __init__(self, past: pd.DataFrame):
        past = past.sort_values("started_at")
        self.start = past["started_at"].to_numpy()
        self.day = past["day"].to_numpy()
        self.hour = (past["hour"] + past["started_at"].dt.minute / 60).to_numpy(dtype=float)
        self.length = past["planned_minutes"].to_numpy(dtype=float)
        self.actual = past["actual_minutes"].to_numpy(dtype=float)
        self.load = past["task_load"].fillna("medium").to_numpy()
        self.completed = past["completed"].to_numpy(dtype=float)
        self.pauses = past["pause_count"].to_numpy(dtype=float)

    def before(self, moment) -> int:
        """How many past sessions started before `moment`."""
        return int(np.searchsorted(self.start, np.datetime64(moment), side="left"))


def sequence_features(h: StudentHistory, n: int, target_start) -> np.ndarray:
    """Last HISTORY sessions before index n -> (HISTORY, steps) array, zero rows padded at the front."""
    seq = np.zeros((HISTORY, len(STEP_FEATURES)), dtype=np.float32)
    first = max(0, n - HISTORY)
    for row, i in enumerate(range(first, n), start=HISTORY - (n - first)):
        nxt = h.start[i + 1] if i + 1 < n else np.datetime64(target_start)
        gap_hours = (nxt - h.start[i]) / np.timedelta64(1, "h")
        seq[row] = [1.0, *cyclic(h.hour[i], 24), log_length(h.length[i]),
                    *(float(h.load[i] == load) for load in LOADS),
                    h.completed[i], min(h.actual[i] / h.length[i], 1.2),
                    min(h.pauses[i], 5) / 5, np.log1p(max(gap_hours, 0)) / 4]
    return seq


def context_features(h: StudentHistory, n: int, target: dict) -> np.ndarray:
    """The new session + a summary of the first n past sessions."""
    hour, length, load = target["hour"], target["planned_minutes"], target["task_load"] or "medium"
    done = h.completed[:n]

    student_rate, _ = weighted_rate(np.ones(n), done, DEFAULT_RATE)
    near_hour = np.exp(-clock_gap(h.hour[:n], hour) ** 2 / (2 * HOUR_WIDTH ** 2))
    hour_rate, hour_ev = weighted_rate(near_hour, done, student_rate)
    near_len = np.exp(-(log_length(h.length[:n]) - log_length(length)) ** 2 / (2 * LENGTH_WIDTH ** 2))
    length_rate, length_ev = weighted_rate(near_len, done, student_rate)
    load_rate, _ = weighted_rate((h.load[:n] == load).astype(float), done, student_rate)

    completed_minutes = h.actual[:n][done == 1]
    usual = float(np.median(completed_minutes)) if completed_minutes.size >= 3 else DEFAULT_FOCUS
    earlier_today = int((h.day[:n] == target["day"]).sum())
    since = ((np.datetime64(target["started_at"]) - h.start[n - 1]) / np.timedelta64(1, "h")) if n else 48.0

    return np.array([
        *cyclic(hour, 24), *cyclic(target["weekday"], 7), log_length(length),
        *(float(load == x) for x in LOADS),
        earlier_today, np.log1p(min(max(since, 0), 48)), np.log1p(n),
        student_rate, hour_rate, np.log1p(hour_ev), length_rate, np.log1p(length_ev), load_rate,
        float(np.log2(length / usual)),
    ], dtype=np.float32)


def build_dataset(sessions: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray, pd.DataFrame]:
    """Inputs for EVERY started session, each using only the sessions before it.
    Returns (sequences, contexts, labels, rows) - rows keeps user_id/week/true_p_success for evaluation."""
    seqs, ctxs, labels, keep = [], [], [], []
    for _, student in sessions.sort_values("started_at").groupby("user_id", sort=False):
        h = StudentHistory(student)
        for n, target in enumerate(student.to_dict("records")):
            target["hour"] = target["hour"] + target["started_at"].minute / 60
            seqs.append(sequence_features(h, n, target["started_at"]))
            ctxs.append(context_features(h, n, target))
            labels.append(float(target["completed"]))
        keep.append(student)
    rows = pd.concat(keep)
    return np.stack(seqs), np.stack(ctxs), np.array(labels, dtype=np.float32), rows
