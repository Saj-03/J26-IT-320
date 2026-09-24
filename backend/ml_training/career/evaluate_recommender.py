"""Precision@5 of the career recommender against labelled test profiles."""
from app.components.career.ml.recommender import recommend

TEST = [  # (skills, interests, expected career) - replace with survey-labelled data
    (["python", "sql", "statistics"], ["data"], "Data Scientist"),
    (["react", "javascript", "css"], ["web"], "Frontend Developer"),
]
hits = sum(any(r["career"] == exp for r in recommend(s, i, [])) for s, i, exp in TEST)
print(f"Hit-rate@5 = {hits / len(TEST):.2f}")
