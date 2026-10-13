"""Persona (K-Means) model: assignment logic and graceful fallback."""
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from app.components.career.schemas import SKILL_KEYS
from app.components.career.services import persona


def fake_bundle():
    """Three clear groups (low / mid / high self-ratings), clusters deliberately unordered."""
    X = np.array([[v] * 9 for v in (2, 2, 2, 4, 4, 4, 5, 5, 5)], float)
    scaler = StandardScaler().fit(X)
    km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(scaler.transform(X))
    order = np.argsort(scaler.inverse_transform(km.cluster_centers_).mean(1))
    names = ["Developing", "Progressing", "Advanced"]
    return {"scaler": scaler, "kmeans": km, "skill_keys": list(SKILL_KEYS),
            "persona_of_cluster": {int(c): r for r, c in enumerate(order)},
            "personas": [{"name": n, "description": "d", "advice": "a"} for n in names]}


def test_assigns_low_mid_high(monkeypatch):
    monkeypatch.setattr(persona, "load_persona_model", fake_bundle)
    assert persona.assign_persona({k: 2 for k in SKILL_KEYS})["name"] == "Developing"
    assert persona.assign_persona({k: 4 for k in SKILL_KEYS})["name"] == "Progressing"
    out = persona.assign_persona({k: 5 for k in SKILL_KEYS})
    assert out["name"] == "Advanced" and out["average_skill_level"] == 5.0


def test_no_model_returns_none(monkeypatch):
    monkeypatch.setattr(persona, "load_persona_model", lambda: None)
    assert persona.assign_persona({k: 3 for k in SKILL_KEYS}) is None
