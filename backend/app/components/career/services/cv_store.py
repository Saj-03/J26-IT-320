"""
Saved CV drafts (CV Builder) - one draft per student, in the shared database.

Same pattern as saved_state.py: every function takes the logged-in user's id, so a student
can only ever read, overwrite or delete their own CV.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.components.career.models import CareerCV, utc_now


def get_cv(db: Session, user_id: str) -> Optional[CareerCV]:
    return db.get(CareerCV, user_id)


def save_cv(db: Session, user_id: str, cv: dict) -> CareerCV:
    row = db.get(CareerCV, user_id) or CareerCV(user_id=user_id)
    row.template = cv.get("template", "modern")
    row.data = cv
    row.updated_at = utc_now()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_cv(db: Session, user_id: str) -> None:
    row = db.get(CareerCV, user_id)
    if row:
        db.delete(row)
        db.commit()
