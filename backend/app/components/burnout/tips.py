"""
Tip library (FR7): a gentle, non-clinical suggestion shown ONLY when at least two independent signals agree,
always together with the reason it is being shown. Rule-based and transparent on purpose.
"""
import json
from datetime import date
from pathlib import Path

from app.components.burnout.ml.fusion import REASON_AT

TIPS = json.loads((Path(__file__).with_name("tips.json")).read_text(encoding="utf-8"))
MIN_AGREE = 2

REASON_TEXT = {"deviation": "your week looks different from your usual",
               "journal": "your recent journal entries have a low tone",
               "chat": "your recent chat messages have a low tone",
               "mood": "your mood check-ins have been low"}
# signal -> tip categories it points to (first match wins, in priority order)
CATEGORY_FOR = {"deviation": ["workload", "rest"], "journal": ["reflect", "talk"],
                "chat": ["talk", "reflect"], "mood": ["mood", "break"]}


def _rotate(items: list[str], user_key: str) -> str:
    """Same tip all day for the same student (stable), a different one on other days."""
    return items[(date.today().toordinal() + sum(map(ord, user_key))) % len(items)]


def choose_tip(signals: dict[str, float], factors: list[dict] | None = None, user_key: str = "") -> dict | None:
    agree = [k for k, v in sorted(signals.items(), key=lambda kv: -kv[1]) if v is not None and v > REASON_AT]
    if len(agree) < MIN_AGREE:
        return None
    cat = CATEGORY_FOR[agree[0]][0]
    if agree[0] == "deviation" and factors and factors[0]["feature"] in ("missed sessions", "task completion"):
        cat = "rest"                                   # missing sessions / low completion -> rest before more workload
    reason = "Shown because " + " and ".join(REASON_TEXT[k] for k in agree[:2]) + "."
    return {"text": _rotate(TIPS[cat], user_key), "reason": reason, "category": cat}
