"""
How arbitrary are the hand-set fusion weights and thresholds? (run from backend/:  python ml_training/burnout/evaluate_sensitivity.py)

Re-runs the 7 scripted scenarios of evaluate_fusion.py with the weights, thresholds and text gain randomly perturbed
(weights and text gain by +-20%, thresholds by +-0.05), and counts how often the fused result still matches what a sensible
person would expect. The scenarios are scripted by us, so this tests robustness of the logic, not accuracy on real students.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.components.burnout.ml import fusion
from evaluate_fusion import SCENARIOS, VARIANTS, ok, history, avg
from app.components.burnout.ml.deviation_detector import deviation_detail
from app.components.burnout.nlp.sentiment import sentiment

RUNS, SEED = 1000, 11
DEFAULT = dict(W=dict(fusion.WEIGHTS), TM=fusion.T_MODERATE, TH=fusion.T_HIGH, RA=fusion.REASON_AT, TG=fusion.TEXT_GAIN)


def inputs():
    out = []
    for name, bad, journals, moods, exp in SCENARIOS:
        dev = None
        if bad is not None:
            h, cur = history("S", bad)
            dev = deviation_detail(h, cur)["score"]
        out.append((name, exp, dev, avg([sentiment(t) for t in journals]), avg(moods)))
    return out


def set_params(W, TM, TH, RA, TG):
    fusion.WEIGHTS.update(W); fusion.T_MODERATE, fusion.T_HIGH, fusion.REASON_AT, fusion.TEXT_GAIN = TM, TH, RA, TG


def evaluate(data, enabled):
    return [ok(fusion.fuse(d, j, None, m, enabled=enabled)["risk_level"], exp) for _, exp, d, j, m in data]


def main():
    rng = np.random.default_rng(SEED)
    data = inputs()
    fused = VARIANTS["fused"]; best_single = {k: v for k, v in VARIANTS.items() if k != "fused"}
    per_scn = np.zeros(len(data)); all7 = 0; counts = []; beats = 0
    for _ in range(RUNS):
        W = {k: v * rng.uniform(.8, 1.2) for k, v in DEFAULT["W"].items()}
        TM = DEFAULT["TM"] + rng.uniform(-.05, .05); TH = DEFAULT["TH"] + rng.uniform(-.05, .05)
        RA = DEFAULT["RA"] + rng.uniform(-.05, .05); TG = DEFAULT["TG"] * rng.uniform(.8, 1.2)
        if TH <= TM:
            TH = TM + .05
        set_params(W, TM, TH, RA, TG)
        r = np.array(evaluate(data, fused))
        per_scn += r; all7 += r.all(); counts.append(r.sum())
        beats += r.sum() >= max(sum(evaluate(data, e)) for e in best_single.values())
    set_params(**DEFAULT)
    lines = ["# Fusion robustness: random perturbation of weights and thresholds (scripted scenarios)", "",
             f"{RUNS} random settings: weights and text gain +-20%, thresholds +-0.05. Default setting for comparison: {sum(evaluate(data, fused))}/7.", "",
             f"- Fused matches all 7 expected outcomes in {all7 / RUNS:.0%} of settings; average {np.mean(counts):.1f}/7 (worst {min(counts)}/7).",
             f"- Fused does at least as well as the best single-signal variant in {beats / RUNS:.0%} of settings.", "",
             "| Scenario | Still as expected |", "|---|---|"]
    lines += [f"| {name} | {per_scn[i] / RUNS:.0%} |" for i, (name, *_ ) in enumerate(data)]
    lines += ["", "Reading: if the percentages are high, the result does not hinge on the exact hand-set numbers.",
              "The weights remain initial heuristics, to be reviewed against pilot data."]
    text = "\n".join(lines); print(text)
    Path(__file__).with_name("fusion_sensitivity.md").write_text(text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
