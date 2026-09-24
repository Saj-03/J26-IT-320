"""
Content-based filtering with cosine similarity (proposal: top-5 careers).

VIVA: "Each career and each student becomes a vector of skills/interests.
Cosine similarity measures the angle between them - 1.0 means a perfect match."
"""
import json
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

DATA = Path(__file__).resolve().parents[4] / "datasets" / "career" / "careers.json"


def load_careers() -> list[dict]:
    return json.loads(DATA.read_text())


def recommend(skills: list[str], interests: list[str], extracurricular: list[str], top_k: int = 5):
    careers = load_careers()
    student_doc = " ".join(skills + interests + extracurricular).lower()
    career_docs = [" ".join(c["required_skills"] + c.get("keywords", [])).lower() for c in careers]

    vec = TfidfVectorizer()
    matrix = vec.fit_transform(career_docs + [student_doc])
    scores = cosine_similarity(matrix[-1], matrix[:-1]).flatten()

    ranked = sorted(zip(careers, scores), key=lambda x: x[1], reverse=True)[:top_k]
    s = {x.lower() for x in skills}
    return [{"career": c["title"], "score": round(float(sc), 3),
             "matched_skills": [k for k in c["required_skills"] if k.lower() in s]}
            for c, sc in ranked]
