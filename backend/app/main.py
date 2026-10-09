"""
IHUSD Backend - entry point.

VIVA: "main.py only wires things together. Each research component
has its own router, so every member's work is isolated in its own folder."
Run:  uvicorn app.main:app --reload   ->  http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import Base, engine

# Shared (team) routers
from app.shared.auth.router import router as auth_router
from app.shared.integration.router import router as integration_router

# Individual component routers
from app.components.career.router import router as career_router
from app.components.physical_wellbeing.router import router as physical_router
from app.components.scheduler.router import router as scheduler_router
from app.components.burnout.router import router as burnout_router

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables (for development; use Alembic migrations in production)
Base.metadata.create_all(bind=engine)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth (shared)"])
app.include_router(integration_router, prefix="/api/integration", tags=["Integration signals (shared)"])
app.include_router(career_router, prefix="/api/career", tags=["Career Readiness - ACRDS"])
app.include_router(physical_router, prefix="/api/physical", tags=["Physical Wellbeing"])
app.include_router(scheduler_router, prefix="/api/scheduler", tags=["Component 3 - Adaptive Scheduler"])
app.include_router(burnout_router, prefix="/api/burnout", tags=["Component 4 - Burnout Prediction"])


@app.get("/api/health")
def health():
    return {"status": "ok", "system": "IHUSD"}
