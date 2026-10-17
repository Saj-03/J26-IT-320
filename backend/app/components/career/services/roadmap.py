"""
Rule-based personalised roadmap built from the skill gap analysis.

VIVA: "Only weak skills get roadmap items. Critical gaps are High priority,
1-level gaps are Medium. Each item maps a skill to a course, a project and
a weekly task, so every suggestion is traceable to a specific gap."
"""
from app.components.career.services import i18n
from app.components.career.services.gap_analysis import CRITICAL_GAP, NEEDS_IMPROVEMENT

# One learning plan per skill (course, project, practice task).
SKILL_PLANS = {
    "communication": {
        "course": "Communication Skills for Professionals",
        "project": "Record and review mock interview answers",
        "task": "Practice presentations and group discussions",
    },
    "problem_solving": {
        "course": "Problem Solving and Logical Thinking",
        "project": "Complete weekly coding or case-study challenges",
        "task": "Break complex problems into smaller steps",
    },
    "data_analysis": {
        "course": "SQL, Excel, Power BI, and Python for Data Analysis",
        "project": "Create a dashboard using a real dataset",
        "task": "Analyze one dataset weekly",
    },
    "documentation": {
        "course": "Technical Writing and Software Documentation",
        "project": "Create an SRS or BRD document for a sample system",
        "task": "Write project documentation clearly",
    },
    "leadership": {
        "course": "Leadership and Agile Team Management",
        "project": "Lead a small academic or personal project",
        "task": "Practice task delegation and team coordination",
    },
    "teamwork": {
        "course": "Team Collaboration and Conflict Management",
        "project": "Join a group project and contribute actively",
        "task": "Use GitHub, Trello, or Jira for collaboration",
    },
    "creativity": {
        "course": "Creative Thinking and Innovation",
        "project": "Create a UI/UX concept or innovation portfolio idea",
        "task": "Brainstorm multiple solutions before choosing one",
    },
    "digital_literacy": {
        "course": "Digital Skills and Productivity Tools",
        "project": "Create a GitHub portfolio and use online collaboration tools",
        "task": "Practice MS Office, Google Workspace, and GitHub",
    },
    "research": {
        "course": "Research Methods and Literature Review",
        "project": "Read and summarize 3 research papers",
        "task": "Practice finding evidence from reliable sources",
    },
}

PRIORITY = {CRITICAL_GAP: "High", NEEDS_IMPROVEMENT: "Medium"}


def estimated_time(gap: int, lang: str = "en") -> str:
    """Bigger gaps need more time (about 2-3 weeks per level)."""
    if gap <= 1:
        return i18n.t(lang, "weeks_short")
    if gap == 2:
        return i18n.t(lang, "weeks_medium")
    return i18n.t(lang, "weeks_long")


def generate_roadmap(gap_result: dict, lang: str = "en") -> list[dict]:
    """Turn the gap analysis into ordered roadmap items (High priority first).
    `priority` stays an English code (High / Medium); the UI translates it."""
    career_name = gap_result["career_name"]
    weak = [g for g in gap_result["skill_gaps"] if g["status"] in PRIORITY]
    # Largest gaps first; stable order keeps the output deterministic.
    weak.sort(key=lambda g: -g["gap"])

    items = []
    for g in weak:
        plan = SKILL_PLANS[g["skill"]]
        items.append({
            "skill": g["skill"],
            "priority": PRIORITY[g["status"]],
            "course": i18n.plan_field(g["skill"], "course", plan["course"], lang),
            "project": i18n.plan_field(g["skill"], "project", plan["project"], lang),
            "task": i18n.plan_field(g["skill"], "task", plan["task"], lang),
            "estimated_time": estimated_time(g["gap"], lang),
            "reason": i18n.t(lang, "roadmap_reason", skill=i18n.skill(g["skill"], lang), current=g["current_level"],
                             career=career_name, required=g["required_level"], status=i18n.status(g["status"], lang)),
        })
    return items


# Career milestones: the career's own courses, tools, projects and certifications from
# career_requirements.json, so an Engineering roadmap differs from a Computing one.
# Tool and certification names are proper names and stay in English.
MILESTONES = [
    ("courses", "recommended_courses", True),
    ("tools", "required_tools", False),
    ("projects", "recommended_projects", True),
    ("cert", "recommended_certifications", False),
    ("interview", None, False),
]


def career_milestones(career: dict, lang: str = "en") -> list[dict]:
    """Ordered milestones for the selected career (the same five for every career, filled with its content)."""
    name = i18n.career_field(career, "career_name", lang)
    out = []
    for key, field, translated in MILESTONES:
        if field is None:
            items = []
        elif translated:
            items = i18n.career_list(career, field, lang)
        else:
            items = list(career.get(field) or [])
        if field and not items:
            continue
        out.append({
            "id": key,
            "title": i18n.t(lang, f"ms_{key}_title"),
            "description": i18n.t(lang, f"ms_{key}_desc", career=name),
            "timeframe": i18n.t(lang, f"ms_{key}_when"),
            "items": items,
        })
    return out
