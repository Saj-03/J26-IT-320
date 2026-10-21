"""
M3 features - the SAME code is used for training and inside the app (app/components/scheduler/ml/m3_predictor.py).

M3 predicts   log(actual minutes / student's estimate)
for a new task, from the task itself + the student's OWN past tasks (only tasks finished before it).
No student id is used, so the model works for new students too (it then relies on the task alone).

    ratio 1.4 = "this will take 40% longer than you think"
"""
import math

import numpy as np

LOADS = ["low", "medium", "heavy"]
TYPES = ["assignment", "exam_prep", "lecture_review", "reading", "project", "career", "other"]
MAX_HISTORY = 30            # the last 30 finished tasks are enough (and keep it fast)
RECENT = 5

FEATURES = (["log_estimate", "n_history", "hist_median", "hist_mean_recent", "hist_spread",
             "n_same_load", "hist_same_load", "n_same_type", "hist_same_type"]
            + [f"load_{x}" for x in LOADS] + [f"type_{x}" for x in TYPES])


def log_ratio(estimated: float, actual: float) -> float:
    return math.log(max(actual, 1) / max(estimated, 1))


def task_features(estimated: float, load: str, kind: str, history: list[tuple]) -> list[float]:
    """
    estimated, load, kind : the new task
    history               : the student's finished tasks, oldest first, as (estimated, actual, load, kind)
    Missing values are NaN - the gradient-boosting model handles them (= "no history yet").
    """
    past = history[-MAX_HISTORY:]
    ratios = np.array([log_ratio(e, a) for e, a, _, _ in past])
    same_load = np.array([log_ratio(e, a) for e, a, l, _ in past if l == load])
    same_type = np.array([log_ratio(e, a) for e, a, _, k in past if k == kind])
    nan = float("nan")
    return ([math.log(max(estimated, 1)), float(len(past)),
             float(np.median(ratios)) if len(ratios) else nan,
             float(ratios[-RECENT:].mean()) if len(ratios) else nan,
             float(ratios.std()) if len(ratios) >= 3 else nan,
             float(len(same_load)), float(np.median(same_load)) if len(same_load) else nan,
             float(len(same_type)), float(np.median(same_type)) if len(same_type) else nan]
            + [1.0 if load == x else 0.0 for x in LOADS]
            + [1.0 if kind == x else 0.0 for x in TYPES])


def build_rows(tasks) -> np.ndarray:
    """Feature matrix for a task table (one student's tasks must be sorted by the day they finished)."""
    rows, history, current = [], [], None
    for t in tasks.itertuples(index=False):
        if t.student_id != current:                    # next student -> empty history
            current, history = t.student_id, []
        rows.append(task_features(t.estimated_minutes, t.load, t.task_type, history))
        history.append((t.estimated_minutes, t.actual_minutes, t.load, t.task_type))
    return np.array(rows, dtype=float)
