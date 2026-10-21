"""
Survey cleaning + CBI/PSS scoring + exploratory checks for Component 4 (Burnout).

Run from the backend/ folder:   python ml_training/burnout/evaluate_survey.py
Reads   datasets/burnout/private/survey_raw.csv     (real responses - never commit; the folder is gitignored)
        (an .xlsx also works: the "Clean data" sheet is read)
Writes  datasets/burnout/private/survey_clean.csv   (anonymised, only what Component 4 needs)
Prints  AGGREGATES ONLY, so the output is safe to paste. It never prints a row or a free-text answer.

Columns are found by their QUESTION TEXT, not by position, because Google Forms exports reorder columns
when the form is edited.

Evidence status: the survey is a single snapshot and exploratory. It cannot show prediction over time
(that is the pilot's job). Treat the numbers as "do the signals relate to burnout scores", not validation.
"""
import argparse
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "datasets" / "burnout" / "private"
SEED = 42
BOOT = 2000
BATCH_MIN = 10                  # this many identical full responses = not independent people
MAX_MISSING_SECTION_D = 0.20     # proposal 3.2: exclude responses with >20% of Section D unanswered

# ---------- scales ----------
CBI = {"never": 0, "seldom": 25, "sometimes": 50, "often": 75, "always": 100}          # CBI 0-100 scoring
PSS = {"never": 0, "almost never": 1, "seldom": 1, "sometimes": 2, "fairly often": 3, "very often": 4}  # "seldom" = extra form option, treated as almost never
STRESS = {"never": 0, "rarely": 1, "sometimes": 2, "often": 3, "always": 4}
STUDY_H = {"less than 5 hours": 2.5, "5-10 hours": 7.5, "11-15 hours": 13, "16-20 hours": 18, "more than 20 hours": 22}
TASKS = {"1-2": 1.5, "3-5": 4, "6-8": 7, "more than 8": 9.5}
MODULES = {"1-3": 2, "4-5": 4.5, "6-7": 6.5, "more than 7": 8}

CBI_PERSONAL = [r"feel tired\?", r"physically exhausted", r"emotionally exhausted",
                r"take it anymore", r"feel worn out\?", r"weak and susceptible"]
CBI_STUDY = [r"end of a day of classes", r"exhausted in the morning", r"every hour of studying",
             r"enough energy for family"]                       # last one is reverse-scored
PSS_REVERSE = [r"confident about your ability", r"going your way", r"control irritations", r"on top of things"]


def norm(s):
    return re.sub(r"\s+", " ", str(s)).strip()


def key(v):
    """Normalise an answer for dictionary lookup (case, dashes, spaces)."""
    return norm(v).lower().replace("–", "-").replace("—", "-")


def find(cols, pattern):
    return [i for i, c in enumerate(cols) if re.search(pattern, c, re.I)]


def one(cols, pattern, name):
    hits = find(cols, pattern)
    if len(hits) != 1:
        sys.exit(f"Expected exactly 1 column for '{name}', found {len(hits)} (pattern {pattern!r}). "
                 f"The form headers may have changed - check them.")
    return hits[0]


def score(series, mapping, log, name):
    out = series.map(lambda v: mapping.get(key(v)) if pd.notna(v) else np.nan)
    unmapped = int((series.notna() & out.isna()).sum())
    if unmapped:
        log.append(f"  {name}: {unmapped} answers not in the scoring map (set to missing)")
    return out.astype(float)


def parse_sleep(v):
    if pd.isna(v):
        return np.nan, "missing"
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", norm(v))]
    if not nums or len(nums) > 2:
        return np.nan, "unparseable"
    val = float(np.mean(nums))
    kind = "range" if len(nums) == 2 else "single"
    if not 3 <= val <= 12:
        return np.nan, "implausible (<3 or >12 h)"
    return val, kind


def cronbach(df):
    x = df.dropna()
    k = x.shape[1]
    if len(x) < 10 or k < 2:
        return np.nan
    total_var = x.sum(axis=1).var(ddof=1)
    return k / (k - 1) * (1 - x.var(axis=0, ddof=1).sum() / total_var) if total_var > 0 else np.nan


def spearman_ci(x, y):
    d = pd.concat([x, y], axis=1).dropna()
    n = len(d)
    if n < 15:
        return n, np.nan, (np.nan, np.nan)
    a = d.to_numpy()
    r = spearmanr(a[:, 0], a[:, 1])[0]
    rng = np.random.default_rng(SEED)
    rs = []
    for _ in range(BOOT):
        idx = rng.integers(0, n, n)
        rr = spearmanr(a[idx, 0], a[idx, 1])[0]
        if not np.isnan(rr):
            rs.append(rr)
    lo, hi = np.percentile(rs, [2.5, 97.5])
    return n, r, (lo, hi)


def dist(series, order=None, label=""):
    s = series.dropna().map(key)
    n = len(s)
    vc = s.value_counts()
    keys = order or list(vc.index)
    print(f"  {label} (n={n})")
    for k in keys:
        c = int(vc.get(k, 0))
        print(f"    {k:<22s} {c:4d}  {100 * c / n:5.1f}%")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(PRIVATE / "survey_raw.csv"))
    ap.add_argument("--out", default=str(PRIVATE / "survey_clean.csv"))
    a = ap.parse_args()
    raw = Path(a.raw)
    if not raw.exists():
        sys.exit(f"Put the exported survey at {raw}")
    df = pd.read_excel(raw, sheet_name="Clean data") if raw.suffix.lower() == ".xlsx" else pd.read_csv(raw)
    cols = [norm(c) for c in df.columns]
    log = []
    n_file = len(df)

    # ---- remove automated batches and empty submissions, so raw and pre-cleaned files give the same result ----
    answers = df.iloc[:, 1:]
    sig = answers.apply(lambda r: "|".join(map(str, r.tolist())), axis=1)
    batch = sig.map(sig.value_counts()) >= BATCH_MIN                      # many identical full responses
    few = answers.iloc[:, :5].notna().all(axis=1) & (answers.iloc[:, 5:].notna().sum(axis=1) == 0)   # only first 5 answered
    log.append(f"  removed {int(batch.sum())} rows from identical-answer batches (>= {BATCH_MIN} identical responses)")
    log.append(f"  removed {int((few & ~batch).sum())} rows with only the first 5 questions answered")
    df = df[~(batch | few)].reset_index(drop=True)

    # ---- locate columns by question text ----
    pss_idx = find(cols, r"in the last month, how often have you felt")
    cbi_idx = find(cols, r"rate how often each of the following")
    if len(pss_idx) != 10 or len(cbi_idx) != 10:
        sys.exit(f"Expected 10 PSS and 10 CBI columns, found {len(pss_idx)} and {len(cbi_idx)}.")
    c_sleep = one(cols, r"hours do you usually sleep", "sleep")
    c_stress = one(cols, r"how often does stress affect", "stress affects tasks")
    c_tasks = one(cols, r"academic tasks do you normally", "tasks per week")
    c_dead = one(cols, r"complete tasks before the deadline", "completes before deadline")
    c_study = one(cols, r"hours do you study per week", "study hours")
    c_mods = one(cols, r"subjects or modules", "modules")
    c_move = one(cols, r"moving lower-priority", "moving tasks would help")
    c_auto = one(cols, r"automatically reduce your workload", "wants automatic relief")

    def item(idx_list, pat):
        hits = [i for i in idx_list if re.search(pat, cols[i], re.I)]
        if len(hits) != 1:
            sys.exit(f"Could not identify item {pat!r} uniquely ({len(hits)} matches).")
        return hits[0]

    # ---- score ----
    pss_items = pd.DataFrame({f"pss_{n + 1}": score(df.iloc[:, i], PSS, log, f"PSS item {n + 1}")
                              for n, i in enumerate(pss_idx)})
    rev_cols = [f"pss_{pss_idx.index(item(pss_idx, p)) + 1}" for p in PSS_REVERSE]
    pss_scored = pss_items.copy()
    for c in rev_cols:
        pss_scored[c] = 4 - pss_scored[c]
    pss_total = pss_scored.sum(axis=1, min_count=10)                      # needs all 10 items

    cbi_p_idx = [item(cbi_idx, p) for p in CBI_PERSONAL]
    cbi_s_idx = [item(cbi_idx, p) for p in CBI_STUDY]
    cbi_p = pd.DataFrame({f"cbi_p{n + 1}": score(df.iloc[:, i], CBI, log, f"CBI personal {n + 1}")
                          for n, i in enumerate(cbi_p_idx)})
    cbi_s = pd.DataFrame({f"cbi_s{n + 1}": score(df.iloc[:, i], CBI, log, f"CBI study {n + 1}")
                          for n, i in enumerate(cbi_s_idx)})
    cbi_s["cbi_s4"] = 100 - cbi_s["cbi_s4"]                              # reverse: energy for family/friends
    cbi_personal = cbi_p.mean(axis=1, skipna=False)                      # needs all 6 items
    cbi_study = cbi_s.mean(axis=1, skipna=False)                         # needs all 4 items

    sleep_parsed = df.iloc[:, c_sleep].map(parse_sleep)
    sleep = sleep_parsed.map(lambda t: t[0]).astype(float)
    sleep_kind = sleep_parsed.map(lambda t: t[1])
    stress = score(df.iloc[:, c_stress], STRESS, log, "stress affects tasks")
    tasks = score(df.iloc[:, c_tasks], TASKS, log, "tasks per week")
    study = score(df.iloc[:, c_study], STUDY_H, log, "study hours")
    mods = score(df.iloc[:, c_mods], MODULES, log, "modules")
    deadline = pd.to_numeric(df.iloc[:, c_dead], errors="coerce")

    # ---- inclusion (proposal 3.2 rule, applied to the Section D core items) ----
    core = pd.concat([pss_items, sleep.rename("sleep"), stress.rename("stress")], axis=1)
    core_missing = core.isna().mean(axis=1)
    in_core = core_missing <= MAX_MISSING_SECTION_D
    has_cbi = cbi_personal.notna() & cbi_study.notna()

    clean = pd.DataFrame({
        "pid": [f"S{n + 1:03d}" for n in range(len(df))],
        "in_section_d": in_core.values, "has_cbi": has_cbi.values,
        "pss_total": pss_total, "cbi_personal": cbi_personal, "cbi_study": cbi_study,
        "sleep_h": sleep, "stress_affects": stress, "tasks_week": tasks, "study_hours": study,
        "modules": mods, "completes_before_deadline": deadline,
        "wants_auto_relief": df.iloc[:, c_auto].map(lambda v: key(v) if pd.notna(v) else np.nan),
        "moving_tasks_helps": df.iloc[:, c_move].map(lambda v: key(v) if pd.notna(v) else np.nan),
    })
    clean = pd.concat([clean, pss_scored, cbi_p, cbi_s], axis=1)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    clean.to_csv(a.out, index=False)

    # ================= printed report (aggregates only) =================
    print("=" * 66)
    print("1. SAMPLE")
    print(f"  responses in file                          : {n_file}")
    print(f"  after removing batch/empty rows            : {len(df)}")
    print(f"  Section D core answered (>=80%)            : {int(in_core.sum())}   (rule: exclude if >20% unanswered)")
    print(f"  complete CBI (all 10 items)                : {int(has_cbi.sum())}")
    print(f"  Section D core AND complete CBI            : {int((in_core & has_cbi).sum())}")
    print(f"  complete PSS-10 (all 10 items)             : {int(pss_total.notna().sum())}")

    print("\n2. CLEANING LOG")
    print("  sleep answers:", dict(sleep_kind.value_counts()))
    print(f"  sleep kept as numbers: {int(sleep.notna().sum())}")
    for line in log:
        print(line)
    if not log:
        print("  every scale answer matched the scoring map")
    rows = in_core & has_cbi
    flat_cbi = int((cbi_p[rows].nunique(axis=1) == 1).sum())
    flat_pss = int((pss_items[in_core].dropna().nunique(axis=1) == 1).sum())
    print(f"  straight-lined answers (same choice for every item): CBI personal {flat_cbi}, PSS {flat_pss}  (kept, flagged)")
    print(f"  identical full responses on the scored items: {int(clean.loc[in_core, ['pss_total', 'sleep_h', 'stress_affects']].duplicated().sum())} duplicate score triples (informational)")

    print("\n3. REQUIREMENTS EVIDENCE (section 5.1; respondents passing the Section D rule)")
    k = clean[in_core]
    sd = k["stress_affects"].dropna()
    inv = {v: n for n, v in STRESS.items()}
    print(f"  stress affects task completion (n={len(sd)})")
    for v in (4, 3, 2, 1, 0):
        c = int((sd == v).sum())
        print(f"    {inv[v]:<22s} {c:4d}  {100 * c / len(sd):5.1f}%")
    print(f"    at least 'sometimes'    {int((sd >= 2).sum()):4d}  {100 * (sd >= 2).mean():5.1f}%")
    sl = k["sleep_h"].dropna()
    print(f"  sleep hours per night (n={len(sl)} parsed): mean {sl.mean():.1f}, median {sl.median():.1f}")
    print(f"    <=5 h {100 * (sl <= 5).mean():.1f}% | 5.5-6.5 h {100 * ((sl > 5) & (sl <= 6.5)).mean():.1f}%"
          f" | 7-8 h {100 * ((sl >= 7) & (sl <= 8)).mean():.1f}% | >8 h {100 * (sl > 8).mean():.1f}%")
    dist(k["wants_auto_relief"], label="wants workload reduced automatically when stress is high")
    dist(k["moving_tasks_helps"], label="moving lower-priority tasks would help")

    print("\n4. SCALES (respondents with complete CBI)")
    r = clean[in_core & has_cbi]
    print(f"  CBI personal  (6 items): alpha {cronbach(r[[c for c in cbi_p.columns]]):.2f} | mean {r['cbi_personal'].mean():.1f}"
          f" (SD {r['cbi_personal'].std():.1f}) | >=50: {int((r['cbi_personal'] >= 50).sum())} ({100 * (r['cbi_personal'] >= 50).mean():.0f}%)"
          f" | >=75: {int((r['cbi_personal'] >= 75).sum())} ({100 * (r['cbi_personal'] >= 75).mean():.0f}%)")
    print(f"  CBI study     (4 items, adapted, last item reversed): alpha {cronbach(r[[c for c in cbi_s.columns]]):.2f}"
          f" | mean {r['cbi_study'].mean():.1f}")
    pr = clean[in_core][list(pss_scored.columns)]
    print(f"  PSS-10        (10 items): alpha {cronbach(pr):.2f} | mean {clean.loc[in_core, 'pss_total'].mean():.1f} / 40")
    print("  note: the CBI study scale has only 4 items here, so do not describe it as the validated 7-item scale.")

    print("\n5. EXPLORATORY ASSOCIATIONS with CBI personal burnout (Spearman rho, bootstrap 95% CI)")
    base = clean[in_core & has_cbi]
    tests = [("PSS-10 total", "pss_total", "+ (convergent check)"),
             ("stress affects tasks", "stress_affects", "+"), ("sleep hours", "sleep_h", "-"),
             ("tasks per week", "tasks_week", "+"), ("study hours per week", "study_hours", "+"),
             ("modules", "modules", "+"), ("completes before deadline", "completes_before_deadline", "-")]
    print(f"  {'variable':<28s}{'n':>5s}{'rho':>8s}   95% CI           expected")
    for label, col, exp in tests:
        n, rho, (lo, hi) = spearman_ci(base[col], base["cbi_personal"])
        txt = "too few" if np.isnan(rho) else f"{rho:+.2f}   [{lo:+.2f}, {hi:+.2f}]"
        print(f"  {label:<28s}{n:5d}  {txt:<24s}{exp}")
    print("  If an interval includes 0, say the association is not clearly different from zero.")
    print("\nCleaned file (anonymised) written to:", a.out)


if __name__ == "__main__":
    main()