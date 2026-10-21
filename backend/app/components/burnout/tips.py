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


def allowed_categories(agree: list[str]) -> list[str]:
    """Categories that fit the situation: those the top two agreeing signals point to, in rule order."""
    out: list[str] = []
    for k in agree[:2]:
        for c in CATEGORY_FOR[k]:
            if c not in out:
                out.append(c)
    return out


def choose_tip(signals: dict[str, float], factors: list[dict] | None = None, user_key: str = "", picker=None) -> dict | None:
    """`picker` (optional) is the per-student bandit: it may swap the rules' category for another ALLOWED category.
    Without it the behaviour is exactly the fixed rules."""
    agree = [k for k, v in sorted(signals.items(), key=lambda kv: -kv[1]) if v is not None and v > REASON_AT]
    if len(agree) < MIN_AGREE:
        return None
    cat = CATEGORY_FOR[agree[0]][0]
    if agree[0] == "deviation" and factors and factors[0]["feature"] in ("missed sessions", "task completion"):
        cat = "rest"                                   # missing sessions / low completion -> rest before more workload
    informed = False
    if picker is not None:
        allowed = allowed_categories(agree)
        if cat not in allowed:
            allowed.insert(0, cat)
        cat, informed = picker(allowed, cat)
    reason = "Shown because " + " and ".join(REASON_TEXT[k] for k in agree[:2]) + "."
    if informed:
        reason += " This kind of tip is chosen from the ones you have tried before."
    return {"text": _rotate(TIPS[cat], user_key), "reason": reason, "category": cat,
            "policy": "bandit" if picker is not None else "rules"}
