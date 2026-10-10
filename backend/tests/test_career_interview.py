"""Unit tests for the ACRDS AI Interview Simulator (TF-IDF fallback for fast, deterministic tests)."""
import os

os.environ["ACRDS_USE_SBERT"] = "0"

from app.components.career.services.interview_evaluator import (  # noqa: E402
    build_report, evaluate_answer, keyword_coverage, star_structure,
)
from app.components.career.services.interview_questions import get_question, select_questions  # noqa: E402

GOOD = ("The four principles are encapsulation, inheritance, polymorphism and abstraction. Encapsulation hides "
        "the data of a class behind methods. Inheritance lets a child class reuse a parent class. Polymorphism "
        "means one method behaves differently, like overriding. Abstraction shows only essential features "
        "using an interface or abstract class.")
WEAK = "OOP is about objects. I used it in Java for my project."


def test_session_has_five_questions_and_variants_differ():
    first = select_questions("software_engineer", 0)
    second = select_questions("software_engineer", 1)
    assert [q["category"] for q in first] == ["Introduction", "Technical", "Technical", "Technical", "Behavioural"]
    assert [q["id"] for q in first] != [q["id"] for q in second]
    assert "model_answer" not in first[0]  # answers are hidden before answering


def test_keyword_alternatives_and_stemming():
    ratio, matched, _ = keyword_coverage("We normalize tables and use a primary key", ["normalisation|normalization", "primary key"])
    assert ratio == 1.0 and matched == ["normalisation", "primary key"]


def test_good_answer_scores_higher_than_weak():
    q = get_question("se_1")
    assert evaluate_answer(q, GOOD)["overall_score"] > evaluate_answer(q, WEAK)["overall_score"] + 30


def test_star_detection():
    s = star_structure("During my project my task was to fix bugs. I decided to add tests. As a result errors reduced.")
    assert all(s[p] for p in ("situation", "task", "action", "result"))


def test_voice_and_camera_scores_only_when_provided():
    q = get_question("se_1")
    text_only = evaluate_answer(q, GOOD)
    assert text_only["delivery"] is None and text_only["presentation"] is None
    full = evaluate_answer(q, GOOD, mode="voice", speaking_seconds=25,
                           face_presence_ratio=1.0, facing_camera_ratio=0.9, frames_analyzed=100)
    assert full["delivery"]["words_per_minute"] > 0 and full["presentation"]["score"] == 95.0


def test_report_summary():
    report = build_report("Software Engineer", [
        {"category": "Technical", "overall_score": 80, "content_score": 80, "improvements": ["a"]},
        {"category": "Behavioural", "overall_score": 60, "content_score": 60, "improvements": ["a", "b"]},
    ])
    assert report["overall_score"] == 70 and report["focus_tips"][0] == "a"
    assert report["dimension_scores"]["delivery"] is None
