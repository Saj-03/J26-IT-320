"""Contract tests: valid, malformed and out-of-range Component 4 messages."""
import pytest
from pydantic import ValidationError
from app.shared.integration.contracts import RiskSignal
from app.shared.integration.mock_signals import mock_risk_signal


def test_valid_signal():
    assert RiskSignal(**mock_risk_signal("P-1")).risk_level == "HIGH"


def test_out_of_range_score_rejected():
    bad = mock_risk_signal("P-1"); bad["risk_score"] = 1.5
    with pytest.raises(ValidationError):
        RiskSignal(**bad)


def test_unknown_level_rejected():
    bad = mock_risk_signal("P-1"); bad["risk_level"] = "PANIC"
    with pytest.raises(ValidationError):
        RiskSignal(**bad)


def test_deviation_and_recovery_contracts():
    from app.shared.integration.contracts import DeviationSignal, RecoverySignal
    from app.shared.integration.mock_signals import mock_deviation_signal, mock_recovery_signal
    assert DeviationSignal(**mock_deviation_signal("P-1", bad_week=True)).missed_sessions == 6
    assert RecoverySignal(**mock_recovery_signal("P-1")).severity == "MODERATE"
    bad = mock_recovery_signal("P-1"); bad["severity"] = "EXTREME"
    with pytest.raises(ValidationError):
        RecoverySignal(**bad)
