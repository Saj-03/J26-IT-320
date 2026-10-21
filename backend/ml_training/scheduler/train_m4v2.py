"""
M4 v2 Step 2 - learn where each new item starts in a spoken day (token level), and compare 3 ways:

    rules      what the app does now: full stops, commas, "then / and then / after that", "I'm", "plan my"
    logreg     logistic regression on word features (the word, its neighbours, numbers, connectors)
    minilm     MiniLM (same small transformer family as M2) fine-tuned for token classification

The method is chosen on VALIDATION days built from pieces kept out of training (m4v2_val), never on the test.
A simpler method wins when it is within CLOSE of the best (same rule as M2 / M4).

Scores (what matters for the app = every item becomes its own card):
    item P / R / F1   an item counts as found only when BOTH its start and its end are right
    boundary F1       per word "a new item starts here"
Test sets: m4v2_test (held-out pieces) and m4v2_speech_test (REAL speech: SLURP recordings -> Whisper text).

Run (from backend/):  python -m ml_training.scheduler.train_m4v2      (after m4v2_dataset)
Out: ml_models/m4v2_segmenter.joblib (logreg) or ml_models/m4v2_segmenter/ (MiniLM), data/m4v2_results.json
"""
import json
import random
import re
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
MODELS = HERE.parents[1] / "ml_models"
RESULTS = DATA / "m4v2_results.json"
SEED = 42
CLOSE = 0.01
BASE_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CONNECTOR_WORDS = {"then", "and", "also", "after", "plus", "so", "next", "later", "ok", "okay"}
TIME_WORDS = {"am", "pm", "a.m", "p.m", "morning", "evening", "night", "tonight", "tomorrow", "today", "noon"}


def load(name: str) -> list[dict]:
    with (DATA / name).open(encoding="utf-8") as f:
        return [json.loads(line) for line in f]


# ---------------------------------------------------------------------------
# scores
# ---------------------------------------------------------------------------
def items(starts: list[int]) -> set[tuple[int, int]]:
    """[0,0,1,0,1] -> {(0,2), (2,4), (4,5)}  (start, end) of every item."""
    cuts = [0] + [i for i, s in enumerate(starts) if s and i] + [len(starts)]
    return {(a, b) for a, b in zip(cuts, cuts[1:]) if b > a}


def scores(days: list[dict], predicted: list[list[int]]) -> dict:
    tp = fp = fn = btp = bfp = bfn = exact = 0
    for d, p in zip(days, predicted):
        gold, got = items(d["starts"]), items(p)
        tp += len(gold & got); fp += len(got - gold); fn += len(gold - got)
        g = {i for i, s in enumerate(d["starts"]) if s}
        q = {i for i, s in enumerate(p) if s and i}
        btp += len(g & q); bfp += len(q - g); bfn += len(g - q)
        exact += gold == got
    f1 = lambda t, a, b: round(2 * t / (2 * t + a + b), 3) if t else 0.0
    return {"item_precision": round(tp / (tp + fp), 3) if tp + fp else 0.0,
            "item_recall": round(tp / (tp + fn), 3) if tp + fn else 0.0,
            "item_f1": f1(tp, fp, fn), "boundary_f1": f1(btp, bfp, bfn),
            "days_fully_right": round(exact / len(days), 3)}


# ---------------------------------------------------------------------------
# 1. rules = what the app does today
# ---------------------------------------------------------------------------
def rules(days: list[dict]) -> list[list[int]]:
    from app.components.scheduler.voice.brain_dump_service import split_pieces
    from ml_training.scheduler.m4v2_dataset import words_of
    out = []
    for d in days:
        starts, pos = [0] * len(d["tokens"]), 0
        for piece in split_pieces(" ".join(d["tokens"])):
            if 0 < pos < len(starts):
                starts[pos] = 1
            pos += len(words_of(piece))
        out.append(starts)
    return out


# ---------------------------------------------------------------------------
# 2. logistic regression on word features
# ---------------------------------------------------------------------------
def shape(w: str) -> str:
    if re.fullmatch(r"\d+([:.]\d+)?", w):
        return "NUM"
    return "TIME" if w in TIME_WORDS else ("CONN" if w in CONNECTOR_WORDS else "W")


def features(tokens: list[str], i: int) -> dict:
    w = lambda k: tokens[k] if 0 <= k < len(tokens) else "<none>"
    f = {"w": w(i), "p1": w(i - 1), "p2": w(i - 2), "n1": w(i + 1), "n2": w(i + 2),
         "p1w": f"{w(i - 1)}|{w(i)}", "wn1": f"{w(i)}|{w(i + 1)}", "p2p1": f"{w(i - 2)}|{w(i - 1)}",
         "s": shape(w(i)), "sp1": shape(w(i - 1)), "sp2": shape(w(i - 2)), "sn1": shape(w(i + 1)),
         "punct_before": w(i - 1)[-1:] in (".", ","), "first": i == 0}
    return f


def logreg_fit(days):
    from sklearn.feature_extraction import DictVectorizer
    from sklearn.linear_model import LogisticRegression
    X = [features(d["tokens"], i) for d in days for i in range(len(d["tokens"]))]
    y = [s for d in days for s in d["starts"]]
    vec = DictVectorizer()
    clf = LogisticRegression(max_iter=3000, C=2.0)
    clf.fit(vec.fit_transform(X), y)
    return {"vec": vec, "clf": clf}


def logreg_proba(model, days) -> list[np.ndarray]:
    out = []
    for d in days:
        X = model["vec"].transform([features(d["tokens"], i) for i in range(len(d["tokens"]))])
        out.append(model["clf"].predict_proba(X)[:, 1])
    return out


# ---------------------------------------------------------------------------
# 3. MiniLM token classification
# ---------------------------------------------------------------------------
def minilm_fit(days, epochs: int = 3, batch: int = 32, lr: float = 5e-5):
    import torch
    from transformers import AutoModelForTokenClassification, AutoTokenizer, get_linear_schedule_with_warmup
    torch.manual_seed(SEED)
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForTokenClassification.from_pretrained(BASE_MODEL, num_labels=2)
    opt = torch.optim.AdamW(model.parameters(), lr=lr)
    steps = epochs * ((len(days) + batch - 1) // batch)
    sched = get_linear_schedule_with_warmup(opt, int(0.06 * steps), steps)
    weight = torch.tensor([1.0, 3.0])                       # item starts are rare (~8% of words)
    rng = random.Random(SEED)
    model.train()
    for epoch in range(epochs):
        order = list(range(len(days)))
        rng.shuffle(order)
        total = 0.0
        for b in range(0, len(order), batch):
            chunk = [days[i] for i in order[b:b + batch]]
            enc, labels = encode(tok, chunk)
            out = model(**enc)
            loss = torch.nn.functional.cross_entropy(out.logits.view(-1, 2), labels.view(-1),
                                                     weight=weight, ignore_index=-100)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            total += loss.item()
        print(f"    minilm epoch {epoch + 1}/{epochs}  loss {total / (len(order) / batch):.4f}")
    model.eval()
    return {"tok": tok, "model": model}


def encode(tok, days):
    import torch
    enc = tok([d["tokens"] for d in days], is_split_into_words=True, truncation=True, max_length=128,
              padding=True, return_tensors="pt")
    labels = torch.full(enc["input_ids"].shape, -100)
    for row, d in enumerate(days):
        seen = set()
        for j, wid in enumerate(enc.word_ids(row)):
            if wid is not None and wid not in seen:          # label only the first piece of every word
                labels[row, j] = d["starts"][wid]
                seen.add(wid)
    return enc, labels


def minilm_proba(m, days, batch: int = 64) -> list[np.ndarray]:
    import torch
    out = []
    with torch.no_grad():
        for b in range(0, len(days), batch):
            chunk = days[b:b + batch]
            enc = m["tok"]([d["tokens"] for d in chunk], is_split_into_words=True, truncation=True,
                           max_length=128, padding=True, return_tensors="pt")
            probs = torch.softmax(m["model"](**enc).logits, -1)[..., 1].numpy()
            for row, d in enumerate(chunk):
                p, seen = np.zeros(len(d["tokens"])), set()
                for j, wid in enumerate(enc.word_ids(row)):
                    if wid is not None and wid not in seen:
                        p[wid] = probs[row, j]
                        seen.add(wid)
                out.append(p)
    return out


def cut(probs: list[np.ndarray], threshold: float) -> list[list[int]]:
    return [[int(x >= threshold and i > 0) for i, x in enumerate(p)] for p in probs]


def best_threshold(days, probs) -> float:
    return max(np.arange(0.2, 0.81, 0.05), key=lambda t: scores(days, cut(probs, t))["item_f1"])


# ---------------------------------------------------------------------------
def main() -> None:
    import joblib
    train, val = load("m4v2_train.jsonl"), load("m4v2_val.jsonl")
    tests = {"test": load("m4v2_test.jsonl")}
    if (DATA / "m4v2_speech_test.jsonl").exists():
        tests["real_speech"] = load("m4v2_speech_test.jsonl")

    report = {"train_days": len(train), "val_days": len(val), "methods": {}}
    print(f"train {len(train)} / val {len(val)} days")

    t = time.time(); lr = logreg_fit(train); print(f"  logreg trained in {time.time() - t:.0f}s")
    t = time.time(); mini = minilm_fit(train); print(f"  minilm trained in {time.time() - t:.0f}s")
    proba = {"logreg": lambda d: logreg_proba(lr, d), "minilm": lambda d: minilm_proba(mini, d)}
    thresholds = {name: float(best_threshold(val, f(val))) for name, f in proba.items()}

    def predict(name, days):
        return rules(days) if name == "rules" else cut(proba[name](days), thresholds[name])

    for name in ["rules", "logreg", "minilm"]:
        row = {"val": scores(val, predict(name, val))}
        for tname, tdays in tests.items():
            row[tname] = scores(tdays, predict(name, tdays))
        if name in thresholds:
            row["threshold"] = round(thresholds[name], 2)
        report["methods"][name] = row

    # choose on VALIDATION: the simpler method wins if it is within CLOSE of the best
    val_f1 = {n: report["methods"][n]["val"]["item_f1"] for n in ("logreg", "minilm")}
    chosen = "logreg" if val_f1["logreg"] >= val_f1["minilm"] - CLOSE else "minilm"
    report["chosen"] = chosen
    print(f"\nchosen on validation: {chosen}  (val item F1 {val_f1})\n")
    print(f"{'method':8} {'set':12} {'itemP':>6} {'itemR':>6} {'itemF1':>7} {'boundF1':>8} {'days ok':>8}")
    for name, row in report["methods"].items():
        for sname in ["val"] + list(tests):
            s = row[sname]
            print(f"{name:8} {sname:12} {s['item_precision']:6.3f} {s['item_recall']:6.3f} {s['item_f1']:7.3f}"
                  f" {s['boundary_f1']:8.3f} {s['days_fully_right']:8.3f}")

    MODELS.mkdir(exist_ok=True)
    if chosen == "logreg":
        joblib.dump({"kind": "logreg", "threshold": thresholds["logreg"], **lr}, MODELS / "m4v2_segmenter.joblib")
        saved = MODELS / "m4v2_segmenter.joblib"
    else:
        folder = MODELS / "m4v2_segmenter"
        mini["model"].half().save_pretrained(folder)          # fp16: half the file size, same answers
        mini["tok"].save_pretrained(folder)
        (folder / "threshold.json").write_text(json.dumps({"threshold": thresholds["minilm"]}))
        saved = folder
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nsaved {saved} and {RESULTS}")


if __name__ == "__main__":
    main()
