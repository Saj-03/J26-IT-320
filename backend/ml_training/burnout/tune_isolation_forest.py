"""Tune Isolation Forest on StudentLife-derived CSV (datasets/burnout/studentlife_clean.csv)."""
from pathlib import Path
import pandas as pd
from sklearn.ensemble import IsolationForest

CSV = Path(__file__).resolve().parents[2] / "datasets" / "burnout" / "studentlife_clean.csv"
if not CSV.exists():
    raise SystemExit(f"Put the cleaned dataset at {CSV}")
df = pd.read_csv(CSV)
for c in (0.05, 0.1, "auto"):
    m = IsolationForest(contamination=c, random_state=42).fit(df.select_dtypes("number"))
    print(c, (m.predict(df.select_dtypes("number")) == -1).mean())
