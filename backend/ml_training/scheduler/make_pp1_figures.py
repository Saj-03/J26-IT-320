"""
PP1 figures - turn the M1 vs rules results into 4 slide-ready pictures (16:9 PNG).

  1_success_auc.png    : how well each method predicts "will this session be completed?"
  2_peak_hour.png      : % of students whose real best hour was found (within 1 h)
  3_capacity_error.png : how far the focus-length estimate is from the real capacity
  4_student_story.png  : one student - survey said one time, M1 found the real best hour

Needs: baselines.py and train_m1.py run first (results JSON + ml_models/m1_focus_net.pt).
Run (from backend/):  .venv\\Scripts\\python -m ml_training.scheduler.make_pp1_figures
Out:  docs/figures/*.png
"""
import json
from datetime import timedelta
from pathlib import Path

import matplotlib

matplotlib.use("Agg")                 # draw to files, no window
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch

from ml_training.scheduler.baselines import OUT as BASELINE_RESULTS
from ml_training.scheduler.evaluate import HERE, PROFILES, TRAIN_WEEKS, clock_gap, load_sessions, started
from ml_training.scheduler.m1_features import StudentHistory
from ml_training.scheduler.m1_model import FocusSuccessNet
from ml_training.scheduler.simulate_sessions import success_probability
from ml_training.scheduler.simulate_students import PEAK_HOURS
from ml_training.scheduler.train_m1 import MODEL_OUT, QUERY_HOURS, RESULTS_OUT, what_if

FIGURES = Path(__file__).resolve().parents[3] / "docs" / "figures"

# Colours: M1 = the one blue series, rules = quiet grey, text in ink (not series colour)
M1_BLUE = "#2a78d6"
RULE_GREY = "#b9b8b3"
TRUTH_GREY = "#52514e"
INK, INK_SOFT = "#0b0b0b", "#52514e"
SURFACE, GRID = "#fcfcfb", "#e6e5e1"

plt.rcParams.update({
    "figure.figsize": (10, 5.625), "figure.dpi": 160, "savefig.dpi": 160,
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE,
    "font.size": 13, "axes.titlesize": 18, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.edgecolor": GRID, "axes.labelcolor": INK_SOFT, "xtick.color": INK_SOFT, "ytick.color": INK,
    "text.color": INK, "axes.spines.top": False, "axes.spines.right": False,
})


def finish(fig, ax, name: str, note: str) -> None:
    """Move the title to the top-left of the whole picture (so long titles fit),
    add a small grey source note at the bottom, then save."""
    fig.suptitle(ax.get_title(loc="left"), x=0.01, ha="left", fontsize=17, fontweight="bold")
    ax.set_title("", loc="left")
    fig.text(0.01, 0.015, note, fontsize=10, color=INK_SOFT)
    fig.tight_layout(rect=(0, 0.05, 1, 1))
    fig.savefig(FIGURES / name, facecolor=SURFACE)
    plt.close(fig)
    print("  saved", FIGURES / name)


def hbars(ax, labels, values, highlight, fmt):
    """Horizontal bars from zero; the M1 bar is blue, the rest grey; value printed at the bar end."""
    y = np.arange(len(labels))[::-1]
    colours = [M1_BLUE if l == highlight else RULE_GREY for l in labels]
    ax.barh(y, values, height=0.55, color=colours)
    for yi, v, l in zip(y, values, labels):
        ax.text(v, yi, "  " + fmt(v), va="center", fontsize=13,
                fontweight="bold" if l == highlight else "normal")
    ax.set_yticks(y, labels)
    ax.tick_params(axis="y", length=0)
    ax.xaxis.grid(True, color=GRID)
    ax.set_axisbelow(True)


# ---------------------------------------------------------------------------
# 1. Success prediction (AUC) - dot plot, because AUC starts at 0.5 (= guessing), not 0
# ---------------------------------------------------------------------------
def figure_auc(rules: dict, m1: dict) -> None:
    rows = [("Same rate for everyone", rules["success"]["global_rate"]["auc"]),
            ("Student's own average", m1["success"]["online_student_rate"]["auc"]),
            ("Student's average at this hour", m1["success"]["online_hour_rate"]["auc"]),
            ("M1 (GRU neural network)", m1["success"]["M1"]["auc"])]
    ceiling = m1["success"]["ceiling"]["auc"]

    fig, ax = plt.subplots()
    y = np.arange(len(rows))[::-1]
    for yi, (label, v) in zip(y, rows):
        is_m1 = label.startswith("M1")
        ax.plot([0.5, v], [yi, yi], color=M1_BLUE if is_m1 else RULE_GREY, lw=2)
        ax.plot(v, yi, "o", ms=11, color=M1_BLUE if is_m1 else RULE_GREY, mec=SURFACE, mew=2)
        ax.text(v + 0.006, yi, f"{v:.2f}", va="center", fontweight="bold" if is_m1 else "normal")
    ax.axvline(ceiling, color=TRUTH_GREY, ls="--", lw=1.5)
    ax.text(ceiling - 0.004, y[-1] - 0.45, f"best possible {ceiling:.2f}", ha="right", color=INK_SOFT, fontsize=11)
    ax.set_ylim(y[-1] - 0.7, y[0] + 0.4)
    ax.set_yticks(y, [r[0] for r in rows])
    ax.tick_params(axis="y", length=0)
    ax.set_xlim(0.48, 0.82)
    ax.set_xlabel("AUC  (0.5 = guessing, 1.0 = perfect)")
    ax.xaxis.grid(True, color=GRID)
    ax.set_axisbelow(True)
    ax.set_title("M1 predicts which focus sessions will be completed\nbetter than the rules")
    finish(fig, ax, "1_success_auc.png",
           f"Test = last 2 of 8 weeks, {m1['training']['sessions']['test']:,} sessions, 500 simulated students. "
           "All methods see the same past sessions.")


# ---------------------------------------------------------------------------
# 2. Peak hour found
# ---------------------------------------------------------------------------
def figure_peak(rules: dict, m1: dict) -> None:
    rows = [("Hour with best past rate", rules["peak_hour"]["hour_rules"]["within_1h"]),
            ("Hour they study most", rules["peak_hour"]["most_used"]["within_1h"]),
            ("Their survey answer", rules["peak_hour"]["survey_answer"]["within_1h"]),
            ("M1 (GRU neural network)", m1["peak_hour"]["M1"]["within_1h"])]
    fig, ax = plt.subplots()
    hbars(ax, [r[0] for r in rows], [r[1] * 100 for r in rows], "M1 (GRU neural network)", lambda v: f"{v:.0f}%")
    ax.set_xlim(0, 75)
    ax.set_xlabel("Students whose real best hour was found (within 1 hour), %")
    ax.set_title("M1 finds a student's real best study hour more often")
    finish(fig, ax, "2_peak_hour.png", "Real best hour = hidden truth of each simulated student. "
                                        "Survey answer is right for only 60% of students (assumption).")


# ---------------------------------------------------------------------------
# 3. Capacity error
# ---------------------------------------------------------------------------
def figure_capacity(rules: dict, m1: dict) -> None:
    rows = [("Fixed 25-min Pomodoro", rules["capacity"]["default_25"]["mae_hidden"]),
            ("Median of completed sessions", rules["capacity"]["median_rule"]["mae_hidden"]),
            ("M1 (GRU neural network)", m1["capacity"]["M1"]["mae_hidden"])]
    fig, ax = plt.subplots()
    hbars(ax, [r[0] for r in rows], [r[1] for r in rows], "M1 (GRU neural network)", lambda v: f"{v:.1f} min")
    ax.set_xlim(0, 12)
    ax.set_xlabel("Average error vs the real focus capacity, minutes (lower = better)")
    ax.set_title("M1 estimates how long a student can focus\nmore accurately")
    finish(fig, ax, "3_capacity_error.png",
           "Capacity = longest session before success starts to drop (hidden truth of each simulated student).")


# ---------------------------------------------------------------------------
# 4. One student's story
# ---------------------------------------------------------------------------
def load_m1():
    ck = torch.load(MODEL_OUT, weights_only=False)
    model = FocusSuccessNet()
    model.load_state_dict(ck["state_dict"])
    return model, (ck["ctx_mean"], ck["ctx_std"])


def m1_curve(model, scale, train: pd.DataFrame, sid: str) -> dict[int, float]:
    """M1's chance for a 25-min medium session at every hour, from the train weeks only."""
    past = train[train["user_id"] == sid]
    h = StudentHistory(past)
    after = past["started_at"].max() + timedelta(hours=24)
    return {hr: what_if(model, h, len(past), scale, after, hr, 25) for hr in QUERY_HOURS}


def pick_story_student(model, scale, train, profiles) -> tuple[pd.Series, dict]:
    """A clear example: survey answer is far from the real peak, and M1 finds the real peak."""
    for p in profiles.sort_values("student_id").itertuples():
        survey_hours = PEAK_HOURS[p.productive_time]
        if min(clock_gap(p.peak_hour, h) for h in survey_hours) < 5:
            continue
        curve = m1_curve(model, scale, train, p.student_id)
        if clock_gap(max(curve, key=curve.get), p.peak_hour) <= 1:
            return profiles.set_index("student_id").loc[p.student_id], curve
    raise RuntimeError("no clear example found")


def figure_story(model, scale, train, profiles) -> None:
    p, curve = pick_story_student(model, scale, train, profiles)
    order = list(range(7, 24)) + [24]                        # 07:00 .. midnight, left to right
    x = np.arange(len(order))
    m1_y = [curve[h % 24] for h in order]
    truth = [success_probability(p.to_dict(), h % 24, 25, "medium", 0, False) for h in order]
    survey = [i for i, h in enumerate(order) if h % 24 in PEAK_HOURS[p["productive_time"]]]
    m1_peak = int(np.argmax(m1_y))
    true_peak = order.index(p["peak_hour"] if p["peak_hour"] >= 7 else p["peak_hour"] + 24)

    fig, ax = plt.subplots()
    ax.axvspan(min(survey) - 0.5, max(survey) + 0.5, color=GRID, zorder=0)
    ax.text((min(survey) + max(survey)) / 2, 0.97, f'Survey: "most productive\nat {p["productive_time"]}"',
            ha="center", va="top", fontsize=12, color=INK_SOFT, transform=ax.get_xaxis_transform())
    ax.plot(x, truth, color=TRUTH_GREY, lw=2, ls="--", label="Real chance (hidden from M1)")
    ax.plot(x, m1_y, color=M1_BLUE, lw=2.5, label="M1's estimate (from past sessions only)")
    ax.plot(m1_peak, m1_y[m1_peak], "o", ms=11, color=M1_BLUE, mec=SURFACE, mew=2)
    ax.annotate(f"M1: best at {order[m1_peak] % 24:02d}:00\n(real best {order[true_peak] % 24:02d}:00)",
                (m1_peak, m1_y[m1_peak]), xytext=(18, 10), textcoords="offset points",
                fontsize=12, fontweight="bold", color=INK)
    ticks = list(x[1::2])                                   # 08:00, 10:00 ... 00:00
    ax.set_xticks(ticks, [f"{order[i] % 24:02d}:00" for i in ticks])
    ax.set_ylim(0, 1)
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1], ["0%", "25%", "50%", "75%", "100%"])
    ax.set_ylabel("Chance a 25-min session is completed")
    ax.yaxis.grid(True, color=GRID)
    ax.set_axisbelow(True)
    ax.legend(loc="lower left", frameon=False, fontsize=11)
    ax.set_title("Example student: the survey answer was wrong,\nM1 found the real best hour")
    finish(fig, ax, "4_student_story.png",
           f"Simulated student {p.name}, 6 weeks of history ({int((train['user_id'] == p.name).sum())} sessions).")


def main() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    rules = json.loads(Path(BASELINE_RESULTS).read_text(encoding="utf-8"))
    m1 = json.loads(Path(RESULTS_OUT).read_text(encoding="utf-8"))

    figure_auc(rules, m1)
    figure_peak(rules, m1)
    figure_capacity(rules, m1)

    model, scale = load_m1()
    sessions = load_sessions()
    train = started(sessions[sessions["week"] < TRAIN_WEEKS])
    figure_story(model, scale, train, pd.read_csv(PROFILES))


if __name__ == "__main__":
    main()
