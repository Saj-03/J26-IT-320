"""
Passive monitoring: Isolation Forest learns each student's PERSONAL baseline
(weeks 1-3) and flags weeks that deviate from it. No psychological labels.
"""
import numpy as np


def deviation_score(history: list[list[float]], current: list[float]) -> float:
    """history rows = [completion_rate, missed_sessions, task_load, deadline_density]"""
    if len(history) < 3:
        return 0.0
    # Imported lazily so the app still starts where scipy's DLLs are blocked (e.g. Smart App Control).
    from sklearn.ensemble import IsolationForest
    model = IsolationForest(n_estimators=100, contamination="auto", random_state=42)
    model.fit(np.array(history))
    raw = -model.score_samples(np.array([current]))[0]   # higher = more unusual
    return float(np.clip((raw - 0.35) / 0.4, 0, 1))
