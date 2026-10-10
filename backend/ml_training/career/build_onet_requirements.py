"""
Model 2 - Derive career skill requirements from the public O*NET database.

Run from backend/:
    python -m ml_training.career.build_onet_requirements

Source: O*NET 30.2 Database, U.S. Department of Labor (CC BY 4.0).
Occupational analysts and job incumbents rate each occupation on skills,
abilities, knowledge and work activities with an Importance scale (IM, 1-5)
and a Level scale (LV, 0-7).

What it does:
  1. Downloads the five O*NET text files (cached in datasets/career/onet/raw/, not committed).
  2. Maps each ACRDS career to one or two O*NET occupations, and each of the
     9 ACRDS skills to three O*NET elements (two for digital literacy).
  3. Averages the IMPORTANCE ratings -> an evidence-based 1-5 requirement per skill.
  4. Compares them with the hand-set levels in career_requirements.json and
     tests both on the survey (career ranking Hit@k).
Outputs:
  datasets/career/onet/onet_career_skills.csv        (derived requirements)
  datasets/career/onet/onet_elements_extract.csv     (the raw O*NET rows used)
  ml_training/career/reports/onet_requirements_report.md
"""
import json
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from app.components.career.schemas import SKILL_KEYS
from app.components.career.services.recommender import adjusted_cosine_percentage

BACKEND = Path(__file__).resolve().parents[2]
ONET_DIR = BACKEND / "datasets" / "career" / "onet"
RAW_DIR = ONET_DIR / "raw"
REQUIREMENTS = BACKEND / "app" / "components" / "career" / "data" / "career_requirements.json"
SURVEY = BACKEND / "datasets" / "career" / "survey_responses_clean.csv"
REPORT = Path(__file__).resolve().parent / "reports" / "onet_requirements_report.md"

ONET_VERSION = "30.2"
BASE_URL = "https://www.onetcenter.org/dl_files/database/db_30_2_text/"
FILES = ["Skills.txt", "Abilities.txt", "Knowledge.txt", "Work Activities.txt", "Occupation Data.txt"]

# ACRDS career -> O*NET-SOC occupation(s). Two codes are averaged when no single
# occupation matches (e.g. O*NET has no ratings yet for "Web and Digital Interface Designers").
CAREER_OCCUPATIONS = {
    "software_engineer": ["15-1252.00"],
    "data_analyst": ["15-2051.01"],
    "business_analyst": ["13-1111.00", "15-1211.00"],
    "ui_ux_designer": ["27-1024.00", "15-1254.00"],
    "qa_engineer": ["15-1253.00"],
    "cybersecurity_analyst": ["15-1212.00"],
    "network_engineer": ["15-1241.00", "15-1244.00"],
    "database_administrator": ["15-1242.00"],
    "project_manager": ["15-1299.09"],
    "digital_marketing_executive": ["13-1161.01", "13-1161.00"],
}

# ACRDS skill -> O*NET elements (skills, work activities, abilities, knowledge).
SKILL_ELEMENTS = {
    "digital_literacy": ["Working with Computers", "Computers and Electronics"],
    "communication": ["Speaking", "Active Listening", "Communicating with Supervisors, Peers, or Subordinates"],
    "problem_solving": ["Complex Problem Solving", "Critical Thinking", "Making Decisions and Solving Problems"],
    "leadership": ["Management of Personnel Resources", "Guiding, Directing, and Motivating Subordinates",
                   "Coordinating the Work and Activities of Others"],
    "teamwork": ["Coordination", "Developing and Building Teams",
                 "Establishing and Maintaining Interpersonal Relationships"],
    "research": ["Getting Information", "Updating and Using Relevant Knowledge", "Active Learning"],
    "data_analysis": ["Analyzing Data or Information", "Processing Information", "Mathematics"],
    "documentation": ["Writing", "Documenting/Recording Information", "Written Expression"],
    "creativity": ["Thinking Creatively", "Originality", "Fluency of Ideas"],
}


def download_raw() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (ONET_DIR / ".gitignore").write_text("raw/\n", encoding="utf-8")  # ~29 MB, re-downloadable
    for name in FILES:
        target = RAW_DIR / name
        if not target.exists():
            print(f"  downloading {name} ...")
            urllib.request.urlretrieve(BASE_URL + name.replace(" ", "%20"), target)


def load_onet() -> tuple[pd.DataFrame, pd.Series]:
    frames = [pd.read_csv(RAW_DIR / f, sep="\t") for f in FILES if f != "Occupation Data.txt"]
    titles = pd.read_csv(RAW_DIR / "Occupation Data.txt", sep="\t").set_index("O*NET-SOC Code")["Title"]
    return pd.concat(frames, ignore_index=True), titles


def derive(onet: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (career x skill requirement table, raw O*NET rows used)."""
    handset = {c["career_id"]: c["required_skills"] for c in json.loads(REQUIREMENTS.read_text(encoding="utf-8"))}
    used_elements = {e for els in SKILL_ELEMENTS.values() for e in els}
    rows, extract = [], []
    for career, codes in CAREER_OCCUPATIONS.items():
        sub = onet[onet["O*NET-SOC Code"].isin(codes) & onet["Element Name"].isin(used_elements)]
        extract.append(sub.assign(career_id=career))
        for skill in SKILL_KEYS:
            x = sub[sub["Element Name"].isin(SKILL_ELEMENTS[skill])]
            missing = set(SKILL_ELEMENTS[skill]) - set(x["Element Name"])
            if missing:
                raise ValueError(f"O*NET has no data for {missing} in {codes}")
            importance = x[x["Scale ID"] == "IM"]["Data Value"].mean()
            level = x[x["Scale ID"] == "LV"]["Data Value"].mean()
            rows.append({"career_id": career, "skill": skill,
                         "onet_importance": round(importance, 2), "onet_level_0_7": round(level, 2),
                         "onet_required": int(round(importance)), "handset_required": handset[career][skill]})
    cols = ["career_id", "O*NET-SOC Code", "Element ID", "Element Name", "Scale ID", "Data Value", "Date", "Domain Source"]
    return pd.DataFrame(rows), pd.concat(extract)[cols]


def ranking_eval(table: pd.DataFrame) -> list[dict]:
    """Does either requirement set rank the student's stated career higher? (cosine only)"""
    if not SURVEY.exists():
        return []
    df = pd.read_csv(SURVEY)
    df = df[df["label_career"].notna()]
    variants = {
        "Hand-set levels (used in the app)": table.pivot(index="career_id", columns="skill", values="handset_required"),
        "O*NET importance (exact)": table.pivot(index="career_id", columns="skill", values="onet_importance"),
        "O*NET importance (rounded 1-5)": table.pivot(index="career_id", columns="skill", values="onet_required"),
    }
    out = []
    for name, req in variants.items():
        req = req.loc[list(CAREER_OCCUPATIONS)]  # same career order (tie-breaking) as the training report
        ranks = []
        for _, r in df.iterrows():
            vec = [float(r[f"skill_{k}"]) for k in SKILL_KEYS]
            scores = {c: adjusted_cosine_percentage(vec, [float(req.loc[c, k]) for k in SKILL_KEYS]) for c in req.index}
            ranks.append(sorted(scores, key=scores.get, reverse=True).index(r["label_career"]) + 1)
        ranks = np.array(ranks)
        out.append({"variant": name, "n": len(ranks), "hit@1": np.mean(ranks <= 1), "hit@3": np.mean(ranks <= 3),
                    "hit@5": np.mean(ranks <= 5), "mrr": np.mean(1 / ranks)})
    return out


def write_report(table: pd.DataFrame, titles: pd.Series, ranking: list[dict]) -> None:
    diff = (table["onet_required"] - table["handset_required"]).abs()
    L = ["# ACRDS career skill requirements derived from O*NET", "",
         "Generated by `ml_training/career/build_onet_requirements.py`.", "",
         f"Source: O*NET {ONET_VERSION} Database, U.S. Department of Labor, Employment and Training "
         "Administration (CC BY 4.0). Requirement = mean O*NET **importance** rating (1-5) of the mapped elements.", "",
         "## Agreement with the hand-set levels", "",
         f"- Mean absolute difference (rounded O*NET vs hand-set): **{diff.mean():.2f}** levels",
         f"- Identical: {(diff == 0).mean():.0%} · within 1 level: {(diff <= 1).mean():.0%} · "
         f"2+ levels apart: {(diff >= 2).mean():.0%}",
         f"- Pearson correlation across all 90 career-skill pairs: "
         f"**{table['onet_importance'].corr(table['handset_required']):.2f}**", "",
         "## Occupation mapping", "", "| ACRDS career | O*NET occupation(s) |", "|---|---|"]
    for career, codes in CAREER_OCCUPATIONS.items():
        L.append(f"| {career} | " + "; ".join(f"{c} {titles.get(c, '?')}" for c in codes) + " |")
    L += ["", "## Skill mapping", "", "| ACRDS skill | O*NET elements averaged |", "|---|---|",
          *[f"| {s} | {', '.join(e)} |" for s, e in SKILL_ELEMENTS.items()],
          "", "## Requirement levels (O*NET importance / rounded / hand-set)", "",
          "| Career | " + " | ".join(SKILL_KEYS) + " |", "|---|" + "---|" * len(SKILL_KEYS)]
    for career in CAREER_OCCUPATIONS:
        t = table[table["career_id"] == career].set_index("skill")
        L.append(f"| {career} | " + " | ".join(
            f"{t.loc[k, 'onet_importance']:.1f} / {t.loc[k, 'onet_required']} / {t.loc[k, 'handset_required']}"
            for k in SKILL_KEYS) + " |")
    if ranking:
        L += ["", "## Do the O*NET levels rank careers better? (cosine only, survey data)", "",
              f"Students whose stated role maps to an ACRDS career: n = {ranking[0]['n']}. "
              "Random ordering gives Hit@1 0.10, Hit@3 0.30, Hit@5 0.50.", "",
              "| Requirement set | Hit@1 | Hit@3 | Hit@5 | MRR |", "|---|---|---|---|---|",
              *[f"| {r['variant']} | {r['hit@1']:.3f} | {r['hit@3']:.3f} | {r['hit@5']:.3f} | {r['mrr']:.3f} |"
                for r in ranking],
              "", "All variants are close to chance: with self-rated skills, the choice of requirement levels "
              "does not change ranking quality. The O*NET levels are therefore used as external evidence for "
              "the requirement profiles, not as a ranking improvement."]
    L += ["", "## Attribution", "",
          f"This work includes information from the O*NET {ONET_VERSION} Database by the U.S. Department of Labor, "
          "Employment and Training Administration (USDOL/ETA), used under the CC BY 4.0 license. O*NET(R) is a "
          "trademark of USDOL/ETA. The information has been modified (occupations and elements selected and "
          "averaged); USDOL/ETA has not approved, endorsed, or tested these modifications.", ""]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(L), encoding="utf-8")


def main():
    download_raw()
    onet, titles = load_onet()
    table, extract = derive(onet)
    table.to_csv(ONET_DIR / "onet_career_skills.csv", index=False)
    extract.to_csv(ONET_DIR / "onet_elements_extract.csv", index=False)
    ranking = ranking_eval(table)
    write_report(table, titles, ranking)
    diff = (table["onet_required"] - table["handset_required"]).abs()
    print(f"Derived {len(table)} career-skill requirements from O*NET {ONET_VERSION}")
    print(f"Mean absolute difference vs hand-set: {diff.mean():.2f}; within 1 level: {(diff <= 1).mean():.0%}")
    print(f"Outputs: {ONET_DIR}\nReport:  {REPORT}")


if __name__ == "__main__":
    main()
