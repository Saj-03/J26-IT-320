"""Table 3 engagement: "streak retention and reward interactions" per participant x mode in the export."""
from datetime import date, timedelta

from app.components.scheduler.models import RewardEvent
from app.components.scheduler.research import research_export, research_service
from tests.test_scheduler_research_export import NOW, setup_pilot


def test_longest_streak():
    d = date(2026, 10, 1)
    assert research_export.longest_streak(set()) == 0
    assert research_export.longest_streak({d, d + timedelta(days=1), d + timedelta(days=2), d + timedelta(days=5)}) == 3


def test_streak_xp_and_badges_per_mode(env, monkeypatch):
    client, db, current, other = env
    me = current["user"]
    setup_pilot(db, me, other)          # completed sessions: static 6 days ago; adaptive 2 and 1 days ago
    db.add_all([RewardEvent(id="xp-a", user_id=other.id, kind="xp", amount=30, created_at=NOW - timedelta(days=1)),
                RewardEvent(id="badge-a", user_id=other.id, kind="badge", amount=0, label="First Focus",
                            created_at=NOW - timedelta(days=1)),
                RewardEvent(id="xp-s", user_id=other.id, kind="xp", amount=10, created_at=NOW - timedelta(days=6))])
    db.commit()
    monkeypatch.setattr(research_service.settings, "SCHEDULER_RESEARCHER_EMAILS", "me@test.lk")
    rows = {r["mode"]: r for r in research_export.export_rows(db, me, NOW)}
    assert (rows["adaptive"]["longest_streak_days"], rows["adaptive"]["xp_earned"], rows["adaptive"]["badges_earned"]) == (2, 30, 1)
    assert (rows["static"]["longest_streak_days"], rows["static"]["xp_earned"], rows["static"]["badges_earned"]) == (1, 10, 0)
