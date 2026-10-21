"""
Pretend to be Component 4 (Sajalee's burnout model): send ONE wellbeing risk signal for one student,
so the "C4 signal -> lighter plan proposal" flow can be tried in the app before C4 is merged.

It writes exactly what C4 writes: a RiskSignal row in the shared signal_events table, through the same
validator (app/shared/integration/validator.record). Event ids start with "demo-signal-", so --remove
can find them again. Only the chosen student is touched.

Run (from backend/):
  .venv\\Scripts\\python -m scripts.send_test_signal --email you@example.com                 # dry run: only prints
  .venv\\Scripts\\python -m scripts.send_test_signal --email you@example.com --apply         # HIGH signal now
  .venv\\Scripts\\python -m scripts.send_test_signal --email you@example.com --level MODERATE --apply
  .venv\\Scripts\\python -m scripts.send_test_signal --email you@example.com --remove        # undo + delete

After --apply: open the app -> within 2 minutes the bell shows "A lighter plan is ready for you to check"
(or open My Schedule -> lighter plan page right away).
"""
import argparse
import uuid
from datetime import datetime, timezone

import app.db.base  # noqa: F401  (registers every table)
from app.components.scheduler.stress import stress_service
from app.components.scheduler.models import ScheduleChange
from app.db.session import SessionLocal
from app.shared.integration.contracts import RiskSignal
from app.shared.integration.models import SignalEvent
from app.shared.integration.validator import record
from app.shared.users.models import User

PREFIX = "demo-signal-"
SCORE = {"LOW": 0.2, "MODERATE": 0.5, "HIGH": 0.82}


def send(db, user, level: str) -> None:
    signal = RiskSignal(event_id=PREFIX + str(uuid.uuid4()), student_id=user.research_id, risk_score=SCORE[level],
                        risk_level=level, trend="RISING", timestamp=datetime.now(timezone.utc))
    record(db, "RISK", signal, "ACCEPTED")                       # exactly what C4 does
    status = stress_service.stress_status(db, user)
    print(f"sent {level} signal for {user.email} (research id {user.research_id})")
    print(f"scheduler says: {status['action']} - {status['reason']}")
    if status["action"] == "off":
        print("  -> turn on stress changes in Settings, or ask the researcher to set your mode to adaptive")


def remove(db, user) -> None:
    events = db.query(SignalEvent).filter(SignalEvent.student_id == user.research_id,
                                          SignalEvent.event_id.like(PREFIX + "%")).all()
    ids = [e.event_id for e in events]
    changes = db.query(ScheduleChange).filter(ScheduleChange.user_id == user.id,
                                              ScheduleChange.signal_event_id.in_(ids)).all() if ids else []
    for change in changes:
        if change.decision in ("accepted", "edited"):            # put the schedule back first
            stress_service.restore(db, user, change.id)
        db.delete(change)
    for e in events:
        db.delete(e)
    db.commit()
    print(f"removed {len(events)} test signals and {len(changes)} proposals made from them for {user.email}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True)
    parser.add_argument("--level", choices=list(SCORE), default="HIGH")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--remove", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            raise SystemExit(f"no user with email {args.email}")
        if args.remove:
            remove(db, user)
        elif args.apply:
            send(db, user, args.level)
        else:
            print(f"dry run: would send a {args.level} risk signal for {user.email} "
                  f"(research id {user.research_id}). Add --apply to send it.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
