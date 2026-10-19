"""
M3 inside the app: "you said 60 min - it will probably take about 85 min (70-110)".

Uses ml_models/m3_duration.joblib (made by ml_training/scheduler/train_m3.py) and the SAME
features as training (ml_training/scheduler/m3_features.py).

The student's history = their finished tasks that have logged focus minutes (actual_minutes),
oldest first. A new student has no history -> the model uses the task alone (load, type, estimate).
No model file / scikit-learn missing -> available() is False and the app keeps the student's estimate.
"""
import math
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from app.components.scheduler.models import Task

MODEL_FILE = Path(__file__).resolve().parents[4] / "ml_models" / "m3_duration.joblib"
MIN_LOGGED_MINUTES = 5            # a finished task with less logged focus time tells us nothing
MAX_HISTORY = 30
RATIO_LIMITS = (0.5, 3.0)         # never predict less than half or more than 3x the student's guess
ROUND_TO = 5


@lru_cache(maxsize=1)
def _load():
    try:
        import joblib
        bundle = joblib.load(MODEL_FILE)
        return bundle if bundle.get("kind") == "m3_quantile_gbm" else None
    except Exception:                                    # no file / no sklearn / old file
        return None


def available() -> bool:
    return _load() is not None


def history(db: Session, user_id: str, exclude_id: str | None = None) -> list[tuple]:
    """The student's finished tasks with logged minutes, oldest first: (estimated, actual, load, type)."""
    rows = (db.query(Task)
              .filter(Task.user_id == user_id, Task.status == "done",
                      Task.actual_minutes >= MIN_LOGGED_MINUTES, Task.completed_at.isnot(None))
              .order_by(Task.completed_at.desc()).limit(MAX_HISTORY).all())
    return [(t.estimated_minutes, t.actual_minutes, t.cognitive_load, t.task_type)
            for t in reversed(rows) if t.id != exclude_id]


def predict(estimated: int, load: str, kind: str, past: list[tuple]) -> dict:
    """{"minutes": median, "low": 10%, "high": 90%, "history_used": n} in whole 5-minute steps."""
    import numpy as np
    from ml_training.scheduler.m3_features import task_features
    bundle = _load()
    x = np.array([task_features(estimated, load, kind, past)], dtype=float)
    lo, hi = RATIO_LIMITS

    def minutes(q):
        ratio = min(max(math.exp(float(bundle["models"][q].predict(x)[0])), lo), hi)
        return max(ROUND_TO, int(round(estimated * ratio / ROUND_TO) * ROUND_TO))

    low, mid, high = minutes(0.1), minutes(0.5), minutes(0.9)
    return {"minutes": mid, "low": min(low, mid), "high": max(high, mid), "history_used": len(past)}


def predict_task(db: Session, task: Task) -> dict | None:
    """Prediction for a task in the database (None if the model is not installed)."""
    if not available():
        return None
    return predict(task.estimated_minutes, task.cognitive_load, task.task_type,
                   history(db, task.user_id, exclude_id=task.id))
