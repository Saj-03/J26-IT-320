"""Rule-based roadmap: one learning activity per missing skill (traceable)."""
ACTIVITY = {"course": "Complete an online course on {s}",
            "project": "Build a small portfolio project using {s}"}


def generate(missing: list[str]) -> list[dict]:
    steps = []
    for i, skill in enumerate(missing, start=1):
        kind = "project" if i % 2 == 0 else "course"
        steps.append({"order": i, "skill": skill,
                      "activity": ACTIVITY[kind].format(s=skill), "est_weeks": 2})
    return steps
