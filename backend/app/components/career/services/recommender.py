"""
Hybrid career recommendation: content-based cosine similarity + trained model.

VIVA: "The student and every career become 9-dimensional skill vectors in
the same order. We use *adjusted* (mean-centred) cosine similarity: each
vector's average is subtracted first, so we compare the shape of strengths
and weaknesses. Plain cosine on 1-5 ratings gives every career ~95%
because all values are positive; centring fixes that. The result (-1..1)
is mapped to 0-100%, then small explainable bonuses reflect interests
and experience.
When the trained career-family model is available (ml_models/), the base
score becomes  alpha * P(family) * 100 + (1 - alpha) * cosine match  -
exactly the formula evaluated in ml_training/career/train_career_model.py.
Without the model file the system falls back to the cosine score alone."
"""
import math
from difflib import SequenceMatcher

from app.components.career.schemas import SKILL_KEYS
from app.components.career.services.career_data import load_careers, skill_label
from app.components.career.services.career_features import CAREER_FAMILY, role_level, work_status_level
from app.components.career.services.career_model import family_probabilities, load_bundle

# Bonus points added on top of the cosine score (kept small so skills dominate).
AREA_BONUS = 5
ROLE_BONUS = 5
WORK_BONUS = 3
LEADERSHIP_BONUS = 3

FAMILY_LABEL = {"software": "software and infrastructure", "data": "data", "cybersecurity": "cybersecurity",
                "business": "business and management", "design": "design"}


def skill_vector(skills: dict) -> list[float]:
    return [float(skills[k]) for k in SKILL_KEYS]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """cos(theta) = (a . b) / (|a| * |b|), computed with the standard library."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def mean_centre(v: list[float]) -> list[float]:
    mean = sum(v) / len(v)
    return [x - mean for x in v]


def adjusted_cosine_percentage(student_vec: list[float], career_vec: list[float]) -> float:
    """Mean-centred cosine (-1..1) mapped to a 0-100 match score."""
    similarity = cosine_similarity(mean_centre(student_vec), mean_centre(career_vec))
    return (similarity + 1) / 2 * 100


def _norm(text: str) -> str:
    return (text or "").strip().lower()


def _role_matches(preferred_role: str, career_name: str) -> bool:
    """True if the student's preferred role text is similar to the career name."""
    a, b = _norm(preferred_role), _norm(career_name)
    if not a:
        return False
    return a in b or b in a or SequenceMatcher(None, a, b).ratio() >= 0.75


def _has_career_work(profile: dict) -> bool:
    """Currently doing, or has completed, career-related work."""
    return work_status_level(profile.get("career_related_work_status")) >= 2


def _has_leadership_role(profile: dict) -> bool:
    """Team leader or president/captain level."""
    return role_level(profile.get("highest_extracurricular_role")) >= 4


def calculate_bonus(profile: dict, career: dict) -> tuple[int, list[str]]:
    """Returns (bonus points, human-readable reasons)."""
    required = career["required_skills"]
    bonus, reasons = 0, []

    if _norm(profile.get("career_area_interest")) == _norm(career["career_area"]):
        bonus += AREA_BONUS
        reasons.append(f"it matches your interest in {career['career_area']}")
    if _role_matches(profile.get("preferred_career_role", ""), career["career_name"]):
        bonus += ROLE_BONUS
        reasons.append("it matches your preferred career role")
    # "Practical" careers need strong hands-on problem solving or digital skills.
    if _has_career_work(profile) and (required["problem_solving"] >= 4 or required["digital_literacy"] >= 4):
        bonus += WORK_BONUS
        reasons.append("your career-related work gives you practical experience")
    if _has_leadership_role(profile) and required["leadership"] >= 4:
        bonus += LEADERSHIP_BONUS
        reasons.append("your extracurricular leadership role fits this career")
    return bonus, reasons


def split_skills(student_skills: dict, required: dict) -> tuple[list[str], list[str]]:
    """matching = student meets the required level; missing = below it (largest gap first)."""
    matching = [k for k in SKILL_KEYS if student_skills[k] >= required[k]]
    missing = sorted(
        (k for k in SKILL_KEYS if student_skills[k] < required[k]),
        key=lambda k: (-(required[k] - student_skills[k]), SKILL_KEYS.index(k)),
    )
    return matching, missing


def _join(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def build_explanation(career: dict, student_skills: dict, missing: list[str],
                      bonus_reasons: list[str], family_probability: float = None) -> str:
    required = career["required_skills"]
    name = career["career_name"]
    # Strengths = the career's most important skills where the student is
    # at or within one level of the requirement ("close to the requirement").
    close = [k for k in SKILL_KEYS if student_skills[k] >= required[k] - 1]
    top_strengths = sorted(close, key=lambda k: (-required[k], SKILL_KEYS.index(k)))[:3]
    to_improve = [k for k in missing if k not in top_strengths][:3]

    if top_strengths:
        text = (f"{name} is recommended because your "
                f"{_join([skill_label(k) for k in top_strengths])} skills are close to this career requirement.")
    else:
        text = f"{name} is a possible direction based on the overall shape of your skill profile."
    if family_probability is not None and family_probability >= 0.35:
        family = FAMILY_LABEL[CAREER_FAMILY[career["career_id"]]]
        text += (f" Students with a background similar to yours often prefer {family} careers "
                 f"(model estimate {family_probability:.0%}).")
    if bonus_reasons:
        text += f" It also ranks higher because {_join(bonus_reasons)}."
    if to_improve:
        text += f" You may need to improve {_join([skill_label(k) for k in to_improve])}."
    elif not missing:
        text += " You already meet every core skill level for this career."
    return text


def recommend_careers(profile: dict, top_k: int = 5) -> list[dict]:
    """Score every career and return the top_k, best match first."""
    student_skills = profile["skills"]
    student_vec = skill_vector(student_skills)
    family_proba = family_probabilities(profile)  # None when no trained model is available
    alpha = load_bundle()["alpha"] if family_proba else 0.0
    results = []

    for career in load_careers():
        required = career["required_skills"]
        skill_match = adjusted_cosine_percentage(student_vec, skill_vector(required))
        p_family = family_proba.get(CAREER_FAMILY[career["career_id"]], 0.0) if family_proba else None
        base_score = skill_match if p_family is None else alpha * p_family * 100 + (1 - alpha) * skill_match
        bonus, bonus_reasons = calculate_bonus(profile, career)
        match = min(base_score + bonus, 100.0)
        matching, missing = split_skills(student_skills, required)

        results.append({
            "career_id": career["career_id"],
            "career_name": career["career_name"],
            "career_area": career["career_area"],
            "description": career["description"],
            "match_percentage": round(match, 2),
            "skill_match_percentage": round(skill_match, 2),
            "model_probability": None if p_family is None else round(p_family * 100, 2),
            "explanation": build_explanation(career, student_skills, missing, bonus_reasons, p_family),
            "matching_skills": matching,
            "missing_skills": missing,
            "recommended_courses": career["recommended_courses"],
            "recommended_projects": career["recommended_projects"],
            "recommended_certifications": career["recommended_certifications"],
        })

    # Deterministic order: highest match first, then alphabetical on ties.
    results.sort(key=lambda r: (-r["match_percentage"], r["career_name"]))
    return results[:top_k]
