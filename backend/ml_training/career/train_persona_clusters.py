"""
Model 3 - Unsupervised student segmentation (K-Means) on the 9 self-rated skills.

Run from backend/ (after prepare_survey_data.py):
    python -m ml_training.career.train_persona_clusters

Research design (for the thesis / viva):
  * Data: the cleaned survey (all clean responses - no career label is needed).
  * Features: the 9 skill ratings, standardised. Two alternatives are also reported:
    "shape only" (each student's ratings minus their own average) and "shape + level".
  * k = 2..6 compared with the silhouette score; k = 3 is used (see report for why).
  * Stability: clusters re-fitted on 200 bootstrap samples and compared with the
    adjusted Rand index (ARI): 1 = identical grouping, 0 = chance.
  * Clusters are ordered by average skill level and named Developing / Progressing / Advanced.
Outputs:
  ml_models/career_persona_model.joblib        (loaded by the API)
  ml_training/career/reports/persona_clustering_report.md
"""
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import StandardScaler

from app.components.career.schemas import SKILL_KEYS

BACKEND = Path(__file__).resolve().parents[2]
DATA = BACKEND / "datasets" / "career" / "survey_responses_clean.csv"
MODEL_OUT = BACKEND / "ml_models" / "career_persona_model.joblib"
REPORT = Path(__file__).resolve().parent / "reports" / "persona_clustering_report.md"
SEED = 42
K = 3
K_RANGE = range(2, 7)
BOOTSTRAPS = 200

# Personas in order of increasing average self-rated skill.
PERSONAS = [
    {"name": "Developing",
     "description": "You rated most of your skills at a beginner level.",
     "advice": "Build foundations first: choose one or two skills from your roadmap and practise them every week."},
    {"name": "Progressing",
     "description": "You rated most of your skills at an intermediate level.",
     "advice": "Turn your skills into evidence: complete a portfolio project, a certification or an internship."},
    {"name": "Advanced",
     "description": "You rated most of your skills at an advanced level.",
     "advice": "Prove it to employers: show your work in a portfolio and practise interviews to test your self-ratings."},
]


def fit_kmeans(Z: np.ndarray, k: int, seed: int = SEED) -> KMeans:
    return KMeans(n_clusters=k, n_init=50, random_state=seed).fit(Z)


def feature_variants(X: np.ndarray) -> dict:
    level = X.mean(1, keepdims=True)
    return {
        "Skills (standardised) - used": StandardScaler().fit_transform(X),
        "Shape only (ratings minus own average)": X - level,
        "Shape + overall level": np.hstack([X - level, (level - level.mean()) / level.std()]),
    }


def bootstrap_stability(Z: np.ndarray, reference: np.ndarray, rng: np.random.Generator) -> list[float]:
    """Fit on a bootstrap sample, label every student, compare with the reference labels."""
    scores = []
    for i in range(BOOTSTRAPS):
        idx = rng.integers(0, len(Z), len(Z))
        km = KMeans(n_clusters=K, n_init=10, random_state=i).fit(Z[idx])
        scores.append(adjusted_rand_score(reference, km.predict(Z)))
    return scores


def md_table(frame: pd.DataFrame) -> list[str]:
    cols = [str(c) for c in frame.columns]
    lines = ["| " + " | ".join([frame.index.name or ""] + cols) + " |", "|" + "---|" * (len(cols) + 1)]
    return lines + ["| " + " | ".join([str(i)] + [str(v) for v in row]) + " |"
                    for i, row in zip(frame.index, frame.itertuples(index=False))]  # itertuples keeps int columns as ints


def main():
    df = pd.read_csv(DATA)
    cols = [f"skill_{k}" for k in SKILL_KEYS]
    X = df[cols].to_numpy(float)

    # 1) Compare feature sets and k
    silhouettes = {name: {k: silhouette_score(Z, fit_kmeans(Z, k).labels_) for k in K_RANGE}
                   for name, Z in feature_variants(X).items()}

    # 2) Final model on standardised skills
    scaler = StandardScaler().fit(X)
    Z = scaler.transform(X)
    km = fit_kmeans(Z, K)
    centroids = scaler.inverse_transform(km.cluster_centers_)
    order = np.argsort(centroids.mean(1))            # cluster index sorted by average level
    persona_of_cluster = {int(c): rank for rank, c in enumerate(order)}
    df["persona"] = [PERSONAS[persona_of_cluster[c]]["name"] for c in km.labels_]

    # 3) Stability
    rng = np.random.default_rng(SEED)
    ari = bootstrap_stability(Z, km.labels_, rng)

    # 4) Save
    trained_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    bundle = {
        "scaler": scaler, "kmeans": km, "skill_keys": list(SKILL_KEYS),
        "persona_of_cluster": persona_of_cluster, "personas": PERSONAS,
        "centroids": {PERSONAS[persona_of_cluster[c]]["name"]: dict(zip(SKILL_KEYS, np.round(centroids[c], 2).tolist()))
                      for c in range(K)},
        "silhouette": float(silhouettes["Skills (standardised) - used"][K]),
        "stability_ari_median": float(np.median(ari)), "n_samples": int(len(df)), "trained_at": trained_at,
    }
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_OUT)

    # 5) Report
    names = [p["name"] for p in PERSONAS]
    profile = df.groupby("persona")[cols].mean().reindex(names).round(2)
    profile.columns = SKILL_KEYS
    profile["average"] = profile[SKILL_KEYS].mean(1).round(2)
    profile["students"] = df["persona"].value_counts().reindex(names)
    profile.index.name = "persona"
    sil = pd.DataFrame(silhouettes).T.round(3)
    sil.columns = [f"k={k}" for k in K_RANGE]
    sil.index.name = "features"
    fam = pd.crosstab(df["label_family"].fillna("(unlabelled)"), df["persona"]).reindex(columns=names, fill_value=0)
    fam.index.name = "career family"
    work = pd.crosstab(df["career_related_work_status"], df["persona"]).reindex(columns=names, fill_value=0)
    work.index.name = "career-related work"

    L = ["# ACRDS student segmentation (K-Means) - report", "",
         f"Generated {trained_at} by `ml_training/career/train_persona_clusters.py`. "
         f"Data: {len(df)} clean survey responses (all respondents; no label needed).", "",
         "## Choosing features and k (silhouette score, higher = better separated)", "",
         *md_table(sil), "",
         f"**Chosen: standardised skills, k = {K}.** k = 2 has the highest silhouette but only splits students into "
         "high and low self-raters. k = 3 keeps a moderate structure and adds a middle group, which is more useful "
         "for guidance. Clustering on the *shape* of the ratings (strengths vs. weaknesses) gives very weak structure "
         "(silhouette around 0.13-0.15), so students differ mainly in their overall self-rated level.", "",
         "## Personas (mean self-rating 1-5)", "", *md_table(profile), "",
         "## Stability", "",
         f"Clusters re-fitted on {BOOTSTRAPS} bootstrap samples: adjusted Rand index median "
         f"**{np.median(ari):.2f}** (inter-quartile range {np.percentile(ari, 25):.2f}-{np.percentile(ari, 75):.2f}). "
         "Values near 1 mean the grouping is reproducible.", "",
         "## How personas relate to career choice and experience", "",
         *md_table(fam), "", *md_table(work), "",
         "The career-family mix is similar in every persona: personas describe *readiness level*, not *career "
         "direction*. They are therefore shown as guidance and do not change the career ranking.", "",
         "## Limitations", "",
         "- Based on self-ratings, which may differ from actual ability (some students rate themselves generously).",
         f"- {int(df['straight_liner'].sum())} respondents gave the same rating to all 9 skills; they are kept.",
         "- Small sample: re-run after collecting more responses.", ""]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(L), encoding="utf-8")
    print(f"Saved persona model -> {MODEL_OUT}")
    print(f"silhouette(k={K}) = {bundle['silhouette']:.3f}, bootstrap ARI median = {bundle['stability_ari_median']:.2f}")
    print(profile[["average", "students"]].to_string())


if __name__ == "__main__":
    main()
