"""
Feature engineering for the trained career model.

Used by BOTH the offline training script (ml_training/career) and the live
recommender, so a profile is always turned into the same numeric vector.

VIVA: "The survey answers become ~60 numeric features: the 9 skill ratings,
ordinal scales (year of study, learning consistency, leadership level,
career-work progress) and one-hot / multi-hot encodings of the categorical
and select-all-that-apply questions. The student's stated career area and
preferred role are NOT features - they are what we try to predict, so using
them would leak the answer."
"""
import re

from app.components.career.schemas import SKILL_KEYS

# Career families predicted by the model, and the ACRDS careers in each family.
FAMILY_CAREERS = {
    "software": ["software_engineer", "qa_engineer", "network_engineer"],
    "data": ["data_analyst", "database_administrator"],
    "cybersecurity": ["cybersecurity_analyst"],
    "business": ["business_analyst", "project_manager", "digital_marketing_executive"],
    "design": ["ui_ux_designer"],
    "other": [],  # careers outside the ACRDS catalogue (health, law, teaching, ...)
}
CAREER_FAMILY = {career: fam for fam, careers in FAMILY_CAREERS.items() for career in careers}

EMPLOYMENT = ["unemployed", "intern", "full-time", "part-time", "graduate"]
FACULTY_GROUPS = [
    ("computing", r"comput|cyber|information|software|\bit\b"),
    ("science", r"scien|environment|physic|chemi|biolog|math"),
    ("health", r"health|medic|nurs|pharm"),
    ("business", r"business|manage|tourism|account|financ|commerce"),
    ("engineering", r"engineer"),
]
TRENDS = ["improving", "stable", "declining", "not sure"]
PREVIOUS_PREFERENCE = ["yes", "no", "not sure"]
LEARNING_METHODS = [
    ("projects", r"project"), ("videos", r"video"), ("reading", r"read"),
    ("discussion", r"discussion"), ("practical", r"practical|lab"),
    ("lecturer", r"lecturer"), ("trial_error", r"trial"),
]
CONSISTENCY = {"never": 0, "rarely": 1, "monthly": 2, "weekly": 3, "daily": 4}
EXTRACURRICULAR_TYPES = [
    "clubs and societies", "sports", "volunteering", "competition", "student leadership",
    "media/content creation", "religious/social service activities", "academic societies",
    "debating/public speaking", "performing arts", "technical communities",
]
ROLE_LEVEL = {
    "volunteer": 1, "member": 1, "participant": 1, "active member": 2, "committee member": 3,
    "organiser": 3, "organizer": 3, "coordinator": 3, "secretary/treasurer": 3,
    "team leader": 4, "team lead": 4, "president/captain": 5,
}
WORK_STATUS = [("no", 0), ("not yet", 0), ("planning", 1), ("currently", 2), ("completed", 3), ("yes", 3)]
WORK_TYPES = [
    "academic project", "personal project", "research project", "volunteer work",
    "technical / practical work", "portfolio work", "case study / report",
    "laboratory / field work", "business / entrepreneurship activity", "internship",
]
SUPPORT_TYPES = [
    "skill gap analysis", "career recommendation", "internship guidance", "certification recommendations",
    "interview practice", "career roadmap", "project ideas", "cv guidance", "course recommendations",
    "portfolio guidance", "career change guidance",
]


def _norm(value) -> str:
    return " ".join(str(value or "").lower().split())


def split_multi(value) -> set[str]:
    """'Sports, Clubs and societies' -> {'sports', 'clubs and societies'} (also accepts lists)."""
    if isinstance(value, (list, tuple, set)):
        return {_norm(v) for v in value if _norm(v)}
    return {_norm(v) for v in str(value or "").split(",") if _norm(v)}


def _match_group(text: str, groups: list[tuple[str, str]], default: str = "other") -> str:
    return next((name for name, pattern in groups if re.search(pattern, text)), default)


def academic_year(value) -> int:
    text = _norm(value)
    digit = re.search(r"[1-4]", text)
    if digit:
        return int(digit.group())
    return 5 if "graduate" in text else 0


def role_level(value) -> int:
    """Highest leadership level among the selected roles (0 = none)."""
    return max((ROLE_LEVEL.get(r, 0) for r in split_multi(value)), default=0)


def work_status_level(value) -> int:
    text = _norm(value)
    return next((level for prefix, level in WORK_STATUS if text.startswith(prefix)), 0)


def feature_names() -> list[str]:
    names = [f"skill_{k}" for k in SKILL_KEYS]
    names += ["career_confidence", "academic_year", "learning_consistency", "leadership_level",
              "career_work_level", "extracurricular_yes"]
    names += [f"employment_{e}" for e in EMPLOYMENT]
    names += [f"faculty_{name}" for name, _ in FACULTY_GROUPS] + ["faculty_other"]
    names += [f"trend_{t.replace(' ', '_')}" for t in TRENDS]
    names += [f"previous_pref_{p.replace(' ', '_')}" for p in PREVIOUS_PREFERENCE]
    names += [f"learning_{name}" for name, _ in LEARNING_METHODS] + ["learning_other"]
    names += [f"extra_{re.sub(r'[^a-z]+', '_', t)}" for t in EXTRACURRICULAR_TYPES]
    names += [f"work_{re.sub(r'[^a-z]+', '_', t)}" for t in WORK_TYPES]
    names += [f"support_{re.sub(r'[^a-z]+', '_', t)}" for t in SUPPORT_TYPES]
    return names


def build_features(profile: dict) -> list[float]:
    """Profile dict (StudentCareerProfile fields; skills nested under 'skills') -> feature vector."""
    skills = profile["skills"]
    row = [float(skills[k]) for k in SKILL_KEYS]
    row += [
        float(profile.get("career_confidence") or 3),
        float(academic_year(profile.get("academic_status"))),
        float(CONSISTENCY.get(_norm(profile.get("skill_learning_consistency")), 0)),
        float(role_level(profile.get("highest_extracurricular_role"))),
        float(work_status_level(profile.get("career_related_work_status"))),
        1.0 if _norm(profile.get("extracurricular_participation")) == "yes" else 0.0,
    ]

    employment = _norm(profile.get("employment_status"))
    row += [1.0 if e in employment else 0.0 for e in EMPLOYMENT]

    faculty = _match_group(_norm(profile.get("faculty_field")), FACULTY_GROUPS)
    row += [1.0 if faculty == name else 0.0 for name, _ in FACULTY_GROUPS] + [1.0 if faculty == "other" else 0.0]

    trend = _norm(profile.get("academic_performance_trend"))
    row += [1.0 if trend.startswith(t) else 0.0 for t in TRENDS]

    previous = _norm(profile.get("previous_career_preference"))
    row += [1.0 if previous == p else 0.0 for p in PREVIOUS_PREFERENCE]

    method = _match_group(_norm(profile.get("preferred_learning_method")), LEARNING_METHODS)
    row += [1.0 if method == name else 0.0 for name, _ in LEARNING_METHODS] + [1.0 if method == "other" else 0.0]

    extra = split_multi(profile.get("extracurricular_type"))
    row += [1.0 if t in extra else 0.0 for t in EXTRACURRICULAR_TYPES]
    work = split_multi(profile.get("career_related_work_type"))
    row += [1.0 if t in work else 0.0 for t in WORK_TYPES]
    support = split_multi(profile.get("career_support_needed"))
    row += [1.0 if t in support else 0.0 for t in SUPPORT_TYPES]
    return row
