"""
Saves each student's ACRDS progress in the shared database (per user account).

- career_flow_states: one row per student with the latest flow (overwritten on each step).
- interview_sessions: one row per finished interview practice (history over time).
"""
import json
from typing import Optional

from sqlalchemy.orm import Session

from app.components.career.models import CareerFlowState, InterviewSession, utc_now

MAX_STATE_BYTES = 300_000  # a full flow is ~20-60 KB; reject anything unreasonably large


def get_state(db: Session, user_id: str) -> Optional[CareerFlowState]:
    return db.get(CareerFlowState, user_id)


def state_too_large(data: dict) -> bool:
    return len(json.dumps(data)) > MAX_STATE_BYTES


def save_state(db: Session, user_id: str, data: dict) -> CareerFlowState:
    row = db.get(CareerFlowState, user_id) or CareerFlowState(user_id=user_id)
    row.data = data
    row.updated_at = utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def clear_state(db: Session, user_id: str) -> None:
    row = db.get(CareerFlowState, user_id)
    if row:
        db.delete(row)
        db.commit()


def save_interview(db: Session, user_id: str, career_id: str, report: dict) -> InterviewSession:
    row = InterviewSession(user_id=user_id, career=career_id, report=report)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_interviews(db: Session, user_id: str, limit: int = 10) -> list[InterviewSession]:
    return (db.query(InterviewSession).filter_by(user_id=user_id)
            .order_by(InterviewSession.created_at.desc()).limit(limit).all())
