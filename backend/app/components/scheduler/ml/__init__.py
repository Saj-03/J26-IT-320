"""Trained ML models used by the app: M1 focus GRU, M2 load classifier, M3 duration, M4 voice planner."""
from pathlib import Path

# backend/ml_models - ONE place for the path, so moving a file can never make a model silently 'missing'
MODELS_DIR = Path(__file__).resolve().parents[4] / "ml_models"   # ml -> scheduler -> components -> app -> backend
