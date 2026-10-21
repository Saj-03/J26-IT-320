"""
MOVED to app/components/scheduler/tasks/task_service.py (one folder per part of the scheduler).
This old path still works for other components and branches: it is the SAME module, not a copy.
"""
import sys

from app.components.scheduler.tasks import task_service as _moved

sys.modules[__name__] = _moved
