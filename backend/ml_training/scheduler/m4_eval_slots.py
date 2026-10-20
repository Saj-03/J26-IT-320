"""
M4 - check the slot rules on REAL English assistant sentences (Amazon MASSIVE, people wrote them, not us).

MASSIVE marks times and dates in each sentence: "wake me up at [time : five am] [date : friday]".
For the calendar + alarm sentences we measure:
    time found     - the sentence has a time  -> did the rules find one?         (recall)
    time correct   - ... and is it the same clock time?                           (when the gold time is a plain clock time)
    false time     - the sentence has NO time -> did the rules wrongly find one? (should be low)
    day found      - the sentence has "today / tomorrow / friday ..."  -> did the rules find the day?
MASSIVE also labels durations ("one hour"), relative times ("in ten minutes") and vague words ("night",
"weekend") as "time". These are scored separately: by kind of gold time -> did we find the right kind of slot.
Sinhala / Singlish are tested in tests/test_m4_slots.py and on the real student test set (MASSIVE has no Sinhala).

Run (from backend/):  python -m ml_training.scheduler.m4_eval_slots      (after fetch_massive)
Out:                  ml_training/scheduler/data/m4_slot_results.json
"""
import json
import re
from datetime import date
from pathlib import Path

from ml_training.scheduler import m4_lexicon as L
from ml_training.scheduler.m4_slots import clock, extract, hhmm, normalise, to_24h

HERE = Path(__file__).resolve().parent
MASSIVE = HERE / "data" / "external" / "massive" / "1.1" / "data" / "en-US.jsonl"
RESULTS = HERE / "data" / "m4_slot_results.json"
INTENTS = {"calendar_set", "alarm_set", "calendar_query", "calendar_remove", "alarm_query"}
TODAY = date(2026, 10, 19)
SIMPLE_DAYS = set(L.RELATIVE_DAYS) | set(L.WEEKDAYS)


def gold_slots(annotated: str) -> dict[str, list[str]]:
    out = {}
    for kind, value in re.findall(r"\[(\w+) : ([^\]]+)\]", annotated):
        out.setdefault(kind, []).append(value.strip())
    return out


def gold_clock(value: str, timeofday: str | None) -> str | None:
    """'five am' / '7:30 pm' / 'nine' -> 'HH:MM' with the same rules; None if not a plain clock time."""
    c = clock(normalise(value).replace("o'clock", "").strip())
    if c is None:
        return None
    part = L.PART_OF_DAY.get(normalise(timeofday)) if timeofday else None
    return hhmm(*to_24h(c[0], c[1], c[2], part))


def time_kind(value: str) -> str:
    """'five pm' -> clock, 'one hour' / 'in ten minutes' -> duration_or_relative, 'night' / 'weekend' -> vague."""
    v = normalise(value)
    if re.search(r"\b(?:minutes?|mins?|hours?|hrs?|seconds?)\b", v):
        return "duration_or_relative"
    if clock(v.replace("o'clock", "").strip()) or re.search(r"\d|\b(?:am|pm|noon|midnight|o'clock)\b", v):
        return "clock"
    return "vague"


def main() -> None:
    rows = [json.loads(line) for line in MASSIVE.open(encoding="utf-8")]
    rows = [r for r in rows if r["intent"] in INTENTS]
    kinds = {k: {"gold": 0, "found": 0} for k in ("clock", "duration_or_relative", "vague")}
    n = {"sentences": len(rows), "with_time": 0, "time_found": 0, "time_checked": 0, "time_correct": 0,
         "without_time": 0, "false_time": 0, "with_simple_day": 0, "day_found": 0}
    misses = []
    for r in rows:
        gold = gold_slots(r["annot_utt"])
        got = extract(r["utt"], TODAY)
        if "time" in gold:
            kind = time_kind(gold["time"][0])
            kinds[kind]["gold"] += 1
            kinds[kind]["found"] += bool(got.start if kind == "clock" else
                                         (got.duration_minutes or got.in_minutes) if kind == "duration_or_relative"
                                         else (got.start or got.duration_minutes or got.in_minutes))
            n["with_time"] += 1
            n["time_found"] += got.start is not None
            want = gold_clock(gold["time"][0], (gold.get("timeofday") or [None])[0])
            if want:
                n["time_checked"] += 1
                if got.start == want:
                    n["time_correct"] += 1
                elif len(misses) < 15:
                    misses.append({"utt": r["utt"], "want": want, "got": got.start})
        else:
            n["without_time"] += 1
            n["false_time"] += got.start is not None
        day = (gold.get("date") or [""])[0].lower()
        if day in SIMPLE_DAYS:
            n["with_simple_day"] += 1
            n["day_found"] += (got.date or got.deadline) is not None

    pct = lambda a, b: round(100 * n[a] / n[b], 1) if n[b] else None
    by_kind = {k: {**v, "found_pct": round(100 * v["found"] / v["gold"], 1) if v["gold"] else None}
               for k, v in kinds.items()}
    useful = kinds["clock"]["found"] + kinds["duration_or_relative"]["found"]
    useful_gold = kinds["clock"]["gold"] + kinds["duration_or_relative"]["gold"]
    report = {"counts": n, "by_kind_of_time": by_kind,
              "time_info_found_pct": round(100 * useful / useful_gold, 1),
              "time_recall_pct": pct("time_found", "with_time"),
              "time_exact_pct": pct("time_correct", "time_checked"),
              "false_time_pct": pct("false_time", "without_time"),
              "simple_day_recall_pct": pct("day_found", "with_simple_day"),
              "examples_of_wrong_times": misses}
    RESULTS.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{n['sentences']} MASSIVE calendar/alarm sentences (real English, written by people)")
    print(f"  time found      {report['time_recall_pct']}%  ({n['time_found']}/{n['with_time']})")
    print(f"  time exact      {report['time_exact_pct']}%  ({n['time_correct']}/{n['time_checked']} plain clock times)")
    print(f"  false time      {report['false_time_pct']}%  ({n['false_time']}/{n['without_time']} sentences with no time)")
    print(f"  day found       {report['simple_day_recall_pct']}%  ({n['day_found']}/{n['with_simple_day']} today/tomorrow/weekday)")
    print("  by kind of gold time:")
    for k, v in by_kind.items():
        print(f"    {k:22s} {v['found_pct']}%  ({v['found']}/{v['gold']})")
    print(f"  clock + duration/relative found: {report['time_info_found_pct']}%  (vague words left out)")
    for m in misses[:8]:
        print(f"    want {m['want']} got {m['got']}: {m['utt']}")


if __name__ == "__main__":
    main()
