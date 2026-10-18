"""Career Fit Quiz: content is complete, answers are hidden until checked, fit = 50/30/20, the ranking is untouched."""
import os

os.environ["ACRDS_USE_SBERT"] = "0"

import pytest  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.components.career.router import router  # noqa: E402
from app.components.career.services import fit_quiz, i18n  # noqa: E402
from app.components.career.services.career_data import get_career, load_careers  # noqa: E402

app = FastAPI()
app.include_router(router, prefix="/api/career")
client = TestClient(app)

TOP5 = ["software_engineer", "data_analyst", "qa_engineer", "ui_ux_designer", "business_analyst"]
# investigative x3, conventional x2, enterprising x1
INTERESTS = {"fq_i1": "b", "fq_i2": "c", "fq_i3": "c", "fq_i4": "a", "fq_i5": "c", "fq_i6": "a"}


def scenarios_for(ids, option=None, enjoyment=1):
    out = []
    for cid in ids:
        s = fit_quiz.scenario_for(cid)
        best = s["points"].index(10)
        out.append({"career_id": cid, "question_id": s["id"], "option": best if option is None else option,
                    "enjoyment": enjoyment})
    return out


def test_every_career_has_scenarios_and_an_onet_interest_profile():
    for career in load_careers():
        cid = career["career_id"]
        assert fit_quiz.has_quiz(cid), cid
        items = fit_quiz._quiz()["scenarios"][cid]
        assert len(items) == 3
        for s in items:
            assert len(s["options"]) == len(s["points"]) == 3, s["id"]
            assert s["points"].count(10) == 1 and min(s["points"]) == 0, s["id"]
            assert s["why"] and s["skill"] in i18n._content("si")["skills"], s["id"]
        assert set(fit_quiz.career_riasec(cid)) == set(fit_quiz.RIASEC)


def test_interest_options_cover_each_riasec_type_equally():
    types = [o["type"] for q in fit_quiz._quiz()["interest_questions"] for o in q["options"]]
    assert {t: types.count(t) for t in fit_quiz.RIASEC} == dict.fromkeys(fit_quiz.RIASEC, 3)


def test_best_answer_position_is_spread_so_it_cannot_be_guessed():
    positions = [s["points"].index(10) for items in fit_quiz._quiz()["scenarios"].values() for s in items]
    assert {p: positions.count(p) for p in range(3)} == {0: 29, 1: 29, 2: 29}


def test_quiz_hides_points_and_explanations():
    r = client.get("/api/career/fit-quiz", params={"career_ids": ",".join(TOP5)})
    assert r.status_code == 200
    body = r.json()
    assert len(body["interest_questions"]) == 6 and [s["career_id"] for s in body["scenarios"]] == TOP5
    text = str(body)
    assert "points" not in text and "'why'" not in text and "'type'" not in text


def test_variant_rotates_the_scenario():
    a = client.get("/api/career/fit-quiz", params={"career_ids": "teacher", "variant": 0}).json()["scenarios"][0]["id"]
    b = client.get("/api/career/fit-quiz", params={"career_ids": "teacher", "variant": 1}).json()["scenarios"][0]["id"]
    assert a != b


def test_check_gives_points_best_option_and_why():
    s = fit_quiz.scenario_for("software_engineer")
    best = s["points"].index(10)
    worst = s["points"].index(0)
    good = client.post("/api/career/fit-quiz/check", json={"question_id": s["id"], "option": best}).json()
    bad = client.post("/api/career/fit-quiz/check", json={"question_id": s["id"], "option": worst}).json()
    assert good["result"] == "best" and good["points"] == 10
    assert bad["result"] == "miss" and bad["points"] == 0 and bad["best_option"] == best and bad["why"]
    assert client.post("/api/career/fit-quiz/check", json={"question_id": "nope", "option": 0}).status_code == 404
    assert client.post("/api/career/fit-quiz/check", json={"question_id": s["id"], "option": 4}).status_code == 422


def test_fit_formula_and_interest_profile():
    profile = fit_quiz.interest_profile(INTERESTS)
    assert profile == {"R": 0, "I": 3, "A": 0, "S": 0, "E": 1, "C": 2}
    interest = fit_quiz.interest_match(profile, "qa_engineer")
    assert fit_quiz.fit_score(interest, 2, 10) == pytest.approx(0.5 * interest + 30 + 20)
    assert fit_quiz.fit_score(interest, 0, 0) == pytest.approx(0.5 * interest)


def test_investigative_student_fits_analytical_careers_better_than_design():
    body = client.post("/api/career/fit-quiz/score",
                       json={"interests": INTERESTS, "scenarios": scenarios_for(TOP5)}).json()
    fits = {r["career_id"]: r["interest_match"] for r in body["results"]}
    assert min(fits["qa_engineer"], fits["software_engineer"], fits["data_analyst"]) > fits["ui_ux_designer"]
    assert body["top_types"] == ["I", "C"]
    assert [r["rank"] for r in body["results"]] == [1, 2, 3, 4, 5]
    assert body["best_fit_career_id"] == body["results"][0]["career_id"]


def test_enjoyment_changes_the_best_fit():
    answers = scenarios_for(TOP5)
    answers[3]["enjoyment"] = 2  # loves the UI/UX scenario; the others are "maybe"
    answers = [dict(a, enjoyment=0) if i != 3 else a for i, a in enumerate(answers)]
    body = client.post("/api/career/fit-quiz/score", json={"interests": INTERESTS, "scenarios": answers}).json()
    assert body["best_fit_career_id"] == "ui_ux_designer"


def test_ties_keep_the_recommended_order():
    flat = {"fq_i1": "a", "fq_i2": "a", "fq_i3": "c", "fq_i4": "a", "fq_i5": "c", "fq_i6": "b"}  # R S C I E A
    assert set(fit_quiz.interest_profile(flat).values()) == {1}  # no preference -> every interest match is 50
    order = ["teacher", "civil_engineer", "graphic_designer"]
    body = client.post("/api/career/fit-quiz/score", json={"interests": flat, "scenarios": scenarios_for(order)}).json()
    assert [r["career_id"] for r in body["results"]] == order


def test_score_rejects_bad_answers():
    s = scenarios_for(TOP5)
    missing = dict(INTERESTS)
    missing.pop("fq_i6")
    assert client.post("/api/career/fit-quiz/score", json={"interests": missing, "scenarios": s}).status_code == 422
    wrong = [dict(s[0], career_id="data_analyst")]  # software scenario sent for another career
    assert client.post("/api/career/fit-quiz/score", json={"interests": INTERESTS, "scenarios": wrong}).status_code == 422
    twice = [s[0], s[0]]
    assert client.post("/api/career/fit-quiz/score", json={"interests": INTERESTS, "scenarios": twice}).status_code == 422
    bad_opt = dict(INTERESTS, fq_i1="z")
    assert client.post("/api/career/fit-quiz/score", json={"interests": bad_opt, "scenarios": s}).status_code == 422
    assert client.get("/api/career/fit-quiz", params={"career_ids": "nope"}).status_code == 404
    assert client.get("/api/career/fit-quiz", params={"career_ids": ",".join(TOP5 + ["teacher"])}).status_code == 422


@pytest.mark.parametrize("lang", ["si", "ta"])
def test_translations_are_complete_and_never_change_the_fit(lang):
    content = i18n._content(lang)
    for q in fit_quiz._quiz()["interest_questions"]:
        tr = content["fit_interest"][q["id"]]
        assert tr["question"] and set(tr["options"]) == {o["id"] for o in q["options"]}
    for items in fit_quiz._quiz()["scenarios"].values():
        for s in items:
            tr = content["fit_scenarios"][s["id"]]
            assert tr["scenario"] and tr["why"] and len(tr["options"]) == 3, s["id"]
    en = client.post("/api/career/fit-quiz/score", json={"interests": INTERESTS, "scenarios": scenarios_for(TOP5)}).json()
    other = client.post("/api/career/fit-quiz/score", params={"language": lang},
                        json={"interests": INTERESTS, "scenarios": scenarios_for(TOP5)}).json()
    assert [(r["career_id"], r["fit"]) for r in en["results"]] == [(r["career_id"], r["fit"]) for r in other["results"]]
    assert other["results"][0]["career_name"] == i18n.career_field(get_career(other["results"][0]["career_id"]),
                                                                   "career_name", lang)
