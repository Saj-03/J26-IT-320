"""Unit tests for Step 5 M1 inputs and network (tiny data, trains in a second)."""
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import torch

from ml_training.scheduler.evaluate import add_local_time
from ml_training.scheduler.m1_features import (
    CONTEXT_FEATURES, HISTORY, STEP_FEATURES, StudentHistory, build_dataset, context_features,
)
from ml_training.scheduler.m1_model import FocusSuccessNet

COL = {name: i for i, name in enumerate(CONTEXT_FEATURES)}


def sessions(n, completed=lambda i: i % 2 == 0, hour_utc=13):
    """n sessions of student "a", one per day at the same time."""
    start = datetime(2026, 1, 5, hour_utc, 30)
    return add_local_time(pd.DataFrame([{
        "user_id": "a", "started_at": start + timedelta(days=i), "planned_minutes": 25,
        "actual_minutes": 25 if completed(i) else 10, "task_load": "medium",
        "completed": completed(i), "pause_count": 0, "true_p_success": 0.5,
    } for i in range(n)]))


def test_shapes_and_cold_start():
    seq, ctx, y, rows = build_dataset(sessions(3))
    assert seq.shape == (3, HISTORY, len(STEP_FEATURES)) and ctx.shape == (3, len(CONTEXT_FEATURES))
    assert seq[0].sum() == 0                                  # first session: no history at all
    assert seq[2, :HISTORY - 2, 0].sum() == 0 and seq[2, -2:, 0].sum() == 2   # 2 real rows at the end
    assert ctx[0, COL["n_past"]] == 0


def test_only_the_past_is_used():
    """Changing a LATER session must not change the inputs of an earlier one."""
    a = sessions(6)
    b = a.copy()
    b.loc[5, "completed"] = not b.loc[5, "completed"]
    seq_a, ctx_a, *_ = build_dataset(a)
    seq_b, ctx_b, *_ = build_dataset(b)
    assert np.array_equal(seq_a[:6], seq_b[:6]) and np.array_equal(ctx_a[:6], ctx_b[:6])


def test_rates_follow_the_history():
    good = build_dataset(sessions(12, completed=lambda i: True))[1][-1]
    bad = build_dataset(sessions(12, completed=lambda i: False))[1][-1]
    assert good[COL["student_rate"]] > 0.8 > 0.2 > bad[COL["student_rate"]]
    assert good[COL["hour_rate"]] > bad[COL["hour_rate"]]


def test_hour_rate_is_about_this_hour():
    past = sessions(10, completed=lambda i: True, hour_utc=13)      # always good at 19:00 SL
    h = StudentHistory(past)
    target = {"planned_minutes": 25, "task_load": "medium", "weekday": 1, "day": 99,
              "started_at": past["started_at"].max() + timedelta(days=1)}
    at_19 = context_features(h, 10, {**target, "hour": 19.0})[COL["hour_rate"]]
    at_9 = context_features(h, 10, {**target, "hour": 9.0})[COL["hour_rate"]]
    assert at_19 > at_9                                            # no evidence at 09:00 -> nearer average


def test_network_output_and_learning():
    torch.manual_seed(0)
    seq, ctx, y, _ = build_dataset(sessions(40))
    model = FocusSuccessNet()
    assert model(torch.tensor(seq), torch.tensor(ctx)).shape == (40,)

    opt, loss_fn = torch.optim.Adam(model.parameters(), lr=0.01), torch.nn.BCEWithLogitsLoss()
    first = loss_fn(model(torch.tensor(seq), torch.tensor(ctx)), torch.tensor(y)).item()
    for _ in range(100):
        opt.zero_grad()
        loss = loss_fn(model(torch.tensor(seq), torch.tensor(ctx)), torch.tensor(y))
        loss.backward()
        opt.step()
    assert loss.item() < first * 0.5                               # it can learn the alternating pattern
