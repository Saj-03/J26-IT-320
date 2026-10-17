"""
Assigns a student to a skill-readiness persona (Developing / Progressing / Advanced).

The K-Means model is trained offline by ml_training/career/train_persona_clusters.py.
Personas describe the student's overall self-rated skill level; they are shown as
guidance and do not change the career ranking. Without the model file this returns None.
"""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.components.career.services import i18n

MODEL_FILE = Path(__file__).resolve().parents[4] / "ml_models" / "career_persona_model.joblib"


@lru_cache
def load_persona_model() -> Optional[dict]:
    if not MODEL_FILE.exists():
        return None
    try:
        import joblib
        return joblib.load(MODEL_FILE)
    except Exception:
        return None


def assign_persona(skills: dict, lang: str = "en") -> Optional[dict]:
    bundle = load_persona_model()
    if not bundle:
        return None
    try:
        row = [[float(skills[k]) for k in bundle["skill_keys"]]]
        cluster = int(bundle["kmeans"].predict(bundle["scaler"].transform(row))[0])
        persona = bundle["personas"][bundle["persona_of_cluster"][cluster]]
        return {**i18n.persona_text(persona, lang), "average_skill_level": round(sum(row[0]) / len(row[0]), 2)}
    except Exception:
        return None  # never let the persona model break recommendations
