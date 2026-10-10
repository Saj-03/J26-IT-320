"""
Interview question bank (data/interview_questions.json).

Each practice session has 5 questions:
  1 introduction + 3 career-specific technical + 1 behavioural (STAR).
`variant` rotates the questions so students can practise again with a
different (but still deterministic) set.
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "interview_questions.json"
TECHNICAL_PER_SESSION = 3


@lru_cache
def _bank() -> dict:
    with DATA_FILE.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def _index() -> dict:
    """question_id -> question dict (with its category)."""
    bank = _bank()
    index = {}
    for q in bank["general"]["introduction"]:
        index[q["id"]] = {**q, "category": "Introduction"}
    for q in bank["general"]["behavioural"]:
        index[q["id"]] = {**q, "category": "Behavioural"}
    for questions in bank["careers"].values():
        for q in questions:
            index[q["id"]] = {**q, "category": "Technical"}
    return index


def get_question(question_id: str) -> Optional[dict]:
    return _index().get(question_id)


def has_questions(career_id: str) -> bool:
    return career_id in _bank()["careers"]


def public_view(question: dict) -> dict:
    """What the student sees before answering (no model answer or keywords)."""
    return {"id": question["id"], "category": question["category"],
            "question": question["question"], "tip": question["tip"]}


def select_questions(career_id: str, variant: int = 0) -> list[dict]:
    bank = _bank()
    intro = bank["general"]["introduction"]
    behavioural = bank["general"]["behavioural"]
    technical = bank["careers"][career_id]

    # Rotate technical questions by variant, then take the first 3.
    start = variant % len(technical)
    rotated = technical[start:] + technical[:start]

    chosen_ids = ([intro[variant % len(intro)]["id"]]
                  + [q["id"] for q in rotated[:TECHNICAL_PER_SESSION]]
                  + [behavioural[variant % len(behavioural)]["id"]])
    return [public_view(get_question(qid)) for qid in chosen_ids]
