"""
M4 inside the app: what is each piece of a spoken day plan? (task_academic, task_personal, commitment,
routine, energy, plan_request, other)

Uses ml_models/m4_brain_dump.joblib (made by ml_training/scheduler/train_m4.py).
No model file -> the keyword rules from training are used, so the feature still works (less accurately).
"""
from functools import lru_cache
from app.components.scheduler.ml import MODELS_DIR

MODEL_FILE = MODELS_DIR / "m4_brain_dump.joblib"


@lru_cache(maxsize=1)
def _load():
    try:
        import joblib
        saved = joblib.load(MODEL_FILE)
        return saved if "tfidf" in saved else None
    except Exception:                                    # no file / no sklearn / old file
        return None


def available() -> bool:
    return _load() is not None


def classify(pieces: list[str]) -> list[tuple[str, float, str]]:
    """[(label, confidence 0..1, source), ...] for each piece. source = m4_model / keyword_rules."""
    if not pieces:
        return []
    saved = _load()
    if saved is None:
        from ml_training.scheduler.train_m4 import keyword_rules
        return [(label, 0.5, "keyword_rules") for label in keyword_rules(pieces)]
    if saved["kind"] == "tfidf_logreg":
        proba = saved["tfidf"].predict_proba(pieces)
    else:                                                # ensemble / minilm need sentence embeddings
        from ml_training.scheduler.train_m4 import embed
        vec = embed(pieces)
        p_m = saved["classifier"].predict_proba(vec)
        p_m = p_m[:, [list(saved["classifier"].classes_).index(c) for c in saved["tfidf"].classes_]]
        proba = p_m if saved["kind"] == "minilm_logreg" else (saved["tfidf"].predict_proba(pieces) + p_m) / 2
    labels = saved["tfidf"].classes_
    return [(str(labels[row.argmax()]), round(float(row.max()), 3), "m4_model") for row in proba]
