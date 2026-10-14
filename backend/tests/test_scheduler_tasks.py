"""
API tests for Component 3 tasks (FR-01, FR-03).

Uses the `env` fixture from conftest.py (in-memory database, fake student).
"""
from datetime import datetime, timedelta

import pytest

from app.components.scheduler.models import FocusSession, SchedulerAuditLog


# The `env` fixture (test database + logged-in student) is in conftest.py


def future(days=3) -> str:
    return (datetime.utcnow() + timedelta(days=days)).isoformat()


def new_task(client, **overrides):
    body = {"title": "SE assignment", "deadline": future(), "estimated_minutes": 120, **overrides}
    return client.post("/api/scheduler/tasks", json=body)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
def test_create_task_keeps_all_fields(env):
    client, *_ = env
    r = new_task(client, description="Chapter 3", task_type="assignment", priority=5, cognitive_load="heavy")
    assert r.status_code == 201
    t = r.json()
    assert (t["title"], t["priority"], t["cognitive_load"], t["status"]) == ("SE assignment", 5, "heavy", "pending")
    assert t["load_set_by_student"] is True


def test_load_defaults_to_medium_when_not_given(env):
    client, *_ = env
    t = new_task(client).json()
    assert t["cognitive_load"] == "medium" and t["load_set_by_student"] is False


@pytest.mark.parametrize("bad", [
    {"deadline": (datetime.utcnow() - timedelta(days=1)).isoformat()},  # past deadline
    {"priority": 9},
    {"estimated_minutes": 0},
    {"title": "   "},
    {"cognitive_load": "extreme"},
    {"colour": "red"},                                                  # unknown field
])
def test_invalid_task_rejected(env, bad):
    client, *_ = env
    assert new_task(client, **bad).status_code == 422


def test_timezone_deadline_converted_to_utc(env):
    client, *_ = env
    t = new_task(client, deadline="2099-01-01T10:00:00+05:30").json()
    assert t["deadline"].startswith("2099-01-01T04:30:00")


# ---------------------------------------------------------------------------
# Subtasks
# ---------------------------------------------------------------------------
def test_subtask_shows_in_parent_detail(env):
    client, *_ = env
    parent = new_task(client, deadline=future(5)).json()
    new_task(client, title="Write intro", parent_id=parent["id"], estimated_minutes=30)
    detail = client.get(f"/api/scheduler/tasks/{parent['id']}").json()
    assert [s["title"] for s in detail["subtasks"]] == ["Write intro"]


def test_subtask_cannot_be_due_after_parent(env):
    client, *_ = env
    parent = new_task(client, deadline=future(2)).json()
    assert new_task(client, parent_id=parent["id"], deadline=future(4)).status_code == 422


def test_no_sub_subtasks(env):
    client, *_ = env
    parent = new_task(client, deadline=future(5)).json()
    child = new_task(client, parent_id=parent["id"], deadline=future(2)).json()
    assert new_task(client, parent_id=child["id"], deadline=future(1)).status_code == 422


# ---------------------------------------------------------------------------
# List / update
# ---------------------------------------------------------------------------
def test_list_sorted_by_deadline_and_filters(env):
    client, *_ = env
    late = new_task(client, title="late", deadline=future(9)).json()
    new_task(client, title="soon", deadline=future(1))
    client.patch(f"/api/scheduler/tasks/{late['id']}", json={"status": "done"})

    assert [t["title"] for t in client.get("/api/scheduler/tasks").json()] == ["soon", "late"]
    assert [t["title"] for t in client.get("/api/scheduler/tasks?status=pending").json()] == ["soon"]


def test_update_changes_only_sent_fields(env):
    client, *_ = env
    t = new_task(client, priority=2).json()
    r = client.patch(f"/api/scheduler/tasks/{t['id']}", json={"cognitive_load": "low", "status": "done"})
    u = r.json()
    assert r.status_code == 200
    assert (u["priority"], u["cognitive_load"], u["load_set_by_student"]) == (2, "low", True)
    assert u["completed_at"] is not None


# ---------------------------------------------------------------------------
# Privacy: a student can never touch another student's task
# ---------------------------------------------------------------------------
def test_other_student_gets_404(env):
    client, _, current, other = env
    t = new_task(client).json()
    current["user"] = other
    assert client.get(f"/api/scheduler/tasks/{t['id']}").status_code == 404
    assert client.patch(f"/api/scheduler/tasks/{t['id']}", json={"priority": 1}).status_code == 404
    assert client.delete(f"/api/scheduler/tasks/{t['id']}").status_code == 404
    assert client.get("/api/scheduler/tasks").json() == []


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------
def test_delete_removes_subtasks_but_keeps_focus_history(env):
    client, db, current, _ = env
    parent = new_task(client, deadline=future(5)).json()
    child = new_task(client, parent_id=parent["id"], deadline=future(2)).json()
    db.add(FocusSession(user_id=current["user"].id, task_id=child["id"],
                        started_at=datetime.utcnow(), planned_minutes=25, actual_minutes=25, completed=True))
    db.commit()

    assert client.delete(f"/api/scheduler/tasks/{parent['id']}").status_code == 204
    assert client.get("/api/scheduler/tasks").json() == []
    session = db.query(FocusSession).one()
    assert session.task_id is None                      # history kept, link removed


def test_every_change_is_audited(env):
    client, db, *_ = env
    t = new_task(client).json()
    client.patch(f"/api/scheduler/tasks/{t['id']}", json={"priority": 1})
    client.delete(f"/api/scheduler/tasks/{t['id']}")
    events = [e.event_type for e in db.query(SchedulerAuditLog).order_by(SchedulerAuditLog.created_at)]
    assert events == ["task_created", "task_updated", "task_deleted"]
