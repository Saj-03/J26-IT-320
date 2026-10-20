"""
Demo data for ONE student, so the PP1 demo shows real M1 / streak / badge screens.

What it adds (all ids start with "demo-", so they can be removed again):
  * 6 tasks  - 3 open (light / medium / heavy, planned for today and tomorrow) + 3 done on time
  * ~30 focus sessions over the last 3 weeks (Sri Lanka time):
        evening 20:00-21:00 -> usually completed   (this is the "peak" M1 should find)
        afternoon 14:00-16:00 -> sometimes completed
        morning 09:00-10:00 -> often stopped early
    the last 8 days have a session every day -> a streak
  * XP for each completed session (same "focus-<session id>" key the app uses)

Badges are NOT written here - the app gives them itself the next time the Progress page loads.

Only the chosen student is touched. Nothing else in the database is changed.

Run (from backend/):
  .venv\\Scripts\\python -m scripts.seed_demo --email you@example.com           # dry run: only prints
  .venv\\Scripts\\python -m scripts.seed_demo --email you@example.com --apply   # really adds the data
  .venv\\Scripts\\python -m scripts.seed_demo --email you@example.com --remove  # deletes the demo data
"""
import argparse
import random
import uuid
from datetime import datetime, timedelta

import app.db.base  # noqa: F401  (registers every table)
from app.components.scheduler.tasks.commitment_service import SL_OFFSET
from app.components.scheduler.rewards import gamification
from app.components.scheduler.models import FocusSession, RewardEvent, Task
from app.db.session import SessionLocal
from app.shared.users.models import User

PREFIX = "demo-"
DAYS = 21
STREAK_DAYS = 8                 # the last 8 days always have a session

# local hour -> chance the session is completed (evening is the hidden peak)
HOUR_SUCCESS = {9: 0.35, 10: 0.45, 14: 0.55, 15: 0.6, 16: 0.55, 20: 0.9, 21: 0.92}

# title, type, load, minutes, priority, deadline in days, planned start (days, local hour) or None
OPEN_TASKS = [
    ("Read DBMS chapter 5 notes", "reading", "low", 45, 2, 5, (0, 20)),
    ("SE assignment 2 - use case diagrams", "assignment", "medium", 90, 3, 4, (0, 21)),
    ("Machine learning past paper 2024", "exam_prep", "heavy", 120, 5, 7, (1, 20)),
]
DONE_TASKS = [
    ("OOP lab sheet 6", "assignment", "medium", 60, 3, -10),
    ("Statistics tutorial 4", "exam_prep", "heavy", 90, 4, -6),
    ("Review networking lecture 7", "lecture_review", "low", 30, 2, -2),
]


def demo_id() -> str:
    return PREFIX + str(uuid.uuid4())


def utc(local: datetime) -> datetime:
    """Sri Lanka local time -> UTC (the database stores UTC)."""
    return local - SL_OFFSET


def make_tasks(user, now_local: datetime) -> list[Task]:
    today = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    tasks = []
    for title, kind, load, minutes, prio, due_days, (start_day, start_hour) in OPEN_TASKS:
        tasks.append(Task(id=demo_id(), user_id=user.id, title=title, task_type=kind, cognitive_load=load,
                          estimated_minutes=minutes, priority=prio,
                          deadline=utc(today + timedelta(days=due_days, hours=23, minutes=59)),
                          scheduled_start=utc(today + timedelta(days=start_day, hours=start_hour))))
    for title, kind, load, minutes, prio, due_days in DONE_TASKS:
        deadline = utc(today + timedelta(days=due_days, hours=23, minutes=59))
        tasks.append(Task(id=demo_id(), user_id=user.id, title=title, task_type=kind, cognitive_load=load,
                          estimated_minutes=minutes, priority=prio, deadline=deadline, status="done",
                          actual_minutes=minutes, completed_at=deadline - timedelta(days=1),
                          created_at=deadline - timedelta(days=7)))
    return tasks


def make_sessions(user, tasks: list[Task], now_local: datetime, rng: random.Random) -> list[FocusSession]:
    today = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    heavy = [t for t in tasks if t.cognitive_load == "heavy"]
    sessions = []
    for back in range(DAYS, 0, -1):                      # yesterday is the last day (today stays free)
        day = today - timedelta(days=back)
        if back > STREAK_DAYS and rng.random() < 0.25:
            continue                                     # some days off before the streak
        hours = rng.sample(sorted(HOUR_SUCCESS), k=rng.choice([1, 2]))
        if back <= STREAK_DAYS and not any(h >= 20 for h in hours):
            hours.append(rng.choice([20, 21]))           # streak days: at least one good session
        for hour in sorted(hours):
            task = rng.choice(heavy) if hour >= 20 and rng.random() < 0.5 else rng.choice(tasks)
            planned = 45 if task.cognitive_load == "heavy" and hour >= 20 else 25
            done = rng.random() < HOUR_SUCCESS[hour]
            actual = planned if done else rng.randint(6, int(planned * 0.7))
            pauses = rng.randint(0, 1) if done else rng.randint(1, 3)
            paused = pauses * rng.randint(1, 3)
            start = utc(day + timedelta(hours=hour, minutes=rng.choice([0, 5, 10, 15])))
            sessions.append(FocusSession(
                id=demo_id(), user_id=user.id, task_id=task.id, started_at=start,
                ended_at=start + timedelta(minutes=actual + paused), planned_minutes=planned,
                actual_minutes=actual, break_minutes=5 if planned <= 30 else 10, completed=done,
                pause_count=pauses, paused_seconds=paused * 60, paused_minutes=paused,
                focus_rating=rng.randint(4, 5) if done else rng.randint(1, 3),
                task_load=task.cognitive_load, mode="adaptive"))
    return sessions


def make_xp(user, sessions: list[FocusSession]) -> list[RewardEvent]:
    return [RewardEvent(id=f"focus-{s.id}", user_id=user.id, kind="xp", label="Focus session completed",
                        amount=gamification.xp_for_focus(s.actual_minutes, s.task_load), created_at=s.ended_at)
            for s in sessions if s.completed]


def remove(db, user) -> None:
    """Delete only rows this script made (ids start with 'demo-')."""
    n_xp = (db.query(RewardEvent).filter(RewardEvent.user_id == user.id,
                                         RewardEvent.id.like(f"focus-{PREFIX}%"))
              .delete(synchronize_session=False))
    n_fs = (db.query(FocusSession).filter(FocusSession.user_id == user.id, FocusSession.id.like(f"{PREFIX}%"))
              .delete(synchronize_session=False))
    n_t = (db.query(Task).filter(Task.user_id == user.id, Task.id.like(f"{PREFIX}%"))
             .delete(synchronize_session=False))
    db.commit()
    print(f"Removed {n_t} tasks, {n_fs} focus sessions, {n_xp} XP rows. (Badges already earned stay.)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Add demo scheduler data for one student")
    parser.add_argument("--email", required=True, help="the student's login email")
    parser.add_argument("--apply", action="store_true", help="really add the data (default: only print)")
    parser.add_argument("--remove", action="store_true", help="delete the demo data again")
    parser.add_argument("--seed", type=int, default=7, help="random seed (same seed = same data)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email.strip().lower()).first()
        if user is None:
            print(f"No user with email {args.email}")
            return
        print(f"Student: {user.full_name} ({user.research_id})")

        if args.remove:
            remove(db, user)
            return
        if db.query(Task).filter(Task.user_id == user.id, Task.id.like(f"{PREFIX}%")).first():
            print("Demo data already exists. Run with --remove first if you want fresh data.")
            return

        rng = random.Random(args.seed)
        now_local = datetime.utcnow() + SL_OFFSET
        tasks = make_tasks(user, now_local)
        sessions = make_sessions(user, tasks, now_local, rng)
        xp = make_xp(user, sessions)

        done = sum(s.completed for s in sessions)
        print(f"  {len(tasks)} tasks ({len(OPEN_TASKS)} open, {len(DONE_TASKS)} done)")
        print(f"  {len(sessions)} focus sessions over {DAYS} days, {done} completed")
        for hour in sorted(HOUR_SUCCESS):
            at_hour = [s for s in sessions if (s.started_at + SL_OFFSET).hour == hour]
            if at_hour:
                rate = sum(s.completed for s in at_hour) / len(at_hour)
                print(f"    {hour:02d}:00  {len(at_hour):2d} sessions, {rate:.0%} completed")
        print(f"  {sum(x.amount for x in xp)} XP")

        if not args.apply:
            print("\nDry run: nothing saved. Run again with --apply to add it.")
            return
        db.add_all(tasks)
        db.flush()                                       # tasks first (sessions point to them)
        db.add_all(sessions + xp)
        db.commit()
        print("\nSaved. Open Progress once so the app gives the badges.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
