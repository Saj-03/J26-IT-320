"""End-to-end service test on an in-memory DB: signals in -> fusion -> contracts out."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base
import app.db.base  # noqa: F401  (registers every model)
from app.shared.users.models import User
from app.shared.integration.models import SignalEvent
from app.shared.integration.contracts import RiskSignal, RecoverySignal
from app.shared.integration.mock_signals import mock_deviation_signal
from app.components.burnout import service
from app.components.burnout.models import MoodTap, JournalEntry
from app.components.burnout.ml.deviation_detector import deviation_score


@pytest.fixture
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng)()
    yield s
    s.close()


@pytest.fixture
def user(db):
    u = User(email="a@b.lk", full_name="A", hashed_password="x")
    db.add(u); db.commit(); db.refresh(u)
    return u


def _post_deviation(db, user, bad, seed=None):
    p = mock_deviation_signal(user.research_id, bad_week=bad, seed=seed)
    db.add(SignalEvent(event_id=p["event_id"], signal_type="DEVIATION", student_id=user.research_id,
                       payload=p, status="ACCEPTED")); db.commit()


def test_no_data_is_low_and_does_not_crash(db, user):
    sig = service.publish(db, user)
    assert sig.risk_level == "LOW" and service.to_out(sig).reasons == ["not enough data yet"]


def test_signals_produce_valid_contracts_and_audit_log(db, user):
    db.add_all([MoodTap(user_id=user.id, mood=1),
                JournalEntry(user_id=user.id, mode="text", text="x", sentiment=-0.8, emotion="sadness")])
    db.commit()
    sig = service.publish(db, user)
    assert sig.risk_level in ("MODERATE", "HIGH")
    RiskSignal(**service.to_risk_signal(sig, user.research_id).model_dump())
    rec = RecoverySignal(**service.to_recovery_signal(sig, user.research_id).model_dump())
    assert rec.recovery_mode is True
    kinds = {e.signal_type for e in db.query(SignalEvent).all()}
    assert {"RISK", "RECOVERY"} <= kinds


def test_cold_start_then_behaviour_signal_is_used(db, user):
    _post_deviation(db, user, bad=False, seed=1)
    assert service.latest_behaviour(db, user.research_id)[0] is None      # no baseline yet
    for i in range(2, 6):
        _post_deviation(db, user, bad=False, seed=i)
    _post_deviation(db, user, bad=True, seed=9)
    score, payload = service.latest_behaviour(db, user.research_id)
    assert score is not None and score > 0.3 and payload["semester_phase"] == "exam_period"


def test_trend_rises(db, user):
    service.publish(db, user)
    db.add(MoodTap(user_id=user.id, mood=1)); db.commit()
    assert service.publish(db, user).inputs["trend"] == "RISING"


def test_deviation_detector():
    base = [[0.85, 1, 6, 0.2], [0.8, 1, 7, 0.25], [0.9, 0, 6, 0.2], [0.85, 2, 6, 0.3], [0.8, 1, 5, 0.2]]
    assert deviation_score(base[:2], base[0]) is None
    assert deviation_score(base, [0.3, 7, 14, 0.9]) > deviation_score(base, [0.85, 1, 6, 0.2])
