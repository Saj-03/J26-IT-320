"""Tests for M2 (cognitive load classifier): keyword baseline and use inside the app."""
from datetime import datetime, timedelta

import pytest

from app.components.scheduler.ml import m2_classifier
from app.components.scheduler.models import SchedulerAuditLog
from ml_training.scheduler.train_m2 import keyword_rules

REAL_AVAILABLE = m2_classifier.available          # saved before conftest switches it off
URL = "/api/scheduler/tasks"
needs_model = pytest.mark.skipif(not REAL_AVAILABLE(), reason="M2 model / embedder not installed")


def new_task(client, title, **extra):
    deadline = (datetime.utcnow() + timedelta(days=5)).isoformat()
    return client.post(URL, json={"title": title, "deadline": deadline, "estimated_minutes": 60, **extra}).json()


def test_keyword_baseline():
    assert keyword_rules(["Implement the BST deletion", "Email the lecturer", "Do tutorial 3"]) == \
           ["heavy", "low", "medium"]


def test_without_model_task_gets_medium(env):
    client, *_ = env                                          # conftest: M2 off
    body = new_task(client, "Implement Dijkstra's algorithm")
    assert (body["cognitive_load"], body["load_confidence"], body["load_set_by_student"]) == ("medium", None, False)


@needs_model
def test_m2_labels_new_tasks(env, monkeypatch):
    monkeypatch.setattr(m2_classifier, "available", REAL_AVAILABLE)
    client, *_ = env
    heavy = new_task(client, "Design and implement the database schema with stored procedures")
    low = new_task(client, "Submit the signed consent form on the portal")
    assert heavy["cognitive_load"] == "heavy" and low["cognitive_load"] == "low"
    assert 0 < heavy["load_confidence"] <= 1 and heavy["load_set_by_student"] is False


@needs_model
def test_student_choice_always_wins(env, monkeypatch):
    monkeypatch.setattr(m2_classifier, "available", REAL_AVAILABLE)
    client, *_ = env
    body = new_task(client, "Submit the form", cognitive_load="heavy")
    assert (body["cognitive_load"], body["load_confidence"], body["load_set_by_student"]) == ("heavy", None, True)


def test_override_is_recorded_as_a_label(env):
    client, db, *_ = env
    task = new_task(client, "Read chapter 2")                              # medium (default)
    client.patch(f"{URL}/{task['id']}", json={"cognitive_load": "low"})
    row = db.query(SchedulerAuditLog).filter_by(event_type="load_overridden").one()
    assert (row.details["was"], row.details["now"]) == ("medium", "low")
    client.patch(f"{URL}/{task['id']}", json={"cognitive_load": "heavy"})   # second change: already the student's
    assert db.query(SchedulerAuditLog).filter_by(event_type="load_overridden").count() == 1
