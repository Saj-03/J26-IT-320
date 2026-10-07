"""
MULTI-SIGNAL FUSION (the novel contribution of Component 4).
Combines: behavioural deviation + journal sentiment + chat sentiment + mood taps.
Missing signals are skipped and weights re-normalised (every mode is optional).

Weights and thresholds are INITIAL HEURISTICS. They are sanity-checked against the survey
(CBI reference) and reviewed with pilot data - keep them as named constants so they are easy to tune.
"""
WEIGHTS = {"deviation": 0.35, "journal": 0.25, "chat": 0.2, "mood": 0.2}
T_MODERATE, T_HIGH = 0.45, 0.70
REASON_AT = 0.6          # a single signal above this adds a human-readable reason


def text_risk(compound: float) -> float:
    """VADER compound (-1..1) -> 0..1 risk. Neutral (0) and positive text carry NO risk;
    only negative tone counts. (Mapping neutral to 0.5 would flag plain neutral entries.)"""
    return min(1.0, max(0.0, -compound))


def fuse(deviation: float | None, journal_sent: float | None,
         chat_sent: float | None, mood_avg: float | None) -> dict:
    parts: dict[str, float] = {}
    if deviation is not None:
        parts["deviation"] = deviation                      # 0..1, higher = more unusual
    if journal_sent is not None:
        parts["journal"] = text_risk(journal_sent)
    if chat_sent is not None:
        parts["chat"] = text_risk(chat_sent)
    if mood_avg is not None:
        parts["mood"] = (5 - mood_avg) / 4                  # 1..5 -> 1..0
    if not parts:
        return {"risk_score": 0.0, "risk_level": "LOW", "inputs": {},
                "reasons": ["not enough data yet"]}

    total_w = sum(WEIGHTS[k] for k in parts)
    score = sum(WEIGHTS[k] * v for k, v in parts.items()) / total_w
    level = "HIGH" if score >= T_HIGH else "MODERATE" if score >= T_MODERATE else "LOW"
    if len(parts) < 2 and level == "HIGH":      # one signal alone is never HIGH
        level = "MODERATE"

    reasons = []
    if parts.get("deviation", 0) > REASON_AT:
        reasons.append("your recent pattern differs from your usual")
    if parts.get("journal", 0) > REASON_AT:
        reasons.append("recent journal entries have a low tone")
    if parts.get("chat", 0) > REASON_AT:
        reasons.append("recent chat messages have a low tone")
    if mood_avg is not None and mood_avg <= 2:
        reasons.append("low mood check-ins")
    return {"risk_score": round(score, 3), "risk_level": level,
            "inputs": {k: round(v, 3) for k, v in parts.items()}, "reasons": reasons}
