"""
M4 v2 Step 1 - data for "where does the next item start?" in a whole spoken day.

Problem found in the speech evaluation (m4_speech_eval.py): when a student says several things in one breath,
speech-to-text gives few or no full stops, and only 35% of the items became their own card - pieces were glued
together. M4 v2 reads the paragraph word by word and marks the word where each new item starts.

How the training data is made (no new human labels needed):
  take 1-5 pieces whose label we already know (M4 data: MASSIVE sentences people wrote, our student tasks,
  templates) and join them the way speech-to-text gives them to us:
     lower case, punctuation mostly gone, sometimes "then / and / also / after that" between them,
     sometimes "um / so / okay", and grammar mistakes ("I want go my office", "I have decide to study").
  Every word gets 1 if a new item starts there, else 0. Where a connector was added ("then"), the new item
  starts AT the connector (the app keeps the connector with the next item).

TRAIN days use 90% of the m4_train.csv pieces, VALIDATION days the other 10% (pieces the model never saw -
used to choose the method), TEST days only m4_test.csv pieces. (First version made validation days from the
SAME pieces as training; that rewarded memorising and picked the wrong method - fixed 2026-10-20.)
A third set uses REAL speech: SLURP recordings turned into text by Whisper (data/m4_speech_asr.csv).

Run (from backend/):  python -m ml_training.scheduler.m4v2_dataset
Out: data/m4v2_train.jsonl, data/m4v2_test.jsonl, data/m4v2_speech_test.jsonl  (git-ignored, made again)
"""
import json
import random
import re
from pathlib import Path

import pandas as pd

from ml_training.scheduler.m4_speech_noise import FILLERS, grammar_noise

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
SEED = 42
N_TRAIN, N_VAL, N_TEST, N_SPEECH = 10800, 1200, 2000, 400
VAL_SHARE = 0.10
CONNECTORS = ["then", "and", "and then", "also", "after that", "so", "plus", "and also"]


def words_of(text: str) -> list[str]:
    """Speech-to-text style: lower case, no punctuation except inside times ('8:30', '8.30', "i'm")."""
    text = re.sub(r"(?<!\d)[.,!?;:](?!\d)|[\"()]", " ", text.lower())
    return text.split()


def make_day(pieces: list[str], rng: random.Random, noisy: bool = True) -> dict:
    tokens, starts = [], []
    for i, piece in enumerate(pieces):
        if noisy and rng.random() < 0.4:
            piece = grammar_noise(piece, rng)
        words = words_of(piece)
        if not words:
            continue
        lead = []
        if i and noisy:
            r = rng.random()
            if r < 0.30:
                lead = rng.choice(CONNECTORS).split()          # "... at 8 then eat ..."
            elif r < 0.40:
                lead = [rng.choice(FILLERS)]                    # "... at 8 um eat ..."
        new = lead + words
        if tokens and noisy and rng.random() < 0.12:
            tokens[-1] += rng.choice([".", ","])                # speech-to-text sometimes adds one
        tokens += new
        starts += [1 if (i and j == 0) else 0 for j in range(len(new))]
    if starts:
        starts[0] = 0                                           # the first item needs no boundary
    return {"tokens": tokens, "starts": starts}


def sample_days(df: pd.DataFrame, n: int, rng: random.Random, noisy: bool = True) -> list[dict]:
    useful = df[df["label"] != "other"]["text"].tolist()
    other = df[df["label"] == "other"]["text"].tolist()
    days = []
    for _ in range(n):
        k = rng.choices([1, 2, 3, 4, 5], weights=[1, 3, 4, 3, 1])[0]
        pieces = [rng.choice(other) if other and rng.random() < 0.25 else rng.choice(useful) for _ in range(k)]
        day = make_day(pieces, rng, noisy)
        day["n_items"] = k
        days.append(day)
    return days


def main() -> None:
    rng = random.Random(SEED)
    pieces = pd.read_csv(DATA / "m4_train.csv").sample(frac=1, random_state=SEED)
    n_val = int(len(pieces) * VAL_SHARE)
    val, train = pieces.iloc[:n_val], pieces.iloc[n_val:]          # split by PIECE, not by day
    test = pd.read_csv(DATA / "m4_test.csv")
    sets = {"m4v2_train.jsonl": sample_days(train, N_TRAIN, rng),
            "m4v2_val.jsonl": sample_days(val, N_VAL, rng),
            "m4v2_test.jsonl": sample_days(test, N_TEST, rng)}
    asr = DATA / "m4_speech_asr.csv"
    if asr.exists():                                            # real speech -> text (Whisper), never trained on
        speech = pd.read_csv(asr, keep_default_na=False)[["asr", "label"]].rename(columns={"asr": "text"})
        sets["m4v2_speech_test.jsonl"] = sample_days(speech, N_SPEECH, rng, noisy=False)
    for name, days in sets.items():
        with (DATA / name).open("w", encoding="utf-8") as f:
            for d in days:
                f.write(json.dumps(d) + "\n")
        words = sum(len(d["tokens"]) for d in days)
        bounds = sum(sum(d["starts"]) for d in days)
        print(f"{name}: {len(days)} days, {words} words, {bounds} item starts")
    ex = sets["m4v2_train.jsonl"][3]
    print("example:", " ".join(f"|{t}" if s else t for t, s in zip(ex["tokens"], ex["starts"])))


if __name__ == "__main__":
    main()
