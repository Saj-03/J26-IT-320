"""
Step 8 - M2 Cognitive Load Classifier: task text -> heavy / medium / low.

  M2 = Sentence-Transformer "all-MiniLM-L6-v2" (pre-trained, turns a sentence into 384 numbers
       that capture its MEANING) + Logistic Regression on those numbers.

Compared with two baselines on the SAME splits:
  keyword_rules  : hand-written word lists (what a simple app would do)
  tfidf_logreg   : classic ML text classifier on word counts (no meaning, only words)

DATA
  1. SEED (data/m2_seed_tasks.csv, 241 tasks): written for Sri Lankan IT / business undergraduates,
     labelled by the author with this rubric (to be checked by a second person):
       heavy  = new learning, problem solving or creating something big
       medium = practising / applying known methods, short writing, tutorials, slides, quizzes
       low    = routine, admin or passive work (read a notice, submit, print, email, organise)
  2. COGBENCH (Hugging Face mouryat9/CogBench, CC-BY-4.0): educational questions labelled with
     Bloom's revised taxonomy (Anderson & Krathwohl, 2001). Mapped to cognitive load:
       Remember, Understand -> low    Apply -> medium    Analyze, Evaluate, Create -> heavy
       * 739 EXPERT labels (Yahya 2012; Mohammed & Omar 2020, both PLOS ONE)  -> used as a TEST set
       * silver labels from a BERT classifier (82% accurate) -> training only, confidence >= 0.9,
         open-ended questions, at most 2,000 per load

EXPERIMENTS (fixed before looking at results)
  A  seed only            : 5-fold CV x 5 repeats on the seed tasks
  B  expert test          : train on seed + silver, test on the 739 expert-labelled questions
                            (labels NOT written by us -> the most independent check)
  C  seed + Bloom         : like A, but every training fold also gets the silver questions
  Final M2 = trained on the SEED tasks only. Result of C: adding Bloom questions made the model
  WORSE on student tasks (exam questions use different language than to-do tasks), so they are
  kept for evaluation (B) but not used to train the app's model.

Run (from backend/):  .venv\\Scripts\\python -m ml_training.scheduler.train_m2
Out:  ml_models/m2_load_classifier.joblib
      ml_training/scheduler/data/m2_results.json
"""
import json
import re
import urllib.request
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.pipeline import make_pipeline

HERE = Path(__file__).resolve().parent
SEED_DATA = HERE / "data" / "m2_seed_tasks.csv"
COGBENCH = HERE / "data" / "external" / "cogbench"
COGBENCH_URL = "https://huggingface.co/datasets/mouryat9/CogBench/resolve/main/data/{}.jsonl"
RESULTS_OUT = HERE / "data" / "m2_results.json"
MODEL_OUT = Path(__file__).resolve().parents[2] / "ml_models" / "m2_load_classifier.joblib"

EMBEDDER = "all-MiniLM-L6-v2"      # same model the Career component already uses
LABELS = ["heavy", "medium", "low"]
BLOOM_TO_LOAD = {1: "low", 2: "low", 3: "medium", 4: "heavy", 5: "heavy", 6: "heavy"}
SILVER_MIN_CONFIDENCE = 0.9
SILVER_PER_LOAD = 2000
SEED_WEIGHT = 3.0                  # our own tasks count more than one exam question
RANDOM = 42

# Baseline 1: word lists. First list that matches wins; nothing matches -> medium.
KEYWORDS = {
    "heavy": ["implement", "design", "develop", "build", "debug", "research", "thesis", "dissertation",
              "final exam", "final", "project", "report", "algorithm", "prove", "analyse", "analysis", "model"],
    "low": ["read", "email", "submit", "print", "register", "download", "check", "upload", "watch",
            "pay", "book", "install", "send", "reply", "fill", "collect", "update", "organise", "sort"],
}


def keyword_rules(texts) -> list[str]:
    out = []
    for text in texts:
        t = text.lower()
        label = "medium"
        for name in ("heavy", "low"):
            if any(re.search(rf"\b{re.escape(w)}", t) for w in KEYWORDS[name]):
                label = name
                break
        out.append(label)
    return out


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------
def load_seed() -> pd.DataFrame:
    return pd.read_csv(SEED_DATA).drop_duplicates("text")


def load_cogbench() -> tuple[pd.DataFrame, pd.DataFrame]:
    """(expert, silver) with columns text, label. Downloads the files the first time."""
    COGBENCH.mkdir(parents=True, exist_ok=True)
    for split in ("human_annotated", "train"):
        path = COGBENCH / f"{split}.jsonl"
        if not path.exists():
            urllib.request.urlretrieve(COGBENCH_URL.format(split), path)

    expert = pd.read_json(COGBENCH / "human_annotated.jsonl", lines=True)
    train = pd.read_json(COGBENCH / "train.jsonl", lines=True)
    silver = train[(train["label_source"] == "ccs_phase1_silver") & (train["confidence"] >= SILVER_MIN_CONFIDENCE)
                   & (train["question_type"] == "open_ended") & ~train["question_id"].isin(expert["question_id"])]

    def tidy(df):
        return pd.DataFrame({"text": df["question_text"].str.strip(),
                             "label": df["bloom_level"].map(BLOOM_TO_LOAD)}).drop_duplicates("text")

    silver = tidy(silver)
    parts = [g.sample(min(len(g), SILVER_PER_LOAD), random_state=RANDOM) for _, g in silver.groupby("label")]
    return tidy(expert).reset_index(drop=True), pd.concat(parts).reset_index(drop=True)


def embed(texts) -> np.ndarray:
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBEDDER).encode(list(texts), normalize_embeddings=True,
                                                batch_size=64, show_progress_bar=False)


# ---------------------------------------------------------------------------
# Models (each: fit on train, predict test)
# ---------------------------------------------------------------------------
def fit_models(tr_text, tr_vec, tr_y, tr_w=None):
    """(TF-IDF pipeline, MiniLM logistic regression) trained on the same rows."""
    tfidf = make_pipeline(TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True),
                          LogisticRegression(max_iter=3000, C=5))
    tfidf.fit(tr_text, tr_y, logisticregression__sample_weight=tr_w)
    minilm = LogisticRegression(max_iter=3000, C=2).fit(tr_vec, tr_y, sample_weight=tr_w)
    return tfidf, minilm


def ensemble_proba(tfidf, minilm, text, vec) -> np.ndarray:
    """Average of both models' chances (both know the classes in the same sorted order)."""
    return (tfidf.predict_proba(text) + minilm.predict_proba(vec)) / 2


def run_methods(tr_text, tr_vec, tr_y, tr_w, te_text, te_vec) -> dict[str, list[str]]:
    tfidf, minilm = fit_models(tr_text, tr_vec, tr_y, tr_w)
    both = ensemble_proba(tfidf, minilm, te_text, te_vec)
    return {"keyword_rules": keyword_rules(te_text),
            "tfidf_logreg": list(tfidf.predict(te_text)),
            "M2_minilm_logreg": list(minilm.predict(te_vec)),
            "ensemble_tfidf_minilm": list(tfidf.classes_[both.argmax(axis=1)])}


# Final choice rule (fixed before the results): best accuracy in A (student tasks);
# if within 0.01, best in B (expert data); if still close, the simplest one (order below).
CANDIDATES = ["tfidf_logreg", "M2_minilm_logreg", "ensemble_tfidf_minilm"]   # simplest first
CLOSE = 0.01


def choose_final(exp_a: dict, exp_b: dict) -> str:
    best_a = max(exp_a[c]["accuracy"]["mean"] for c in CANDIDATES)
    near = [c for c in CANDIDATES if best_a - exp_a[c]["accuracy"]["mean"] < CLOSE]
    best_b = max(exp_b[c]["accuracy"] for c in near)
    return next(c for c in near if best_b - exp_b[c]["accuracy"] < CLOSE)


def scores(y_true, y_pred) -> dict:
    return {"accuracy": round(accuracy_score(y_true, y_pred), 4),
            "macro_f1": round(f1_score(y_true, y_pred, average="macro"), 4)}


def seed_cv(seed, seed_vec, extra=None, extra_vec=None) -> dict:
    """5-fold x 5 CV on the seed tasks; `extra` rows are added to every training fold."""
    folds = RepeatedStratifiedKFold(n_splits=5, n_repeats=5, random_state=RANDOM)
    text, y = seed["text"].to_numpy(), seed["label"].to_numpy()
    runs = {}
    for tr, te in folds.split(text, y):
        tr_text, tr_vec, tr_y, tr_w = text[tr], seed_vec[tr], y[tr], np.full(len(tr), SEED_WEIGHT)
        if extra is not None:
            tr_text = np.concatenate([tr_text, extra["text"].to_numpy()])
            tr_vec = np.vstack([tr_vec, extra_vec])
            tr_y = np.concatenate([tr_y, extra["label"].to_numpy()])
            tr_w = np.concatenate([tr_w, np.ones(len(extra))])
        for name, pred in run_methods(tr_text, tr_vec, tr_y, tr_w, text[te], seed_vec[te]).items():
            runs.setdefault(name, []).append(scores(y[te], pred))
    return {name: {m: {"mean": round(float(np.mean([r[m] for r in rs])), 4),
                       "sd": round(float(np.std([r[m] for r in rs])), 4)} for m in ("accuracy", "macro_f1")}
            for name, rs in runs.items()}


def main() -> None:
    seed = load_seed()
    expert, silver = load_cogbench()
    print(f"seed {len(seed)} {seed['label'].value_counts().to_dict()}")
    print(f"expert {len(expert)} {expert['label'].value_counts().to_dict()}")
    print(f"silver {len(silver)} {silver['label'].value_counts().to_dict()}")

    print("Embedding with", EMBEDDER, "...")
    seed_vec, expert_vec, silver_vec = embed(seed["text"]), embed(expert["text"]), embed(silver["text"])

    # A: seed only
    exp_a = seed_cv(seed, seed_vec)

    # B: train seed + silver, test on the expert labels
    tr_text = np.concatenate([seed["text"], silver["text"]])
    tr_vec = np.vstack([seed_vec, silver_vec])
    tr_y = np.concatenate([seed["label"], silver["label"]])
    tr_w = np.concatenate([np.full(len(seed), SEED_WEIGHT), np.ones(len(silver))])
    preds_b = run_methods(tr_text, tr_vec, tr_y, tr_w, expert["text"].to_numpy(), expert_vec)
    exp_b = {name: scores(expert["label"], p) for name, p in preds_b.items()}
    cm_b = confusion_matrix(expert["label"], preds_b["M2_minilm_logreg"], labels=LABELS).tolist()

    # C: seed CV with silver added to training
    exp_c = seed_cv(seed, seed_vec, silver, silver_vec)

    # Final M2: chosen by the fixed rule, trained on the seed tasks only
    # (experiment C showed Bloom questions hurt on student tasks)
    kind = choose_final(exp_a, exp_b)
    tfidf, minilm = fit_models(seed["text"].to_numpy(), seed_vec, seed["label"].to_numpy())
    MODEL_OUT.parent.mkdir(exist_ok=True)
    joblib.dump({"kind": kind,
                 "tfidf": tfidf if kind != "M2_minilm_logreg" else None,
                 "classifier": minilm if kind != "tfidf_logreg" else None,
                 "embedder": EMBEDDER if kind != "tfidf_logreg" else None,
                 "labels": list(tfidf.classes_)}, MODEL_OUT)

    results = {
        "data": {"seed": len(seed), "expert": len(expert), "silver": len(silver),
                 "bloom_to_load": BLOOM_TO_LOAD, "silver_min_confidence": SILVER_MIN_CONFIDENCE},
        "A_seed_cv": exp_a, "B_expert_test": exp_b,
        "B_M2_confusion": {"labels": LABELS, "rows_true_cols_pred": cm_b},
        "C_seed_cv_with_bloom": exp_c,
        "final_model": {"kind": kind, "trained_on": "seed tasks only (C: Bloom data hurt on student tasks)",
                        "rule": "best A accuracy; within 0.01 -> best B; still close -> simplest"},
    }
    RESULTS_OUT.write_text(json.dumps(results, indent=2), encoding="utf-8")

    def show(title, table):
        print(f"\n{title}")
        for name, s in table.items():
            acc, f1 = s["accuracy"], s["macro_f1"]
            fmt = (lambda v: f"{v['mean']:.3f} +/- {v['sd']:.3f}") if isinstance(acc, dict) else (lambda v: f"{v:.3f}")
            print(f"  {name:<18} acc {fmt(acc)}   macro F1 {fmt(f1)}")

    show("A  seed only (5x5 CV on 241 tasks)", exp_a)
    show("B  train seed + silver -> test 739 EXPERT-labelled questions", exp_b)
    show("C  seed CV, silver Bloom questions added to training", exp_c)
    print("\nB  M2 confusion (rows = true heavy/medium/low):")
    for label, row in zip(LABELS, cm_b):
        print(f"  {label:<7}{row}")
    print(f"\nFinal model: {kind}  (trained on the seed tasks only)")
    print(f"Saved -> {MODEL_OUT}\n      -> {RESULTS_OUT}")


if __name__ == "__main__":
    main()
