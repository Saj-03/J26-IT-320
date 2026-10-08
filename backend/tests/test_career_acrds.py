"""Unit tests for the ACRDS MVP services (recommender, gap analysis, roadmap)."""
from app.components.career.services.career_data import get_career
from app.components.career.services.gap_analysis import analyse_gaps, gap_status
from app.components.career.services.recommender import cosine_similarity, recommend_careers
from app.components.career.services.roadmap import generate_roadmap

PROFILE = {
    "career_area_interest": "Technology/Software",
    "preferred_career_role": "Software Engineer",
    "highest_extracurricular_role": "Member",
    "career_related_work_status": "Currently following/working on one",
    "skills": {"digital_literacy": 4, "communication": 3, "problem_solving": 4, "leadership": 3,
               "teamwork": 4, "research": 3, "data_analysis": 2, "documentation": 3, "creativity": 3},
}


def test_cosine_similarity_basics():
    assert round(cosine_similarity([1, 2, 3], [2, 4, 6]), 6) == 1.0
    assert cosine_similarity([1, 0], [0, 1]) == 0.0


def test_top5_sorted_and_capped():
    recs = recommend_careers(PROFILE)
    scores = [r["match_percentage"] for r in recs]
    assert len(recs) == 5
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)
    assert recs[0]["career_id"] == "software_engineer"


def test_gap_status_rules():
    assert gap_status(-1) == "Strong" and gap_status(0) == "Strong"
    assert gap_status(1) == "Needs Improvement"
    assert gap_status(2) == "Critical Gap"


def test_gap_analysis_and_roadmap():
    gaps = analyse_gaps(PROFILE, get_career("software_engineer"))
    assert len(gaps["skill_gaps"]) == 9
    assert 0 < gaps["readiness_percentage"] <= 100
    items = generate_roadmap(gaps)
    weak = {g["skill"] for g in gaps["skill_gaps"] if g["status"] != "Strong"}
    assert {i["skill"] for i in items} == weak
    assert all(i["priority"] in ("High", "Medium") for i in items)
