"""
MOVED to app/components/scheduler/tasks/commitment_service.py (one folder per part of the scheduler).
This old path still works for other components and branches: it is the SAME module, not a copy.
"""
import sys

from app.components.scheduler.tasks import commitment_service as _moved

sys.modules[__name__] = _moved
