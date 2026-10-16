"""
Charts of the ACRDS model results for the report and presentation.

Run from backend/ after training (needs matplotlib: pip install matplotlib):
    python -m ml_training.career.make_figures

Reads the saved results only (nothing is retrained):
  ml_training/career/reports/metrics.json        (train_career_model.py)
  ml_models/career_persona_model.joblib          (train_persona_clusters.py)
  datasets/career/survey_responses_clean.csv     (prepare_survey_data.py, optional)
Writes PNG files to ml_training/career/reports/figures/.
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

try:
    import matplotlib
    matplotlib.use("Agg")  # no window, files only
    import matplotlib.pyplot as plt
except ImportError as exc:  # pragma: no cover - only a dev dependency
    raise SystemExit("matplotlib is needed for the figures: pip install matplotlib") from exc

BACKEND = Path(__file__).resolve().parents[2]
REPORTS = Path(__file__).resolve().parent / "reports"
FIGURES = REPORTS / "figures"
METRICS = REPORTS / "metrics.json"
PERSONA_MODEL = BACKEND / "ml_models" / "career_persona_model.joblib"
SURVEY = BACKEND / "datasets" / "career" / "survey_responses_clean.csv"

# ACRDS palette (frontend/src/features/career/theme.js) with darker tones for readable charts.
TEAL, MINT, SKY, PERI = "#5DBFA9", "#C7F2D1", "#D0F2F7", "#9EB2DB"
DARK_TEAL, DARK_PERI, GREY = "#1F5F53", "#34477A", "#8A8F98"


def _save(fig, name: str) -> Path:
    FIGURES.mkdir(parents=True, exist_ok=True)
    path = FIGURES / name
    fig.tight_layout()
    fig.savefig(path, dpi=200)
    plt.close(fig)
    return path


def model_comparison(metrics: dict) -> Path:
    """Macro-F1 (nested CV mean ± SD) for every model, full profile vs skills only."""
    results = metrics["results"]
    baselines = [r for r in results if "baseline" in r["model"].lower() or r["model"].startswith("Cosine")]
    models = [m for m in dict.fromkeys(r["model"] for r in results) if m not in {b["model"] for b in baselines}]
    score = {(r["model"], r["features"]): r["scores"]["macro_f1"] for r in results}

    fig, ax = plt.subplots(figsize=(9, 4.8))
    x = np.arange(len(models))
    for offset, feats, colour, label in [(-0.2, "full profile", TEAL, "Full profile (73 features)"),
                                         (0.2, "skills only", PERI, "Skills only (9 features)")]:
        means = [score.get((m, feats), {}).get("mean", np.nan) for m in models]
        sds = [score.get((m, feats), {}).get("std", 0) for m in models]
        ax.bar(x + offset, means, 0.4, yerr=sds, capsize=3, color=colour, label=label, edgecolor="white")
    for b, style in zip(baselines, ["--", ":"]):
        ax.axhline(b["scores"]["macro_f1"]["mean"], color=GREY, linestyle=style, linewidth=1.3, label=b["model"])
    selected = metrics["selected"]["model"]
    ax.set_xticks(x, [f"{m}\n(selected)" if m == selected else m for m in models], fontsize=8)
    ax.set_ylabel("Macro-F1 (nested CV, mean ± SD)")
    ax.set_title(f"Career-family classifiers (n = {metrics['n_samples']} survey responses)")
    ax.set_ylim(0, ax.get_ylim()[1] * 1.3)  # room for the legend above the bars
    ax.legend(fontsize=8, loc="upper center", ncol=2)
    ax.spines[["top", "right"]].set_visible(False)
    return _save(fig, "fig1_model_comparison.png")


def confusion(metrics: dict) -> Path:
    """Confusion matrix of the selected model (out-of-fold predictions), row-normalised."""
    cm = np.array(metrics["confusion_matrix"], dtype=float)
    classes = metrics["classes"]
    norm = cm / cm.sum(axis=1, keepdims=True).clip(min=1)
    fig, ax = plt.subplots(figsize=(6.2, 5.2))
    ax.imshow(norm, cmap="GnBu", vmin=0, vmax=1)
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(j, i, f"{int(cm[i, j])}\n{norm[i, j]:.0%}", ha="center", va="center", fontsize=8,
                    color="white" if norm[i, j] > 0.55 else "black")
    ax.set_xticks(range(len(classes)), classes, rotation=30, ha="right")
    ax.set_yticks(range(len(classes)), classes)
    ax.set_xlabel("Predicted career family")
    ax.set_ylabel("Stated career family")
    ax.set_title(f"{metrics['selected']['model']}: confusion matrix\n(count and % of each stated family)")
    return _save(fig, "fig2_confusion_matrix.png")


def alpha_curve(metrics: dict) -> Path:
    """Ranking quality of the hybrid score as the weight on the model (alpha) grows."""
    ranking = metrics["ranking"]
    alphas = sorted(float(a) for a in ranking)
    row = {float(a): v for a, v in ranking.items()}
    n = next(iter(ranking.values()))["n"]
    fig, ax = plt.subplots(figsize=(7.5, 4.4))
    for key, colour, label in [("hit@1", PERI, "Hit@1"), ("hit@3", TEAL, "Hit@3"),
                               ("hit@5", DARK_TEAL, "Hit@5"), ("mrr", DARK_PERI, "MRR")]:
        ax.plot(alphas, [row[a][key] for a in alphas], marker="o", color=colour, label=label,
                linestyle="--" if key == "mrr" else "-")
    deployed = metrics["selected"]["alpha"]
    ax.axvline(deployed, color=GREY, linestyle=":", linewidth=1.3)
    ax.annotate(f"deployed α = {deployed}\nHit@5 {row[deployed]['hit@5']:.2f}",
                xy=(deployed, row[deployed]["hit@5"]), xytext=(deployed - 0.38, row[deployed]["hit@5"] + 0.04),
                fontsize=8, arrowprops={"arrowstyle": "->", "color": GREY})
    ax.annotate(f"skill match only\nHit@5 {row[0.0]['hit@5']:.2f}", xy=(0, row[0.0]["hit@5"]),
                xytext=(0.05, row[0.0]["hit@5"] + 0.12), fontsize=8,
                arrowprops={"arrowstyle": "->", "color": GREY})
    ax.set_xlabel("α (weight on the trained model; 0 = skill match only)")
    ax.set_ylabel("Share of students (stated career ranked)")
    ax.set_title(f"Hybrid recommender: ranking of the student's stated career (n = {n})")
    ax.set_ylim(0, max(row[a]["hit@5"] for a in alphas) + 0.2)
    ax.legend(fontsize=8, loc="upper left")
    ax.spines[["top", "right"]].set_visible(False)
    return _save(fig, "fig3_alpha_ranking.png")


def personas() -> Path | None:
    """Average self-rated skill profile of each K-Means persona."""
    if not PERSONA_MODEL.exists():
        return None
    bundle = joblib.load(PERSONA_MODEL)
    skills = bundle["skill_keys"]
    fig, ax = plt.subplots(figsize=(8.5, 4.4))
    for (name, centre), colour in zip(sorted(bundle["centroids"].items(),
                                             key=lambda kv: np.mean(list(kv[1].values()))),
                                      [PERI, TEAL, DARK_TEAL]):
        ax.plot(range(len(skills)), [centre[s] for s in skills], marker="o", color=colour, linewidth=2, label=name)
    ax.set_xticks(range(len(skills)), [s.replace("_", " ") for s in skills], rotation=25, ha="right", fontsize=8)
    ax.set_ylim(1, 5)
    ax.set_ylabel("Mean self-rated level (1-5)")
    ax.set_title(f"Skill personas (K-Means, k = {len(bundle['centroids'])}, n = {bundle['n_samples']}; "
                 f"silhouette {bundle['silhouette']:.2f}, stability ARI {bundle['stability_ari_median']:.2f})",
                 fontsize=9)
    ax.legend(fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    ax.spines[["top", "right"]].set_visible(False)
    return _save(fig, "fig4_persona_profiles.png")


def survey_needs() -> Path | None:
    """Which career support the genuine survey respondents asked for (motivates the five ACRDS steps)."""
    if not SURVEY.exists():
        return None
    df = pd.read_csv(SURVEY)
    answers = df["career_support_needed"].fillna("").str.split(r",\s*")
    counts = pd.Series([a for row in answers for a in row if a]).value_counts()
    share = (counts / len(df)).sort_values()
    fig, ax = plt.subplots(figsize=(7.5, 4.4))
    ax.barh(share.index, share.values, color=[TEAL if v >= 0.3 else SKY for v in share.values],
            edgecolor=DARK_TEAL, linewidth=0.5)
    for i, v in enumerate(share.values):
        ax.text(v + 0.01, i, f"{v:.0%}", va="center", fontsize=8)
    ax.set_xlim(0, min(1, share.max() + 0.12))
    ax.set_xlabel("Share of respondents")
    ax.set_title(f"Career support students want\n(survey, n = {len(df)} genuine responses)")
    ax.spines[["top", "right"]].set_visible(False)
    return _save(fig, "fig5_survey_support_needed.png")


def main():
    metrics = json.loads(METRICS.read_text(encoding="utf-8"))
    paths = [model_comparison(metrics), confusion(metrics), alpha_curve(metrics), personas(), survey_needs()]
    for p in paths:
        if p:
            print(f"  wrote {p.relative_to(BACKEND)}")


if __name__ == "__main__":
    main()
