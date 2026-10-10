"""
Step 2 - Train and evaluate the ACRDS career-family model.

Run from backend/ (after prepare_survey_data.py):
    python -m ml_training.career.train_career_model            # 5 x 5-fold nested CV
    python -m ml_training.career.train_career_model --repeats 10

Research design (for the thesis / viva):
  * Task: predict the student's career FAMILY (software, data, cybersecurity,
    business, design, other) from the survey profile. Families, not the 10
    roles, because several roles have 0-2 responses.
  * Leakage control: the stated career area and preferred role are never used
    as features - the preferred role IS the label.
  * Evaluation: nested, repeated, stratified 5-fold cross-validation. The inner
    3-fold grid search tunes hyper-parameters on training folds only, so the
    outer-fold scores are unbiased estimates for unseen students.
  * Baselines: majority class, and the current rule-based cosine recommender.
  * Ablation: skills only (9 features) vs. full profile (~70 features).
  * Career-level evaluation: Hit@1/3/5 and MRR when ranking the 10 ACRDS careers
    with cosine only, ML only, and the hybrid score
        hybrid = alpha * P(family) * 100 + (1 - alpha) * cosine_match.
Outputs:
  ml_models/career_family_model.joblib        (loaded by the API)
  ml_training/career/reports/training_report.md + metrics.json
"""
import argparse
import json
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, confusion_matrix, f1_score,
                             top_k_accuracy_score)
from sklearn.model_selection import GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier

from app.components.career.schemas import SKILL_KEYS
from app.components.career.services.career_data import load_careers
from app.components.career.services.career_features import (CAREER_FAMILY, FAMILY_CAREERS, build_features,
                                                            feature_names)
from app.components.career.services.recommender import adjusted_cosine_percentage, skill_vector

warnings.filterwarnings("ignore")

BACKEND = Path(__file__).resolve().parents[2]
DATA = BACKEND / "datasets" / "career" / "survey_responses_clean.csv"
MODEL_OUT = BACKEND / "ml_models" / "career_family_model.joblib"
REPORT_DIR = Path(__file__).resolve().parent / "reports"
SEED = 42
ALPHAS = [round(a, 1) for a in np.arange(0, 1.01, 0.1)]
PROFILE_FIELDS = [
    "academic_status", "employment_status", "faculty_field", "academic_performance_trend", "career_confidence",
    "previous_career_preference", "preferred_learning_method", "skill_learning_consistency",
    "extracurricular_participation", "extracurricular_type", "highest_extracurricular_role",
    "career_related_work_status", "career_related_work_type", "career_support_needed",
]


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def row_to_profile(row: pd.Series) -> dict:
    profile = {f: ("" if pd.isna(row[f]) else row[f]) for f in PROFILE_FIELDS}
    profile["skills"] = {k: int(row[f"skill_{k}"]) for k in SKILL_KEYS}
    return profile


def load_dataset(exclude_straight_liners: bool = False):
    df = pd.read_csv(DATA)
    df = df[df["label_family"].notna()].reset_index(drop=True)
    if exclude_straight_liners:
        df = df[~df["straight_liner"]].reset_index(drop=True)
    profiles = [row_to_profile(r) for _, r in df.iterrows()]
    X = np.array([build_features(p) for p in profiles])
    return df, profiles, X, df["label_family"].to_numpy()


# ---------------------------------------------------------------------------
# Models (each with a small hyper-parameter grid for the inner CV)
# ---------------------------------------------------------------------------
def candidate_models():
    return {
        "Logistic Regression": (
            make_pipeline(StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=5000)),
            {"logisticregression__C": [0.03, 0.1, 0.3, 1.0]},
        ),
        "k-Nearest Neighbours": (
            make_pipeline(StandardScaler(), KNeighborsClassifier()),
            {"kneighborsclassifier__n_neighbors": [3, 5, 7, 9], "kneighborsclassifier__weights": ["uniform", "distance"]},
        ),
        "SVM (RBF kernel)": (
            make_pipeline(StandardScaler(), SVC(class_weight="balanced", probability=True, random_state=SEED)),
            {"svc__C": [0.3, 1.0, 3.0], "svc__gamma": ["scale", 0.01]},
        ),
        "Random Forest": (
            RandomForestClassifier(n_estimators=300, class_weight="balanced_subsample", random_state=SEED, n_jobs=-1),
            {"max_depth": [None, 4, 8], "min_samples_leaf": [1, 3]},
        ),
        "XGBoost": (
            XGBClassifier(n_estimators=200, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
                          objective="multi:softprob", eval_metric="mlogloss", random_state=SEED, n_jobs=-1),
            {"max_depth": [2, 3]},
        ),
    }


class EncodedXGB:
    """XGBoost needs integer labels; wrap it so it behaves like the sklearn models."""

    def __init__(self, search):
        self.search = search

    def fit(self, X, y):
        self.classes_ = np.unique(y)
        y_int = np.searchsorted(self.classes_, y)
        self.search.fit(X, y_int, sample_weight=compute_sample_weight("balanced", y_int))
        return self

    def predict_proba(self, X):
        return self.search.predict_proba(X)

    @property
    def best_params_(self):
        return self.search.best_params_

    @property
    def best_estimator_(self):
        return self.search.best_estimator_


def make_search(name, estimator, grid):
    inner = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)
    search = GridSearchCV(clone(estimator), grid, cv=inner, scoring="f1_macro", n_jobs=-1)
    return EncodedXGB(search) if name == "XGBoost" else search


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------
def fold_metrics(y_true, proba, classes) -> dict:
    pred = classes[np.argmax(proba, axis=1)]
    k_scores = {}
    for k in (2, 3):
        k_scores[f"top{k}_accuracy"] = top_k_accuracy_score(y_true, proba, k=k, labels=classes)
    return {
        "accuracy": accuracy_score(y_true, pred),
        "balanced_accuracy": balanced_accuracy_score(y_true, pred),
        "macro_f1": f1_score(y_true, pred, average="macro", labels=classes, zero_division=0),
        **k_scores,
    }


def summarise(per_fold: list[dict]) -> dict:
    return {m: {"mean": float(np.mean([f[m] for f in per_fold])), "std": float(np.std([f[m] for f in per_fold]))}
            for m in per_fold[0]}


def cosine_family_proba(profiles, classes) -> np.ndarray:
    """Rule-based baseline: family score = best adjusted-cosine match among its careers.
    It cannot predict 'other' (no careers), exactly like the deployed rules."""
    careers = {c["career_id"]: c for c in load_careers()}
    out = []
    for p in profiles:
        vec = skill_vector(p["skills"])
        scores = []
        for fam in classes:
            ids = FAMILY_CAREERS[fam]
            scores.append(max(adjusted_cosine_percentage(vec, skill_vector(careers[i]["required_skills"]))
                              for i in ids) if ids else -1e9)
        scores = np.array(scores)
        e = np.exp((scores - scores.max()) / 5)  # softmax over scores -> pseudo-probabilities for top-k
        out.append(e / e.sum())
    return np.array(out)


def nested_cv(name, estimator, grid, X, y, classes, repeats):
    outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=repeats, random_state=SEED)
    per_fold, oof_sum, oof_count, chosen = [], np.zeros((len(y), len(classes))), np.zeros(len(y)), []
    for train, test in outer.split(X, y):
        if grid is None:  # baseline
            model = clone(estimator).fit(X[train], y[train])
            proba = model.predict_proba(X[test])
        else:
            search = make_search(name, estimator, grid).fit(X[train], y[train])
            proba = search.predict_proba(X[test])
            chosen.append(json.dumps(search.best_params_, sort_keys=True))
        per_fold.append(fold_metrics(y[test], proba, classes))
        oof_sum[test] += proba
        oof_count[test] += 1
    most_common = max(set(chosen), key=chosen.count) if chosen else None
    return summarise(per_fold), oof_sum / oof_count[:, None], most_common


def career_ranking_eval(df, profiles, family_proba, classes) -> dict:
    """Rank the 10 ACRDS careers for students whose stated role maps to one of them."""
    careers = list(load_careers())
    cls_index = {c: i for i, c in enumerate(classes)}
    rows = [i for i, c in enumerate(df["label_career"]) if isinstance(c, str)]
    results = {}
    for alpha in ALPHAS:
        ranks = []
        for i in rows:
            vec = skill_vector(profiles[i]["skills"])
            scores = {}
            for c in careers:
                cos = adjusted_cosine_percentage(vec, skill_vector(c["required_skills"]))
                p_family = family_proba[i, cls_index[CAREER_FAMILY[c["career_id"]]]]
                scores[c["career_id"]] = alpha * p_family * 100 + (1 - alpha) * cos + 1e-6 * cos
            ordered = sorted(scores, key=scores.get, reverse=True)
            ranks.append(ordered.index(df["label_career"][i]) + 1)
        ranks = np.array(ranks)
        results[alpha] = {"hit@1": float(np.mean(ranks <= 1)), "hit@3": float(np.mean(ranks <= 3)),
                          "hit@5": float(np.mean(ranks <= 5)), "mrr": float(np.mean(1 / ranks)), "n": len(rows)}
    return results


def skill_profiles(df) -> pd.DataFrame:
    """Data-driven skill levels per family vs. the hand-set ACRDS requirements."""
    careers = {c["career_id"]: c for c in load_careers()}
    rows = []
    for fam, ids in FAMILY_CAREERS.items():
        if not ids or fam not in set(df["label_family"]):
            continue
        survey = df[df["label_family"] == fam][[f"skill_{k}" for k in SKILL_KEYS]].mean()
        handset = np.mean([[careers[i]["required_skills"][k] for k in SKILL_KEYS] for i in ids], axis=0)
        for k, s, h in zip(SKILL_KEYS, survey, handset):
            rows.append({"family": fam, "skill": k, "survey_mean": round(s, 2), "handset_required": round(h, 2)})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def fmt(m):
    return f"{m['mean']:.3f} ± {m['std']:.3f}"


def md_table(frame: pd.DataFrame) -> list[str]:
    lines = ["| " + " | ".join(frame.columns) + " |", "|" + "---|" * len(frame.columns)]
    return lines + ["| " + " | ".join(str(v) for v in row) + " |" for row in frame.itertuples(index=False)]


def write_report(ctx: dict) -> None:
    L = ["# ACRDS career model - training and evaluation report", "",
         f"Generated {ctx['trained_at']} by `ml_training/career/train_career_model.py`.", "",
         "## Data", "",
         f"- Labelled survey responses: **{ctx['n']}** (after removing bulk-duplicated submissions; "
         "see `data_preparation_report.md`).",
         f"- Classes (career family): " + ", ".join(f"{c} ({n})" for c, n in ctx["class_counts"].items()),
         f"- Features: {ctx['n_features_full']} (full profile) / 9 (skills only). "
         "Stated career area and preferred role are excluded (label leakage).",
         f"- Validation: nested CV - outer {ctx['repeats']} x 5-fold repeated stratified, inner 3-fold grid search.",
         "", "## Family classification (mean ± std over outer folds)", "",
         "| Model | Features | Accuracy | Balanced acc. | Macro F1 | Top-2 acc. | Top-3 acc. | Chosen params |",
         "|---|---|---|---|---|---|---|---|"]
    for r in ctx["results"]:
        s = r["scores"]
        L.append(f"| {r['model']} | {r['features']} | {fmt(s['accuracy'])} | {fmt(s['balanced_accuracy'])} | "
                 f"{fmt(s['macro_f1'])} | {fmt(s['top2_accuracy'])} | {fmt(s['top3_accuracy'])} | "
                 f"{r['params'] or '-'} |")
    best = ctx["best"]
    L += ["", f"**Selected model: {best['model']} ({best['features']})** - highest mean macro F1.", "",
          "## Confusion matrix (selected model, out-of-fold, averaged over repeats)", "",
          "Rows = true family, columns = predicted family.", "",
          "| true \\ pred | " + " | ".join(ctx["classes"]) + " |",
          "|---|" + "---|" * len(ctx["classes"])]
    for cls, row in zip(ctx["classes"], ctx["confusion"]):
        L.append(f"| **{cls}** | " + " | ".join(str(v) for v in row) + " |")
    L += ["", "## Career ranking (10 ACRDS careers)", "",
          f"Students whose stated role maps to an ACRDS career: n = {ctx['ranking'][0.0]['n']}. "
          "Score = alpha x P(family) x 100 + (1 - alpha) x cosine match (out-of-fold probabilities).", "",
          "| alpha | Method | Hit@1 | Hit@3 | Hit@5 | MRR |", "|---|---|---|---|---|---|"]
    for a, m in ctx["ranking"].items():
        method = "cosine only (current rules)" if a == 0 else ("ML only" if a == 1 else "hybrid")
        mark = " **(selected)**" if a == ctx["alpha"] else ""
        L.append(f"| {a}{mark} | {method} | {m['hit@1']:.3f} | {m['hit@3']:.3f} | {m['hit@5']:.3f} | {m['mrr']:.3f} |")
    L += ["", f"Selected alpha = **{ctx['alpha']}** (best Hit@5; ties -> smallest alpha). Note: alpha is chosen on the same out-of-fold "
          "predictions, so the hybrid row is slightly optimistic; confirm on new survey data.", "",
          "## Most important features (permutation importance, selected model)", "",
          "| Feature | Importance (drop in macro F1) |", "|---|---|",
          *[f"| {f} | {v:.4f} |" for f, v in ctx["importance"]],
          "", "## Robustness: excluding straight-liners", "",
          f"Selected model re-evaluated without the {ctx['robust']['removed']} responses whose 9 skill ratings "
          f"are identical: macro F1 {fmt(ctx['robust']['scores']['macro_f1'])}, "
          f"top-3 accuracy {fmt(ctx['robust']['scores']['top3_accuracy'])}.", "",
          "## Survey-derived vs hand-set skill requirements", "",
          "Mean self-rated skill of students in each family vs. the average required level of the ACRDS "
          "careers in that family (from `career_requirements.json`).", "",
          *md_table(ctx["profiles"]),
          "", "## Limitations", "",
          f"- Small dataset ({ctx['n']} labelled responses); small classes have high variance - "
          "see the std values and the confusion matrix.",
          "- The label is the student's *stated* preferred role, not a verified career outcome.",
          "- Re-run both scripts whenever new survey responses are collected.", ""]
    (REPORT_DIR / "training_report.md").write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Train the ACRDS career-family model")
    parser.add_argument("--repeats", type=int, default=5, help="Repeats of the outer 5-fold CV (default 5)")
    args = parser.parse_args()

    df, profiles, X_full, y = load_dataset()
    classes = np.unique(y)
    skill_idx = list(range(len(SKILL_KEYS)))
    feature_sets = {"full profile": (X_full, list(range(X_full.shape[1]))), "skills only": (X_full[:, skill_idx], skill_idx)}
    print(f"{len(y)} labelled responses, {X_full.shape[1]} features, classes: {dict(zip(*np.unique(y, return_counts=True)))}")

    results, oof = [], {}
    # Baselines
    s, p, _ = nested_cv("Majority class", DummyClassifier(strategy="prior"), None, X_full, y, classes, args.repeats)
    results.append({"model": "Majority class (baseline)", "features": "-", "scores": s, "params": None})
    cos_proba = cosine_family_proba(profiles, classes)
    cos_scores = summarise([fold_metrics(y, cos_proba, classes)])
    results.append({"model": "Cosine rules (current ACRDS)", "features": "skills only", "scores": cos_scores, "params": None})

    for model_name, (estimator, grid) in candidate_models().items():
        for fs_name, (X, _) in feature_sets.items():
            print(f"  training {model_name} [{fs_name}] ...")
            s, proba, params = nested_cv(model_name, estimator, grid, X, y, classes, args.repeats)
            results.append({"model": model_name, "features": fs_name, "scores": s, "params": params})
            oof[(model_name, fs_name)] = proba

    trained = [r for r in results if (r["model"], r["features"]) in oof]
    best = max(trained, key=lambda r: r["scores"]["macro_f1"]["mean"])
    best_key = (best["model"], best["features"])
    best_proba = oof[best_key]
    X_best, idx_best = feature_sets[best["features"]]
    print(f"Best: {best['model']} [{best['features']}] macro F1 {best['scores']['macro_f1']['mean']:.3f}")

    confusion = confusion_matrix(y, classes[np.argmax(best_proba, axis=1)], labels=classes)
    ranking = career_ranking_eval(df, profiles, best_proba, classes)
    # The app shows a top-5 list, so Hit@5 is the deciding metric. On ties prefer the smallest
    # alpha: it keeps the most skill-match signal, which is what the explanations are built on.
    alpha = max(ranking, key=lambda a: (ranking[a]["hit@5"], -a))

    # Robustness check without straight-liners
    df_r, _, X_r_full, y_r = load_dataset(exclude_straight_liners=True)
    estimator, grid = candidate_models()[best["model"]]
    robust_scores, _, _ = nested_cv(best["model"], estimator, grid, X_r_full[:, idx_best], y_r, classes, args.repeats)

    # Final model: tune on ALL labelled data, then save.
    is_xgb = best["model"] == "XGBoost"
    final_model = make_search(best["model"], estimator, grid).fit(X_best, y).best_estimator_
    y_fit = np.searchsorted(classes, y) if is_xgb else y  # XGBoost was trained on integer labels
    imp = permutation_importance(final_model, X_best, y_fit, scoring="f1_macro", n_repeats=10, random_state=SEED)
    names = [feature_names()[i] for i in idx_best]
    importance = sorted(zip(names, imp.importances_mean), key=lambda t: -t[1])[:15]

    trained_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    bundle = {
        "model": final_model,
        "label_encoded": is_xgb,
        "classes": list(classes),
        "feature_indices": idx_best,
        "feature_names": names,
        "alpha": alpha,
        "model_name": best["model"],
        "feature_set": best["features"],
        "metrics": {"macro_f1": best["scores"]["macro_f1"], "top3_accuracy": best["scores"]["top3_accuracy"],
                    "ranking_selected_alpha": ranking[alpha], "ranking_cosine_only": ranking[0.0]},
        "n_samples": int(len(y)),
        "trained_at": trained_at,
    }
    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_OUT)

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    ctx = {"trained_at": trained_at, "n": len(y), "class_counts": dict(zip(*np.unique(y, return_counts=True))),
           "n_features_full": X_full.shape[1], "repeats": args.repeats, "results": results, "best": best,
           "classes": list(classes), "confusion": confusion.tolist(), "ranking": ranking, "alpha": alpha,
           "importance": importance, "robust": {"removed": len(y) - len(y_r), "scores": robust_scores},
           "profiles": skill_profiles(df)}
    write_report(ctx)
    (REPORT_DIR / "metrics.json").write_text(json.dumps({
        "trained_at": trained_at, "n_samples": len(y), "classes": list(classes),
        "results": results, "selected": {"model": best["model"], "features": best["features"], "alpha": alpha},
        "ranking": {str(a): m for a, m in ranking.items()},
        "confusion_matrix": confusion.tolist(),
    }, indent=2, default=str), encoding="utf-8")
    print(f"Saved model -> {MODEL_OUT}\nReport -> {REPORT_DIR / 'training_report.md'}")
    print(f"Career ranking  cosine only: {ranking[0.0]}\n                 selected alpha {alpha}: {ranking[alpha]}")


if __name__ == "__main__":
    main()
