"""
Component 3 - VOICE PLANNER "Speak your day" (preview step): one spoken / typed paragraph -> editable items.

    "SE lecture tomorrow 8 to 10, then work 2 to 6. Finish the ML report by friday, about 3 hours.
     Buy medicine for mum. I'm tired today. Plan my day."
        -> commitment  "SE lecture"     tomorrow 08:00-10:00
           commitment  "Work"           14:00-18:00   (after the one before)
           task_academic "ML report"    due Friday, 180 min (M2 effort, M3 real time)
           task_personal "Buy medicine for mum"
           energy        low
           plan_request  -> run Plan my week after saving

Steps: split into pieces -> M4 says what each piece is -> slot rules find day / time / duration ->
a short title is made -> tasks get M2 effort + M3 duration. NOTHING is saved here: the student checks and edits
every item first (proposal: the student stays in control). English is evaluated; Sinhala / Singlish rules exist
but are not evaluated yet (future work).
"""
import re
from datetime import datetime, time, timedelta

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.components.scheduler import planner_service, task_service
from app.components.scheduler.commitment_service import SL_OFFSET, create_commitment
from app.components.scheduler.engine import m2_classifier, m3_predictor, m4_predictor
from app.components.scheduler.models import COMMITMENT_KINDS, TASK_TYPES
from app.components.scheduler.schemas import CommitmentCreate, TaskCreate
from app.components.scheduler.settings_service import get_settings
from ml_training.scheduler.m4_slots import extract

CHECK_BELOW = 0.6                      # model less sure than this -> "please check" mark
DEFAULT_TASK_MINUTES = 60
DEFAULT_EVENT_MINUTES = 60
MAX_TEXT = 2000
DEFAULT_DEADLINE_DAYS = {"task_academic": 7, "task_personal": 2}   # no deadline said -> student sees this date
LOW_ENERGY_SHARE = 0.5                 # "I'm tired today" -> plan only half of the usual study time today

CONNECTORS = r"(?:and_then|after that|then|also|plus|ඊට පස්සේ|eeta passe|ita passe)"
# speech-to-text often gives no full stops: "and bread I'm really tired today plan my day" -> 3 pieces
NEW_THOUGHT = r"(?:i'm|i am|plan my|plan the (?:day|week)|please plan)"
TIME_RANGE = r"\b(?:from|between)\s+\d{1,2}(?:[:.]\d\d)?\s*(?:am|pm)?\s*(?:to|and|till|until|-)\s*\d{1,2}(?:[:.]\d\d)?(?:\s*(?:am|pm))?"
AFTER_RANGE = (r"(?:am|pm|a\.m|p\.m|today|tomorrow|tonight|on|every|at|in|this|next|morning|afternoon|evening|night|"
               r"o'clock|mon\w*|tue\w*|wed\w*|thu\w*|fri\w*|sat\w*|sun\w*)")
CLOCK = r"\d{1,2}(?:[:.]\d\d)?\s*(?:am|pm|a\.m\.|p\.m\.)?"
# the speaker corrects themselves - the most common cues in Disfl-QA (see ml_training/scheduler/m4_speech_noise.py)
REPAIR = r"(?:no make that|make that|or rather|no sorry|no wait|no i mean|i mean|i meant|or no|sorry|oops|wait|actually|rather|no)"
NOISE_WORDS = {"yeah", "yes", "yep", "no", "ok", "okay", "sorry", "um", "uh", "umm", "hmm", "and", "also", "so",
               "well", "like", "i", "have", "has", "a", "an", "the", "need", "to", "is", "it", "that", "then",
               "wait", "actually", "mean", "just", "oh", "right", "hi", "hello", "hey", "there"}
LONG_EVENT_MINUTES = 8 * 60            # longer than a work shift -> probably a misheard time, ask to check
ERRAND =r"(?:buy|pick up|pay|call|clean|wash|cook|get|order|book|send|return|collect)"   # "other" + errand verb -> personal task
LEADING_DURATION = re.compile(
    r"^((?:about|around|roughly|maybe|like)?\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?))\s+(\S.*)$", re.IGNORECASE)
FILLERS = re.compile(
    r"^(?:and then|and|after that|then|also|plus|so|ok|okay|hey|um|well|please|i need to|i have to|i've got to|"
    r"i have got to|i've got|i have got|i have an?|i have|i need|need to|have to|i must|i want to|"
    r"i'm going to|i am going to|gotta|remind me to|remember to|don't forget to|add|put|there's an?|there is an?)\s+",
    re.IGNORECASE)
DANGLING = re.compile(r"\s+(?:by|on|at|from|for|about|around|until|till|before|to|in|the|this|and|it|my|a)\s*$",
                      re.IGNORECASE)
COMMITMENT_KIND = [("lecture", r"lecture|class|lab|tutorial|practical|seminar"),
                   ("work", r"work|shift|job|office|internship"),
                   ("extracurricular", r"club|practice|society|match|training|gym|rehearsal|sport")]
TASK_TYPE = [("exam_prep", r"exam|quiz|test|past paper|revise|revision"),
             ("reading", r"read|chapter|notes|article"),
             ("project", r"project|app|system|prototype|website"),
             ("lecture_review", r"lecture recording|review .*lecture|slides")]
LOW_ENERGY = r"tired|exhausted|sleepy|drained|burnt out|burned out|lazy|worn out|no energy|low energy|unwell|not feeling well"
HIGH_ENERGY = r"energetic|energised|energized|fresh|motivated|productive|full of energy|feeling (?:good|great)|pumped"


def clean_speech(text: str) -> str:
    """Fix what Chrome speech-to-text does to times (seen in real use):
        "work from.26"  -> "work from 2 to 6"     ("from two to six" heard as one number)
        "report by 8.30" stays (a dot between digits is a time, not a sentence end)"""
    text = re.sub(r"([A-Za-z])\.(\d)", r"\1 \2", text)
    # self-correction: the LAST time counts ("to 6:00.9:00 PM", "at 6 sorry 7", "at 5 I mean 6")
    text = re.sub(r"\b\d{1,2}:\d\d\s*(?:am|pm)?\s*\.?\s*(?=\d{1,2}:\d\d)", "", text, flags=re.IGNORECASE)
    text = re.sub(rf"\b{CLOCK}\s*[.,]?\s*{REPAIR}\s*[.,]?\s*(?={CLOCK})", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\b(from|between)\s+([1-9])([1-9])\b",
                  lambda m: f"{m[1]} {m[2]} to {m[3]}" if int(m[3]) > int(m[2]) else m[0], text, flags=re.IGNORECASE)
    # "work from 2 to 6 finish the report" (no full stop) -> "work from 2 to 6. finish the report"
    return re.sub(rf"({TIME_RANGE})\s+(?!{AFTER_RANGE}\b)(?=[A-Za-z])", r"\1. ", text, flags=re.IGNORECASE)


def split_pieces(text: str) -> list[str]:
    """Sentences, then commas, then 'and then / after that' (the connector stays with the next piece)."""
    pieces = []
    for sentence in re.split(r"(?<!\d)\.|\.(?!\d)|[!?;\n]+", clean_speech(text)):
        for part in re.split(r",\s*", sentence):
            # split before a connector; "and then" is kept as one connector (not "and" | "then ...")
            joined = re.sub(r"\band\s+then\b", "and_then", part, flags=re.IGNORECASE)
            for piece in re.split(rf"\s+(?={CONNECTORS}\b|{NEW_THOUGHT}\b)", joined, flags=re.IGNORECASE):
                piece = piece.replace("and_then", "and then").strip()
                # "About 3 hours by eggs" -> "About 3 hours" (detail of the item before) | "by eggs"
                lead = LEADING_DURATION.match(piece)
                for part2 in ([lead[1], lead[2]] if lead else [piece]):
                    if part2.strip():
                        pieces.append(part2.strip())
    return pieces


def short_title(piece: str, found: list) -> str:
    """'I have a SE lecture tomorrow from 8 to 10' -> 'SE lecture'."""
    title = piece
    for _, matched in found:
        title = re.sub(re.escape(matched), " ", title, flags=re.IGNORECASE)
    title = re.sub(r"\b\d{1,2}[.:]\d\d\b", " ", title)                  # a clock time the slot rules read
    title = re.sub(r"\s+", " ", title).strip(" ,.-")
    title = re.sub(r"\s+(?:to|on|in|onto)\s+(?:my|the)\s+[\w -]*list$", "", title, flags=re.IGNORECASE)  # "... to my shopping list"
    for _ in range(3):
        title = FILLERS.sub("", title).strip()
        title = DANGLING.sub("", title).strip(" ,.-")
    return (title[:1].upper() + title[1:]) if title else piece


def first_match(text: str, table) -> str | None:
    return next((name for name, pattern in table if re.search(rf"\b(?:{pattern})", text, re.IGNORECASE)), None)


def preview(db: Session, user, text: str, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    local_now = now + SL_OFFSET
    today = local_now.date()
    pieces = split_pieces(text[:MAX_TEXT])
    # speech hears "buy eggs" as "by eggs": a piece that starts with "by" but has no deadline in it
    pieces = [re.sub(r"^by\b", "buy", p, flags=re.IGNORECASE) if re.match(r"by\s", p, re.IGNORECASE)
              and extract(p, today).deadline is None else p for p in pieces]
    # classify without the leading "then / and then / after that" (kept separately as after_previous)
    labels = m4_predictor.classify([re.sub(rf"^(?:and then|and|{CONNECTORS})\s+", "", p, flags=re.IGNORECASE)
                                    for p in pieces])

    # pieces that only add details ("about 3 hours") belong to the item before them
    merged, ignored = [], []
    for piece, (label, conf, source) in zip(pieces, labels):
        slots = extract(piece, today)
        # "Yeah", "Sorry", "And also I have a": spoken filler / unfinished words -> no card, listed as skipped
        words = re.findall(r"[a-z']+", piece.lower())
        if not slots.found and label not in ("plan_request", "energy") and all(w in NOISE_WORDS for w in words):
            ignored.append(piece)
            continue
        # "work from 2 to 6" has a clock time: an event of its own, not a detail of the item before
        only_details = (label == "other" and slots.found and not slots.start
                        and len(short_title(piece, slots.found).split()) <= 1)
        if only_details and merged:
            merged[-1]["text"] += ", " + piece
            continue
        guessed = label == "other" and (slots.start is not None or bool(re.match(ERRAND, piece, re.IGNORECASE)))
        if guessed:                         # still marked "please check"
            # "work from 2 to 6": a clock time -> most likely an event;  "buy eggs" -> a personal job
            label = "commitment" if slots.start is not None else "task_personal"
        merged.append({"text": piece, "label": label, "confidence": conf, "source": source, "guessed": guessed})

    history = m3_predictor.history(db, user.id) if m3_predictor.available() else []
    items, energy = [], None
    for i, m in enumerate(merged):
        slots = extract(m["text"], today)
        item = {"index": i, "text": m["text"], "type": m["label"], "confidence": m["confidence"],
                "title": short_title(m["text"], slots.found), "kind": None, "date": slots.date,
                "start": slots.start, "end": slots.end, "duration_minutes": slots.duration_minutes,
                "deadline": slots.deadline, "in_minutes": slots.in_minutes, "after_previous": slots.after_previous,
                "load": None, "predicted_minutes": None, "include": m["label"] != "other", "warning": None}
        missing = False
        if m["label"] == "commitment":
            item["kind"] = first_match(m["text"], COMMITMENT_KIND) or "personal"
            before = next((it for it in reversed(items) if it["type"] == "commitment"), None)
            if item["date"] is None and item["after_previous"] and before:
                item["date"] = before["date"]               # "lecture tomorrow 8-10, then work 2-6" -> work tomorrow too
            item["date"] = item["date"] or today
            if item["start"] and not item["end"]:
                end = datetime.combine(today, datetime.strptime(item["start"], "%H:%M").time()) + \
                    timedelta(minutes=item["duration_minutes"] or DEFAULT_EVENT_MINUTES)
                item["end"] = end.strftime("%H:%M")
            missing = item["start"] is None
            if item["start"] and item["end"]:
                start, end = (datetime.strptime(item[k], "%H:%M") for k in ("start", "end"))
                if (end - start).seconds // 60 > LONG_EVENT_MINUTES:      # 08:00-18:00 breakfast: a misheard time?
                    item["warning"] = f"That is {(end - start).seconds // 3600} hours. Please check the times."
        elif m["label"] in ("task_academic", "task_personal"):
            item["kind"] = (first_match(m["text"], TASK_TYPE) or "assignment") if m["label"] == "task_academic" else "other"
            if m2_classifier.available():
                item["load"], _ = m2_classifier.classify(item["title"])
            else:
                item["load"] = "medium" if m["label"] == "task_academic" else "low"
            estimate = item["duration_minutes"] or DEFAULT_TASK_MINUTES
            item["duration_minutes"] = estimate
            if m3_predictor.available():
                item["predicted_minutes"] = m3_predictor.predict(estimate, item["load"], item["kind"], history)["minutes"]
            missing = m["label"] == "task_academic" and item["deadline"] is None
        elif m["label"] == "energy":
            level = ("low" if re.search(LOW_ENERGY, m["text"], re.IGNORECASE)
                     else "high" if re.search(HIGH_ENERGY, m["text"], re.IGNORECASE) else None)
            energy = energy or level        # unclear words ("I'm really try") -> no guess, the student decides
            item["kind"] = level
            missing = level is None
        item["needs_check"] = m["confidence"] < CHECK_BELOW or missing or m["guessed"] or bool(item["warning"])
        items.append(item)

    return {"items": items, "plan_requested": any(m["label"] == "plan_request" for m in merged),
            "energy": energy, "today": today, "model": labels[0][2] if labels else None, "ignored": ignored}


# ===========================================================================
# CONFIRM - save the cards the student checked, then (if asked) plan
# ===========================================================================
def _utc(day, clock: time) -> datetime:
    return datetime.combine(day, clock) - SL_OFFSET          # Sri Lanka clock -> UTC


def _as_task(item, today) -> TaskCreate:
    academic = item.type == "task_academic"
    due = item.deadline or today + timedelta(days=DEFAULT_DEADLINE_DAYS[item.type])
    return TaskCreate(
        title=item.title, task_type=(item.kind if item.kind in TASK_TYPES else "assignment") if academic else "other",
        deadline=_utc(due, time(23, 59)), estimated_minutes=item.duration_minutes or DEFAULT_TASK_MINUTES,
        priority=3 if academic else 2,
        cognitive_load=item.load if "load" in item.changed else None)      # unchanged -> M2 decides again


def _as_commitment(item, today) -> CommitmentCreate:
    day = item.date or today
    if item.start is None:
        raise ValueError("a commitment needs a start time")
    start = _utc(day, item.start)
    end = _utc(day, item.end) if item.end else start + timedelta(minutes=item.duration_minutes or DEFAULT_EVENT_MINUTES)
    kind = item.kind if item.kind in COMMITMENT_KINDS and item.kind != "protected_block" else "personal"
    return CommitmentCreate(title=item.title, kind=kind, is_recurring=False, start_at=start, end_at=end)


def confirm(db: Session, user, data, now: datetime | None = None) -> dict:
    now = now or datetime.utcnow()
    today = (now + SL_OFFSET).date()

    # 1. check EVERY card first, so a mistake in card 4 does not leave cards 1-3 half saved
    ready, problems = [], []
    for i, item in enumerate(data.items):
        try:
            ready.append((item, _as_task(item, today) if item.type.startswith("task_") else _as_commitment(item, today)))
        except (ValidationError, ValueError) as e:
            reason = e.errors()[0]["msg"] if isinstance(e, ValidationError) else str(e)
            problems.append({"card": i + 1, "title": item.title, "problem": reason.removeprefix("Value error, ")})
    if problems:
        raise HTTPException(422, problems)

    # 2. save
    tasks, commitments = [], []
    for item, body in ready:
        if isinstance(body, TaskCreate):
            saved = task_service.create_task(db, user, body)
            tasks.append({"id": saved.id, "title": saved.title})
        else:
            saved = create_commitment(db, user, body)
            commitments.append({"id": saved.id, "title": saved.title})

    # 3. learning loop data: what M4 said vs what the student kept (counts and labels only, no spoken text)
    task_service.audit(db, user.id, "brain_dump_confirmed", energy=data.energy, plan=data.plan, dropped=data.dropped,
                       items=[{"model_type": it.model_type, "saved_type": it.type, "confidence": it.confidence,
                               "changed": sorted(set(it.changed))} for it in data.items])
    db.commit()

    # 4. plan (low energy -> a smaller study cap for today only)
    today_cap = None
    if data.energy == "low":
        today_cap = round(get_settings(db, user)["max_study_minutes_per_day"] * LOW_ENERGY_SHARE)
    out = {"tasks": tasks, "commitments": commitments, "planned": False, "sessions": None, "unplaced": None,
           "today_cap_minutes": today_cap}
    if data.plan:
        plan = planner_service.build_plan(db, user, now, today_cap=today_cap)
        out.update(planned=True, sessions=len(plan["sessions"]), unplaced=len(plan["unplaced"]))
    else:
        planner_service.auto_replan(db, user, "brain_dump", now)   # already uses Plan my week -> keep it up to date
    return out
