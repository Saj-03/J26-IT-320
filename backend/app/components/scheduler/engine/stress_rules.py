"""
PILLAR 3 - Stress-responsive adaptation using Component 4 risk signal.
Safety rules from the proposal:
 * urgent tasks (inside URGENT_DEADLINE_WINDOW) are NEVER deferred
 * changes are only PROPOSED - student accepts/edits/rejects
 * stale or missing signal -> no change (fallback to normal scheduler)
"""
from datetime import datetime, timedelta
from app.core.config import settings


def propose_changes(tasks, risk_level: str | None, now: datetime) -> dict:
    if risk_level not in ("MODERATE", "HIGH"):
        return {"reason": "No elevated risk - normal schedule kept", "changes": []}

    urgent_until = now + timedelta(hours=settings.URGENT_DEADLINE_WINDOW_HOURS)
    changes = []
    for t in tasks:
        if t.status != "pending" or t.deadline <= urgent_until:
            continue                                   # protect urgent deadlines
        if t.cognitive_load == "heavy":
            changes.append({"task_id": t.id, "action": "split", "why": "heavy task during elevated stress"})
        elif risk_level == "HIGH" and t.priority <= 2:
            changes.append({"task_id": t.id, "action": "defer_1_day", "why": "low priority, not urgent"})
    if risk_level == "HIGH":
        changes.append({"task_id": None, "action": "insert_recovery_block", "minutes": 30})
    return {"reason": f"Burnout risk is {risk_level}", "changes": changes}
