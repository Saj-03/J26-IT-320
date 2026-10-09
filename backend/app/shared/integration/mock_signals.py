"""Mock payloads so each member can develop before live integration (Months 2-5)."""
import uuid
from datetime import datetime, timezone


def mock_risk_signal(student_id: str, level: str = "HIGH") -> dict:
    score = {"LOW": 0.2, "MODERATE": 0.5, "HIGH": 0.78}[level]
    return {"schema_version": "1.0", "event_id": str(uuid.uuid4()), "student_id": student_id,
            "risk_score": score, "risk_level": level, "trend": "RISING",
            "timestamp": datetime.now(timezone.utc).isoformat()}
