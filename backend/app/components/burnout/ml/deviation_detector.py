"""
Passive monitoring: compare this week's behaviour with the student's OWN baseline (previous weeks).
Per-feature z-scores (robust to tiny samples, unlike Isolation Forest which needs far more rows than a
student has weeks) -> one 0..1 deviation score plus the features that moved most (explainability).
No psychological labels: it only says "different from your usual".
"""
import numpy as np

MIN_HISTORY = 3
FEATURES = ["task completion", "missed sessions", "task load", "deadline pressure"]
# smallest week-to-week change that counts as real variation (stops a near-constant baseline exploding the z-score)
STD_FLOOR = np.array([0.10, 1.0, 2.0, 0.10])
Z_ZERO, Z_FULL = 1.5, 5.0        # mean-top-2 z at/below Z_ZERO -> 0 ; at/above Z_FULL -> 1


def deviation_detail(history: list[list[float]], current: list[float]) -> dict | None:
    """history rows = [completion_rate, missed_sessions, task_load, deadline_density].
    None when there is no baseline yet (cold start), so fusion skips the signal instead of treating 'no data' as 'calm'."""
    if len(history) < MIN_HISTORY:
        return None
    h = np.array(history, dtype=float)
    cur = np.array(current, dtype=float)
    z = (cur - h.mean(axis=0)) / np.maximum(h.std(axis=0), STD_FLOOR)
    az = np.abs(z)
    top2 = float(np.sort(az)[-2:].mean())
    score = float(np.clip((top2 - Z_ZERO) / (Z_FULL - Z_ZERO), 0, 1))
    order = np.argsort(-az)
    factors = [{"feature": FEATURES[i], "z": round(float(z[i]), 2),
                "direction": "up" if z[i] > 0 else "down"} for i in order if az[i] >= Z_ZERO]
    return {"score": score, "top_factors": factors}


def deviation_score(history: list[list[float]], current: list[float]) -> float | None:
    d = deviation_detail(history, current)
    return None if d is None else d["score"]
