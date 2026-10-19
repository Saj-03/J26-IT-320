"""
M1 inside the app: load the trained Focus Success Network and ask it "what if" questions.

  chance(hour, minutes)  -> P(the student completes that session)
  profile()              -> best / worst hours, focus capacity, suggested Pomodoro

The inputs are built with the SAME code used in training (ml_training/scheduler/m1_features.py),
so the model sees numbers exactly like the ones it learned from.

Safe fallback: if torch or the model file is missing, `available()` is False and the
scheduler keeps using its rules - the app never breaks because of M1.
"""
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

from app.components.scheduler.commitment_service import SL_OFFSET

MODEL_FILE = Path(__file__).resolve().parents[4] / "ml_models" / "m1_focus_net.pt"
DAY_CHANGE_HOUR = 3                 # late-night work until 03:00 counts to the day before (same as training)
TIMER_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90]
CAPACITY_DROP = 0.2                 # capacity = longest timer not clearly worse than 15 min (same as training)
POMODORO_MIN, POMODORO_MAX = 15, 50  # suggested timer stays in a sensible range


@lru_cache(maxsize=1)
def _load():
    """Load the model once. Returns (model, mean, std) or None if it cannot be used."""
    try:
        import torch
        from ml_training.scheduler.m1_model import FocusSuccessNet
        ck = torch.load(MODEL_FILE, weights_only=False)      # our own file, saved by train_m1.py
        model = FocusSuccessNet()
        model.load_state_dict(ck["state_dict"])
        model.eval()
        return model, ck["ctx_mean"], ck["ctx_std"]
    except Exception:                                      # no torch / no file / old file
        return None


def available() -> bool:
    return _load() is not None


def warm_up_in_background() -> None:
    """Load PyTorch + the model while the server starts (~2 s), so the first student request is fast."""
    import threading
    threading.Thread(target=_load, daemon=True, name="m1-warm-up").start()


def history_frame(sessions) -> pd.DataFrame:
    """FocusSession rows -> the table m1_features expects (Sri Lanka hour, study day, ...)."""
    rows = [{
        "started_at": s.started_at, "planned_minutes": s.planned_minutes, "actual_minutes": s.actual_minutes,
        "task_load": s.task_load, "completed": s.completed, "pause_count": s.pause_count,
    } for s in sessions]
    df = pd.DataFrame(rows, columns=["started_at", "planned_minutes", "actual_minutes", "task_load",
                                     "completed", "pause_count"])
    df["started_at"] = pd.to_datetime(df["started_at"])
    local = df["started_at"] + SL_OFFSET
    df["hour"] = local.dt.hour
    df["day"] = (local - timedelta(hours=DAY_CHANGE_HOUR)).dt.normalize().map(lambda d: d.toordinal())
    return df


class M1Student:
    """One student's history, ready for many what-if questions."""

    def __init__(self, sessions, now: datetime):
        from ml_training.scheduler.m1_features import StudentHistory
        self.model, self.mean, self.std = _load()
        self.history = StudentHistory(history_frame(sessions))
        self.n = len(sessions)
        self.now = now

    def chances(self, questions: list[tuple[float, int, str]]) -> list[float]:
        """[(hour, minutes, load), ...] -> chance for each, all in one batch.
        Asked as "the first session of the next study day" so today's fatigue does not hide the pattern."""
        import torch
        from ml_training.scheduler.m1_features import context_features, sequence_features
        start = self.now + timedelta(days=1)
        local = start + SL_OFFSET - timedelta(hours=DAY_CHANGE_HOUR)
        seq = sequence_features(self.history, self.n, start)
        ctx = np.stack([context_features(self.history, self.n, {
            "hour": hour, "planned_minutes": minutes, "task_load": load,
            "weekday": local.weekday(), "day": -1, "started_at": start,
        }) for hour, minutes, load in questions])
        ctx = ((ctx - self.mean) / self.std).astype(np.float32)
        seqs = np.repeat(seq[None], len(questions), axis=0)
        with torch.no_grad():
            return torch.sigmoid(self.model(torch.as_tensor(seqs), torch.as_tensor(ctx))).tolist()

    def profile(self, hours: list[int], load: str = "medium") -> dict:
        """Chance at every study hour (25 min), best/worst hours, capacity and suggested Pomodoro."""
        by_hour = dict(zip(hours, self.chances([(h, 25, load) for h in hours])))
        ranked = sorted(by_hour, key=by_hour.get, reverse=True)
        peak = ranked[0]

        by_length = dict(zip(TIMER_OPTIONS, self.chances([(peak, m, load) for m in TIMER_OPTIONS])))
        logit = lambda p: np.log(max(p, 1e-6) / max(1 - p, 1e-6))
        short = logit(by_length[TIMER_OPTIONS[0]])
        capacity = max((m for m, p in by_length.items() if logit(p) >= short - CAPACITY_DROP),
                   default=TIMER_OPTIONS[0])                 # no usable answer (e.g. NaN) -> shortest timer
        focus = int(min(max(round(capacity / 5) * 5, POMODORO_MIN), POMODORO_MAX))

        return {
            "hourly": [{"hour": h, "chance": round(by_hour[h], 3)} for h in hours],
            "peak_hours": ranked[:3],
            "low_hours": ranked[-3:][::-1],
            "capacity_minutes": capacity,
            "recommended_focus": focus,
        }
