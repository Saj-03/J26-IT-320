import pytest
from app.components.burnout.llm.prompts import is_crisis, build_system_prompt, BASE


@pytest.mark.parametrize("msg", [
    "I want to kill myself", "i WANT to die.", "I don\u2019t want to live anymore",
    "thinking about suicide", "i wanna end my life!!", "I might hurt myself",
])
def test_crisis_detected(msg):
    assert is_crisis(msg)


@pytest.mark.parametrize("msg", ["do I have burnout?", "this deadline is killing me", "so tired today"])
def test_normal_messages_not_crisis(msg):
    assert not is_crisis(msg)


def test_prompt_forbids_diagnosis_and_grounds_context():
    assert "Never diagnose" in BASE
    p = build_system_prompt({"task_load": 9, "completion_rate": 0.5, "deviation": "about normal"})
    assert "task load 9" in p and build_system_prompt(None) == BASE
