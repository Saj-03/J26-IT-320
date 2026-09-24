from app.components.burnout.ml.fusion import fuse


def test_missing_signals_are_ok():
    assert fuse(None, None, None, None)["risk_level"] == "LOW"


def test_negative_signals_raise_risk():
    assert fuse(0.9, -0.8, -0.7, 1.5)["risk_level"] == "HIGH"
