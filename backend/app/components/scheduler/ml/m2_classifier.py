"""
M2 inside the app: guess a task's cognitive load (heavy / medium / low) from its text.

Used only when the student did not pick a load. The student can always change it,
and that change is saved as a real label (load_set_by_student) for retraining.

The saved file says which model train_m2.py chose ("kind"):
  tfidf_logreg          : word-based classifier (no extra model download)
  M2_minilm_logreg      : sentence embeddings (all-MiniLM-L6-v2) + logistic regression
  ensemble_tfidf_minilm : average of the two

Safe fallback: no model file / missing library / embedder not downloaded
-> `available()` is False and the task gets the default "medium" (as before).
"""
from functools import lru_cache

import numpy as np
from app.components.scheduler.ml import MODELS_DIR

MODEL_FILE = MODELS_DIR / "m2_load_classifier.joblib"


@lru_cache(maxsize=1)
def _load():
    """Load the saved model once. None if it can't be used."""
    try:
        import joblib
        saved = joblib.load(MODEL_FILE)                      # saved by train_m2.py
        if saved.get("embedder"):
            from sentence_transformers import SentenceTransformer
            saved["embedder_model"] = SentenceTransformer(saved["embedder"])
        return saved
    except Exception:
        return None


def available() -> bool:
    return _load() is not None


def classify(title: str, description: str | None = None) -> tuple[str, float]:
    """('heavy', 0.87) - the label and how sure the model is (0..1). Call available() first."""
    saved = _load()
    text = f"{title}. {description}" if description else title
    chances = []
    if saved.get("tfidf") is not None:
        chances.append(saved["tfidf"].predict_proba([text])[0])
    if saved.get("classifier") is not None:
        vector = saved["embedder_model"].encode([text], normalize_embeddings=True, show_progress_bar=False)
        chances.append(saved["classifier"].predict_proba(vector)[0])
    mean = np.mean(chances, axis=0)                          # one model -> itself, two -> average
    best = int(mean.argmax())
    return str(saved["labels"][best]), round(float(mean[best]), 3)
