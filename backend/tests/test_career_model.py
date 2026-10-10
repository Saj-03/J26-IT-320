"""Tests for the ACRDS trained-model pipeline: survey cleaning, features, and hybrid scoring."""
import pandas as pd

from app.components.career.services.career_features import (build_features, feature_names, role_level,
                                                            work_status_level)
from app.components.career.services.recommender import recommend_careers
from ml_training.career.prepare_survey_data import QUESTIONS, map_role, prepare

PROFILE = {
    "academic_status": "4th Year Undergraduate", "employment_status": "Intern/Trainee",
    "faculty_field": "Computing", "academic_performance_trend": "Stable", "career_confidence": 4,
    "previous_career_preference": "No", "preferred_learning_method": "Practising with projects",
    "skill_learning_consistency": "Weekly", "extracurricular_participation": "Yes",
    "extracurricular_type": "Sports, Technical communities", "highest_extracurricular_role": "Member, Team leader",
    "career_related_work_status": "Currently following/working on one",
    "career_related_work_type": "Academic project, Personal project",
    "career_support_needed": ["Career roadmap", "Interview practice"],
    "career_area_interest": "Technology/Software", "preferred_career_role": "Software Engineer",
    "skills": {"digital_literacy": 4, "communication": 3, "problem_solving": 4, "leadership": 3,
               "teamwork": 4, "research": 3, "data_analysis": 2, "documentation": 3, "creativity": 3},
}


def test_role_mapping():
    assert map_role("Software Engineer") == ("software", "software_engineer")
    assert map_role("SOC analyst") == ("cybersecurity", "cybersecurity_analyst")
    assert map_role("Data Engineer") == ("data", None)
    assert map_role("ui/ux designer") == ("design", "ui_ux_designer")
    assert map_role("Accountant") == ("business", None)
    assert map_role("Nurse") == ("other", None)
    assert map_role("Still not sure") == (None, None)


def test_feature_vector_matches_names():
    features = build_features(PROFILE)
    names = feature_names()
    assert len(features) == len(names)
    assert features[names.index("faculty_computing")] == 1.0
    assert features[names.index("extra_technical_communities")] == 1.0
    assert features[names.index("academic_year")] == 4.0


def test_ordinal_helpers():
    assert role_level("Member, Team leader") == 4 and role_level("") == 0
    assert work_status_level("Yes") == 3 and work_status_level("No") == 0


def test_bulk_duplicates_are_removed():
    row = {q: "x" for q in QUESTIONS.values()}
    for q in QUESTIONS.values():
        if q.startswith("["):
            row[q] = 3
    row[QUESTIONS["career_confidence"]] = 3
    row[QUESTIONS["preferred_career_role"]] = "Software Engineer"
    genuine = {**row, QUESTIONS["skill_creativity"]: 5}
    clean, stats = prepare(pd.DataFrame([row] * 5 + [genuine]))
    assert stats["bulk_duplicate_rows"] == 5 and len(clean) == 1
    assert clean.iloc[0]["label_family"] == "software"


def test_recommendations_work_with_or_without_trained_model():
    recs = recommend_careers(PROFILE)
    scores = [r["match_percentage"] for r in recs]
    assert len(recs) == 5 and scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 100 for s in scores)
