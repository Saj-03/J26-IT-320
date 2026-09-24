"""
Shared endpoints where components POST signals to each other.
All go through validation + audit logging.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.shared.integration import contracts as c
from app.shared.integration.validator import is_duplicate, is_stale, record

router = APIRouter()


def _accept(db: Session, kind: str, payload):
    if is_duplicate(db, payload.event_id):
        return {"status": "DUPLICATE", "event_id": payload.event_id}
    status = "STALE" if is_stale(payload.timestamp) else "ACCEPTED"
    record(db, kind, payload, status)
    return {"status": status, "event_id": payload.event_id}


@router.post("/risk-signal")
def receive_risk(signal: c.RiskSignal, db: Session = Depends(get_db)):
    return _accept(db, "RISK", signal)


@router.post("/deviation-signal")
def receive_deviation(signal: c.DeviationSignal, db: Session = Depends(get_db)):
    return _accept(db, "DEVIATION", signal)


@router.post("/recovery-signal")
def receive_recovery(signal: c.RecoverySignal, db: Session = Depends(get_db)):
    return _accept(db, "RECOVERY", signal)
