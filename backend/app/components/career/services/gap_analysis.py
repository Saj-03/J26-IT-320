"""
Skill gap analysis for the career the student selected.

VIVA: "For each of the 9 skills, gap = required level - current level.
gap <= 0 is Strong, 1 is Needs Improvement, 2+ is a Critical Gap.
Readiness is the average of min(current / required, 1) across skills."
"""
from app.components.career.schemas import SKILL_KEYS
from app.components.career.services import i18n

STRONG = "Strong"
NEEDS_IMPROVEMENT = "Needs Improvement"
CRITICAL_GAP = "Critical Gap"


def gap_status(gap: int) -> str:
    if gap <= 0:
        return STRONG
    if gap == 1:
        return NEEDS_IMPROVEMENT
    return CRITICAL_GAP


def readiness_percentage(student_skills: dict, required: dict) -> float:
    ratios = [min(student_skills[k] / required[k], 1.0) for k in SKILL_KEYS]
    return round(sum(ratios) / len(ratios) * 100, 2)


def analyse_gaps(profile: dict, career: dict, lang: str = "en") -> dict:
    """`status` stays an English code (Strong / Needs Improvement / Critical Gap); the UI translates it."""
    student_skills = profile["skills"]
    required = career["required_skills"]

    skill_gaps = []
    for skill in SKILL_KEYS:
        gap = required[skill] - student_skills[skill]
        skill_gaps.append({
            "skill": skill,
            "current_level": student_skills[skill],
            "required_level": required[skill],
            "gap": gap,
            "status": gap_status(gap),
        })

    return {
        "career_id": career["career_id"],
        "career_name": i18n.career_field(career, "career_name", lang),
        "readiness_percentage": readiness_percentage(student_skills, required),
        "skill_gaps": skill_gaps,
    }
