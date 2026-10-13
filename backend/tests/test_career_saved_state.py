"""Saved progress endpoints, on a temporary SQLite database (never the shared Neon database)."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.components.career.router import router
from app.core.dependencies import get_current_user
from app.db.session import Base, get_db
from app.shared.users.models import User

REPORT = {"career_name": "Software Engineer", "questions_answered": 5, "overall_score": 72.5,
          "readiness_band": "Almost ready - keep practising", "dimension_scores": {"content": 72.5},
          "category_scores": {"Technical": 70.0}, "strongest_area": "content", "weakest_area": "content",
          "focus_tips": ["Use STAR"], "disclaimer": "Interview practice feedback is advisory."}


@pytest.fixture
def client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.sqlite3'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    with Session() as db:
        db.add_all([User(id="u1", email="a@x.lk", full_name="A", hashed_password="x"),
                    User(id="u2", email="b@x.lk", full_name="B", hashed_password="x")])
        db.commit()

    def db_override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/api/career")
    app.dependency_overrides[get_db] = db_override
    current = {"id": "u1"}
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=current["id"])
    test_client = TestClient(app)
    test_client.login_as = lambda uid: current.update(id=uid)
    return test_client


def test_state_is_saved_per_user_and_survives(client):
    assert client.get("/api/career/me/state").json()["data"] == {}
    flow = {"profile": {"faculty_field": "Law"}, "recommendations": [{"career_id": "legal_assistant"}]}
    assert client.put("/api/career/me/state", json={"data": flow}).status_code == 200
    saved = client.get("/api/career/me/state").json()
    assert saved["user_id"] == "u1" and saved["data"] == flow

    client.login_as("u2")  # another student never sees u1's data
    assert client.get("/api/career/me/state").json() == {"user_id": "u2", "data": {}, "updated_at": None}

    client.login_as("u1")
    assert client.delete("/api/career/me/state").status_code == 204
    assert client.get("/api/career/me/state").json()["data"] == {}


def test_too_large_state_is_rejected(client):
    assert client.put("/api/career/me/state", json={"data": {"x": "a" * 400_000}}).status_code == 413


def test_interview_history(client):
    for score in (55.0, 72.5):
        r = client.post("/api/career/me/interviews",
                        json={"career_id": "software_engineer", "report": {**REPORT, "overall_score": score}})
        assert r.status_code == 200
    history = client.get("/api/career/me/interviews").json()
    assert [h["overall_score"] for h in history] == [72.5, 55.0]  # newest first
    assert history[0]["career_name"] == "Software Engineer"
    client.login_as("u2")
    assert client.get("/api/career/me/interviews").json() == []
    assert client.post("/api/career/me/interviews", json={"career_id": "nope", "report": REPORT}).status_code == 404
