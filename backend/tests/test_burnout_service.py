"""End-to-end service test on an in-memory DB: signals in -> fusion -> contracts out."""
from datetime import datetime, timedelta
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
    # explicit, strictly increasing times: Windows' clock is too coarse to order events created back to back
    n = db.query(SignalEvent).filter_by(signal_type="DEVIATION", student_id=user.research_id).count()
    db.add(SignalEvent(event_id=p["event_id"], signal_type="DEVIATION", student_id=user.research_id,
                       payload=p, status="ACCEPTED",
                       received_at=datetime.utcnow() - timedelta(hours=100) + timedelta(hours=n))); db.commit()


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


def test_journal_and_mood_endpoints_refresh_signal(db, user):
    """Closed loop: saving a journal / tapping a mood returns a fresh signal without a manual compute call."""
    from app.components.burnout import router, schemas
    j = router.journal(schemas.JournalIn(text="I am exhausted and cannot cope with anything"), db=db, user=user)
    assert j["signal"].risk_level in ("LOW", "MODERATE", "HIGH")
    m = router.mood(schemas.MoodIn(mood=1), db=db, user=user)
    assert m["ok"] and m["signal"].risk_score >= 0
    assert db.query(SignalEvent).filter_by(signal_type="RISK", student_id=user.research_id).count() == 2


def test_demo_bad_week_rises_and_normal_week_stays_low(db, user):
    bad = service.seed_demo(db, user, "bad")
    assert bad.risk_level in ("MODERATE", "HIGH")
    assert sum(1 for v in bad.inputs["signals"].values() if v is not None) >= 3   # several signals agree
    ok = service.seed_demo(db, user, "normal")
    assert ok.risk_level == "LOW" and ok.risk_score < bad.risk_score


def test_summary_has_tip_only_when_signals_agree(db, user):
    from app.components.burnout import tips
    bad = service.seed_demo(db, user, "bad")
    s = service.summary(db, user)
    assert s["tip"] and s["tip"]["reason"].startswith("Shown because") and s["factors"]
    assert tips.choose_tip({"mood": 0.9, "journal": 0.1}) is None          # one signal alone: no tip
    assert tips.choose_tip({"mood": 0.9, "journal": 0.8})["category"] in tips.TIPS
    service.seed_demo(db, user, "normal")
    assert service.summary(db, user)["tip"] is None


def test_journal_list_search_delete_and_isolation(db, user):
    from fastapi import HTTPException
    from app.components.burnout import router, schemas
    other = User(email="o@b.lk", full_name="O", hashed_password="x"); db.add(other); db.commit(); db.refresh(other)
    router.journal(schemas.JournalIn(text="Exam stress is building up"), db=db, user=user)
    router.journal(schemas.JournalIn(text="Lovely walk by the lake"), db=db, user=user)
    router.journal(schemas.JournalIn(text="Secret of the other student"), db=db, user=other)
    allv = router.journal_list(db=db, user=user)
    assert len(allv) == 2 and allv[0].created_at.endswith("Z") and "Secret" not in " ".join(e.text for e in allv)
    assert [e.text for e in router.journal_list(q="EXAM", db=db, user=user)] == ["Exam stress is building up"]
    other_id = router.journal_list(db=db, user=other)[0].id
    with pytest.raises(HTTPException):
        router.journal_delete(other_id, db=db, user=user)          # cannot delete someone else's entry
    router.journal_delete(allv[0].id, db=db, user=user)
    assert len(router.journal_list(db=db, user=user)) == 1


def test_journal_crisis_returns_care_card_and_still_saves(db, user):
    from app.components.burnout import router, schemas
    r = router.journal(schemas.JournalIn(text="I want to end my life"), db=db, user=user)
    assert r["crisis"] is True and any(h["number"] == "1926" for h in r["helplines"])
    assert len(router.journal_list(db=db, user=user)) == 1                  # saved, not discarded
    ok = router.journal(schemas.JournalIn(text="Tired but okay today"), db=db, user=user)
    assert ok["crisis"] is False and ok["helplines"] == []


def test_preferences_defaults_sharing_off_and_delete_my_data(db, user):
    from fastapi import HTTPException
    import asyncio
    from app.components.burnout import router, schemas
    p = service.get_prefs(db, user)
    assert p.share_with_scheduler is True and p.chat_enabled is False           # chat is opt-in
    with pytest.raises(HTTPException):                                          # chat refuses until the student turns it on
        asyncio.run(router.chat(schemas.ChatIn(message="hi"), db=db, user=user))

    service.set_prefs(db, user, share=False, chat=None)
    router.mood(schemas.MoodIn(mood=1), db=db, user=user)
    assert db.query(SignalEvent).filter(SignalEvent.signal_type == "RISK").count() == 0   # nothing sent while sharing is off
    service.set_prefs(db, user, share=True, chat=None)
    router.mood(schemas.MoodIn(mood=1), db=db, user=user)
    assert db.query(SignalEvent).filter(SignalEvent.signal_type == "RISK").count() == 1

    router.journal(schemas.JournalIn(text="private thoughts"), db=db, user=user)
    out = router.delete_my_data(db=db, user=user)["deleted"]
    assert out["journal"] == 1 and out["mood"] >= 1 and out["sent_signals"] >= 1
    assert router.journal_list(db=db, user=user) == []
    assert db.query(SignalEvent).filter(SignalEvent.signal_type.in_(["RISK", "RECOVERY"])).count() == 0


def test_journal_edit_rescores_and_mood_history_is_private(db, user):
    from fastapi import HTTPException
    from app.components.burnout import router, schemas
    other = User(email="p@b.lk", full_name="P", hashed_password="x"); db.add(other); db.commit(); db.refresh(other)
    router.journal(schemas.JournalIn(text="Everything is wonderful today"), db=db, user=user)
    entry = router.journal_list(db=db, user=user)[0]
    before = db.get(JournalEntry, entry.id).sentiment
    out = router.journal_edit(entry.id, schemas.JournalIn(text="I am exhausted and hopeless"), db=db, user=user)
    assert out["entry"].text.startswith("I am exhausted") and db.get(JournalEntry, entry.id).sentiment < before
    with pytest.raises(HTTPException):
        router.journal_edit(entry.id, schemas.JournalIn(text="hijack"), db=db, user=other)
    assert router.journal_edit(entry.id, schemas.JournalIn(text="I want to end my life"), db=db, user=user)["crisis"] is True
    router.mood(schemas.MoodIn(mood=2), db=db, user=user)
    assert [m.mood for m in router.mood_history(db=db, user=user)] == [2]
    assert router.mood_history(db=db, user=other) == []
