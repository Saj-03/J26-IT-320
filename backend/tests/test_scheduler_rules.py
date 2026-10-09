"""Unit tests for Component 3 safety rules (deterministic rule cases)."""
from datetime import datetime, timedelta
from types import SimpleNamespace as T
from app.components.scheduler.engine import stress_rules, attention_model

NOW = datetime(2026, 10, 1, 9)


def task(hours, load="medium", pr=3):
    return T(id=str(hours), status="pending", deadline=NOW + timedelta(hours=hours), cognitive_load=load, priority=pr)


def test_urgent_task_never_deferred():
    out = stress_rules.propose_changes([task(10, "heavy", 1)], "HIGH", NOW)
    assert all(c["task_id"] != "10" for c in out["changes"])


def test_no_change_when_risk_low_or_missing():
    assert stress_rules.propose_changes([task(100, "heavy")], None, NOW)["changes"] == []


def test_heavy_task_split_when_high():
    out = stress_rules.propose_changes([task(100, "heavy")], "HIGH", NOW)
    assert any(c["action"] == "split" for c in out["changes"])


def test_split_task_sizes():
    assert attention_model.split_task(70, 30) == [30, 30, 10]
