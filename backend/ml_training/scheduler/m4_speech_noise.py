"""
M4 - make typed training sentences look like SPOKEN ones (speech-noise augmentation).

Speech-to-text text is different from typed text: lower case, no full stops, "um / uh", the speaker corrects
themselves ("at 5 no wait 6"), words that sound the same ("buy" -> "by"), numbers written either way.
M4 was trained on typed text only, so we add a noisy copy of training sentences (TRAIN ONLY - the test set
is never changed, so typed and spoken scores can be compared fairly).

The filler and self-correction phrases are not invented: they are the most common inserted phrases in
Disfl-QA (Gupta et al., ACL 2021, CC BY 4.0), where people rewrote 12k sentences the way they are really
spoken ("What is the second level ... no make that the basic unit ..."). Counted by mine_cues() below.
"""
import json
import random
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
DISFL_QA = HERE / "data" / "external" / "disfl_qa" / "train.json"

# top Disfl-QA phrases (mine_cues(), 7,182 sentences): filler sounds and self-correction cues
FILLERS = ["uh", "um", "er", "umm", "oh", "so", "okay", "yeah", "like", "well"]
REPAIRS = ["no", "sorry", "i mean", "no make that", "or rather", "no wait", "actually", "or no", "no sorry",
           "i meant", "oops", "no i mean", "rather"]
SOUND_ALIKE = {"buy": "by", "two": "to", "four": "for", "write": "right", "hour": "our", "eight": "ate",
               "meet": "meat", "week": "weak", "know": "no", "there": "their"}
NUMBERS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
           "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12"}


# Common non-native English mistakes (Sri Lankan students): small words dropped, wrong verb form.
# The MEANING (and every label) stays the same, so a model trained on these learns to read past grammar.
DROP_AFTER = {"want", "need", "have", "going", "has", "try", "decided", "decide", "plan"}   # "want to go" -> "want go"
ARTICLES = {"a", "an", "the"}
WRONG_FORM = {"decided": "decide", "woke": "wake", "went": "go", "finished": "finish", "studied": "study",
              "going": "go", "has": "have", "goes": "go", "started": "start", "doing": "do", "wanted": "want"}


def grammar_noise(text: str, rng: random.Random) -> str:
    """'I want to go to my office at 8' -> 'I want go my office at 8' (each mistake only sometimes)."""
    words, out = text.split(), []
    for i, w in enumerate(words):
        low = w.lower()
        prev = words[i - 1].lower() if i else ""
        if low == "to" and (prev in DROP_AFTER or prev in ("go", "come")) and rng.random() < 0.6:
            continue                                         # "want to go" / "go to my office"
        if low in ARTICLES and rng.random() < 0.4:
            continue                                         # "I have a lecture" -> "I have lecture"
        if low in WRONG_FORM and rng.random() < 0.35:
            w = WRONG_FORM[low]                              # "I have decided" -> "I have decide"
        out.append(w)
    return " ".join(out) if out else text


def mine_cues(top: int = 40) -> list[tuple[str, int]]:
    """Words / phrases that people ADDED when they spoke a sentence (not in the original sentence)."""
    data = json.loads(DISFL_QA.read_text(encoding="utf-8"))
    count = Counter()
    for pair in data.values():
        original = set(re.findall(r"[a-z']+", pair["original"].lower()))
        spoken = re.findall(r"[a-z']+", pair["disfluent"].lower())
        for n in (1, 2, 3):
            for i in range(len(spoken) - n + 1):
                gram = spoken[i:i + n]
                if not original.intersection(gram):
                    count[" ".join(gram)] += 1
    return count.most_common(top)


def speechify(text: str, rng: random.Random, distractors: list[str] = ()) -> str:
    """One spoken-looking version of a typed sentence (each change happens only sometimes)."""
    words = re.sub(r"[.,!?;:]", " ", text.lower()).split()
    if rng.random() < 0.3:                                       # numbers said as words or digits
        swap = NUMBERS if rng.random() < 0.5 else {v: k for k, v in NUMBERS.items()}
        words = [swap.get(w, w) for w in words]
    if rng.random() < 0.15:                                      # a word that sounds the same
        words = [SOUND_ALIKE.get(w, w) if rng.random() < 0.5 else w for w in words]
    if rng.random() < 0.35:                                      # "um" / "yeah" at the start or middle
        words.insert(rng.choice([0, 0, rng.randint(0, len(words))]), rng.choice(FILLERS))
    if distractors and rng.random() < 0.15:                      # starts wrong, then corrects itself
        wrong = rng.choice(distractors).lower().split()[:rng.randint(1, 3)]
        words = wrong + rng.choice(REPAIRS).split() + words
    return " ".join(words)


if __name__ == "__main__":
    for phrase, n in mine_cues():
        print(f"{n:5}  {phrase}")
