"""
Simulation: does learning the tip category per student beat the fixed rules? (run from backend/:  python ml_training/burnout/evaluate_tip_bandit.py)

Simulated students, each with their own hidden chance of trying each tip category. Every tip appears only in a situation the REAL
rules allow (two signals agree; the allowed categories and the rules' default come from tips.py). Three policies pick the category:
  rules  - always the rules' default category (what the system does today)
  random - a random allowed category
  bandit - per-student Thompson sampling with a shared prior (tip_bandit.py), learning from "tried" / "dismissed"
Reward = the student tries the tip. 'oracle' is the ceiling: the best allowed category for that student, known in advance.
Two worlds: HETEROGENEOUS (students differ, which is what the learner is for) and HOMOGENEOUS CONTROL (the rules' default is already
best for everyone, so any exploration is pure cost). The students are simulated, so this shows how the method behaves, not how real
students will respond; the pilot (learned vs rule-only) is the real test.
"""
import random
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.components.burnout import tips
from app.components.burnout.ml import tip_bandit as tb

N_STUDENTS, SEED = 400, 5
HORIZONS = (20, 40)                 # tips seen per student (an 8-week pilot shows a few dozen at most)
CATS = list(tips.TIPS)
SITUATIONS = [["deviation", "journal"], ["deviation", "mood"], ["journal", "mood"], ["journal", "chat"],
              ["mood", "deviation"], ["chat", "journal"], ["deviation", "chat"]]
SIT = [(tips.allowed_categories(a), tips.CATEGORY_FOR[a[0]][0]) for a in SITUATIONS]     # (allowed, rules' default)
POLICIES = ("rules", "random", "bandit")


def students(world, rng):
    out = []
    for _ in range(N_STUDENTS):
        if world == "heterogeneous":
            p = {c: float(np.clip(0.4 + rng.normal(0, 0.22), 0.05, 0.95)) for c in CATS}
        else:                       # rules' defaults are best for everyone
            defaults = {d for _, d in SIT}
            p = {c: (0.6 if c in defaults else 0.3) for c in CATS}
        out.append(p)
    return out


def simulate(world, T):
    rng = np.random.default_rng(SEED)
    pop = students(world, rng)
    res = {}
    for pol in POLICIES + ("oracle",):
        py = random.Random(SEED + 1)
        stats = [dict() for _ in pop]
        tried_all, dismissed_all = 0, 0
        wins = np.zeros((len(pop), T))
        sit_rng = random.Random(SEED + 2)
        for t in range(T):                                   # students move in lockstep so the shared prior can fill up
            prior = tb.prior_from_counts(tried_all, dismissed_all)
            for i, p in enumerate(pop):
                allowed, default = SIT[sit_rng.randrange(len(SIT))]
                if pol == "rules":
                    cat = default
                elif pol == "random":
                    cat = py.choice(allowed)
                elif pol == "oracle":
                    cat = max(allowed, key=lambda c: p[c])
                else:
                    cat, _ = tb.thompson_pick(allowed, stats[i], prior, py, default)
                ok = py.random() < p[cat]
                wins[i, t] = ok
                tr, di = stats[i].get(cat, (0, 0))
                stats[i][cat] = (tr + ok, di + (not ok))
                tried_all += ok; dismissed_all += (not ok)
        res[pol] = wins
    return res


def ci(x):
    m = x.mean(axis=1)
    return m.mean(), 1.96 * m.std(ddof=1) / np.sqrt(len(m))


def main():
    lines = ["# Tip bandit: simulation (simulated students, not real data)", "",
             f"{N_STUDENTS} simulated students per row. Cells: share of tips the student tries, mean +- 95% interval over students.", ""]
    for world, title in (("heterogeneous", "Students differ in what they try (the case the learner is for)"),
                         ("homogeneous", "Control: the rules' default is already best for everyone")):
        lines += [f"## {title}", "", "| Tips seen per student | Rules (today) | Random | Learned (bandit) | Oracle (ceiling) | Learned, last half |",
                  "|---|---|---|---|---|---|"]
        for T in HORIZONS:
            r = simulate(world, T)
            cell = lambda k, half=False: "{:.0%} +-{:.0%}".format(*ci(r[k][:, T // 2:] if half else r[k]))
            lines.append(f"| {T} | {cell('rules')} | {cell('random')} | {cell('bandit')} | {cell('oracle')} | {cell('bandit', True)} |")
        lines.append("")
    lines += ["Reading: where students differ, learning which category each student tries beats the fixed rules, and the gain grows with the",
              "number of tips seen. In the control it costs a little (exploration) and never needs the student to answer anything extra.",
              "Learning is slow because a student sees few tips, which is why the prior is shared. Real students may behave differently: the",
              "pilot (learned vs rule-only, tried / shown) is the real test."]
    text = "\n".join(lines)
    print(text)
    Path(__file__).with_name("tip_bandit_simulation.md").write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
