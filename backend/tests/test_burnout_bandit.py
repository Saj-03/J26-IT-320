"""Per-student tip bandit: rules decide when, the bandit only chooses among allowed, vetted categories."""
import random
import types
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
import app.db.base  # noqa: F401  (registers every model)
from app.shared.users.models import User
from app.core.config import settings
from app.components.burnout import service, tips
from app.components.burnout.models import TipEvent
from app.components.burnout.ml import tip_bandit as bandit

PRIOR = bandit.prior_from_counts(0, 0)


@pytest.fixture
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng)()
    yield s
    s.close()


@pytest.fixture
def user(db):
    u = User(id="bandit-test-user", email="a@b.lk", full_name="A", hashed_password="x")
    db.add(u); db.commit(); db.refresh(u)
    return u


def test_cold_start_follows_the_rules_default():
    cat, informed = bandit.thompson_pick(["workload", "rest"], {}, PRIOR, random.Random(1), default="workload")
    assert (cat, informed) == ("workload", False)


def test_history_of_one_category_wins_most_draws():
    stats = {"rest": (20, 0), "workload": (0, 20)}
    picks = [bandit.thompson_pick(["workload", "rest"], stats, PRIOR, random.Random(s), default="workload")[0] for s in range(60)]
    assert picks.count("rest") >= 55


def test_only_allowed_categories_are_returned():
    stats = {"talk": (30, 0)}                       # talk is loved but not allowed in this situation
    for s in range(30):
        cat, _ = bandit.thompson_pick(["workload", "rest"], stats, PRIOR, random.Random(s), default="workload")
        assert cat in ("workload", "rest")


def test_prior_is_shared_but_small():
    a, b = bandit.prior_from_counts(30, 10)
    assert a + b == pytest.approx(bandit.PRIOR_STRENGTH) and a > b


def test_choose_tip_without_picker_is_the_fixed_rules():
    t = tips.choose_tip({"deviation": 0.9, "mood": 0.8}, None, "u1")
    assert t["category"] == "workload" and t["policy"] == "rules"


def test_picker_can_only_swap_within_allowed_and_explains_itself():
    seen = {}

    def picker(allowed, default):
        seen["allowed"], seen["default"] = allowed, default
        return "rest", True

    t = tips.choose_tip({"deviation": 0.9, "mood": 0.8}, None, "u1", picker)
    assert seen["default"] == "workload" and "rest" in seen["allowed"]
    assert t["category"] == "rest" and t["policy"] == "bandit" and "tried before" in t["reason"]
    assert t["text"] in tips.TIPS["rest"]            # still a fixed, vetted tip


def test_no_tip_without_two_agreeing_signals_even_with_a_picker():
    assert tips.choose_tip({"deviation": 0.9, "mood": 0.1}, None, "u1", lambda a, d: (a[0], True)) is None


def test_policy_assignment(user, monkeypatch):
    monkeypatch.setattr(settings, "TIP_POLICY", "rules"); monkeypatch.setattr(settings, "BANDIT_IDS", "")
    assert service.tip_policy(user) == "rules"
    monkeypatch.setattr(settings, "TIP_POLICY", "bandit")
    assert service.tip_policy(user) == "bandit"
    monkeypatch.setattr(settings, "BANDIT_IDS", "P-someone-else")      # a pilot list overrides the global setting
    assert service.tip_policy(user) == "rules"
    monkeypatch.setattr(settings, "BANDIT_IDS", user.research_id)
    assert service.tip_policy(user) == "bandit"


def test_summary_uses_the_students_own_history(db, user, monkeypatch):
    service.seed_demo(db, user, "bad"); service.publish(db, user)
    monkeypatch.setattr(settings, "BANDIT_IDS", ""); monkeypatch.setattr(settings, "TIP_POLICY", "rules")
    base = service.summary(db, user)["tip"]
    assert base and base["policy"] == "rules"
    # the student keeps dismissing the rules' category and keeps trying another allowed one
    sig = service.summary(db, user)["signals"]
    agree = [k for k, v in sorted(sig.items(), key=lambda kv: -kv[1]) if v > 0.6]
    allowed = tips.allowed_categories(agree)
    other = next(c for c in allowed if c != base["category"])
    for _ in range(12):
        db.add(TipEvent(user_id=user.id, category=base["category"], action="dismissed"))
        db.add(TipEvent(user_id=user.id, category=other, action="tried"))
    db.commit()
    monkeypatch.setattr(settings, "TIP_POLICY", "bandit")
    monkeypatch.setattr(bandit, "date", types.SimpleNamespace(today=lambda: date(2026, 10, 22)))   # fixed seed: no flaky draws
    learned = service.summary(db, user)["tip"]
    # it may still explore a category it has no data for, but it must move away from the one the student keeps dismissing
    assert learned["policy"] == "bandit" and learned["category"] in allowed and learned["category"] != base["category"]
    assert learned["text"] in tips.TIPS[learned["category"]]
