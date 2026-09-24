from datetime import datetime, timedelta
from app.components.physical_wellbeing.models import Habit


def mark_habit_done(db, habit: Habit) -> Habit:
    now = datetime.utcnow()
    if habit.last_done and now - habit.last_done < timedelta(hours=36):
        habit.streak += 1
    else:
        habit.streak = 1
    habit.last_done = now
    db.commit(); db.refresh(habit)
    return habit


def badge_for(streak: int) -> str | None:
    return {3: "Bronze", 7: "Silver", 21: "Gold"}.get(streak)
