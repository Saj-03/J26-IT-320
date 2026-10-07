"""Mock payloads so each member can develop before live integration (Months 2-5)."""
import random
import uuid
from datetime import datetime, timezone


def mock_risk_signal(student_id: str, level: str = "HIGH") -> dict:
    score = {"LOW": 0.2, "MODERATE": 0.5, "HIGH": 0.78}[level]
    return {"schema_version": "1.0", "event_id": str(uuid.uuid4()), "student_id": student_id,
            "risk_score": score, "risk_level": level, "trend": "RISING",
            "timestamp": datetime.now(timezone.utc).isoformat()}


def mock_deviation_signal(student_id: str, bad_week: bool = False, seed: int | None = None) -> dict:
    """Matches contracts.DeviationSignal (raw weekly behaviour features from the Scheduler).
    seed adds small deterministic week-to-week variation (identical weeks give the Isolation Forest nothing to learn)."""
    j = random.Random(seed) if seed is not None else None
    d = (lambda a: round(j.uniform(-a, a), 2)) if j else (lambda a: 0)
    return {"schema_version": "1.0", "event_id": str(uuid.uuid4()), "student_id": student_id,
            "week_start": datetime.now(timezone.utc).isoformat(),
            "task_completion_rate": round(min(1, max(0, (0.35 if bad_week else 0.85) + d(0.06))), 2),
            "missed_sessions": max(0, (6 if bad_week else 1) + (j.randint(-1, 1) if j else 0)),
            "task_load": max(0, (14 if bad_week else 6) + (j.randint(-1, 1) if j else 0)),
            "deadline_density": round(min(1, max(0, (0.8 if bad_week else 0.2) + d(0.06))), 2),
            "semester_phase": "exam_period" if bad_week else "mid_semester",
            "timestamp": datetime.now(timezone.utc).isoformat()}


def mock_recovery_signal(student_id: str, mode: bool = True, severity: str = "MODERATE") -> dict:
    return {"schema_version": "1.0", "event_id": str(uuid.uuid4()), "student_id": student_id,
            "recovery_mode": mode, "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat()}
