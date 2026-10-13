"""Faculty-based careers: data integrity, faculty filter, preferred-role inclusion, interview sessions."""
from app.components.career.schemas import SKILL_KEYS
from app.components.career.services.career_data import load_careers
from app.components.career.services.career_features import CAREER_FAMILY, FAMILY_CAREERS
from app.components.career.services.interview_questions import select_questions
from app.components.career.services.recommender import recommend_careers

ORIGINAL_IDS = {"software_engineer", "data_analyst", "business_analyst", "ui_ux_designer", "qa_engineer",
                "cybersecurity_analyst", "network_engineer", "database_administrator", "project_manager",
                "digital_marketing_executive"}

BASE = {
    "academic_status": "3rd Year Undergraduate", "employment_status": "Unemployed",
    "academic_performance_trend": "Stable", "career_confidence": 3, "previous_career_preference": "No",
    "preferred_learning_method": "Practising with projects", "skill_learning_consistency": "Weekly",
    "extracurricular_participation": "No", "extracurricular_type": "", "highest_extracurricular_role": "",
    "career_related_work_status": "No", "career_related_work_type": "", "career_support_needed": [],
    "career_area_interest": "Not sure yet", "preferred_career_role": "Not sure yet",
    "skills": {"digital_literacy": 4, "communication": 4, "problem_solving": 3, "leadership": 2, "teamwork": 3,
               "research": 4, "data_analysis": 3, "documentation": 4, "creativity": 2},
}


def test_original_careers_kept_and_every_career_is_complete():
    careers = load_careers()
    ids = [c["career_id"] for c in careers]
    assert ORIGINAL_IDS <= set(ids) and len(ids) == len(set(ids))
    for c in careers:
        assert set(c["required_skills"]) == set(SKILL_KEYS)
        assert all(1 <= v <= 5 for v in c["required_skills"].values())
        assert c["faculties"] and c["career_id"] in CAREER_FAMILY  # every career has a model family


def test_families_are_unchanged_for_the_trained_model():
    assert set(FAMILY_CAREERS) == {"software", "data", "cybersecurity", "business", "design", "other"}


def test_law_student_gets_law_careers_first():
    recs = recommend_careers({**BASE, "faculty_field": "Law"})
    law = [r["career_id"] for r in recs if r["faculty_match"]]
    assert {"legal_assistant", "compliance_officer"} <= set(law)
    assert recs[:len(law)] == [r for r in recs if r["faculty_match"]]  # faculty careers come before fillers


def test_preferred_role_is_always_in_top5():
    recs = recommend_careers({**BASE, "faculty_field": "Engineering", "preferred_career_role": "Electronics Engineer"})
    assert "electrical_engineer" in [r["career_id"] for r in recs]
    recs = recommend_careers({**BASE, "faculty_field": "Computing", "preferred_career_role": "Database Administrator"})
    assert "database_administrator" in [r["career_id"] for r in recs]


def test_no_faculty_keeps_old_behaviour():
    recs = recommend_careers(BASE)
    assert len(recs) == 5 and all(r["faculty_match"] for r in recs)


def test_every_career_gets_a_five_question_interview():
    for career in load_careers():
        questions = select_questions(career["career_id"])
        assert len(questions) == 5 and len({q["id"] for q in questions}) == 5
    assert len(select_questions("career_without_questions")) == 4  # general questions only, no crash


COMPUTING_ONLY = {"software_engineer", "qa_engineer", "cybersecurity_analyst", "network_engineer", "database_administrator"}


def test_engineering_student_gets_no_computing_careers():
    recs = recommend_careers({**BASE, "faculty_field": "Engineering", "career_area_interest": "Civil/Construction Engineering",
                              "preferred_career_role": "Civil Engineer"})
    ids = [r["career_id"] for r in recs]
    assert not COMPUTING_ONLY & set(ids)
    assert {"civil_engineer", "mechanical_engineer", "electrical_engineer"} <= set(ids)


def test_fillers_are_only_cross_disciplinary_and_ranked_last():
    careers = {c["career_id"]: c for c in load_careers()}
    for faculty in ("Law", "Education", "Engineering"):
        recs = recommend_careers({**BASE, "faculty_field": faculty})
        fillers = [r for r in recs if not r["faculty_match"]]
        assert all(careers[r["career_id"]]["cross_disciplinary"] for r in fillers)
        assert recs[len(recs) - len(fillers):] == fillers


def test_five_faculty_careers_means_no_fillers():
    recs = recommend_careers({**BASE, "faculty_field": "Business/Management"})
    assert all(r["faculty_match"] for r in recs)


def test_model_only_used_inside_its_training_domain():
    from app.components.career.services.career_model import model_applies
    from app.components.career.services import career_model
    career_model.load_bundle.cache_clear()
    fake = {"faculty_counts": {"Computing": 54, "Law": 1}}
    original = career_model.load_bundle
    career_model.load_bundle = lambda: fake
    try:
        assert model_applies({"faculty_field": "Computing"})
        assert not model_applies({"faculty_field": "Law"})
        assert model_applies({"faculty_field": ""})  # old clients without a faculty
    finally:
        career_model.load_bundle = original
