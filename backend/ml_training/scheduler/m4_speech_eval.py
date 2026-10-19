"""
M4 on REAL SPEECH - how good is the voice planner when people really talk (not type)?

Until now M4 was tested on typed sentences. Real use goes  voice -> speech-to-text -> M4, and speech-to-text
makes mistakes ("from 2 to 6" -> "from.26", "buy" -> "by", no full stops). This script measures that.

Data: SLURP (Bastianelli et al., EMNLP 2020) - real people recorded saying assistant commands.
      Text labels CC BY 4.0, audio CC BY-NC 4.0 (non-commercial research use: OK for this project).
      MASSIVE (used to train M4) was built from SLURP's text, so the SAME labels apply; any sentence that is
      also in M4's training data is removed, so nothing here was seen in training.

Steps:
  1. pick SLURP TEST recordings: calendar_set, alarm_set, lists_createoradd + a sample of "other" intents
     (one close-mic "headset" recording per sentence when there is one = like a laptop / phone mic)
  2. speech-to-text with Whisper (base.en, free, runs on this PC) -> what the app would receive
  3. compare M4 on the human text vs on the speech-to-text text, and the slot rules (clock times)
  4. "spoken day" test: 3-5 commands joined WITHOUT full stops (how browser speech arrives) -> full
     voice planner pipeline (split + M4) -> are the right cards made?

Note: the app uses the BROWSER's speech-to-text (Chrome), not Whisper. Whisper is used here because it can
be run on recordings automatically; both make the same kinds of errors, but the numbers are not identical.

Setup (training only, NOT in requirements.txt - the app does not need it):
    pip install faster-whisper==1.2.1
    SLURP text: dataset/slurp/test.jsonl from github.com/pswietojanski/slurp -> data/external/slurp/
    SLURP audio: zenodo.org/records/4274930/files/slurp_real.tar.gz (3.9 GB) -> data/external/slurp/
Run (from backend/):
    python -m ml_training.scheduler.m4_speech_eval
Out: data/m4_speech_asr.csv (cached transcripts), data/m4_speech_results.json
"""
import json
import os
import random
import re
import tarfile
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SLURP = HERE / "data" / "external" / "slurp"
AUDIO = SLURP / "audio"
ASR_CSV = HERE / "data" / "m4_speech_asr.csv"
RESULTS = HERE / "data" / "m4_speech_results.json"
TRAIN_CSV = HERE / "data" / "m4_train.csv"
TYPED_ONLY_MODEL = HERE / "data" / "external" / "m4_typed_only.joblib"     # the M4 before speech-noise training
WHISPER = "base.en"
SEED = 42
OTHER_SAMPLE = 200
TODAY = date(2026, 10, 19)
LABEL_OF = {"alarm_set": "routine", "lists_createoradd": "task_personal", "calendar_set": "commitment"}
REMIND_TO = re.compile(r"\b(?:remind me to|remember to|don't forget to|do not forget to)\b")


def gold_label(row: dict) -> str:
    """Same rule as m4_dataset.massive_label (MASSIVE = SLURP text)."""
    label = LABEL_OF.get(row["intent"], "other")
    if label == "commitment" and REMIND_TO.search(row["sentence"]):
        return "task_personal"
    return label


# ---------------------------------------------------------------------------
# 1 + 2. choose recordings, take only those files out of the 4 GB archive, speech-to-text
# ---------------------------------------------------------------------------
def choose() -> list[dict]:
    seen = set(pd.read_csv(TRAIN_CSV)["text"].str.lower()) if TRAIN_CSV.exists() else set()
    rows = [json.loads(line) for line in (SLURP / "test.jsonl").open(encoding="utf-8")]
    rows = [r for r in rows if r["sentence"].lower() not in seen and r["recordings"]]
    rng = random.Random(SEED)
    others = [r for r in rows if gold_label(r) == "other"]
    picked = [r for r in rows if gold_label(r) != "other"] + rng.sample(others, min(OTHER_SAMPLE, len(others)))
    out = []
    for r in picked:
        recs = sorted(r["recordings"], key=lambda x: "headset" not in x["file"])      # headset first
        out.append({"slurp_id": r["slurp_id"], "text": r["sentence"], "annot": r["sentence_annotation"],
                    "intent": r["intent"], "label": gold_label(r), "file": recs[0]["file"]})
    return out


def extract_audio(files: set[str]) -> None:
    """Stream through the archive once and write ONLY the chosen recordings (not all 4 GB)."""
    AUDIO.mkdir(parents=True, exist_ok=True)
    missing = {f for f in files if not (AUDIO / f).exists()}
    if not missing:
        return
    with tarfile.open(SLURP / "slurp_real.tar.gz", "r|gz") as tar:
        for member in tar:
            name = os.path.basename(member.name)
            if name in missing:
                member.name = name
                tar.extract(member, AUDIO, filter="data")
                missing.discard(name)
                if not missing:
                    break
    if missing:
        print(f"  {len(missing)} recordings not found in the archive")


def transcribe(items: list[dict]) -> pd.DataFrame:
    if ASR_CSV.exists():
        return pd.read_csv(ASR_CSV, keep_default_na=False)
    os.environ.setdefault("HF_HOME", str(SLURP.parent / "hf"))       # model cache on D:, not the full C:
    from faster_whisper import WhisperModel
    extract_audio({it["file"] for it in items})
    model = WhisperModel(WHISPER, device="cpu", compute_type="int8")
    for i, it in enumerate(items):
        path = AUDIO / it["file"]
        if not path.exists():
            it["asr"] = None
            continue
        segments, _ = model.transcribe(str(path), language="en", beam_size=1, vad_filter=False)
        it["asr"] = " ".join(s.text.strip() for s in segments).strip()
        if i % 100 == 0:
            print(f"  {i}/{len(items)}  {it['text']!r} -> {it['asr']!r}")
    df = pd.DataFrame([it for it in items if it.get("asr")])
    df.to_csv(ASR_CSV, index=False)
    return df


# ---------------------------------------------------------------------------
# 3. M4 + slot rules: human text vs speech-to-text
# ---------------------------------------------------------------------------
def word_error_rate(ref: str, hyp: str) -> float:
    r, h = re.findall(r"[a-z0-9']+", ref.lower()), re.findall(r"[a-z0-9']+", hyp.lower())
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
    return d[len(h)] / max(len(r), 1)


def label_scores(y_true, y_pred) -> dict:
    from sklearn.metrics import accuracy_score, f1_score
    return {"accuracy": round(100 * accuracy_score(y_true, y_pred), 1),
            "macro_f1": round(f1_score(y_true, y_pred, average="macro", zero_division=0), 3)}


def time_scores(df: pd.DataFrame, column: str) -> dict:
    from ml_training.scheduler.m4_eval_slots import gold_clock, gold_slots
    from ml_training.scheduler.m4_slots import extract
    checked = correct = 0
    for _, r in df.iterrows():
        gold = gold_slots(r["annot"])
        want = gold_clock(gold["time"][0], (gold.get("timeofday") or [None])[0]) if "time" in gold else None
        if want:
            checked += 1
            correct += extract(r[column], TODAY).start == want
    return {"clock_times": checked, "exact_pct": round(100 * correct / checked, 1) if checked else None}


# ---------------------------------------------------------------------------
# 4. a spoken day: several commands in one breath, no full stops
# ---------------------------------------------------------------------------
def spoken_days(df: pd.DataFrame, n: int = 150) -> dict:
    from unittest.mock import MagicMock
    from app.components.scheduler import brain_dump_service as bd
    from app.components.scheduler.engine import m3_predictor
    m3_predictor.history = lambda db, uid: []              # no database here
    rng = random.Random(SEED)
    useful = df[df["label"] != "other"].to_dict("records")
    other = df[df["label"] == "other"].to_dict("records")
    matched = wanted = made = 0
    for _ in range(n):
        parts = rng.sample(useful, rng.randint(2, 4)) + rng.sample(other, rng.randint(0, 1))
        rng.shuffle(parts)
        # how browser speech arrives: lower case, few or no full stops
        said = " ".join(re.sub(r"[.,!?]", "", p["asr"]).lower() for p in parts)
        cards = [c for c in bd.preview(MagicMock(), MagicMock(id="u"), said)["items"]
                 if c["type"] in ("commitment", "routine", "task_personal", "task_academic")]
        gold = Counter(p["label"] for p in parts if p["label"] != "other")
        got = Counter(c["type"] for c in cards)
        wanted += sum(gold.values())
        made += len(cards)
        matched += sum((gold & got).values())              # cards of the right type (counted per type)
    return {"days": n, "items_said": wanted, "cards_made": made,
            "item_recall_pct": round(100 * matched / wanted, 1),
            "card_precision_pct": round(100 * matched / made, 1) if made else None}


def use_model(path: Path) -> None:
    from app.components.scheduler.engine import m4_predictor
    m4_predictor.MODEL_FILE = path
    m4_predictor._load.cache_clear()


def scores_for(df: pd.DataFrame) -> dict:
    from app.components.scheduler.engine import m4_predictor
    model = lambda texts: [lab for lab, _, _ in m4_predictor.classify(list(texts))]
    pred = model(df["asr"])
    return {"on_human_text": label_scores(df["label"], model(df["text"])),
            "on_speech_text": label_scores(df["label"], pred),
            "spoken_day": spoken_days(df),
            "examples_wrong_on_speech": [{"said": t, "heard": a, "want": y, "got": p} for t, a, y, p
                                         in zip(df["text"], df["asr"], df["label"], pred) if y != p][:15]}


def main() -> None:
    from ml_training.scheduler.train_m4 import MODEL_OUT, keyword_rules
    df = transcribe(choose())
    print(f"{len(df)} real recordings (SLURP test, not in M4 training), speech-to-text: Whisper {WHISPER}")
    wer = round(100 * sum(word_error_rate(a, b) for a, b in zip(df["text"], df["asr"])) / len(df), 1)
    report = {"recordings": len(df), "labels": df["label"].value_counts().to_dict(), "asr": f"whisper {WHISPER}",
              "word_error_rate_pct": wer,
              "keywords_on_speech_text": label_scores(df["label"], keyword_rules(list(df["asr"]))),
              "times_on_human_text": time_scores(df, "text"),
              "times_on_speech_text": time_scores(df, "asr"), "models": {}}
    # before: M4 trained on typed text only;  after: + speech-noise copies (m4_speech_noise.py)
    for name, path in (("m4_typed_only", TYPED_ONLY_MODEL), ("m4_speech_noise", MODEL_OUT)):
        if path.exists():
            use_model(path)
            report["models"][name] = scores_for(df)
    use_model(MODEL_OUT)
    RESULTS.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for k in ("word_error_rate_pct", "keywords_on_speech_text", "times_on_human_text", "times_on_speech_text"):
        print(f"  {k:24} {report[k]}")
    for name, s in report["models"].items():
        print(f"  {name}:  human {s['on_human_text']}  speech {s['on_speech_text']}  spoken day {s['spoken_day']}")


if __name__ == "__main__":
    main()
