"""Unit tests for Step 4 evaluation + baseline rules (tiny hand-made sessions)."""
from datetime import datetime

import pandas as pd

from ml_training.scheduler.baselines import median_capacity, predict_success, run
from ml_training.scheduler.evaluate import add_local_time, peak_scores, split_by_week, success_scores
from ml_training.scheduler.simulate_sessions import simulate_all
from ml_training.scheduler.simulate_students import make_students
from tests.test_scheduler_simulate_students import PRIORS


def session(user, utc, completed, minutes=25, week_valid=True):
    return {"user_id": user, "started_at": utc, "completed": completed, "actual_minutes": minutes,
            "planned_minutes": 25, "is_valid": week_valid, "was_missed": False, "true_p_success": 0.5}


# ---------------------------------------------------------------------------
# Evaluation helpers
# ---------------------------------------------------------------------------
def test_local_time_and_late_night_belongs_to_same_study_day():
    df = add_local_time(pd.DataFrame({"started_at": [datetime(2026, 1, 5, 18, 0),    # 23:30 Monday SL
                                                     datetime(2026, 1, 5, 19, 0),    # 00:30 Tuesday SL
                                                     datetime(2026, 1, 12, 4, 0)]}))  # 09:30 next Monday
    assert df["hour"].tolist() == [23, 0, 9]
    assert df["day"].tolist() == [0, 0, 7]
    assert df["week"].tolist() == [0, 0, 1]


def test_split_past_and_future():
    df = pd.DataFrame({"week": [0, 5, 6, 7]})
    train, test = split_by_week(df)
    assert train["week"].tolist() == [0, 5] and test["week"].tolist() == [6, 7]


def test_success_scores_perfect_and_guessing():
    y = pd.Series([True, False, True, False])
    assert success_scores(y, pd.Series([0.9, 0.1, 0.8, 0.2]))["auc"] == 1.0
    assert success_scores(y, pd.Series([0.5] * 4))["auc"] == 0.5


def test_peak_error_goes_round_midnight():
    profiles = pd.DataFrame({"student_id": ["a", "b"], "peak_hour": [23, 9]})
    scores = peak_scores(pd.Series({"a": 1, "b": 9}), profiles)
    assert scores["mean_error_hours"] == 1.0           # (2 + 0) / 2
    assert scores["within_1h"] == 0.5 and scores["within_2h"] == 1.0


# ---------------------------------------------------------------------------
# Baseline rules
# ---------------------------------------------------------------------------
def test_hour_rules_learn_good_and_bad_hours():
    evening, morning = datetime(2026, 1, 5, 13, 30), datetime(2026, 1, 5, 3, 30)   # 19:00 / 09:00 SL
    train = add_local_time(pd.DataFrame([session("a", evening, True)] * 5 + [session("a", morning, False)] * 5))
    test = add_local_time(pd.DataFrame([session("a", evening, True), session("a", morning, False)]))
    p = predict_success(train, test)
    assert p["hour_rules"].iloc[0] > p["student_rate"].iloc[0] > p["hour_rules"].iloc[1]


def test_median_capacity_needs_3_completed_sessions():
    t = datetime(2026, 1, 5, 4, 0)
    train = add_local_time(pd.DataFrame([session("a", t, True, 40)] * 3 + [session("b", t, True, 40)] * 2))
    cap = median_capacity(train, pd.Index(["a", "b"]))
    assert cap.to_dict() == {"a": 40, "b": 25}         # b has only 2 -> default 25


def test_full_run_on_small_simulation():
    profiles = make_students(30, 1, PRIORS)
    sessions = add_local_time(simulate_all(profiles, 1))
    res = run(sessions, profiles)
    assert res["success"]["global_rate"]["auc"] == 0.5
    assert res["success"]["ceiling"]["auc"] > res["success"]["student_rate"]["auc"]
    assert set(res["peak_hour"]) == {"survey_answer", "most_used", "hour_rules"}
