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
FILLERS = re.compile(
    r"^(?:and then|after that|then|also|plus|so|ok|okay|hey|um|well|please|i need to|i have to|i've got to|"
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


def split_pieces(text: str) -> list[str]:
    """Sentences, then commas, then 'and then / after that' (the connector stays with the next piece)."""
    pieces = []
    for sentence in re.split(r"[.!?;\n]+", text):
        for part in re.split(r",\s*", sentence):
            # split before a connector; "and then" is kept as one connector (not "and" | "then ...")
            joined = re.sub(r"\band\s+then\b", "and_then", part, flags=re.IGNORECASE)
            for piece in re.split(rf"\s+(?={CONNECTORS}\b)", joined, flags=re.IGNORECASE):
                piece = piece.replace("and_then", "and then")
                if piece.strip():
                    pieces.append(piece.strip())
    return pieces


def short_title(piece: str, found: list) -> str:
    """'I have a SE lecture tomorrow from 8 to 10' -> 'SE lecture'."""
    title = piece
    for _, matched in found:
        title = re.sub(re.escape(matched), " ", title, flags=re.IGNORECASE)
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
    # classify without the leading "then / and then / after that" (kept separately as after_previous)
    labels = m4_predictor.classify([re.sub(rf"^(?:and then|{CONNECTORS})\s+", "", p, flags=re.IGNORECASE)
                                    for p in pieces])

    # pieces that only add details ("about 3 hours") belong to the item before them
    merged = []
    for piece, (label, conf, source) in zip(pieces, labels):
        slots = extract(piece, today)
        only_details = label == "other" and slots.found and len(short_title(piece, slots.found).split()) <= 1
        if only_details and merged:
            merged[-1]["text"] += ", " + piece
            continue
        if label == "other" and conf < CHECK_BELOW and slots.start:
            label = "commitment"            # unsure, but it has a clock time: most likely an event (still "check")
        merged.append({"text": piece, "label": label, "confidence": conf, "source": source})

    history = m3_predictor.history(db, user.id) if m3_predictor.available() else []
    items, energy = [], None
    for i, m in enumerate(merged):
        slots = extract(m["text"], today)
        item = {"index": i, "text": m["text"], "type": m["label"], "confidence": m["confidence"],
                "title": short_title(m["text"], slots.found), "kind": None, "date": slots.date,
                "start": slots.start, "end": slots.end, "duration_minutes": slots.duration_minutes,
                "deadline": slots.deadline, "in_minutes": slots.in_minutes, "after_previous": slots.after_previous,
                "load": None, "predicted_minutes": None, "include": m["label"] != "other"}
        missing = False
        if m["label"] == "commitment":
            item["kind"] = first_match(m["text"], COMMITMENT_KIND) or "personal"
            item["date"] = item["date"] or today
            if item["start"] and not item["end"]:
                end = datetime.combine(today, datetime.strptime(item["start"], "%H:%M").time()) + \
                    timedelta(minutes=item["duration_minutes"] or DEFAULT_EVENT_MINUTES)
                item["end"] = end.strftime("%H:%M")
            missing = item["start"] is None
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
            energy = "low" if re.search(LOW_ENERGY, m["text"], re.IGNORECASE) else "high"
            item["kind"] = energy
        item["needs_check"] = m["confidence"] < CHECK_BELOW or missing
        items.append(item)

    return {"items": items, "plan_requested": any(m["label"] == "plan_request" for m in merged),
            "energy": energy, "today": today, "model": labels[0][2] if labels else None}


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
    return out
