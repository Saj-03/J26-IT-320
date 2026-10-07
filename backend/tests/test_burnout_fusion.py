import pytest
from app.components.burnout.ml.fusion import fuse


def test_missing_signals_are_ok():
    r = fuse(None, None, None, None)
    assert r["risk_level"] == "LOW" and r["reasons"] == ["not enough data yet"]


def test_negative_signals_raise_risk():
    assert fuse(0.9, -0.8, -0.7, 1.5)["risk_level"] == "HIGH"


def test_calm_week():
    assert fuse(0.1, 0.6, 0.5, 5)["risk_level"] == "LOW"


def test_mixed_week():
    assert fuse(0.7, -0.3, -0.3, 3)["risk_level"] == "MODERATE"


def test_neutral_text_alone_is_not_flagged():
    assert fuse(None, 0.0, None, None)["risk_level"] == "LOW"


def test_single_signal_is_never_high():
    assert fuse(None, -0.99, None, None)["risk_level"] == "MODERATE"


def test_works_without_behaviour_data():          # cold start / Scheduler offline
    assert fuse(None, -0.8, -0.7, 1)["risk_level"] == "HIGH"


def test_reasons_are_human_readable():
    r = fuse(0.9, -0.8, -0.7, 1)
    assert len(r["reasons"]) == 4
    assert not any("burnout" in x.lower() for x in r["reasons"])


# (deviation, journal, chat, mood) -> level. None = signal missing. Print as the report table.
SCENARIOS = {
    "calm_week":            ((0.10, 0.6, 0.5, 5),       "LOW"),
    "slow_build_up":        ((0.60, -0.4, -0.3, 3),     "MODERATE"),
    "sudden_bad_week":      ((0.90, -0.8, -0.7, 1),     "HIGH"),
    "recovery":             ((0.20, 0.2, 0.3, 4),       "LOW"),
    "new_user_no_baseline": ((None, -0.5, -0.4, 3),     "MODERATE"),
    "mood_only_low":        ((None, None, None, 1),     "MODERATE"),
    "behaviour_only_high":  ((0.90, None, None, None),  "MODERATE"),
    "no_data":              ((None, None, None, None),  "LOW"),
}


@pytest.mark.parametrize("name", SCENARIOS)
def test_scenario(name):
    args, expected = SCENARIOS[name]
    assert fuse(*args)["risk_level"] == expected
