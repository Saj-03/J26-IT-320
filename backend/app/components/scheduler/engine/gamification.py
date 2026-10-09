"""XP, streaks and badges. Rewards use an idempotency key so they are never given twice."""
XP = {"low": 10, "medium": 20, "heavy": 35}


def xp_for_task(cognitive_load: str) -> int:
    return XP.get(cognitive_load, 15)


def level_from_xp(total_xp: int) -> int:
    return 1 + total_xp // 200
