"""Unit tests for Step 3.3 simulated focus sessions (hand-made profiles, no files needed)."""
import pandas as pd

from app.components.scheduler.models import FocusSession
from ml_training.scheduler.simulate_sessions import (
    COMPLETION_THRESHOLD, clock_gap, simulate_all, success_probability,
)

# One "normal" hidden profile; tests change one value at a time
BASE = {
    "student_id": "sim0000", "peak_hour": 20, "low_hour": 9, "capacity_minutes": 30.0,
    "base_success": 0.65, "heavy_penalty": 0.2, "fatigue_per_session": 0.05,
    "stress_sensitivity": 0.6, "stress_weeks": "1", "study_hours_per_week": 10.0, "noise": 0.1,
}


def profiles(n=5):
    return pd.DataFrame([{**BASE, "student_id": f"sim{i:04d}", "peak_hour": [8, 14, 19, 22, 0][i % 5]}
                         for i in range(n)])


def chance(**change):
    args = {"hour": 15, "planned": 25, "load": "low", "earlier_today": 0, "stress_week": False} | change
    return success_probability(BASE, **args)


# ---------------------------------------------------------------------------
# The hidden rules really change the success chance
# ---------------------------------------------------------------------------
def test_peak_hour_better_than_low_hour():
    assert chance(hour=20) > chance(hour=15) > chance(hour=9)


def test_longer_than_capacity_is_harder():
    assert chance(planned=25) == chance(planned=30) > chance(planned=60)


def test_heavy_fatigue_and_stress_make_it_harder():
    assert chance(load="heavy") < chance(load="medium") < chance(load="low")
    assert chance(earlier_today=3) < chance()
    assert chance(stress_week=True) < chance()


def test_clock_gap_goes_round_midnight():
    assert clock_gap(23.5, 0.5) == 1


# ---------------------------------------------------------------------------
# The simulated rows look like real focus_sessions rows
# ---------------------------------------------------------------------------
def test_same_seed_same_sessions():
    assert simulate_all(profiles(), 1, weeks=2).equals(simulate_all(profiles(), 1, weeks=2))


def test_columns_are_focus_session_columns():
    sim = simulate_all(profiles(), 1, weeks=1)
    table = set(FocusSession.__table__.columns.keys())
    extra = set(sim.columns) - table
    assert extra == {"true_p_success"}          # the only extra = hidden truth for evaluation


def test_completed_matches_the_80_percent_rule():
    sim = simulate_all(profiles(), 2, weeks=4)
    started = sim[~sim["was_missed"] & ~sim["auto_closed"]]
    reached = started["actual_minutes"] >= COMPLETION_THRESHOLD * started["planned_minutes"]
    assert (reached == started["completed"]).all()


def test_missed_and_auto_closed_rows():
    sim = simulate_all(profiles(20), 3, weeks=4)
    missed, closed = sim[sim["was_missed"]], sim[sim["auto_closed"]]
    assert len(missed) > 0
    assert (missed["actual_minutes"] == 0).all() and not missed["completed"].any()
    assert (missed["started_at"] == missed["ended_at"]).all()
    assert (closed["actual_minutes"] == 0).all() and not closed["is_valid"].any()


def test_sessions_of_a_student_never_overlap():
    sim = simulate_all(profiles(), 4, weeks=4)
    started = sim[~sim["was_missed"] & ~sim["auto_closed"]]
    for _, s in started.sort_values("started_at").groupby("user_id"):
        assert (s["started_at"].iloc[1:].values >= s["ended_at"].iloc[:-1].values).all()


def test_ratings_are_1_to_5_or_blank():
    ratings = simulate_all(profiles(), 5, weeks=2)["focus_rating"].dropna()
    assert ratings.between(1, 5).all()
