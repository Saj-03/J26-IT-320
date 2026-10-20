"""Unit tests for the attention rules (rule baseline used before M1 has enough history)."""
from app.components.scheduler.focus import attention_model


def test_split_task_sizes():
    assert attention_model.split_task(70, 30) == [30, 30, 10]
