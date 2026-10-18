"""
Career Fit Quiz - a short, game-style questionnaire shown after the top 5 careers.
It helps the student choose ONE of their 5 recommended careers; the trained ranking is never changed.

Round 1 - "What do you enjoy?": 6 questions. Every option is one Holland RIASEC interest type
          (Realistic, Investigative, Artistic, Social, Enterprising, Conventional), each type 3 times,
          so the student's interest profile is a count from 0 to 3 per type.
Round 2 - "A day in the job": one real-work scenario per recommended career. The student picks an
          action (10 best / 5 reasonable / 0 weak, with an explanation) and says how much they would
          enjoy that work (0 not for me, 1 maybe, 2 love it).

Fit % for each of the 5 careers:
    fit = 50% interest match + 30% enjoyment + 20% scenario judgement
    interest match = adjusted cosine (same formula as the recommender) between the student's RIASEC
                     counts and the career's O*NET 30.2 interest profile (data/career_interests.json)

VIVA: "Interest match uses O*NET's own interest profiles, so it is grounded in the same official job
database as the skill requirements. The quiz only advises - the student still chooses."
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Optional

from app.components.career.services import i18n
from app.components.career.services.recommender import adjusted_cosine_percentage

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RIASEC = ["R", "I", "A", "S", "E", "C"]
WEIGHTS = {"interest": 0.5, "enjoyment": 0.3, "scenario": 0.2}
ENJOYMENT_SCORE = {0: 0, 1: 50, 2: 100}
MAX_POINTS = 10


@lru_cache
def _quiz() -> dict:
    return json.loads((DATA_DIR / "career_fit_quiz.json").read_text(encoding="utf-8"))


@lru_cache
def _interests() -> dict:
    return json.loads((DATA_DIR / "career_interests.json").read_text(encoding="utf-8"))["careers"]


@lru_cache
def _scenario_index() -> dict:
    """scenario id -> scenario (with its career_id)."""
    return {s["id"]: {**s, "career_id": career}
            for career, items in _quiz()["scenarios"].items() for s in items}


def has_quiz(career_id: str) -> bool:
    return career_id in _quiz()["scenarios"] and career_id in _interests()


def career_riasec(career_id: str) -> dict:
    return _interests()[career_id]["riasec"]


def interest_questions(lang: str = "en") -> list[dict]:
    """Round 1 as the student sees it (the option's RIASEC type is not shown)."""
    out = []
    for q in _quiz()["interest_questions"]:
        tr = i18n.fit_interest(q["id"], lang)
        out.append({"id": q["id"], "question": tr.get("question") or q["question"],
                    "options": [{"id": o["id"], "text": (tr.get("options") or {}).get(o["id"]) or o["text"]}
                                for o in q["options"]]})
    return out


def scenario_for(career_id: str, variant: int = 0) -> dict:
    items = _quiz()["scenarios"][career_id]
    return items[variant % len(items)]


def public_scenario(scenario: dict, career: dict, lang: str = "en") -> dict:
    """Round 2 card without the points or the explanation."""
    tr = i18n.fit_scenario(scenario["id"], scenario, lang)
    return {"id": scenario["id"], "career_id": career["career_id"],
            "career_name": i18n.career_field(career, "career_name", lang),
            "skill": scenario["skill"], "skill_label": i18n.skill(scenario["skill"], lang),
            "scenario": tr["scenario"], "options": tr["options"]}


def check_answer(scenario_id: str, option: int, lang: str = "en") -> Optional[dict]:
    """Instant feedback for one scenario answer. None if the scenario does not exist."""
    scenario = _scenario_index().get(scenario_id)
    if not scenario:
        return None
    if not 0 <= option < len(scenario["options"]):
        raise ValueError("option out of range")
    best = scenario["points"].index(max(scenario["points"]))
    points = scenario["points"][option]
    return {"question_id": scenario_id, "option": option, "points": points, "max_points": MAX_POINTS,
            "best_option": best, "result": "best" if points == MAX_POINTS else "good" if points > 0 else "miss",
            "why": i18n.fit_scenario(scenario_id, scenario, lang)["why"]}


def interest_profile(answers: dict) -> dict:
    """{question_id: option_id} -> RIASEC counts. Unknown questions or options raise ValueError."""
    questions = {q["id"]: q for q in _quiz()["interest_questions"]}
    missing = set(questions) - set(answers)
    if missing:
        raise ValueError(f"Answer every interest question (missing: {', '.join(sorted(missing))})")
    counts = dict.fromkeys(RIASEC, 0)
    for qid, oid in answers.items():
        q = questions.get(qid)
        option = next((o for o in q["options"] if o["id"] == oid), None) if q else None
        if option is None:
            raise ValueError(f"Unknown answer {qid}={oid}")
        counts[option["type"]] += 1
    return counts


def interest_match(profile: dict, career_id: str) -> float:
    student = [float(profile[k]) for k in RIASEC]
    career = [float(career_riasec(career_id)[k]) for k in RIASEC]
    return adjusted_cosine_percentage(student, career)


def fit_score(interest: float, enjoyment: int, points: int) -> float:
    return (WEIGHTS["interest"] * interest + WEIGHTS["enjoyment"] * ENJOYMENT_SCORE[enjoyment]
            + WEIGHTS["scenario"] * points / MAX_POINTS * 100)


def top_types(profile: dict, n: int = 2) -> list[str]:
    """Student's strongest interest types (ties keep the RIASEC order)."""
    return [k for k in sorted(RIASEC, key=lambda k: -profile[k]) if profile[k] > 0][:n]


def score_quiz(interests: dict, scenarios: list[dict], careers: dict, lang: str = "en") -> dict:
    """
    interests: {question_id: option_id}; scenarios: [{career_id, question_id, option, enjoyment}];
    careers: career_id -> career dict, in the recommended order (used to break ties).
    """
    profile = interest_profile(interests)
    order = list(careers)
    results = []
    for answer in scenarios:
        career_id = answer["career_id"]
        scenario = _scenario_index().get(answer["question_id"])
        if career_id not in careers or not scenario or scenario["career_id"] != career_id:
            raise ValueError(f"Scenario {answer['question_id']} does not belong to {career_id}")
        if not 0 <= answer["option"] < len(scenario["points"]):
            raise ValueError("option out of range")
        points = scenario["points"][answer["option"]]
        interest = interest_match(profile, career_id)
        fit = fit_score(interest, answer["enjoyment"], points)
        results.append({"career_id": career_id,
                        "career_name": i18n.career_field(careers[career_id], "career_name", lang),
                        "fit": round(fit), "interest_match": round(interest), "enjoyment": answer["enjoyment"],
                        "scenario_points": points,
                        "career_types": top_types(career_riasec(career_id), 3)})
    if len({r["career_id"] for r in results}) != len(results):
        raise ValueError("Each career can be answered once")
    results.sort(key=lambda r: (-r["fit"], order.index(r["career_id"])))
    for rank, r in enumerate(results, 1):
        r["rank"] = rank
    best = results[0] if results else None
    return {"interest_profile": profile, "top_types": top_types(profile),
            "results": results, "best_fit_career_id": best["career_id"] if best else None,
            "summary": i18n.t(lang, "fit_summary", career=best["career_name"], fit=best["fit"]) if best else "",
            "advisory": i18n.t(lang, "fit_advisory")}
