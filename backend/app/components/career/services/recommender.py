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
from app.components.career.services import i18n
from app.components.career.services.career_data import load_careers
from app.components.career.services.career_features import CAREER_FAMILY, role_level, work_status_level
from app.components.career.services.career_model import family_probabilities, load_bundle

# Faculty comes first: the student's faculty is respected more strongly than the trained model,
# which was trained mostly on computing students.
FACULTY_BONUS = 10             # career belongs to the student's faculty
OUTSIDE_FACULTY_PENALTY = 30   # career from another faculty (only used to fill a short list)

# Bonus points added on top of the base score (kept small so skills and the model dominate).
AREA_BONUS = 5
ROLE_BONUS = 5
WORK_BONUS = 3
LEADERSHIP_BONUS = 3

# "other" (non-computing careers) has no label: the family is too broad to describe usefully.
# The labels themselves are in i18n.py ("family_<name>"), in English, Sinhala and Tamil.
DESCRIBED_FAMILIES = {"software", "data", "cybersecurity", "business", "design"}


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
    # High threshold: it only catches typos, so e.g. "Mechanical Engineer" never matches "Electrical Engineer".
    return a in b or b in a or SequenceMatcher(None, a, b).ratio() >= 0.85


def _in(value: str, options: list[str]) -> bool:
    return _norm(value) in {_norm(o) for o in options}


def _matches_area(area: str, career: dict) -> bool:
    return bool(area) and _in(area, [career["career_area"]] + career.get("related_areas", []))


def _matches_role(role: str, career: dict) -> bool:
    """related_roles maps survey roles without their own profile to the nearest career
    (e.g. "Electronics Engineer" -> Electrical Engineer)."""
    return _role_matches(role, career["career_name"]) or _in(role, career.get("related_roles", []))


def faculty_tier(profile: dict, career: dict) -> int:
    """1 = career belongs to the student's faculty
       2 = outside the faculty, but the student chose its area or role
       3 = cross-disciplinary career ("cross_disciplinary": true), used to fill a short list
       4 = unrelated to the student's faculty"""
    if _in(profile.get("faculty_field", ""), career.get("faculties", [])):
        return 1
    if (_matches_area(profile.get("career_area_interest", ""), career)
            or _matches_role(profile.get("preferred_career_role", ""), career)):
        return 2
    return 3 if career.get("cross_disciplinary") else 4


def _has_career_work(profile: dict) -> bool:
    """Currently doing, or has completed, career-related work."""
    return work_status_level(profile.get("career_related_work_status")) >= 2


def _has_leadership_role(profile: dict) -> bool:
    """Team leader or president/captain level."""
    return role_level(profile.get("highest_extracurricular_role")) >= 4


def calculate_bonus(profile: dict, career: dict, lang: str = "en") -> tuple[int, list[str]]:
    """Returns (bonus points, human-readable reasons in the student's language)."""
    required = career["required_skills"]
    bonus, reasons = 0, []

    area = profile.get("career_area_interest", "")
    if _matches_area(area, career):
        bonus += AREA_BONUS
        reasons.append(i18n.t(lang, "reason_area", area=i18n.value(area, lang)))
    if _matches_role(profile.get("preferred_career_role", ""), career):
        bonus += ROLE_BONUS
        reasons.append(i18n.t(lang, "reason_role"))
    # "Practical" careers need strong hands-on problem solving or digital skills.
    if _has_career_work(profile) and (required["problem_solving"] >= 4 or required["digital_literacy"] >= 4):
        bonus += WORK_BONUS
        reasons.append(i18n.t(lang, "reason_work"))
    if _has_leadership_role(profile) and required["leadership"] >= 4:
        bonus += LEADERSHIP_BONUS
        reasons.append(i18n.t(lang, "reason_leadership"))
    return bonus, reasons


def split_skills(student_skills: dict, required: dict) -> tuple[list[str], list[str]]:
    """matching = student meets the required level; missing = below it (largest gap first)."""
    matching = [k for k in SKILL_KEYS if student_skills[k] >= required[k]]
    missing = sorted(
        (k for k in SKILL_KEYS if student_skills[k] < required[k]),
        key=lambda k: (-(required[k] - student_skills[k]), SKILL_KEYS.index(k)),
    )
    return matching, missing


def build_explanation(career: dict, student_skills: dict, missing: list[str],
                      bonus_reasons: list[str], family_probability: float = None, lang: str = "en") -> str:
    required = career["required_skills"]
    name = i18n.career_field(career, "career_name", lang)

    def skills(keys):
        return i18n.join([i18n.skill(k, lang) for k in keys], lang)

    # Strengths = the career's most important skills where the student is
    # at or within one level of the requirement ("close to the requirement").
    close = [k for k in SKILL_KEYS if student_skills[k] >= required[k] - 1]
    top_strengths = sorted(close, key=lambda k: (-required[k], SKILL_KEYS.index(k)))[:3]
    to_improve = [k for k in missing if k not in top_strengths][:3]

    if top_strengths:
        text = i18n.t(lang, "explain_strengths", name=name, skills=skills(top_strengths))
    else:
        text = i18n.t(lang, "explain_shape", name=name)
    family = CAREER_FAMILY[career["career_id"]]
    if family in DESCRIBED_FAMILIES and family_probability is not None and family_probability >= 0.35:
        text += i18n.t(lang, "explain_family", family=i18n.t(lang, f"family_{family}"), pct=f"{family_probability:.0%}")
    if bonus_reasons:
        text += i18n.t(lang, "explain_bonus", reasons=i18n.join(bonus_reasons, lang))
    if to_improve:
        text += i18n.t(lang, "explain_improve", skills=skills(to_improve))
    elif not missing:
        text += i18n.t(lang, "explain_all_met")
    return text


def recommend_careers(profile: dict, top_k: int = 5, lang: str = "en") -> list[dict]:
    """Score every career and return the top_k, best match first.
    `lang` only changes the text (names, descriptions, explanations), never the scores or the order."""
    student_skills = profile["skills"]
    student_vec = skill_vector(student_skills)
    family_proba = family_probabilities(profile)  # None when no trained model is available
    alpha = load_bundle()["alpha"] if family_proba else 0.0
    results = []

    faculty = profile.get("faculty_field", "")
    careers = list(load_careers())
    by_id = {c["career_id"]: c for c in careers}
    for career in careers:
        required = career["required_skills"]
        skill_match = adjusted_cosine_percentage(student_vec, skill_vector(required))
        p_family = family_proba.get(CAREER_FAMILY[career["career_id"]], 0.0) if family_proba else None
        base_score = skill_match if p_family is None else alpha * p_family * 100 + (1 - alpha) * skill_match
        bonus, bonus_reasons = calculate_bonus(profile, career, lang)
        # Without a faculty (e.g. old API clients) every career is treated as in-faculty, as before.
        tier = faculty_tier(profile, career) if faculty else 1
        if faculty and tier == 1:
            bonus += FACULTY_BONUS
            bonus_reasons.insert(0, i18n.t(lang, "reason_faculty", faculty=i18n.value(faculty, lang)))
        elif tier >= 3:
            bonus -= OUTSIDE_FACULTY_PENALTY
        match = max(0.0, min(base_score + bonus, 100.0))
        matching, missing = split_skills(student_skills, required)

        results.append({
            "career_id": career["career_id"],
            "career_name": i18n.career_field(career, "career_name", lang),
            "career_area": i18n.career_field(career, "career_area", lang),
            "description": i18n.career_field(career, "description", lang),
            "_name_en": career["career_name"],  # English name keeps the tie-break order language-independent
            "match_percentage": round(match, 2),
            "skill_match_percentage": round(skill_match, 2),
            "model_probability": None if p_family is None else round(p_family * 100, 2),
            "explanation": build_explanation(career, student_skills, missing, bonus_reasons, p_family, lang),
            "matching_skills": matching,
            "missing_skills": missing,
            "recommended_courses": career["recommended_courses"],
            "recommended_projects": career["recommended_projects"],
            "recommended_certifications": career["recommended_certifications"],
            "faculties": career.get("faculties", []),
            "faculty_match": tier <= 2,
            "_tier": tier,
        })

    # Faculty filter, then score. Order: in-faculty careers (and careers whose area/role the
    # student chose), then cross-disciplinary careers only if the list is short, then the rest.
    # Within each group: highest match first, alphabetical on ties (deterministic).
    results.sort(key=lambda r: (min(r["_tier"], 2), r["_tier"] >= 4, -r["match_percentage"], r["_name_en"]))
    for r in results:
        del r["_tier"], r["_name_en"]
    top = results[:top_k]

    # The student's preferred role is always shown, so they can compare it with the alternatives.
    role = profile.get("preferred_career_role", "")
    preferred = [r for r in results if _matches_role(role, by_id[r["career_id"]])]
    if preferred and not any(r in top for r in preferred):
        top[-1] = preferred[0]
        top[-1]["explanation"] += i18n.t(lang, "explain_preferred")
    return top
