"""
M4 Step 1 - the English dataset for "what is this piece of speech?" (voice planner).

Labels (7):
    task_academic   "finish the DBMS assignment"            -> a study task to plan
    task_personal   "add milk to my shopping list", "remind me to call mum"
    commitment      "meeting with Peter at 2", "SE lecture 8 to 10", "work shift from 2 to 6"
    routine         "wake me up at 6"
    energy          "I'm really tired today"                 -> the plan gets lighter (student's own words)
    plan_request    "plan my day"                            -> run Plan my week
    other           "what's the weather" - not something to put in a plan

Where each label comes from (reported in the thesis - only some are real human data):
    REAL (Amazon MASSIVE, people wrote them):  commitment (calendar_set), task_personal (lists_createoradd +
        "remind me to ..." in calendar_set), routine (alarm_set), other (questions, music, weather ...)
    REAL (our 241 hand-written student tasks, data/m2_seed_tasks.csv): half -> train, other half -> TEST
        (first try used templates only for training: real tasks were found only 9% of the time - templates
         are too narrow, so real wording must be in training too; the test half is still never seen)
    TEMPLATES (made here): task_academic TRAIN, lecture / work commitments, energy, plan_request
Test templates use DIFFERENT wording from train templates, so the score is not just memorising sentences.

MASSIVE's own split is kept: its train + dev -> our train, its test -> our test.
Run (from backend/):  python -m ml_training.scheduler.m4_dataset      (after fetch_massive)
Out:  data/m4_train.csv, data/m4_test.csv  (git-ignored - made again from the sources)
"""
import itertools
import json
import random
import re
from pathlib import Path

import pandas as pd

from ml_training.scheduler.m4_speech_noise import speechify

HERE = Path(__file__).resolve().parent
MASSIVE = HERE / "data" / "external" / "massive" / "1.1" / "data" / "en-US.jsonl"
SEED_TASKS = HERE / "data" / "m2_seed_tasks.csv"
TRAIN_OUT, TEST_OUT = HERE / "data" / "m4_train.csv", HERE / "data" / "m4_test.csv"
LABELS = ["task_academic", "task_personal", "commitment", "routine", "energy", "plan_request", "other"]
SEED = 42
SPEECH_SHARE = 0.5                             # half of the training sentences get a spoken-style copy
OTHER_TRAIN, OTHER_TEST = 1500, 400            # "other" is huge in MASSIVE - keep a balanced sample
REMIND_TO = re.compile(r"\b(?:remind me to|remember to|don't forget to|do not forget to)\b")

# --- fillers shared by the templates -----------------------------------------
SUBJECTS = ["DBMS", "OOP", "machine learning", "networking", "statistics", "software engineering", "maths",
            "data structures", "operating systems", "web development", "physics", "accounting"]
ACADEMIC_ITEMS = ["assignment", "lab sheet", "report", "project", "tutorial", "past paper", "quiz", "presentation",
                  "case study", "notes", "essay", "proposal"]
DAYS = ["today", "tomorrow", "on monday", "on friday", "this week", "by thursday", "before the weekend", ""]
TIMES = ["at 8", "at 10am", "from 2 to 4", "from 9 to 11", "at 3pm", "8 to 10", "at noon", ""]
PREFIX = ["", "", "honestly", "ugh", "hey", "ok so", "well", "today", "right now"]      # spoken fillers
SUFFIX = ["", "", "today", "this week", "after work", "please", "again", "tonight"]

TEMPLATES = {
    "task_academic": {
        "train": ["finish the {s} {i} {d}", "I need to do my {s} {i} {d}", "work on the {s} {i}",
                  "complete {s} {i} {d}", "study for the {s} exam {d}", "revise {s} chapter 4",
                  "submit the {s} {i} {d}", "prepare the {s} {i} slides", "do {s} {i} questions {d}",
                  "design the {s} {i}", "implement the {s} {i} in python", "write the {s} {i} introduction",
                  "read the {s} lecture notes {d}", "research sources for the {s} {i}", "debug my {s} code",
                  "analyse the data for the {s} {i}", "draft the {s} {i} conclusion", "practise {s} problems {d}",
                  "memorise {s} formulas", "review last week's {s} slides", "solve the {s} tutorial questions"],
        "test": None,                                   # real tasks from m2_seed_tasks.csv
    },
    "commitment": {
        "train": ["{s} lecture {t} {d}", "I have a {s} lab {t} {d}", "{s} tutorial class {t}",
                  "work shift {t} {d}", "office {t} {d}", "part time job {t}", "club practice {t} {d}",
                  "group meeting {t} {d}"],
        "test": ["got {s} class {t} {d}", "there's a {s} practical {t}", "my job is {t} {d}",
                 "I'm working {t} {d}", "society meeting {t} {d}"],
    },
    "energy": {
        "train": ["I'm tired today", "feeling exhausted", "I have low energy today", "really sleepy today",
                  "I'm so tired", "not feeling well today", "I'm burnt out this week", "I feel drained",
                  "I'm full of energy today", "feeling fresh and motivated", "I slept badly so I'm tired",
                  "today I'm a bit lazy"],
        "test": ["kind of worn out today", "I'm wiped out", "I feel super energetic",
                 "too tired to do much today", "honestly I have no energy", "feeling pretty good and rested"],
    },
    "plan_request": {
        "train": ["plan my day", "make a plan for me", "schedule everything", "organise my week",
                  "please plan my week", "create a schedule for today", "sort out my day", "plan tomorrow for me",
                  "make my timetable", "fit all of this into my week"],
        "test": ["can you arrange my day", "work out a plan for tomorrow", "put it all in my calendar for me",
                 "build my study plan", "figure out when I should do everything"],
    },
}


def fill(template: str, rng: random.Random) -> str:
    text = template.format(s=rng.choice(SUBJECTS), i=rng.choice(ACADEMIC_ITEMS),
                           d=rng.choice(DAYS), t=rng.choice(TIMES))
    if "{" not in template:                         # short phrases get spoken fillers around them
        text = f"{rng.choice(PREFIX)} {text} {rng.choice(SUFFIX)}"
    return re.sub(r"\s+", " ", text).strip()


def from_templates(templates: list[str], n: int, rng: random.Random) -> list[str]:
    texts = {fill(rng.choice(templates), rng) for _ in range(n * 3)}
    return sorted(texts)[:n] if len(texts) >= n else sorted(texts)


def massive_label(row: dict) -> str | None:
    intent = row["intent"]
    if intent == "alarm_set":
        return "routine"
    if intent == "lists_createoradd":
        return "task_personal"
    if intent == "calendar_set":
        return "task_personal" if REMIND_TO.search(row["utt"]) else "commitment"
    return "other"                                  # questions, music, weather, calendar look-ups ...


def build() -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = random.Random(SEED)
    rows = [json.loads(line) for line in MASSIVE.open(encoding="utf-8")]
    train, test = [], []
    others = {"train": [], "test": []}
    for r in rows:
        label = massive_label(r)
        split = "test" if r["partition"] == "test" else "train"
        item = {"text": r["utt"], "label": label, "source": f"massive:{r['intent']}"}
        if label == "other":
            others[split].append(item)
        else:
            (test if split == "test" else train).append(item)
    rng.shuffle(others["train"]); rng.shuffle(others["test"])
    train += others["train"][:OTHER_TRAIN]
    test += others["test"][:OTHER_TEST]

    seed = pd.read_csv(SEED_TASKS).sample(frac=1, random_state=SEED)   # real student tasks, shuffled
    half = len(seed) // 2
    train += [{"text": t, "label": "task_academic", "source": "m2_seed_train"} for t in seed["text"][:half]]
    test += [{"text": t, "label": "task_academic", "source": "m2_seed_tasks"} for t in seed["text"][half:]]

    sizes = {"task_academic": 450, "commitment": 300, "energy": 120, "plan_request": 120}
    for label, parts in TEMPLATES.items():
        train += [{"text": t, "label": label, "source": "template"}
                  for t in from_templates(parts["train"], sizes[label], rng)]
        if parts["test"]:
            test += [{"text": t, "label": label, "source": "template_heldout"}
                     for t in from_templates(parts["test"], max(30, sizes[label] // 5), rng)]

    typed = pd.DataFrame(train).drop_duplicates("text")
    test_df = pd.DataFrame(test).drop_duplicates("text")
    test_df = test_df[~test_df["text"].isin(set(typed["text"]))]          # nothing seen in training

    # speech-noise copies (TRAIN only, test untouched): "um", no full stops, self-corrections - m4_speech_noise.py
    texts = list(typed["text"])
    noisy = [{"text": speechify(r.text, rng, texts), "label": r.label, "source": f"speech_noise:{r.source}"}
             for r in typed.itertuples() if rng.random() < SPEECH_SHARE]
    train_df = pd.concat([typed, pd.DataFrame(noisy)], ignore_index=True).drop_duplicates("text")
    train_df = train_df[~train_df["text"].isin(set(test_df["text"]))]
    return train_df.reset_index(drop=True), test_df.reset_index(drop=True)


def main() -> None:
    train, test = build()
    train.to_csv(TRAIN_OUT, index=False)
    test.to_csv(TEST_OUT, index=False)
    print(f"train {len(train)} / test {len(test)}")
    both = pd.concat([train.assign(split="train"), test.assign(split="test")], ignore_index=True)
    print(pd.crosstab(both["label"], both["split"]))


if __name__ == "__main__":
    main()
