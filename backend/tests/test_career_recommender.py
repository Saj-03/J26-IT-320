from app.components.career.ml.recommender import recommend
from app.components.career.ml.skill_gap import analyse


def test_top5_returned():
    assert len(recommend(["python", "sql"], ["data"], [])) == 5


def test_skill_gap_missing():
    assert "statistics" in analyse("Data Scientist", ["python"])["missing"]
