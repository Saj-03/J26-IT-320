"""
The 4 trained models are found exactly where the app looks for them.
If a file is moved and its path breaks, the app would NOT crash - it would quietly fall back to simple
rules (M1 timer rules, keyword load, the student's own estimate, keyword voice parsing). This test makes
that loud instead of silent.
"""
from pathlib import Path

from app.components.scheduler.ml import m1_predictor, m2_classifier, m3_predictor, m4_predictor

BACKEND = Path(__file__).resolve().parents[1]


def test_every_model_is_read_from_backend_ml_models():
    for module in (m1_predictor, m2_classifier, m3_predictor, m4_predictor):
        assert module.MODEL_FILE.parent == BACKEND / "ml_models", module.__name__
        assert module.MODEL_FILE.exists(), f"{module.MODEL_FILE.name} is missing - add it with git add -f"
