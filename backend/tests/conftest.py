"""
Shared test setup (pytest loads this file automatically).

`env` gives every test:
  * a fresh in-memory SQLite database (the real database is never touched)
  * two students: `me` (logged in) and `other`
  * a test client for the Component 3 scheduler API
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db.base  # noqa: F401  (registers every table)
from app.db.session import Base, get_db
from app.core.dependencies import get_current_user
from app.shared.users.models import User
from app.components.scheduler.router import router as scheduler_router


@pytest.fixture()
def env(monkeypatch):
    # M2 (load classifier) off by default: tasks without a load get "medium", tests stay fast.
    # test_scheduler_m2_app.py switches it back on.
    from app.components.scheduler.engine import m2_classifier
    monkeypatch.setattr(m2_classifier, "available", lambda: False)

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    me = User(email="me@test.lk", full_name="Me", hashed_password="x")
    other = User(email="other@test.lk", full_name="Other", hashed_password="x")
    db.add_all([me, other]); db.commit()

    current = {"user": me}                       # a test can switch: current["user"] = other
    api = FastAPI()
    api.include_router(scheduler_router, prefix="/api/scheduler")
    api.dependency_overrides[get_db] = lambda: db
    api.dependency_overrides[get_current_user] = lambda: current["user"]

    yield TestClient(api), db, current, other
    db.close()
