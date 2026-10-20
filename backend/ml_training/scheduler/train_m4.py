"""
M4 Step 2 - train + evaluate "what is this piece of speech?" (task / commitment / routine / energy ...).

Same method as M2 so the two are comparable:
    keyword_rules       - hand-written word lists (baseline)
    tfidf_logreg        - word 1-2 grams + character 2-5 grams -> logistic regression
    minilm_logreg       - all-MiniLM-L6-v2 sentence embeddings -> logistic regression
    ensemble            - average of the two probabilities
The final method is chosen BEFORE looking at the test set: best macro-F1 in 5-fold CV on train,
and a simpler method wins when it is within CLOSE (0.01).

Test set (data/m4_test.csv) is reported in parts, because not all of it is real human data:
    massive    real people's assistant sentences (commitment, task_personal, routine, other)
    seed       our 241 real student tasks (task_academic)
    templates  held-out wording we wrote (energy, plan_request, lecture/work commitments)

Run (from backend/):  python -m ml_training.scheduler.m4_dataset  then  python -m ml_training.scheduler.train_m4
Out:  ml_models/m4_brain_dump.joblib, data/m4_results.json
"""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import FeatureUnion, make_pipeline

from ml_training.scheduler.m4_dataset import LABELS, TEST_OUT, TRAIN_OUT

HERE = Path(__file__).resolve().parent
RESULTS = HERE / "data" / "m4_results.json"
MODEL_OUT = HERE.parents[1] / "ml_models" / "m4_brain_dump.joblib"
EMBEDDER = "all-MiniLM-L6-v2"                       # same model as M2 and the Career component
CANDIDATES = ["tfidf_logreg", "minilm_logreg", "ensemble"]   # simplest first
CLOSE = 0.01
SEED = 42

KEYWORDS = {
    "plan_request": ["plan my", "schedule", "organise", "organize", "timetable", "arrange my", "plan for"],
    "energy": ["tired", "exhausted", "energy", "sleepy", "drained", "burnt out", "lazy", "worn out", "rested"],
    "routine": ["wake me", "alarm", "get up", "wake up"],
    "task_personal": ["list", "remind me to", "buy", "groceries", "shopping", "pay", "call"],
    "commitment": ["meeting", "lecture", "class", "lab", "appointment", "shift", "event", "job", "practice"],
    "task_academic": ["assignment", "exam", "study", "revise", "report", "project", "homework", "chapter",
                      "essay", "quiz", "tutorial", "past paper", "lab sheet", "presentation", "notes"],
}


def keyword_rules(texts) -> list[str]:
    out = []
    for t in texts:
        t = t.lower()
        out.append(next((label for label, words in KEYWORDS.items() if any(w in t for w in words)), "other"))
    return out


def tfidf_model() -> object:
    features = FeatureUnion([("words", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
                             ("chars", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True))])
    return make_pipeline(features, LogisticRegression(max_iter=3000, C=5, class_weight="balanced"))


def embed(texts) -> np.ndarray:
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBEDDER).encode(list(texts), normalize_embeddings=True, batch_size=64,
                                                show_progress_bar=False)


def fit_all(text, vec, y):
    tfidf = tfidf_model().fit(text, y)
    minilm = LogisticRegression(max_iter=3000, C=10, class_weight="balanced").fit(vec, y)
    return tfidf, minilm


def predict_all(tfidf, minilm, text, vec) -> dict[str, np.ndarray]:
    p_t = tfidf.predict_proba(text)
    p_m = minilm.predict_proba(vec)[:, [list(minilm.classes_).index(c) for c in tfidf.classes_]]
    classes = tfidf.classes_
    return {"tfidf_logreg": classes[p_t.argmax(1)], "minilm_logreg": classes[p_m.argmax(1)],
            "ensemble": classes[((p_t + p_m) / 2).argmax(1)]}


def macro_f1(y_true, y_pred) -> float:
    return round(float(f1_score(y_true, y_pred, average="macro", labels=LABELS, zero_division=0)), 3)


def main() -> None:
    train, test = pd.read_csv(TRAIN_OUT), pd.read_csv(TEST_OUT)
    print(f"embedding {len(train) + len(test)} sentences with {EMBEDDER} ...")
    tr_vec, te_vec = embed(train["text"]), embed(test["text"])
    y = train["label"].to_numpy()

    # --- 1. choose the method on train only (5-fold CV) ---
    cv = {m: [] for m in CANDIDATES}
    for fold_tr, fold_va in StratifiedKFold(5, shuffle=True, random_state=SEED).split(train, y):
        t, m = fit_all(train["text"].iloc[fold_tr], tr_vec[fold_tr], y[fold_tr])
        preds = predict_all(t, m, train["text"].iloc[fold_va], tr_vec[fold_va])
        for name in CANDIDATES:
            cv[name].append(macro_f1(y[fold_va], preds[name]))
    cv_mean = {name: round(float(np.mean(v)), 3) for name, v in cv.items()}
    best = max(cv_mean.values())
    chosen = next(name for name in CANDIDATES if cv_mean[name] >= best - CLOSE)

    # --- 2. train on all of train, test once ---
    tfidf, minilm = fit_all(train["text"], tr_vec, y)
    preds = {**predict_all(tfidf, minilm, test["text"], te_vec), "keyword_rules": np.array(keyword_rules(test["text"]))}
    yt = test["label"].to_numpy()
    part = test["source"].map(lambda s: "massive" if s.startswith("massive") else "seed" if s == "m2_seed_tasks" else "templates")

    results = {}
    for name, p in preds.items():
        results[name] = {"macro_f1": macro_f1(yt, p), "accuracy": round(float(accuracy_score(yt, p)), 3),
                         **{f"accuracy_{k}": round(float(accuracy_score(yt[part == k], p[part == k])), 3)
                            for k in ("massive", "seed", "templates")}}
    final = preds[chosen]
    report = {
        "data": {"train": len(train), "test": len(test), "test_parts": part.value_counts().to_dict()},
        "cv_macro_f1": cv_mean, "chosen": chosen, "test": results,
        "chosen_per_class": classification_report(yt, final, labels=LABELS, output_dict=True, zero_division=0),
        "chosen_confusion": {"labels": LABELS, "matrix": confusion_matrix(yt, final, labels=LABELS).tolist()},
    }
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")
    MODEL_OUT.parent.mkdir(exist_ok=True)
    joblib.dump({"kind": chosen, "tfidf": tfidf, "classifier": minilm, "embedder": EMBEDDER,
                 "labels": list(tfidf.classes_)}, MODEL_OUT)

    print(f"\n5-fold CV macro-F1 (train): {cv_mean}  -> chosen: {chosen}\n")
    print(f"{'method':15s} {'macroF1':>8s} {'acc':>6s} {'massive':>8s} {'seed':>6s} {'templ':>6s}")
    for name, r in results.items():
        print(f"{name:15s} {r['macro_f1']:8.3f} {r['accuracy']:6.3f} {r['accuracy_massive']:8.3f} "
              f"{r['accuracy_seed']:6.3f} {r['accuracy_templates']:6.3f}")
    print(f"\n{chosen} per class (F1):")
    for label in LABELS:
        c = report["chosen_per_class"][label]
        print(f"  {label:15s} F1 {c['f1-score']:.3f}  (n={int(c['support'])})")
    print(f"\nsaved {MODEL_OUT} and {RESULTS}")


if __name__ == "__main__":
    main()
