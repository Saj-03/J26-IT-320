"""
Component 3 - MODULE D: constraint-based scheduler with Google OR-Tools CP-SAT (FR-04, FR-14).

Idea:
    1. cut every open task into EQUAL focus-sized pieces (120 min, 50-min focus -> 3 x 40 min)
    2. for every task and every possible start time, CP-SAT answers yes/no:
       "does a piece of this task start here?"
    3. the pieces of a task are numbered 1, 2, 3 ... by time afterwards (so no order rules are needed)

HARD rules (a plan that breaks one is never returned):
    * a piece is only placed inside free time (study window minus lectures / work / rest blocks)
    * a piece ends before its task's deadline
    * two pieces never overlap (the break after a piece is kept free too)
    * at most MAX_PIECES_PER_TASK_PER_DAY pieces of one task per day (spacing, no cramming)
    * at most `day_cap_minutes` of study per day (student setting)

SOFT goals (the objective - CP-SAT finds the best mix):
    1. place as much work as possible, important / urgent work first
    2. ADAPTIVE mode only: put a piece where the M1 model gives the highest chance of finishing it
       (heavy work counts 3x, medium 2x, light 1x -> heavy work wins the peak hours)
    3. sooner is better than later (more for important / urgent tasks)

STATIC mode (the experiment baseline) = same rules without goal 2 and with fixed 60-min pieces,
so the only difference between the two pilot conditions is the attention learning.

Everything here is plain Python (no database), so it is easy to test.
"""
import bisect
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable

from ortools.sat.python import cp_model

STEP_MINUTES = 15                  # time grid: pieces start on :00, :15, :30 or :45
MAX_PIECES_PER_TASK_PER_DAY = 2
STATIC_PIECE_MINUTES = 60          # baseline: normal 1-hour calendar blocks
TIME_LIMIT_SECONDS = 1.2           # NFR-01: a plan must come back within 2 s (model building included)

# objective weights (all integers - CP-SAT works with whole numbers)
PLACE_POINTS = 10_000              # placing a piece is worth far more than any other goal
PRIORITY_POINTS = 1_000            # x priority 1..5
URGENT_POINTS = 2_000              # deadline within URGENT_HOURS
URGENT_HOURS = 72
LOAD_WEIGHT = {"heavy": 3, "medium": 2, "low": 1}
FIT_POINTS = 100                   # x chance (0..1) x load weight


@dataclass
class WorkItem:
    """One open task the scheduler should place."""
    task_id: str
    minutes: int                   # work left
    deadline: datetime             # UTC
    priority: int = 3              # 1..5
    load: str = "medium"           # heavy / medium / low
    earliest: datetime | None = None   # not before this (a stress proposal moved the task later)


def piece_plan(minutes: int, piece_minutes: int) -> tuple[int, int]:
    """(how many pieces, minutes each):  120 min with 50-min focus -> (3, 40);  300 -> (6, 50)."""
    count = math.ceil(minutes / piece_minutes)
    return count, math.ceil(minutes / count)


def schedule(items: list[WorkItem], free: list[tuple[datetime, datetime]], now: datetime, *,
             piece_minutes: int, break_minutes: int, day_cap_minutes: int,
             study_day: Callable[[datetime], object], local_hour: Callable[[datetime], int],
             fit: Callable[[int, int, str], float] | None = None,
             day_caps: dict | None = None,
             after: dict[str, list[str]] | None = None,
             chains: dict[str, list[str]] | None = None,
             time_limit: float = TIME_LIMIT_SECONDS) -> dict:
    """
    items      : open tasks (work left > 0)
    free       : free time as (start, end) in UTC, already without commitments and past time
    fit        : ADAPTIVE mode -> fit(local_hour, minutes, load) = M1 chance 0..1;  None -> STATIC mode
    study_day / local_hour : turn a UTC time into the Sri Lanka study day / clock hour
    day_caps   : {study day: minutes} for days with a different cap (e.g. "I'm tired today" -> half)
    after      : {task: [tasks that must be FINISHED first]} - FR-04 dependency constraints
    chains     : {name: [step 1, step 2, ...]} - steps of one big task, done in this order (see _merge_chains)

    Returns {"sessions": [...], "unplaced": [...], "status": "..."}
    """
    chains = {name: [m for m in members if m in {it.task_id for it in items}] for name, members in (chains or {}).items()}
    chains = {name: members for name, members in chains.items() if len(members) > 1}
    if chains:                                                         # plan each chain as one item, then split
        merged_items, merged_after, by_id = _merge_chains(items, after, chains)
        out = schedule(merged_items, free, now, piece_minutes=piece_minutes, break_minutes=break_minutes,
                       day_cap_minutes=day_cap_minutes, study_day=study_day, local_hour=local_hour, fit=fit,
                       day_caps=day_caps, after=merged_after, time_limit=time_limit)
        return _split_chains(out, chains, by_id)
    origin = _round_up(now)
    items = [it for it in items if it.minutes > 0]
    plan = {it.task_id: piece_plan(it.minutes, piece_minutes) for it in items}     # task -> (count, size)
    moment = lambda cell: origin + timedelta(minutes=cell * STEP_MINUTES)
    model = cp_model.CpModel()

    # ------------------------------------------------------------------
    # 1. Variables: starts[task, cell] = yes/no "a piece of this task starts in this 15-min cell"
    # ------------------------------------------------------------------
    starts = {}
    for it in items:
        _, size = plan[it.task_id]
        for t in _possible_starts(free, max(origin, _round_up(it.earliest or origin)), size, it.deadline):
            cell = _cell(origin, t)
            starts[it.task_id, cell] = model.NewBoolVar(f"{it.task_id} @ {cell}")

    # ------------------------------------------------------------------
    # 2. Hard rules
    # ------------------------------------------------------------------
    by_task, by_cell, by_day = {}, {}, {}
    for (task_id, cell), var in starts.items():
        count, size = plan[task_id]
        by_task.setdefault(task_id, []).append(var)
        for c in range(cell, cell + _cells(size + break_minutes)):       # piece + break use these cells
            by_cell.setdefault(c, []).append(var)
        by_day.setdefault(study_day(moment(cell)), []).append((task_id, size, var))

    for it in items:                                                   # not more pieces than the task has
        model.Add(sum(by_task.get(it.task_id, [])) <= plan[it.task_id][0])
    for users in by_cell.values():                                     # never two pieces at once
        if len(users) > 1:
            model.AddAtMostOne(users)
    for day, entries in by_day.items():
        cap = (day_caps or {}).get(day, day_cap_minutes)
        model.Add(sum(size * var for _, size, var in entries) <= cap)                  # daily study cap
        for it in items:                                               # spacing: max 2 pieces a day
            mine = [var for task_id, _, var in entries if task_id == it.task_id]
            if len(mine) > MAX_PIECES_PER_TASK_PER_DAY:
                model.Add(sum(mine) <= MAX_PIECES_PER_TASK_PER_DAY)

    # FR-04 dependency: every piece of B starts after the end of EVERY piece of A.
    # Time-indexed precedence: late[j] = how many A pieces start at A's j-th possible cell or later;
    # B may start at cell t only if no A piece is still running after t. Each constraint has 2 variables.
    # (Two earlier versions - "only if" constraints and big-M start/end variables - made CP-SAT return no
    # plan in 1.2 s for a chain of 10 steps.)
    cells_of = {}
    for (task_id, cell), var in starts.items():
        cells_of.setdefault(task_id, []).append((cell, var))
    late_of = {}

    def suffix_counts(task_id):                                        # late[j] for A's cells in time order
        if task_id not in late_of:
            options = sorted(cells_of[task_id], key=lambda cv: cv[0])
            count = plan[task_id][0]
            late = [model.NewIntVar(0, count, f"late {task_id} {j}") for j in range(len(options) + 1)]
            model.Add(late[-1] == 0)
            for j, (_, var) in enumerate(options):
                model.Add(late[j] == late[j + 1] + var)
            late_of[task_id] = ([c for c, _ in options], late)
        return late_of[task_id]

    for task_id, firsts in (after or {}).items():
        for first in firsts:
            if task_id not in cells_of or first == task_id:
                continue
            if first not in cells_of:                                  # A can not be planned at all -> neither B
                for _, var in cells_of[task_id]:
                    model.Add(var == 0)
                continue
            first_cells, late = suffix_counts(first)
            size = _cells(plan[first][1])
            count = plan[first][0]
            for cell, var in cells_of[task_id]:
                j = bisect.bisect_right(first_cells, cell - size)      # A pieces starting here or later end after t
                if j < len(first_cells):
                    model.Add(late[j] <= count * (1 - var))
            # nothing of B while nothing of A is planned ("step 2" never comes before "step 1")
            model.Add(sum(v for _, v in cells_of[task_id]) <= plan[task_id][0] * late[0])

    # ------------------------------------------------------------------
    # 3. Soft goals: every yes gets a score, CP-SAT maximises the total
    # ------------------------------------------------------------------
    item_of = {it.task_id: it for it in items}
    chance_cache = {}

    def chance(when, minutes, load):
        key = (local_hour(when), minutes, load)
        if key not in chance_cache:
            chance_cache[key] = fit(*key)
        return chance_cache[key]

    def score(task_id, cell):
        it = item_of[task_id]
        when = moment(cell)
        urgent = it.deadline - now <= timedelta(hours=URGENT_HOURS)
        points = PLACE_POINTS + PRIORITY_POINTS * it.priority + (URGENT_POINTS if urgent else 0)
        if fit is not None:                                            # ADAPTIVE only: M1 chance here
            points += round(FIT_POINTS * chance(when, plan[task_id][1], it.load)) * LOAD_WEIGHT.get(it.load, 2)
        hours_away = int((when - now).total_seconds() // 3600)
        return points - hours_away * (1 + it.priority // 2 + (2 if urgent else 0))   # sooner is better

    model.Maximize(sum(score(task_id, cell) * var for (task_id, cell), var in starts.items()))

    # ------------------------------------------------------------------
    # 4. Solve
    # ------------------------------------------------------------------
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = 8
    # Probing (a presolve step) used most of the 1.2 s: with a chain of 10 steps (FR-04) no plan at all was found
    # in time; without probing: chain 1.6 s total with a full plan, and plans without chains 1.1 s -> 0.6 s
    solver.parameters.cp_model_probing_level = 0
    result = solver.Solve(model)
    status = solver.StatusName(result)
    if result not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": status, "sessions": [],
                "unplaced": [{"task_id": it.task_id, "minutes": it.minutes} for it in items]}

    # ------------------------------------------------------------------
    # 5. Read the answer: number each task's pieces by time
    # ------------------------------------------------------------------
    chosen = {}
    for (task_id, cell), var in starts.items():
        if solver.Value(var):
            chosen.setdefault(task_id, []).append(cell)

    sessions, unplaced = [], []
    for it in items:
        count, size = plan[it.task_id]
        cells = sorted(chosen.get(it.task_id, []))
        left = it.minutes
        for number, cell in enumerate(cells, start=1):
            minutes = min(size, left)                                  # the very last piece can be shorter
            left -= minutes
            begin = moment(cell)
            sessions.append({
                "task_id": it.task_id, "piece": number, "of": count,
                "start": begin, "end": begin + timedelta(minutes=minutes), "minutes": minutes,
                "break_minutes": break_minutes, "load": it.load,
                "chance": round(chance(begin, size, it.load), 3) if fit else None,
            })
        if left > 0:
            unplaced.append({"task_id": it.task_id, "minutes": left})
    return {"status": status, "sessions": sorted(sessions, key=lambda s: s["start"]), "unplaced": unplaced}


# ---------------------------------------------------------------------------
# chains: the steps of one big task in their order
# ---------------------------------------------------------------------------
# Steps (and stress "part 1/3, 2/3 ...") must be done in order. Giving CP-SAT one precedence rule per pair
# made a chain of 10 steps too slow for the 2 s limit. Instead the chain is planned as ONE item (same total
# minutes, the earliest deadline, the highest priority, the heaviest load) and its pieces are handed to the
# steps in time order afterwards - so the order is right by construction and the model is smaller.
LOAD_ORDER = {"low": 0, "medium": 1, "heavy": 2}


def _merge_chains(items, after, chains):
    by_id = {it.task_id: it for it in items}
    member_of = {m: name for name, members in chains.items() for m in members}
    merged = [it for it in items if it.task_id not in member_of]
    for name, members in chains.items():
        steps = [by_id[m] for m in members]
        earliest = [s.earliest for s in steps if s.earliest]
        merged.append(WorkItem(name, sum(s.minutes for s in steps), min(s.deadline for s in steps),
                               max(s.priority for s in steps), max((s.load for s in steps), key=LOAD_ORDER.get),
                               earliest=max(earliest) if earliest else None))
    merged_after = {}
    for later, firsts in (after or {}).items():                      # "B after a step" -> "B after the chain"
        for first in firsts:
            a, b = member_of.get(first, first), member_of.get(later, later)
            if a != b:
                merged_after.setdefault(b, []).append(a)
    return merged, merged_after, by_id


def _split_chains(out, chains, by_id):
    sessions = [s for s in out["sessions"] if s["task_id"] not in chains]
    unplaced = [u for u in out["unplaced"] if u["task_id"] not in chains]
    for name, members in chains.items():
        todo = [[m, by_id[m].minutes] for m in members if by_id[m].minutes > 0]
        given = {m: [] for m in members}
        for piece in sorted((s for s in out["sessions"] if s["task_id"] == name), key=lambda s: s["start"]):
            begin, left = piece["start"], piece["minutes"]
            while left > 0 and todo:                                   # fill step 1, then step 2, ...
                step, need = todo[0]
                use = min(need, left)
                given[step].append({**piece, "task_id": step, "start": begin, "end": begin + timedelta(minutes=use),
                                    "minutes": use, "load": by_id[step].load})
                begin += timedelta(minutes=use)
                left -= use
                todo[0][1] -= use
                if todo[0][1] == 0:
                    todo.pop(0)
        for step, pieces in given.items():
            for number, s in enumerate(pieces, start=1):
                s["piece"], s["of"] = number, len(pieces)
            sessions += pieces
        unplaced += [{"task_id": step, "minutes": need} for step, need in todo]
    return {"status": out["status"], "sessions": sorted(sessions, key=lambda s: s["start"]), "unplaced": unplaced}


# ---------------------------------------------------------------------------
# time-grid helpers
# ---------------------------------------------------------------------------
def _round_up(moment: datetime) -> datetime:
    """Next :00 / :15 / :30 / :45 (or the same time if it is already on the grid)."""
    base = moment.replace(second=0, microsecond=0)
    if base < moment:
        base += timedelta(minutes=1)
    return base + timedelta(minutes=(-base.minute) % STEP_MINUTES)


def _cells(minutes: int) -> int:
    return math.ceil(minutes / STEP_MINUTES)


def _cell(origin: datetime, moment: datetime) -> int:
    return int((moment - origin).total_seconds() // 60) // STEP_MINUTES


def _possible_starts(free, origin, minutes, deadline):
    """Grid times where the whole piece fits inside one free gap and ends before the deadline."""
    for gap_start, gap_end in free:
        begin = max(_round_up(gap_start), origin)
        last_end = min(gap_end, deadline)
        while begin + timedelta(minutes=minutes) <= last_end:
            yield begin
            begin += timedelta(minutes=STEP_MINUTES)
