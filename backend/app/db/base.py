"""Import every model here so Alembic can see all tables."""
from app.db.session import Base  # noqa
from app.shared.users.models import User  # noqa
from app.shared.integration.models import SignalEvent  # noqa
from app.components.career.models import CareerProfile, InterviewSession  # noqa
from app.components.physical_wellbeing.models import WellbeingProfile, ActivityLog, Habit  # noqa
from app.components.scheduler.models import Task, FocusSession, ScheduleChange, RewardEvent  # noqa
from app.components.burnout.models import JournalEntry, ChatMessage, MoodTap, WellbeingSignal  # noqa
