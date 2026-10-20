"""M3 task-duration model: simulator, features (no peeking at the future) and a small training run."""
import math

import numpy as np
import pandas as pd

from ml_training.scheduler import m3_features as F
from ml_training.scheduler import simulate_tasks as sim
from ml_training.scheduler import train_m3


def student(bias=1.5, tasks_per_week=4, sid="s1"):
    return pd.Series({"student_id": sid, "estimation_bias": bias, "tasks_per_week": tasks_per_week})


SEED = pd.DataFrame({"text": ["Read chapter 3", "Write the lab report", "Build the REST API project"],
                     "label": ["low", "medium", "heavy"]})


def test_simulated_students_underestimate_by_their_hidden_bias():
    rng = np.random.default_rng(0)
    slow = pd.DataFrame(sim.simulate_student(rng, student(bias=1.8), SEED))
    exact = pd.DataFrame(sim.simulate_student(rng, student(bias=0.9, sid="s2"), SEED))
    ratio = lambda d: np.median(d["actual_minutes"] / d["estimated_minutes"])
    assert ratio(slow) > 1.4 > ratio(exact)
    assert set(slow["estimated_minutes"]) <= set(sim.NICE_MINUTES)          # round numbers like real students
    assert list(slow["day"]) == sorted(slow["day"])
    assert sim.task_type("Revise for the DBMS exam") == "exam_prep"
    assert sim.task_type("Build the REST API project") == "project"


def test_features_only_use_tasks_finished_before():
    history = [(60, 90, "medium", "assignment"), (30, 30, "low", "reading")]
    f = dict(zip(F.FEATURES, F.task_features(60, "medium", "assignment", history)))
    assert f["n_history"] == 2 and f["n_same_load"] == 1
    assert math.isclose(f["hist_same_load"], math.log(1.5))
    assert f["load_medium"] == 1.0 and f["type_assignment"] == 1.0

    tasks = pd.DataFrame({"student_id": ["a", "a", "b"], "estimated_minutes": [60, 60, 60],
                          "actual_minutes": [120, 30, 60], "load": ["medium"] * 3, "task_type": ["other"] * 3})
    rows = F.build_rows(tasks)
    n = F.FEATURES.index("n_history")
    assert list(rows[:, n]) == [0, 1, 0]                     # each student starts empty, never sees the future
    assert np.isnan(rows[0, F.FEATURES.index("hist_median")])


def test_m3_learns_the_planning_bias_better_than_believing_the_student():
    rng = np.random.default_rng(1)
    profiles = [student(bias=b, sid=f"s{i}") for i, b in enumerate(rng.uniform(0.8, 2.0, 60))]
    tasks = pd.DataFrame([r for p in profiles for r in sim.simulate_student(rng, p, SEED)])
    tasks = tasks.sort_values(["student_id", "day"]).reset_index(drop=True)
    tasks["target"] = np.log(tasks["actual_minutes"] / tasks["estimated_minutes"])
    X, y = F.build_rows(tasks), tasks["target"].to_numpy()
    train = (tasks["week"] < 6).to_numpy()

    models = train_m3.fit_models(X[train], y[train])
    est = tasks.loc[~train, "estimated_minutes"].to_numpy(float)
    actual = tasks.loc[~train, "actual_minutes"].to_numpy(float)
    m3 = est * np.exp(models[0.5].predict(X[~train]))
    assert np.abs(m3 - actual).mean() < 0.8 * np.abs(est - actual).mean()
    low, high = (est * np.exp(models[q].predict(X[~train])) for q in (0.1, 0.9))
    assert 0.6 < ((actual >= low) & (actual <= high)).mean() < 0.95     # a sensible 10-90% range
