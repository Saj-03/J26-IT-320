"""
Step 5 - Train M1 and compare it with the baseline rules (same test as evaluate.py).

Weeks 0-4 = train, week 5 = validation (to know when to stop), weeks 6-7 = test.
For every session M1 only sees sessions that started before it.

Fair comparison: the "online rules" below also see every earlier session
(student's average so far, average near this hour so far), exactly like M1.

Run (from backend/):  .venv\\Scripts\\python -m ml_training.scheduler.train_m1
Out:  ml_models/m1_focus_net.pt   (weights + feature scaling)
      ml_training/scheduler/data/m1_results.json
"""
import json
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn

from ml_training.scheduler.baselines import OUT as BASELINE_RESULTS, print_table
from ml_training.scheduler.evaluate import (
    HERE, PROFILES, TRAIN_WEEKS, capacity_scores, load_sessions, peak_scores, started, success_scores,
)
from ml_training.scheduler.m1_features import (
    CONTEXT_FEATURES, StudentHistory, build_dataset, context_features, sequence_features,
)
from ml_training.scheduler.m1_model import FocusSuccessNet

MODEL_OUT = Path(__file__).resolve().parents[2] / "ml_models" / "m1_focus_net.pt"
RESULTS_OUT = HERE / "data" / "m1_results.json"

SEED = 42
VALIDATION_WEEK = TRAIN_WEEKS - 1   # week 5
BATCH, LEARNING_RATE, MAX_EPOCHS, PATIENCE = 256, 1e-3, 40, 4

# For peak hour / capacity we ask M1 "what if" questions at these settings
QUERY_HOURS = list(range(7, 24)) + [0]
TIMER_OPTIONS = [15, 20, 25, 30, 40, 45, 50, 60, 90]
# capacity = longest timer whose chance is NOT clearly lower than a short 15-min session
# ("the point where longer sessions start to fail"). 0.2 log-odds ≈ 5 percentage points.
# Chosen by checking the first 120 simulated students - state this in the thesis.
CAPACITY_DROP = 0.2


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------
def to_tensors(seq, ctx, y, mask):
    return torch.tensor(seq[mask]), torch.tensor(ctx[mask]), torch.tensor(y[mask])


def predict(model, seq, ctx) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        return torch.sigmoid(model(torch.as_tensor(seq), torch.as_tensor(ctx))).numpy()


def train(seq, ctx, y, train_mask, val_mask) -> tuple[FocusSuccessNet, list[dict]]:
    """Adam + binary cross-entropy. Stop when validation loss has not improved for 4 epochs."""
    torch.manual_seed(SEED)
    model = FocusSuccessNet()
    optimiser = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loss_fn = nn.BCEWithLogitsLoss()

    s_tr, c_tr, y_tr = to_tensors(seq, ctx, y, train_mask)
    s_va, c_va, y_va = to_tensors(seq, ctx, y, val_mask)
    best, best_state, waited, history = float("inf"), None, 0, []

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        order = torch.randperm(len(y_tr))
        for i in range(0, len(order), BATCH):
            b = order[i:i + BATCH]
            optimiser.zero_grad()
            loss = loss_fn(model(s_tr[b], c_tr[b]), y_tr[b])
            loss.backward()
            optimiser.step()

        model.eval()
        with torch.no_grad():
            val_loss = loss_fn(model(s_va, c_va), y_va).item()
        history.append({"epoch": epoch, "val_log_loss": round(val_loss, 4)})
        print(f"  epoch {epoch:2d}  validation log loss {val_loss:.4f}")

        if val_loss < best - 1e-4:
            best, waited = val_loss, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            waited += 1
            if waited >= PATIENCE:
                break

    model.load_state_dict(best_state)
    return model, history


# ---------------------------------------------------------------------------
# "What if" questions -> peak hour and capacity
# ---------------------------------------------------------------------------
def logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return float(np.log(p / (1 - p)))


def what_if(model, h: StudentHistory, n: int, scale, after, hour: float, minutes: int) -> float:
    """Chance M1 gives a session at `hour` with `minutes`, medium load, first session of a new day."""
    target = {"hour": hour, "planned_minutes": minutes, "task_load": "medium",
              "weekday": 2, "day": -1, "started_at": after}
    seq = sequence_features(h, n, after)[None]
    ctx = ((context_features(h, n, target) - scale[0]) / scale[1])[None].astype(np.float32)
    return float(predict(model, seq, ctx)[0])


def peak_and_capacity(model, sessions: pd.DataFrame, students: pd.Series, scale) -> tuple[pd.Series, pd.Series]:
    """From the TRAIN weeks only (same as the rules): best hour, and longest timer that still works."""
    train = started(sessions[sessions["week"] < TRAIN_WEEKS])
    peaks, capacities = {}, {}
    for sid in students:
        past = train[train["user_id"] == sid]
        h = StudentHistory(past)
        n = len(past)
        after = (past["started_at"].max() if n else pd.Timestamp("2026-02-16")) + timedelta(hours=24)
        chances = {hr: what_if(model, h, n, scale, after, hr, 25) for hr in QUERY_HOURS}
        peaks[sid] = max(chances, key=chances.get)
        by_length = {m: logit(what_if(model, h, n, scale, after, peaks[sid], m)) for m in TIMER_OPTIONS}
        short = by_length[min(TIMER_OPTIONS)]
        capacities[sid] = max(m for m, x in by_length.items() if x >= short - CAPACITY_DROP)
    return pd.Series(peaks), pd.Series(capacities, dtype=float)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
def main() -> None:
    np.random.seed(SEED)
    sessions = load_sessions()
    profiles = pd.read_csv(PROFILES)

    print("Building inputs (each session sees only its past)...")
    seq, ctx, y, rows = build_dataset(started(sessions))
    week = rows["week"].to_numpy()
    train_mask, val_mask, test_mask = week < VALIDATION_WEEK, week == VALIDATION_WEEK, week >= TRAIN_WEEKS

    # Scale context numbers with TRAIN statistics only
    mean, std = ctx[train_mask].mean(0), ctx[train_mask].std(0) + 1e-6
    ctx_scaled = ((ctx - mean) / std).astype(np.float32)

    print(f"Training M1 on {train_mask.sum()} sessions (validation {val_mask.sum()}, test {test_mask.sum()})")
    model, history = train(seq, ctx_scaled, y, train_mask, val_mask)

    # 1. Success on the test weeks
    test_rows = rows[test_mask]
    completed = test_rows["completed"]
    col = {name: i for i, name in enumerate(CONTEXT_FEATURES)}
    success = {
        "online_student_rate": success_scores(completed, pd.Series(ctx[test_mask, col["student_rate"]])),
        "online_hour_rate": success_scores(completed, pd.Series(ctx[test_mask, col["hour_rate"]])),
        "M1": success_scores(completed, pd.Series(predict(model, seq[test_mask], ctx_scaled[test_mask]))),
        "ceiling": success_scores(completed, test_rows["true_p_success"]),
    }

    # 2 + 3. Peak hour and capacity (train weeks only, like the rules)
    print("Asking M1 for every student's peak hour and capacity...")
    peaks, capacities = peak_and_capacity(model, sessions, profiles["student_id"], (mean, std))
    results = {
        "training": {"sessions": {"train": int(train_mask.sum()), "validation": int(val_mask.sum()),
                                  "test": int(test_mask.sum())}, "epochs": history},
        "success": success,
        "peak_hour": {"M1": peak_scores(peaks, profiles)},
        "capacity": {"M1": capacity_scores(capacities, sessions[sessions["week"] >= TRAIN_WEEKS], profiles)},
    }

    MODEL_OUT.parent.mkdir(exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "ctx_mean": mean, "ctx_std": std,
                "context_features": CONTEXT_FEATURES}, MODEL_OUT)
    RESULTS_OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")

    rules = json.loads(Path(BASELINE_RESULTS).read_text(encoding="utf-8")) if Path(BASELINE_RESULTS).exists() else {}
    print_table("1. Will the next session succeed?", {**rules.get("success", {}), **success})
    print_table("2. Peak hour", {**rules.get("peak_hour", {}), **results["peak_hour"]})
    print_table("3. Focus minutes", {**rules.get("capacity", {}), **results["capacity"]})
    print(f"\nSaved -> {MODEL_OUT}\n      -> {RESULTS_OUT}")


if __name__ == "__main__":
    main()
