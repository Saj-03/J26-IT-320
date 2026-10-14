"""XP, streaks and badges. Rewards use an idempotency key so they are never given twice."""

# XP for finishing a whole task
XP = {"low": 10, "medium": 20, "heavy": 35}

# XP for a completed focus session = focused minutes x this multiplier
# (harder work earns a bit more per minute)
FOCUS_XP_MULTIPLIER = {"low": 1.0, "medium": 1.2, "heavy": 1.5}


def xp_for_task(cognitive_load: str) -> int:
    return XP.get(cognitive_load, 15)


def xp_for_focus(focused_minutes: int, cognitive_load: str | None) -> int:
    """XP for one COMPLETED focus session. No task chosen -> treated as medium."""
    return round(focused_minutes * FOCUS_XP_MULTIPLIER.get(cognitive_load or "medium", 1.2))


def level_from_xp(total_xp: int) -> int:
    return 1 + total_xp // 200
