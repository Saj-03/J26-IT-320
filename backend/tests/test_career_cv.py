"""CV Builder: saved drafts (per student, temporary SQLite DB), validation, and the AI assistant (provider mocked)."""
import json
import os
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["ACRDS_USE_SBERT"] = "0"

from app.components.career import routes  # noqa: E402
from app.components.career.router import router  # noqa: E402
from app.components.career.services import cv_assistant, llm_feedback  # noqa: E402
from app.core.dependencies import get_current_user  # noqa: E402
from app.db.session import Base, get_db  # noqa: E402
from app.shared.users.models import User  # noqa: E402

CV = {
    "template": "ats", "career_id": "software_engineer",
    "personal": {"full_name": "Nimal Perera", "headline": "Aspiring Software Engineer", "email": "nimal@example.lk",
                 "phone": "+94 77 123 4567", "location": "Colombo", "website": "https://github.com/nimal"},
    "summary": "Final-year IT student who likes building web apps.",
    "education": [{"institution": "SLIIT", "degree": "BSc (Hons) IT", "field": "Computing", "start": "2022-02", "current": True}],
    "technical_skills": ["Python", "React", "SQL"], "soft_skills": ["Teamwork"],
    "experience": [{"company": "ABC Ltd", "position": "Intern", "start": "2025-06", "end": "2025-12",
                    "responsibilities": "fixed bugs and wrote tests for the web app"}],
    "projects": [{"title": "Library app", "description": "made a library system with login", "technologies": "React, FastAPI"}],
    "certifications": [{"name": "AWS Cloud Practitioner", "issuer": "Amazon", "date": "2025-03"}],
    "activities": [{"role": "Volunteer", "organisation": "Rotaract Club"}],
}


@pytest.fixture
def client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'cv.sqlite3'}", connect_args={"check_same_thread": False})
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


def test_cv_is_saved_per_student_and_can_be_deleted(client):
    assert client.get("/api/career/me/cv").json() == {"cv": None, "updated_at": None}
    saved = client.put("/api/career/me/cv", json=CV)
    assert saved.status_code == 200
    back = client.get("/api/career/me/cv").json()["cv"]
    assert back["personal"]["full_name"] == "Nimal Perera" and back["template"] == "ats"
    assert back["education"][0]["current"] is True

    client.login_as("u2")  # another student can never read, overwrite or delete u1's CV
    assert client.get("/api/career/me/cv").json()["cv"] is None
    assert client.delete("/api/career/me/cv").status_code == 204
    client.login_as("u1")
    assert client.get("/api/career/me/cv").json()["cv"]["personal"]["full_name"] == "Nimal Perera"

    edited = {**CV, "summary": "Edited summary."}
    assert client.put("/api/career/me/cv", json=edited).json()["cv"]["summary"] == "Edited summary."
    assert client.delete("/api/career/me/cv").status_code == 204
    assert client.get("/api/career/me/cv").json()["cv"] is None


def test_cv_validation(client):
    bad = [
        {**CV, "template": "fancy"},
        {**CV, "personal": {**CV["personal"], "email": "not-an-email"}},
        {**CV, "personal": {**CV["personal"], "phone": "call me"}},
        {**CV, "education": [{"start": "2022/02"}]},
        {**CV, "projects": [{"title": "x", "link": "not a link"}]},
        {**CV, "summary": "x" * 1600},
        {**CV, "projects": [{"title": f"p{i}"} for i in range(16)]},
        {**CV, "career_id": "astronaut"},
    ]
    for body in bad:
        assert client.put("/api/career/me/cv", json=body).status_code in (404, 422), body
    # an incomplete draft is fine - students can save and finish later
    assert client.put("/api/career/me/cv", json={"personal": {"full_name": "Draft"}}).status_code == 200
    # duplicate skills are removed
    dup = client.put("/api/career/me/cv", json={**CV, "technical_skills": ["Python", "python ", "SQL"]}).json()
    assert dup["cv"]["technical_skills"] == ["Python", "SQL"]


def test_assist_unavailable_without_ai(client, monkeypatch):
    monkeypatch.setattr(routes, "llm_status", lambda: {"enabled": False})
    r = client.post("/api/career/cv/assist", json={"task": "summary", "summary": "I like coding."})
    assert r.status_code == 503 and "yourself" in r.json()["detail"]
    empty = client.post("/api/career/cv/assist", json={"task": "summary"})
    assert empty.status_code == 422  # nothing to improve


def fake_provider(monkeypatch, reply: dict):
    seen = {}

    def caller(client, config, prompt, system=None, schema=None):
        seen.update(prompt=prompt, system=system)
        return json.dumps(reply)

    monkeypatch.setattr(routes, "llm_status", lambda: {"enabled": True})
    monkeypatch.setattr(llm_feedback, "load_config", lambda: {"provider": "gemini", "api_key": "k", "model": "m"})
    monkeypatch.setitem(llm_feedback.CALLERS, "gemini", caller)
    return seen


def test_assist_project_drops_invented_numbers_and_sends_no_contact_details(client, monkeypatch):
    seen = fake_provider(monkeypatch, {
        "text": "", "headline": "", "highlight_skills": [], "tips": ["Add how many users tried it"],
        "bullets": ["Built a library management system with secure login using React and FastAPI",
                    "Increased borrowing efficiency by 40%",  # invented number -> must be removed
                    "Designed the REST API for book search and loans."],
    })
    body = {"task": "project", **{k: CV["projects"][0][k] for k in ("title", "description", "technologies")},
            "summary": "should not be sent for a project task"}
    r = client.post("/api/career/cv/assist", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["removed"] == 1 and len(out["bullets"]) == 2
    assert all("40" not in b for b in out["bullets"]) and not out["bullets"][1].endswith(".")
    assert "Library app" in seen["prompt"] and "should not be sent" not in seen["prompt"]
    for private in ("Nimal", "nimal@example.lk", "+94", "github.com"):
        assert private not in seen["prompt"]
    assert "Never invent" in seen["system"]
    # contact fields are not even accepted by the request model
    assert "email" not in routes.CVAssistRequest.model_fields


def test_assist_tailor_only_highlights_the_students_own_skills(client, monkeypatch):
    seen = fake_provider(monkeypatch, {
        "text": "IT undergraduate building web applications with Python and React.",
        "headline": "Aspiring Software Engineer | Python and React",
        "bullets": [], "tips": ["Put the Library app project first"],
        "highlight_skills": ["python", "React", "Kubernetes"],  # Kubernetes is not the student's skill
    })
    r = client.post("/api/career/cv/assist", json={"task": "tailor", "career_id": "software_engineer",
                                                   "summary": CV["summary"], "skills": CV["technical_skills"],
                                                   "project_titles": ["Library app"]})
    out = r.json()
    assert r.status_code == 200 and out["highlight_skills"] == ["Python", "React"]
    assert out["headline"].startswith("Aspiring") and out["text"]
    assert "Software Engineer" in seen["prompt"]  # target career is given for relevance only


def test_check_reply_keeps_numbers_the_student_wrote():
    request = {"task": "experience", "position": "Intern", "responsibilities": "tested 3 modules and fixed 12 bugs"}
    out = cv_assistant.check_reply({"bullets": ["Tested 3 modules and resolved 12 bugs", "Cut defects by 30%"],
                                    "text": ""}, request)
    assert out["bullets"] == ["Tested 3 modules and resolved 12 bugs"] and out["removed"] == 1
    text = cv_assistant.check_reply({"text": "Motivated graduate. Improved speed by 50%. Works well in teams."},
                                    {"task": "summary", "summary": "motivated graduate"})
    assert text["text"] == "Motivated graduate. Works well in teams." and text["removed"] == 1


def test_assist_returns_503_when_provider_fails(client, monkeypatch):
    def broken(client, config, prompt, system=None, schema=None):
        return "not json"

    monkeypatch.setattr(routes, "llm_status", lambda: {"enabled": True})
    monkeypatch.setattr(llm_feedback, "load_config", lambda: {"provider": "gemini", "api_key": "k", "model": "m"})
    monkeypatch.setitem(llm_feedback.CALLERS, "gemini", broken)
    r = client.post("/api/career/cv/assist", json={"task": "summary", "summary": "I like coding."})
    assert r.status_code == 503
