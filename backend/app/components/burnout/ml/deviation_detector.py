"""
Passive monitoring: Isolation Forest learns each student's PERSONAL baseline
(weeks 1-3) and flags weeks that deviate from it. No psychological labels.
"""
import numpy as np
from sklearn.ensemble import IsolationForest

MIN_HISTORY = 3


def deviation_score(history: list[list[float]], current: list[float]) -> float | None:
    """history rows = [completion_rate, missed_sessions, task_load, deadline_density].
    Returns 0..1 (higher = more unusual), or None when there is no baseline yet (cold start),
    so fusion skips the signal instead of treating 'no data' as 'calm'."""
    if len(history) < MIN_HISTORY:
        return None
    model = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
    model.fit(np.array(history, dtype=float))
    raw = -model.score_samples(np.array([current], dtype=float))[0]   # higher = more unusual
    return float(np.clip((raw - 0.35) / 0.4, 0, 1))   # scaling constants: to be tuned (see ml_training)
