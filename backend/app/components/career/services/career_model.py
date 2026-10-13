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

# Applicability domain: the model is only used for students from faculties it saw enough of in
# training. With 1-5 respondents (Engineering, Law, Education, ...) its predictions are guesses,
# so for those faculties the recommender uses skill match + the student's own choices instead.
MIN_FACULTY_SUPPORT = 10
# Labelled training responses per faculty in the current model (105 survey responses, 2026-09).
# A retrained model stores its own counts in the bundle ("faculty_counts"), which then take priority.
DEFAULT_FACULTY_COUNTS = {
    "Computing": 54, "Science": 14, "Health Science/Medicine": 9, "Business/Management": 9, "Engineering": 4,
    "Design/Creative Studies": 3, "Education": 3, "Arts/Humanities": 3, "Law": 1, "Social Sciences": 1,
}


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


def model_applies(profile: dict) -> bool:
    """True if a model is loaded and the student's faculty is inside its training domain.
    Profiles without a faculty (old API clients) keep using the model, as before."""
    bundle = load_bundle()
    if not bundle:
        return False
    faculty = (profile.get("faculty_field") or "").strip()
    if not faculty:
        return True
    counts = bundle.get("faculty_counts") or DEFAULT_FACULTY_COUNTS
    return counts.get(faculty, 0) >= MIN_FACULTY_SUPPORT


def family_probabilities(profile: dict) -> Optional[dict]:
    """P(career family) for one student profile, or None when no model is available
    or the student's faculty is outside the model's training domain."""
    bundle = load_bundle()
    if not bundle or not model_applies(profile):
        return None
    try:
        features = build_features(profile)
        row = [[features[i] for i in bundle["feature_indices"]]]
        proba = bundle["model"].predict_proba(row)[0]
        return {cls: float(p) for cls, p in zip(bundle["classes"], proba)}
    except Exception:
        return None  # never let a model problem break recommendations
