"""Sinhala / Tamil support: only the text changes - scores, rankings and gaps stay identical."""
import json
import os

os.environ["ACRDS_USE_SBERT"] = "0"

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.components.career.router import router  # noqa: E402
from app.components.career.services import i18n  # noqa: E402
from app.components.career.services.career_data import load_careers  # noqa: E402
from app.components.career.services.interview_questions import DATA_FILE  # noqa: E402
from app.components.career.services.llm_feedback import build_prompt  # noqa: E402
from app.components.career.services.roadmap import SKILL_PLANS  # noqa: E402

app = FastAPI()
app.include_router(router, prefix="/api/career")
client = TestClient(app)

PROFILE = {
    "academic_status": "3rd Year Undergraduate", "employment_status": "Intern/Trainee", "faculty_field": "Computing",
    "degree_programme": "IT", "academic_performance_trend": "Stable", "career_area_interest": "Technology/Software",
    "preferred_career_role": "Software Engineer", "career_confidence": 3, "previous_career_preference": "No",
    "preferred_learning_method": "Online courses", "skill_learning_consistency": "Weekly",
    "extracurricular_participation": "Yes", "extracurricular_type": "Sports", "highest_extracurricular_role": "Team leader",
    "career_related_work_status": "Yes", "career_related_work_type": "Academic project",
    "career_support_needed": ["Career roadmap"],
    "skills": {"digital_literacy": 4, "communication": 3, "problem_solving": 3, "leadership": 2, "teamwork": 4,
               "research": 3, "data_analysis": 2, "documentation": 2, "creativity": 3},
}


def _post(path, body, lang):
    response = client.post(f"/api/career/{path}", params={"language": lang}, json=body)
    assert response.status_code == 200, response.text
    return response.json()


def test_language_changes_text_but_not_scores_or_order():
    en = _post("recommend-careers", PROFILE, "en")
    for lang in ("si", "ta"):
        other = _post("recommend-careers", PROFILE, lang)
        assert [r["career_id"] for r in other["recommendations"]] == [r["career_id"] for r in en["recommendations"]]
        assert [r["match_percentage"] for r in other["recommendations"]] == [r["match_percentage"] for r in en["recommendations"]]
        first, first_en = other["recommendations"][0], en["recommendations"][0]
        assert first["career_name"] != first_en["career_name"]
        assert first["explanation"] != first_en["explanation"]
        assert first["matching_skills"] == first_en["matching_skills"]  # skill keys stay English codes
        assert other["persona"]["average_skill_level"] == en["persona"]["average_skill_level"]


def test_gap_and_roadmap_keep_english_codes():
    body = {"profile": PROFILE, "career_id": "software_engineer"}
    gap_en, gap_si = _post("gap-analysis", body, "en"), _post("gap-analysis", body, "si")
    assert gap_si["readiness_percentage"] == gap_en["readiness_percentage"]
    assert [g["status"] for g in gap_si["skill_gaps"]] == [g["status"] for g in gap_en["skill_gaps"]]
    road_ta = _post("roadmap", body, "ta")
    assert {i["priority"] for i in road_ta["roadmap"]} <= {"High", "Medium"}
    assert "வாரங்கள்" in road_ta["roadmap"][0]["estimated_time"]


def test_questions_show_translation_and_english_original():
    data = client.get("/api/career/interview/questions/teacher", params={"language": "si"}).json()
    for q in data["questions"]:
        assert q["question_en"] and q["question"] != q["question_en"]
    assert data["privacy_notes"][0] != i18n.t("en", "privacy_1")


def test_feedback_is_translated_and_scores_identical():
    body = {"career_id": "software_engineer", "question_id": "se_3", "mode": "voice", "speaking_seconds": 20,
            "answer_text": "I use branches and commits, um, and open a pull request for review.", "use_llm": False}
    en, ta = _post("interview/evaluate", body, "en"), _post("interview/evaluate", body, "ta")
    assert ta["overall_score"] == en["overall_score"]
    assert ta["improvements"] != en["improvements"] and ta["sample_answer"] == en["sample_answer"]


def test_unknown_language_is_rejected():
    response = client.post("/api/career/recommend-careers", params={"language": "fr"}, json=PROFILE)
    assert response.status_code == 422


def test_every_career_question_and_plan_is_translated():
    bank = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    question_ids = [q["id"] for qs in bank["careers"].values() for q in qs]
    question_ids += [q["id"] for qs in bank["general"].values() for q in qs]
    for lang in ("si", "ta"):
        content = i18n._content(lang)
        for career in load_careers():
            assert career["career_id"] in content["careers"], (lang, career["career_id"])
            assert career["career_area"] in content["values"], (lang, career["career_area"])
        assert set(question_ids) <= set(content["questions"]), lang
        assert set(SKILL_PLANS) <= set(content["plans"]), lang
        assert set(i18n.TEXT[lang]) == set(i18n.TEXT["en"]), lang  # same template keys in every language


def test_llm_is_asked_to_answer_in_the_chosen_language():
    question = {"category": "Technical", "question": "Q?", "model_answer": "A."}
    result = {"overall_score": 50, "content": {"score": 50, "semantic_similarity": 40, "matched_keywords": [],
                                              "missing_keywords": [], "word_count": 30}}
    assert "Sinhala" in build_prompt(question, "answer", result, "si")
    assert "Sinhala" not in build_prompt(question, "answer", result, "en")
