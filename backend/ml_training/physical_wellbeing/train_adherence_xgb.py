"""Train the XGBoost adherence model. Run: python ml_training/physical_wellbeing/train_adherence_xgb.py"""
from pathlib import Path
import joblib
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

OUT = Path(__file__).resolve().parents[2] / "ml_models" / "adherence_xgb.joblib"

# Replace with real pilot data: features = [minutes, intensity], label = completed?
rng = np.random.default_rng(42)
X = np.column_stack([rng.integers(5, 60, 500), rng.integers(0, 3, 500)])
y = ((X[:, 0] < 30) & (X[:, 1] < 2)).astype(int) ^ (rng.random(500) < 0.1)

Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)
model = XGBClassifier(n_estimators=100, max_depth=3, eval_metric="logloss").fit(Xtr, ytr)
pred = model.predict(Xte)
print(f"Accuracy={accuracy_score(yte, pred):.3f}  F1={f1_score(yte, pred):.3f}")
OUT.parent.mkdir(exist_ok=True)
joblib.dump(model, OUT)
print("Saved ->", OUT)
