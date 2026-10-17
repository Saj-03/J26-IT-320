"""Career milestones on the roadmap: built from the selected career's own data (faculty-relevant) and translated."""
import os

os.environ["ACRDS_USE_SBERT"] = "0"

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.components.career.router import router  # noqa: E402
from app.components.career.services import i18n  # noqa: E402
from app.components.career.services.career_data import get_career, load_careers  # noqa: E402
from app.components.career.services.roadmap import career_milestones  # noqa: E402

app = FastAPI()
app.include_router(router, prefix="/api/career")
client = TestClient(app)

SKILLS = {"digital_literacy": 2, "communication": 2, "problem_solving": 2, "leadership": 2, "teamwork": 2,
          "research": 2, "data_analysis": 2, "documentation": 2, "creativity": 2}


def profile(faculty, area, role):
    return {
        "academic_status": "3rd Year Undergraduate", "employment_status": "Student", "faculty_field": faculty,
        "degree_programme": "Degree", "academic_performance_trend": "Stable", "career_area_interest": area,
        "preferred_career_role": role, "career_confidence": 3, "previous_career_preference": "No",
        "preferred_learning_method": "Online courses", "skill_learning_consistency": "Weekly",
        "extracurricular_participation": "No", "career_related_work_status": "No",
        "career_support_needed": ["Career roadmap"], "skills": SKILLS,
    }


def roadmap(career_id, prof, lang="en"):
    response = client.post("/api/career/roadmap", params={"language": lang},
                           json={"career_id": career_id, "profile": prof})
    assert response.status_code == 200, response.text
    return response.json()


def test_every_career_gets_five_ordered_milestones_from_its_data():
    for career in load_careers():
        ms = career_milestones(career)
        assert [m["id"] for m in ms] == ["courses", "tools", "projects", "cert", "interview"], career["career_id"]
        by_id = {m["id"]: m for m in ms}
        assert by_id["courses"]["items"] == career["recommended_courses"]
        assert by_id["projects"]["items"] == career["recommended_projects"]
        assert by_id["tools"]["items"] == career["required_tools"]
        assert career["career_name"] in by_id["interview"]["description"]
        assert all(m["title"] and m["timeframe"] for m in ms)


def test_engineering_and_computing_roadmaps_differ():
    civil = roadmap("civil_engineer", profile("Engineering", "Civil/Construction Engineering", "Civil Engineer"))
    software = roadmap("software_engineer", profile("Computing", "Technology/Software", "Software Engineer"))
    civil_items = {i for m in civil["milestones"] for i in m["items"]}
    software_items = {i for m in software["milestones"] for i in m["items"]}
    assert "AutoCAD" in civil_items and "Git/GitHub" in software_items
    assert not civil_items & {"Git/GitHub", "Data Structures and Algorithms"}
    # the skill-gap activities still come first and reflect the gaps
    assert civil["roadmap"] and all(i["priority"] in {"High", "Medium"} for i in civil["roadmap"])


def test_milestones_are_translated_but_tool_names_stay_english():
    prof = profile("Engineering", "Civil/Construction Engineering", "Civil Engineer")
    en, si, ta = (roadmap("civil_engineer", prof, lang) for lang in ("en", "si", "ta"))
    for other in (si, ta):
        assert [m["id"] for m in other["milestones"]] == [m["id"] for m in en["milestones"]]
        assert other["milestones"][0]["title"] != en["milestones"][0]["title"]
        assert other["milestones"][0]["items"] != en["milestones"][0]["items"]  # courses translated
        assert other["milestones"][1]["items"] == en["milestones"][1]["items"]  # tools: product names
        assert other["roadmap"] == [] or [i["skill"] for i in other["roadmap"]] == [i["skill"] for i in en["roadmap"]]


def test_every_career_course_and_project_is_translated():
    for lang in ("si", "ta"):
        for career in load_careers():
            for field in ("recommended_courses", "recommended_projects"):
                translated = i18n.career_list(career, field, lang)
                assert len(translated) == len(career[field])
                assert translated != career[field], (lang, career["career_id"], field)


def test_missing_translation_falls_back_to_english():
    career = dict(get_career("software_engineer"), recommended_courses=["A", "B", "C", "D"])  # length changed
    assert i18n.career_list(career, "recommended_courses", "si") == ["A", "B", "C", "D"]
