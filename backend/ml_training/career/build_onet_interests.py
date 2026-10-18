"""
Career interest profiles (Holland RIASEC) from the public O*NET database - used by the Career Fit Quiz.

Run from backend/:
    python -m ml_training.career.build_onet_interests

Source: O*NET 30.2 Database, Interests.txt (U.S. Department of Labor, CC BY 4.0).
O*NET rates every occupation on the six Holland interest types with an
"Occupational Interest" (OI) score from 1 (not typical) to 7 (very typical):
  R Realistic (hands-on, tools, machines)    I Investigative (analysing, research)
  A Artistic (creating, designing)           S Social (helping, teaching)
  E Enterprising (leading, persuading)       C Conventional (organising, records)

What it does:
  1. Downloads Interests.txt (cached in datasets/career/onet/raw/, not committed).
  2. Uses the same ACRDS career -> O*NET occupation mapping as build_onet_requirements.py
     (two codes are averaged when no single occupation matches).
  3. Writes app/components/career/data/career_interests.json (one 1-7 score per type, per career).
"""
import json
import re
import urllib.request
from pathlib import Path

import pandas as pd

from ml_training.career.build_onet_requirements import BASE_URL, CAREER_OCCUPATIONS, ONET_VERSION, RAW_DIR

BACKEND = Path(__file__).resolve().parents[2]
DATA = BACKEND / "app" / "components" / "career" / "data"
OUT = DATA / "career_interests.json"
TYPES = {"Realistic": "R", "Investigative": "I", "Artistic": "A", "Social": "S", "Enterprising": "E", "Conventional": "C"}
CODE = re.compile(r"\d{2}-\d{4}\.\d{2}")


def career_codes() -> dict:
    """career_id -> O*NET codes: the 10 original careers from CAREER_OCCUPATIONS, the other 19 from
    the codes recorded in required_skills_source when their requirements were derived."""
    careers = json.loads((DATA / "career_requirements.json").read_text(encoding="utf-8"))
    codes = {}
    for c in careers:
        found = CAREER_OCCUPATIONS.get(c["career_id"]) or CODE.findall(c.get("required_skills_source", ""))
        if not found:
            raise ValueError(f"No O*NET occupation for {c['career_id']}")
        codes[c["career_id"]] = found
    return codes


def main() -> None:
    target = RAW_DIR / "Interests.txt"
    if not target.exists():
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(BASE_URL + "Interests.txt", target)
    df = pd.read_csv(target, sep="\t")
    df = df[(df["Scale ID"] == "OI") & df["Element Name"].isin(TYPES)]
    out = {}
    for career, codes in career_codes().items():
        sub = df[df["O*NET-SOC Code"].isin(codes)]
        if sub["O*NET-SOC Code"].nunique() != len(codes):
            raise ValueError(f"O*NET has no interest data for some of {codes} ({career})")
        means = sub.groupby("Element Name")["Data Value"].mean()
        out[career] = {"onet_codes": codes, "riasec": {TYPES[name]: round(float(means[name]), 2) for name in TYPES}}
    OUT.write_text(json.dumps({
        "_source": f"O*NET {ONET_VERSION} Interests.txt (CC BY 4.0), Occupational Interest scores 1-7, "
                   "averaged over the occupations in onet_codes. Built by ml_training/career/build_onet_interests.py.",
        "careers": out,
    }, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({len(out)} careers)")
    for career, v in out.items():
        top = sorted(v["riasec"], key=v["riasec"].get, reverse=True)[:3]
        print(f"  {career:32s} {''.join(top)}  {v['riasec']}")


if __name__ == "__main__":
    main()
