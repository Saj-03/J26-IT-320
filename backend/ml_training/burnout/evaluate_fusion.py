"""
Scenario evaluation of the fusion layer (feasibility study, NOT a clinical accuracy claim).

What it does (run from backend/:  python ml_training/burnout/evaluate_fusion.py)
  1. Text check: VADER-based journal risk on 14 hand-written journal lines labelled strained / okay.
  2. Scenarios: 7 scripted students (8 weeks of mock Scheduler behaviour + journals + mood taps), each with the
     level a sensible person would expect. Four variants are compared: mood-only, behaviour-only, text-only, fused.
Everything is scripted by us, so the results show whether the logic behaves sensibly, not how accurate it is on real students.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.components.burnout.ml.deviation_detector import deviation_detail
from app.components.burnout.ml.fusion import fuse, text_risk, REASON_AT
from app.components.burnout.nlp.sentiment import sentiment
from app.shared.integration.mock_signals import mock_deviation_signal

# ------------------------------------------------------------------ 1. text check
JOURNALS = [
    ("I am so exhausted and I cannot cope with these deadlines anymore.", True),
    ("Everything feels overwhelming, I keep falling behind and I am stressed all the time.", True),
    ("I did not sleep again and I feel hopeless about this semester.", True),
    ("I am dreading tomorrow, I feel like I am failing every module.", True),
    ("Too many assignments, I am anxious and I cannot switch off.", True),
    ("I am tired of everything and nothing I do is good enough.", True),
    ("Good day, finished my tasks and still had time to relax.", False),
    ("Feeling fine, a bit busy but manageable.", False),
    ("Had a great lab session and went for a walk with friends.", False),
    ("Submitted the report early, quite proud of myself.", False),
    ("Nothing special today, just lectures and some reading.", False),
    ("Not too bad today, I managed to study for a few hours.", False),
    ("I am fine, just a little tired after the exam.", False),
    ("Deadlines are tough this week but I have a plan and I feel okay.", False),
]


def text_check():
    rows, tp, fp, fn, tn = [], 0, 0, 0, 0
    for t, strained in JOURNALS:
        c = sentiment(t)
        flagged = text_risk(c) > REASON_AT
        tp += flagged and strained; fp += flagged and not strained
        fn += (not flagged) and strained; tn += (not flagged) and not strained
        rows.append((t, strained, c, flagged))
    return rows, tp, fp, fn, tn


# ------------------------------------------------------------------ 2. scenarios
def history(student, bad_now, weeks=7, flat=False):
    p = lambda i, bad: mock_deviation_signal(student, bad_week=bad, seed=i)
    rows = lambda s: [s["task_completion_rate"], s["missed_sessions"], s["task_load"], s["deadline_density"]]
    base = [rows(p(i, False)) for i in range(weeks)]
    return base, rows(p(99, bad_now))


STRAINED = [t for t, s in JOURNALS if s][:3]
OKAY = [t for t, s in JOURNALS if not s][:3]
avg = lambda xs: sum(xs) / len(xs) if xs else None

# name, behaviour (None = no history / True = bad week / False = normal), journals, moods, expected
SCENARIOS = [
    ("S1 Steady week",              False, OKAY,     [4, 5, 4],  "LOW"),
    ("S2 Exam crunch, all signals", True,  STRAINED, [1, 2, 1],  "HIGH"),
    ("S3 Quiet struggle (hidden from the Scheduler)", False, STRAINED, [2, 2, 1], "MODERATE+"),
    ("S4 Busy but coping",          True,  OKAY,     [4, 4, 3],  "NOT HIGH"),
    ("S5 Smiling but overloaded",   True,  OKAY,     [3, 3, 3],  "NOT HIGH"),
    ("S6 New student, low mood only", None, [],      [1, 2, 1],  "NOT HIGH"),
    ("S7 Bounced back",             False, OKAY,     [4, 5, 5],  "LOW"),
]
VARIANTS = {"mood only": ("mood",), "behaviour only": ("deviation",), "text only": ("journal",),
            "fused": ("deviation", "journal", "chat", "mood")}


def ok(level, expected):
    return {"LOW": level == "LOW", "HIGH": level == "HIGH", "MODERATE+": level in ("MODERATE", "HIGH"),
            "NOT HIGH": level != "HIGH"}[expected]


def run_scenarios():
    out = []
    for name, bad, journals, moods, exp in SCENARIOS:
        dev = None
        if bad is not None:
            h, cur = history("S", bad)
            d = deviation_detail(h, cur)
            dev = d["score"]
        j = avg([sentiment(t) for t in journals])
        m = avg(moods)
        res = {v: fuse(dev, j, None, m, enabled=en) for v, en in VARIANTS.items()}
        out.append((name, exp, dev, j, m, res))
    return out


def main():
    lines = ["# Fusion layer: scenario evaluation (scripted students, not real data)", ""]
    rows, tp, fp, fn, tn = text_check()
    prec = tp / (tp + fp) if tp + fp else float("nan"); rec = tp / (tp + fn) if tp + fn else float("nan")
    lines += ["## 1. Journal text check (VADER, flagged when risk > %.1f)" % REASON_AT, "",
              "| Journal line | Strained? | VADER | Flagged |", "|---|---|---|---|"]
    lines += [f"| {t} | {'yes' if s else 'no'} | {c:+.2f} | {'yes' if f else 'no'} |" for t, s, c, f in rows]
    lines += ["", f"Strained lines caught: {tp}/{tp + fn} (recall {rec:.0%}); okay lines wrongly flagged: {fp}/{fp + tn}; precision {prec:.0%}.",
              "Small hand-written set: it shows the behaviour of the method, not its accuracy on real students.", ""]
    res = run_scenarios()
    lines += ["## 2. Scenarios and ablation", "",
              "Level reached by each variant. A tick means it matches what a sensible person would expect.", "",
              "| Scenario | Expected | " + " | ".join(VARIANTS) + " |", "|---|---|" + "---|" * len(VARIANTS)]
    score = {v: 0 for v in VARIANTS}; falsehigh = {v: 0 for v in VARIANTS}
    for name, exp, dev, j, m, r in res:
        cells = []
        for v in VARIANTS:
            lv = r[v]["risk_level"]
            good = ok(lv, exp)
            score[v] += good
            falsehigh[v] += (lv == "HIGH" and exp in ("NOT HIGH", "LOW"))
            cells.append(f"{lv} {'✔' if good else '✘'} ({r[v]['risk_score']:.2f})")
        lines.append(f"| {name} | {exp} | " + " | ".join(cells) + " |")
    n = len(res)
    lines += ["", "| Variant | Matches expected | Wrongly HIGH |", "|---|---|---|"]
    lines += [f"| {v} | {score[v]}/{n} | {falsehigh[v]} |" for v in VARIANTS]
    lines += ["", "Rules built in: a single signal can never reach HIGH, missing signals are skipped, weights are renormalised.",
              "Weights and thresholds are initial heuristics; they are to be reviewed against pilot data."]
    text = "\n".join(lines)
    print(text)
    out = Path(__file__).with_name("fusion_scenarios.md")
    out.write_text(text + "\n", encoding="utf-8")
    print(f"\nWritten to {out}")


if __name__ == "__main__":
    main()
