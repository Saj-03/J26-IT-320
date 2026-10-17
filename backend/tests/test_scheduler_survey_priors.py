"""Unit tests for Step 3.1 survey priors (tiny hand-made data, no Excel file needed)."""
import pandas as pd
from ml_training.scheduler.survey_priors import (
    PSS_ITEMS, build_priors, pss10_scores, remove_under_age, shares,
)


def pss_raw(answers):
    """One respondent's 10 PSS-10 answers -> a raw survey-like DataFrame."""
    return pd.DataFrame({f"How often? [{text}?]": [a] for (text, _), a in zip(PSS_ITEMS, answers)})


def test_under_18_removed_but_blank_age_kept():
    df = pd.DataFrame({"age": [16, 17, 18, 25, None]})
    kept, removed = remove_under_age(df)
    assert removed == 2
    assert len(kept) == 3  # 18, 25 and the blank age stay
    assert kept["age"].isna().sum() == 1


def test_pss10_reverse_items():
    # "Never" (0) on every item: only the 4 positive items (4,5,7,8) are reversed to 4 -> 16
    assert pss10_scores(pss_raw(["Never"] * 10))[0] == 16
    # "Very often" (4) everywhere: 6 negative items x 4 = 24, positive items become 0
    assert pss10_scores(pss_raw(["Very often"] * 10))[0] == 24


def test_seldom_counts_as_almost_never():
    seldom = pss10_scores(pss_raw(["Seldom"] * 10))[0]
    almost_never = pss10_scores(pss_raw(["Almost Never"] * 10))[0]
    assert seldom == almost_never


def test_shares_sum_to_one_and_ignore_blanks():
    out = shares(pd.Series(["Morning", "Morning", "Late Night", None]))
    assert out == {"Morning": round(2 / 3, 4), "Late Night": round(1 / 3, 4)}
    assert abs(sum(out.values()) - 1) < 0.001


def test_impossible_job_hours_dropped():
    n = 4
    df = pd.DataFrame({
        "has_job": ["Yes", "Yes", "Yes", "No"],
        "job_hours": [0, 20, 200, None],  # 0 and 200 are not real working hours
        "productive_time": ["Morning"] * n, "study_hours": ["5-10 hours"] * n,
        "tasks_per_week": ["3-5"] * n, "modules": ["4-5"] * n,
        "before_deadline": [3] * n, "task_choice": ["Closest deadline"] * n,
        "pss10": [20.0] * n, "stress_affects": ["Sometimes"] * n,
        "wants_auto_reduce": ["Yes"] * n, "defer_helps": [4] * n, "sleep_hours": [7] * n,
    })
    job = build_priors(df)["job"]
    assert job["share_with_job"] == 0.75
    assert job["hours_per_week"]["n"] == 1  # only the 20-hour answer is used
    assert job["hours_per_week"]["mean"] == 20
