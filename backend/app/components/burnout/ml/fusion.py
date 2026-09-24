"""
MULTI-SIGNAL FUSION (the novel contribution of Component 4).
Combines: behavioural deviation + journal sentiment + chat sentiment + mood taps.
Missing signals are skipped and weights re-normalised (every mode is optional).
"""
WEIGHTS = {"deviation": 0.35, "journal": 0.25, "chat": 0.2, "mood": 0.2}


def fuse(deviation: float | None, journal_sent: float | None,
         chat_sent: float | None, mood_avg: float | None) -> dict:
    parts = {}
    if deviation is not None:
        parts["deviation"] = deviation
    if journal_sent is not None:
        parts["journal"] = (1 - journal_sent) / 2          # -1..1 -> 1..0
    if chat_sent is not None:
        parts["chat"] = (1 - chat_sent) / 2
    if mood_avg is not None:
        parts["mood"] = (5 - mood_avg) / 4                 # 1..5 -> 1..0
    if not parts:
        return {"risk_score": 0.0, "risk_level": "LOW", "inputs": {}}
    total_w = sum(WEIGHTS[k] for k in parts)
    score = sum(WEIGHTS[k] * v for k, v in parts.items()) / total_w
    level = "HIGH" if score >= 0.7 else "MODERATE" if score >= 0.45 else "LOW"
    return {"risk_score": round(score, 3), "risk_level": level, "inputs": parts}
