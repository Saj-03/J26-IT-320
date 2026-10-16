"""
Step 1 - Prepare the ACRDS career survey for model training.

Run from backend/:
    python -m ml_training.career.prepare_survey_data --source <CSV path or Google Sheet URL>
    (or set CAREER_SURVEY_URL in backend/.env and omit --source)

What it does:
  1. Keeps ONLY the career-component questions (the shared team survey also has
     scheduler/burnout/physical questions, age, height, weight - all dropped).
  2. Removes non-genuine submissions using the form timestamps:
       - bursts: 5+ submissions in a row, each <= 15 s after the previous one
         (a ~10-minute survey cannot be completed that fast, repeatedly);
       - constant intervals: 7+ submissions in a row with near-identical spacing
         (coefficient of variation < 0.15) - scripted, timer-like submission;
       - bulk duplicates: identical answers submitted 3+ times.
     Exact double submissions keep one copy.
  3. Normalises the free-text "preferred career role" into a career family
     label (and an ACRDS career id where one clearly applies).
  4. Writes an anonymised dataset (no timestamp, no personal data) and a
     data-quality report for the thesis.
"""
import argparse
import os
import re
from pathlib import Path

import pandas as pd

BACKEND = Path(__file__).resolve().parents[2]
OUT_CSV = BACKEND / "datasets" / "career" / "survey_responses_clean.csv"
REPORT = Path(__file__).resolve().parent / "reports" / "data_preparation_report.md"

# Output field -> text that identifies the survey question.
QUESTIONS = {
    "academic_status": "what is your current academic status",
    "employment_status": "what is your current employment status",
    "faculty_field": "what is your faculty academic field",
    "degree_programme": "what is your degree programme",
    "academic_performance_trend": "academic performance trend",
    "career_area_interest": "what career area are you currently most interested in",
    "preferred_career_role": "what specific career role do you prefer most",
    "career_confidence": "how confident are you about this career interest",
    "previous_career_preference": "did you previously prefer a different career path",
    "previous_career_interest": "what was your previous career interest",
    "skill_digital_literacy": "[digital literacy]",
    "skill_communication": "[communication]",
    "skill_problem_solving": "[problem solving]",
    "skill_leadership": "[leadership]",
    "skill_teamwork": "[teamwork]",
    "skill_research": "[research]",
    "skill_data_analysis": "[data analysis]",
    "skill_documentation": "[documentation]",
    "skill_creativity": "[creativity]",
    "preferred_learning_method": "what is your preferred learning method",
    "skill_learning_consistency": "how consistent are you with learning new skills",
    "extracurricular_participation": "have you participated in extracurricular activities",
    "extracurricular_type": "what type of extracurricular activities",
    "highest_extracurricular_role": "what is your highest role in extracurricular",
    "career_related_work_status": "have you completed certifications, courses, projects",
    "career_related_work_type": "what type of career-related work",
    "career_support_needed": "what type of career support would be most useful",
}
SKILL_COLUMNS = [c for c in QUESTIONS if c.startswith("skill_") and c != "skill_learning_consistency"]
BULK_DUPLICATE_MIN = 3
BURST_SECONDS, BURST_MIN_RUN = 15, 5
REGULAR_WINDOW, REGULAR_MAX_CV = 6, 0.15   # 6 consecutive gaps = 7 submissions

# Free-text role -> (family, ACRDS career_id or None). First matching rule wins.
UNSURE = r"^(still )?not sure|^cant$|^can't$|^-$|^none$|^idk$|^$"
ROLE_RULES = [
    (r"cyber|security|\bsoc\b|\bgrc\b", "cybersecurity", "cybersecurity_analyst"),
    (r"graphic|brand designer", "design", "graphic_designer"),
    (r"content creator|video|youtuber|motion", "design", "content_creator"),
    (r"\bui\b|\bux\b|ui/ux|design|animat|artist|interior", "design", "ui_ux_designer"),
    (r"data scien|data analy|statistic", "data", "data_analyst"),
    (r"data engineer|\bdata\b", "data", None),
    (r"database|\bdba\b", "data", "database_administrator"),
    (r"business analyst|\bba\b", "business", "business_analyst"),
    (r"project manager|product manager", "business", "project_manager"),
    (r"digital market|marketing|communication", "business", "digital_marketing_executive"),
    (r"quali|assurance|\bqa\b|tester|testing", "software", "qa_engineer"),
    (r"network|cloud|site reliability|devops", "software", "network_engineer"),
    (r"software|^se$|developer|full ?stack|game|\bai engineer|implementation engineer|programmer",
     "software", "software_engineer"),
    (r"application support", "software", None),
    (r"civil|structural", "other", "civil_engineer"),
    (r"mechanical|industrial engineer|maintenance engineer", "other", "mechanical_engineer"),
    (r"electrical|electronic", "other", "electrical_engineer"),
    (r"teach|lecturer|instructor|tutor", "other", "teacher"),
    (r"counsel", "other", "counselling_assistant"),
    (r"lawyer|legal|attorney", "other", "legal_assistant"),
    (r"compliance", "other", "compliance_officer"),
    (r"research assistant", "other", "research_assistant"),
    (r"lab(oratory)? tech", "other", "laboratory_technician"),
    (r"public health", "other", "public_health_assistant"),
    (r"health admin|hospital admin", "other", "health_administrator"),
    (r"account|financ|auditor", "business", "finance_analyst"),
    (r"\bhr\b|human resource", "business", "hr_executive"),
    (r"writer|editor|journalist", "business", "content_writer"),
    (r"public relations|\bpr\b", "business", "public_relations_executive"),
    (r"law|teach|lecturer|nurs|doctor|dentist|physician|psycholog|counsel|scien|biotech|pharma|"
     r"environment|government|flight|football|electrical|medical|health", "other", None),
    (r"account|bank|entrepreneur|manager|\bhr\b|executive|business|director|market", "business", None),
]


def find_column(columns, needle: str) -> str:
    for col in columns:
        if needle in " ".join(str(col).lower().split()):
            return col
    raise KeyError(f"Survey question not found: {needle!r}")


def map_role(raw) -> tuple:
    text = " ".join(str(raw if pd.notna(raw) else "").lower().split())
    if re.search(UNSURE, text):
        return None, None
    for pattern, family, career in ROLE_RULES:
        if re.search(pattern, text):
            return family, career
    return None, None  # ambiguous (e.g. just "engineer" or "analyst")


def load_source(source: str) -> pd.DataFrame:
    if source.startswith("http") and "docs.google.com/spreadsheets" in source:
        sheet_id = re.search(r"/d/([^/]+)", source).group(1)
        source = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    return pd.read_csv(source)


def submission_flags(timestamps: pd.Series) -> tuple[pd.Series, pd.Series]:
    """(burst, constant_interval) flags per row, from the form's submission timestamps."""
    t = pd.to_datetime(timestamps, dayfirst=True, errors="coerce").sort_values()
    gaps = t.diff().dt.total_seconds()
    burst = pd.Series(False, index=timestamps.index)
    regular = pd.Series(False, index=timestamps.index)
    idx = list(t.index)

    # Runs of consecutive fast submissions (each <= BURST_SECONDS after the previous one).
    run = [idx[0]] if idx else []
    for prev_i, i in zip(idx, idx[1:]):
        if gaps[i] <= BURST_SECONDS:
            run.append(i)
        else:
            if len(run) >= BURST_MIN_RUN:
                burst[run] = True
            run = [i]
    if len(run) >= BURST_MIN_RUN:
        burst[run] = True

    # Windows of near-constant spacing (excluding bursts, which are caught above).
    g = gaps.to_numpy()
    for start in range(1, len(idx) - REGULAR_WINDOW + 1):
        window = g[start:start + REGULAR_WINDOW]
        if (window > BURST_SECONDS).all() and window.std() / window.mean() < REGULAR_MAX_CV:
            regular[idx[start - 1:start + REGULAR_WINDOW]] = True
    return burst, regular


def prepare(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    cols = {field: find_column(raw.columns, needle) for field, needle in QUESTIONS.items()}
    df = raw[list(cols.values())].copy()
    df.columns = list(cols.keys())
    stats = {"raw_rows": len(df), "burst_rows": 0, "constant_interval_rows": 0}

    # Non-genuine submissions detected from the timestamps (only when the export has them).
    ts_cols = [c for c in raw.columns if str(c).strip().lower() == "timestamp"]
    if ts_cols:
        burst, regular = submission_flags(raw[ts_cols[0]])
        stats["burst_rows"] = int(burst.sum())
        stats["constant_interval_rows"] = int((regular & ~burst).sum())
        df = df[~(burst | regular)]

    # Bulk duplicates: the same full answer set submitted 3+ times.
    signature = df.astype(str).agg("|".join, axis=1)
    group_size = signature.map(signature.value_counts())
    stats["bulk_duplicate_rows"] = int((group_size >= BULK_DUPLICATE_MIN).sum())
    stats["bulk_duplicate_groups"] = int(signature[group_size >= BULK_DUPLICATE_MIN].nunique())
    df = df[group_size < BULK_DUPLICATE_MIN]
    before = len(df)
    df = df[~signature[df.index].duplicated()]
    stats["double_submissions_removed"] = before - len(df)

    # Tidy text answers.
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].astype(str).str.strip().str.replace(r"\s+", " ", regex=True).replace("nan", "")
    df["faculty_field"] = df["faculty_field"].replace({"Sciene": "Science"})
    for col in SKILL_COLUMNS + ["career_confidence"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=SKILL_COLUMNS)

    # Quality flag: all 9 skill ratings identical (possible straight-lining).
    df["straight_liner"] = df[SKILL_COLUMNS].nunique(axis=1).eq(1)

    labels = df["preferred_career_role"].map(map_role)
    df["label_family"] = labels.map(lambda x: x[0])
    df["label_career"] = labels.map(lambda x: x[1])
    df.insert(0, "response_id", range(1, len(df) + 1))
    stats["clean_rows"] = len(df)
    stats["labelled_rows"] = int(df["label_family"].notna().sum())
    stats["straight_liners"] = int(df["straight_liner"].sum())
    return df, stats


def write_report(df: pd.DataFrame, stats: dict) -> None:
    fam = df["label_family"].fillna("(unlabelled)").value_counts()
    car = df["label_career"].dropna().value_counts()
    unlabelled = df.loc[df["label_family"].isna(), "preferred_career_role"].value_counts()
    lines = [
        "# ACRDS survey - data preparation report",
        "",
        "Generated by `ml_training/career/prepare_survey_data.py`.",
        "",
        "## Cleaning summary",
        "",
        "| Step | Rows |",
        "|---|---|",
        f"| Raw survey responses | {stats['raw_rows']} |",
        f"| Removed: machine-speed bursts ({BURST_MIN_RUN}+ submissions in a row, each <= {BURST_SECONDS} s apart) "
        f"| {stats['burst_rows']} |",
        f"| Removed: constant-interval submissions ({REGULAR_WINDOW + 1}+ in a row, spacing variation "
        f"< {REGULAR_MAX_CV:.0%}) | {stats['constant_interval_rows']} |",
        f"| Removed: bulk-duplicated submissions ({stats['bulk_duplicate_groups']} answer set(s) "
        f"repeated {BULK_DUPLICATE_MIN}+ times) | {stats['bulk_duplicate_rows']} |",
        f"| Removed: exact double submissions | {stats['double_submissions_removed']} |",
        f"| **Clean responses** | **{stats['clean_rows']}** |",
        f"| With a usable career label | {stats['labelled_rows']} |",
        f"| Flagged straight-liners (all 9 skill ratings identical, kept) | {stats['straight_liners']} |",
        "",
        "## Label distribution (career family)",
        "",
        "| Family | Responses |", "|---|---|",
        *[f"| {k} | {v} |" for k, v in fam.items()],
        "",
        "## Responses mapped to a specific ACRDS career",
        "",
        "| Career | Responses |", "|---|---|",
        *[f"| {k} | {v} |" for k, v in car.items()],
        "",
        "## Unlabelled role answers (unsure or ambiguous)",
        "",
        *[f"- {k or '(empty)'} ({v})" for k, v in unlabelled.items()],
        "",
    ]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default=os.getenv("CAREER_SURVEY_URL"),
                        help="Survey CSV path or Google Sheet URL (default: CAREER_SURVEY_URL env var)")
    args = parser.parse_args()
    if not args.source:
        parser.error("Provide --source or set CAREER_SURVEY_URL")

    df, stats = prepare(load_source(args.source))
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_CSV, index=False)
    write_report(df, stats)
    print(f"Clean dataset: {OUT_CSV} ({stats['clean_rows']} rows, {stats['labelled_rows']} labelled)")
    print(f"Removed {stats['bulk_duplicate_rows']} bulk-duplicated rows; report: {REPORT}")


if __name__ == "__main__":
    main()
