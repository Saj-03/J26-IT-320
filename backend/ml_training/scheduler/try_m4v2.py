"""
Try M4 v2 with your own sentences: where does each new item start?

Run (from backend/), after train_m4v2.py:
    python -m ml_training.scheduler.try_m4v2 "i want go my office at 8 then eat 8 to 9 and study i have exam tomorrow"
    python -m ml_training.scheduler.try_m4v2            (no sentence -> type sentences one by one, empty line = stop)
Shows the old rules and M4 v2 next to each other.
"""
import sys

from app.components.scheduler.ml import m4v2_segmenter
from app.components.scheduler.voice.brain_dump_service import split_pieces
from ml_training.scheduler.m4v2_dataset import words_of


def show(sentence: str) -> None:
    words = words_of(sentence)
    starts = m4v2_segmenter.item_starts(words)
    print("\n  rules (now):", " | ".join(split_pieces(sentence)))
    if starts is None:
        print("  M4 v2      : no model yet - run train_m4v2.py first")
        return
    cuts = [0] + starts + [len(words)]
    print("  M4 v2      :", " | ".join(" ".join(words[a:b]) for a, b in zip(cuts, cuts[1:])))


def main() -> None:
    if len(sys.argv) > 1:
        show(" ".join(sys.argv[1:]))
        return
    while True:
        sentence = input("\nsay your day (empty = stop): ").strip()
        if not sentence:
            break
        show(sentence)


if __name__ == "__main__":
    main()
