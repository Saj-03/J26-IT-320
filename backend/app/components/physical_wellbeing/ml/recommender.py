"""
Hybrid recommender:
 1) Rule filter  - time available, equipment, recovery mode (from C4), academic load (from C3)
 2) ML ranking   - XGBoost adherence model (trained in ml_training/) predicts
                   which exercise the student is most likely to complete.
If the model file is missing, falls back to rules only (safe baseline to compare against).
"""
import json
from pathlib import Path
import joblib

BASE = Path(__file__).resolve().parents[4]
EXERCISES = BASE / "datasets" / "physical" / "exercises.json"
MEALS = BASE / "datasets" / "physical" / "meals.json"
MODEL = BASE / "ml_models" / "adherence_xgb.joblib"


def _load(p): return json.loads(p.read_text())


def recommend_exercises(profile, heavy_academic_week: bool = False, k: int = 3):
    minutes = profile.available_minutes // 2 if heavy_academic_week else profile.available_minutes
    items = [e for e in _load(EXERCISES)
             if e["minutes"] <= minutes
             and set(e["equipment"]) <= set(profile.equipment + ["none"])]
    if profile.recovery_mode:                     # burnout signal -> gentle recovery
        items = [e for e in items if e["intensity"] == "low"]
    if MODEL.exists():
        model = joblib.load(MODEL)
        feats = [[e["minutes"], {"low": 0, "medium": 1, "high": 2}[e["intensity"]]] for e in items]
        for e, p in zip(items, model.predict_proba(feats)[:, 1]):
            e["adherence_prob"] = round(float(p), 3)
        items.sort(key=lambda e: e["adherence_prob"], reverse=True)
    return items[:k]


def recommend_meals(profile, k: int = 3):
    meals = [m for m in _load(MEALS) if profile.diet_pref in ("any", m["type"])]
    return meals[:k]
