"""
Other components / branches still import the scheduler by its OLD paths (develop, Burnout, Career, Nilu):
    from app.components.scheduler.task_service import audit
    from app.components.scheduler.commitment_service import SL_OFFSET
    from app.components.scheduler.models / router / settings_service ...
These must keep working after the scheduler was split into folders - and give the SAME objects,
so a monkeypatch or a setting on one is seen by the other.
"""
from app.components.scheduler.tasks import commitment_service, task_service


def test_old_paths_are_the_same_modules():
    from app.components.scheduler.commitment_service import SL_OFFSET
    from app.components.scheduler.task_service import audit
    from app.components.scheduler import commitment_service as old_cs, task_service as old_ts
    assert old_ts is task_service and old_cs is commitment_service
    assert audit is task_service.audit and SL_OFFSET is commitment_service.SL_OFFSET


def test_paths_other_branches_use_still_exist():
    from app.components.scheduler.models import FocusSession, RewardEvent, ScheduleChange, Task  # noqa: F401
    from app.components.scheduler.router import router  # noqa: F401
    from app.components.scheduler.settings_service import get_settings  # noqa: F401
