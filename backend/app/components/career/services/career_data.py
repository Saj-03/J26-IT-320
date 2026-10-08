"""Loads the career requirement dataset (data/career_requirements.json)."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "career_requirements.json"


@lru_cache
def load_careers() -> tuple:
    """Read once and cache. Returned as a tuple so callers cannot mutate the cache."""
    with DATA_FILE.open(encoding="utf-8") as f:
        return tuple(json.load(f))


def get_career(career_id: str) -> Optional[dict]:
    return next((c for c in load_careers() if c["career_id"] == career_id), None)


def skill_label(skill_key: str) -> str:
    """'data_analysis' -> 'data analysis' (for student-friendly text)."""
    return skill_key.replace("_", " ")
