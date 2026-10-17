"""
Step 4 - Baseline rules = the scores M1 has to beat.

Each rule only looks at the TRAIN weeks (the past) and predicts the TEST weeks.

  Will the next session succeed?
    global_rate   : everyone gets the same average success rate
    student_rate  : this student's own average
    hour_rules    : this student's average at this hour (what the app's history_rules do now)
    ceiling       : the hidden true chance (true_p_success) = best any model could do

  Peak hour:
    survey_answer : middle of the time they said in the survey ("Evening" -> 18-19)
    most_used     : the hour they start sessions most often
    hour_rules    : the hour with the best completion rate (attention_model.peak_windows)

  Minutes they can focus:
    default_25    : the fixed 25-min Pomodoro
    median_rule   : median minutes of completed sessions (attention_model.attention_capacity)

Run (from backend/):  .venv\\Scripts\\python -m ml_training.scheduler.baselines
Out:  ml_training/scheduler/data/baseline_results.json
"""
import json
from statistics import mean

import pandas as pd

from ml_training.scheduler.evaluate import (
    HERE, PROFILES, capacity_scores, load_sessions, peak_scores, split_by_week, started, success_scores,
)
from ml_training.scheduler.simulate_students import PEAK_HOURS

OUT = HERE / "data" / "baseline_results.json"

SMOOTHING = 3        # few sessions -> trust the wider average more (like 3 extra "average" sessions)
MIN_PER_HOUR = 2     # attention_model.peak_windows needs 2+ sessions in an hour
MIN_COMPLETED = 3    # attention_model.attention_capacity needs 3+ completed sessions
DEFAULT_FOCUS = 25


def smooth(done: pd.Series, total: pd.Series, prior) -> pd.Series:
    """(completed + 3 x prior) / (sessions + 3): with little data the rate stays near the prior."""
    return (done + SMOOTHING * prior) / (total + SMOOTHING)


# ---------------------------------------------------------------------------
# 1. Will the next session succeed?
# ---------------------------------------------------------------------------
def predict_success(train: pd.DataFrame, test: pd.DataFrame) -> dict[str, pd.Series]:
    """Chance of success for every test session, from each rule."""
    train = started(train)
    overall = train["completed"].mean()

    per_student = train.groupby("user_id")["completed"].agg(["sum", "count"])
    student_rate = smooth(per_student["sum"], per_student["count"], overall)

    per_hour = train.groupby(["user_id", "hour"])["completed"].agg(["sum", "count"])
    prior = student_rate.reindex(per_hour.index.get_level_values("user_id")).to_numpy()
    hour_rate = smooth(per_hour["sum"], per_hour["count"], prior)

    s_rate = test["user_id"].map(student_rate).fillna(overall)
    h_rate = pd.Series(list(zip(test["user_id"], test["hour"])), index=test.index).map(hour_rate)
    return {
        "global_rate": pd.Series(overall, index=test.index),
        "student_rate": s_rate,
        "hour_rules": h_rate.fillna(s_rate),      # never studied at this hour -> student's average
        "ceiling": test["true_p_success"],
    }


# ---------------------------------------------------------------------------
# 2. Peak hour
# ---------------------------------------------------------------------------
def survey_peak(profiles: pd.DataFrame) -> pd.Series:
    """Middle of the hours for the survey answer, e.g. Morning 7-11 -> 9."""
    middle = {answer: sorted(h if h >= 7 else h + 24 for h in hours) for answer, hours in PEAK_HOURS.items()}
    return profiles.set_index("student_id")["productive_time"].map(
        lambda a: middle[a][len(middle[a]) // 2] % 24)


def most_used_hour(train: pd.DataFrame) -> pd.Series:
    return started(train).groupby("user_id")["hour"].agg(lambda h: h.value_counts().idxmax())


def best_rate_hour(train: pd.DataFrame) -> pd.Series:
    """Hour with the highest completion rate (2+ sessions), like attention_model.peak_windows."""
    per_hour = started(train).groupby(["user_id", "hour"])["completed"].agg(["mean", "count"])
    per_hour = per_hour[per_hour["count"] >= MIN_PER_HOUR].reset_index()
    best = per_hour.sort_values(["mean", "count"], ascending=False).drop_duplicates("user_id")
    return best.set_index("user_id")["hour"]


# ---------------------------------------------------------------------------
# 3. Minutes they can focus
# ---------------------------------------------------------------------------
def median_capacity(train: pd.DataFrame, students: pd.Index) -> pd.Series:
    """Median minutes of completed sessions (3+), else 25 - like attention_model.attention_capacity."""
    done = started(train)
    done = done[done["completed"]].groupby("user_id")["actual_minutes"].agg(["median", "count"])
    capacity = done["median"].where(done["count"] >= MIN_COMPLETED)
    return capacity.reindex(students).fillna(DEFAULT_FOCUS)


# ---------------------------------------------------------------------------
# Run everything
# ---------------------------------------------------------------------------
def run(sessions: pd.DataFrame, profiles: pd.DataFrame) -> dict:
    train, test = split_by_week(sessions)
    test_started = started(test)
    students = profiles["student_id"]

    success = {name: success_scores(test_started["completed"], p)
               for name, p in predict_success(train, test_started).items()}

    used = survey_peak(profiles)
    peak = {
        "survey_answer": peak_scores(used, profiles),
        "most_used": peak_scores(most_used_hour(train).reindex(students).fillna(used), profiles),
        "hour_rules": peak_scores(best_rate_hour(train).reindex(students).fillna(used), profiles),
    }

    ids = pd.Index(students)
    capacity = {
        "default_25": capacity_scores(pd.Series(DEFAULT_FOCUS, index=ids), test, profiles),
        "median_rule": capacity_scores(median_capacity(train, ids), test, profiles),
    }

    return {
        "data": {"students": int(len(profiles)), "train_sessions": int(len(started(train))),
                 "test_sessions": int(len(test_started)),
                 "test_completed_rate": round(float(test_started["completed"].mean()), 4)},
        "success": success, "peak_hour": peak, "capacity": capacity,
    }


def print_table(title: str, results: dict) -> None:
    print(f"\n{title}")
    for name, scores in results.items():
        print(f"  {name:<14}" + "  ".join(f"{k}={v}" for k, v in scores.items()))


def main() -> None:
    results = run(load_sessions(), pd.read_csv(PROFILES))
    OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print("Data:", results["data"])
    print_table("1. Will the next session succeed?  (AUC higher = better, Brier lower = better)", results["success"])
    print_table("2. Peak hour  (error lower = better)", results["peak_hour"])
    print_table("3. Focus minutes  (error lower = better)", results["capacity"])
    print("\nSaved ->", OUT)


if __name__ == "__main__":
    main()
