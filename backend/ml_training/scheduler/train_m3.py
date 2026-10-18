"""
M3 Step 2 - Train + evaluate the task-duration model (Objective 2, "duration-estimation error").

Question: a student says "60 min" - how long will it really take?

Fair test (same idea as M1): split by TIME - every student's weeks 1-6 = train, weeks 7-8 = test.
For every task, the student's history = only tasks finished before it (like in real use).

Compared methods (all predict minutes):
    student_estimate   - just believe the student (what a normal planner does)
    global_ratio       - estimate x the usual over-run of ALL students (one number)
    personal_ratio     - estimate x this student's usual over-run so far (rule)
    personal_by_load   - same, but per light / medium / heavy when there are >= 2 such tasks (stronger rule)
    M3                 - gradient boosting (quantile loss) on m3_features: median + 10%/90% range

Scores: MAE in minutes (main), median % error, error by history size (proposal: "error decreases as
history grows"), and how often the real time falls inside M3's 10-90% range (should be ~80%).

Two more checks:
    unseen students - 20% of students are never trained on; scored from their FIRST task, so the
                      error by history size shows what a brand-new student gets (0, 1-4, 5-9 ... tasks)
    ceiling         - knows each student's hidden bias exactly; only day-to-day noise is left.
                      No model can beat it, so it shows how close M3 gets.

Run (from backend/):  python -m ml_training.scheduler.train_m3
Out:  ml_models/m3_duration.joblib, ml_training/scheduler/data/m3_results.json
"""
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from ml_training.scheduler import m3_features as F

HERE = Path(__file__).resolve().parent
TASKS = HERE / "data" / "tasks.csv"
RESULTS = HERE / "data" / "m3_results.json"
MODEL_FILE = HERE.parents[1] / "ml_models" / "m3_duration.joblib"
TRAIN_WEEKS = 6
QUANTILES = (0.1, 0.5, 0.9)
MIN_SAME_LOAD = 2
UNSEEN_SHARE = 0.2
HISTORY_BINS = [(0, 0, "0 (new student)"), (1, 4, "1-4"), (5, 9, "5-9"), (10, 19, "10-19"), (20, 10_000, "20+")]


def load_tasks(path: Path = TASKS) -> pd.DataFrame:
    tasks = pd.read_csv(path).sort_values(["student_id", "day", "task_id"]).reset_index(drop=True)
    tasks["target"] = np.log(tasks["actual_minutes"] / tasks["estimated_minutes"])
    return tasks


def fit_models(X: np.ndarray, y: np.ndarray) -> dict:
    """One model per quantile. Fixed settings (no tuning on the test weeks)."""
    return {q: HistGradientBoostingRegressor(loss="quantile", quantile=q, max_iter=400, learning_rate=0.05,
                                             min_samples_leaf=40, random_state=0).fit(X, y)
            for q in QUANTILES}


def rule_predictions(tasks: pd.DataFrame, X: np.ndarray, global_log_ratio: float) -> dict:
    """Minutes predicted by the baselines (features already hold the student's past medians)."""
    col = {name: i for i, name in enumerate(F.FEATURES)}
    est = tasks["estimated_minutes"].to_numpy(float)
    personal = np.where(np.isnan(X[:, col["hist_median"]]), global_log_ratio, X[:, col["hist_median"]])
    by_load = np.where(X[:, col["n_same_load"]] >= MIN_SAME_LOAD, X[:, col["hist_same_load"]], personal)
    return {"student_estimate": est,
            "global_ratio": est * math.exp(global_log_ratio),
            "personal_ratio": est * np.exp(personal),
            "personal_by_load": est * np.exp(by_load)}


def scores(pred: np.ndarray, actual: np.ndarray) -> dict:
    err = np.abs(pred - actual)
    return {"mae_minutes": round(float(err.mean()), 1),
            "median_pct_error": round(float(np.median(err / actual) * 100), 1)}


def by_history(pred: np.ndarray, actual: np.ndarray, n_history: np.ndarray) -> dict:
    out = {}
    for low, high, label in HISTORY_BINS:
        mask = (n_history >= low) & (n_history <= high)
        if mask.any():
            out[label] = {"tasks": int(mask.sum()), "mae_minutes": round(float(np.abs(pred - actual)[mask].mean()), 1)}
    return out


def ceiling_minutes(tasks: pd.DataFrame) -> np.ndarray:
    """
    Best possible guess, knowing the HIDDEN truth: the student's planning bias, load bias and how the
    simulator made the data. Undo the bias, then shrink towards the load's typical effort, because a
    student's guess is noisy (Bayes: log true ~ N(log typical, s_true^2), guess adds N(0, s_guess^2)).
    Only the day-to-day noise is left - no model can beat this on average.
    """
    from ml_training.scheduler.simulate_tasks import GUESS_NOISE, TRUE_EFFORT
    profiles = pd.read_csv(HERE / "data" / "hidden_profiles.csv").set_index("student_id")["estimation_bias"]
    unbiased = np.log(tasks["estimated_minutes"] * tasks["student_id"].map(profiles) * tasks["hidden_load_bias"])
    typical = tasks["load"].map({k: math.log(m) for k, (m, _) in TRUE_EFFORT.items()})
    s_true = tasks["load"].map({k: s for k, (_, s) in TRUE_EFFORT.items()})
    weight = s_true ** 2 / (s_true ** 2 + GUESS_NOISE ** 2)
    return np.exp(weight * unbiased + (1 - weight) * typical).to_numpy(float)


def unseen_students_check(tasks: pd.DataFrame, X: np.ndarray, y: np.ndarray) -> dict:
    """Train on 80% of students (all weeks), score the other 20% from their first task."""
    students = np.sort(tasks["student_id"].unique())
    rng = np.random.default_rng(0)
    unseen = set(rng.choice(students, size=int(len(students) * UNSEEN_SHARE), replace=False))
    test = tasks["student_id"].isin(unseen).to_numpy()
    actual = tasks.loc[test, "actual_minutes"].to_numpy(float)
    est = tasks.loc[test, "estimated_minutes"].to_numpy(float)
    global_log_ratio = float(np.median(y[~test]))
    m3 = est * np.exp(fit_models(X[~test], y[~test])[0.5].predict(X[test]))
    methods = {**rule_predictions(tasks[test], X[test], global_log_ratio), "M3": m3,
               "ceiling": ceiling_minutes(tasks[test])}
    n_hist = X[test, F.FEATURES.index("n_history")]
    return {"students": len(unseen), "tasks": int(test.sum()),
            "scores": {name: scores(pred, actual) for name, pred in methods.items()},
            "mae_by_history_size": {name: by_history(methods[name], actual, n_hist)
                                    for name in ("student_estimate", "personal_by_load", "M3", "ceiling")}}


def main() -> None:
    tasks = load_tasks()
    X = F.build_rows(tasks)
    y = tasks["target"].to_numpy()
    train = (tasks["week"] < TRAIN_WEEKS).to_numpy()
    test = ~train
    actual = tasks.loc[test, "actual_minutes"].to_numpy(float)
    est = tasks.loc[test, "estimated_minutes"].to_numpy(float)
    n_hist = X[test, F.FEATURES.index("n_history")]

    global_log_ratio = float(np.median(y[train]))
    rules = rule_predictions(tasks[test], X[test], global_log_ratio)
    models = fit_models(X[train], y[train])
    q = {k: est * np.exp(m.predict(X[test])) for k, m in models.items()}
    methods = {**rules, "M3": q[0.5], "ceiling": ceiling_minutes(tasks[test])}

    results = {name: scores(pred, actual) for name, pred in methods.items()}
    inside = (actual >= np.minimum(q[0.1], q[0.9])) & (actual <= np.maximum(q[0.1], q[0.9]))
    results["M3"]["range_10_90_coverage"] = round(float(inside.mean()), 3)
    results["M3"]["range_10_90_median_width_minutes"] = round(float(np.median(np.abs(q[0.9] - q[0.1]))), 1)
    unseen = unseen_students_check(tasks, X, y)

    report = {
        "data": {"tasks": len(tasks), "students": int(tasks["student_id"].nunique()),
                 "train_tasks": int(train.sum()), "test_tasks": int(test.sum()),
                 "global_over_run": round(math.exp(global_log_ratio), 3)},
        "test_scores": results,
        "mae_by_history_size": {name: by_history(methods[name], actual, n_hist)
                                for name in ("student_estimate", "personal_by_load", "M3")},
        "unseen_students": unseen,
    }
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # final model: all weeks (the test above already told us how good it is)
    final = fit_models(X, y)
    MODEL_FILE.parent.mkdir(exist_ok=True)
    joblib.dump({"kind": "m3_quantile_gbm", "features": F.FEATURES, "quantiles": list(QUANTILES),
                 "models": final, "global_over_run": math.exp(float(np.median(y)))}, MODEL_FILE)

    print(f"{report['data']['test_tasks']} test tasks (weeks 7-8)\n")
    print(f"{'method':18s} {'MAE min':>8s} {'median %err':>12s}")
    for name, s in results.items():
        print(f"{name:18s} {s['mae_minutes']:8.1f} {s['median_pct_error']:12.1f}")
    print(f"\nM3 10-90% range holds the real time {results['M3']['range_10_90_coverage']:.0%} of the time "
          f"(median width {results['M3']['range_10_90_median_width_minutes']} min)")
    print("\nMAE by how many past tasks the student has:")
    for name, rows in report["mae_by_history_size"].items():
        print(f"  {name:18s} " + "  ".join(f"{k}: {v['mae_minutes']}" for k, v in rows.items()))
    print(f"\nUnseen students ({unseen['students']} students, scored from their first task):")
    for name, sc in unseen["scores"].items():
        print(f"  {name:18s} MAE {sc['mae_minutes']:5.1f}")
    print("  MAE by history size:")
    for name, rows in unseen["mae_by_history_size"].items():
        print(f"    {name:16s} " + "  ".join(f"{k}: {v['mae_minutes']}" for k, v in rows.items()))
    print(f"\nsaved {MODEL_FILE} and {RESULTS}")


if __name__ == "__main__":
    main()
