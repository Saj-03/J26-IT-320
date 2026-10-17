"""Unit tests for Step 3.2 synthetic students (small hand-made priors, no files needed)."""
from ml_training.scheduler.simulate_students import (
    PEAK_HOURS, MIN_PEAK_LOW_GAP, SIM_WEEKS, hour_gap, make_students,
)

PRIORS = {
    "productive_time": {"Late Night": 0.4, "Morning": 0.3, "Evening": 0.2, "Afternoon": 0.1},
    "before_deadline": {"5": 0.3, "4": 0.3, "3": 0.3, "2": 0.1},
    "pss10": {"mean": 20.4, "sd": 4.7},
    "stress_affects_tasks": {"Sometimes": 0.5, "Often": 0.3, "Rarely": 0.2},
    "study_hours_per_week": {"5-10 hours": 0.6, "Less than 5 hours": 0.4},
    "tasks_per_week": {"3-5": 0.7, "1-2": 0.3},
    "task_choice": {"Closest deadline": 0.5, "Most important task": 0.5},
    "job": {"share_with_job": 0.43, "hours_per_week": {"mean": 29, "sd": 16}},
}


def test_same_seed_same_students():
    assert make_students(20, 7, PRIORS).equals(make_students(20, 7, PRIORS))
    assert not make_students(20, 7, PRIORS).equals(make_students(20, 8, PRIORS))


def test_hour_gap_goes_round_midnight():
    assert hour_gap(23, 1) == 2
    assert hour_gap(0, 12) == 12


def test_peak_matches_productive_time_and_low_is_far():
    df = make_students(300, 1, PRIORS)
    for row in df.itertuples():
        assert row.peak_hour in PEAK_HOURS[row.productive_time]
        assert hour_gap(row.peak_hour, row.low_hour) >= MIN_PEAK_LOW_GAP


def test_survey_shares_are_kept():
    df = make_students(3000, 2, PRIORS)
    shares = df["productive_time"].value_counts(normalize=True)
    for answer, expected in PRIORS["productive_time"].items():
        assert abs(shares[answer] - expected) < 0.03
    assert abs(df["has_job"].mean() - 0.43) < 0.03


def test_values_stay_in_sensible_ranges():
    df = make_students(500, 3, PRIORS)
    assert df["capacity_minutes"].between(10, 90).all()
    assert df["base_success"].between(0.3, 0.95).all()
    assert df["pss10"].between(0, 40).all()
    assert df["stress_sensitivity"].between(0, 1).all()
    assert df["tasks_per_week"].between(1, 5).all()                  # only bins 1-2 and 3-5 here
    assert (df.loc[~df["has_job"], "job_hours_per_week"] == 0).all()


def test_stress_weeks_are_valid_weeks():
    df = make_students(200, 4, PRIORS)
    for weeks in df["stress_weeks"]:
        nums = [int(w) for w in weeks.split(";")] if weeks else []
        assert len(nums) == len(set(nums)) <= 3
        assert all(0 <= w < SIM_WEEKS for w in nums)
