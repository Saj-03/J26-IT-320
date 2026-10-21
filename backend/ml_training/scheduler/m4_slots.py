"""
M4 (voice planner) - SLOT RULES: find the day, time, duration and deadline in one piece of speech.

    extract("හෙට 8 ඉඳන් 10 SE lecture", today)      -> day=tomorrow, start=08:00, end=10:00
    extract("heta 2 idan 6 wenakam job", today)     -> day=tomorrow, start=14:00, end=18:00
    extract("ML assignment sikurada, paya 3", today) -> deadline=Friday, duration=180
    extract("Tomorrow gym at 7pm", today)            -> day=tomorrow, start=19:00

Rules, not machine learning: dates and times follow fixed patterns, so rules are exact and easy to check.
(The ML part of M4 decides WHAT the piece is - task, lecture, work ... - see train_m4.py.)
The same code is used for evaluation and inside the app. Times are the student's clock time (Sri Lanka).

Order of the steps matters:
    1. durations first ("පැය 3" is not "at 3") - their text is blanked out
    2. time ranges ("2 ඉඳන් 6"), then single times that have a clear cue
    3. day / weekday, deadline words, "ඊට පස්සේ" (after the previous piece)
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, timedelta

from ml_training.scheduler import m4_lexicon as L

# Sinhala letters + vowel signs + joiners: Python's \b does not work inside Sinhala words, so we use our own edges
SI = "඀-෿‌‍"
START = rf"(?<![\w{SI}])"
END = rf"(?![\w{SI}])"
AT_SUFFIX = r"(?:ට|ta|t)"                 # "අටට", "8ta" = at 8
DAY_SUFFIX = r"(?:ට|දී|ta|di)?"           # "සිකුරාදාට", "sikuradata"
COUNT_SUFFIX = r"(?:ක්|යි|ak|k|i)?"       # "තුනක්" = three (of), "2යි" = 2 and


def alt(words) -> str:
    """Regex OR of words, longest first (so "එකොළහ" wins over "එක")."""
    return "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))


# English 13-59: "fifteen", "forty five", "twenty-one"
BIG_WORD = rf"(?:(?:{alt(L.TENS)})(?:[ -](?:{alt(L.UNITS)}))?|{alt(L.TEENS)})"
NUM_WORD = rf"(?:{BIG_WORD}|{alt(L.NUMBER_WORDS)})"
HALF = alt(L.HALF_WORDS)
NUM = rf"(?:\d{{1,2}}(?::\d{{2}})?|{NUM_WORD})"
AMPM = r"(?:a\.?m\.?|p\.?m\.?)"
# minutes said after the hour: "two thirty", "seven fifteen", "eight hundred", "nine o five"
MINUTES_AFTER = rf"(?:\s+(?:hundred|o'?\s?(?:{alt(L.UNITS)})|{BIG_WORD}))"
CLOCK = rf"(?:(?:half past|quarter past|quarter to)\s+)?{NUM}{MINUTES_AFTER}?(?:\s*(?:{HALF}))?(?:\s*{AMPM})?"
POD = alt(L.PART_OF_DAY)
ONE_WORD_NUMBERS = {"එක", "eka"}           # "SE එකට" = "to the SE", not "at 1"


@dataclass
class Slots:
    date: date | None = None              # the day it happens (commitments, routines)
    start: str | None = None              # "HH:MM"
    end: str | None = None
    duration_minutes: int | None = None
    in_minutes: int | None = None         # "in 2 hours", "after 10 minutes" -> starts this long from now
    deadline: date | None = None          # tasks: finish by this day
    after_previous: bool = False          # "ඊට පස්සේ" - comes after the piece before it
    found: list = field(default_factory=list)   # (slot, matched text) - to explain / highlight


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def normalise(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"[–—]", "-", text)
    text = re.sub(r"(\d{1,2})\.(\d{2})(?!\d)", r"\1:\2", text)        # 8.30 -> 8:30
    text = re.sub(r"(?<![a-z])([ap])\.\s?m\.?", r"\1m", text)          # "p. m." -> "pm"
    text = re.sub(r"\bbetween\s+(.+?)\s+and\s+", r"from \1 to ", text)   # "between 2 and 4" -> "from 2 to 4"
    return re.sub(r"\s+", " ", text).strip()


def number(token: str) -> float | None:
    """'3' / '1.5' / 'අට' / 'ata' / 'forty five' -> number."""
    token = token.strip().replace("-", " ")
    if re.fullmatch(r"\d+(?:\.\d+)?", token):
        return float(token)
    if token in L.NUMBER_WORDS:
        return L.NUMBER_WORDS[token]
    if token in L.TEENS:
        return L.TEENS[token]
    parts = token.split()
    if parts and parts[0] in L.TENS and (len(parts) == 1 or (len(parts) == 2 and parts[1] in L.UNITS)):
        return L.TENS[parts[0]] + (L.UNITS[parts[1]] if len(parts) == 2 else 0)
    return None


def clock(token: str) -> tuple[int, int, str | None] | None:
    """'8:30' / 'අට හමාර' / 'half past seven' / '5pm' -> (hour, minute, 'am'/'pm'/None)."""
    t = token.strip()
    ampm = None
    m = re.search(rf"\s*({AMPM})$", t)
    if m:
        ampm = "pm" if m.group(1).startswith("p") else "am"
        t = t[:m.start()].strip()
    minute = 0
    if t.startswith("half past "):
        t, minute = t[len("half past "):], 30
    elif t.startswith("quarter past "):
        t, minute = t[len("quarter past "):], 15
    elif t.startswith("quarter to "):
        t, minute = t[len("quarter to "):], -15
    half = re.search(rf"\s*(?:{HALF})$", t)
    if half:
        t, minute = t[:half.start()].strip(), 30
    if ":" in t:
        h, mm = t.split(":")
        return int(h), int(mm), ampm
    after = re.fullmatch(rf"(?P<h>{NUM_WORD}|\d{{1,2}})\s+(?P<m>hundred|o'?\s?(?:{alt(L.UNITS)})|{BIG_WORD})", t)
    if after:                                    # "two thirty" -> 2:30, "eight hundred" -> 8:00, "nine o five" -> 9:05
        h = number(after["h"])
        m_text = after["m"]
        m_val = 0 if m_text == "hundred" else number(re.sub(r"^o'?\s?", "", m_text))
        if h is None or m_val is None:
            return None
        return int(h), int(m_val), ampm
    n = number(t)
    if n is None:
        return None
    hour = int(n)
    if minute < 0:
        hour, minute = hour - 1, 60 + minute
    return hour, minute, ampm


def to_24h(hour: int, minute: int, ampm: str | None, part: str | None) -> tuple[int, int]:
    """Students rarely say AM / PM. Rules: explicit am/pm > part of day > 1-6 is afternoon, 7-11 morning."""
    if ampm == "am":
        return hour % 12, minute
    if ampm == "pm":
        return hour % 12 + 12, minute
    if part == "morning":
        return hour % 12, minute
    if part in ("afternoon", "evening"):
        return (hour if hour == 12 else hour % 12 + 12), minute
    if part == "night":
        return (hour % 12 + 12 if hour >= 6 else hour % 12), minute
    return (hour + 12 if 1 <= hour <= 6 else hour % 24), minute


def hhmm(h: int, m: int) -> str:
    return f"{h % 24:02d}:{m:02d}"


def blank(text: str, span: tuple[int, int]) -> str:
    """Hide a used part of the text so the next rule does not read it again."""
    return text[:span[0]] + " " * (span[1] - span[0]) + text[span[1]:]


# ---------------------------------------------------------------------------
# the rules
# ---------------------------------------------------------------------------
NUMDEC = rf"(?:\d+(?:\.\d+)?|{NUM_WORD})"
DURATION_RULES = [
    # "පැය භාගයක්", "half an hour"                                        -> 30
    (rf"{START}(?:{alt(L.HALF_HOUR_WORDS)}){END}", lambda m: 30),
    # "පැය 3", "පැය තුනක්", "paya 1.5", "පැය එකහමාරක්"  (Sinhala: unit first) -> hours
    (rf"{START}(?:පැය|paya|peya)\s*(?P<n>{NUMDEC})\s*(?P<half>{HALF})?{COUNT_SUFFIX}{END}",
     lambda m: round((number(m["n"]) + (0.5 if m["half"] else 0)) * 60)),
    # "3 hours", "1.5 hrs", "2h", "three hours"  (English: number first)
    (rf"{START}(?P<n>{NUMDEC})\s*(?:hours|hour|hrs|hr|h){END}", lambda m: round(number(m["n"]) * 60)),
    # "පැයක්", "payak", "an hour"                                         -> 60
    (rf"{START}(?:{alt(L.ONE_HOUR_WORDS)}){END}", lambda m: 60),
    # "විනාඩි 45", "winadi 45"
    (rf"{START}(?:විනාඩි|winadi|vinadi)\s*(?P<n>{NUMDEC}){COUNT_SUFFIX}{END}", lambda m: round(number(m["n"]))),
    # "45 minutes", "45 min", "45m"
    (rf"{START}(?P<n>{NUMDEC})\s*(?:minutes|minute|mins|min|m){END}", lambda m: round(number(m["n"]))),
]
RANGE = re.compile(
    rf"{START}(?:from\s+)?(?:(?P<pod>{POD})\s+)?(?P<a>{CLOCK}){AT_SUFFIX}?\s*(?:{alt(L.RANGE_FROM)})\s*"
    rf"(?P<b>{CLOCK}){AT_SUFFIX}?(?:\s*(?:{alt(L.RANGE_TO)}))?{END}")
SINGLE_TIME = [
    re.compile(rf"{START}(?P<pod>{POD})\s+(?P<t>{CLOCK}){AT_SUFFIX}?{END}"),      # "උදේ 8", "hawasa 4ta"
    re.compile(rf"{START}(?:at|@)\s+(?P<t>{CLOCK}){END}"),                       # "at 7", "at 7pm"
    re.compile(rf"{START}(?P<t>\d{{1,2}}:\d{{2}}(?:\s*{AMPM})?|{NUM}\s*{AMPM}){END}"),   # "9:30", "5pm", "five am"
    re.compile(rf"{START}(?P<t>{CLOCK}){AT_SUFFIX}{END}"),                       # "අටට", "8ta", "අට හමාරට"
    re.compile(rf"{START}(?P<t>(?:half past|quarter past|quarter to)\s+{NUM}){END}"),   # "half past seven"
    re.compile(rf"{START}(?P<t>noon|midday|midnight){END}"),
    re.compile(rf"{START}(?P<t>{NUM}{MINUTES_AFTER}){END}"),                     # "two thirty", "sixteen fifteen"
    re.compile(rf"{START}(?P<t>{NUM})\s+o'?clock{END}"),                         # "five o'clock"
    re.compile(rf"{START}(?P<t>{NUM})\s+in the (?:morning|afternoon|evening|night){END}"),   # "four in the afternoon"
    # "alarm for six", "until 5", "around 8" - durations are already removed, so "for 3 hours" never gets here
    re.compile(rf"{START}(?:for|until|till|around|by)\s+(?P<t>{NUM}){END}(?!\s*(?:people|persons|days|weeks|times|of|items|tasks))"),
]
RELATIVE_DAY = re.compile(rf"{START}(?P<w>{alt(L.RELATIVE_DAYS)}){DAY_SUFFIX}{END}")
WEEKDAY = re.compile(rf"{START}(?:(?P<next>{alt(L.NEXT_WORDS)})\s+)?(?P<w>{alt(L.WEEKDAYS)}){DAY_SUFFIX}{END}")
DEADLINE = re.compile(rf"{START}(?:{alt(L.DEADLINE_WORDS)}){END}")
AFTER = re.compile(rf"^\s*(?:{alt(L.AFTER_WORDS)}){END}")


def part_of_day(text: str) -> str | None:
    m = re.search(rf"{START}(?P<p>{POD}){END}", text)
    return L.PART_OF_DAY[m["p"]] if m else None


def extract(text: str, today: date) -> Slots:
    """All slots in one piece of speech. `today` = the student's date (Sri Lanka)."""
    t = normalise(text)
    out = Slots()
    out.after_previous = bool(AFTER.search(t))

    # 1. durations (summed: "පැය 2යි විනාඩි 30" = 150). "in 2 hours" / "2 hours from now" is WHEN, not how long.
    total, relative = 0, 0
    for pattern, minutes in DURATION_RULES:
        for m in list(re.finditer(pattern, t)):
            before, rest = t[:m.start()], t[m.end():]
            if re.search(rf"{START}(?:{alt(L.RELATIVE_TIME)})\s*$", before) or re.match(r"\s*(?:from now|later)", rest):
                relative += minutes(m)
                out.found.append(("in", m.group(0).strip()))
            else:
                total += minutes(m)
                out.found.append(("duration", m.group(0).strip()))
            t = blank(t, m.span())
    out.duration_minutes = total or None
    out.in_minutes = relative or None

    part = part_of_day(t)
    if part is None and any(w in t for w in L.WAKE_WORDS):
        part = "morning"                                     # "wake me up at 6" is never 6 pm

    # 2a. time range
    m = RANGE.search(t)
    if m:
        a, b = clock(m["a"]), clock(m["b"])
        if a and b:
            p = L.PART_OF_DAY.get(m["pod"]) if m["pod"] else part
            # "2 to 4pm" -> both pm; "9 to 5pm" -> 9 am to 5 pm (the end's am/pm only fits a smaller start)
            start_ampm = a[2] or (b[2] if a[0] % 12 <= b[0] % 12 else None)
            h1, m1 = to_24h(a[0], a[1], start_ampm, p)
            h2, m2 = to_24h(b[0], b[1], b[2], p)
            if (h2, m2) <= (h1, m1) and h2 + 12 < 24:
                h2 += 12                                             # "10 to 2" -> 10:00-14:00
            out.start, out.end = hhmm(h1, m1), hhmm(h2, m2)
            out.found.append(("time_range", m.group(0).strip()))
            t = blank(t, m.span())

    # 2b. single time (only with a clear cue, so "chapter 5" is never a time)
    if out.start is None:
        for pattern in SINGLE_TIME:
            for m in pattern.finditer(t):
                token = m["t"]
                if token in ONE_WORD_NUMBERS:
                    continue                                         # "SE එකට" = to the SE
                if token in ("noon", "midday"):
                    out.start = "12:00"
                elif token == "midnight":
                    out.start = "00:00"
                else:
                    c = clock(token)
                    if c is None or not (0 <= c[0] <= 24 and 0 <= c[1] < 60):
                        continue
                    p = L.PART_OF_DAY.get(m.groupdict().get("pod") or "") or part
                    out.start = hhmm(*to_24h(c[0], c[1], c[2], p))
                out.found.append(("time", m.group(0).strip()))
                t = blank(t, m.span())
                break
            if out.start:
                break

    # 3. day: relative ("හෙට") or weekday ("සිකුරාදා", "ලබන සඳුදා")
    day = None
    m = RELATIVE_DAY.search(t)
    if m:
        day = today + timedelta(days=L.RELATIVE_DAYS[m["w"]])
        out.found.append(("day", m.group(0).strip()))
    else:
        m = WEEKDAY.search(t)
        if m:
            ahead = (L.WEEKDAYS[m["w"]] - today.weekday()) % 7
            if m["next"]:
                ahead = ahead or 7                                   # "next Monday" is never today
            day = today + timedelta(days=ahead)
            out.found.append(("day", m.group(0).strip()))

    # 4. deadline words turn the day into a deadline ("සිකුරාදා වෙනකොට", "by Friday", "sikurada submit")
    if day and DEADLINE.search(t):
        out.deadline = day
        out.found.append(("deadline", DEADLINE.search(t).group(0)))
    else:
        out.date = day
    return out
