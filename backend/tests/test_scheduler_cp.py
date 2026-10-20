"""Module D - CP-SAT scheduler engine (pure function, no database)."""
import time
from datetime import datetime, timedelta

from app.components.scheduler.planning import cp_scheduler as cp
from app.components.scheduler.planning.cp_scheduler import WorkItem

NOW = datetime(2026, 10, 19, 8, 0)          # Monday 08:00 (tests use local time = UTC)


def free_days(days=5, start=8, end=22, busy=()):
    """Study window 08:00-22:00 every day, minus busy (day, from_h, to_h) blocks."""
    gaps = []
    for d in range(days):
        base = NOW.replace(hour=0) + timedelta(days=d)
        cuts = sorted((f, t) for day, f, t in busy if day == d)
        cursor = start
        for f, t in cuts:
            if f > cursor:
                gaps.append((base + timedelta(hours=cursor), base + timedelta(hours=f)))
            cursor = max(cursor, t)
        gaps.append((base + timedelta(hours=cursor), base + timedelta(hours=end)))
    return gaps


def evening_peak(hour, minutes, load):
    """Fake M1: 90% at 20:00-21:00, 40% otherwise."""
    return 0.9 if hour in (20, 21) else 0.4


def run(items, free=None, fit=None, piece=50, brk=10, cap=360):
    return cp.schedule(items, free or free_days(), NOW, piece_minutes=piece, break_minutes=brk,
                       day_cap_minutes=cap, study_day=lambda t: t.date(), local_hour=lambda t: t.hour, fit=fit)


def task(tid, minutes, due_days=4, load="medium", priority=3):
    return WorkItem(tid, minutes, NOW + timedelta(days=due_days), priority, load)


def test_tasks_are_cut_into_equal_pieces():
    assert cp.piece_plan(120, 50) == (3, 40)             # not 50 + 50 + 20
    assert cp.piece_plan(300, 50) == (6, 50)
    assert cp.piece_plan(30, 50) == (1, 30)
    out = run([task("t", 100)])                           # 100 -> 2 x 50
    assert [x["minutes"] for x in out["sessions"]] == [50, 50]


def test_plan_respects_free_time_deadlines_order_and_breaks():
    busy = [(0, 8, 12), (1, 13, 17)]                     # lectures
    items = [task("a", 150, 2), task("b", 90, 3, "heavy"), task("c", 45, 1, "low")]
    out = run(items, free_days(busy=busy))
    s = out["sessions"]
    assert out["status"] in ("OPTIMAL", "FEASIBLE") and not out["unplaced"]
    assert sum(x["minutes"] for x in s) == 150 + 90 + 45

    free = free_days(busy=busy)
    for x in s:
        assert any(g0 <= x["start"] and x["end"] <= g1 for g0, g1 in free)          # inside free time
        assert x["end"] <= next(i.deadline for i in items if i.task_id == x["task_id"])
    for x, y in zip(s, s[1:]):
        assert y["start"] >= x["end"] + timedelta(minutes=x["break_minutes"])        # no overlap, break kept
    for tid in "abc":
        mine = [x for x in s if x["task_id"] == tid]
        assert [x["piece"] for x in mine] == list(range(1, len(mine) + 1))         # pieces in order


def test_adaptive_puts_heavy_work_in_peak_hours_static_does_not():
    items = [task("heavy", 100, 4, "heavy")]
    adaptive = run(items, fit=evening_peak)["sessions"]
    static = run(items, piece=cp.STATIC_PIECE_MINUTES)["sessions"]
    assert all(x["start"].hour in (20, 21) for x in adaptive)
    assert all(x["chance"] == 0.9 for x in adaptive)
    assert static[0]["start"] == NOW                    # baseline: as early as possible
    assert static[0]["chance"] is None


def test_daily_cap_and_spacing():
    out = run([task("big", 300, 5)], cap=120)
    per_day = {}
    for x in out["sessions"]:
        per_day[x["start"].date()] = per_day.get(x["start"].date(), 0) + x["minutes"]
    assert max(per_day.values()) <= 120
    assert len(out["sessions"]) == 6                       # 300 min -> 6 pieces over 3+ days
    assert len(per_day) >= 3


def test_impossible_deadline_is_reported_not_forced():
    out = run([task("rush", 600, 0.5)])                  # 10 h of work, 12 h left, 4 h of it is night
    assert out["unplaced"] and out["unplaced"][0]["task_id"] == "rush"
    placed = sum(x["minutes"] for x in out["sessions"])
    assert placed + out["unplaced"][0]["minutes"] == 600
    assert all(x["end"] <= NOW + timedelta(days=0.5) for x in out["sessions"])


def test_urgent_and_important_work_goes_first_when_time_is_short():
    free = free_days(days=1, start=8, end=11)            # only 3 hours
    items = [task("later", 120, 5, priority=2), task("urgent", 120, 1, priority=5)]
    out = run(items, free, piece=60, brk=0)
    placed = {x["task_id"] for x in out["sessions"]}
    assert "urgent" in placed
    assert sum(x["minutes"] for x in out["sessions"] if x["task_id"] == "urgent") == 120


def test_a_busy_week_is_planned_fast():
    items = [task(f"t{i}", 60 + 30 * (i % 4), 2 + i % 5, ["heavy", "medium", "low"][i % 3], 1 + i % 5)
             for i in range(12)]
    t0 = time.perf_counter()
    out = run(items, free_days(days=7), fit=evening_peak)
    assert time.perf_counter() - t0 < 2.0                # NFR-01
    assert out["sessions"]


def test_one_day_can_have_a_smaller_cap():
    """Voice planner "I'm tired today": today's cap is halved, other days keep theirs."""
    items = [task("a", 300, due_days=3), task("b", 300, due_days=3)]
    out = cp.schedule(items, free_days(), NOW, piece_minutes=50, break_minutes=10, day_cap_minutes=300,
                      study_day=lambda t: t.date(), local_hour=lambda t: t.hour, day_caps={NOW.date(): 100})
    per_day = {}
    for s in out["sessions"]:
        per_day[s["start"].date()] = per_day.get(s["start"].date(), 0) + s["minutes"]
    assert per_day[NOW.date()] <= 100
    assert max(per_day.values()) > 100                    # the other days still use the full cap
