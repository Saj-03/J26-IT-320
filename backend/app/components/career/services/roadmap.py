"""
Rule-based personalised roadmap built from the skill gap analysis.

VIVA: "Only weak skills get roadmap items. Critical gaps are High priority,
1-level gaps are Medium. Each item maps a skill to a course, a project and
a weekly task, so every suggestion is traceable to a specific gap."
"""
from app.components.career.services.career_data import skill_label
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


def estimated_time(gap: int) -> str:
    """Bigger gaps need more time (about 2-3 weeks per level)."""
    if gap <= 1:
        return "2-3 weeks"
    if gap == 2:
        return "4-6 weeks"
    return "6-8 weeks"


def generate_roadmap(gap_result: dict) -> list[dict]:
    """Turn the gap analysis into ordered roadmap items (High priority first)."""
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
            "course": plan["course"],
            "project": plan["project"],
            "task": plan["task"],
            "estimated_time": estimated_time(g["gap"]),
            "reason": (f"Your {skill_label(g['skill'])} is {g['current_level']}/5 but "
                       f"{career_name} needs {g['required_level']}/5 ({g['status']})."),
        })
    return items
