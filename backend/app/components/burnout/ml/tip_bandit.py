"""
Tip bandit: learn, per student, WHICH KIND of tip they actually try.

Rules still decide WHEN a tip appears (two signals must agree) and which categories fit the situation. The tip text is fixed and
vetted. The bandit only chooses among the categories the rules already allow, using that student's own history:
    tried     = the student pressed "I'll try this"
    dismissed = the student pressed "Not now"
Method: Thompson sampling with a Beta posterior per category. The prior is shared (the overall try-rate across students, worth a
few pseudo-observations), so a new student behaves like the rules until their own choices outweigh it. Nothing here reads
journal or chat text, only counts of tip actions.
"""
import random
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.components.burnout.models import TipEvent

PRIOR_STRENGTH = 4.0          # how many pseudo-observations the shared prior is worth


def student_stats(db: Session, user_id: str) -> dict[str, tuple[int, int]]:
    """{category: (tried, dismissed)} for one student."""
    out: dict[str, list[int]] = {}
    rows = (db.query(TipEvent.category, TipEvent.action, func.count())
              .filter(TipEvent.user_id == user_id, TipEvent.action.in_(["tried", "dismissed"]))
              .group_by(TipEvent.category, TipEvent.action).all())
    for cat, action, n in rows:
        out.setdefault(cat, [0, 0])[0 if action == "tried" else 1] += n
    return {c: (t, d) for c, (t, d) in out.items()}


def population_prior(db: Session) -> tuple[float, float]:
    """Beta prior from the overall try-rate of all students (aggregate counts only)."""
    counts = dict(db.query(TipEvent.action, func.count()).filter(TipEvent.action.in_(["tried", "dismissed"]))
                    .group_by(TipEvent.action).all())
    return prior_from_counts(counts.get("tried", 0), counts.get("dismissed", 0))


def prior_from_counts(tried: int, dismissed: int) -> tuple[float, float]:
    p = (tried + 1) / (tried + dismissed + 2)
    return PRIOR_STRENGTH * p, PRIOR_STRENGTH * (1 - p)


def thompson_pick(allowed: list[str], stats: dict[str, tuple[int, int]], prior: tuple[float, float],
                  rng: random.Random, default: str | None = None) -> tuple[str, bool]:
    """(category, informed). `informed` is True when the student's own history shaped the choice.
    With no history at all for the allowed categories it returns the rules' default, so the first tips follow the rules."""
    default = default if default in allowed else allowed[0]
    if not any(sum(stats.get(c, (0, 0))) for c in allowed):
        return default, False
    a0, b0 = prior
    draws = {c: rng.betavariate(a0 + stats.get(c, (0, 0))[0], b0 + stats.get(c, (0, 0))[1]) for c in allowed}
    best = max(allowed, key=lambda c: (draws[c], c == default))
    return best, stats.get(best, (0, 0))[0] > 0


def make_picker(db: Session, user):
    """A function tips.choose_tip can call: picker(allowed, default) -> (category, informed).
    Seeded by student and day, so the same student sees the same kind of tip all day."""
    stats = student_stats(db, user.id)
    prior = population_prior(db)
    rng = random.Random(f"{user.id}:{date.today().isoformat()}")
    return lambda allowed, default: thompson_pick(allowed, stats, prior, rng, default)
