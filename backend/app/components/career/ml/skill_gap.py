from app.components.career.ml.recommender import load_careers


def analyse(career_title: str, student_skills: list[str]) -> dict:
    career = next(c for c in load_careers() if c["title"] == career_title)
    have = {s.lower() for s in student_skills}
    req = career["required_skills"]
    return {"career": career_title,
            "have": [r for r in req if r.lower() in have],
            "missing": [r for r in req if r.lower() not in have]}
