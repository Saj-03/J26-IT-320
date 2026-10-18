"""
Step 3.1 - Survey priors for the synthetic student simulator.

Reads the team survey (docs/survey_cleaned.xlsx, sheet "Clean data") and turns the
answers that matter for scheduling into simple numbers (percentages, averages).
The simulator (Step 3.2) samples fake students from these numbers, so its students
behave like the real Sri Lankan undergraduates who answered the survey.

No model is trained here - this is only counting and averaging.

Run:  .venv\\Scripts\\python ml_training/scheduler/survey_priors.py
Out:  ml_training/scheduler/data/survey_priors.json
"""
import json
from pathlib import Path

import pandas as pd

BACKEND = Path(__file__).resolve().parents[2]
SURVEY = BACKEND.parent / "docs" / "survey_cleaned.xlsx"
OUT = Path(__file__).resolve().parent / "data" / "survey_priors.json"

MIN_AGE = 18  # proposal inclusion criterion: 18 or above

# Short name -> part of the question text in the survey.
# We match by text because the full questions are long
# and some contain odd dash characters from Google Forms.
QUESTIONS = {
    "age": "What is your age?",
    "productive_time": "At what time of day are you usually most productive?",
    "study_hours": "Approximately how many hours do you study per week",
    "tasks_per_week": "How many academic tasks do you normally have in one week?",
    "modules": "How many subjects or modules are you currently studying?",
    "has_job": "Do you have a part-time or full-time job?",
    "job_hours": "If yes, how many hours do you work per week",
    "before_deadline": "How often do you complete tasks before the deadline?",
    "task_choice": "When several tasks are due, which one do you normally do first?",
    "wants_auto_reduce": "Would you like a system to automatically reduce your workload",
    "defer_helps": "When you are highly stressed, would moving lower-priority tasks",
    "stress_affects": "How often does stress affect your ability to complete academic tasks?",
    "sleep_hours": "How many hours do you usually sleep per night",
}

# PSS-10 (Perceived Stress Scale) - 10 items, each scored 0..4, total 0..40.
# Items 4, 5, 7, 8 are positive ("things were going your way"), so they are reversed (4 - score).
PSS_ITEMS = [
    ("Been upset because of something that happened unexpectedly", False),
    ("Unable to control the important things in your life", False),
    ("Nervous and stressed", False),
    ("Confident about your ability to handle your personal problems", True),
    ("Things were going your way", True),
    ("Unable to cope with all the things you had to do", False),
    ("Able to control irritations in your life", True),
    ("On top of things", True),
    ("Angered because of things that were outside of your control", False),
    ("Difficulties were piling up so high", False),
]
PSS_SCORE = {
    "Never": 0,
    "Almost Never": 1,
    "Seldom": 1,  # not a real PSS-10 option (form typo) -> treated as "Almost Never"
    "Sometimes": 2,
    "Fairly often": 3,
    "Very often": 4,
}


def find_column(df: pd.DataFrame, text: str) -> str:
    """Return the survey column whose question contains `text`."""
    matches = [c for c in df.columns if text.lower() in str(c).lower()]
    if len(matches) != 1:
        raise KeyError(f"Expected 1 column for {text!r}, found {len(matches)}")
    return matches[0]


def load_survey(path: Path = SURVEY) -> pd.DataFrame:
    """Read the clean sheet and keep only the columns we need, with short names."""
    raw = pd.read_excel(path, sheet_name="Clean data")
    df = pd.DataFrame({name: raw[find_column(raw, q)] for name, q in QUESTIONS.items()})
    df["pss10"] = pss10_scores(raw)

    # Google Forms uses an en dash in ranges ("5–10 hours"); make it a normal "-"
    # (only text cells are changed; numbers and blanks stay as they are)
    for col in df.columns:
        df[col] = df[col].map(clean_text)
    return df


def clean_text(value):
    """Replace en/em dashes with "-" and trim spaces. Non-text values are returned unchanged."""
    if isinstance(value, str):
        return value.replace("–", "-").replace("—", "-").strip()
    return value


def pss10_scores(raw: pd.DataFrame) -> pd.Series:
    """Total PSS-10 stress score (0-40) for every respondent."""
    total = pd.Series(0, index=raw.index, dtype="float")
    for text, reverse in PSS_ITEMS:
        item = raw[find_column(raw, text)].str.strip().map(PSS_SCORE)
        total += (4 - item) if reverse else item
    return total  # NaN if any item is missing


def remove_under_age(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Drop respondents younger than 18 (ethics). Unknown age is kept."""
    too_young = df["age"] < MIN_AGE
    return df[~too_young].reset_index(drop=True), int(too_young.sum())


def shares(series: pd.Series) -> dict:
    """Percent of each answer, e.g. {"Late Night": 0.39, "Morning": 0.30}. Blanks ignored."""
    counts = series.dropna().value_counts(normalize=True)
    return {str(k): round(float(v), 4) for k, v in counts.items()}


def summary(series: pd.Series) -> dict:
    """Mean, spread and quartiles of a number column."""
    s = series.dropna()
    return {
        "n": int(s.size),
        "mean": round(float(s.mean()), 2),
        "sd": round(float(s.std()), 2),
        "p25": round(float(s.quantile(0.25)), 2),
        "median": round(float(s.median()), 2),
        "p75": round(float(s.quantile(0.75)), 2),
    }


def pss_level(score: float) -> str:
    """Usual PSS-10 bands: 0-13 low, 14-26 moderate, 27-40 high."""
    return "low" if score <= 13 else "moderate" if score <= 26 else "high"


def build_priors(df: pd.DataFrame, removed_under_age: int = 0) -> dict:
    """All numbers the simulator needs, in one dictionary."""
    working = df["has_job"] == "Yes"
    job_hours = df.loc[working, "job_hours"]
    job_hours = job_hours[(job_hours > 0) & (job_hours <= 80)]  # drop impossible values

    pss = df["pss10"].dropna()

    return {
        "source": "docs/survey_cleaned.xlsx (sheet: Clean data)",
        "respondents": int(len(df)),
        "removed_under_age": removed_under_age,
        # When students focus best -> peak hours of fake students
        "productive_time": shares(df["productive_time"]),
        # How much they study / how busy they are -> sessions and tasks per week
        "study_hours_per_week": shares(df["study_hours"]),
        "tasks_per_week": shares(df["tasks_per_week"]),
        "modules": shares(df["modules"]),
        # Jobs take away free time -> commitments of fake students
        "job": {"share_with_job": round(float(working.mean()), 4), "hours_per_week": summary(job_hours)},
        # Deadline behaviour (1 = never before deadline, 5 = always)
        "before_deadline": shares(df["before_deadline"].astype("Int64").astype(str).replace("<NA>", None)),
        "task_choice": shares(df["task_choice"]),
        # Stress -> stress weeks and how strongly stress lowers focus
        "pss10": {
            **summary(pss),
            "levels": shares(pss.map(pss_level)),
        },
        "stress_affects_tasks": shares(df["stress_affects"]),
        "wants_auto_reduce": shares(df["wants_auto_reduce"]),
        "defer_helps": shares(df["defer_helps"].astype("Int64").astype(str).replace("<NA>", None)),
        "sleep_hours": summary(df["sleep_hours"]),
    }


def main() -> None:
    df, removed = remove_under_age(load_survey())
    priors = build_priors(df, removed)

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(priors, indent=2), encoding="utf-8")

    print(f"Respondents used: {priors['respondents']} (removed under {MIN_AGE}: {removed})")
    print("Most productive time:", priors["productive_time"])
    print(f"Has a job: {priors['job']['share_with_job']:.0%}, "
          f"median {priors['job']['hours_per_week']['median']} h/week")
    print(f"PSS-10 mean {priors['pss10']['mean']}, levels {priors['pss10']['levels']}")
    print("Saved ->", OUT)


if __name__ == "__main__":
    main()
