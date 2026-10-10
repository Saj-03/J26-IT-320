"""
Loads the trained career-family model (ml_models/career_family_model.joblib).

The model is trained offline by ml_training/career/train_career_model.py.
If the file is missing or cannot be loaded, the recommender simply keeps
using the rule-based cosine score, so the API always works.
"""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.components.career.services.career_features import build_features

MODEL_FILE = Path(__file__).resolve().parents[4] / "ml_models" / "career_family_model.joblib"


@lru_cache
def load_bundle() -> Optional[dict]:
    if not MODEL_FILE.exists():
        return None
    try:
        import joblib
        return joblib.load(MODEL_FILE)
    except Exception:
        return None


def model_info() -> dict:
    bundle = load_bundle()
    if not bundle:
        return {"loaded": False}
    return {"loaded": True, "model": bundle["model_name"], "features": bundle["feature_set"],
            "alpha": bundle["alpha"], "trained_at": bundle["trained_at"], "n_samples": bundle["n_samples"]}


def family_probabilities(profile: dict) -> Optional[dict]:
    """P(career family) for one student profile, or None when no model is available."""
    bundle = load_bundle()
    if not bundle:
        return None
    try:
        features = build_features(profile)
        row = [[features[i] for i in bundle["feature_indices"]]]
        proba = bundle["model"].predict_proba(row)[0]
        return {cls: float(p) for cls, p in zip(bundle["classes"], proba)}
    except Exception:
        return None  # never let a model problem break recommendations
